import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  type StandardSchemaV1,
} from "@modelcontextprotocol/ext-apps";

type Lang = "zh" | "en";

interface ArtifactItem {
  name: string;
  relPath: string;
  fileUri: string;
  kind: "image" | "doc" | "other";
  uploaded: boolean;
  size: number;
  updatedAt: string;
  sessionId?: string;
  sessionTitle?: string;
  sessionArchived?: boolean;
}

interface SessionItem {
  id: string;
  title: string;
  customTitle: string;
  summary: string;
  archived: boolean;
  pinned: boolean;
  starred: boolean;
  tags: string[];
  projectId: string;
  runState: string;
  createTime: string | null;
  updateTime: string | null;
  note: string;
  stepCount: number;
  userMessageCount: number;
  artifactCount: number;
  imageCount: number;
  docCount: number;
  topArtifacts: ArtifactItem[];
  conversationUri: string;
  matchSnippet?: string;
}

interface SessionDetail extends SessionItem {
  brainPath: string | null;
  userPrompts: { stepIndex: number; createdAt: string | null; text: string }[];
  artifacts: ArtifactItem[];
}

interface ListPayload {
  capabilities: {
    version: string;
    liveApi: boolean;
    mode: "live_api" | "snapshot_sync" | "local_index";
    snapshotSyncedAt?: string | null;
    apiError?: string | null;
  };
  stats: {
    total: number;
    active: number;
    archived: number;
    pinned: number;
    starred: number;
    withArtifacts: number;
    withImages: number;
  };
  projects: { id: string; count: number }[];
  tags: { name: string; count: number }[];
  total: number;
  items: SessionItem[];
}

const CLI_PATH = "~/.gemini/config/plugins/agy-session-manager/src/cli.mjs";

const I18N = {
  zh: {
    brand: "会话管理器",
    liveMode: "实时同步",
    snapshotMode: "已同步",
    localMode: "未同步归档",
    syncBtn: "同步归档状态",
    tabSessions: "会话",
    tabArtifacts: "产物与图片",
    refresh: "刷新",
    searchPlaceholder: "搜索标题、聊天记录、标签或产物文件名...",
    searchArtifactsPlaceholder: "搜索图片或文档名、所属会话...",
    allProjects: "全部项目",
    allTags: "全部标签",
    includeSubagents: "含子代理",
    all: "全部",
    active: "活跃",
    archived: "已归档",
    pinned: "置顶",
    starred: "星标",
    artAll: "全部产物",
    artImages: "仅图片",
    artDocs: "仅文档",
    selectedCount: "已选 {n} 项",
    archive: "归档",
    unarchive: "恢复到活跃",
    pin: "置顶",
    unpin: "取消置顶",
    star: "星标",
    unstar: "取消星标",
    addTag: "加标签",
    clearSel: "取消选择",
    backToList: "← 返回列表",
    selectSessionHint: "从左侧选择一条会话查看记录摘要、标签备注与生成的图片/文档产物。",
    noSessions: "没有匹配的会话",
    noArtifacts: "没有匹配的产物或图片",
    loading: "加载中...",
    rename: "重命名",
    save: "保存",
    cancel: "取消",
    noteLabel: "个人备注（本地持久化）",
    notePlaceholder: "记录该会话的结论、分支或待办...",
    tagsLabel: "标签",
    addTagPlaceholder: "输入新标签回车",
    copyLink: "复制会话链接",
    copied: "已复制",
    attachContext: "挂为当前对话上下文",
    openInChat: "在聊天中引用打开",
    deleteBtn: "删除会话",
    confirmDelete: "确认永久删除",
    promptsLabel: "用户提问记录",
    artifactsLabel: "生成产物与图片",
    openFile: "在侧栏打开",
    preview: "预览",
    close: "关闭",
    tooLarge: "图片超过 700 KiB，请直接点击「在侧栏打开」或复制路径查看。",
    updatedOk: "已更新",
    batchDone: "批量处理完成：{ok}/{total}",
    contextAttached: "已将该会话摘要挂到下次提问上下文",
    sentToChat: "已在当前会话发送引用卡片",
    sentCliToChat: "已发送同步/恢复指令到当前对话，执行完成后点「刷新」即可更新界面",
    globalReadonlyHint: "全屏视图无法直接调用聊天窗口：已复制指令到剪贴板，请粘贴到对话中执行（或在右侧栏「+ → 会话管理器」中直接一键恢复）",
    notSyncedBanner: "尚未同步 Antigravity 原生归档状态，因此全部显示为活跃。请点击右上角「同步归档状态」。",
    snapshotBanner: "已通过快照同步归档状态（{time}）。个人备注可直接保存；在右侧栏「+」打开支持一键恢复/归档，全屏模式会复制指令供在对话中执行。",
    archivedBadge: "已归档",
    activeBadge: "活跃",
    steps: "步",
  },
  en: {
    brand: "Session Manager",
    liveMode: "Live API",
    snapshotMode: "Synced",
    localMode: "Unsynced",
    syncBtn: "Sync Status",
    tabSessions: "Sessions",
    tabArtifacts: "Artifacts & Images",
    refresh: "Refresh",
    searchPlaceholder: "Search titles, transcripts, tags, or artifacts...",
    searchArtifactsPlaceholder: "Search image/doc names or owning sessions...",
    allProjects: "All Projects",
    allTags: "All Tags",
    includeSubagents: "Subagents",
    all: "All",
    active: "Active",
    archived: "Archived",
    pinned: "Pinned",
    starred: "Starred",
    artAll: "All",
    artImages: "Images",
    artDocs: "Docs",
    selectedCount: "{n} selected",
    archive: "Archive",
    unarchive: "Restore to Active",
    pin: "Pin",
    unpin: "Unpin",
    star: "Star",
    unstar: "Unstar",
    addTag: "Add Tag",
    clearSel: "Clear",
    backToList: "← Back",
    selectSessionHint: "Select a conversation to inspect prompts, notes, tags, and generated images/artifacts.",
    noSessions: "No matching conversations",
    noArtifacts: "No matching artifacts or images",
    loading: "Loading...",
    rename: "Rename",
    save: "Save",
    cancel: "Cancel",
    noteLabel: "Personal Note (persisted locally)",
    notePlaceholder: "Jot down key takeaways, branch SHA, or follow-ups...",
    tagsLabel: "Tags",
    addTagPlaceholder: "Add tag + Enter",
    copyLink: "Copy Link",
    copied: "Copied",
    attachContext: "Attach to Prompt",
    openInChat: "Reference in Chat",
    deleteBtn: "Delete",
    confirmDelete: "Confirm Permanent Delete",
    promptsLabel: "User Prompts",
    artifactsLabel: "Artifacts & Images",
    openFile: "Open in Side Pane",
    preview: "Preview",
    close: "Close",
    tooLarge: "Image exceeds 700 KiB inline limit; open in side pane or copy path.",
    updatedOk: "Updated",
    batchDone: "Batch updated: {ok}/{total}",
    contextAttached: "Attached session context to next prompt",
    sentToChat: "Posted session reference to conversation",
    sentCliToChat: "Sent command to chat. Click Refresh once it finishes.",
    globalReadonlyHint: "Full-page view cannot send chat messages: copied command to clipboard. Paste in chat or open from side pane (+) for 1-click actions.",
    notSyncedBanner: "Native archived status not synced yet (showing all as active). Click 'Sync Status' at the top right.",
    snapshotBanner: "Showing synced archived status ({time}). Notes save directly; open from side pane (+) for 1-click restore/archive, or copy command in full-page view.",
    archivedBadge: "Archived",
    activeBadge: "Active",
    steps: "steps",
  },
} as const;

