# 领域语言

这个仓库做一件事：让 Agent 用 Mobbin 循环调研真实 App 界面，把结果织成一片可浏览的"调研之海"。下面的词在技能文档、数据契约、查看器代码和界面上含义一致。改名时，四处一起改。

## 调研（Agent 的 Loop）

| 术语 | 含义 | 数据 / 代码 |
|---|---|---|
| 调研 Research | 一次完整的 Loop 及其产出 | `research.json`；`domain.createResearch()` |
| 简报 Brief | 产品、用户、调研问题、目标数量、配额 | `brief` |
| 截图 Screen | Agent 保存的一张界面截图；界面上显示为 **Frame** | `screens[]` |
| 圈层 Ring | 截图离直接竞品的远近：R1 直接竞品、R2 间接竞品、R3 结构相似、R4 表达启发 | `ring` |
| 距离 Distance | 圈层的数值形式，1–4；界面上的 Distance 卡片 | `domain.distance(s)` |
| 模式 Pattern | 一种可复用的设计做法，受控词表，5–8 个 | `patterns[]` |
| 线索 Lead | 从一张截图长出的下一步方向，带理由；状态 open / done / empty | `leads[]` |
| 线索链 Trail | 从调研起点沿线索走到某张截图的路径 | `domain.trail(s)` |
| 呼应 / 对照 Echo / Contrast | Agent 主动标注的两张截图之间的关系 | `echoes[]` |
| 此刻 Now | Agent 当前的轮次、正在追的线索和一句话；完成时标记 done | `now` |
| 检查点 Checkpoint | 每满 25% 写下的阶段小结 | `checkpoints[]` |
| 洞察 Insight | 一句可以直接用于设计决策的判断，附证据截图 | `insights[]`；单张截图的 `insight` |
| 笔记 Note | Agent 保存截图时的现场观察（`why_saved`） | `why_saved` |
| 缺口 Gap | 没找到好参考的方向 | `gaps[]` |

## 查看器（调研之海）

| 术语 | 含义 | 代码 |
|---|---|---|
| 海 Sea | 整个画布：点阵海面加漂浮其上的截图 | `render.js` |
| 布局 Layout | 截图在海上的排列：**岛屿 Island**（关系驱动的点阵圆）或 **航道 Lanes**（每个模式一条航道） | `layout.js` |
| 核心 Core | 直接竞品（R1）的重心，入场下潜的落点 | `scene.core` |
| 深度 Depth | 镜头的缩放深浅；右侧深度计。**与 Distance 无关** | `camera.js` |
| 下潜 / 浮上 Dive / Surface | 缩放到沉浸浏览的深度 / 回到全貌 | `camera.diveAt()` / `camera.surface()` |
| 唤醒 Wake | 光标停在一张截图上：相关截图对焦，其余失焦（景深） | `interaction.wake()` |
| 关联 Related | 被唤醒截图最相关的截图，最多 8 张，带关系标签 LEAD / SIBLING / ECHO / CONTRAST / PATTERN / APP | `domain.relatedOf()` |
| 聚焦 Focus | 点击或预判：镜头推到这张截图占画面约 75%，面板出现 | `interaction.focus()` |
| 预判聚焦 | 缩放接近最深、某张截图接近画面中央时，自动聚焦它 | `interaction.beforeDraw()` |
| 松开 Release | 因缩放或拖拽离开聚焦；面板等用户停手后才收起 | `interaction.release()` |
| 离开 Leave | Esc、关闭、点击空白：收起面板，镜头往后拉 | `interaction.leave()` |
| 高亮 Highlight | 一组截图保持清晰：来自模式、洞察或框选 | `interaction.highlight()` |
| 面板 Panel | 右侧的一列卡片；只在聚焦、模式、框选、概览时出现 | `ui.js`、`cards.js` |
| 入场 Entrance | 打开页面时从核心荡开的波，随后自动下潜 | `app.intro` |
| 实时更新 Live | Loop 进行中，页面跟着每次构建长出新图；用户停手时才落地 | `live.js` |
| 生长 / 整理 Grow / Settle | 生长中的岛屿：新图只落进空格子；每个检查点全局整理一次 | `layout.growIsland()` / `layout.settleIsland()` |
