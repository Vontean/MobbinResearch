// 第 6 层：实时更新。Loop 进行中，页面经由本地服务打开时，定期读取 research.js；
// 有变化先排队，等用户停手再并入，不在拖拽、缩放、运镜时挪动脚下的海
(function (Sea) {
  "use strict";

  function create(app) {
    const L = app.config.live;
    const on = app.view.live;
    let last = null, pending = null;

    const parse = text => JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    async function poll() {
      try {
        const text = await (await fetch("research.js", { cache: "no-store" })).text();
        // 第一次读取只记下当前版本：页面加载时已经有这份数据
        if (last !== null && text !== last) pending = parse(text);
        last = text;
      } catch { /* 文件正在替换或服务暂停：下次再读 */ }
      setTimeout(poll, L.poll);
    }

    function merge(data) {
      const { camera, stage, interaction } = app, first = !stage.nodes.length;
      const overview = !camera.isDeep() && !interaction.state.focused;
      app.research = Sea.domain.createResearch(data);
      stage.sync(); stage.apply(!first);
      interaction.remap(); app.ui.refresh();
      // 第一批图到来：任务书收进标题，然后入场
      if (first && stage.nodes.length) { camera.fit(true); app.boot.on ? app.boot.exit().then(() => app.intro.start()) : app.intro.start(); }
      else if (overview) camera.surface();                                       // 在看全貌：跟着海一起长大
    }

    return {
      on,
      // 最新读到的数据：Agent 的"此刻"只是信息，不挪动画面，不必等落地
      get latest() { return pending || app.research.data; },
      // 已经读到、还没落地的新图数量
      get pendingCount() { return pending ? Math.max(0, pending.screens.length - app.research.screens.length) : 0; },
      start() { if (on) poll(); },
      // 每帧检查：有排队的数据，且用户已停手、镜头静止，才并入
      tick() {
        if (!pending) return;
        const { interaction: ix, camera, stage } = app;
        // 聚焦着看一张图时也不落地：等离开聚焦再说
        if (ix.dragging || ix.state.focused || camera.flying || camera.gliding || stage.layoutT || app.intro.playing || ix.idleFor < L.settle) return;
        const data = pending; pending = null;
        merge(data);
      },
    };
  }

  Sea.live = Object.freeze({ create });
})(window.Sea = window.Sea || {});
