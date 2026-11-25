import {
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  closeSync,
  statSync,
} from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const DOC_EXTS = new Set([".md", ".txt", ".html", ".pdf", ".json", ".csv"]);
const SKIP_DIRS = new Set([
  ".system_generated",
  "browser_sandbox",
  "scratch",
  "node_modules",
  ".git",
]);

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".html": "text/html",
  ".json": "application/json",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
};

const MAX_IMAGE_PREVIEW_BYTES = 700 * 1024;
const MAX_TEXT_PREVIEW_BYTES = 24 * 1024;
const MAX_TRANSCRIPT_SCAN_BYTES = 8 * 1024 * 1024;

// Cache per brainDir -> Map<id, { signature, record }>
const brainCache = new Map();

function getCacheForDir(brainDir) {
  let map = brainCache.get(brainDir);
  if (!map) {
    map = new Map();
    brainCache.set(brainDir, map);
  }
  return map;
}

/**
 * Strip Antigravity XML wrappers (<USER_REQUEST>, <ADDITIONAL_METADATA>, etc.) from prompt text.
 * @param {string} raw
 * @returns {string}
 */
export function cleanPromptText(raw) {
  if (!raw || typeof raw !== "string") return "";
  let text = raw;
  const reqMatch = text.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i);
  if (reqMatch) {
    text = reqMatch[1];
  } else {
    text = text
      .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, "")
      .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, "");
  }
  return text.replace(/\s+/g, " ").trim();
}

function classifyArtifact(name) {
  const ext = extname(name).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (DOC_EXTS.has(ext)) return "doc";
  return "other";
}

function collectArtifacts(sessionDir) {
  const artifacts = [];

  function walk(dir, depth, isUploaded) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === ".DS_Store") continue;
      const fullPath = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (depth === 0 && ent.name === ".user_uploaded") {
          walk(fullPath, depth + 1, true);
          continue;
        }
        if (ent.name.startsWith(".") || SKIP_DIRS.has(ent.name)) continue;
        if (depth < 2) {
          walk(fullPath, depth + 1, isUploaded);
        }
      } else if (ent.isFile()) {
        if (ent.name.startsWith(".") || ent.name.endsWith(".metadata.json")) continue;
        let st;
        try {
          st = statSync(fullPath);
        } catch {
          continue;
        }
        const relPath = relative(sessionDir, fullPath).split(sep).join("/");
        const kind = classifyArtifact(ent.name);
        artifacts.push({
          name: ent.name,
          relPath,
          absPath: fullPath,
          fileUri: pathToFileURL(fullPath).href,
          kind,
          uploaded: isUploaded,
          size: st.size,
          mtimeMs: st.mtimeMs,
          updatedAt: new Date(st.mtimeMs).toISOString(),
        });
      }
    }
  }

  walk(sessionDir, 0, false);
  artifacts.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return artifacts;
}

function parseTranscriptMetadata(transcriptPath) {
  const empty = {
    hasTranscript: false,
    stepCount: 0,
    userMessageCount: 0,
    firstUserPrompt: "",
    createdAt: null,
    updatedAt: null,
    isLikelySubagent: false,
    userPrompts: [],
  };
  if (!existsSync(transcriptPath)) return empty;

  let st;
  try {
    st = statSync(transcriptPath);
  } catch {
    return empty;
  }

  let raw = "";
  try {
    if (st.size <= MAX_TRANSCRIPT_SCAN_BYTES) {
      raw = readFileSync(transcriptPath, "utf8");
    } else {
      // Read head + tail for huge transcripts so UI stays responsive
      const fd = openSync(transcriptPath, "r");
      try {
        const headBuf = Buffer.alloc(512 * 1024);
        const headRead = readSync(fd, headBuf, 0, headBuf.length, 0);
        const tailSize = 512 * 1024;
        const tailBuf = Buffer.alloc(tailSize);
        const tailRead = readSync(
          fd,
          tailBuf,
          0,
          tailBuf.length,
          Math.max(0, st.size - tailSize)
        );
        raw = `${headBuf.subarray(0, headRead).toString("utf8")}\n${tailBuf
          .subarray(0, tailRead)
          .toString("utf8")}`;
      } finally {
        closeSync(fd);
      }
    }
  } catch {
    return empty;
  }

  const lines = raw.split("\n");
  let stepCount = 0;
  let userMessageCount = 0;
  let firstUserPrompt = "";
  let createdAt = null;
  let updatedAt = null;
  let hasExplicitUser = false;
  const userPrompts = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    stepCount += 1;
    if (obj.created_at) {
      if (!createdAt) createdAt = obj.created_at;
      updatedAt = obj.created_at;
    }
    if (obj.type === "USER_INPUT") {
      if (obj.source === "USER_EXPLICIT") {
        hasExplicitUser = true;
      }
      const cleaned = cleanPromptText(String(obj.content ?? ""));
      if (cleaned) {
        userMessageCount += 1;
        if (!firstUserPrompt) {
          firstUserPrompt = cleaned.slice(0, 280);
        }
        if (userPrompts.length < 30) {
          userPrompts.push({
            stepIndex: obj.step_index ?? stepCount,
            createdAt: obj.created_at ?? null,
            text: cleaned.slice(0, 600),
          });
        }
      }
    }
  }

  return {
    hasTranscript: true,
    stepCount,
    userMessageCount,
    firstUserPrompt,
    createdAt,
    updatedAt,
    isLikelySubagent: stepCount > 0 && !hasExplicitUser,
    userPrompts,
  };
}

