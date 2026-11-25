[English](./README.md) | 简体中文

# agy-session-manager（Antigravity 会话管理器）

**Antigravity 可视化会话与归档对话管理插件** —— 支持 **同步真实已归档状态与一键恢复**、全屏与右侧辅助栏 `aux_pane` 交互界面、跨会话聊天记录与生成图片全文检索，以及零运行时依赖的 Node.js CLI / MCP 工具。

## 核心功能

- **真实已归档状态同步 & 一键恢复到活跃**：
  - Antigravity 仅向 Agent 终端和 Hook 注入 `ANTIGRAVITY_LS_ADDRESS` / `ANTIGRAVITY_CSRF_TOKEN`，不会注入给 MCP Server 子进程。
  - 本插件通过共享 `${PLUGIN_DATA}/snapshot.json` 元数据快照打通双端：安装时自动同步、会话结束 `Stop` Hook 后台节流同步，或在界面点 **「同步归档状态」** 触发实时同步。
  - 在 **右侧辅助栏（`+` → 会话管理器）** 中点击 **恢复到活跃 / 归档 / 批量恢复 / 置顶 / 星标 / 重命名 / 删除** 时，默认开启 **「✓ 后台执行」**（`target: "new"`），会在独立后台任务中执行原生 `ConversationService` 变更并在完成后自动归档该临时任务，既能直接操作又不打扰当前对话；也可随时切回当前对话执行。在 **全屏视图** 中会自动复制可执行指令到剪贴板。
- **全屏 + 右侧栏交互界面（`ui://agy-session-manager/app.html`）**：
  - 支持从左侧边栏 **Plugins → 会话管理器** 全屏打开，也支持在对话右侧辅助栏 **`+`** 菜单打开，自动适配明暗主题与中英文切换。
- **跨会话全文 + 产物图片墙检索**：
  - 支持搜标题、摘要、标签、个人备注、`transcript.jsonl` 全文与生成图片/文档名，支持弹框预览与一键 **在侧栏打开**。

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
CLI="$HOME/.gemini/config/plugins/agy-session-manager/src/cli.mjs"

node "$CLI" sync                       # 同步原生活跃/已归档状态到 snapshot.json
node "$CLI" unarchive <id...>          # 恢复已归档对话到活跃列表
node "$CLI" archive <id...>            # 归档指定对话
node "$CLI" list --archived --limit 20 # 列出已归档会话
node "$CLI" search "关键词"            # 跨会话全文与产物检索
node "$CLI" artifacts --images         # 列出所有会话生成的图片
node "$CLI" doctor                     # 诊断状态
```

## 开源协议

[MIT](./LICENSE)
