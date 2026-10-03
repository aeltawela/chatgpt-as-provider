# chatgpt-as-provider

Use your ChatGPT account from coding agents in two ways: ask ChatGPT for a second opinion while your current agent remains in charge, or use ChatGPT as the agent's model provider. Sign-in and inference use OpenAI's documented OAuth flow for open-source applications.

**Privacy default:** question content stays in process memory and the upstream Responses request uses `store: false`. Sessions are saved locally only when `--persist` is explicit. OAuth credentials are stored locally in an encrypted owner-only file. The calling client can still keep its own transcript; this tool cannot control OpenAI retention policy.

## Requirements

Node.js 22 or newer. Sign in from an eligible ChatGPT account that grants the plan-usage permission. The OAuth flow does not require an OpenAI API key. `chatgpt-as-provider` uses only documented public OAuth and Responses endpoints.

## Install as a harness plugin and sign in

Install it through the client’s normal extension or plugin manager. Each package includes the shared core, consultation tool, skills where supported, and OAuth-backed MCP tools or native tools. No separate global npm install or hand-copied MCP configuration is needed for consultation mode.

| Harness | Install | Update | Uninstall |
|---|---|---|---|
| Qwen Code | `qwen extensions install https://github.com/aeltawela/chatgpt-as-provider` | `qwen extensions update chatgpt-as-provider` | `qwen extensions uninstall chatgpt-as-provider` |
| OpenCode | `opencode plugin add github:aeltawela/chatgpt-as-provider` | `opencode plugin update chatgpt-as-provider` | `opencode plugin remove chatgpt-as-provider` |
| Pi | `pi install git:github.com/aeltawela/chatgpt-as-provider@v0.1.8` | `pi update --extensions` | `pi remove git:github.com/aeltawela/chatgpt-as-provider` |
| Gemini CLI | `gemini extensions install https://github.com/aeltawela/chatgpt-as-provider` | `gemini extensions update chatgpt-as-provider` | `gemini extensions uninstall chatgpt-as-provider` |
| Claude Code | `claude plugin marketplace add aeltawela/chatgpt-as-provider` then `claude plugin install chatgpt-as-provider@chatgpt-as-provider` | `claude plugin update chatgpt-as-provider@chatgpt-as-provider` | `claude plugin uninstall chatgpt-as-provider@chatgpt-as-provider` |

After restarting the harness when requested, call its `chatgpt_login` tool. It opens the official Sign in with ChatGPT browser link, waits for the localhost callback, checks OAuth state/PKCE/nonce and identity, and encrypts the credentials locally. Use `chatgpt_models` to inspect the account’s model catalog. For Qwen, use this plugin tool for ChatGPT sign-in; do not use Qwen's MCP-server OAuth action, which is for remote MCP servers and is separate from this local extension login.

Manual token entry is a terminal-only fallback for installations where the browser callback cannot work. From the installed package directory, run `node <plugin-directory>/src/cli.mjs login --manual-token` and paste into its hidden prompt. This accepts a bearer token only after `/v1/models` verifies it; it does not get OAuth identity or refresh guarantees, and the account identifier is a local fingerprint. Do not pass tokens in arguments, environment variables, chat, MCP tool calls, or settings.

