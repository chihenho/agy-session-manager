import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "..");
const ID_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("MCP server over stdio supports initialize, resources/read, and tools/call", async () => {
  const root = mkdtempSync(join(tmpdir(), "agy-sm-mcp-"));
  const brainDir = join(root, "brain");
  const dataDir = join(root, "data");
  const s1 = join(brainDir, ID_1);
  mkdirSync(join(s1, ".system_generated", "logs"), { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(s1, ".system_generated", "logs", "transcript.jsonl"),
    JSON.stringify({
      step_index: 0,
      source: "USER_EXPLICIT",
      type: "USER_INPUT",
      created_at: "2026-11-25T09:00:00Z",
      content: "<USER_REQUEST>\nVerify MCP protocol\n</USER_REQUEST>",
    }) + "\n",
    "utf8"
  );
  writeFileSync(join(s1, "notes.md"), "# Notes\nHello MCP Apps", "utf8");

  const proc = spawn("node", [join(REPO_ROOT, "src", "mcp-server.mjs")], {
    env: {
      ...process.env,
      PLUGIN_ROOT: REPO_ROOT,
      PLUGIN_DATA: dataDir,
      AGY_BRAIN_DIR: brainDir,
      ANTIGRAVITY_LS_ADDRESS: "",
      ANTIGRAVITY_CSRF_TOKEN: "",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuf = "";
  const pending = new Map();

  proc.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString("utf8");
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      const resolver = pending.get(msg.id);
      if (resolver) {
        pending.delete(msg.id);
        resolver(msg);
      }
    }
  });

  function rpc(id, method, params = {}) {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error(`Timeout waiting for ${method}`)), 5000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        res(msg);
      });
      proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  try {
    const init = await rpc(1, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    assert.ok(init.result.capabilities.tools);
    assert.ok(init.result.capabilities.resources);

    const toolsRes = await rpc(2, "tools/list");
    const tools = toolsRes.result.tools;
    const openTool = tools.find((x) => x.name === "open_session_manager");
    assert.ok(openTool);
    assert.equal(openTool._meta.ui.resourceUri, "ui://agy-session-manager/app.html");
    assert.deepEqual(
      openTool._meta["com.google.antigravity/ui"].entrypoints.map((e) => e.type),
      ["aux_pane", "global"]
    );
    const appTool = tools.find((x) => x.name === "app_list_sessions");
    assert.deepEqual(appTool._meta.ui.visibility, ["app"]);

    const resList = await rpc(3, "resources/list");
    assert.equal(resList.result.resources[0].uri, "ui://agy-session-manager/app.html");

    const resRead = await rpc(4, "resources/read", { uri: "ui://agy-session-manager/app.html" });
    assert.equal(resRead.result.contents[0].mimeType, "text/html;profile=mcp-app");
    assert.match(resRead.result.contents[0].text, /<!doctype html>/i);

    const callOpen = await rpc(5, "tools/call", {
      name: "open_session_manager",
      arguments: {},
    });
    assert.equal(callOpen.result.structuredContent.total, 1);

    const callSearch = await rpc(6, "tools/call", {
      name: "search_sessions",
      arguments: { query: "Verify MCP" },
    });
    assert.equal(callSearch.result.structuredContent.total, 1);

    const callDetail = await rpc(7, "tools/call", {
      name: "app_get_session_detail",
      arguments: { id: ID_1 },
    });
    assert.equal(callDetail.result.structuredContent.artifacts[0].name, "notes.md");

    const callUpdate = await rpc(8, "tools/call", {
      name: "app_update_session",
      arguments: { id: ID_1, note: "Saved via MCP" },
    });
    assert.equal(callUpdate.result.structuredContent.updated.note, "Saved via MCP");
  } finally {
    proc.kill();
    rmSync(root, { recursive: true, force: true });
  }
});
