// 第 3 层：镜头。世界坐标到屏幕坐标的映射，以及适配、飞行、缩放、滑行
// 屏幕坐标 = 世界坐标 × k + (x, y)；右侧被面板占用时，可用宽度变窄，画面中心随之左移
(function (Sea) {
  "use strict";

  function create(app) {
    const { config, util } = app, C = config.camera, { TH } = config.grid;
    const cam = { k: 1, x: 0, y: 0, tk: 1, tx: 0, ty: 0 };   // 当前值与目标值
    const view = { W: 0, H: 0, DPR: 1 };
    let inset = 0, bounds = null, tween = null, glide = null;

    const availW = () => view.W - inset;
    const diveK = () => view.H * C.diveRatio / TH;
    const maxK = () => view.H * C.focusRatio / TH;

    function fitTarget() {
      const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0, k = Math.min(availW() / (bw * 1.08), (view.H - 120) / (bh * 1.06));
      return { k, x: availW() / 2 - (bounds.x0 + bw / 2) * k, y: view.H / 2 - (bounds.y0 + bh / 2) * k };
    }
    // 把世界点 (wx, wy) 放在可用区域中央、缩放为 k 时的镜头
    const centerOn = (wx, wy, k) => ({ k, x: availW() / 2 - wx * k, y: view.H / 2 - wy * k });

    function fit(instant) {
      const t = fitTarget(); cam.tk = t.k; cam.tx = t.x; cam.ty = t.y;
      if (instant) Object.assign(cam, { k: t.k, x: t.x, y: t.y });
    }
    // 运镜：缩放在对数空间插值，画面中心沿直线移动
    function fly(to, dur, ease = util.ease.inOut) {
      if (config.reduced) { Object.assign(cam, { k: to.k, x: to.x, y: to.y, tk: to.k, tx: to.x, ty: to.y }); return; }
      const cw = availW() / 2;
      tween = { k0: cam.k, k1: to.k, c0: [(cw - cam.x) / cam.k, (view.H / 2 - cam.y) / cam.k], c1: [(cw - to.x) / to.k, (view.H / 2 - to.y) / to.k], t0: performance.now(), dur, ease };
    }
    function zoomAt(sx, sy, f, instant) {
      const k = util.clamp(cam.tk * f, fitTarget().k * C.minFitRatio, maxK()), wx = (sx - cam.tx) / cam.tk, wy = (sy - cam.ty) / cam.tk;
      cam.tk = k; cam.tx = sx - wx * k; cam.ty = sy - wy * k;
      if (instant) Object.assign(cam, { k: cam.tk, x: cam.tx, y: cam.ty });
    }
    // 直接拖动：当前值与目标值同时更新，1:1 跟手
    function panTo(x, y) { cam.x = cam.tx = x; cam.y = cam.ty = y; }
    function panBy(dx, dy) { panTo(cam.x + dx, cam.y + dy); }

    // 面板开合时，可用区域的中心移动多少，镜头就跟着平移多少
    function setInset(px) { const before = availW(); inset = px; cam.tx += (availW() - before) / 2; }

    // 每帧推进：运镜 → 滑行 → 跟随。返回本帧是否仍在滑行
    function step(now, dt) {
      if (tween) {
        const p = util.clamp((now - tween.t0) / tween.dur, 0, 1), e = tween.ease(p), cw = availW() / 2;
        const k = Math.exp(Math.log(tween.k0) + (Math.log(tween.k1) - Math.log(tween.k0)) * e);
        const cx = tween.c0[0] + (tween.c1[0] - tween.c0[0]) * e, cy = tween.c0[1] + (tween.c1[1] - tween.c0[1]) * e;
        Object.assign(cam, { k, tk: k, x: cw - cx * k, tx: cw - cx * k, y: view.H / 2 - cy * k, ty: view.H / 2 - cy * k });
        if (p >= 1) tween = null;
      }
      let gliding = false;
      if (glide) {
        panTo(cam.x + glide.vx * dt * 1000, cam.y + glide.vy * dt * 1000);
        const f = Math.exp(-dt * C.glideFriction); glide.vx *= f; glide.vy *= f;
        if (Math.hypot(glide.vx, glide.vy) < .01) glide = null; else gliding = true;
      }
      const ck = 1 - Math.exp(-dt * C.follow);
      cam.k += (cam.tk - cam.k) * ck; cam.x += (cam.tx - cam.x) * ck; cam.y += (cam.ty - cam.y) * ck;
      return gliding;
    }

    return {
      state: cam, view,
      availW, diveK, maxK, fitTarget, centerOn,
      setViewport(W, H, DPR) { Object.assign(view, { W, H, DPR }); },
      setBounds(b) { bounds = b; },
      setInset, fit, fly, zoomAt, panTo, panBy, step,
      surface() { fly(fitTarget(), C.fly.surface); },
      diveAt(wx, wy) { fly(centerOn(wx, wy, diveK()), C.fly.dive); },
      stop() { tween = null; },
      get flying() { return !!tween; },
      startGlide(vx, vy) { glide = { vx, vy }; },
      stopGlide() { glide = null; },
      get gliding() { return !!glide; },
      isDeep: () => cam.tk > fitTarget().k * C.deepFitRatio,
    };
  }

  Sea.camera = Object.freeze({ create });
})(window.Sea = window.Sea || {});
