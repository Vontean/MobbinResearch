# Mobbin 官方通道能力参考

本文档记录 Mobbin 官方 MCP 通道（Codex 内置插件 `mcp__codex_apps__mobbin_*` 或直连 MCP `mcp__mobbin_*`）提供的命令、参数与返回结构，以及配套脚本的用法。执行调研时按需查阅。

## 命令

### search_screens — 搜索屏幕

参数：`query`（自然语言，必填）、`platform`（ios/web）、`mode`（standard/deep/fast，deep 为默认语义匹配）、`limit`、`exclude_screen_ids`（去重）、`image_format`、`page`。

返回：`screens[]`，每项含 `id`、`image_url`（预览图 ~299×678 webp）、`mobbin_url`、`app_name`、`platform`。

### search_flows — 搜索多步流程

参数：`query`、`platform`、`limit`、`page`、`image_format`。

返回：`flows[]`，每项含 `id`、`name`、`actions[]`、`mobbin_url`、`app_name`、`screen_count`、`screens[]`（按 position 排序的每屏预览）。

### search_sections — 搜索网站区块

参数：`query`、`limit`、`page`、`image_format`。

返回：`sections[]`，每项含 `id`、`image_url`、`mobbin_url`、`site_name`。

## 能力与变通

### 按 App 钻取

命令不提供 app_id 过滤参数，但 `query` 支持 App 名语义过滤：`"{App 名} {组件或流程描述}"`（如 `Notion settings screen with toggles`），返回结果集中在指定 App。

### 完整大图

搜索返回的 `image_url` 是预览图（~299×678）。完整大图（1179×2556 PNG）藏在屏幕详情页 `https://mobbin.com/screens/{screen_id}` 的 `<meta property="og:image" content="...">` 中，其 query 参数 `screenUrl` 即完整大图地址。注意 HTML 中分隔符为 `&amp;` 实体，需先反转义再解析。

已脚本化：`scripts/fetch_screen_image.py <mobbin-url-or-id> [--out DIR]`。

### 主色板

对完整大图缩小采样（64×64）后统计频率，取 Top-N 颜色即为主色板：

```bash
python3 scripts/extract_palette.py screens/<id>.png --top 6
```

已脚本化：`scripts/extract_palette.py`。

## 限制

- 仅自然语言搜索，无结构化筛选词典（patterns/elements/actions）
- 无热门 App 榜、无收藏夹访问
- 无结构化 App 钻取结果（拿不到 app_id 与 App 全量屏幕清单），靠查询词变通
- 直连 MCP 需付费计划授权；未认证请求返回 401

## 脚本

| 脚本 | 用途 | 依赖 |
|---|---|---|
| `scripts/fetch_screen_image.py` | 从屏幕 ID/URL 下载完整大图 | Python 3.9+ 标准库 |
| `scripts/extract_palette.py` | 从图片提取主色板 | Pillow |
