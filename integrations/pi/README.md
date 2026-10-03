# Pi

Install the encapsulated package using Pi's package manager:

```sh
pi install git:github.com/aeltawela/chatgpt-as-provider@v0.1.8
```

This registers the native tools and both skills with Pi and includes the shared core. Use `chatgpt_login` once to open the official browser login. Update with `pi update --extensions` and remove with `pi remove git:github.com/aeltawela/chatgpt-as-provider`.

If the browser callback is unavailable, use the hidden-input fallback from the installed package directory: `node <package-directory>/src/cli.mjs login --manual-token`. Never put a token in chat, shell history, command arguments, settings, or a tool call.

For provider mode, Pi's OpenAI-compatible model configuration can target `http://127.0.0.1:8765/v1` while `node <package-directory>/src/cli.mjs serve --protocol openai` is running. Supply the local gateway token in Pi's private environment/credential mechanism; never put it in a checked-in `models.json`. Add a model id returned by `chatgpt_models` and explicitly select it. Restore the saved Pi configuration to uninstall.