/**
 * Scan all conversation directories under brainDir.
 * @param {object} opts
 * @param {string} opts.brainDir
 * @param {boolean} [opts.force]
 * @returns {Map<string, object>}
 */
export function scanBrainIndex({ brainDir, force = false }) {
  const cache = getCacheForDir(brainDir);
  if (!existsSync(brainDir)) {
    cache.clear();
    return new Map();
  }

  let entries;
  try {
    entries = readdirSync(brainDir, { withFileTypes: true });
  } catch {
    return new Map();
  }

  const seenIds = new Set();
  for (const ent of entries) {
    if (!ent.isDirectory() || !UUID_RE.test(ent.name)) continue;
    const id = ent.name;
    seenIds.add(id);
    const dirPath = join(brainDir, id);
    const transcriptPath = join(dirPath, ".system_generated", "logs", "transcript.jsonl");

    let dirMtime = 0;
    let trMtime = 0;
    try {
      dirMtime = statSync(dirPath).mtimeMs;
    } catch {
      continue;
    }
    try {
      if (existsSync(transcriptPath)) {
        trMtime = statSync(transcriptPath).mtimeMs;
      }
    } catch {
      trMtime = 0;
    }

    const signature = `${dirMtime}:${trMtime}`;
    const cached = cache.get(id);
    if (!force && cached && cached.signature === signature) {
      continue;
    }

    const meta = parseTranscriptMetadata(transcriptPath);
    const artifacts = collectArtifacts(dirPath);
    const imageCount = artifacts.filter((a) => a.kind === "image").length;
    const docCount = artifacts.filter((a) => a.kind === "doc").length;

    const record = {
      id,
      dirPath,
      transcriptPath,
      hasTranscript: meta.hasTranscript,
      stepCount: meta.stepCount,
      userMessageCount: meta.userMessageCount,
      firstUserPrompt: meta.firstUserPrompt,
      userPrompts: meta.userPrompts,
      createdAt: meta.createdAt || new Date(dirMtime).toISOString(),
      updatedAt:
        meta.updatedAt ||
        new Date(Math.max(dirMtime, trMtime)).toISOString(),
      mtimeMs: Math.max(dirMtime, trMtime),
      isLikelySubagent: meta.isLikelySubagent,
      artifacts,
      imageCount,
      docCount,
      artifactCount: artifacts.length,
    };

    cache.set(id, { signature, record });
  }

  // Prune deleted dirs
  for (const id of cache.keys()) {
    if (!seenIds.has(id)) {
      cache.delete(id);
    }
  }

  const out = new Map();
  for (const [id, entry] of cache.entries()) {
    out.set(id, entry.record);
  }
  return out;
}

/**
 * Search transcript contents across local brain directories.
 * @param {object} opts
 * @param {string} opts.brainDir
 * @param {string} opts.query
 * @param {Set<string>} [opts.candidateIds]
 * @param {number} [opts.limit]
 * @returns {Map<string, { score: number, snippet: string }>}
 */
