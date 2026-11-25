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

## 2. Live Archive / Unarchive / Batch Mutations via `ConversationService`

When the user asks to **archive, unarchive, rename, pin, star, tag, group, or delete** conversations in bulk or from chat, check if `ANTIGRAVITY_LS_ADDRESS` and `ANTIGRAVITY_CSRF_TOKEN` are available in the shell environment and call `http://$ANTIGRAVITY_LS_ADDRESS/product.v1.ConversationService/<Method>`:

- `ListConversations`: `{"pageSize": 100, "includeArchived": true}`
- `UpdateConversation`: `{"conversationId": "<id>", "annotations": {"archived": false, "pinned": true, "tags": ["..."]}}`
- `DeleteConversation`: permanent — always ask for explicit confirmation first unless the user explicitly requested deletion of specific IDs.

## 3. CLI Helpers

From the plugin root (`~/.gemini/config/plugins/agy-session-manager`):

```bash
node src/cli.mjs stats
node src/cli.mjs list --archived --limit 20
node src/cli.mjs search "<keywords>"
node src/cli.mjs artifacts --images "<keywords>"
node src/cli.mjs doctor
```