const PASSTHROUGH_SCHEMA: StandardSchemaV1<unknown, { isError?: boolean }> = {
  "~standard": {
    version: 1,
    vendor: "agy-session-manager",
    validate: (value) => ({ value: (value ?? {}) as { isError?: boolean } }),
  },
};

const app = new App({ name: "Session Manager", version: "0.2.0" }, {});

const state = {
  lang: "zh" as Lang,
  tab: "sessions" as "sessions" | "artifacts",
  status: "all" as "all" | "active" | "archived" | "pinned" | "starred",
  projectId: "",
  tag: "",
  query: "",
  includeSubagents: false,
  loading: false,
  data: null as ListPayload | null,
  selectedIds: new Set<string>(),
  activeId: null as string | null,
  detail: null as SessionDetail | null,
  detailLoading: false,
  editingTitle: false,
  confirmDeleteId: null as string | null,
  artKind: "all" as "all" | "image" | "doc",
  artQuery: "",
  artifacts: [] as ArtifactItem[],
  artifactsLoading: false,
  preview: null as null | {
    name: string;
    kind: string;
    fileUri: string;
    dataUrl: string | null;
    text: string | null;
    tooLarge?: boolean;
    sessionTitle?: string;
  },
  toast: "",
  toastTimer: 0 as unknown as number,
  canMessage: false,
  canUpdateContext: false,
};

function t(key: keyof (typeof I18N)["en"], vars?: Record<string, string | number>): string {
  let str: string = I18N[state.lang][key] || I18N.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

function esc(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso.slice(0, 16);
  }
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function shellQuote(arg: string): string {
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

function showToast(msg: string) {
  state.toast = msg;
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    state.toast = "";
    render();
  }, 3600) as unknown as number;
  render();
}

async function callAppTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await app.callServerTool({ name, arguments: args });
  if (res.isError) {
    const errTxt =
      res.content?.map((c) => ("text" in c ? c.text : "")).join(" ") || "Tool error";
    throw new Error(errTxt);
  }
  return (res.structuredContent ?? {}) as T;
}

async function loadSessions(forceRefresh = false) {
  state.loading = true;
  render();
  try {
    const data = await callAppTool<ListPayload>("app_list_sessions", {
      status: state.status,
      projectId: state.projectId,
      tag: state.tag,
      query: state.query,
      includeSubagents: state.includeSubagents,
      limit: 100,
      forceRefresh,
    });
    state.data = data;
  } catch (err) {
    showToast(err instanceof Error ? err.message : String(err));
  } finally {
    state.loading = false;
    render();
  }
}

async function loadDetail(id: string) {
  state.activeId = id;
  state.editingTitle = false;
  state.confirmDeleteId = null;
  state.detailLoading = true;
  render();
  try {
    state.detail = await callAppTool<SessionDetail>("app_get_session_detail", { id });
  } catch (err) {
    showToast(err instanceof Error ? err.message : String(err));
  } finally {
    state.detailLoading = false;
    render();
  }
}

