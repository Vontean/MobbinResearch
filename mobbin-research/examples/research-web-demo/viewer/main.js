// 第 6 层：组装与启动。创建各层、连接依赖、处理入场与深链接，并调度每一帧
(function (Sea) {
  "use strict";
  const fail = msg => { document.body.innerHTML = `<p style="padding:32px;font:14px system-ui;color:#999">${msg}</p>`; };
  const DATA = window.RESEARCH;
  if (!DATA) return fail("没有找到 research.js。请先运行 python3 scripts/build_web.py &lt;调研目录&gt;。");
  // 任何一层没有加载成功，都直接说明缺了哪个文件，而不是留下一块黑屏
  const missing = ["util", "config", "glyph", "domain", "layout", "camera", "stage", "render", "cards", "interaction", "ui", "live"].filter(m => !Sea[m]);
  if (missing.length) return fail(`查看器文件不完整，缺少：${missing.map(m => `viewer/${m}.js`).join("、")}。请重新运行 build_web.py。`);

  const { config } = Sea;
  const params = new URLSearchParams(location.search);
  const app = Sea.app = {
    config, util: Sea.util,
    research: Sea.domain.createResearch(DATA),
    canvas: document.getElementById("sea"),
    // live：经由本地服务打开（Loop 进行中）；file:// 打开时是一份完成的调研
    view: { layout: config.layouts.includes(params.get("layout")) ? params.get("layout") : "island", live: /^https?:$/.test(location.protocol) },
    // 网址记录当前视图：布局与聚焦的帧，便于分享
    url: {
      set(key, v) {
        const q = new URLSearchParams(location.search);
        v == null ? q.delete(key) : q.set(key, v);
        history.replaceState(null, "", "?" + q.toString());
      },
    },
  };

  // 依赖方向：camera → stage → render → interaction / ui；运行期互相调用经由 app
  app.camera = Sea.camera.create(app);
  app.stage = Sea.stage.create(app);
  app.render = Sea.render.create(app);
  app.interaction = Sea.interaction.create(app);
  app.ui = Sea.ui.create(app);
  app.live = Sea.live.create(app);

  // 入场：一道从核心荡开的波，铺开后自动下潜到直接竞品的重心
  // 播放期间（波纹到下潜落定）不唤醒景深；用户任何直接操作都会提前结束入场
  let introT = 0, playing = false, diving = false;
  app.intro = {
    start() {
      const { camera, stage } = app, E = config.entrance;
      stage.enter(); playing = true; diving = false;
      const wave = Math.hypot(camera.view.W, camera.view.H) / 2 / E.speed;
      introT = setTimeout(() => { diving = true; camera.diveAt(stage.scene.core.x, stage.scene.core.y); }, Math.min(wave, stage.scene.seaR * camera.fitTarget().k / E.speed + E.diveSlack) + E.diveDelay);
    },
    stop() { clearTimeout(introT); playing = false; app.camera.stop(); },
    get playing() { if (playing && diving && !app.camera.flying) playing = false; return playing; },
  };

  function resize() {
    app.camera.setViewport(innerWidth, innerHeight, Math.min(2, devicePixelRatio || 1));
    app.render.resize();
  }

  let last = performance.now();
  function frame(now) {
    // 先调度下一帧：单帧出错只影响这一帧，画布不会整体停住
    requestAnimationFrame(frame);
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    if (app.camera.step(now, dt)) app.interaction.touch(now);
    app.stage.step(now);
    app.interaction.beforeDraw(now, dt);
    app.render.draw(now, dt);
    app.interaction.afterDraw(now);
    app.ui.tick();
    app.live.tick();
  }

  app.stage.sync(); app.stage.apply(false); resize(); app.camera.fit(true); app.ui.syncSwitch();
  addEventListener("resize", () => { resize(); app.ui.syncTools(); if (!app.camera.isDeep()) app.camera.fit(); });
  const deepLink = app.research.byId.get(+params.get("frame"));
  if (deepLink) { app.stage.enterT = performance.now() - 1e5; app.camera.fit(true); requestAnimationFrame(() => app.interaction.focus(deepLink, config.camera.fly.deepLink)); }
  else if (app.stage.nodes.length) app.intro.start();
  app.live.start();
  requestAnimationFrame(frame);
})(window.Sea = window.Sea || {});
