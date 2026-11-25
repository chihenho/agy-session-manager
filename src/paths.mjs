import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "..");

/**
 * Resolve plugin root directory.
 * @returns {string}
 */
export function getPluginRoot() {
  if (process.env.PLUGIN_ROOT) {
    return resolve(process.env.PLUGIN_ROOT);
  }
  return REPO_ROOT;
}

/**
 * Resolve persistent plugin data directory shared across MCP server, CLI, and hooks.
 * @param {string} [overrideDir]
 * @returns {string}
 */
export function getDataDir(overrideDir) {
  if (overrideDir) return resolve(overrideDir);
  if (process.env.PLUGIN_DATA) return resolve(process.env.PLUGIN_DATA);
  return join(homedir(), ".gemini", "antigravity", "plugin_data", "agy-session-manager");
}

/**
 * Resolve Antigravity brain directory storing local conversation transcripts & artifacts.
 * @param {string} [overrideDir]
 * @returns {string}
 */
export function getBrainDir(overrideDir) {
  if (overrideDir) return resolve(overrideDir);
  if (process.env.AGY_BRAIN_DIR) return resolve(process.env.AGY_BRAIN_DIR);
  return join(homedir(), ".gemini", "antigravity", "brain");
}

/**
 * Resolve bundled single-file MCP App HTML path.
 * @param {string} [overridePath]
 * @returns {string}
 */
export function getAppHtmlPath(overridePath) {
  if (overridePath) return resolve(overridePath);
  if (process.env.AGY_SESSION_MANAGER_HTML) {
    return resolve(process.env.AGY_SESSION_MANAGER_HTML);
  }
  return join(getPluginRoot(), "dist", "app.html");
}
