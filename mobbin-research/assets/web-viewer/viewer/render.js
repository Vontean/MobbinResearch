// 第 4 层：画布渲染。读取镜头、视图模型和交互状态，画出一帧；不做任何交互决策
(function (Sea) {
  "use strict";

  // 海面的涌动：一道从中心向外的慢涌，叠加一道斜向的交叉波
  const wave = (x, y, T) => .6 * Math.sin(Math.hypot(x, y) * .011 - T * 1.1) + .4 * Math.sin(x * .007 - y * .009 + T * .7);
  const GRAYS = 12;

  function create(app) {
    const { config, util, canvas } = app, { G, TW, TH, CX, CY } = config.grid;
    const { clamp, pad } = util, REDUCED = config.reduced;
    const ctx = canvas.getContext("2d");
    const buckets = Array.from({ length: GRAYS }, () => []);
    let vignette = null, bandTop = null, bandBottom = null, edgeFade = 0;
    const render = { leadRects: [] };

    render.resize = () => {
      const { W, H, DPR } = app.camera.view;
      canvas.width = W * DPR; canvas.height = H * DPR;
      vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.hypot(W, H) * .56);
      vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.88)");
      // 上下两条压暗带，托住标题、HUD 与模式索引，避免和真实截图叠在一起
      bandTop = ctx.createLinearGradient(0, 0, 0, 150);
      bandTop.addColorStop(0, "rgba(0,0,0,.92)"); bandTop.addColorStop(.55, "rgba(0,0,0,.6)"); bandTop.addColorStop(1, "rgba(0,0,0,0)");
      bandBottom = ctx.createLinearGradient(0, H, 0, H - 210);
      bandBottom.addColorStop(0, "rgba(0,0,0,.94)"); bandBottom.addColorStop(.55, "rgba(0,0,0,.62)"); bandBottom.addColorStop(1, "rgba(0,0,0,0)");
    };

    function brackets(x, y, w, h) {
      const o = 9, l = Math.min(14, w * .3);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (const [cx, cy, dx, dy] of [[x - w / 2 - o, y - h / 2 - o, 1, 1], [x + w / 2 + o, y - h / 2 - o, -1, 1], [x - w / 2 - o, y + h / 2 + o, 1, -1], [x + w / 2 + o, y + h / 2 + o, -1, -1]]) {
        ctx.moveTo(cx, cy + dy * l); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * l, cy);
      }
      ctx.stroke();
    }

    render.draw = (now, dt) => {
      const { stage, camera, interaction: ix } = app, scene = stage.scene, st = ix.state, ptr = ix.pointer;
      const { W, H, DPR } = camera.view, cam = camera.state, core = scene.core;
      const T = now / 1000, amb = REDUCED ? 0 : 1;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const k = cam.k, ox = cam.x, oy = cam.y;
      const enterFront = REDUCED ? 1e9 : (now - stage.enterT) * config.entrance.speed;
      const rFront = st.rippleT >= 0 ? (now - st.rippleT) * config.wake.spread : -1;
      const live = ptr.inside && !ix.dragging;

      // 点阵海面：按亮度分桶，每桶一次填充
      for (const b of buckets) b.length = 0;
      const step = k < .22 ? 2 : 1;
      const i0 = Math.floor(-ox / k / G) - 1, i1 = Math.ceil((W - ox) / k / G) + 1;
      const j0 = Math.floor(-oy / k / G) - 1, j1 = Math.ceil((H - oy) / k / G) + 1;
      const dotR = clamp(1.1 * Math.sqrt(k / .5), .65, 1.7);
      for (let i = i0 - (i0 % step); i <= i1; i += step) for (let j = j0 - (j0 % step); j <= j1; j += step) {
        if (scene.covered.has(`${i},${j}`)) continue;
        const wx = i * G, wy = j * G, sx = wx * k + ox, sy = wy * k + oy;
        const dc = Math.hypot(wx - core.x, wy - core.y) * k;
        if (dc > enterFront) continue;
        const f = wave(wx, wy, T) * amb;
        const wake = live ? ptr.wake * Math.max(0, 1 - Math.hypot(sx - ptr.sx, sy - ptr.sy) / 180) : 0;
        const v = clamp((.2 + f * .06 + wake * .12) * clamp((enterFront - dc) / 160, 0, 1), 0, .999);
        buckets[Math.floor(v * GRAYS)].push(sx, sy, dotR * (1 + f * .22));
      }
      for (let b = 0; b < GRAYS; b++) {
        const arr = buckets[b]; if (!arr.length) continue;
        const g = Math.round(255 * (b + .5) / GRAYS);
        ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.beginPath();
        for (let n = 0; n < arr.length; n += 3) { ctx.moveTo(arr[n] + arr[n + 2], arr[n + 1]); ctx.arc(arr[n], arr[n + 1], arr[n + 2], 0, Math.PI * 2); }
        ctx.fill();
      }

      // 航道的刻度：左侧模式名，上方距离列号
      if (scene.lanes && !stage.layoutT) {
        const a = clamp(enterFront / 600, 0, 1) * (st.woken || st.highlight ? .35 : 1);
        ctx.globalAlpha = a; ctx.font = '400 11px "Space Mono", "PingFang SC", monospace'; ctx.textBaseline = "middle";
        ctx.textAlign = "right"; ctx.fillStyle = "#999";
        for (const l of scene.lanes.lanes) {
          const sx = -CX * 1.1 * k + ox, sy = l.y * k + oy;
          ctx.fillText(l.name, sx, sy - 7); ctx.fillStyle = "#555"; ctx.fillText(`${pad(l.n, 2)} FRAMES`, sx, sy + 9); ctx.fillStyle = "#999";
        }
        ctx.textAlign = "center"; ctx.fillStyle = "#555";
        scene.lanes.cols.forEach((c, d) => ctx.fillText(`D ${pad(d + 1, 2)}`, c.x * k + ox, -CY * .9 * k + oy));
        ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
      }

      // 还没走过的线索：一粒橙色的光
      render.leadRects = [];
      for (const L of scene.leadDots) {
        if (Math.hypot(L.x - core.x, L.y - core.y) * k > enterFront) continue;
        const sx = L.x * k + ox, sy = L.y * k + oy, open = L.lead.status === "open";
        ctx.globalAlpha = open ? (REDUCED ? 1 : .55 + .45 * Math.sin(T * 3.9 + L.x)) : .6;
        ctx.fillStyle = open ? "#f26522" : "#666";
        ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        render.leadRects.push({ L, sx, sy });
      }

      // 截图：先更新每个节点的唤醒 / 失焦程度和屏幕矩形，再按层级绘制
      const draws = [], hl = st.highlight, lk = REDUCED ? 1 : 1 - Math.exp(-dt * config.wake.rate);
      for (const n of stage.nodes) {
        const s = n.s, sx = n.x * k + ox, sy = n.y * k + oy;
        if (n.cd * k > enterFront) { n.rect = null; continue; }
        if (!n.bornAt) n.bornAt = now;
        const age = REDUCED ? 1 : clamp((now - n.bornAt) / 520, 0, 1);
        const f = wave(n.x, n.y, T) * amb;
        // 关联按距离依次抵达：越远的图越晚被唤醒
        const reached = rFront < 0 || REDUCED || rFront > Math.hypot(sx - st.rippleAt.x, sy - st.rippleAt.y);
        let tl = 0, td = 0;
        if (st.woken) {
          if (s === st.woken) tl = 1;
          else if (st.relMap.has(s)) tl = reached ? 1 : 0;
          else td = reached ? 1 : 0;
        } else if (hl) { tl = hl.has(s.id) ? 1 : 0; td = 1 - tl; }
        n.lit += (tl - n.lit) * lk; n.dim += (td - n.dim) * lk;
        const hovered = s === ix.hoverTile && live;
        // 景深：焦点与相关图保持清晰，其余的失焦、略微退后
        const sc = (1 + f * .01 + (hovered ? .04 : 0) + n.lit * .03) * (.55 + .45 * util.ease.back(age)) * (1 - n.dim * .04);
        const w = TW * k * sc, h = TH * k * sc;
        n.rect = { x: sx - w / 2, y: sy - h / 2, w, h };
        draws.push({ n, sx, sy, w, h, alpha: Math.min(1, age * 2.2), z: sc + n.lit });
      }
      draws.sort((a, b) => a.z - b.z);
      ctx.textAlign = "center";
      for (const d of draws) {
        const { n, sx, sy, w, h } = d, s = n.s, r = Math.min(18, Math.max(1.5, w * .08)), x = sx - w / 2, y = sy - h / 2;
        ctx.globalAlpha = d.alpha;
        // 图够大时换用原图
        if (h > 380 && s.image && !n.full) { n.full = new Image(); n.full.decoding = "async"; n.full.src = s.image; }
        const src = n.full && n.full.complete && n.full.naturalWidth && h > 380 ? n.full : n.img;
        if (src.complete && src.naturalWidth) {
          ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
          // 清晰版与失焦版按 dim 交叉渐变；失焦版来自一张极小的模糊图，拉伸后自然柔和
          if (n.dim < .98) { ctx.globalAlpha = d.alpha * (1 - n.dim); ctx.drawImage(src, x, y, w, h); }
          if (n.dim > .02 && n.soft) { ctx.globalAlpha = d.alpha * n.dim * .45; ctx.drawImage(n.soft, x, y, w, h); }
          ctx.restore();
        } else { ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
        ctx.globalAlpha = 1;
        // 唤醒的焦点：一圈细框；相关图：头顶一粒白点，够大时下方再加一枚关系标签
        if (n.lit > .03) {
          if (s === st.woken) {
            ctx.strokeStyle = `rgba(255,255,255,${.85 * n.lit})`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x - 2.5, y - 2.5, w + 5, h + 5, r + 2.5); ctx.stroke();
          } else {
            ctx.globalAlpha = n.lit; ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(sx, y - 7, 1.8, 0, Math.PI * 2); ctx.fill();
            const rel = st.relMap.get(s);
            if (rel && w > 40) { ctx.fillStyle = "#777"; ctx.font = '700 8.5px "Space Mono", monospace'; ctx.fillText(rel.tag.split("").join(" "), sx, y + h + 14); }
            ctx.globalAlpha = 1;
          }
        }
        if (st.focused && s === st.woken) brackets(sx, sy, w, h);
      }

      // 暗角与压暗带常驻；聚焦时文字退场，压暗随之减弱，不压暗图片边缘
      edgeFade += ((st.focused ? 1 : 0) - edgeFade) * (1 - Math.exp(-dt * 8));
      if (vignette) {
        ctx.globalAlpha = .75 - edgeFade * .5; ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1 - edgeFade * .75; ctx.fillStyle = bandTop; ctx.fillRect(0, 0, W, 150);
        ctx.fillStyle = bandBottom; ctx.fillRect(0, H - 210, W, 210); ctx.globalAlpha = 1;
      }
    };

    return render;
  }

  Sea.render = Object.freeze({ create });
})(window.Sea = window.Sea || {});
