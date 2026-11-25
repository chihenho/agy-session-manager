import { basename } from "node:path";
import {
  deleteConversation,
  getConversation,
  isLiveApiAvailable,
  listAllConversations,
  updateConversation,
} from "./conversation-api.mjs";
import {
  readArtifactPreview,
  scanBrainIndex,
  searchTranscripts,
} from "./brain-scanner.mjs";
import {
  loadLocalStore,
  patchLocalSessionStore,
  removeLocalSessionEntry,
} from "./local-store.mjs";
import { getBrainDir, getDataDir } from "./paths.mjs";
import {
  loadSnapshot,
  removeSnapshotConversation,
  saveSnapshot,
  upsertSnapshotConversation,
} from "./snapshot-store.mjs";

const VERSION = "0.2.0";

function normalizeSession(apiConv, brainRec, localStore) {
  const id = apiConv?.id ?? brainRec?.id;
  const ann = apiConv?.annotations ?? {};
  const meta = apiConv?.metadata ?? {};
  const state = apiConv?.state ?? {};

  const title =
    (ann.title && String(ann.title).trim()) ||
    (state.summary && String(state.summary).trim().slice(0, 90)) ||
    (brainRec?.firstUserPrompt && brainRec.firstUserPrompt.slice(0, 90)) ||
    id;

  const summary =
    (state.summary && String(state.summary).trim()) ||
    brainRec?.firstUserPrompt ||
    "";

  const apiTags = [
    ...(Array.isArray(meta.tags) ? meta.tags : []),
    ...(Array.isArray(ann.tags) ? ann.tags : []),
  ];
  const tags = [...new Set(apiTags.map((t) => String(t).trim()).filter(Boolean))];

  const archived = Boolean(ann.archived);
  const pinned = Boolean(ann.pinned);
  const starred = Boolean(ann.starred);

  const createTime = meta.createTime || brainRec?.createdAt || null;
  const updateTime = state.updateTime || brainRec?.updatedAt || createTime;
  const updateMs = updateTime ? Date.parse(updateTime) || 0 : brainRec?.mtimeMs || 0;

  return {
    id,
    title,
    customTitle: ann.title || "",
    summary,
    archived,
    pinned,
    starred,
    tags,
    conversationGroupId: ann.conversationGroupId || "",
    projectId: meta.projectId || (apiConv ? "outside-of-project" : "local-only"),
    runState: state.runState || "RUN_STATE_IDLE",
    createTime,
    updateTime,
    updateMs,
    note: localStore.notes[id] || "",
    hasLiveRecord: Boolean(apiConv),
    hasBrainRecord: Boolean(brainRec),
    isLikelySubagent: apiConv ? Boolean(meta.parentConversationId) : Boolean(brainRec?.isLikelySubagent),
    stepCount: brainRec?.stepCount ?? 0,
    userMessageCount: brainRec?.userMessageCount ?? 0,
    artifactCount: brainRec?.artifactCount ?? 0,
    imageCount: brainRec?.imageCount ?? 0,
    docCount: brainRec?.docCount ?? 0,
    topArtifacts: (brainRec?.artifacts ?? []).slice(0, 6).map(summarizeArtifact),
    conversationUri: `conversation://${id}`,
  };
}

function summarizeArtifact(a) {
  return {
    name: a.name,
    relPath: a.relPath,
    fileUri: a.fileUri,
    kind: a.kind,
    uploaded: a.uploaded,
    size: a.size,
    updatedAt: a.updatedAt,
  };
}

export class SessionService {
  /**
   * @param {object} [opts]
   * @param {string} [opts.brainDir]
   * @param {string} [opts.dataDir]
   * @param {object} [opts.apiOpts]
   */
  constructor(opts = {}) {
    this.brainDir = getBrainDir(opts.brainDir);
    this.dataDir = getDataDir(opts.dataDir);
    this.apiOpts = opts.apiOpts ?? {};
  }

  getCapabilities() {
    const liveApi = isLiveApiAvailable(this.apiOpts);
    const snap = loadSnapshot(this.dataDir);
    const mode = liveApi
      ? "live_api"
      : snap.conversations.length > 0
        ? "snapshot_sync"
        : "local_index";
    return {
      version: VERSION,
      liveApi,
      mode,
      snapshotSyncedAt: snap.syncedAt,
      snapshotCount: snap.conversations.length,
      brainDir: this.brainDir,
      dataDir: this.dataDir,
    };
  }

