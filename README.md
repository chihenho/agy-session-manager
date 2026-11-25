English | [简体中文](./README.zh-CN.md)

# agy-session-manager

**Visual session & archived conversation manager for Antigravity** — powered by an MCP App UI (`global` full-page + `aux_pane` side panel), local transcript & artifact/image full-text indexing, and zero-runtime-dependency Node.js MCP tools.

## Features

- **Full-Page & Side-Panel MCP App UI (`ui://agy-session-manager/app.html`)**:
  - Open full-width from the left sidebar (**Plugins → Session Manager**) or beside your current conversation from the side panel **`+`** menu.
  - Adapts automatically to Antigravity light/dark host themes and locale (EN / 简体中文 toggle).
- **Unified Archived & Active Conversation Browser**:
  - Filter by `All`, `Active`, `Archived`, `Pinned`, `Starred`, project, or tag.
  - Subagent-only trajectories are hidden by default (toggleable with one click).
- **Cross-Session Transcript & Artifact/Image Search**:
  - Searches titles, summaries, tags, personal notes, `transcript.jsonl` contents, and generated image/document filenames across all archived and active sessions.
  - Dedicated **Artifacts & Images** gallery view with inline image/Markdown preview and one-click **Open in Side Pane**.
- **Dual-Mode Backend (`Live API` + `Local Index`)**:
  - **Live API mode**: When `ANTIGRAVITY_LS_ADDRESS` and `ANTIGRAVITY_CSRF_TOKEN` are provided in the server environment, reads and mutates native Antigravity state directly via `product.v1.ConversationService` (archive, unarchive, pin, star, rename, tag, batch update, delete).
  - **Local Index fallback**: Works out-of-the-box offline against `~/.gemini/antigravity/brain/<id>/`, persists personal notes and tags in `${PLUGIN_DATA}/store.json`, and includes a `session-manager` skill so you can also execute native `ConversationService` batch actions directly from chat.

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

*(Pre-built `dist/app.html` is committed so end users need **zero** `npm install` at install time. If you modify `web/`, run `npm install && npm run build:ui`.)*

---

## CLI Usage

```bash
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs stats
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs list --archived --limit 20
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs search "cylanco"
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs artifacts --images
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs doctor
```

## Privacy & Security

- 100% local execution — no telemetry, no remote requests, strict CSP (`default-src 'none'`) in the MCP App iframe.
- Artifact preview enforces strict path-traversal containment within `~/.gemini/antigravity/brain/<conversation-id>/`.
- Never stores or writes `ANTIGRAVITY_CSRF_TOKEN` to disk.

## License

[MIT](./LICENSE)
