# research.json 数据契约

`research.json` 是一次调研的**唯一事实来源**。查看器（`index.html`）只读取它，所以 Loop 中的每一步都写进这里。各实体之间只用 id 互相引用。

```jsonc
{
  "version": 1,
  "brief": {
    "product": "手机端网络安全防护 App",
    "users": "不懂技术的普通消费者，只想知道自己是否安全",
    "questions": ["怎样一眼回答「我安全吗」？"],
    "platform": "ios",
    "target": 100,
    "date": "2026-10-14",
    "quotas": { "R1": 25, "R2": 25, "R3": 30, "R4": 20 },
    "screen_types": ["首页总览", "扫描进行中", "发现风险"]
  },
  "patterns": [
    {
      "id": "score-ring",             // 英文 kebab-case，作为 tag 引用
      "name": "评分圆环",
      "summary": "一句话说明这个模式",
      "common": "多数 App 的做法",       // 以下三项在蒸馏时补全
      "forks": "分叉点",
      "exceptions": "例外，以及它是亮点还是坑"
    }
  ],
  "screens": [
    {
      "id": 1,                         // 从 1 递增，与文件名序号一致
      "app": "Norton 360",
      "ring": "R1",                    // R1 | R2 | R3 | R4
      "screen_type": "首页总览",         // 取自 brief.screen_types
      "patterns": ["score-ring"],      // 1–3 个 patterns[].id，第一个是主模式
      "insight": "它对我们的产品有什么启发，一句话",
      "why_saved": "- 对比：和 #003 讲的是同一件事\n- 发现：这张把状态和下一步压缩进了一屏\n- 判断：信息密度更合适，保存这张",
      "thumb": "screens/001_R1_Norton360_dashboard_thumb.jpg",
      "image": "screens/001_R1_Norton360_dashboard.png",
      "source_url": "https://mobbin.com/screens/...",
      "round": 1,                      // 第几轮保存的
      "found_via": "L1"                // leads[].id；来自起点名单时为 null
    }
  ],
  "leads": [
    {
      "id": "L1",
      "from": 1,                       // 从哪张图长出来；起点线索为 null
      "kind": "app",                   // app | pattern | screen-type
      "text": "看 Oura 的评分页",
      "reason": "Norton 的安全分和 Oura 的准备度分是同一种结构",
      "status": "done"                 // open | done | empty（Mobbin 无结果）
    }
  ],
  "echoes": [
    { "a": 14, "b": 3, "kind": "echo", "note": "同样用圆环表达分数，但把数字换成了文字等级" }
                                       // kind: echo（呼应）| contrast（对照）
  ],
  "checkpoints": [
    { "at": 25, "round": 6, "note": "- 模式：……\n- 不足：……", "next": "下一阶段往哪里扩散" }
  ],
  "insights": [
    { "id": "I1", "text": "一句可以直接用于设计决策的判断", "evidence": [1, 14, 33] }
  ],
  "picks": [ { "id": 14, "why": "最值得深挖的理由，2–3 句" } ],
  "gaps": ["没找到好参考的方向，以及下一轮怎么补"]
}
```

## 写作要点

- **patterns 是受控词表。** 先复用已有的 id，确实是新做法时才新建。每个检查点合并同义项，保持 5–8 个。查看器把每个模式画成同心圆上的一个扇区，模式太多，扇区就会碎掉。
- **每张图都要能追溯来源**：`found_via` 指向一条线索，线索的 `from` 指向长出它的那张图。网上的连线就是这样还原出来的。
- **`why_saved` 是 Agent 的现场思考**，写当时的比较和判断，而不是复述 insight。

### 结构化笔记

`why_saved`、`checkpoints[].note`、`patterns` 的 `common` / `forks` / `exceptions` 和 `gaps` 写成要点，而不是一整段话。每条要点一行，以 `- ` 开头，格式为 `标签：内容`，标签不超过 8 个字。查看器会把它们排成列表，并加粗标签。

| 字段 | 要点结构 | 示例 |
|---|---|---|
| `why_saved` | 对比 / 发现 / 判断，2–3 条；没有比较对象时可省略"对比" | `- 对比：和 #003 讲的是同一件事`<br>`- 发现：这张把状态和下一步压缩进了一屏`<br>`- 判断：信息密度更合适，保存这张` |
| `checkpoints[].note` | 模式 / 不足（或分叉、空白）各一条，下一步写在 `next` 里 | `- 模式：R1 的首页几乎都是「分数 + 列表」`<br>`- 不足：扫描中的屏幕只有百分比` |
| `patterns` 三段与 `gaps` | 一条一个观点；只有一个观点时写一句话即可，不必加 `- ` | — |

每条要点只说一件事，控制在一行读完；`insight` 和 `echoes[].note` 仍然是一句完整的判断，不拆分。
- **echoes 是你主动写的关联。** 保存新图时，如果它和某张已存的图在呼应或形成对照，就写一条。查看器里，它的权重比自动计算出的关系更高。
- `thumb` 用 Mobbin 搜索返回的预览图（约 300px 宽），用于画布显示；`image` 用大图，用于面板显示。没有大图时，两者可以指向同一个文件。

## 构建与校验

```bash
python3 scripts/build_web.py <调研目录>
```

脚本会做三件事：校验 id 引用和图片文件；把数据写成 `research.js`（浏览器直接打开本地文件时读不了 JSON，所以要转成 JS）；如果目录里还没有 `index.html`，就复制一份查看器过去。

- **错误**（引用断裂、文件缺失、字段不合法）：退出码为 1，需要先修复再继续。
- **提醒**（配额、屏幕类型覆盖、模式数量、单 App 上限）：只列出差距，用来判断 Loop 是否可以结束。

运行环境里没有 Python 时，直接写 `research.js`，内容为 `window.RESEARCH = <research.json 的内容>;`。