export function searchTranscripts({ brainDir, query, candidateIds, limit = 30 }) {
  const results = new Map();
  const q = String(query || "").trim().toLowerCase();
  if (!q) return results;

  const terms = q.split(/\s+/).filter(Boolean);
  const index = scanBrainIndex({ brainDir });

  for (const rec of index.values()) {
    if (candidateIds && !candidateIds.has(rec.id)) continue;
    if (!rec.hasTranscript || !existsSync(rec.transcriptPath)) continue;

    let st;
    try {
      st = statSync(rec.transcriptPath);
    } catch {
      continue;
    }
    // Cap full-text grep per file at 8 MiB to keep search snappy
    let raw = "";
    try {
      if (st.size <= MAX_TRANSCRIPT_SCAN_BYTES) {
        raw = readFileSync(rec.transcriptPath, "utf8");
      } else {
        const fd = openSync(rec.transcriptPath, "r");
        try {
          const buf = Buffer.alloc(MAX_TRANSCRIPT_SCAN_BYTES);
          const n = readSync(fd, buf, 0, buf.length, 0);
          raw = buf.subarray(0, n).toString("utf8");
        } finally {
          closeSync(fd);
        }
      }
    } catch {
      continue;
    }

    const lower = raw.toLowerCase();
    let matchedTerms = 0;
    for (const term of terms) {
      if (lower.includes(term)) {
        matchedTerms += 1;
      }
    }
    if (matchedTerms < terms.length) continue;

    // Pick the JSONL line with the highest term coverage (preferring exact phrase match)
    let bestLine = "";
    let bestScore = -1;
    for (const line of raw.split("\n")) {
      const ll = line.toLowerCase();
      let hit = 0;
      for (const term of terms) {
        if (ll.includes(term)) hit += 1;
      }
      if (hit === 0) continue;
      const bonus = ll.includes(q) ? 10 : 0;
      if (hit + bonus > bestScore) {
        bestScore = hit + bonus;
        bestLine = line;
      }
      if (bonus > 0 && hit === terms.length) break;
    }

    let snippet = "";
    if (bestLine) {
      try {
        const obj = JSON.parse(bestLine);
        const txt = cleanPromptText(String(obj.content ?? ""));
        const tl = txt.toLowerCase();
        const pos = tl.indexOf(q) !== -1 ? tl.indexOf(q) : tl.indexOf(terms[0]);
        if (pos !== -1) {
          const s = Math.max(0, pos - 60);
          const e = Math.min(txt.length, pos + 160);
          snippet = (s > 0 ? "..." : "") + txt.slice(s, e) + (e < txt.length ? "..." : "");
        } else {
          snippet = txt.slice(0, 200);
        }
      } catch {
        snippet = bestLine.slice(0, 200).replace(/\s+/g, " ");
      }
    }

    results.set(rec.id, {
      score: matchedTerms / terms.length,
      snippet,
    });

    if (results.size >= limit * 3) break;
  }

  return results;
}

/**
 * Safely read an artifact preview (image as data URL or doc as UTF-8 excerpt).
 * Enforces strict path traversal protection within brainDir/<id>.
 * @param {object} opts
 * @param {string} opts.brainDir
 * @param {string} opts.id
 * @param {string} opts.relPath
 */
export function readArtifactPreview({ brainDir, id, relPath }) {
  if (!UUID_RE.test(String(id || ""))) {
    throw new Error(`Invalid conversation ID: ${id}`);
  }
  const sessionRoot = resolve(brainDir, id);
  const target = resolve(sessionRoot, String(relPath || ""));
  if (target !== sessionRoot && !target.startsWith(`${sessionRoot}${sep}`)) {
    throw new Error("Path traversal rejected.");
  }
  if (!existsSync(target)) {
    throw new Error(`Artifact not found: ${relPath}`);
  }
  const st = statSync(target);
  if (!st.isFile()) {
    throw new Error(`Artifact is not a regular file: ${relPath}`);
  }

  const ext = extname(target).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] || "application/octet-stream";
  const kind = classifyArtifact(target);
  const fileUri = pathToFileURL(target).href;

  if (kind === "image") {
    if (st.size > MAX_IMAGE_PREVIEW_BYTES) {
      return {
        kind: "image",
        name: target.split(sep).pop(),
        relPath,
        fileUri,
        mimeType,
        size: st.size,
        tooLarge: true,
        dataUrl: null,
        text: null,
      };
    }
    const buf = readFileSync(target);
    return {
      kind: "image",
      name: target.split(sep).pop(),
      relPath,
      fileUri,
      mimeType,
      size: st.size,
      tooLarge: false,
      dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
      text: null,
    };
  }

  if (kind === "doc" && ext !== ".pdf") {
    const fd = openSync(target, "r");
    let text = "";
    try {
      const len = Math.min(st.size, MAX_TEXT_PREVIEW_BYTES);
      const buf = Buffer.alloc(len);
      const read = readSync(fd, buf, 0, len, 0);
      text = buf.subarray(0, read).toString("utf8");
    } finally {
      closeSync(fd);
    }
    return {
      kind: "doc",
      name: target.split(sep).pop(),
      relPath,
      fileUri,
      mimeType,
      size: st.size,
      truncated: st.size > MAX_TEXT_PREVIEW_BYTES,
      dataUrl: null,
      text,
    };
  }

  return {
    kind,
    name: target.split(sep).pop(),
    relPath,
    fileUri,
    mimeType,
    size: st.size,
    tooLarge: false,
    dataUrl: null,
    text: null,
  };
}
