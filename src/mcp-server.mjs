import { existsSync, readFileSync } from "node:fs";
import { getAppHtmlPath } from "./paths.mjs";
import { SessionService } from "./session-service.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "agy-session-manager", version: "0.1.0" };
const APP_URI = "ui://agy-session-manager/app.html";

const ENTRYPOINT_META = {
  ui: { resourceUri: APP_URI },
  "com.google.antigravity/ui": {
    entrypoints: [
      { type: "aux_pane", title: "Session Manager" },
      { type: "global", title: "Session Manager" },
    ],
  },
};

const APP_ONLY_META = {
  ui: { visibility: ["app"] },
};

function getTools() {
  return [
    {
      name: "open_session_manager",
      title: "Session Manager",
      description:
        "Open the interactive Antigravity Session Manager UI to browse, filter, restore, tag, and search active & archived conversations and generated artifacts.",
      _meta: ENTRYPOINT_META,
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "active", "archived", "pinned", "starred"],
            description: "Initial status filter (default: all).",
          },
          query: {
            type: "string",
            description: "Optional initial search query.",
          },
          limit: {
            type: "integer",
            description: "Initial page size (default: 50).",
          },
        },
      },
    },
    {
      name: "search_sessions",
      title: "Search Conversations & Artifacts",
      description:
        "Search across both active and archived Antigravity conversations by title, summary, tags, transcript text, or generated artifact/image filenames.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keywords to search across titles, transcripts, and artifacts.",
          },
          includeArchived: {
            type: "boolean",
            description: "Include archived conversations (default: true).",
          },
          limit: {
            type: "integer",
            description: "Max results to return (default: 15, max: 50).",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "app_list_sessions",
      description: "App-only: list and filter conversations.",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          projectId: { type: "string" },
          tag: { type: "string" },
          query: { type: "string" },
          includeSubagents: { type: "boolean" },
          sort: { type: "string" },
          offset: { type: "integer" },
          limit: { type: "integer" },
          forceRefresh: { type: "boolean" },
        },
      },
    },
    {
      name: "app_get_session_detail",
      description: "App-only: read detailed conversation metadata, prompts, and artifacts.",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
    {
      name: "app_get_artifact_preview",
      description: "App-only: read inline preview for a session artifact or image.",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          relPath: { type: "string" },
        },
        required: ["id", "relPath"],
      },
    },
    {
      name: "app_search_artifacts",
      description: "App-only: list and filter generated artifacts and images across all sessions.",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          kind: { type: "string", enum: ["all", "image", "doc", "other"] },
          includeArchived: { type: "boolean" },
          limit: { type: "integer" },
        },
      },
    },
    {
      name: "app_update_session",
      description: "App-only: update title, archived, pinned, starred, tags, or local note.",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          archived: { type: "boolean" },
          pinned: { type: "boolean" },
          starred: { type: "boolean" },
          tags: { type: "array", items: { type: "string" } },
          conversationGroupId: { type: "string" },
          note: { type: "string" },
        },
        required: ["id"],
      },
    },
    {
      name: "app_batch_update",
      description: "App-only: batch archive, unarchive, or tag multiple conversations.",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          archived: { type: "boolean" },
          pinned: { type: "boolean" },
          starred: { type: "boolean" },
          addTag: { type: "string" },
        },
        required: ["ids"],
      },
    },
    {
      name: "app_delete_session",
      description: "App-only: permanently delete a conversation (requires confirm: true).",
      _meta: APP_ONLY_META,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["id", "confirm"],
      },
    },
  ];
}

function getResources() {
  return [
    {
      uri: APP_URI,
      name: "Session Manager UI",
      description: "Interactive MCP App UI for managing Antigravity sessions and archived conversations.",
      mimeType: "text/html;profile=mcp-app",
      _meta: {
        ui: {
          prefersBorder: false,
        },
      },
    },
  ];
}

function readUiHtml() {
  const htmlPath = getAppHtmlPath();
  if (!existsSync(htmlPath)) {
    throw new Error(`MCP App UI bundle not found at ${htmlPath}. Run "npm run build:ui" first.`);
  }
  const html = readFileSync(htmlPath, "utf8");
  if (!html.trim()) {
    throw new Error(`MCP App UI bundle at ${htmlPath} is empty.`);
  }
  return html;
}

