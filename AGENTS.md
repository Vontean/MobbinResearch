# AGENTS.md

这个仓库开发 `mobbin-research` 技能：用 Mobbin 循环调研界面，并把结果呈现为可浏览的"调研之海"。

- 术语：[CONTEXT.md](CONTEXT.md)。代码、文档、界面用同一套词。
- 架构、文件路由表、验证方式：[ARCHITECTURE.md](ARCHITECTURE.md)。动手前先查路由表。
- 视觉与动效的设计意图：`mobbin-research/assets/web-viewer/DESIGN.md`。

## 约定

- `mobbin-research/` 是交付给 Agent 的技能包；开发工具放在根目录 `tools/`，不放进技能包。
- 演示目录里的 `index.html`、`viewer/`、`research.js` 是构建产物：改 `assets/web-viewer/`，再运行 `build_web.py`。
- 改了查看器的纯函数层，提交前运行 `node tools/check_viewer.mjs`。
- 一个 commit 只做一件事；提交说明写清动机。
- `community-mcp/` 是已归档的社区实现，只作参考，不在版本库里。
