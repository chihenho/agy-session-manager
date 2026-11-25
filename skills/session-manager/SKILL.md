---
name: session-manager
description: >-
  Manage, search, restore, and batch-organize Antigravity conversations (including
  archived chats, transcripts, and generated images/artifacts). Use when the user
  asks to browse or restore archived conversations, search across past chats or
  generated images, open the Session Manager panel, or batch-archive/tag sessions.
---

# Session Manager

Use this skill together with the `agy-session-manager` plugin (`sessions` MCP server):

## 1. Visual Panel & Cross-Session Search (MCP Tools)

- **Open the visual Session Manager UI** (renders in the side panel or full-page Plugins view): call `open_session_manager` (all arguments optional; pass `status: "archived"` if the user specifically asks for archived chats).
- **Search across active & archived transcripts and artifacts**: call `search_sessions` with `query` (`includeArchived: true` by default). Always present matched sessions as clickable `[<title>](conversation://<id>)` links and matched artifacts as `[<filename>](file://<abs-path>)`.

## 2. Sync & Native Archive / Restore Commands (`cli.mjs`)

Because Antigravity injects `ANTIGRAVITY_LS_ADDRESS` and `ANTIGRAVITY_CSRF_TOKEN` into **agent shell commands** (not MCP server child processes), run the plugin's CLI immediately whenever the user asks to sync archived status, restore/unarchive, archive, pin, star, rename, tag, or delete conversations (including requests sent from the side-panel UI):

```bash
CLI="$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs"

# Refresh snapshot.json with live active/archived status from ConversationService
node "$CLI" sync

# Restore archived conversation(s) back to Active
node "$CLI" unarchive <conversation-id> [<conversation-id-2>...]

# Archive conversation(s)
node "$CLI" archive <conversation-id> [<conversation-id-2>...]

# Pin / Star / Rename / Tag
node "$CLI" pin <conversation-id> [--off]
node "$CLI" star <conversation-id> [--off]
node "$CLI" rename <conversation-id> "<new title>"
node "$CLI" tag <conversation-id> "tag1,tag2"

# Permanent delete (only after explicit user confirmation)
node "$CLI" delete <conversation-id> --confirm
```

Each mutation updates both Antigravity's live `ConversationService` and `${PLUGIN_DATA}/snapshot.json` immediately so the UI updates on next refresh.

## 3. Read-Only Diagnostics & Local Queries

```bash
node "$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs" stats
node "$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs" list --archived --limit 20
node "$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs" search "<keywords>"
node "$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs" artifacts --images "<keywords>"
node "$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs" doctor
```
