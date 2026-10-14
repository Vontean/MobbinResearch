// 第 5 层：界面外壳。标题、HUD、深度计、工具栏、布局开关、模式索引、面板与说明提示
(function (Sea) {
  "use strict";

  function create(app) {
    const { config, util, camera, stage } = app, { esc, pad, clamp } = util, glyph = Sea.glyph;
    const REDUCED = config.reduced, $ = id => document.getElementById(id);
    const ix = () => app.interaction;
    const segs = (n, on) => `<span class="segs">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</span>`;
    let panelMode = null, panelArg = null;

    document.querySelectorAll(".glyph[data-g]").forEach(el => { el.outerHTML = glyph(el.dataset.g); });

    // ---------- 标题 ----------
    function syncMast() {
      const { data, screens, target, complete } = app.research, brief = data.brief || {};
      const frames = app.view.live && !complete ? `${pad(screens.length, 2)} / ${target} frames` : `${screens.length} frames`;
      document.querySelector("#masthead .title").textContent = brief.product || "Research";
      $("mast-sub").textContent = `${frames} · ${data.patterns.length} patterns${brief.date ? " · " + brief.date : ""}`;
      document.title = (brief.product || "Research") + " · Research Sea";
    }

    // ---------- Agent 此刻：第几轮、在追哪条线索、还有几张图等着落地 ----------
    const mastNow = $("mast-now");
    let nowKey = "";
    function drawNow() {
      const data = app.live.latest, now = data.now, more = app.live.pendingCount;
      const on = app.view.live && now && !now.done;
      const lead = on && now.lead ? (data.leads || []).find(l => l.id === now.lead) : null;
      const say = on ? now.note || (lead && lead.text) || "" : "";
      const key = on ? `${now.round}|${say}|${more}` : "";
      if (key === nowKey) return; nowKey = key;
      mastNow.innerHTML = on ? `<i class="gaze"></i><span>Round ${pad(now.round || 0, 2)}</span><span class="say">${esc(say)}</span>${more > 0 ? `<span class="more">+${more}</span>` : ""}` : "";
    }

    // ---------- HUD：光标下是什么 ----------
    const hudMeta = $("hud-meta"), hudLine = $("hud-line");
    let hudKey = "";
    function drawHud() {
      const { state: st, hoverTile, hoverLead } = ix();
      const s = hoverTile || st.woken, L = hoverLead ? hoverLead.L : null;
      const key = s ? `s${s.id}${st.woken === s}` : L ? `l${L.lead.id}` : "idle";
      if (key === hudKey) return; hudKey = key;
      if (s) {
        const n = st.woken === s ? st.related.length : null;
        hudMeta.innerHTML = `<span style="color:var(--text-primary)">Frame ${pad(s.id)}</span><span>Distance</span>${segs(4, app.research.distance(s))}${n != null ? `<span>${pad(n, 2)} related</span>` : ""}`;
        hudLine.textContent = `${s.app} — ${s.screen_type} · ${s.patterns.map(p => app.research.patternById.get(p)?.name || p).join(" / ")}`;
      } else if (L) {
        hudMeta.innerHTML = `<span style="color:var(--utility-orange)">${L.lead.status === "open" ? "Open lead" : "Empty lead"}</span><span>From frame ${pad(L.lead.from)}</span>`;
        hudLine.textContent = L.lead.text + (L.lead.reason ? ` — ${L.lead.reason}` : "");
      } else {
        hudMeta.innerHTML = [["drift", "Drift"], ["dive", "Dive"], ["relate", "Relate"], ["focus", "Focus"]].map(([g, t]) => `<span class="key">${glyph(g)}${t}</span>`).join("");
        hudLine.textContent = "";
      }
    }

    // ---------- 深度计：缩放深浅（与 Distance 无关） ----------
    const gauge = $("gauge");
    gauge.innerHTML = Array.from({ length: 14 }, () => "<i></i>").join("") + "<span>Depth</span>";
    const ticks = [...gauge.querySelectorAll("i")];
    let gaugeOn = -1;
    function syncDepth() {
      const fk = camera.fitTarget().k, lv = Math.round(clamp(Math.log(camera.state.k / (fk * .8)) / Math.log(camera.maxK() / (fk * .8)), 0, 1) * ticks.length);
      if (lv !== gaugeOn) { gaugeOn = lv; ticks.forEach((t, i) => t.classList.toggle("on", ticks.length - 1 - i < lv)); }
    }

    // ---------- 工具栏：面板出现时滑到屏幕左侧 ----------
    const toolsEl = $("tools");
    function syncTools() { toolsEl.style.transform = panelMode ? `translateX(${-(camera.view.W - toolsEl.offsetWidth - 48)}px)` : ""; }
    $("t-insight").onclick = () => ix().toggleOverview();
    $("t-replay").onclick = () => { ix().leave(); app.intro.stop(); camera.fit(true); app.intro.start(); };

    // ---------- 布局开关 ----------
    function syncSwitch() {
      document.querySelectorAll("#switch .seg").forEach(g => g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", app.view[g.dataset.key] === b.dataset.v)));
      app.url.set("layout", app.view.layout); app.url.set("fx", null);
    }
    document.querySelectorAll("#switch .seg button").forEach(b => b.addEventListener("click", () => {
      const key = b.closest(".seg").dataset.key;
      if (app.view[key] === b.dataset.v) return;
      app.view[key] = b.dataset.v; syncSwitch();
      if (key === "layout") { ix().leave(); app.intro.stop(); stage.apply(true); setTimeout(() => camera.surface(), 250); }
    }));

    // ---------- 模式索引：右下角，可原地滚动 ----------
    const indexEl = $("index"), indexMore = $("index-more");
    function buildIndex() {
      const research = app.research;
      const byCount = research.data.patterns.map(p => ({ p, ids: new Set(research.membersOf(p.id).map(s => s.id)) })).sort((a, b) => b.ids.size - a.ids.size);
      const maxN = Math.max(1, ...byCount.map(x => x.ids.size));
      indexEl.replaceChildren(...byCount.map(({ p, ids }) => {
        // 分段条最多 16 段，按比例缩放，避免数量悬殊时撑得过长
        const n = Math.max(1, Math.round(ids.size / maxN * 16));
        const b = document.createElement("button");
        b.className = "idx"; b.dataset.pid = p.id; b.title = `${p.name} · ${ids.size}`;
        b.innerHTML = `<span class="name">${esc(p.name)}</span>${segs(n, n)}`;
        b.addEventListener("pointerenter", () => { if (!panelMode) { ix().wake(null); ix().highlight(ids); } });
        b.addEventListener("pointerleave", () => { if (!panelMode) ix().highlight(null); });
        b.addEventListener("click", () => ix().openPattern(p.id));
        return b;
      }));
      syncIndex(); requestAnimationFrame(syncIndexScroll);
    }
    // 下方还有内容时，显示一个向下的点阵箭头
    indexMore.innerHTML = glyph("down");
    const syncIndexScroll = () => { syncClip(indexEl); indexMore.classList.toggle("on", indexEl.classList.contains("fade-b")); };
    indexEl.addEventListener("scroll", syncIndexScroll, { passive: true });
    indexMore.addEventListener("click", () => indexEl.scrollBy({ top: 66, behavior: REDUCED ? "auto" : "smooth" }));
    const syncIndex = () => indexEl.querySelectorAll(".idx").forEach(b => b.classList.toggle("is-on", panelMode === "pattern" && panelArg === b.dataset.pid));

    // 有被截断的内容时才显示渐隐：上方有内容露出顶部渐隐，下方有内容露出底部渐隐
    function syncClip(el) {
      el.classList.toggle("fade-t", el.scrollTop > 2);
      el.classList.toggle("fade-b", el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    }

    // 卡片内滚动条：只在滚动时出现；停手一会儿，或光标离开卡片，就淡出
    function scrollbar(el) {
      const bar = document.createElement("span"), thumb = document.createElement("i");
      bar.className = "sbar"; bar.append(thumb); el.after(bar);
      const card = el.closest(".card");
      let hideT = 0;
      const hide = delay => { clearTimeout(hideT); hideT = setTimeout(() => bar.classList.remove("on"), delay); };
      card.addEventListener("mouseleave", () => hide(config.scrollbar.leave));
      return () => {
        const h = el.clientHeight, th = Math.max(config.scrollbar.minThumb, h * h / el.scrollHeight);
        bar.style.top = el.offsetTop + "px"; bar.style.height = h + "px";
        thumb.style.height = th + "px";
        thumb.style.transform = `translateY(${(h - th) * el.scrollTop / Math.max(1, el.scrollHeight - h)}px)`;
        bar.classList.add("on"); hide(config.scrollbar.idle);
      };
    }

    // ---------- 说明提示：悬停或键盘聚焦 120ms 后出现；刚关闭 0.6 秒内移到相邻图标立即显示 ----------
    const tip = $("tip");
    let tipT = 0, tipWarm = 0;
    function showTip(el) {
      clearTimeout(tipT);
      tipT = setTimeout(() => {
        tip.innerHTML = Sea.cards.tipHTML(Sea.cards.TIPS[el.dataset.tip]);
        const r = el.getBoundingClientRect(), w = Math.min(260, innerWidth - 24);
        tip.style.left = clamp(r.left - 12, 12, innerWidth - w - 12) + "px"; tip.style.top = r.bottom + 8 + "px";
        tip.classList.add("on"); tipWarm = performance.now();
      }, performance.now() - tipWarm < 600 ? 0 : 120);
    }
    function hideTip() { clearTimeout(tipT); if (tip.classList.contains("on")) tipWarm = performance.now(); tip.classList.remove("on"); }

    // ---------- 面板 ----------
    const panel = $("panel"), body = $("panel-body");
    const panelInset = config.panel.width + config.panel.gap;
    panel.addEventListener("scroll", hideTip, { passive: true });
    const renderPanel = (mode, arg) => { const cards = Sea.cards.create(app.research); return mode === "screen" ? cards.screen(arg, ix().state.related) : cards[mode](arg); };

    function openPanel(mode, arg) {
      ix().cancelClose(); hideTip();
      if (mode !== "screen") document.body.classList.remove("focused");
      const was = panelMode;
      panelMode = mode; panelArg = arg;
      if (!was) camera.setInset(panelInset);
      $("t-insight").setAttribute("aria-pressed", mode === "overview");
      syncIndex();
      const html = renderPanel(mode, arg);
      if (!was) {
        panel.style.display = "block"; document.body.classList.add("panel-open"); syncTools();
        body.innerHTML = html; bind(); panel.scrollTop = 0; slam();
      } else {
        const out = body.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(2px)" }], { duration: 110, easing: "ease-out", fill: "forwards" });
        out.onfinish = () => { body.innerHTML = html; bind(); panel.scrollTop = 0; out.cancel(); slam(); };
      }
    }
    function closePanel() {
      hideTip();
      if (!panelMode) return;
      panelMode = null; panelArg = null; syncIndex();
      camera.setInset(0);
      $("t-insight").setAttribute("aria-pressed", "false");
      document.body.classList.remove("panel-open"); syncTools();
      const a = panel.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(14px)" }], { duration: 200, easing: "cubic-bezier(.4,0,.2,1)" });
      a.onfinish = () => { if (!panelMode) panel.style.display = "none"; };
    }
    // 卡片依次砸下再稳住
    function slam() {
      [...body.children].forEach((el, i) => el.animate(
        REDUCED ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(22px) scale(.93)" }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: i * 55, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" }));
    }
    // 绑定卡片模板里的 data-* 约定（见 cards.js 顶部）
    function bind() {
      body.querySelectorAll("[data-tip]").forEach(el => {
        el.addEventListener("pointerenter", () => showTip(el)); el.addEventListener("pointerleave", hideTip);
        el.addEventListener("focus", () => showTip(el)); el.addEventListener("blur", hideTip);
      });
      body.querySelectorAll(".clip").forEach(el => { const bar = scrollbar(el); el.addEventListener("scroll", () => { syncClip(el); bar(); }, { passive: true }); requestAnimationFrame(() => syncClip(el)); });
      body.querySelectorAll(".card").forEach(c => {
        const sh = document.createElement("span"); sh.className = "shine"; c.prepend(sh);
        sh.addEventListener("animationend", () => sh.classList.remove("play"));
        c.addEventListener("mouseenter", () => { if (!REDUCED) sh.classList.add("play"); });
      });
      body.querySelectorAll("[data-goto]").forEach(el => el.addEventListener("click", () => ix().focus(app.research.byId.get(+el.dataset.goto))));
      body.querySelectorAll("[data-pattern]").forEach(el => el.addEventListener("click", () => ix().openPattern(el.dataset.pattern)));
      body.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => ix().leave()));
      body.querySelectorAll("[data-insight]").forEach(el => {
        const set = new Set(app.research.data.insights.find(i => i.id === el.dataset.insight).evidence);
        el.addEventListener("pointerenter", () => ix().highlight(set));
        el.addEventListener("pointerleave", () => { if (panelMode === "overview") ix().highlight(null); });
      });
    }

    syncMast(); buildIndex();

    return {
      get panelMode() { return panelMode; },
      openPanel, closePanel, syncTools, syncSwitch,
      // 调研数据更新后：标题与模式索引跟上；打开着的面板不重排，下次打开时用新数据
      refresh() { syncMast(); buildIndex(); },
      tick() { drawHud(); syncDepth(); drawNow(); },
    };
  }

  Sea.ui = Object.freeze({ create });
})(window.Sea = window.Sea || {});
