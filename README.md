English | [简体中文](./README.zh-CN.md)

# agy-session-manager

**Visual session & archived conversation manager for Antigravity** — powered by an MCP App UI (`global` full-page + `aux_pane` side panel), real archived status sync (`snapshot.json` + `Stop` auto-sync hook), local transcript & artifact/image full-text indexing, and zero-runtime-dependency Node.js CLI/MCP tools.

## Features

- **Real Archived Status Sync & One-Click Restore**:
  - Antigravity injects `ConversationService` credentials (`ANTIGRAVITY_LS_ADDRESS` / `ANTIGRAVITY_CSRF_TOKEN`) into agent shells and hooks, not MCP server child processes.
  - `agy-session-manager` bridges this cleanly via a shared `${PLUGIN_DATA}/snapshot.json` metadata cache (auto-synced on install, periodically by a non-blocking `Stop` hook, or on demand via `cli.mjs sync`).
  - From the **side panel (`+` → Session Manager)**, clicking **Sync Status**, **Restore to Active**, **Archive**, **Batch Restore**, **Pin**, **Star**, **Rename**, or **Delete** executes via the CLI. With the **Background** toggle on (default), actions run in an isolated background conversation (`target: "new"`) and auto-archive the helper thread so your current chat stays clean.
  - In **full-page view**, native actions copy the ready-to-run command to your clipboard.
- **Full-Page & Side-Panel MCP App UI (`ui://agy-session-manager/app.html`)**:
  - Open full-width from the left sidebar (**Plugins → Session Manager**) or beside your conversation from the side panel **`+`** menu.
  - Adapts automatically to Antigravity light/dark themes and locale (EN / 简体中文 toggle).
- **Cross-Session Transcript & Artifact/Image Search**:
  - Searches titles, summaries, tags, personal notes, `transcript.jsonl` contents, and generated image/document filenames across all archived and active sessions.
  - Dedicated **Artifacts & Images** gallery view with inline image/Markdown preview and one-click **Open in Side Pane**.

---

## 1-Paste Install in Antigravity

Paste this directly into Antigravity (requires **Git** and **Node.js >= 18**):

```text
Please install https://github.com/chihenho/agy-session-manager into my Antigravity:
Follow INSTALL_FOR_AGENTS.md in the repo — clone to ~/.gemini/antigravity/scratch/agy-session-manager, run `node install.mjs`, validate with `agy plugin validate --strict`, run `doctor`, verify via GetAllPlugins RPC (filtered) that the plugin and `sessions` MCP server are active, and give me the [Session Manager](customization://agy-session-manager) link.
```

*(Prefer Chinese plugin metadata? Use `node install.mjs --lang zh`.)*

### Manual CLI Install

```bash
git clone https://github.com/chihenho/agy-session-manager.git
cd agy-session-manager
node install.mjs          # English (default)
# or: node install.mjs --lang zh
```

---

## CLI Usage

```bash
CLI="$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs"

node "$CLI" sync                       # Sync active/archived status from ConversationService
node "$CLI" unarchive <id...>          # Restore archived conversation(s) to Active
node "$CLI" archive <id...>            # Archive conversation(s)
node "$CLI" list --archived --limit 20 # List archived sessions
node "$CLI" search "cylanco"           # Full-text transcript + artifact search
node "$CLI" artifacts --images         # List generated images across all sessions
node "$CLI" doctor                     # Diagnostics
```

## Privacy & Security

- 100% local execution — no telemetry, no remote requests, strict CSP (`default-src 'none'`) in the MCP App iframe.
- `snapshot.json` stores only non-sensitive conversation metadata (`id`, `metadata`, `annotations`, `state`); `ANTIGRAVITY_CSRF_TOKEN` is **never** written to disk.
- Artifact preview enforces strict path-traversal containment within `~/.gemini/antigravity/brain/<conversation-id>/`.

## License

[MIT](./LICENSE)