  async syncSnapshot() {
    if (!isLiveApiAvailable(this.apiOpts)) {
      throw new Error(
        "sync requires live ConversationService (ANTIGRAVITY_LS_ADDRESS and ANTIGRAVITY_CSRF_TOKEN)."
      );
    }
    const list = await listAllConversations({
      ...this.apiOpts,
      includeArchived: true,
    });
    const saved = saveSnapshot(this.dataDir, list);
    let archived = 0;
    let active = 0;
    for (const c of saved.conversations) {
      if (c.annotations?.archived) archived += 1;
      else active += 1;
    }
    return {
      syncedAt: saved.syncedAt,
      total: saved.conversations.length,
      active,
      archived,
    };
  }

  async _loadMerged({ forceBrain = false } = {}) {
    const liveAvailable = isLiveApiAvailable(this.apiOpts);
    let apiError = null;
    let apiList = [];
    let liveSuccess = false;
    let snapshotSyncedAt = null;

    if (liveAvailable) {
      try {
        apiList = await listAllConversations({
          ...this.apiOpts,
          includeArchived: true,
        });
        const saved = saveSnapshot(this.dataDir, apiList);
        snapshotSyncedAt = saved.syncedAt;
        liveSuccess = true;
      } catch (err) {
        apiError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!liveSuccess) {
      const snap = loadSnapshot(this.dataDir);
      apiList = snap.conversations;
      snapshotSyncedAt = snap.syncedAt;
    }

    const brainMap = scanBrainIndex({ brainDir: this.brainDir, force: forceBrain });
    const localStore = loadLocalStore(this.dataDir);
    const apiById = new Map(apiList.map((c) => [c.id, c]));

    const allIds = new Set([...apiById.keys(), ...brainMap.keys()]);
    const sessions = [];
    for (const id of allIds) {
      sessions.push(
        normalizeSession(apiById.get(id) ?? null, brainMap.get(id) ?? null, localStore)
      );
    }

    const mode = liveSuccess
      ? "live_api"
      : apiList.length > 0
        ? "snapshot_sync"
        : "local_index";

    return {
      sessions,
      brainMap,
      localStore,
      liveApi: liveSuccess,
      mode,
      snapshotSyncedAt,
      apiError,
    };
  }

  async listSessions(params = {}) {
    const {
      status = "all",
      projectId = "",
      tag = "",
      query = "",
      includeSubagents = false,
      sort = "updated_desc",
      offset = 0,
      limit = 50,
      forceRefresh = false,
    } = params;

    const merged = await this._loadMerged({ forceBrain: Boolean(forceRefresh) });
    const baseList = merged.sessions.filter(
      (s) => includeSubagents || !s.isLikelySubagent
    );

    const stats = {
      total: baseList.length,
      active: 0,
      archived: 0,
      pinned: 0,
      starred: 0,
      withArtifacts: 0,
      withImages: 0,
    };
    const projectCounts = new Map();
    const tagCounts = new Map();

    for (const s of baseList) {
      if (s.archived) stats.archived += 1;
      else stats.active += 1;
      if (s.pinned) stats.pinned += 1;
      if (s.starred) stats.starred += 1;
      if (s.artifactCount > 0) stats.withArtifacts += 1;
      if (s.imageCount > 0) stats.withImages += 1;

      projectCounts.set(s.projectId, (projectCounts.get(s.projectId) || 0) + 1);
      for (const t of s.tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    let filtered = baseList;
    if (status === "active") filtered = filtered.filter((s) => !s.archived);
    else if (status === "archived") filtered = filtered.filter((s) => s.archived);
    else if (status === "pinned") filtered = filtered.filter((s) => s.pinned);
    else if (status === "starred") filtered = filtered.filter((s) => s.starred);

    if (projectId) {
      filtered = filtered.filter((s) => s.projectId === projectId);
    }
    if (tag) {
      filtered = filtered.filter((s) => s.tags.includes(tag));
    }

    const q = String(query || "").trim().toLowerCase();
    let transcriptHits = new Map();
    if (q) {
      const candidateIds = new Set(filtered.map((s) => s.id));
      transcriptHits = searchTranscripts({
        brainDir: this.brainDir,
        query: q,
        candidateIds,
        limit: 100,
      });

      filtered = filtered
        .map((s) => {
          const hay = [
            s.id,
            s.title,
            s.summary,
            s.note,
            s.tags.join(" "),
            ...(merged.brainMap.get(s.id)?.artifacts ?? []).map((a) => a.name),
          ]
            .join("\n")
            .toLowerCase();
          const metaMatch = hay.includes(q);
          const trHit = transcriptHits.get(s.id);
          if (!metaMatch && !trHit) return null;
          return {
            ...s,
            matchSnippet: trHit?.snippet || "",
            _matchScore: (metaMatch ? 2 : 0) + (trHit?.score || 0),
          };
        })
        .filter(Boolean);
    }

    filtered.sort((a, b) => {
      if (sort === "updated_asc") return a.updateMs - b.updateMs;
      if (sort === "artifacts_desc") {
        return b.artifactCount - a.artifactCount || b.updateMs - a.updateMs;
      }
      if (q && (b._matchScore ?? 0) !== (a._matchScore ?? 0)) {
        return (b._matchScore ?? 0) - (a._matchScore ?? 0);
      }
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updateMs - a.updateMs;
    });

    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
    const items = filtered
      .slice(safeOffset, safeOffset + safeLimit)
      .map(({ _matchScore, ...rest }) => rest);

    return {
      capabilities: {
        version: VERSION,
        liveApi: merged.liveApi,
        mode: merged.mode,
        snapshotSyncedAt: merged.snapshotSyncedAt,
        apiError: merged.apiError,
        brainDir: this.brainDir,
        dataDir: this.dataDir,
      },
      stats,
      projects: [...projectCounts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count),
      tags: [...tagCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      total: filtered.length,
      offset: safeOffset,
      limit: safeLimit,
      items,
    };
  }

  async getSessionDetail(id) {
    const cleanId = String(id || "").trim();
    if (!cleanId) throw new Error("conversationId is required.");

    const brainMap = scanBrainIndex({ brainDir: this.brainDir });
    const brainRec = brainMap.get(cleanId) ?? null;
    const localStore = loadLocalStore(this.dataDir);

    let apiConv = null;
    let apiError = null;
    if (isLiveApiAvailable(this.apiOpts)) {
      try {
        apiConv = await getConversation(cleanId, this.apiOpts);
        upsertSnapshotConversation(this.dataDir, apiConv);
      } catch (err) {
        apiError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!apiConv) {
      const snap = loadSnapshot(this.dataDir);
      apiConv = snap.conversations.find((c) => c.id === cleanId) ?? null;
    }

    if (!apiConv && !brainRec) {
      throw new Error(`Session not found: ${cleanId}`);
    }

    const base = normalizeSession(apiConv, brainRec, localStore);
    return {
      ...base,
      liveApi: isLiveApiAvailable(this.apiOpts) && !apiError,
      apiError,
      brainPath: brainRec?.dirPath || null,
      userPrompts: brainRec?.userPrompts ?? [],
      artifacts: (brainRec?.artifacts ?? []).map(summarizeArtifact),
    };
  }

  async searchSessions({ query, includeArchived = true, limit = 20 }) {
    const q = String(query || "").trim();
    if (!q) throw new Error("query is required.");

    const status = includeArchived ? "all" : "active";
    const res = await this.listSessions({
      status,
      query: q,
      limit: Math.min(Math.max(1, Number(limit) || 20), 50),
    });
    return {
      query: q,
      capabilities: res.capabilities,
      total: res.total,
      items: res.items,
    };
  }

  async searchArtifacts({ query = "", kind = "all", includeArchived = true, limit = 80 }) {
    const merged = await this._loadMerged();
    const q = String(query || "").trim().toLowerCase();
    const maxItems = Math.min(Math.max(1, Number(limit) || 80), 300);

    const results = [];
    for (const s of merged.sessions) {
      if (s.isLikelySubagent) continue;
      if (!includeArchived && s.archived) continue;
      const rec = merged.brainMap.get(s.id);
      if (!rec || rec.artifacts.length === 0) continue;

      for (const art of rec.artifacts) {
        if (kind !== "all" && art.kind !== kind) continue;
        if (q) {
          const hay = `${art.name} ${art.relPath} ${s.title} ${s.summary}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        results.push({
          ...summarizeArtifact(art),
          sessionId: s.id,
          sessionTitle: s.title,
          sessionArchived: s.archived,
          sessionProjectId: s.projectId,
          conversationUri: s.conversationUri,
        });
      }
    }

    results.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return {
      total: results.length,
      items: results.slice(0, maxItems),
    };
  }

  getArtifactPreview({ id, relPath }) {
    return readArtifactPreview({
      brainDir: this.brainDir,
      id,
      relPath,
    });
  }

  async updateSession(id, patch = {}) {
    const cleanId = String(id || "").trim();
    if (!cleanId) throw new Error("conversationId is required.");

    const live = isLiveApiAvailable(this.apiOpts);
    const annotations = {};
    if (typeof patch.title === "string") annotations.title = patch.title;
    if (typeof patch.archived === "boolean") annotations.archived = patch.archived;
    if (typeof patch.pinned === "boolean") annotations.pinned = patch.pinned;
    if (typeof patch.starred === "boolean") annotations.starred = patch.starred;
    if (Array.isArray(patch.tags)) {
      annotations.tags = patch.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof patch.conversationGroupId === "string") {
      annotations.conversationGroupId = patch.conversationGroupId;
    }

    const hasNativeFields = Object.keys(annotations).length > 0;
    let apiUpdated = null;
    let apiError = null;
    if (live && hasNativeFields) {
      try {
        apiUpdated = await updateConversation(cleanId, annotations, this.apiOpts);
        upsertSnapshotConversation(this.dataDir, apiUpdated);
      } catch (err) {
        apiError = err instanceof Error ? err.message : String(err);
      }
    }

    if (typeof patch.note === "string") {
      patchLocalSessionStore(this.dataDir, cleanId, { note: patch.note });
    }

    const requiresChatBridge = hasNativeFields && !apiUpdated;
    if (requiresChatBridge && !apiError) {
      apiError = "Native status changes require Live ConversationService (run via chat or CLI).";
    }

    const detail = await this.getSessionDetail(cleanId);
    return {
      updated: detail,
      appliedVia: apiUpdated ? "live_api" : typeof patch.note === "string" && !hasNativeFields ? "local_store" : "note_only",
      requiresChatBridge,
      apiError,
    };
  }

  async batchUpdateSessions(ids, patch = {}) {
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x).trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new Error("ids must be a non-empty array.");
    }

    const concurrency = 4;
    const results = new Array(uniqueIds.length);
    let cursor = 0;

    async function worker(svc) {
      while (cursor < uniqueIds.length) {
        const idx = cursor;
        cursor += 1;
        const id = uniqueIds[idx];
        try {
          let effectivePatch = { ...patch };
          if (typeof patch.addTag === "string" && patch.addTag.trim()) {
            const detail = await svc.getSessionDetail(id);
            const nextTags = [...new Set([...detail.tags, patch.addTag.trim()])];
            effectivePatch = { ...effectivePatch, tags: nextTags };
            delete effectivePatch.addTag;
          }
          const res = await svc.updateSession(id, effectivePatch);
          results[idx] = {
            id,
            ok: !res.requiresChatBridge,
            appliedVia: res.appliedVia,
            requiresChatBridge: res.requiresChatBridge,
            apiError: res.apiError,
          };
        } catch (err) {
          results[idx] = {
            id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, uniqueIds.length) }, () => worker(this))
    );

    const succeeded = results.filter((r) => r.ok).length;
    return {
      total: uniqueIds.length,
      succeeded,
      failed: uniqueIds.length - succeeded,
      results,
    };
  }

  async deleteSession(id, confirm) {
    const cleanId = String(id || "").trim();
    if (!cleanId) throw new Error("conversationId is required.");
    if (confirm !== true) {
      throw new Error("Deletion requires confirm: true.");
    }
    if (!isLiveApiAvailable(this.apiOpts)) {
      throw new Error(
        "Permanent deletion requires live ConversationService access. Ask the agent in chat to delete this conversation."
      );
    }
    await deleteConversation(cleanId, this.apiOpts);
    removeLocalSessionEntry(this.dataDir, cleanId);
    removeSnapshotConversation(this.dataDir, cleanId);
    return { deleted: true, id: cleanId };
  }
}

export function formatShortProject(projectId) {
  if (!projectId || projectId === "outside-of-project") return "General";
  if (projectId === "local-only") return "Local";
  return basename(projectId).slice(0, 8);
}
