#!/usr/bin/env node

import { existsSync, mkdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { isLiveApiAvailable } from "./conversation-api.mjs";
import { getAppHtmlPath, getBrainDir, getDataDir, getPluginRoot } from "./paths.mjs";
import { SessionService } from "./session-service.mjs";
import { loadSnapshot } from "./snapshot-store.mjs";

function printHelp() {
  console.log(`agy-session-manager CLI

Usage:
  node src/cli.mjs sync [--json]
  node src/cli.mjs unarchive <id...> [--json]
  node src/cli.mjs archive <id...> [--json]
  node src/cli.mjs pin <id> [--off] [--json]
  node src/cli.mjs star <id> [--off] [--json]
  node src/cli.mjs rename <id> <title...>
  node src/cli.mjs tag <id> <tag1,tag2>
  node src/cli.mjs delete <id> --confirm
  node src/cli.mjs list [--archived|--active|--all] [--limit N] [--json]
  node src/cli.mjs search <query> [--limit N] [--json]
  node src/cli.mjs artifacts [--images|--docs] [query] [--limit N] [--json]
  node src/cli.mjs stats [--json]
  node src/cli.mjs doctor
`);
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--archived") flags.status = "archived";
    else if (a === "--active") flags.status = "active";
    else if (a === "--all") flags.status = "all";
    else if (a === "--images") flags.kind = "image";
    else if (a === "--docs") flags.kind = "doc";
    else if (a === "--json") flags.json = true;
    else if (a === "--off") flags.off = true;
    else if (a === "--confirm") flags.confirm = true;
    else if (a === "--limit" && args[i + 1]) {
      flags.limit = Number(args[i + 1]);
      i += 1;
    } else if (a.startsWith("--limit=")) {
      flags.limit = Number(a.slice("--limit=".length));
    } else if (a === "-h" || a === "--help") {
      flags.help = true;
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

async function runDoctor() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const pluginRoot = getPluginRoot();
  const dataDir = getDataDir();
  const brainDir = getBrainDir();
  const htmlPath = getAppHtmlPath();

  const checks = [];
  checks.push({
    name: "Node.js >= 18",
    ok: nodeMajor >= 18,
    detail: `v${process.versions.node}`,
  });

  let htmlOk = false;
  let htmlDetail = "Missing dist/app.html";
  if (existsSync(htmlPath)) {
    const sz = statSync(htmlPath).size;
    htmlOk = sz > 0 && sz < 10 * 1024 * 1024;
    htmlDetail = `${htmlPath} (${(sz / 1024).toFixed(1)} KiB)`;
  }
  checks.push({ name: "MCP App HTML bundle (< 10 MiB)", ok: htmlOk, detail: htmlDetail });

  const brainExists = existsSync(brainDir);
  checks.push({
    name: "Brain directory readable",
    ok: brainExists,
    detail: brainExists ? brainDir : `Not found: ${brainDir}`,
  });

  let dataWritable = false;
  let dataDetail = dataDir;
  try {
    mkdirSync(dataDir, { recursive: true });
    const probe = join(dataDir, `.doctor-${process.pid}.tmp`);
    writeFileSync(probe, "ok", "utf8");
    unlinkSync(probe);
    dataWritable = true;
  } catch (err) {
    dataDetail = err instanceof Error ? err.message : String(err);
  }
  checks.push({ name: "Data directory writable", ok: dataWritable, detail: dataDetail });

  const snap = loadSnapshot(dataDir);
  const snapArchived = snap.conversations.filter((c) => c.annotations?.archived).length;
  const snapDetail = snap.syncedAt
    ? `${snap.conversations.length} conversations (${snapArchived} archived), syncedAt=${snap.syncedAt}`
    : "Not synced yet (run `node src/cli.mjs sync`)";
  checks.push({ name: "Snapshot store", ok: true, detail: snapDetail });

  const svc = new SessionService();
  const liveCreds = isLiveApiAvailable();
  let liveDetail = "Not set in current shell (UI reads synced snapshot.json)";
  let liveOk = true;
  if (liveCreds) {
    try {
      const res = await svc.syncSnapshot();
      liveDetail = `Connected & synced (${res.total} conversations: ${res.active} active, ${res.archived} archived)`;
      liveOk = true;
    } catch (err) {
      liveDetail = err instanceof Error ? err.message : String(err);
      liveOk = false;
    }
  }
  checks.push({ name: "ConversationService RPC", ok: liveOk, detail: liveDetail });

  console.log(`\nagy-session-manager doctor (root: ${pluginRoot})`);
  for (const c of checks) {
    console.log(`  [${c.ok ? "OK" : "FAIL"}] ${c.name}: ${c.detail}`);
  }
  const allOk = checks.every((c) => c.ok);
  if (!allOk) process.exitCode = 1;
}

async function main() {
  const [cmd = "help", ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (cmd === "help" || flags.help) {
    printHelp();
    return;
  }

  if (cmd === "doctor") {
    await runDoctor();
    return;
  }

  const svc = new SessionService();

  if (cmd === "sync") {
    const res = await svc.syncSnapshot();
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`Synced ${res.total} conversations (${res.active} active, ${res.archived} archived) at ${res.syncedAt}`);
    }
    return;
  }

  if (cmd === "unarchive" || cmd === "archive") {
    const ids = flags._;
    if (ids.length === 0) {
      console.error(`Error: ${cmd} requires at least one conversation ID.`);
      process.exit(1);
    }
    const archived = cmd === "archive";
    const res = await svc.batchUpdateSessions(ids, { archived });
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`${archived ? "Archived" : "Restored"} ${res.succeeded}/${res.total} conversation(s).`);
      if (res.failed > 0) {
        for (const r of res.results.filter((x) => !x.ok)) {
          console.error(`  FAIL ${r.id}: ${r.apiError || r.error}`);
        }
        process.exitCode = 1;
      }
    }
    return;
  }

  if (cmd === "pin" || cmd === "star") {
    const id = flags._[0];
    if (!id) {
      console.error(`Error: ${cmd} requires a conversation ID.`);
      process.exit(1);
    }
    const val = !flags.off;
    const patch = cmd === "pin" ? { pinned: val } : { starred: val };
    const res = await svc.updateSession(id, patch);
    if (res.requiresChatBridge) {
      console.error(`Error: ${res.apiError}`);
      process.exit(1);
    }
    console.log(flags.json ? JSON.stringify(res, null, 2) : `Updated ${res.updated.title}: ${cmd}=${val}`);
    return;
  }

  if (cmd === "rename") {
    const [id, ...titleParts] = flags._;
    const title = titleParts.join(" ").trim();
    if (!id || !title) {
      console.error("Error: rename requires <id> <title>.");
      process.exit(1);
    }
    const res = await svc.updateSession(id, { title });
    if (res.requiresChatBridge) {
      console.error(`Error: ${res.apiError}`);
      process.exit(1);
    }
    console.log(flags.json ? JSON.stringify(res, null, 2) : `Renamed ${id} -> ${res.updated.title}`);
    return;
  }

  if (cmd === "tag") {
    const [id, rawTags = ""] = flags._;
    if (!id) {
      console.error("Error: tag requires <id> <tag1,tag2>.");
      process.exit(1);
    }
    const tags = rawTags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await svc.updateSession(id, { tags });
    if (res.requiresChatBridge) {
      console.error(`Error: ${res.apiError}`);
      process.exit(1);
    }
    console.log(flags.json ? JSON.stringify(res, null, 2) : `Tagged ${id}: [${res.updated.tags.join(", ")}]`);
    return;
  }

  if (cmd === "delete") {
    const id = flags._[0];
    if (!id || !flags.confirm) {
      console.error("Error: delete requires <id> --confirm.");
      process.exit(1);
    }
    const res = await svc.deleteSession(id, true);
    console.log(flags.json ? JSON.stringify(res, null, 2) : `Deleted ${res.id}`);
    return;
  }

  if (cmd === "stats") {
    const res = await svc.listSessions({ limit: 1 });
    if (flags.json) {
      console.log(JSON.stringify({ capabilities: res.capabilities, stats: res.stats, projects: res.projects, tags: res.tags }, null, 2));
      return;
    }
    console.log(`Mode: ${res.capabilities.mode} (syncedAt: ${res.capabilities.snapshotSyncedAt || "never"})`);
    console.log(`Total: ${res.stats.total} | Active: ${res.stats.active} | Archived: ${res.stats.archived} | Pinned: ${res.stats.pinned} | Starred: ${res.stats.starred}`);
    console.log(`With Artifacts: ${res.stats.withArtifacts} | With Images: ${res.stats.withImages}`);
    return;
  }

  if (cmd === "list") {
    const res = await svc.listSessions({
      status: flags.status || "all",
      limit: flags.limit || 25,
    });
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }
    for (const s of res.items) {
      const mark = s.archived ? "[ARCHIVED]" : "[ACTIVE]  ";
      console.log(`${mark} ${s.id.slice(0, 8)}  ${s.updateTime?.slice(0, 16) || ""}  ${s.title}`);
    }
    console.log(`\nShowing ${res.items.length}/${res.total} (mode: ${res.capabilities.mode}).`);
    return;
  }

  if (cmd === "search") {
    const query = flags._.join(" ").trim();
    if (!query) {
      console.error("Error: search requires a query string.");
      process.exit(1);
    }
    const res = await svc.searchSessions({ query, limit: flags.limit || 20 });
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }
    for (const s of res.items) {
      console.log(`${s.archived ? "[ARCHIVED]" : "[ACTIVE]  "} ${s.id}  ${s.title}`);
      if (s.matchSnippet) console.log(`  -> ${s.matchSnippet}`);
    }
    console.log(`\nMatched ${res.total} session(s).`);
    return;
  }

  if (cmd === "artifacts") {
    const query = flags._.join(" ").trim();
    const res = await svc.searchArtifacts({
      query,
      kind: flags.kind || "all",
      limit: flags.limit || 40,
    });
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }
    for (const a of res.items) {
      console.log(`[${a.kind}] ${a.name} (${(a.size / 1024).toFixed(1)} KiB) <- ${a.sessionTitle} (${a.sessionId.slice(0, 8)})`);
    }
    console.log(`\nShowing ${res.items.length}/${res.total} artifact(s).`);
    return;
  }

  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
