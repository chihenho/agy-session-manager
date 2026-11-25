# Installing `agy-session-manager` for Antigravity

When a user asks you to install `https://github.com/chihenho/agy-session-manager`, follow these exact steps:

1. **Check prerequisites**: Verify `git` and `node` (>= 18) are available.
2. **Clone or update**:
   - Target repo directory: `~/.gemini/antigravity/scratch/agy-session-manager`
   - If `.git` exists there, run `git pull --ff-only`; otherwise run `git clone https://github.com/chihenho/agy-session-manager.git ~/.gemini/antigravity/scratch/agy-session-manager`.
3. **Install**:
   - Use `--lang zh` if the user's request is in Chinese, otherwise `node install.mjs`.
   - `install.mjs` installs the plugin into `~/.gemini/config/plugins/agy-session-manager/` with pre-built `dist/app.html`, `mcp_config.json`, `plugin.json`, and `skills/session-manager/SKILL.md`.
4. **Validate & diagnose**:
   - Run `agy plugin validate --strict ~/.gemini/config/plugins/agy-session-manager` (if `agy` CLI is installed).
   - Run `node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs doctor`.
   - Query `GetAllPlugins` RPC (filtered with `jq` — never dump full `SKILL.md`) to confirm `agy-session-manager` is discovered with `dir == "agy-session-manager"`, `disabled == false`, and `mcp` containing `"sessions"`.
5. **Reply to user**:
   - Provide `[Session Manager](customization://agy-session-manager)` (or `[会话管理器](customization://agy-session-manager)`).
   - Explain how to open the UI: **Plugins → Session Manager** in the left sidebar (full page), or the **`+`** menu in the right side panel (`aux_pane`), or by asking in chat.
