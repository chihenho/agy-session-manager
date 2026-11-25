import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const EMPTY_STORE = {
  version: 1,
  notes: {},
  localTags: {},
  localArchived: {},
  localPinned: {},
  localStarred: {},
  localTitles: {},
};

function storeFilePath(dataDir) {
  return join(dataDir, "store.json");
}

/**
 * Load persistent local store from PLUGIN_DATA/store.json.
 * @param {string} dataDir
 */
export function loadLocalStore(dataDir) {
  const filePath = storeFilePath(dataDir);
  if (!existsSync(filePath)) {
    return structuredClone(EMPTY_STORE);
  }
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      notes: isPlainObj(parsed.notes) ? parsed.notes : {},
      localTags: isPlainObj(parsed.localTags) ? parsed.localTags : {},
      localArchived: isPlainObj(parsed.localArchived) ? parsed.localArchived : {},
      localPinned: isPlainObj(parsed.localPinned) ? parsed.localPinned : {},
      localStarred: isPlainObj(parsed.localStarred) ? parsed.localStarred : {},
      localTitles: isPlainObj(parsed.localTitles) ? parsed.localTitles : {},
    };
  } catch {
    return structuredClone(EMPTY_STORE);
  }
}

/**
 * Atomically persist store.json to disk.
 * @param {string} dataDir
 * @param {object} store
 */
export function saveLocalStore(dataDir, store) {
  const filePath = storeFilePath(dataDir);
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  renameSync(tmpPath, filePath);
}

/**
 * Update a single session's local enrichments / fallback state.
 * @param {string} dataDir
 * @param {string} id
 * @param {object} patch
 */
export function patchLocalSessionStore(dataDir, id, patch) {
  const store = loadLocalStore(dataDir);

  if (typeof patch.note === "string") {
    const trimmed = patch.note.trim();
    if (trimmed) {
      store.notes[id] = patch.note;
    } else {
      delete store.notes[id];
    }
  }
  if (typeof patch.localTitle === "string") {
    const trimmed = patch.localTitle.trim();
    if (trimmed) {
      store.localTitles[id] = trimmed;
    } else {
      delete store.localTitles[id];
    }
  }
  if (Array.isArray(patch.localTags)) {
    const clean = [...new Set(patch.localTags.map((t) => String(t).trim()).filter(Boolean))];
    if (clean.length > 0) {
      store.localTags[id] = clean;
    } else {
      delete store.localTags[id];
    }
  }
  if (typeof patch.localArchived === "boolean") {
    store.localArchived[id] = patch.localArchived;
  }
  if (typeof patch.localPinned === "boolean") {
    store.localPinned[id] = patch.localPinned;
  }
  if (typeof patch.localStarred === "boolean") {
    store.localStarred[id] = patch.localStarred;
  }

  saveLocalStore(dataDir, store);
  return store;
}

/**
 * Remove local metadata for a deleted session.
 * @param {string} dataDir
 * @param {string} id
 */
export function removeLocalSessionEntry(dataDir, id) {
  const store = loadLocalStore(dataDir);
  delete store.notes[id];
  delete store.localTags[id];
  delete store.localArchived[id];
  delete store.localPinned[id];
  delete store.localStarred[id];
  delete store.localTitles[id];
  saveLocalStore(dataDir, store);
}

function isPlainObj(val) {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}
