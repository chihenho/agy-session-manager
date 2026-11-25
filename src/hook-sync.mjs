import { spawn } from "node:child_process";
import { join } from "node:path";
import { getDataDir, getPluginRoot } from "./paths.mjs";
import { getSnapshotAgeMs } from "./snapshot-store.mjs";

const COOLDOWN_MS = 120_000;

function main() {
  const addr = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrf = process.env.ANTIGRAVITY_CSRF_TOKEN;

  if (addr && csrf) {
    const ageMs = getSnapshotAgeMs(getDataDir());
    if (ageMs > COOLDOWN_MS) {
      try {
        const cliPath = join(getPluginRoot(), "src", "cli.mjs");
        const child = spawn(process.execPath, [cliPath, "sync"], {
          detached: true,
          stdio: "ignore",
          env: process.env,
        });
        child.unref();
      } catch {
        // Never fail hook execution
      }
    }
  }

  process.stdout.write("{}\n");
}

main();
