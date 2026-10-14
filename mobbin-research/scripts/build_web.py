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

import json
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
    for e in data.get("echoes", []):
        if e.get("a") not in sid or e.get("b") not in sid:
            errors.append(f"echo {e.get('a')}–{e.get('b')}: 指向不存在的 screen")
        if e.get("kind") not in ECHO_KINDS:
            errors.append(f"echo {e.get('a')}–{e.get('b')}: kind 必须是 echo 或 contrast")
    for ins in data.get("insights", []):
        missing = [x for x in ins.get("evidence", []) if x not in sid]
        if missing:
            errors.append(f"insight {ins.get('id')}: evidence 中不存在的 screen {missing}")
    for p in data.get("picks", []):
        if p.get("id") not in sid:
            errors.append(f"pick {p.get('id')}: 不存在的 screen")

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
    cap = max(3, (target or 0) // 20)
    over = [f"{a}({c})" for a, c in Counter(s.get("app") for s in screens).items() if c > cap]
    if over:
        warnings.append(f"超过单 App 上限 {cap}：{'、'.join(over)}")
    return errors, warnings


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
    (root / "research.js").write_text(f"window.RESEARCH = {payload};\n", encoding="utf-8")
    # 查看器是模板：每次构建都整体替换，已有的调研目录也能拿到最新版本
    shutil.copy(VIEWER / "index.html", root / "index.html")
    shutil.rmtree(root / "viewer", ignore_errors=True)
    shutil.copytree(VIEWER / "viewer", root / "viewer")
    print(f"完成  {len(data.get('screens', []))} 张图 → {root / 'research.js'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