function jsonResult(text, structuredContent) {
  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export function createMcpServer(service = new SessionService()) {
  async function handleToolCall(name, args = {}) {
    try {
      if (name === "open_session_manager") {
        const data = await service.listSessions({
          status: args.status || "all",
          query: args.query || "",
          limit: args.limit || 50,
        });
        const { stats, capabilities } = data;
        const text = [
          `Session Manager ready (${capabilities.liveApi ? "Live API" : "Local Index"} mode).`,
          `Total: ${stats.total} (Active: ${stats.active}, Archived: ${stats.archived}, Pinned: ${stats.pinned}, Starred: ${stats.starred}).`,
          `Showing ${data.items.length} of ${data.total} matching conversations.`,
        ].join(" ");
        return jsonResult(text, data);
      }

      if (name === "search_sessions") {
        const res = await service.searchSessions(args);
        if (res.items.length === 0) {
          return jsonResult(
            `No conversations or artifacts matched "${res.query}".`,
            res
          );
        }
        const lines = res.items.map((s) => {
          const badge = s.archived ? "[Archived]" : "[Active]";
          const arts =
            s.topArtifacts.length > 0
              ? ` | Artifacts: ${s.topArtifacts.map((a) => `[${a.name}](${a.fileUri})`).join(", ")}`
              : "";
          const snip = s.matchSnippet ? `\n  Match: ${s.matchSnippet}` : "";
          return `- ${badge} [${s.title}](${s.conversationUri}) (${s.updateTime || ""})${arts}${snip}`;
        });
        return jsonResult(
          `Found ${res.total} conversation(s) matching "${res.query}":\n${lines.join("\n")}`,
          res
        );
      }

      if (name === "app_list_sessions") {
        const data = await service.listSessions(args);
        return jsonResult(`Loaded ${data.items.length}/${data.total} sessions.`, data);
      }

      if (name === "app_get_session_detail") {
        const detail = await service.getSessionDetail(args.id);
        return jsonResult(`Loaded details for ${detail.title} (${detail.id}).`, detail);
      }

      if (name === "app_get_artifact_preview") {
        const preview = service.getArtifactPreview({
          id: args.id,
          relPath: args.relPath,
        });
        return jsonResult(`Loaded preview for ${preview.name}.`, preview);
      }

      if (name === "app_search_artifacts") {
        const res = await service.searchArtifacts(args);
        return jsonResult(`Found ${res.total} artifact(s).`, res);
      }

      if (name === "app_update_session") {
        const res = await service.updateSession(args.id, args);
        return jsonResult(
          `Updated ${res.updated.title} via ${res.appliedVia}.`,
          res
        );
      }

      if (name === "app_batch_update") {
        const res = await service.batchUpdateSessions(args.ids, args);
        return jsonResult(
          `Batch updated ${res.succeeded}/${res.total} sessions.`,
          res
        );
      }

      if (name === "app_delete_session") {
        const res = await service.deleteSession(args.id, args.confirm);
        return jsonResult(`Deleted conversation ${res.id}.`, res);
      }

      return errorResult(`Unknown tool: ${name}`);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleMessage(msg) {
    if (!msg || typeof msg !== "object") return null;
    const { id, method, params } = msg;
    if (id === undefined || method?.startsWith("notifications/")) {
      return null;
    }

    try {
      if (method === "initialize") {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: SERVER_INFO,
          },
        };
      }

      if (method === "ping") {
        return { jsonrpc: "2.0", id, result: {} };
      }

      if (method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: { tools: getTools() },
        };
      }

      if (method === "tools/call") {
        const result = await handleToolCall(params?.name, params?.arguments);
        return { jsonrpc: "2.0", id, result };
      }

      if (method === "resources/list") {
        return {
          jsonrpc: "2.0",
          id,
          result: { resources: getResources() },
        };
      }

      if (method === "resources/read") {
        const uri = params?.uri;
        if (uri !== APP_URI) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Unknown resource URI: ${uri}` },
          };
        }
        const html = readUiHtml();
        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri: APP_URI,
                mimeType: "text/html;profile=mcp-app",
                text: html,
                _meta: {
                  ui: {
                    prefersBorder: false,
                  },
                },
              },
            ],
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  return { handleMessage };
}

function startStdio() {
  const server = createMcpServer();
  let buffer = Buffer.alloc(0);
  let useContentLength = false;
  let writeChain = Promise.resolve();

  function writeMessage(obj) {
    const json = JSON.stringify(obj);
    if (useContentLength) {
      const body = Buffer.from(json, "utf8");
      process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
      process.stdout.write(body);
    } else {
      process.stdout.write(`${json}\n`);
    }
  }

  function dispatchRaw(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      process.stderr.write(`[agy-session-manager mcp] parse error: ${err}\n`);
      return;
    }

    const work = server.handleMessage(msg);
    writeChain = writeChain.then(async () => {
      const reply = await work;
      if (reply) writeMessage(reply);
    });
  }

  function processBuffer() {
    while (buffer.length > 0) {
      const str = buffer.toString("utf8");
      if (str.startsWith("Content-Length:")) {
        useContentLength = true;
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const header = buffer.subarray(0, headerEnd).toString("utf8");
        const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!lenMatch) {
          buffer = buffer.subarray(headerEnd + 4);
          continue;
        }
        const len = Number(lenMatch[1]);
        const total = headerEnd + 4 + len;
        if (buffer.length < total) return;
        const payload = buffer.subarray(headerEnd + 4, total).toString("utf8");
        buffer = buffer.subarray(total);
        dispatchRaw(payload);
      } else {
        const nl = buffer.indexOf("\n");
        if (nl === -1) return;
        const line = buffer.subarray(0, nl).toString("utf8").trim();
        buffer = buffer.subarray(nl + 1);
        if (line) dispatchRaw(line);
      }
    }
  }

  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([
      buffer,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"),
    ]);
    processBuffer();
  });

  process.stdin.on("error", (err) => {
    process.stderr.write(`[agy-session-manager mcp] stdin error: ${err}\n`);
  });
}

// Only start stdio loop when invoked as entrypoint
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) || process.argv[1]?.endsWith("mcp-server.mjs")) {
  startStdio();
}
