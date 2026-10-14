// 第 3 层：视图模型。每张图一个节点，承载渲染状态（位置、明暗、图片）；领域数据保持只读
(function (Sea) {
  "use strict";

  // 失焦版：小尺寸上做高斯模糊；不支持画布滤镜时退回缩小图，放大后同样柔和
  function soften(img) {
    const c = document.createElement("canvas"), g = c.getContext("2d");
    if ("filter" in g) {
      c.width = 48; c.height = 104; g.filter = "blur(4px)";
      g.drawImage(img, -8, -8, 64, 120);
    } else { c.width = 14; c.height = 30; g.drawImage(img, 0, 0, 14, 30); }
    return c;
  }

  function create(app) {
    const { config, util } = app;
    let islandCache = null;
    const stage = { order: [], nodes: [], nodeOf: new Map(), scene: null, layoutT: 0, enterT: 0 };

    function load(n) {
      const img = new Image(); img.decoding = "async"; img.src = n.s.thumb;
      img.onload = () => { n.soft = soften(img); };
      n.img = img; n.soft = null; n.full = null;
    }
    const makeNode = s => {
      const n = {
        s,                       // 领域对象（只读）
        x: null, y: null,        // 当前显示位置（布局切换时在两种布局之间插值）
        gx: 0, gy: 0, x0: 0, y0: 0, cd: 0,
        lit: 0, dim: 0,          // 被唤醒的程度 / 失焦的程度，0–1
        rect: null, bornAt: 0,
        img: null, soft: null, full: null,
      };
      load(n);
      return n;
    };

    // 与当前调研数据同步：已有的图沿用原节点（位置、图片、明暗），新图新建节点
    stage.sync = () => {
      const research = app.research, old = new Map(stage.nodes.map(n => [n.s.id, n]));
      stage.order = Sea.layout.patternOrder(research);
      stage.nodes = research.screens.map(s => {
        const n = old.get(s.id);
        if (!n) return makeNode(s);
        const reload = n.s.thumb !== s.thumb;
        n.s = s; if (reload) load(n);
        return n;
      });
      stage.nodeOf = new Map(stage.nodes.map(n => [n.s, n]));
      islandCache = null;
    };

    // 切换布局：计算新场景，节点从当前位置出发；animate 时由 step() 插值过去
    stage.apply = animate => {
      let positions, lanes = null;
      const research = app.research, order = stage.order;
      if (app.view.layout === "lanes") ({ positions, info: lanes } = Sea.layout.lanePositions(research, order));
      else positions = islandCache ||= Sea.layout.islandPositions(research, order);
      const scene = Sea.layout.composeScene(research, app.view.layout, positions, lanes, order);
      for (const n of stage.nodes) {
        const [x, y] = positions.get(n.s);
        n.gx = x; n.gy = y;
        if (!animate || n.x == null) { n.x = x; n.y = y; }
        n.x0 = n.x; n.y0 = n.y;
        n.cd = scene.coreDist.get(n.s);
      }
      stage.layoutT = animate && !config.reduced ? performance.now() : 0;
      stage.scene = scene;
      app.camera.setBounds(scene.bounds);
    };

    // 布局切换的过渡：每张图带一点错落，滑向新位置
    stage.step = now => {
      if (!stage.layoutT) return;
      const { duration, stagger } = config.layoutMorph;
      let done = true;
      for (const n of stage.nodes) {
        const p = util.clamp((now - stage.layoutT - (n.s.id % 17) * stagger) / duration, 0, 1), e = util.ease.cubic(p);
        n.x = n.x0 + (n.gx - n.x0) * e; n.y = n.y0 + (n.gy - n.y0) * e;
        if (p < 1) done = false;
      }
      if (done) stage.layoutT = 0;
    };

    // 入场：所有节点回到"未出生"，由渲染层按从核心荡开的波依次弹入
    stage.enter = (now = performance.now()) => { stage.enterT = now; for (const n of stage.nodes) n.bornAt = 0; };

    return stage;
  }

  Sea.stage = Object.freeze({ create });
})(window.Sea = window.Sea || {});
