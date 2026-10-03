# Changelog

## 0.1.6

- Keep one Qwen extension with both qualified skills and remove the separate consultation shortcut command.

## 0.1.5

- Hide the internal consultation skill from Qwen's slash menu while keeping it available for model invocation. Use `/chatgpt-ask` as the single user-facing command.

## 0.1.4

- Preserve streamed text, citations and tool calls when the completion event omits output; reject truly empty completions without replay.
- Default to the account's Luna model; reserve Astra for highly difficult tasks or an explicit model choice. Keep reasoning effort separate from model escalation.
- Add Qwen's packaged `/chatgpt-ask` command to bypass bare-name Skill lookup failures.
- Isolate wrapper tests from locally signed-in accounts and add sparse-stream/model-policy regressions.
- Hide the internal consultation skill from Qwen's slash menu so it does not duplicate `/chatgpt-ask`.

## 0.1.3

- Keep Claude Code MCP configuration in its plugin manifest so Qwen does not load Claude-only path variables or start an unrelated MCP OAuth flow.

## 0.1.2

- Package the shared core through each harness's normal extension/plugin manager.
- Add in-plugin browser sign-in and terminal-only manual access-token entry.
- Add explicit agent instructions to keep personal and sensitive information out of commits.
- Run CI dependency installation before tests and checks.

## 0.1.1

- Fix automatic reasoning classification request shape and release its OAuth sign-in timeout after callback.

## 0.1.0

- Initial shared OAuth core, CLI, stdio MCP consultation interface and opt-in encrypted local sessions.
- OpenAI Chat Completions, Anthropic Messages and Gemini generateContent provider gateway adapters.
- Qwen Code, OpenCode, Pi, Gemini CLI and Claude Code integration guidance and skills.