Official install references: [Qwen extensions](https://github.com/QwenLM/qwen-code/blob/main/docs/users/extension/introduction.md), [OpenCode plugins](https://opencode.ai/docs/plugins/), [Pi packages](https://pi.dev/docs/latest/packages), [Gemini extensions](https://geminicli.com/docs/extensions/), and [Claude Code plugins](https://code.claude.com/docs/en/plugins).

The browser login opens a loopback callback on `127.0.0.1`, validates PKCE/state/nonce and identity token, then stores encrypted credentials in `~/.config/chatgpt-as-provider` (or `$XDG_CONFIG_HOME/chatgpt-as-provider`). A machine-specific host ID, encryption key and credentials are mode 0600; the data directory is mode 0700. Set `CHATGPT_PROVIDER_HOME` to choose another private path.

## Ask ChatGPT

The client plugin provides this function through its `ask_chatgpt` tool. Install the standalone CLI only if you also want direct terminal use or the manual-token fallback:

```sh
npm install --global github:aeltawela/chatgpt-as-provider
```

```sh
chatgpt-as-provider ask
printf '%s' 'Review this code path for race conditions.' | chatgpt-as-provider ask
chatgpt-as-provider ask --question 'Explain this diagram' --file ./diagram.png --json
chatgpt-as-provider ask --question 'Compare the alternatives' --persist
chatgpt-as-provider saved
chatgpt-as-provider export --session SESSION_ID
chatgpt-as-provider delete --session SESSION_ID
```

Without `--persist`, a conversation can continue by passing the returned conversation ID to MCP or the CLI's `--session`; in-memory temporary sessions expire after 30 minutes and are lost when the process exits. Persistent sessions can be listed, exported and deleted. Use `--account SUBJECT` to choose a signed-in account. `--reasoning auto|low|medium|high` sets effort; automatic mode uses `--caller-effort` when provided and otherwise asks ChatGPT a small classification request.

Start `chatgpt-as-provider mcp` for the stdio MCP server. It exposes `ask_chatgpt`, `chatgpt_models`, `chatgpt_saved_sessions`, `chatgpt_delete_session` and `chatgpt_export_session`. The asking tool accepts custom function declarations and returns proposed tool calls; the host controls approval and execution.

## Use ChatGPT as the provider

Start a local gateway in a private terminal or supervisor:

```sh
CHATGPT_PROVIDER_GATEWAY_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')" \
  chatgpt-as-provider serve --protocol openai
```

The gateway binds only to loopback (`127.0.0.1`) and requires the generated bearer token. Configure the client using the matching `integrations/<client>/README.md`. The gateway translates OpenAI Chat Completions, Anthropic Messages and Gemini `generateContent` into the shared Responses request path, forwards text deltas, and advertises models discovered from the ChatGPT account. Keep the gateway token out of shell history, settings files, logs and version control. Provider clients may independently save their transcripts.

## Capabilities and limits

```sh
chatgpt-as-provider capabilities
```

The documented OAuth route supports model discovery, text, model-supported image/file input, streaming Responses requests, web search where available, structured output where available and custom function tools. Support varies by model, account and harness adapter. The route does not provide ChatGPT conversation history, image generation, audio/video, transcription, File Search, Code Interpreter, native computer use, hosted connectors or Responses `tool_search`. It uses `store:false`, `stream:true`, and the public `/v1/responses` endpoint as required by this OAuth flow. Usage is subject to the account and app limits shown in ChatGPT.

Claude Code provider mode is a community adapter path. Anthropic does not support routing Claude Code to non-Claude models. See [the Claude integration note](integrations/claude/README.md).

## Integrations

See [Qwen Code](integrations/qwen/README.md), [OpenCode](integrations/opencode/README.md), [Pi](integrations/pi/README.md), [Gemini CLI](integrations/gemini/README.md) and [Claude Code](integrations/claude/README.md). The matching agent skill packages are in [`skills/`](skills/).

## Development

```sh
npm test
npm run check
```

The tests use mock OAuth accounts and mock Responses streams; they never spend ChatGPT plan usage. The [compatibility matrix](docs/compatibility.md) separates code/test coverage from live client verification.

## Privacy, security and reporting

See [security and privacy](docs/security-and-privacy.md). [AGENTS.md](AGENTS.md) requires reviewing every staged diff before commit and excluding personal or sensitive data. Do not file access tokens, refresh tokens, session contents or unredacted prompts in issues. Report suspected security issues privately to the repository owner until a security contact is published.

## Model selection

Model selection defaults to the available Luna model. Astra is selected only for an explicitly highly difficult task (or an explicit model choice); high reasoning effort alone keeps Luna. When the calling agent does not select effort, a small Luna classification request chooses effort and difficulty. Malformed classifications never escalate to Astra. If the required family is absent, select an available model explicitly. Results report `model`, `reasoning`, `difficulty` and `classified`. CLI users can set `--caller-effort low` and `--task-difficulty routine`; MCP/native tools use `caller_effort` and `task_difficulty`.

## License

MIT. See [LICENSE](LICENSE).