async function loadArtifacts() {
  state.artifactsLoading = true;
  render();
  try {
    const res = await callAppTool<{ items: ArtifactItem[] }>("app_search_artifacts", {
      query: state.artQuery,
      kind: state.artKind,
      includeArchived: true,
      limit: 120,
    });
    state.artifacts = res.items || [];
  } catch (err) {
    showToast(err instanceof Error ? err.message : String(err));
  } finally {
    state.artifactsLoading = false;
    render();
  }
}

async function copyText(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    return false;
  }
}

async function dispatchCliBridge(cliArgs: string, humanLabel: string) {
  const cmd = `node ${CLI_PATH} ${cliArgs}`;
  const prompt =
    state.lang === "zh"
      ? `请使用 session-manager 执行以下会话管理指令（完成后回复结果）：\n\`${cmd}\``
      : `Run this agy-session-manager command via shell and report the result:\n\`${cmd}\``;

  if (state.canMessage) {
    await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: prompt }],
    });
    showToast(t("sentCliToChat"));
    return;
  }

  await copyText(prompt);
  showToast(`${t("globalReadonlyHint")} (${humanLabel})`);
}

async function syncNativeStatus() {
  if (state.data?.capabilities?.liveApi) {
    await loadSessions(true);
    showToast(t("updatedOk"));
    return;
  }
  await dispatchCliBridge("sync", t("syncBtn"));
}

