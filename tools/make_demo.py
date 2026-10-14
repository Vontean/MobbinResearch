#!/usr/bin/env python3
"""Generate the mock research.json for the research sea demo.

Usage:
    python3 tools/make_demo.py [out-dir]    # default: mobbin-research/examples/research-web-demo

Writes research.json only; the 20 screenshot crops in screens/ are committed
(see the demo README for their Unsplash sources). Run build_web.py afterwards.
The random seed is fixed, so the output is stable unless this file changes.
"""
import json, random, sys
from pathlib import Path
random.seed(11)
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "mobbin-research/examples/research-web-demo"
P = [
 dict(id="score-ring", name="安全评分圆环", summary="用一个分数和一句结论回答「我安全吗」",
  common="分数居中放大，下方一句结论，再下方是待处理事项列表。",
  forks="有的用 0–100 数字，有的只用三档文字等级；R3 健康类更倾向文字等级。",
  exceptions="Credit Karma 把分数变化趋势放在分数旁边，比单个分数更能说明「在变好还是变坏」，是亮点。"),
 dict(id="severity-color", name="风险分级色彩", summary="颜色加文字双重编码风险等级",
  common="红、黄、绿三档，配合图标和等级文字。",
  forks="有的整卡染色，有的只染左侧色条；整卡染色在暗色模式下噪声更大。",
  exceptions="Lookout 用「需要你处理 / 已自动处理」代替严重度，直接回答用户要不要行动。"),
 dict(id="scan-progress", name="扫描过程可视化", summary="让等待变得可理解",
  common="环形或雷达动效加百分比，下方滚动显示正在检查的对象。",
  forks="有的只显示百分比，有的列出已发现的问题数，实时增长。",
  exceptions="Strava 的路线回放式进度给了启发：把扫描对象画成路径，而不是一个百分比。"),
 dict(id="single-cta", name="单一主操作", summary="每屏只有一个最显眼的下一步",
  common="底部一个满宽主按钮，次要操作降级为文字链接。",
  forks="付费墙里有的把「试用」设为主按钮，有的把「继续免费版」藏得很深。",
  exceptions="Opal 的主按钮文案会随状态变化，按钮本身就是状态说明。"),
 dict(id="permission-guide", name="渐进式权限引导", summary="在需要时才请求权限，并先解释价值",
  common="先用一屏插画说明价值，再弹出系统权限框。",
  forks="有的一次性请求全部权限，有的按功能逐个请求；后者的授权率普遍更高。",
  exceptions="Life360 用家人头像说明为什么需要定位，把权限变成了情感理由。"),
 dict(id="protection-toggles", name="防护开关矩阵", summary="把多个防护能力组织成可控的开关集合",
  common="按能力分组的列表，每行一个开关和一句说明。",
  forks="有的用卡片网格，有的用列表；卡片网格更适合展示状态，列表更适合批量操作。",
  exceptions="Cloudflare 1.1.1.1 把所有防护收敛成一个大开关，复杂度全部藏到第二层。"),
]
# 每个 App 最多 3 张（与 build_web.py 的单 App 上限一致），所以每圈的 App 要够多
APPS = {
 "R1": ["Norton 360","Bitdefender","McAfee","Avast","Kaspersky","Lookout","Malwarebytes","ESET","Trend Micro","Sophos","F-Secure"],
 "R2": ["1Password","NordVPN","Surfshark","Aura","Life360","Authy","DuckDuckGo","Bitwarden","Proton VPN","Dashlane","Google Authenticator"],
 "R3": ["Oura","Credit Karma","Ring","Whoop","SimpliSafe","Apple Health","Cloudflare","Vercel","Monzo","Tesla","Nest","Eight Sleep","Arlo"],
 "R4": ["Headspace","Carrot Weather","Duolingo","Strava","Calm","Gentler Streak","Opal","Things","Flighty","Endel"],
}
QUOTA = {"R1":25,"R2":25,"R3":30,"R4":20}
TYPES = ["首页总览","扫描进行中","扫描结果·安全","发现风险","功能入口","防护开关","警报中心","安全报告","权限引导","付费墙","空状态"]
TYPE_PAT = {"首页总览":"score-ring","扫描进行中":"scan-progress","扫描结果·安全":"score-ring","发现风险":"severity-color",
 "功能入口":"protection-toggles","防护开关":"protection-toggles","警报中心":"severity-color","安全报告":"score-ring",
 "权限引导":"permission-guide","付费墙":"single-cta","空状态":"single-cta"}
