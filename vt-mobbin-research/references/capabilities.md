# Mobbin 工具对照

Mobbin MCP 有多个版本，工具名称和能力各不相同。开始调研前，先看当前环境里有哪些 Mobbin 工具，再按下表把 Loop 的每个动作映射到具体工具。

## 动作 → 工具

| Loop 动作 | 官方 MCP（`search_*`） | 社区版 MCP（`mobbin_*`） | 都没有时 |
|---|---|---|---|
| 查某个 App | `search_screens`，查询词以 App 名开头 | `mobbin_quick_search` 获取 app_id | — |
| 看某个 App 的全部屏幕或流程 | 用"App 名 + 屏幕描述"多次搜索 | `mobbin_get_app_screens` / `mobbin_get_app_flows` | — |
| 按模式全局搜屏 | `search_screens` | `mobbin_search_screens`（可用 `screen_patterns` 过滤） | — |
| 搜多步流程 | `search_flows` | `mobbin_search_flows` | — |
| 搜网站区块 | `search_sections` | — | — |
| 按品类浏览 App | — | `mobbin_search_apps` / `mobbin_popular_apps` | 用 Web 搜索列出 App 名 |
| 看大图 | `scripts/fetch_screen_image.py` | `mobbin_get_screen_detail` | 脚本 |
| 主色板 | `scripts/extract_palette.py` | `mobbin_get_screen_detail` 的颜色提取选项 | 脚本 |
| 存进 Mobbin Collection | 看环境中是否有保存类工具 | `mobbin_list_collections`（只读） | 只在 `research.json` 里记录链接 |

社区版能用 `mobbin_get_filters({ kind: "patterns" })` 查询 Mobbin 官方的模式分类词。这些词可以直接用作扩散线索。

## 官方 MCP 参数

- `search_screens`：`query`（必填）、`platform`（ios/web）、`mode`（deep 为默认，语义匹配）、`limit`、`page`、`exclude_screen_ids`（跨批去重）
- `search_flows`：`query`、`platform`、`limit`、`page`；返回的每条流程包含按顺序排列的屏幕预览
- `search_sections`：`query`、`limit`、`page`

返回结果中的 `image_url` 是预览图（约 299×678）。需要保存或看细节时，用大图。

批量建议：广撒网时 `limit` 设为 15–25，聚焦时设为 10–15，流程搜索设为 3–5。换角度搜索时，把已看过的 id 传给 `exclude_screen_ids`。

## 大图与色板脚本

```bash
python3 scripts/fetch_screen_image.py https://mobbin.com/screens/<id> --out screens/
python3 scripts/extract_palette.py screens/<id>.png --top 6
```

大图（1179×2556 PNG）的地址在屏幕详情页的 `og:image` 中，脚本会自动解析。`fetch_screen_image.py` 只需要 Python 3.9+ 标准库；`extract_palette.py` 需要 Pillow。

## 已知限制

- 官方 MCP 不支持按 app_id 过滤，钻取单个 App 只能靠在查询词里写 App 名。
- 官方 MCP 需要付费计划授权，未认证时返回 401。
- 平台只有 iOS 和 Web 两档。
