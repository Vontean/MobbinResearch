#!/usr/bin/env python3
"""Replay the demo research as if an agent were running the loop.

    python3 tools/simulate_live.py [out-dir] [--every SECONDS] [--batch N] [--manual]

Writes the demo's research.json into out-dir step by step (brief first, then
N screens per step with their leads, echoes and checkpoints; insights, picks
and gaps at the end) and runs build_web.py after each step. Serve out-dir and
open it to watch the viewer update live. With --manual, each line on stdin
advances one step (tools/record_demo.cjs drives it this way):

    python3 -m http.server 4320 --directory .live-demo
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "mobbin-research/examples/research-web-demo"
BUILD = ROOT / "mobbin-research/scripts/build_web.py"


def snapshot(full, n, done):
    """The research as it would look after the agent saved its first n screens."""
    screens = full["screens"][:n]
    ids = {s["id"] for s in screens}
    used = {s["found_via"] for s in screens if s.get("found_via")}
    leads = []
    for l in full["leads"]:
        if l.get("from") is not None and l["from"] not in ids:
            continue
        status = "done" if l["id"] in used else ("empty" if l["status"] == "empty" else "open")
        leads.append({**l, "status": l["status"] if done else status})
    target = full["brief"].get("target") or len(full["screens"])
    out = {
        **full,
        "screens": screens,
        "leads": leads,
        "echoes": [e for e in full.get("echoes", []) if e["a"] in ids and e["b"] in ids],
        "searches": [{**q, "saved": [x for x in q["saved"] if x in ids]} for q in full.get("searches", []) if any(x in ids for x in q["saved"])],
        "checkpoints": [c for c in full.get("checkpoints", []) if c["at"] <= n * 100 / target],
    }
    # 此刻：正在追下一张图的线索
    nxt = full["screens"][n] if n < len(full["screens"]) else None
    lead = next((l for l in leads if nxt and l["id"] == nxt.get("found_via")), None)
    out["now"] = {"round": n // 3 + 1, "done": done}
    if lead:
        out["now"].update(lead=lead["id"], note=lead["text"])
    if not done:
        out.update(insights=[], picks=[], gaps=[])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default=str(ROOT / ".live-demo"))
    ap.add_argument("--every", type=float, default=2.0, help="seconds between steps")
    ap.add_argument("--batch", type=int, default=3, help="screens saved per step")
    ap.add_argument("--manual", action="store_true", help="advance one step per line on stdin")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(out / "screens", ignore_errors=True)
    shutil.copytree(DEMO / "screens", out / "screens")
    full = json.loads((DEMO / "research.json").read_text(encoding="utf-8"))
    total = len(full["screens"])

    steps = list(range(0, total, args.batch)) + [total]
    for i, n in enumerate(steps):
        done = n == total
        data = snapshot(full, n, done)
        (out / "research.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        subprocess.run([sys.executable, str(BUILD), str(out)], check=True, stdout=subprocess.DEVNULL)
        print(f"{n:>3}/{total}", flush=True)
        if done:
            break
        if args.manual:
            if not sys.stdin.readline():
                break
        else:
            time.sleep(args.every * (2 if i == 0 else 1))


if __name__ == "__main__":
    main()
