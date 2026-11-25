[English](./README.md) | 简体中文

# agy-session-manager（Antigravity 会话管理器）

**Antigravity 可视化会话与归档对话管理插件** —— 基于官方 **MCP Apps**（支持左侧栏 **Plugins** 全屏视图与右侧辅助栏 `aux_pane` 面板）、本地聊天记录与生成产物全文检索、以及零运行时依赖的 Node.js MCP Server。

## 核心功能

- **全屏 + 右侧栏交互界面（`ui://agy-session-manager/app.html`）**：
  - 支持从左侧边栏 **Plugins → 会话管理器** 全屏打开，也支持在对话右侧辅助栏 **`+`** 菜单打开，或直接在聊天里呼出。
  - 自动适配 Antigravity 明暗主题与语言环境（内置中/英一键切换）。
- **活跃与归档会话统一管理**：
  - 一键按 `全部 / 活跃 / 已归档 / 置顶 / 星标`、项目、标签筛选；默认隐藏纯子代理内部目录（可勾选查看）。
  - 支持行内重命名、置顶、星标、个人备注（本地持久化到 `${PLUGIN_DATA}/store.json`）、批量归档/恢复/加标签。
- **跨会话全文 + 产物图片墙检索**：
  - 不仅搜标题，还能直接全文检索本地 `~/.gemini/antigravity/brain/<id>/` 里的 `transcript.jsonl` 对话记录与生成产物/图片文件名。
  - 独立的 **产物与图片** 视图，跨全部历史/归档会话浏览生成过的图片与文档，支持弹框预览与一键 **在侧栏打开**。
- **双模式架构（实时 API + 本地索引兜底）**：
  - **Live API 模式**：当服务器进程拥有 `ANTIGRAVITY_LS_ADDRESS` 与 `ANTIGRAVITY_CSRF_TOKEN` 时，直连 `product.v1.ConversationService` 读写原生会话列表、归档状态、置顶/星标、标签与删除。
  - **Local Index 模式**：即使未注入 RPC 环境变量，也能离线完整扫描本地 `brain/` 索引、保存个人备注/标签、挂载历史上下文到下次提问；配套 `session-manager` Skill 也可直接在聊天里执行原生 `ConversationService` 批量归档/恢复。

---

## 一句话安装（直接粘贴到 Antigravity）

环境要求：**Git** 和 **Node.js >= 18**（安装过程无需 `npm install`，仓库内已预构建单文件 UI）：

```text
请帮我安装 https://github.com/chihenho/agy-session-manager 到 Antigravity：
按仓库内 INSTALL_FOR_AGENTS.md 执行 —— 克隆到 ~/.gemini/antigravity/scratch/agy-session-manager，运行 `node install.mjs --lang zh`，用 `agy plugin validate --strict` 校验并运行 `doctor`，通过 GetAllPlugins RPC（jq 过滤）确认插件和 `sessions` MCP Server 已启用，最后给我 [会话管理器](customization://agy-session-manager) 管理链接。
```

### 手动命令行安装

```bash
git clone https://github.com/chihenho/agy-session-manager.git
cd agy-session-manager
node install.mjs --lang zh
```

---

## 常用 CLI 命令

```bash
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs stats
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs list --archived --limit 20
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs search "关键词"
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs artifacts --images
node ~/.gemini/config/plugins/agy-session-manager/src/cli.mjs doctor
```

## 开源协议

[MIT](./LICENSE)
