import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const SNAPSHOT_FILE = "snapshot.json";

function snapshotPath(dataDir) {
  return join(dataDir, SNAPSHOT_FILE);
}

function sanitizeConversation(conv) {
  if (!conv || typeof conv !== "object" || !conv.id) return null;
  return {
    id: String(conv.id),
    metadata: conv.metadata && typeof conv.metadata === "object" ? conv.metadata : {},
    annotations: conv.annotations && typeof conv.annotations === "object" ? conv.annotations : {},
    state: conv.state && typeof conv.state === "object" ? conv.state : {},
  };
}

/**
 * Load synced ConversationService metadata snapshot from PLUGIN_DATA/snapshot.json.
 * @param {string} dataDir
 * @returns {{ version: number, syncedAt: string | null, conversations: any[] }}
 */
export function loadSnapshot(dataDir) {
  const file = snapshotPath(dataDir);
  if (!existsSync(file)) {
    return { version: 1, syncedAt: null, conversations: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations.map(sanitizeConversation).filter(Boolean)
      : [];
    return {
      version: 1,
      syncedAt: typeof parsed.syncedAt === "string" ? parsed.syncedAt : null,
      conversations,
    };
  } catch {
    return { version: 1, syncedAt: null, conversations: [] };
  }
}

/**
 * Atomically write snapshot.json (never stores tokens or addresses).
 * @param {string} dataDir
 * @param {any[]} conversations
 * @param {string} [syncedAt]
 */
export function saveSnapshot(dataDir, conversations, syncedAt = new Date().toISOString()) {
  const file = snapshotPath(dataDir);
  mkdirSync(dirname(file), { recursive: true });
  const payload = {
    version: 1,
    syncedAt,
    conversations: (Array.isArray(conversations) ? conversations : [])
      .map(sanitizeConversation)
      .filter(Boolean),
  };
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tmp, file);
  return payload;
}

/**
 * Upsert a single updated conversation into snapshot.json.
 * @param {string} dataDir
 * @param {any} conv
 */
export function upsertSnapshotConversation(dataDir, conv) {
  const clean = sanitizeConversation(conv);
  if (!clean) return;
  const snap = loadSnapshot(dataDir);
  const idx = snap.conversations.findIndex((c) => c.id === clean.id);
  if (idx >= 0) {
    snap.conversations[idx] = clean;
  } else {
    snap.conversations.unshift(clean);
  }
  saveSnapshot(dataDir, snap.conversations, new Date().toISOString());
}

/**
 * Remove a deleted conversation from snapshot.json.
 * @param {string} dataDir
 * @param {string} id
 */
export function removeSnapshotConversation(dataDir, id) {
  const snap = loadSnapshot(dataDir);
  const next = snap.conversations.filter((c) => c.id !== id);
  if (next.length !== snap.conversations.length) {
    saveSnapshot(dataDir, next, new Date().toISOString());
  }
}

/**
 * Return age in milliseconds of snapshot.json, or Infinity if missing.
 * @param {string} dataDir
 * @returns {number}
 */
export function getSnapshotAgeMs(dataDir) {
  const file = snapshotPath(dataDir);
  if (!existsSync(file)) return Number.POSITIVE_INFINITY;
  try {
    const st = statSync(file);
    return Math.max(0, Date.now() - st.mtimeMs);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
