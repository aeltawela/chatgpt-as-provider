# Plugin context

This extension bundles its own shared core. Use its packaged MCP tools and skills; do not require a separate global installation. Before every commit, inspect the complete staged diff and exclude all personal or sensitive information, including credentials, account identifiers, private host/network details, configuration, personal contact details, and private conversations.

This single extension contains both skills. Use the qualified consultation skill `/chatgpt-as-provider:ask-chatgpt <question>` or call the bundled MCP `ask_chatgpt` tool directly. Do not use a separate `/chatgpt-ask` command. Never invoke the bare `ask-chatgpt` name through the Skill tool. Default to Luna; reserve Astra for explicitly highly difficult problems or an explicit user choice.
