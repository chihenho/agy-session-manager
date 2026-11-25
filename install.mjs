#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isLiveApiAvailable } from "./src/conversation-api.mjs";
import { SessionService } from "./src/session-service.mjs";

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = join(homedir(), ".gemini", "config", "plugins", "agy-session-manager");

function normalizeLang(value) {
  const v = String(value || "en").trim().toLowerCase();
  if (v === "en") return "en";
  if (v === "zh" || v === "zh-cn" || v === "zh_cn") return "zh";
  throw new Error(`Unsupported --lang value: ${value}. Use "en" or "zh".`);
}

function parseArgs(argv) {
  const opts = {
    lang: "en",
    target: DEFAULT_TARGET,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--lang" && argv[i + 1]) {
      opts.lang = normalizeLang(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--lang=")) {
      opts.lang = normalizeLang(arg.slice("--lang=".length));
    } else if (arg === "--target" && argv[i + 1]) {
      opts.target = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: node install.mjs [--lang <en|zh>] [--target <path>]\n" +
          "  --lang <en|zh>   Plugin metadata language (default: en)\n" +
          "  --target <path>  Override install path (default: ~/.gemini/config/plugins/agy-session-manager)"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const target = opts.target;
  const distHtml = join(REPO_ROOT, "dist", "app.html");
  if (!existsSync(distHtml)) {
    throw new Error("Missing dist/app.html. Run `npm install && npm run build:ui` first.");
  }

  mkdirSync(target, { recursive: true });

  for (const dir of ["src", "dist", "assets", "skills"]) {
    const srcDir = join(REPO_ROOT, dir);
    const dstDir = join(target, dir);
    rmSync(dstDir, { recursive: true, force: true });
    if (existsSync(srcDir)) {
      cpSync(srcDir, dstDir, { recursive: true });
    }
  }

  for (const file of ["README.md", "README.zh-CN.md", "LICENSE", "mcp_config.json", "hooks.json"]) {
    const srcFile = join(REPO_ROOT, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, join(target, file));
    }
  }

  const baseManifest = JSON.parse(readFileSync(join(REPO_ROOT, "plugin.json"), "utf8"));
  const pluginJson =
    opts.lang === "zh"
      ? {
          ...baseManifest,
          displayName: "会话管理器",
          description:
            "Antigravity 可视化会话与归档对话管理插件：同步原生已归档状态、支持全屏与右侧栏交互界面、跨会话全文与生成图片检索、以及一键恢复归档对话。",
          suggestedPrompts: [
            "打开会话管理器查看并恢复已归档对话",
            "在历史会话和生成的图片中搜索关键词",
            "同步并整理近期已归档对话",
          ],
        }
      : baseManifest;

  writeFileSync(
    join(target, "plugin.json"),
    `${JSON.stringify(pluginJson, null, 2)}\n`,
    "utf8"
  );

  let syncLine = "Skipped (run `node src/cli.mjs sync` inside an Antigravity agent shell)";
  if (isLiveApiAvailable()) {
    try {
      const svc = new SessionService();
      const res = await svc.syncSnapshot();
      syncLine = `Synced ${res.total} conversations (${res.active} active, ${res.archived} archived)`;
    } catch (err) {
      syncLine = `Warning: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  console.log("\n=== agy-session-manager installed ===");
  console.log(`Target : ${target}`);
  console.log(`Lang   : ${opts.lang}`);
  console.log(`UI App : ${join(target, "dist", "app.html")}`);
  console.log(`Skill  : ${join(target, "skills", "session-manager", "SKILL.md")}`);
  console.log(`Sync   : ${syncLine}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
