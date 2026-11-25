const SERVICE_PATH = "product.v1.ConversationService";
const MAX_LIST_PAGES = 20;

function resolveConfig(opts = {}) {
  const address = String(
    opts.address ?? process.env.ANTIGRAVITY_LS_ADDRESS ?? ""
  ).trim();
  const csrfToken = String(
    opts.csrfToken ?? process.env.ANTIGRAVITY_CSRF_TOKEN ?? ""
  ).trim();
  const timeoutMs = Number(opts.timeoutMs ?? 30000);
  return { address, csrfToken, timeoutMs };
}

/**
 * Check whether live ConversationService credentials are present in env/options.
 * @param {object} [opts]
 * @returns {boolean}
 */
export function isLiveApiAvailable(opts = {}) {
  const { address, csrfToken } = resolveConfig(opts);
  return Boolean(address && csrfToken);
}

/**
 * Call a Connect HTTP+JSON method on product.v1.ConversationService.
 * @param {string} method
 * @param {object} body
 * @param {object} [opts]
 * @returns {Promise<any>}
 */
export async function callConversationRpc(method, body = {}, opts = {}) {
  const { address, csrfToken, timeoutMs } = resolveConfig(opts);
  if (!address || !csrfToken) {
    throw new Error(
      "ConversationService unavailable: ANTIGRAVITY_LS_ADDRESS or ANTIGRAVITY_CSRF_TOKEN is not set."
    );
  }

  const baseUrl = address.startsWith("http://") || address.startsWith("https://")
    ? address.replace(/\/+$/, "")
    : `http://${address}`;
  const url = `${baseUrl}/${SERVICE_PATH}/${method}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "x-antigravity-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`ConversationService/${method} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
      }
    }
    if (!res.ok) {
      const msg = parsed?.message || parsed?.error || text || `HTTP ${res.status}`;
      throw new Error(`ConversationService/${method} failed (${res.status}): ${msg}`);
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Paginate ListConversations (including archived by default).
 * @param {object} [opts]
 * @returns {Promise<any[]>}
 */
export async function listAllConversations(opts = {}) {
  const includeArchived = opts.includeArchived ?? true;
  const pageSize = Math.min(Math.max(Number(opts.pageSize) || 100, 1), 100);
  const items = [];
  let pageToken = "";

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const payload = {
      pageSize,
      includeArchived,
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(Array.isArray(opts.tags) && opts.tags.length > 0 ? { tags: opts.tags } : {}),
      ...(opts.parentConversationId !== undefined
        ? { parentConversationId: opts.parentConversationId }
        : {}),
      ...(pageToken ? { pageToken } : {}),
    };
    const res = await callConversationRpc("ListConversations", payload, opts);
    if (Array.isArray(res.conversations)) {
      items.push(...res.conversations);
    }
    pageToken = typeof res.nextPageToken === "string" ? res.nextPageToken : "";
    if (!pageToken) break;
  }

  return items;
}

/**
 * Fetch a single conversation by ID.
 * @param {string} conversationId
 * @param {object} [opts]
 */
export async function getConversation(conversationId, opts = {}) {
  const res = await callConversationRpc(
    "GetConversation",
    { conversationId },
    opts
  );
  return res.conversation ?? res;
}

/**
 * Update editable annotations on a conversation.
 * @param {string} conversationId
 * @param {object} annotations
 * @param {object} [opts]
 */
export async function updateConversation(conversationId, annotations, opts = {}) {
  const res = await callConversationRpc(
    "UpdateConversation",
    { conversationId, annotations },
    opts
  );
  return res.conversation ?? res;
}

/**
 * Create a new conversation (optionally with an initial prompt).
 * @param {object} payload
 * @param {object} [opts]
 */
export async function createConversation(payload, opts = {}) {
  const res = await callConversationRpc("CreateConversation", payload, opts);
  return res.conversation ?? res;
}

/**
 * Permanently delete a conversation.
 * @param {string} conversationId
 * @param {object} [opts]
 */
export async function deleteConversation(conversationId, opts = {}) {
  return callConversationRpc("DeleteConversation", { conversationId }, opts);
}
