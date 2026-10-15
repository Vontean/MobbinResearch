#!/usr/bin/env python3
"""Validate research.json and build the research web viewer.

Usage:
    build_web.py <research-dir>

Reads <research-dir>/research.json, checks references and files, writes
<research-dir>/research.js for the viewer, and copies the viewer
(index.html plus the viewer/ folder) into <research-dir>. The viewer is a
template, so it is replaced on every build.

Exit codes: 0 when there are no errors (warnings allowed), 1 otherwise.
"""

import hashlib
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

VIEWER = Path(__file__).resolve().parent.parent / "assets" / "web-viewer"
RINGS = {"R1", "R2", "R3", "R4"}
LEAD_KINDS = {"app", "pattern", "screen-type"}
LEAD_STATUS = {"open", "done", "empty"}
ECHO_KINDS = {"echo", "contrast"}


def check(data, root):
    errors, warnings = [], []
    brief = data.get("brief", {})
    patterns = {p["id"] for p in data.get("patterns", [])}
    screens = data.get("screens", [])
    screen_ids = [s.get("id") for s in screens]
    leads = {l["id"]: l for l in data.get("leads", [])}
    sid = set(screen_ids)

    for i, d in [(i, c) for i, c in Counter(screen_ids).items() if c > 1]:
        errors.append(f"screen id {i} 重复 {d} 次")
    for s in screens:
        tag = f"screen {s.get('id')}"
        if s.get("ring") not in RINGS:
            errors.append(f"{tag}: ring 必须是 R1–R4")
        if not s.get("patterns"):
            errors.append(f"{tag}: patterns 为空")
        for p in s.get("patterns", []):
            if p not in patterns:
                errors.append(f"{tag}: 未定义的 pattern '{p}'")
        for key in ("app", "screen_type", "insight", "why_saved", "thumb"):
            if not s.get(key):
                errors.append(f"{tag}: 缺少 {key}")
        for key in ("thumb", "image"):
            if s.get(key) and not (root / s[key]).exists():
                errors.append(f"{tag}: 文件不存在 {s[key]}")
        via = s.get("found_via")
        if via is not None and via not in leads:
            errors.append(f"{tag}: found_via 指向不存在的线索 {via}")

    for l in leads.values():
        if l.get("from") is not None and l["from"] not in sid:
            errors.append(f"lead {l['id']}: from 指向不存在的 screen {l['from']}")
        if l.get("kind") not in LEAD_KINDS:
            errors.append(f"lead {l['id']}: kind 必须是 {sorted(LEAD_KINDS)}")
        if l.get("status") not in LEAD_STATUS:
            errors.append(f"lead {l['id']}: status 必须是 {sorted(LEAD_STATUS)}")
        if l.get("by", "agent") not in ("agent", "designer"):
            errors.append(f"lead {l['id']}: by 必须是 agent 或 designer")
    for e in data.get("echoes", []):
        if e.get("a") not in sid or e.get("b") not in sid:
            errors.append(f"echo {e.get('a')}–{e.get('b')}: 指向不存在的 screen")
        if e.get("kind") not in ECHO_KINDS:
            errors.append(f"echo {e.get('a')}–{e.get('b')}: kind 必须是 echo 或 contrast")
    for ins in data.get("insights", []):
        missing = [x for x in ins.get("evidence", []) if x not in sid]
        if missing:
            errors.append(f"insight {ins.get('id')}: evidence 中不存在的 screen {missing}")
    # 筛选门禁：每次搜索留下的不超过返回的一半；每张图都来自某一次搜索
    in_search = Counter()
    for q in data.get("searches", []):
        tag = f"search {q.get('id', q.get('query'))}"
        saved, returned = q.get("saved", []), q.get("returned")
        if not isinstance(returned, int) or returned < 1:
            errors.append(f"{tag}: returned 必须是这次搜索返回的结果数")
        elif len(saved) * 2 > returned:
            errors.append(f"{tag}: 返回 {returned} 张却留下 {len(saved)} 张；最多留一半，先比较再挑最好的")
        if q.get("lead") is not None and q["lead"] not in leads:
            errors.append(f"{tag}: lead 指向不存在的线索 {q['lead']}")
        for x in saved:
            if x not in sid:
                errors.append(f"{tag}: saved 中不存在的 screen {x}")
            in_search[x] += 1
    for x in screen_ids:
        if in_search[x] != 1:
            errors.append(f"screen {x}: 必须且只能出现在一次搜索的 saved 里（现在 {in_search[x]} 次）")
    # 单 App 上限：每个 App 只留最有代表性的几张
    cap = brief.get("app_cap", 3)
    over = [f"{a}({c})" for a, c in Counter(s.get("app") for s in screens).items() if c > cap]
    if over:
        errors.append(f"超过单 App 上限 {cap}：{'、'.join(over)}；只留最有代表性的 {cap} 张")
    # R3、R4 要走出原来的品类：不能是 R1、R2 里出现过的 App
    near = {s.get("app") for s in screens if s.get("ring") in ("R1", "R2")}
    back = sorted({s.get("app") for s in screens if s.get("ring") in ("R3", "R4") and s.get("app") in near})
    if back:
        errors.append(f"R3/R4 里出现了 R1/R2 的 App：{'、'.join(back)}；R3/R4 要去别的品类找")
    for p in data.get("picks", []):
        if p.get("id") not in sid:
            errors.append(f"pick {p.get('id')}: 不存在的 screen")
    now = data.get("now")
    if now is not None:
        if now.get("lead") is not None and now["lead"] not in leads:
            errors.append(f"now: lead 指向不存在的线索 {now['lead']}")
        if not isinstance(now.get("done", False), bool):
            errors.append("now: done 必须是 true 或 false")

    # 以下是进度提醒，用来判断 Loop 能否结束
    target = brief.get("target")
    if target and len(screens) < target:
        warnings.append(f"进度 {len(screens)}/{target}")
    rings = Counter(s.get("ring") for s in screens)
    for r, q in (brief.get("quotas") or {}).items():
        if abs(rings.get(r, 0) - q) > 2:
            warnings.append(f"{r} 有 {rings.get(r, 0)} 张，配额 {q}")
    types = Counter(s.get("screen_type") for s in screens)
    thin = [t for t in brief.get("screen_types", []) if types.get(t, 0) < 3]
    if thin:
        warnings.append(f"不足 3 张的屏幕类型：{'、'.join(thin)}")
    if not 5 <= len(patterns) <= 8:
        warnings.append(f"模式有 {len(patterns)} 个，建议合并或拆分到 5–8 个")
    return errors, warnings