INS = {
 "score-ring":["分数下方紧跟一句人话结论，用户不需要理解分数就知道该不该担心","把待处理事项挂在分数下面，分数就成了任务入口","用分数的变化趋势代替单个分数，能回答「在变好还是变坏」","圆环只在异常时变色，平时保持中性，避免持续制造焦虑"],
 "severity-color":["颜色之外还有等级文字和图标，色弱用户也能分辨风险","风险卡片的第一行写「需要你做什么」，而不是威胁名称","同一屏最多一种高危色，其余降为中性色，焦点不会被稀释","已处理的风险折叠到底部，保留成就感又不占注意力"],
 "scan-progress":["滚动显示正在检查的具体对象，让等待有内容","扫描中实时累加已发现的问题数，用户提前知道结果的走向","进度动效和品牌隐喻绑定（雷达、盾牌），等待也在建立信任","允许在扫描时离开，完成后用通知召回"],
 "single-cta":["主按钮文案描述结果（「修复 3 个问题」）而不是动作（「下一步」）","次要操作降级为文字链接，主次一眼可辨","付费墙把免费版的出口放在可见位置，反而提升了信任","主按钮的状态随上下文变化，按钮即状态说明"],
 "permission-guide":["先用一屏说明价值，再弹系统权限框，授权率更高","按功能逐个请求权限，每次只解释一件事","拒绝权限后给出降级方案，而不是死路","用真实场景插画解释为什么需要这个权限"],
 "protection-toggles":["每个开关旁一句「开启后会发生什么」，降低误操作","把防护能力按威胁类型分组，而不是按技术模块","关闭关键防护时用二次确认并说明风险","高级设置收进第二层，第一层只保留一个总开关"],
}
WHY = [
 "- 对比：和 #{p} 讲的是同一件事\n- 发现：这张把状态和下一步压缩进了一屏\n- 判断：信息密度更合适，保存这张",
 "- 对比：{a} 里同类屏还有两张\n- 发现：只有这张把状态和下一步放在一起\n- 判断：是 {a} 里最完整的一张",
 "- 对比：#{p} 用了三层信息\n- 发现：这里只保留了一层\n- 判断：#{p} 的做法还能再简化，这张是证据",
 "- 对比：结构和 #{p} 几乎一样\n- 发现：情绪完全不同，一个紧张、一个平静\n- 判断：值得作为对照保存",
 "- 发现：目前唯一没有用红色表达风险的例子\n- 判断：可以验证中性色是否足够传达风险",
 "- 对比：#{p} 里用户不知道下一步做什么\n- 发现：这张用一个主按钮解决了这个问题\n- 判断：保存，作为单一主操作的正例",
]
LEAD_T = {"app":["看 {x} 的同类屏","去 {x} 找对照"],"pattern":["搜 {x} 的其他做法","{x} 在别的品类里怎么表达"],"screen-type":["搜更多「{x}」"]}
REASON = ["{a} 的{n}很像{x}的结构","这里的{n}做法值得找更多变体","{a} 用{n}解决了同一个焦虑问题","想看{n}在非安全类产品里的样子"]
screens, leads, used = [], [], {r:{} for r in APPS}
ring_left = dict(QUOTA)
def pick_app(ring):
    c = [a for a in APPS[ring] if used[ring].get(a,0) < 3]
    a = random.choice(c); used[ring][a] = used[ring].get(a,0)+1; return a
def img_for(pat, n):
    src = [p["id"] for p in P].index(pat) % 5
    v = src*4 + (n % 4) + 1
    return f"screens/v{v:02d}_thumb.jpg", f"screens/v{v:02d}.jpg"
