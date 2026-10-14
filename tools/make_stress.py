#!/usr/bin/env python3
"""Generate a stress-test research folder for the research sea viewer.

Usage:
    python3 tools/make_stress.py <out-dir>
    python3 mobbin-research/scripts/build_web.py <out-dir>
    python3 -m http.server 4318 --directory <out-dir>

Covers the edge cases the viewer must survive: 160 screens, 14 patterns
(some with long names), long notes and insights, a 25-step trail (screen 25),
one screen with 12 echoes (screen 25), many open and empty leads, and a very
long product title. build_web.py is expected to print warnings for it.
Keep <out-dir> outside the repository or in an ignored folder.
"""

import copy
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "mobbin-research/examples/research-web-demo"

NAMES = ["安全评分圆环", "风险分级色彩与文字双重编码在暗色模式下的表现", "扫描过程可视化", "单一主操作",
         "渐进式权限引导", "防护开关矩阵", "家庭共享与多设备管理", "数据泄露监测时间线", "VPN 连接状态的极简表达",
         "付费墙与套餐对比", "空状态插画", "通知与警报中心的分级", "隐私报告周报", "威胁详情的人话翻译"]


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if not (out / "screens").exists():
        (out / "screens").symlink_to(DEMO / "screens")

    random.seed(5)
    d = json.loads((DEMO / "research.json").read_text(encoding="utf-8"))
    pats = [{"id": f"p{i}", "name": n, "summary": "这是一个用来压测的模式说明。" * (3 if i % 3 == 0 else 1),
             "common": "共性说明。" * 12, "forks": "分叉说明。" * 20, "exceptions": "例外说明。" * 6} for i, n in enumerate(NAMES)]
    base, screens = d["screens"], []
    for i in range(160):
        b = copy.deepcopy(base[i % 100])
        b["id"] = i + 1
        k = random.randrange(14)
        b["patterns"] = [f"p{k}"] + ([f"p{(k + 1) % 14}"] if random.random() < .35 else [])
        if i % 7 == 0:
            b["why_saved"] = "这是一段很长的 Agent 笔记，用来测试卡片内滚动和渐隐效果。它会反复比较前后几张图的差异，记录当时的判断依据。" * 4
        if i % 9 == 0:
            b["insight"] = "这是一条很长的洞察，用于压测。" * 12
        b["found_via"] = None
        screens.append(b)

    leads = []
    for i in range(2, 26):  # 25 步长链：1 → 2 → … → 25
        lid = f"L{len(leads) + 1}"
        leads.append({"id": lid, "from": i - 1, "kind": "app", "text": f"第 {i} 步：顺着上一张图继续找",
                      "reason": "压测用的理由，写得稍微长一点，看看换行和截断是否正常。", "status": "done"})
        screens[i - 1]["found_via"] = lid
    for s in screens[25:]:
        lid = f"L{len(leads) + 1}"
        leads.append({"id": lid, "from": random.randint(1, s["id"] - 1), "kind": "pattern", "text": "压测线索", "reason": "压测", "status": "done"})
        s["found_via"] = lid
    for j in range(15):
        leads.append({"id": f"L{len(leads) + 1}", "from": random.randint(1, 160), "kind": "pattern",
                      "text": f"未走过的线索 {j}", "reason": "压测", "status": random.choice(["open", "empty"])})

    d.update(
        patterns=pats, screens=screens, leads=leads,
        echoes=[{"a": 25, "b": x, "kind": random.choice(["echo", "contrast"]), "note": "压测用的呼应说明，和 #025 形成对照或呼应。" * 2}
                for x in random.sample(range(26, 160), 12)],
        insights=[{"id": f"I{i}", "text": "很长的洞察句子。" * (8 if i % 2 else 2), "evidence": random.sample(range(1, 161), 6)} for i in range(12)],
        checkpoints=d["checkpoints"] * 3,
        picks=[{"id": x, "why": "压测"} for x in random.sample(range(1, 161), 24)],
        gaps=d["gaps"] * 4,
    )
    d["brief"]["product"] = "一个名字非常非常长的压测调研主题：手机端网络安全防护与隐私保护类 App 的完整设计参考"
    d["brief"]["target"] = 160
    (out / "research.json").write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    print(f"压测数据 → {out / 'research.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
