import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const privateHome = await mkdtemp(join(tmpdir(), 'provider-wrapper-test-'));
process.env.CHATGPT_PROVIDER_HOME = privateHome;
test.after(() => rm(privateHome, { recursive: true, force: true }));
const { dispatchMcp } = await import('../src/mcp.mjs');
const { startGateway, makeGatewayToken } = await import('../src/gateway.mjs');
const { limits, validateCapabilities } = await import('../src/core.mjs');
const { toOpenAI, toAnthropic, toGemini } = await import('../src/protocols.mjs');
test('MCP publishes each consultation and session tool', async () => {
  const init=await dispatchMcp({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}}); assert.equal(init.result.serverInfo.name,'chatgpt-as-provider');
  const list=await dispatchMcp({jsonrpc:'2.0',id:2,method:'tools/list'}); assert.deepEqual(list.result.tools.map(t=>t.name),['chatgpt_login','chatgpt_logout','chatgpt_accounts','ask_chatgpt','chatgpt_models','chatgpt_saved_sessions','chatgpt_delete_session','chatgpt_export_session']);
});
test('OAuth capability registry is explicit and rejects unsupported features', () => { assert.ok(limits.supported.includes('web_search')); assert.ok(limits.unsupported.includes('code_interpreter')); assert.throws(()=>validateCapabilities({features:['audio']}),/Unsupported/); });
test('provider gateway is loopback-only and protects inference routes with a token', async t => {
  const token=makeGatewayToken(), {server,port}=await startGateway({protocol:'openai',port:0,token}); t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${port}`; assert.deepEqual(await (await fetch(base+'/health')).json(),{ok:true});
  const rejected=await fetch(base+'/v1/chat/completions',{method:'POST',body:'{}'}); assert.equal(rejected.status,401);
  const accepted=await fetch(base+'/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:'{}'}); assert.equal(accepted.status,502); assert.match((await accepted.json()).error.message,/No ChatGPT account/);
  await assert.rejects(startGateway({protocol:'openai',port:0,token,host:'0.0.0.0'}),/loopback/);
});
test('provider gateways stream text deltas for each client protocol', async t => {
  for (const [protocol, request, path, formatter] of [
    ['openai', { model: 'gpt-test', messages: [{ role: 'user', content: 'hi' }], stream: true }, '/v1/chat/completions', toOpenAI],
    ['anthropic', { model: 'gpt-test', messages: [{ role: 'user', content: 'hi' }], stream: true }, '/v1/messages', toAnthropic],
    ['gemini', { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }, '/v1beta/models/gpt-test:streamGenerateContent', toGemini]
  ]) {
    const token=makeGatewayToken();
    const handleRequest=async(_protocol,_body,opts)=>{ opts.onEvent({type:'metadata',model:'gpt-test'}); opts.onEvent({type:'text_delta',text:'hello '}); opts.onEvent({type:'text_delta',text:'world'}); const result={responseId:'r1',text:'hello world',model:'gpt-test',toolCalls:[],usage:{input_tokens:1,output_tokens:2,total_tokens:3}}; return {result,formatter}; };
    const {server,port}=await startGateway({protocol,port:0,token,handleRequest}); t.after(()=>new Promise(r=>server.close(r)));
    const response=await fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(request)}); const data=await response.text(); assert.equal(response.status,200); assert.match(data,/hello /); assert.match(data,/world/);
  }
});
test('all five integration guides reference both consultation and provider paths', async () => {
  for (const client of ['qwen','opencode','pi','gemini','claude']) { const guide=await readFile(new URL(`../integrations/${client}/README.md`,import.meta.url),'utf8'); assert.match(guide,/Consultation|ask-chatgpt|MCP|skill/); assert.match(guide,/Provider|provider mode/); }
});
test('each harness uses its normal package installer and the package carries its shared core', async () => {
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.name,'chatgpt-as-provider'); assert.equal(pkg.main,'./integrations/opencode/plugin.mjs');
  assert.ok(pkg.pi.extensions.includes('./integrations/pi/ask-chatgpt.ts')); assert.ok(pkg.pi.skills.includes('./skills'));
  const qwen=JSON.parse(await readFile(new URL('../qwen-extension.json',import.meta.url),'utf8'));
  const gemini=JSON.parse(await readFile(new URL('../gemini-extension.json',import.meta.url),'utf8'));
  assert.equal(qwen.commands, 'commands');
  const command = await readFile(new URL('../commands/chatgpt-ask.md', import.meta.url), 'utf8');
  assert.match(command, /\{\{args\}\}/); assert.match(command, /Do not invoke the Skill tool/);
  const consultationSkill = await readFile(new URL('../skills/ask-chatgpt/SKILL.md', import.meta.url), 'utf8');
  assert.match(consultationSkill, /user-invocable: false/);
  assert.match(qwen.mcpServers.chatgpt.args[0],/\$\{extensionPath\}.*src\/cli\.mjs/);
  assert.match(gemini.mcpServers.chatgpt.args[0],/\$\{extensionPath\}.*src\/cli\.mjs/);
  const claudePlugin=JSON.parse(await readFile(new URL('../.claude-plugin/plugin.json',import.meta.url),'utf8'));
  assert.match(claudePlugin.mcpServers.chatgpt.args[0],/\$\{CLAUDE_PLUGIN_ROOT\}.*src\/cli\.mjs/);
  await assert.rejects(readFile(new URL('../.mcp.json',import.meta.url),'utf8'),{code:'ENOENT'});
  const plugin=await import('../integrations/opencode/plugin.mjs'); assert.equal(typeof plugin.default.setup,'function'); assert.equal(plugin.default.id,'chatgpt-as-provider');
  const v2tools=[], v2skills=[];
  await plugin.default.setup({skill:{transform:async fn=>fn({add:value=>v2skills.push(value)})},tool:{transform:async fn=>fn({add:value=>v2tools.push(value)})}});
  assert.deepEqual(v2tools.map(t=>t.name),['chatgpt_login','chatgpt_logout','chatgpt_accounts','chatgpt_models','ask_chatgpt']);
  const askTool=v2tools.find(t=>t.name==='ask_chatgpt');
  for (const key of ['attachments','conversation_id','history','web_search','tools','features','text','task_difficulty']) assert.ok(key in askTool.input.properties);
  assert.deepEqual(v2skills.map(s=>s.id),['ask-chatgpt','chatgpt-as-provider']);
  assert.ok(v2skills.every(s=>s.content.includes('chatgpt_login')));
  const v1=await plugin.default.server(); assert.deepEqual(Object.keys(v1.tool),['chatgpt_login','chatgpt_logout','chatgpt_accounts','chatgpt_models','ask_chatgpt']);
  const guides=await Promise.all(['qwen','opencode','pi','gemini','claude'].map(c=>readFile(new URL(`../integrations/${c}/README.md`,import.meta.url),'utf8')));
  for (const guide of guides) { assert.match(guide,/install/i); assert.match(guide,/uninstall/i); assert.match(guide,/chatgpt_login/); assert.match(guide,/manual-token/); }
});