def guidance(data):
    """构建后的两行指引：下一轮建议去哪一圈；页面上应该看到的数字。"""
    brief, screens = data.get("brief", {}), data.get("screens", [])
    rings, quotas, out = Counter(s.get("ring") for s in screens), brief.get("quotas") or {}, []
    gaps = {r: (q - rings.get(r, 0)) / q for r, q in quotas.items() if q and rings.get(r, 0) < q}
    if gaps:
        r = max(gaps, key=gaps.get)
        out.append(f"建议    下一轮去 {r}（还差 {quotas[r] - rings.get(r, 0)} 张）；有更值得追的线索时，跟着线索走")
    # 与查看器 domain.js 的 complete 一致：有 now 时看 now.done，没有时看是否达到目标数量
    n, target, now = len(screens), brief.get("target"), data.get("now")
    done = not target or (bool(now.get("done")) if now else n >= target)
    shown = f"{n} FRAMES" if done else f"{n:02d} / {target} FRAMES"
    out.append(f"核对    内置浏览器里，左上角应显示「{shown}」（用户正在拖拽时会少几张，末尾的 +N 补齐）")
    return out


def digest(folder):
    h = hashlib.sha1()
    for f in sorted(folder.rglob("*")):
        if f.is_file():
            h.update(f.name.encode()); h.update(f.read_bytes())
    return h.hexdigest()[:8]


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    root = Path(sys.argv[1]).resolve()
    data = json.loads((root / "research.json").read_text(encoding="utf-8"))
    errors, warnings = check(data, root)
    for w in warnings:
        print(f"提醒  {w}")
    for e in errors:
        print(f"错误  {e}")
    if errors:
        return 1
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # 先写临时文件再替换：Loop 进行中页面会反复读取它，不能读到写了一半的文件
    tmp = root / "research.js.tmp"
    tmp.write_text(f"window.RESEARCH = {payload};\n", encoding="utf-8")
    tmp.replace(root / "research.js")
    # 查看器是模板：每次构建都整体替换，已有的调研目录也能拿到最新版本。
    # 地址带上内容版本号：Loop 进行中用户刷新页面时，浏览器不会把缓存里的旧脚本和新脚本混在一起
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'(src|href)="(viewer/[^"?]+)"', rf'\1="\2?v={digest(VIEWER / "viewer")}"', html)
    html = html.replace('src="research.js"', f'src="research.js?v={hashlib.sha1(payload.encode()).hexdigest()[:8]}"')
    (root / "index.html").write_text(html, encoding="utf-8")
    shutil.rmtree(root / "viewer", ignore_errors=True)
    shutil.copytree(VIEWER / "viewer", root / "viewer")
    print(f"完成  {len(data.get('screens', []))} 张图 → {root / 'research.js'}")
    for line in guidance(data):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
