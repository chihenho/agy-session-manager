import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionService } from "../src/session-service.mjs";

const ID_1 = "11111111-1111-4111-8111-111111111111";
const ID_2 = "22222222-2222-4222-8222-222222222222";
const ID_SUB = "33333333-3333-4333-8333-333333333333";

function setupFixtureBrain() {
  const root = mkdtempSync(join(tmpdir(), "agy-sm-test-"));
  const brainDir = join(root, "brain");
  const dataDir = join(root, "data");
  mkdirSync(brainDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  // Session 1: root user session with transcript + image + doc
  const s1Dir = join(brainDir, ID_1);
  mkdirSync(join(s1Dir, ".system_generated", "logs"), { recursive: true });
  writeFileSync(
    join(s1Dir, ".system_generated", "logs", "transcript.jsonl"),
    [
      JSON.stringify({
        step_index: 0,
        source: "USER_EXPLICIT",
        type: "USER_INPUT",
        created_at: "2026-11-25T08:00:00Z",
        content: "<USER_REQUEST>\nGenerate 3 cylanco neon icons\n</USER_REQUEST>",
      }),
      JSON.stringify({
        step_index: 1,
        source: "MODEL",
        type: "FINAL_RESPONSE",
        created_at: "2026-11-25T08:05:00Z",
        content: "Created 3 variants including chrome neon.",
      }),
    ].join("\n") + "\n",
    "utf8"
  );
  // Minimal valid 1x1 PNG bytes
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  writeFileSync(join(s1Dir, "cylanco_icon_v3.png"), pngBytes);
  writeFileSync(join(s1Dir, "summary.md"), "# Design Summary\nChrome neon chosen.", "utf8");

  // Session 2: local-only archived/active session
  const s2Dir = join(brainDir, ID_2);
  mkdirSync(join(s2Dir, ".system_generated", "logs"), { recursive: true });
  writeFileSync(
    join(s2Dir, ".system_generated", "logs", "transcript.jsonl"),
    JSON.stringify({
      step_index: 0,
      source: "USER_EXPLICIT",
      type: "USER_INPUT",
      created_at: "2026-11-24T10:00:00Z",
      content: "<USER_REQUEST>\nFix ProShell scrollbar height\n</USER_REQUEST>",
    }) + "\n",
    "utf8"
  );

  // Subagent directory: no USER_EXPLICIT step
  const subDir = join(brainDir, ID_SUB);
  mkdirSync(join(subDir, ".system_generated", "logs"), { recursive: true });
  writeFileSync(
    join(subDir, ".system_generated", "logs", "transcript.jsonl"),
    JSON.stringify({
      step_index: 0,
      source: "AGENT",
      type: "MODEL_RESPONSE",
      created_at: "2026-11-25T08:02:00Z",
      content: "Subagent internal step",
    }) + "\n",
    "utf8"
  );

  return { root, brainDir, dataDir };
}

test("SessionService works in Local Index mode, searches transcripts & rejects path traversal", async () => {
  const { root, brainDir, dataDir } = setupFixtureBrain();
  try {
    const svc = new SessionService({
      brainDir,
      dataDir,
      apiOpts: { address: "", csrfToken: "" },
    });

    const list = await svc.listSessions({ status: "all" });
    assert.equal(list.capabilities.liveApi, false);
    assert.equal(list.capabilities.mode, "local_index");
    // Subagent filtered out by default
    assert.equal(list.total, 2);

    const withSub = await svc.listSessions({ includeSubagents: true });
    assert.equal(withSub.total, 3);

    // Search transcript content
    const searchRes = await svc.searchSessions({ query: "chrome neon" });
    assert.equal(searchRes.total, 1);
    assert.equal(searchRes.items[0].id, ID_1);
    assert.match(searchRes.items[0].matchSnippet, /chrome neon/i);

    // Artifacts gallery
    const artRes = await svc.searchArtifacts({ kind: "image" });
    assert.equal(artRes.total, 1);
    assert.equal(artRes.items[0].name, "cylanco_icon_v3.png");

    // Preview image
    const preview = svc.getArtifactPreview({ id: ID_1, relPath: "cylanco_icon_v3.png" });
    assert.equal(preview.kind, "image");
    assert.ok(preview.dataUrl?.startsWith("data:image/png;base64,"));

    // Preview doc
    const docPrev = svc.getArtifactPreview({ id: ID_1, relPath: "summary.md" });
    assert.equal(docPrev.kind, "doc");
    assert.match(docPrev.text, /Chrome neon chosen/);

    // Path traversal rejection
    assert.throws(
      () => svc.getArtifactPreview({ id: ID_1, relPath: "../../etc/passwd" }),
      /Path traversal rejected/
    );

    // Local note & tags persistence
    const updated = await svc.updateSession(ID_1, {
      note: "Final selected variant C",
      tags: ["design", "cylanco"],
      archived: true,
    });
    assert.equal(updated.appliedVia, "local_store");
    assert.equal(updated.updated.note, "Final selected variant C");
    assert.equal(updated.updated.archived, true);
    assert.deepEqual(updated.updated.tags, ["design", "cylanco"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("SessionService works in Live API mode with mock ConversationService", async () => {
  const { root, brainDir, dataDir } = setupFixtureBrain();
  const store = new Map([
    [
      ID_1,
      {
        id: ID_1,
        metadata: { createTime: "2026-11-25T08:00:00Z", projectId: "proj-1", tags: [] },
        annotations: { title: "Cylanco Icons", archived: true, pinned: false, starred: false, tags: [] },
        state: { summary: "Generated 3 icons", runState: "RUN_STATE_IDLE", updateTime: "2026-11-25T08:10:00Z" },
      },
    ],
    [
      ID_2,
      {
        id: ID_2,
        metadata: { createTime: "2026-11-24T10:00:00Z", projectId: "proj-1", tags: [] },
        annotations: { title: "ProShell Fix", archived: false, pinned: true, starred: false, tags: [] },
        state: { summary: "Scrollbar fix", runState: "RUN_STATE_IDLE", updateTime: "2026-11-24T11:00:00Z" },
      },
    ],
  ]);

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      assert.equal(req.headers["x-antigravity-csrf-token"], "test-csrf");
      const parsed = JSON.parse(body || "{}");
      res.setHeader("Content-Type", "application/json");

      if (req.url?.endsWith("/ListConversations")) {
        const all = [...store.values()];
        // Test pagination (page 1 -> page 2)
        if (!parsed.pageToken) {
          res.end(JSON.stringify({ conversations: [all[0]], nextPageToken: "p2" }));
        } else {
          res.end(JSON.stringify({ conversations: [all[1]], nextPageToken: "" }));
        }
        return;
      }
      if (req.url?.endsWith("/GetConversation")) {
        const c = store.get(parsed.conversationId);
        if (!c) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: "Not found" }));
          return;
        }
        res.end(JSON.stringify({ conversation: c }));
        return;
      }
      if (req.url?.endsWith("/UpdateConversation")) {
        const c = store.get(parsed.conversationId);
        Object.assign(c.annotations, parsed.annotations);
        res.end(JSON.stringify({ conversation: c }));
        return;
      }
      if (req.url?.endsWith("/DeleteConversation")) {
        store.delete(parsed.conversationId);
        res.end(JSON.stringify({}));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const address = `127.0.0.1:${addr.port}`;

  try {
    const svc = new SessionService({
      brainDir,
      dataDir,
      apiOpts: { address, csrfToken: "test-csrf" },
    });

    const list = await svc.listSessions({ status: "archived" });
    assert.equal(list.capabilities.liveApi, true);
    assert.equal(list.stats.total, 2);
    assert.equal(list.stats.archived, 1);
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].title, "Cylanco Icons");
    assert.equal(list.items[0].imageCount, 1);

    // Unarchive + batch tag
    const batch = await svc.batchUpdateSessions([ID_1, ID_2], {
      archived: false,
      addTag: "reviewed",
    });
    assert.equal(batch.succeeded, 2);
    assert.equal(store.get(ID_1).annotations.archived, false);
    assert.deepEqual(store.get(ID_1).annotations.tags, ["reviewed"]);

    // Delete requires confirm: true
    await assert.rejects(() => svc.deleteSession(ID_2, false), /confirm: true/);
    const delRes = await svc.deleteSession(ID_2, true);
    assert.equal(delRes.deleted, true);
    assert.equal(store.has(ID_2), false);
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
