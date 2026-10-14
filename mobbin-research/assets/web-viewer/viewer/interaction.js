// 第 5 层：交互状态机。把指针、滚轮、键盘翻译成领域动作：唤醒、聚焦、松开、离开、高亮
//   唤醒 wake      停在一张图上：相关图对焦，其余失焦（景深）
//   聚焦 focus     点击或预判：镜头推到这张图，面板出现
//   松开 release   缩放或拖拽导致离开聚焦：面板延迟收起，连续操作期间保持不动
//   离开 leave     Esc、关闭、点击空白：收起面板，镜头往后拉
//   高亮 highlight 模式、洞察或框选：一组图保持清晰，其余失焦
(function (Sea) {
  "use strict";

  function create(app) {
    const { config, util, stage, camera, canvas } = app;
    const F = config.focus, Wk = config.wake, REDUCED = config.reduced;
    const cam = camera.state;
    const marquee = document.getElementById("marquee");

    const state = { woken: null, related: [], relMap: new Map(), focused: false, rippleT: -1, rippleAt: null, highlight: null };
    const ptr = { x: -9999, y: -9999, sx: -9999, sy: -9999, inside: false, speed: 0, wake: 0, lastT: 0 };
    let drag = null, moved = false;
    let hoverTile = null, hoverLead = null, hoverSince = 0, emptySince = 0, near = null;
    let lastInteract = 0, settled = 0, closeT = 0;

    const nodeOf = s => stage.nodeOf.get(s);
    const centerOfRect = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

    // ---------- 命中 ----------
    // 离光标最近的图，范围约一个格子
    function nearest(x, y) {
      if (!ptr.inside || drag) return null;
      const range = config.grid.CY * cam.k * .6;
      let best = null;
      for (const n of stage.nodes) {
        if (!n.rect) continue;
        const c = centerOfRect(n.rect), d = Math.hypot((c.x - x) * 1.6, c.y - y);
        if (d < range && (!best || d < best.d)) best = { s: n.s, d };
      }
      return best;
    }
    function hit(x, y) {
      let best = null;
      for (const n of stage.nodes) { const r = n.rect; if (r && x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2 && (!best || r.w > best.rect.w)) best = n; }
      return best && best.s;
    }

    // ---------- 领域动作 ----------
    function wake(s) {
      // 从一张图切到另一张时，直接在现有明暗上过渡，不重新扩散，避免已失焦的图先亮再暗
      const switching = !!(state.woken && s);
      state.woken = s;
      state.related = s ? app.research.relatedOf(s) : [];
      state.relMap = new Map(state.related.map(o => [o.s, o]));
      const n = s && nodeOf(s);
      if (s && n.rect && !state.focused && !switching) { state.rippleT = performance.now(); state.rippleAt = centerOfRect(n.rect); }
      else state.rippleT = -1;
    }

    // 聚焦：镜头推到最深并居中，面板只在这时出现，标题和 HUD 让位
    function focus(s, dur = config.camera.fly.focus) {
      const fresh = !(state.focused && state.woken === s);
      state.highlight = null; state.focused = true;
      if (fresh) { wake(s); app.ui.openPanel("screen", s); }
      document.body.classList.add("focused");
      app.intro.stop(); camera.stopGlide(); settled = lastInteract;
      app.url.set("frame", s.id);
      const n = nodeOf(s);
      camera.fly(camera.centerOn(n.x, n.y, camera.maxK()), dur, util.ease.out);
    }
    function unfocus() { if (state.focused) app.url.set("frame", null); state.focused = false; wake(null); }

    // 松开：由缩放或拖拽引起；只有在用户停手、镜头也静止之后才真正收起
    function release() { unfocus(); scheduleClose(); }
    function scheduleClose() {
      clearTimeout(closeT);
      closeT = setTimeout(() => {
        if (state.focused) return;
        if (camera.flying || camera.gliding || drag || performance.now() - lastInteract < F.closeQuiet) return scheduleClose();
        document.body.classList.remove("focused"); app.ui.closePanel();
      }, F.closeDelay);
    }
    const cancelClose = () => clearTimeout(closeT);

    // 离开：收起面板；如果刚才聚焦着一张图，以它为中心往后拉，停在预判阈值之下，不会立刻被吸回去
    function leave() {
      const was = state.focused ? state.woken : null;
      clearTimeout(closeT); unfocus(); state.highlight = null; document.body.classList.remove("focused"); app.ui.closePanel();
      if (was) {
        const n = nodeOf(was), k = Math.min(cam.tk, camera.maxK() * config.camera.leaveRatio);
        app.intro.stop(); camera.stopGlide();
        camera.fly(camera.centerOn(n.x, n.y, k), config.camera.fly.leave, util.ease.out);
      }
    }
    function highlight(set) { state.highlight = set; }
    // 调研数据更新后：唤醒或聚焦的那张图换成新数据里的同一张，关联随之重算；那张图不在了就离开
    function remap() {
      if (!state.woken) return;
      const s = app.research.byId.get(state.woken.id);
      if (!s) return state.focused ? leave() : wake(null);
      state.woken = s; state.related = app.research.relatedOf(s); state.relMap = new Map(state.related.map(o => [o.s, o]));
    }
    function toggleOverview() { if (app.ui.panelMode === "overview") leave(); else { unfocus(); state.highlight = null; app.ui.openPanel("overview"); } }
    function openPattern(pid) { unfocus(); state.highlight = new Set(app.research.membersOf(pid).map(s => s.id)); app.ui.openPanel("pattern", pid); }
    function select(list) { unfocus(); state.highlight = new Set(list.map(s => s.id)); app.ui.openPanel("selection", list); }

    // ---------- 每帧 ----------
    // 绘制前：预判聚焦与松开，平滑指针，找出离光标最近的图
    function beforeDraw(now, dt) {
      // 停手后，已接近最深、且有一张图靠近画面中央（或就在光标下），就轻轻吸附过去聚焦；拖到空海或缩回较浅处，就松开
      if (!camera.flying && !drag && !camera.gliding && !stage.layoutT && lastInteract && lastInteract !== settled && now - lastInteract > F.settle) {
        settled = lastInteract;
        const mk = camera.maxK(), { TW, TH } = config.grid;
        if (cam.tk >= mk * F.enter) {
          const cx = camera.availW() / 2, cy = camera.view.H / 2;
          let best = null, bd = 1;
          for (const n of stage.nodes) {
            const d = Math.hypot((n.x * cam.tk + cam.tx - cx) / (TW * cam.tk * F.pickX), (n.y * cam.tk + cam.ty - cy) / (TH * cam.tk * F.pickY));
            if (d < bd) { bd = d; best = n.s; }
          }
          if (!best && cam.tk >= mk * F.hoverPick && hoverTile) best = hoverTile;
          if (best) focus(best, config.camera.fly.snap);
          else if (state.focused) release();
        } else if (state.focused && cam.tk < mk * F.release) release();
      }
      const pk = REDUCED ? 1 : 1 - Math.exp(-dt * 10);
      ptr.sx += (ptr.x - ptr.sx) * pk; ptr.sy += (ptr.y - ptr.sy) * pk;
      ptr.wake += (Math.min(1, ptr.speed / 2.2) - ptr.wake) * (1 - Math.exp(-dt * 6));
      ptr.speed *= Math.exp(-dt * 5);
      near = nearest(ptr.x, ptr.y);
    }

    // 绘制后：悬停唤醒。只有光标真正停下来、且刚才没有在拖拽或缩放，才去唤醒关联
    function afterDraw(now) {
      if (!ptr.inside || drag) { hoverTile = null; hoverLead = null; return; }
      const t = near ? near.s : null;
      if (t !== hoverTile) { hoverTile = t; hoverSince = now; }
      emptySince = t ? 0 : emptySince || now;
      hoverLead = t ? null : app.render.leadRects.find(r => Math.hypot(r.sx - ptr.x, r.sy - ptr.y) < 12) || null;
      // 入场播放期间不唤醒；停留从入场结束时才开始计时
      if (app.intro.playing) { hoverSince = now; return; }
      if (state.focused || state.highlight) return;
      const w = state.woken;
      if (t && t !== w && now - hoverSince > (w ? Wk.switchDwell : Wk.dwell) && ptr.speed < (w ? Wk.switchSpeed : Wk.speed) && !camera.flying && !stage.layoutT && now - lastInteract > Wk.cooldown) wake(t);
      if (!t && w && now - emptySince > Wk.leave) wake(null);
    }

    // ---------- 输入 ----------
    canvas.addEventListener("pointermove", e => {
      const t = performance.now(), dt = Math.max(1, t - ptr.lastT);
      if (ptr.inside) ptr.speed = Math.max(ptr.speed * .6, Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) / dt);
      ptr.lastT = t; ptr.x = e.clientX; ptr.y = e.clientY;
      if (!ptr.inside) { ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.inside = true; }
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!moved && Math.hypot(dx, dy) > 4) { moved = true; drag.box = drag.box || e.shiftKey; if (!drag.box) canvas.classList.add("panning"); }
      if (!moved) return;
      if (drag.box) Object.assign(marquee.style, { display: "block", left: Math.min(e.clientX, drag.sx) + "px", top: Math.min(e.clientY, drag.sy) + "px", width: Math.abs(dx) + "px", height: Math.abs(dy) + "px" });
      else {
        const nx = drag.x + dx, ny = drag.y + dy, dtm = Math.max(1, t - (drag.t || t - 16));
        drag.vx = (nx - cam.x) / dtm; drag.vy = (ny - cam.y) / dtm; drag.t = t; lastInteract = t;
        if (!state.focused && state.woken) wake(null);
        camera.panTo(nx, ny);
      }
    });
    canvas.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      app.intro.stop(); camera.stopGlide(); lastInteract = performance.now();
      moved = false; drag = { sx: e.clientX, sy: e.clientY, x: cam.x, y: cam.y, box: e.shiftKey };
      if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", e => {
      if (!drag) return;
      canvas.classList.remove("panning");
      if (drag.box && moved) {
        const x0 = Math.min(e.clientX, drag.sx), x1 = Math.max(e.clientX, drag.sx), y0 = Math.min(e.clientY, drag.sy), y1 = Math.max(e.clientY, drag.sy);
        const sel = stage.nodes.filter(n => { const r = n.rect; if (!r) return false; const c = centerOfRect(r); return c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1; }).map(n => n.s);
        marquee.style.display = "none";
        if (sel.length) select(sel);
      } else if (moved && !drag.box && !REDUCED && performance.now() - drag.t < 80) {
        camera.startGlide(drag.vx, drag.vy);
      } else if (!moved) {
        const t = hit(e.clientX, e.clientY) || (near && near.s);
        if (t) focus(t); else leave();
      }
      drag = null;
    });
    canvas.addEventListener("pointerleave", () => { ptr.inside = false; if (!state.focused && !state.highlight) wake(null); });
    // 滚轮只控制深度：拖拽在海里移动，滚轮下潜或上浮
    canvas.addEventListener("wheel", e => {
      e.preventDefault(); app.intro.stop(); camera.stopGlide(); lastInteract = performance.now();
      if (!state.focused) wake(null);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // 向下滚动 = 潜得更深；触控板捏合保留张开放大的习惯
      camera.zoomAt(e.clientX, e.clientY, e.ctrlKey ? Math.exp(-dy * .012) : Math.exp(dy * .0022), false);
      if (state.focused && cam.tk < camera.maxK() * F.release) release();
    }, { passive: false });
    canvas.addEventListener("dblclick", e => {
      if (camera.isDeep() || hit(e.clientX, e.clientY)) return;
      app.intro.stop(); camera.diveAt((e.clientX - cam.x) / cam.k, (e.clientY - cam.y) / cam.k);
    });
    addEventListener("keydown", e => {
      if (e.key === "Escape") leave();
      else if (e.key === "f" || e.key === "F") { app.intro.stop(); camera.surface(); }
      else if (e.key === "d" || e.key === "D") { app.intro.stop(); camera.diveAt(stage.scene.core.x, stage.scene.core.y); }
      else if (e.key === "i" || e.key === "I") toggleOverview();
    });

    return {
      state, pointer: ptr,
      get dragging() { return !!drag; },
      get hoverTile() { return hoverTile; },
      get hoverLead() { return hoverLead; },
      get idleFor() { return performance.now() - lastInteract; },
      touch(now) { lastInteract = now; },
      wake, focus, release, leave, highlight, remap, toggleOverview, openPattern, cancelClose,
      beforeDraw, afterDraw,
    };
  }

  Sea.interaction = Object.freeze({ create });
})(window.Sea = window.Sea || {});
