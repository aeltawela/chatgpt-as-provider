import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = await mkdtemp(join(tmpdir(), 'chatgpt-provider-manual-auth-'));
process.env.CHATGPT_PROVIDER_HOME = home;
const oauth = await import('../src/oauth.mjs');
const store = await import('../src/store.mjs');

test('manual-token path verifies the bearer before encrypted local storage', async () => {
  const token = 'test-only-fake-bearer-access-token-never-valid';
  let called = false;
  const result = await oauth.signInWithManualToken(token, { label: 'local test', fetcher: async (url, options) => {
    called = true; assert.equal(url, 'https://api.openai.com/v1/models'); assert.equal(options.headers.authorization, `Bearer ${token}`);
    return new Response('{"data":[]}', { status: 200 });
  } });
  assert.equal(called, true); assert.deepEqual(result, { auth_method: 'manual' });
  const account = (await store.accounts())[0]; assert.equal(account.access_token, token); assert.equal(account.refresh_token, null);
  assert.doesNotMatch(await readFile(store.credentialFile, 'utf8'), new RegExp(token));
  await assert.rejects(oauth.signInWithManualToken(token, { fetcher: async () => new Response('{}', { status: 401 }) }), /was rejected/);
  assert.equal((await store.accounts()).length, 1);
});

test('manual credentials are not silently refreshed and report expiry', async () => {
  await store.saveAccount({ subject: 'manual:expired-test', auth_method: 'manual', client_id: null, access_token: 'expired-test-token', expires_at: 1, refresh_token: null, scopes: [] });
  await assert.rejects(oauth.usableAccount('manual:expired-test', { fetcher: async () => { throw new Error('must not refresh'); } }), /manually entered access token has expired/);
});

test.after(async () => { delete process.env.CHATGPT_PROVIDER_HOME; await rm(home, { recursive: true, force: true }); });
