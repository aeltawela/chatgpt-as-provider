import { createHash, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { accounts, saveAccount, removeAccount, dataDir } from './store.mjs';
import { chmod, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const authBase = 'https://auth.openai.com/api/accounts';
const resource = 'https://api.openai.com/v1';
const requiredScope = 'chatgpt.tokens.use.direct';
const b64 = b => Buffer.from(b).toString('base64url');
const decode = x => JSON.parse(Buffer.from(x, 'base64url').toString('utf8'));
export function randomText(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
export function pkceChallenge(verifier) { return createHash('sha256').update(verifier).digest('base64url'); }
export async function validateIdToken(token, { clientId, nonce, fetcher = fetch }) {
  const p = token.split('.'); if (p.length !== 3) throw new Error('Invalid ID token.');
  const header = decode(p[0]), claims = decode(p[1]);
  if (!['RS256', 'ES256'].includes(header.alg)) throw new Error('Unsupported identity token signature algorithm.');
  const jwksRes = await fetcher('https://auth.openai.com/.well-known/jwks.json');
  if (!jwksRes.ok) throw new Error(`Could not retrieve identity signing keys (${jwksRes.status}).`);
  const jwks = await jwksRes.json(); const jwk = jwks.keys.find(k => k.kid === header.kid && k.alg === header.alg);
  if (!jwk) throw new Error('Identity token signing key was not found.');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const alg = header.alg === 'RS256' ? 'RSA-SHA256' : 'sha256';
  if (!verifySignature(alg, Buffer.from(`${p[0]}.${p[1]}`), header.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key, Buffer.from(p[2], 'base64url'))) throw new Error('Identity token signature is invalid.');
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'https://auth.openai.com') throw new Error('Unexpected identity token issuer.');
  if (!(claims.aud === clientId || (Array.isArray(claims.aud) && claims.aud.includes(clientId)))) throw new Error('Identity token audience does not match this app.');
  if (!claims.sub || claims.exp <= now || claims.iat > now + 60 || claims.nonce !== nonce) throw new Error('Identity token expiry, subject, or nonce validation failed.');
  return claims;
}
async function writeHostId() {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = join(dataDir, 'host-id');
  try { return (await (await import('node:fs/promises')).readFile(file, 'utf8')).trim(); }
  catch (e) { if (e.code !== 'ENOENT') throw e; const id = `urn:uuid:${randomUUID()}`; await writeFile(file, id, { mode: 0o600, flag: 'wx' }); await chmod(file, 0o600); return id; }
}
export async function signIn({ launchBrowser = true, newAccount = false, accountSubject, fetcher = fetch, port = 0 } = {}) {
  const state = randomText(), nonce = randomText(), verifier = randomText(48), challenge = pkceChallenge(verifier);
  const hostId = await writeHostId();
  const prior = await accounts();
  const selected = accountSubject ? selectedAccount(prior, accountSubject) : prior.find(a => a.auth_method !== 'manual');
  if (accountSubject && !selected) throw new Error('The selected ChatGPT account is not signed in. Choose an account from `accounts`.');
  if (selected?.auth_method === 'manual') throw new Error('Manual access tokens cannot be used for browser reauthorization. Start a new browser sign-in instead.');
  const clientId = (!newAccount && selected?.client_id) || 'dynamic_agent_client';
  let callbackResolve;
  const callback = new Promise(resolve => { callbackResolve = resolve; });
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/auth/callback') { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('ChatGPT sign-in received. You may close this tab.');
    callbackResolve(url.searchParams);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const actualPort = server.address().port, redirect = `http://127.0.0.1:${actualPort}/auth/callback`;
  const url = new URL(`${authBase}/authorize`);
  const scopes = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
  for (const [k, v] of Object.entries({ client_id: clientId, response_type: 'code', redirect_uri: redirect, scope: scopes, resource, state, nonce, code_challenge_method: 'S256', code_challenge: challenge, ext_agent_host_id: hostId, ...(clientId === 'dynamic_agent_client' ? { agent_name_hint: 'chatgpt-as-provider' } : {}), ...(selected?.id_token ? { id_token_hint: selected.id_token } : {}), ...(selected?.email ? { login_hint: selected.email } : {}) })) url.searchParams.set(k, v);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  try {
    if (launchBrowser) {
      const child = process.platform === 'win32' ? spawn('cmd', ['/c', 'start', '', url.toString()], { detached: true, stdio: 'ignore' }) : spawn(opener, [url.toString()], { detached: true, stdio: 'ignore' });
      const browserFailure = () => process.stderr.write(`Could not open a browser. Copy this one-time ChatGPT sign-in link into your browser: ${url}\n`);
      child.once('error', browserFailure);
      child.once('exit', code => { if (code !== 0) browserFailure(); });
      child.unref();
    }
    else console.log(url.toString());
    let timeout;
    const expired = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Sign-in timed out.')), 5 * 60_000); timeout.unref(); });
    const params = await Promise.race([callback, expired]);
    clearTimeout(timeout);
    if (params.get('state') !== state) throw new Error('OAuth state did not match.');
    if (params.get('error')) throw new Error(params.get('error_description') || params.get('error'));
    const code = params.get('code'), issuedId = params.get('client_id') || clientId;
    if (!code || !issuedId || issuedId === 'dynamic_agent_client') throw new Error('OAuth registration did not return an issued client ID.');
    if (params.get('client_id') && clientId !== 'dynamic_agent_client' && params.get('client_id') !== clientId) throw new Error('OAuth callback client ID changed unexpectedly.');
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: issuedId, code, code_verifier: verifier, redirect_uri: redirect, resource });
    const tokenRes = await fetcher(`${authBase}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status}).`);
    const tokens = await tokenRes.json(); const scopesGranted = (tokens.scope || '').split(' ').filter(Boolean);
    if (!scopesGranted.includes(requiredScope)) throw new Error('ChatGPT plan usage permission was not granted.');
    const identity = await validateIdToken(tokens.id_token, { clientId: issuedId, nonce, fetcher });
    if (selected && selected.subject !== identity.sub) throw new Error('The signed-in identity does not match the selected ChatGPT account.');
    const account = { subject: identity.sub, email: identity.email || null, client_id: issuedId, ext_agent_host_id: hostId, issuer: identity.iss, id_token: tokens.id_token, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_type: tokens.token_type, expires_at: Date.now() + tokens.expires_in * 1000, scopes: scopesGranted, auth_method: 'oauth' };
    await saveAccount(account); return { auth_method: 'oauth' };
  } finally { server.close(); }
}
export async function signInWithManualToken(token, { fetcher = fetch, label = null } = {}) {
  if (typeof token !== 'string' || token.trim().length < 20) throw new Error('The manually entered access token is empty or too short.');
  const accessToken = token.trim();
  const response = await fetcher('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`The manually entered token was rejected by the OpenAI models endpoint (${response.status}).`);
  await response.arrayBuffer();
  let expiresAt = Number.MAX_SAFE_INTEGER;
  try { const claims = decode(accessToken.split('.')[1]); if (Number.isFinite(claims.exp)) expiresAt = claims.exp * 1000; } catch {}
  const fingerprint = createHash('sha256').update(accessToken).digest('hex');
  const account = { subject: `manual:${fingerprint}`, email: label || null, client_id: null, ext_agent_host_id: await writeHostId(), issuer: 'manual-token', id_token: null, access_token: accessToken, refresh_token: null, token_type: 'Bearer', expires_at: expiresAt, scopes: ['manual-token'], auth_method: 'manual' };
  await saveAccount(account);
  return { auth_method: 'manual' };
}
export async function refreshAccount(account, fetcher = fetch) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: account.client_id, refresh_token: account.refresh_token, resource });
  const res = await fetcher(`${authBase}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}); run sign-in again if access was revoked.`);
  const next = await res.json();
  return { ...account, access_token: next.access_token, refresh_token: next.refresh_token || account.refresh_token, id_token: next.id_token || account.id_token, expires_at: Date.now() + next.expires_in * 1000, scopes: (next.scope || account.scopes.join(' ')).split(' ').filter(Boolean) };
}
const refreshLocks = new Map();
async function acquireRefreshLock(key) {
  const lockDir = join(dataDir, 'refresh-locks', createHash('sha256').update(key).digest('hex'));
  await mkdir(join(dataDir, 'refresh-locks'), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { await mkdir(lockDir, { mode: 0o700 }); return async () => rm(lockDir, { recursive: true, force: true }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try { if (Date.now() - (await stat(lockDir)).mtimeMs > 120_000) { await rm(lockDir, { recursive: true, force: true }); continue; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Timed out waiting for another process to refresh this ChatGPT session.');
}
function selectedAccount(all, selector) {
  if (!selector) return all[0];
  const match = /^account-(\d+)$/.exec(selector);
  if (match) return all[Number(match[1]) - 1];
  return all.find(a => a.subject === selector);
}
export async function usableAccount(subject, { fetcher = fetch } = {}) {
  const all = await accounts(); let account = selectedAccount(all, subject);
  if (!account) throw new Error('No ChatGPT account is signed in. Run `chatgpt-as-provider login`.');
  if (account.auth_method === 'manual') {
    if (account.expires_at <= Date.now()) throw new Error('The manually entered access token has expired. Run `chatgpt-as-provider login --manual-token` again.');
    return account;
  }
  if (account.expires_at <= Date.now() + 60_000) {
    const lock = account.subject + account.client_id;
    if (!refreshLocks.has(lock)) refreshLocks.set(lock, (async () => {
      const release = await acquireRefreshLock(lock);
      try {
        const latest = (await accounts()).find(a => a.subject === account.subject && a.client_id === account.client_id);
        if (!latest) throw new Error('This ChatGPT account was removed while refreshing.');
        if (latest.expires_at > Date.now() + 60_000) return latest;
        const next = await refreshAccount(latest, fetcher); await saveAccount(next); return next;
      } finally { await release(); }
    })().finally(() => refreshLocks.delete(lock)));
    account = await refreshLocks.get(lock);
  }
  return account;
}
export async function signOut(subject) { const all = await accounts(); const selected = subject ? selectedAccount(all, subject) : null; for (const a of all.filter(x => !subject || x.subject === selected?.subject)) { if (a.refresh_token) { try { const body = new URLSearchParams({ token: a.refresh_token, token_type_hint: 'refresh_token' }); await fetch(`${authBase}/oauth/revoke`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }); } catch {} } await removeAccount(a.subject); } }