def add_screen(ring, pat, via, rnd, parent=None, app=None):
    sid = len(screens)+1
    st = random.choice([t for t,p in TYPE_PAT.items() if p==pat] + random.sample(TYPES,2))
    pats = [pat] + ([random.choice([p["id"] for p in P if p["id"]!=pat])] if random.random()<.38 else [])
    if app: used[ring][app] = used[ring].get(app,0)+1
    app = app or pick_app(ring); th, im = img_for(pat, sid)
    w = random.choice(WHY).format(p=parent or max(1,sid-3), a=app)
    screens.append(dict(id=sid, app=app, ring=ring, screen_type=st, patterns=pats, insight=random.choice(INS[pat]),
        why_saved=w, thumb=th, image=im, source_url=f"https://mobbin.com/screens/demo-{sid:03d}", round=rnd, found_via=via))
    ring_left[ring]-=1; return sid
# seeds
for i,a in enumerate(["Norton 360","Bitdefender","Lookout","McAfee","1Password","Oura"]):
    leads.append(dict(id=f"L{i+1}", **{"from":None}, kind="app", text=f"起点：{a}", reason="简报中的起点名单", status="done"))
rnd=1
for i in range(6):
    ring = "R1" if i<4 else ("R2" if i==4 else "R3")
    add_screen(ring, ["score-ring","severity-color","scan-progress","permission-guide","single-cta","score-ring"][i], f"L{i+1}", rnd, app=["Norton 360","Bitdefender","Lookout","McAfee","1Password","Oura"][i])
frontier = list(range(1,7))
while len(screens) < 100:
    rnd += 1
    for parent in frontier[:]:
        if len(screens) >= 100: break
        ps = screens[parent-1]
        order = ["R1","R2","R3","R4"]; pi = order.index(ps["ring"])
        cands = [order[min(3,pi+1)], ps["ring"], order[max(0,pi-1)]] if random.random()<.7 else [order[min(3,pi+2)]]
        ring = next((r for r in cands if ring_left[r]>0), None) or max(ring_left, key=ring_left.get)
        if ring_left[ring] <= 0: continue
        kind = random.choice(["app","pattern","pattern","screen-type"])
        cnt = {p["id"]: sum(1 for x in screens if x["patterns"][0]==p["id"]) for p in P}
        pat = ps["patterns"][0] if random.random()<.55 and cnt[ps["patterns"][0]] < 22 else min(cnt, key=cnt.get)
        pname = next(p["name"] for p in P if p["id"]==pat)
        x = random.choice(APPS[ring]) if kind=="app" else (pname if kind=="pattern" else ps["screen_type"])
        lid = f"L{len(leads)+1}"
        leads.append({"id":lid,"from":parent,"kind":kind,"text":random.choice(LEAD_T[kind]).format(x=x),
            "reason":random.choice(REASON).format(a=ps["app"],n=pname,x=x),"status":"done"})
        for _ in range(random.choice([1,1,2,2,3])):
            if len(screens)>=100 or ring_left[ring]<=0: break
            frontier.append(add_screen(ring, pat, lid, rnd, parent))
        frontier.remove(parent)
    if not frontier: frontier = random.sample(range(1,len(screens)+1), 4)
for i in range(5):
    p = random.choice(screens)
    leads.append({"id":f"L{len(leads)+1}","from":p["id"],"kind":"pattern","text":"搜 shield metaphor illustration","reason":f"{p['app']} 的盾牌隐喻可能还有更好的表达","status":random.choice(["open","empty"])})
# 设计师在聊天里给过两次引导：Agent 把它们变成了线索，理由写设计师的原话
# 挑分别通向 R4 和 R3 图的线索中最晚出现的一条，让引导的内容和它找到的图对得上
def steer_lead(ring):
    hits = [s for s in screens if s["ring"] == ring and next(l for l in leads if l["id"] == s["found_via"])["from"]]
    return next(l for l in leads if l["id"] == max(hits, key=lambda s: s["id"])["found_via"])
for ring, words in [("R4", "多看看用温和语气表达状态的产品，别都是警报式的"), ("R3", "主操作只留一个的做法，去别的品类找找")]:
    steer_lead(ring).update(by="designer", reason=words)
echoes=[]
for _ in range(22):
    a = random.choice(screens); same=[s for s in screens if s["id"]!=a["id"] and s["patterns"][0]==a["patterns"][0] and s["ring"]!=a["ring"]]
    if not same: continue
    b = random.choice(same); k = random.choice(["echo","echo","contrast"])
    note = (f"{a['app']} 和 {b['app']} 都用{next(p['name'] for p in P if p['id']==a['patterns'][0])}，但一个面向焦虑、一个面向习惯养成" if k=="contrast"
            else f"和 #{b['id']} 同样的结构，换到了{b['ring']}的语境里依然成立")
    echoes.append(dict(a=a["id"],b=b["id"],kind=k,note=note))
