#!/usr/bin/env node

import { existsSync, mkdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { isLiveApiAvailable } from "./conversation-api.mjs";
import { getAppHtmlPath, getBrainDir, getDataDir, getPluginRoot } from "./paths.mjs";
import { SessionService } from "./session-service.mjs";

function printHelp() {
  console.log(`agy-session-manager CLI

Usage:
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

  const svc = new SessionService();
  const liveCreds = isLiveApiAvailable();
  let liveDetail = "Not set in current shell (MCP process inherits host env if supported)";
  let liveOk = true;
  if (liveCreds) {
    try {
      const res = await svc.listSessions({ limit: 1 });
      liveDetail = res.capabilities.liveApi
        ? `Connected (${res.stats.total} conversations: ${res.stats.active} active, ${res.stats.archived} archived)`
        : `Error: ${res.capabilities.apiError}`;
      liveOk = res.capabilities.liveApi;
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

  if (cmd === "stats") {
    const res = await svc.listSessions({ limit: 1 });
    if (flags.json) {
      console.log(JSON.stringify({ capabilities: res.capabilities, stats: res.stats, projects: res.projects, tags: res.tags }, null, 2));
      return;
    }
    console.log(`Mode: ${res.capabilities.liveApi ? "Live API" : "Local Index"}`);
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