async function updateSession(id: string, patch: Record<string, unknown>) {
  const liveApi = state.data?.capabilities?.liveApi ?? false;
  const hasNative =
    typeof patch.archived === "boolean" ||
    typeof patch.pinned === "boolean" ||
    typeof patch.starred === "boolean" ||
    typeof patch.title === "string" ||
    Array.isArray(patch.tags);

  if (liveApi || !hasNative) {
    try {
      const res = await callAppTool<{ updated: SessionDetail; apiError?: string }>(
        "app_update_session",
        { id, ...patch }
      );
      if (state.detail?.id === id) {
        state.detail = res.updated;
      }
      showToast(res.apiError || t("updatedOk"));
      await loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
    return;
  }

  // Native mutation in snapshot/local mode: route to real CLI via chat bridge
  if (typeof patch.archived === "boolean") {
    const cmd = patch.archived ? `archive ${id}` : `unarchive ${id}`;
    await dispatchCliBridge(cmd, patch.archived ? t("archive") : t("unarchive"));
    return;
  }
  if (typeof patch.pinned === "boolean") {
    await dispatchCliBridge(
      `pin ${id}${patch.pinned ? "" : " --off"}`,
      patch.pinned ? t("pin") : t("unpin")
    );
    return;
  }
  if (typeof patch.starred === "boolean") {
    await dispatchCliBridge(
      `star ${id}${patch.starred ? "" : " --off"}`,
      patch.starred ? t("star") : t("unstar")
    );
    return;
  }
  if (typeof patch.title === "string") {
    await dispatchCliBridge(`rename ${id} ${shellQuote(patch.title)}`, t("rename"));
    return;
  }
  if (Array.isArray(patch.tags)) {
    const joined = patch.tags.map((x) => String(x)).join(",");
    await dispatchCliBridge(`tag ${id} ${shellQuote(joined)}`, t("tagsLabel"));
  }
}

async function batchUpdate(patch: Record<string, unknown>) {
  const ids = [...state.selectedIds];
  if (ids.length === 0) return;

  if (state.data?.capabilities?.liveApi) {
    try {
      const res = await callAppTool<{ total: number; succeeded: number }>("app_batch_update", {
        ids,
        ...patch,
      });
      showToast(t("batchDone", { ok: res.succeeded, total: res.total }));
      state.selectedIds.clear();
      await loadSessions();
      if (state.activeId && ids.includes(state.activeId)) {
        await loadDetail(state.activeId);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
    return;
  }

  if (typeof patch.archived === "boolean") {
    const verb = patch.archived ? "archive" : "unarchive";
    await dispatchCliBridge(`${verb} ${ids.join(" ")}`, verb);
    state.selectedIds.clear();
    render();
    return;
  }

  if (typeof patch.addTag === "string" && patch.addTag.trim()) {
    const tag = patch.addTag.trim();
    const items = state.data?.items ?? [];
    const cmds = ids
      .map((id) => {
        const cur = items.find((s) => s.id === id)?.tags ?? [];
        const next = [...new Set([...cur, tag])].join(",");
        return `node ${CLI_PATH} tag ${id} ${shellQuote(next)}`;
      })
      .join(" && ");
    const prompt =
      state.lang === "zh"
        ? `请执行以下批量标签更新指令：\n\`${cmds}\``
        : `Run these batch tag commands:\n\`${cmds}\``;
    if (state.canMessage) {
      await app.sendMessage({ role: "user", content: [{ type: "text", text: prompt }] });
      showToast(t("sentCliToChat"));
    } else {
      await copyText(prompt);
      showToast(t("globalReadonlyHint"));
    }
    state.selectedIds.clear();
    render();
  }
}

async function deleteActiveSession(id: string) {
  if (state.data?.capabilities?.liveApi) {
    try {
      await callAppTool("app_delete_session", { id, confirm: true });
      if (state.activeId === id) {
        state.activeId = null;
        state.detail = null;
      }
      state.selectedIds.delete(id);
      showToast("Deleted");
      await loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
    return;
  }
  state.confirmDeleteId = null;
  await dispatchCliBridge(`delete ${id} --confirm`, t("deleteBtn"));
}

async function openArtifactPreview(sessionId: string, relPath: string, sessionTitle?: string) {
  try {
    const prev = await callAppTool<{
      name: string;
      kind: string;
      fileUri: string;
      dataUrl: string | null;
      text: string | null;
      tooLarge?: boolean;
    }>("app_get_artifact_preview", { id: sessionId, relPath });
    state.preview = { ...prev, sessionTitle };
    render();
  } catch (err) {
    showToast(err instanceof Error ? err.message : String(err));
  }
}

async function openInSidePane(fileUri: string) {
  try {
    const res = await app.request(
      {
        method: "com.google.antigravity/toggle-aux-pane",
        params: { tabType: "fileView", uri: fileUri },
      },
      PASSTHROUGH_SCHEMA
    );
    if (res?.isError) {
      await copyText(fileUri);
      showToast(`${t("copied")}: ${fileUri}`);
    }
  } catch {
    await copyText(fileUri);
    showToast(`${t("copied")}: ${fileUri}`);
  }
}

async function attachSessionToPrompt(d: SessionDetail) {
  if (!state.canUpdateContext) return;
  const lines = [
    `Referenced Antigravity conversation: [${d.title}](${d.conversationUri})`,
    `Status: ${d.archived ? "Archived" : "Active"} | Updated: ${d.updateTime || "unknown"}`,
    d.summary ? `Summary: ${d.summary}` : "",
    d.note ? `Note: ${d.note}` : "",
    d.artifacts.length > 0
      ? `Artifacts:\n${d.artifacts.slice(0, 8).map((a) => `- ${a.name}: ${a.fileUri}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  await app.updateModelContext({
    content: [{ type: "text", text: lines }],
  });
  showToast(t("contextAttached"));
}

async function referenceSessionInChat(d: SessionDetail) {
  if (!state.canMessage) return;
  const msg = `查看历史会话 [${d.title}](${d.conversationUri})${d.archived ? "（已归档）" : ""}`;
  await app.sendMessage({
    role: "user",
    content: [{ type: "text", text: msg }],
  });
  showToast(t("sentToChat"));
}

function renderTopbar(): string {
  const caps = state.data?.capabilities;
  let modeBadge = "";
  if (caps) {
    if (caps.mode === "live_api") {
      modeBadge = `<span class="badge live">● ${esc(t("liveMode"))}</span>`;
    } else if (caps.mode === "snapshot_sync") {
      const clock = formatClock(caps.snapshotSyncedAt);
      modeBadge = `<span class="badge live" title="${esc(caps.snapshotSyncedAt || "")}">● ${esc(t("snapshotMode"))} ${esc(clock)}</span>`;
    } else {
      modeBadge = `<span class="badge local">● ${esc(t("localMode"))}</span>`;
    }
  }

  return `
    <header class="topbar">
      <div class="topbar-left">
        <span class="brand-title">${esc(t("brand"))}</span>
        ${modeBadge}
      </div>
      <div class="topbar-actions">
        <div class="tab-group">
          <button class="tab-btn ${state.tab === "sessions" ? "active" : ""}" data-act="tab" data-val="sessions">${esc(t("tabSessions"))}</button>
          <button class="tab-btn ${state.tab === "artifacts" ? "active" : ""}" data-act="tab" data-val="artifacts">${esc(t("tabArtifacts"))}</button>
        </div>
        <button class="btn sm primary" data-act="sync-native">${esc(t("syncBtn"))}</button>
        <button class="btn sm" data-act="refresh">${esc(t("refresh"))}</button>
        <button class="btn sm" data-act="toggle-lang">${state.lang === "zh" ? "EN" : "中文"}</button>
      </div>
    </header>
  `;
}

function renderSessionsView(): string {
  const stats = state.data?.stats ?? {
    total: 0,
    active: 0,
    archived: 0,
    pinned: 0,
    starred: 0,
  };
  const projects = state.data?.projects ?? [];
  const tags = state.data?.tags ?? [];
  const items = state.data?.items ?? [];
  const caps = state.data?.capabilities;

  const pills: { id: typeof state.status; label: string; count: number }[] = [
    { id: "all", label: t("all"), count: stats.total },
    { id: "active", label: t("active"), count: stats.active },
    { id: "archived", label: t("archived"), count: stats.archived },
    { id: "pinned", label: t("pinned"), count: stats.pinned },
    { id: "starred", label: t("starred"), count: stats.starred },
  ];

  const bulkBar =
    state.selectedIds.size > 0
      ? `<div class="bulk-bar">
          <strong>${esc(t("selectedCount", { n: state.selectedIds.size }))}</strong>
          <button class="btn sm" data-act="bulk-unarchive">${esc(t("unarchive"))}</button>
          <button class="btn sm" data-act="bulk-archive">${esc(t("archive"))}</button>
          <button class="btn sm" data-act="bulk-tag">${esc(t("addTag"))}</button>
          <button class="btn sm" data-act="bulk-clear">${esc(t("clearSel"))}</button>
        </div>`
      : "";

  const statusBanner =
    caps?.mode === "local_index"
      ? `<div class="snippet-box" style="color:var(--text-warning);">${esc(t("notSyncedBanner"))}</div>`
      : caps?.mode === "snapshot_sync" && !state.canMessage
        ? `<div class="snippet-box" style="color:var(--text-2);">${esc(t("snapshotBanner", { time: formatTime(caps.snapshotSyncedAt) }))}</div>`
        : "";

  const cardsHtml =
    state.loading && items.length === 0
      ? `<div class="empty-state">${esc(t("loading"))}</div>`
      : items.length === 0
        ? `<div class="empty-state">${esc(t("noSessions"))}</div>`
        : items
            .map((s) => {
              const checked = state.selectedIds.has(s.id) ? "checked" : "";
              const isSelected = state.activeId === s.id ? "selected" : "";
              const badge = s.archived
                ? `<span class="badge archived">${esc(t("archivedBadge"))}</span>`
                : `<span class="badge active">${esc(t("activeBadge"))}</span>`;
              const tagsHtml = s.tags
                .slice(0, 3)
                .map((tg) => `<span class="tag">${esc(tg)}</span>`)
                .join("");
              const snip = s.matchSnippet
                ? `<div class="snippet-box">${esc(s.matchSnippet)}</div>`
                : "";
              return `
                <div class="session-card ${isSelected}" data-act="open-session" data-id="${esc(s.id)}">
                  <input type="checkbox" ${checked} data-act="check-session" data-id="${esc(s.id)}" style="margin-top:3px;" />
                  <div class="session-body">
                    <div class="session-head">
                      <span class="session-title" title="${esc(s.title)}">${s.pinned ? "📌 " : ""}${s.starred ? "★ " : ""}${esc(s.title)}</span>
                      <div class="row-actions">
                        <button class="btn sm icon-only" title="${esc(s.archived ? t("unarchive") : t("archive"))}" data-act="toggle-archive" data-id="${esc(s.id)}" data-val="${s.archived ? "0" : "1"}">${s.archived ? "↩" : "📥"}</button>
                        <button class="btn sm icon-only" title="${esc(s.starred ? t("unstar") : t("star"))}" data-act="toggle-star" data-id="${esc(s.id)}" data-val="${s.starred ? "0" : "1"}">${s.starred ? "★" : "☆"}</button>
                      </div>
                    </div>
                    ${s.summary && s.summary !== s.title ? `<div class="session-summary">${esc(s.summary)}</div>` : ""}
                    ${snip}
                    <div class="session-meta">
                      ${badge}
                      <span>${esc(formatTime(s.updateTime))}</span>
                      ${s.stepCount ? `<span>· ${s.stepCount} ${esc(t("steps"))}</span>` : ""}
                      ${s.imageCount ? `<span>· 🖼 ${s.imageCount}</span>` : ""}
                      ${s.docCount ? `<span>· 📄 ${s.docCount}</span>` : ""}
                      ${tagsHtml}
                    </div>
                  </div>
                </div>
              `;
            })
            .join("");

  return `
    <div class="controls">
      <div class="search-row">
        <input id="session-search" class="input search-input" type="search" placeholder="${esc(t("searchPlaceholder"))}" value="${esc(state.query)}" />
        <select id="project-select" class="select">
          <option value="">${esc(t("allProjects"))}</option>
          ${projects
            .map(
              (p) =>
                `<option value="${esc(p.id)}" ${state.projectId === p.id ? "selected" : ""}>${esc(p.id.slice(0, 12))} (${p.count})</option>`
            )
            .join("")}
        </select>
        <select id="tag-select" class="select">
          <option value="">${esc(t("allTags"))}</option>
          ${tags
            .map(
              (tg) =>
                `<option value="${esc(tg.name)}" ${state.tag === tg.name ? "selected" : ""}>${esc(tg.name)} (${tg.count})</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="filter-pills">
        ${pills
          .map(
            (p) =>
              `<button class="pill ${state.status === p.id ? "active" : ""}" data-act="status" data-val="${p.id}">${esc(p.label)} (${p.count})</button>`
          )
          .join("")}
        <label class="checkbox-label">
          <input id="subagent-toggle" type="checkbox" ${state.includeSubagents ? "checked" : ""} />
          ${esc(t("includeSubagents"))}
        </label>
      </div>
      ${statusBanner}
    </div>
    ${bulkBar}
    <div class="main-split ${state.activeId ? "has-detail" : ""}">
      <div class="list-pane">${cardsHtml}</div>
      <div class="detail-pane">${renderDetailPane()}</div>
    </div>
  `;
}

function renderDetailPane(): string {
  if (!state.activeId) {
    return `<div class="empty-state">${esc(t("selectSessionHint"))}</div>`;
  }
  if (state.detailLoading && !state.detail) {
    return `<div class="empty-state">${esc(t("loading"))}</div>`;
  }
  const d = state.detail;
  if (!d) return "";

  const titleHtml = state.editingTitle
    ? `<div style="display:flex;gap:6px;">
        <input id="rename-input" class="input" style="flex:1;" value="${esc(d.title)}" />
        <button class="btn primary sm" data-act="save-rename">${esc(t("save"))}</button>
        <button class="btn sm" data-act="cancel-rename">${esc(t("cancel"))}</button>
      </div>`
    : `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
        <h3 style="margin:0;font-size:15px;">${esc(d.title)}</h3>
        <button class="btn sm" data-act="start-rename">${esc(t("rename"))}</button>
      </div>`;

  const tagsHtml = d.tags
    .map(
      (tg) =>
        `<span class="tag">${esc(tg)} <button data-act="remove-tag" data-val="${esc(tg)}" title="Remove">×</button></span>`
    )
    .join("");

  const deleteHtml =
    state.confirmDeleteId === d.id
      ? `<button class="btn danger sm" data-act="confirm-delete">${esc(t("confirmDelete"))}</button>
         <button class="btn sm" data-act="cancel-delete">${esc(t("cancel"))}</button>`
      : `<button class="btn danger sm" data-act="ask-delete">${esc(t("deleteBtn"))}</button>`;

  const artifactsHtml =
    d.artifacts.length === 0
      ? `<div style="color:var(--text-3);font-size:12px;">—</div>`
      : `<div class="artifact-grid">
          ${d.artifacts
            .map(
              (a) => `
              <div class="artifact-card">
                <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(a.relPath)}">${a.kind === "image" ? "🖼 " : a.kind === "doc" ? "📄 " : "📎 "}${esc(a.name)}</div>
                <div style="font-size:11px;color:var(--text-3);">${esc(formatSize(a.size))} · ${esc(formatTime(a.updatedAt))}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${a.kind === "image" || a.kind === "doc" ? `<button class="btn sm primary" data-act="preview-art" data-id="${esc(d.id)}" data-path="${esc(a.relPath)}" data-stitle="${esc(d.title)}">${esc(t("preview"))}</button>` : ""}
                  <button class="btn sm" data-act="open-file" data-uri="${esc(a.fileUri)}">${esc(t("openFile"))}</button>
                </div>
              </div>
            `
            )
            .join("")}
        </div>`;

  const promptsHtml =
    d.userPrompts.length === 0
      ? `<div style="color:var(--text-3);font-size:12px;">—</div>`
      : d.userPrompts
          .slice(0, 12)
          .map(
            (p) =>
              `<div class="prompt-item"><span style="color:var(--text-3);font-size:11px;">#${p.stepIndex} ${esc(formatTime(p.createdAt))}</span><div>${esc(p.text)}</div></div>`
          )
          .join("");

  return `
    <div style="margin-bottom:8px;display:none;" class="mobile-back">
      <button class="btn sm" data-act="close-detail">${esc(t("backToList"))}</button>
    </div>
    <style>@media (max-width:720px){.mobile-back{display:block !important;}}</style>
    <div class="detail-header">
      ${titleHtml}
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11px;color:var(--text-3);">
        <span class="badge ${d.archived ? "archived" : "active"}">${esc(d.archived ? t("archivedBadge") : t("activeBadge"))}</span>
        <span>ID: <code>${esc(d.id.slice(0, 8))}</code></span>
        <span>${esc(formatTime(d.updateTime))}</span>
        <span>· ${d.stepCount} ${esc(t("steps"))}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn sm primary" data-act="detail-archive">${esc(d.archived ? t("unarchive") : t("archive"))}</button>
        <button class="btn sm" data-act="detail-pin">${esc(d.pinned ? t("unpin") : t("pin"))}</button>
        <button class="btn sm" data-act="detail-star">${esc(d.starred ? t("unstar") : t("star"))}</button>
        <button class="btn sm" data-act="copy-uri" data-uri="${esc(d.conversationUri)}">${esc(t("copyLink"))}</button>
        ${state.canUpdateContext ? `<button class="btn sm" data-act="attach-context">${esc(t("attachContext"))}</button>` : ""}
        ${state.canMessage ? `<button class="btn sm" data-act="open-chat">${esc(t("openInChat"))}</button>` : ""}
        ${deleteHtml}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-label">${esc(t("tagsLabel"))}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        ${tagsHtml}
        <input id="new-tag-input" class="input" style="padding:3px 8px;width:140px;font-size:12px;" placeholder="${esc(t("addTagPlaceholder"))}" />
      </div>
    </div>

    <div class="detail-section">
      <div class="section-label">${esc(t("noteLabel"))}</div>
      <textarea id="session-note" class="textarea" placeholder="${esc(t("notePlaceholder"))}">${esc(d.note)}</textarea>
      <div style="margin-top:6px;">
        <button class="btn sm" data-act="save-note">${esc(t("save"))}</button>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-label">${esc(t("artifactsLabel"))} (${d.artifacts.length})</div>
      ${artifactsHtml}
    </div>

    <div class="detail-section">
      <div class="section-label">${esc(t("promptsLabel"))} (${d.userPrompts.length})</div>
      ${promptsHtml}
    </div>
  `;
}

function renderArtifactsView(): string {
  const kinds: { id: typeof state.artKind; label: string }[] = [
    { id: "all", label: t("artAll") },
    { id: "image", label: t("artImages") },
    { id: "doc", label: t("artDocs") },
  ];

  const grid =
    state.artifactsLoading && state.artifacts.length === 0
      ? `<div class="empty-state">${esc(t("loading"))}</div>`
      : state.artifacts.length === 0
        ? `<div class="empty-state">${esc(t("noArtifacts"))}</div>`
        : `<div class="artifact-grid" style="padding:14px;">
            ${state.artifacts
              .map(
                (a) => `
              <div class="artifact-card">
                <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(a.relPath)}">${a.kind === "image" ? "🖼 " : a.kind === "doc" ? "📄 " : "📎 "}${esc(a.name)}</div>
                <div style="font-size:11px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(a.sessionTitle || "")}">
                  ${a.sessionArchived ? `[${esc(t("archivedBadge"))}] ` : ""}${esc(a.sessionTitle || a.sessionId || "")}
                </div>
                <div style="font-size:11px;color:var(--text-3);">${esc(formatSize(a.size))} · ${esc(formatTime(a.updatedAt))}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;">
                  ${a.kind === "image" || a.kind === "doc" ? `<button class="btn sm primary" data-act="preview-art" data-id="${esc(a.sessionId || "")}" data-path="${esc(a.relPath)}" data-stitle="${esc(a.sessionTitle || "")}">${esc(t("preview"))}</button>` : ""}
                  <button class="btn sm" data-act="open-file" data-uri="${esc(a.fileUri)}">${esc(t("openFile"))}</button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>`;

  return `
    <div class="controls">
      <div class="search-row">
        <input id="art-search" class="input search-input" type="search" placeholder="${esc(t("searchArtifactsPlaceholder"))}" value="${esc(state.artQuery)}" />
      </div>
      <div class="filter-pills">
        ${kinds
          .map(
            (k) =>
              `<button class="pill ${state.artKind === k.id ? "active" : ""}" data-act="art-kind" data-val="${k.id}">${esc(k.label)}</button>`
          )
          .join("")}
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;">${grid}</div>
  `;
}

function renderPreviewModal(): string {
  if (!state.preview) return "";
  const p = state.preview;
  let body = "";
  if (p.dataUrl) {
    body = `<img src="${esc(p.dataUrl)}" alt="${esc(p.name)}" />`;
  } else if (p.text !== null) {
    body = `<pre>${esc(p.text)}</pre>`;
  } else if (p.tooLarge) {
    body = `<div class="empty-state">${esc(t("tooLarge"))}</div>`;
  }
  return `
    <div class="modal-backdrop" data-act="close-preview">
      <div class="modal-card" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div>
            <strong>${esc(p.name)}</strong>
            ${p.sessionTitle ? `<div style="font-size:11px;color:var(--text-3);">${esc(p.sessionTitle)}</div>` : ""}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn sm" data-act="open-file" data-uri="${esc(p.fileUri)}">${esc(t("openFile"))}</button>
            <button class="btn sm" data-act="close-preview">${esc(t("close"))}</button>
          </div>
        </div>
        ${body}
      </div>
    </div>
  `;
}

function render() {
  const root = document.getElementById("app");
  if (!root) return;

  const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  const activeId = activeEl?.id || "";
  const selStart = activeEl && "selectionStart" in activeEl ? activeEl.selectionStart : null;

  root.innerHTML = `
    ${renderTopbar()}
    ${state.tab === "sessions" ? renderSessionsView() : renderArtifactsView()}
    ${renderPreviewModal()}
    ${state.toast ? `<div class="toast">${esc(state.toast)}</div>` : ""}
  `;

  if (activeId) {
    const restored = document.getElementById(activeId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (restored) {
      restored.focus();
      if (selStart !== null && "setSelectionRange" in restored) {
        try {
          restored.setSelectionRange(selStart, selStart);
        } catch {
          // ignore
        }
      }
    }
  }
}

let searchDebounce = 0 as unknown as number;

document.addEventListener("input", (ev) => {
  const target = ev.target as HTMLInputElement | null;
  if (!target) return;
  if (target.id === "session-search") {
    state.query = target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => void loadSessions(), 240) as unknown as number;
  } else if (target.id === "art-search") {
    state.artQuery = target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => void loadArtifacts(), 240) as unknown as number;
  }
});

document.addEventListener("change", (ev) => {
  const target = ev.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target) return;
  if (target.id === "project-select") {
    state.projectId = target.value;
    void loadSessions();
  } else if (target.id === "tag-select") {
    state.tag = target.value;
    void loadSessions();
  } else if (target.id === "subagent-toggle") {
    state.includeSubagents = (target as HTMLInputElement).checked;
    void loadSessions();
  }
});

document.addEventListener("keydown", (ev) => {
  const target = ev.target as HTMLInputElement | null;
  if (!target) return;
  if (target.id === "new-tag-input" && ev.key === "Enter" && state.detail) {
    ev.preventDefault();
    const val = target.value.trim();
    if (!val) return;
    const nextTags = [...new Set([...state.detail.tags, val])];
    void updateSession(state.detail.id, { tags: nextTags });
  } else if (target.id === "rename-input" && ev.key === "Enter" && state.detail) {
    ev.preventDefault();
    const val = target.value.trim();
    if (val) {
      state.editingTitle = false;
      void updateSession(state.detail.id, { title: val });
    }
  }
});

document.addEventListener("click", (ev) => {
  const el = (ev.target as HTMLElement | null)?.closest("[data-act]") as HTMLElement | null;
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id || "";
  const val = el.dataset.val || "";

  if (act === "check-session") {
    ev.stopPropagation();
    const checked = (el as HTMLInputElement).checked;
    if (checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    render();
    return;
  }

  if (act === "toggle-archive") {
    ev.stopPropagation();
    void updateSession(id, { archived: val === "1" });
    return;
  }

  if (act === "toggle-star") {
    ev.stopPropagation();
    void updateSession(id, { starred: val === "1" });
    return;
  }

  if (act === "open-session") {
    void loadDetail(id);
    return;
  }

  if (act === "tab") {
    state.tab = val as "sessions" | "artifacts";
    render();
    if (state.tab === "artifacts" && state.artifacts.length === 0) {
      void loadArtifacts();
    }
    return;
  }

  if (act === "sync-native") {
    void syncNativeStatus();
    return;
  }

  if (act === "refresh") {
    if (state.tab === "sessions") void loadSessions(true);
    else void loadArtifacts();
    return;
  }

  if (act === "toggle-lang") {
    state.lang = state.lang === "zh" ? "en" : "zh";
    render();
    return;
  }

  if (act === "status") {
    state.status = val as typeof state.status;
    void loadSessions();
    return;
  }

  if (act === "art-kind") {
    state.artKind = val as typeof state.artKind;
    void loadArtifacts();
    return;
  }

  if (act === "bulk-archive") {
    void batchUpdate({ archived: true });
    return;
  }

  if (act === "bulk-unarchive") {
    void batchUpdate({ archived: false });
    return;
  }

  if (act === "bulk-tag") {
    const tag = window.prompt(t("addTagPlaceholder"));
    if (tag && tag.trim()) {
      void batchUpdate({ addTag: tag.trim() });
    }
    return;
  }

  if (act === "bulk-clear") {
    state.selectedIds.clear();
    render();
    return;
  }

  if (act === "close-detail") {
    state.activeId = null;
    render();
    return;
  }

  if (act === "start-rename") {
    state.editingTitle = true;
    render();
    return;
  }

  if (act === "cancel-rename") {
    state.editingTitle = false;
    render();
    return;
  }

  if (act === "save-rename" && state.detail) {
    const inp = document.getElementById("rename-input") as HTMLInputElement | null;
    const next = inp?.value.trim();
    if (next) {
      state.editingTitle = false;
      void updateSession(state.detail.id, { title: next });
    }
    return;
  }

  if (act === "detail-archive" && state.detail) {
    void updateSession(state.detail.id, { archived: !state.detail.archived });
    return;
  }

  if (act === "detail-pin" && state.detail) {
    void updateSession(state.detail.id, { pinned: !state.detail.pinned });
    return;
  }

  if (act === "detail-star" && state.detail) {
    void updateSession(state.detail.id, { starred: !state.detail.starred });
    return;
  }

  if (act === "remove-tag" && state.detail) {
    const next = state.detail.tags.filter((x) => x !== val);
    void updateSession(state.detail.id, { tags: next });
    return;
  }

  if (act === "save-note" && state.detail) {
    const ta = document.getElementById("session-note") as HTMLTextAreaElement | null;
    void updateSession(state.detail.id, { note: ta?.value ?? "" });
    return;
  }

  if (act === "copy-uri") {
    void copyText(el.dataset.uri || "").then(() => showToast(t("copied")));
    return;
  }

  if (act === "attach-context" && state.detail) {
    void attachSessionToPrompt(state.detail);
    return;
  }

  if (act === "open-chat" && state.detail) {
    void referenceSessionInChat(state.detail);
    return;
  }

  if (act === "ask-delete" && state.detail) {
    state.confirmDeleteId = state.detail.id;
    render();
    return;
  }

  if (act === "cancel-delete") {
    state.confirmDeleteId = null;
    render();
    return;
  }

  if (act === "confirm-delete" && state.detail) {
    void deleteActiveSession(state.detail.id);
    return;
  }

  if (act === "preview-art") {
    void openArtifactPreview(id, el.dataset.path || "", el.dataset.stitle);
    return;
  }

  if (act === "close-preview") {
    state.preview = null;
    render();
    return;
  }

  if (act === "open-file") {
    void openInSidePane(el.dataset.uri || "");
    return;
  }
});

// Register handlers BEFORE connect() so no initial notification is missed
app.ontoolinput = ({ arguments: args }) => {
  if (args && typeof args.status === "string") {
    state.status = args.status as typeof state.status;
  }
  if (args && typeof args.query === "string") {
    state.query = args.query;
  }
  state.loading = true;
  render();
};

app.ontoolresult = (result) => {
  const sc = result?.structuredContent as ListPayload | undefined;
  if (sc && Array.isArray(sc.items)) {
    state.data = sc;
    state.loading = false;
    render();
  }
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
};

async function init() {
  render();
  await app.connect();
  const ctx = app.getHostContext();
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx?.locale && !ctx.locale.toLowerCase().startsWith("zh")) {
    state.lang = "en";
  }

  const hostCaps = app.getHostCapabilities() as Record<string, unknown> | undefined;
  state.canMessage = Boolean(hostCaps?.message);
  state.canUpdateContext = Boolean(hostCaps?.updateModelContext);

  if (!state.data) {
    await loadSessions();
  } else {
    render();
  }
}

init().catch((err) => {
  console.error(err);
  render();
});
