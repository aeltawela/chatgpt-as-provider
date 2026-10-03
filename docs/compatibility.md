# Compatibility matrix

Statuses: **Implemented** means a wrapper or protocol translator exists in this repository. **Mock tested** means automated local tests exercise translation without client sign-in or paid inference. **Live unverified** means this environment did not have the client or an authenticated test account available. Do not interpret implementation or mock tests as end-to-end support.

| Client | Normal install / consultation wrapper | Provider protocol | Local status | Live client status |
|---|---|---|---|---|
| Qwen Code | Native extension + bundled stdio MCP and two qualified skills | OpenAI Chat Completions gateway | Manifest and tool contract tested | Live unverified |
| OpenCode | Git-installed package plugin registers both skills and native tools (v2); native tools (v1) | OpenAI Chat Completions gateway | v1/v2 entrypoints and tool/skill contracts tested | Live unverified |
| Pi | Git-installed package with native tools and skills | OpenAI Chat Completions gateway | Package manifest and tool contract tested | Live unverified |
| Gemini CLI | Native extension with bundled stdio MCP and skills | Gemini `generateContent` gateway | Manifest and tool contract tested | Live unverified |
| Claude Code | Marketplace plugin with bundled skills and stdio MCP | Anthropic Messages gateway | Plugin, marketplace and tool contracts tested | Live unverified; unsupported by Anthropic for non-Claude models |

## Protocol notes

The OpenAI Chat Completions, Anthropic Messages and Gemini formats are translated by `src/protocols.mjs`. The Responses request remains the source of truth. Text deltas are forwarded as they arrive; structured tool arguments are emitted after the completed upstream response because the shared result validates the terminal event first. Gemini Files API URIs and Gemini structured-output settings are not translated. The three gateway stream contracts are unit tested; no harness CLI sign-in/inference smoke test is claimed until a client and authenticated account are available.

## 0.1.4 targeted verification

A live shared MCP consultation using a synthetic question returned nonempty text on the catalog-selected Luna model with low effort and `persist:false`. Sparse completion output, citations, tool calls and Luna/Astra selection have automated regression coverage. This verifies the OAuth/MCP path, not every harness/provider scenario; the full live-client matrix above remains unverified.
