# Security and privacy

- OAuth uses authorization code + PKCE, a random state, OIDC nonce, exact loopback callback, issuer/JWKS/signature/audience/expiry checks and the required `chatgpt.tokens.use.direct` grant.
- Standard sign-in is initiated by the installed harness tool `chatgpt_login`, which opens the official browser authorization link and accepts only the matching localhost callback. Tokens are never returned to the model.
- Exceptional manual access-token entry is available only in the local CLI hidden-input prompt. The token is checked against the public `/v1/models` endpoint before storage, encrypted at rest, and never appears as an argument or environment value. Manual credentials do not provide verified identity, refresh, or revocation; the local account key is a token fingerprint. Expired or rejected tokens must be replaced manually.
- Access, refresh and identity tokens are encrypted with AES-256-GCM. The randomly generated local key and ciphertext files are owner-only. This protects against casual access by other local accounts; a process running as the same user can read them.
- Inference always targets `https://api.openai.com/v1/responses` with `store:false` and `stream:true`. Never call private ChatGPT backend endpoints.
- No content is intentionally written to a temporary-session file or log. The process holds temporary turns in RAM; explicitly persistent turns are encrypted locally.
- Only bind provider gateways to loopback and require a random bearer token. Do not commit tokens, OAuth data, local session files, prompts, outputs, or client config containing secrets.
- MCP returns proposed tool calls only. The calling harness must review and execute them. Do not configure local shell execution as an implicit remote tool.
- Sign-out deletes local credentials. Token revocation is best-effort; if OpenAI cannot be reached, disconnect the app in ChatGPT settings.
- Manual tokens cannot be revoked by this application. Replace or revoke them at the system that issued them.
- This application cannot control retention by OpenAI, the calling agent, terminal scrollback, backups or operating-system diagnostics. Consult the ChatGPT data and usage settings for account-level controls.
- Extension tools never return email addresses, OAuth identity subjects, manual-token labels, or other personal account details to the calling agent. Authentication responses report only the sign-in method; account listings use non-identifying local positions such as `account-1`.
- Optional telemetry, analytics, crash reporting and remote tracing are not implemented. No outbound network request occurs before sign-in except during an explicitly invoked OAuth or inference command.
