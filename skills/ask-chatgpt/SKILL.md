---
name: ask-chatgpt
description: Ask ChatGPT for a second opinion while keeping the current agent in control. Use when the user asks for another model's view or an independent check.
user-invocable: false
---

# Ask ChatGPT

Use the bundled `ask_chatgpt` tool for a focused second opinion. Include only the context needed to answer; keep the local conversation temporary unless the user requests saving it. If sign-in is needed, call the bundled `chatgpt_login` tool, which opens the official ChatGPT login link and waits for its validated localhost callback. Do not ask the user to paste an access token into chat or a tool argument. State the selected model and reasoning effort when reporting the answer. Preserve citations and label uncertainty. ChatGPT may return tool requests; ask the host to approve and run them, then return results through the same conversation ID. Never claim a temporary session is available after its process exits.

The OAuth flow does not expose ChatGPT history and supports fewer features than the ChatGPT app. Check `chatgpt-as-provider capabilities` when a requested feature may be unsupported. The calling client may retain its own transcript independently.

Default to Luna by leaving `model` unset. Choose the minimum useful `caller_effort` (low, medium, high) and `task_difficulty` (routine, difficult, highly_difficult). Reserve highly_difficult, which selects Astra, for exceptional research, complex proofs or deeply coupled analysis. High reasoning effort alone keeps Luna. An explicit user model wins; unavailable Luna/Astra must produce a clear error instead of substituting a model.