# 搜索记录：同一条线索找到的图算一次搜索；返回的结果数至少是留下的两倍（筛选门禁）
searches = []
for s in screens:
    q = next((q for q in searches if q["lead"] == s["found_via"]), None)
    if not q:
        lead = next(l for l in leads if l["id"] == s["found_via"])
        q = dict(id=f"S{len(searches)+1}", round=s["round"], lead=lead["id"], query=lead["text"], returned=0, saved=[]); searches.append(q)
    q["saved"].append(s["id"])
for q in searches: q["returned"] = len(q["saved"]) * 2 + 2 + int(q["id"][1:]) % 7
by = lambda pid: [s["id"] for s in screens if pid in s["patterns"]]
data = dict(version=1,
 brief=dict(product="手机端网络安全防护 App", users="不懂技术的普通消费者，只想知道「我安全吗」和「我要做什么」",
   questions=["怎样一眼回答「我安全吗」？","发现风险时，怎样引导用户行动而不制造恐慌？","B 端安全能力怎样翻译给普通人？"],
   platform="ios", target=100, date="2026-10-14", quotas=QUOTA, screen_types=TYPES),
 patterns=P, screens=screens, leads=leads, searches=searches, echoes=echoes,
 checkpoints=[
  dict(at=25, round=4, note="- 模式：R1 的首页几乎都是「分数 + 列表」，同质化很高\n- 不足：风险卡片普遍只靠红色表达严重度；扫描中的屏幕只有百分比", next="去 R3 的健康评分类产品看分数的其他表达方式。"),
  dict(at=50, round=7, note="- 模式：Oura 和 Credit Karma 用文字等级和趋势代替单个分数，R1 里没有这种思路\n- 分叉：权限引导分成一次性请求和按需请求两种", next="补齐空状态和付费墙，这两类目前不足 3 张。"),
  dict(at=75, round=10, note="- 模式：R4 的 Opal、Gentler Streak 说明状态可以是「温和的」，不一定是「警报式的」\n- 整理：模式从 9 个合并到 6 个", next="找扫描过程的非百分比表达，目前只有 Strava 一个例子。"),
  dict(at=100, round=13, note="- 结构：R1 提供惯例，R3 提供结构上的替代，R4 提供情绪上的替代\n- 空白：「威胁详情」的解释方式还没有好参考", next="下一轮可以专门调研「把技术术语翻译成人话」的屏幕。"),
 ],
 insights=[
  dict(id="I1", text="安全状态用「一句结论 + 一个分数」表达，比罗列功能开关更快回答「我安全吗」", evidence=by("score-ring")[:6]),
  dict(id="I2", text="风险卡片先写「需要你做什么」，再写威胁名称；行动比术语更能降低焦虑", evidence=by("severity-color")[:5]),
  dict(id="I3", text="扫描过程要有内容：显示正在检查的对象和已发现的数量，等待就变成了建立信任的时间", evidence=by("scan-progress")[:5]),
  dict(id="I4", text="权限按需请求、先讲价值，拒绝后给出降级方案，而不是死路", evidence=by("permission-guide")[:4]),
  dict(id="I5", text="防护能力收敛成一个总开关，复杂度放到第二层；B 端能力 C 端化的关键是「先给结论，再给控制」", evidence=by("protection-toggles")[:5]),
 ],
 picks=[dict(id=s["id"], why=f"{s['insight']}。{s['app']} 在这一点上是全网最干净的例子。") for s in random.sample(screens,10)],
 gaps=["威胁详情页：几乎所有产品都直接展示技术名称，没有找到好的「翻译」范例。","Android 平台未覆盖，Mobbin 官方 MCP 只有 iOS 和 Web。","家庭共享场景（为家人管理防护）只找到 Life360 一个参照。"],
)
OUT.mkdir(parents=True, exist_ok=True)
(OUT/"research.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
from collections import Counter
print(len(screens), Counter(s["ring"] for s in screens), len(leads), len(echoes))
