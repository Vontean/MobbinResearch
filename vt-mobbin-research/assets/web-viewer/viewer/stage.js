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
    let islandCache = null, grown = null, settledAt = -1, outline = 0;
    // 生长的历史只是这个标签页里的浏览便利：存进 sessionStorage，刷新后接着长，不重新洗牌；读写失败就从头整理
    const memoKey = () => { const b = app.research.data.brief || {}; return `sea:grown:${location.pathname}:${b.product}:${b.date}`; };
    function recall() {
      try { const m = JSON.parse(sessionStorage.getItem(memoKey())); if (m) { grown = new Map(m.pos); settledAt = m.cps; } } catch { /* 没有记录 */ }
    }
    function remember() {
      try { grown ? sessionStorage.setItem(memoKey(), JSON.stringify({ cps: settledAt, pos: [...grown] })) : sessionStorage.removeItem(memoKey()); } catch { /* 存不了就算了 */ }
    }
    // filter：筛选（只看一条洞察的证据或精选），{ key, ids, title, note }；为空时是整片海
    const stage = { order: [], nodes: [], nodeOf: new Map(), scene: null, layoutT: 0, enterT: 0, finaleT: 0, filter: null };

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
        out: false, vis: 1,      // 是否被筛选挡在外面 / 当前可见程度，0–1
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

    // 岛屿坐标。Loop 进行中（实时打开、未完成、未达目标数量）用生长中的岛屿：
    // 平时新图只落进空格子；每多一个检查点整理一次；完成后回到完整调研的布局，与 file:// 打开时一致
    function island(research, order) {
      const { data, screens, target } = research;
      outline = 0;
      if (!app.view.live || research.complete) { if (grown) { grown = null; remember(); } return Sea.layout.islandPositions(research, order); }
      if (!grown) recall();
      const cps = (data.checkpoints || []).length, capacity = Math.max(target, screens.length);
      outline = Sea.layout.discRadius(capacity);
      const pos = !grown || cps !== settledAt ? Sea.layout.settleIsland(research, order, capacity) : Sea.layout.growIsland(research, order, capacity, grown);
      settledAt = cps; grown = new Map([...pos].map(([s, p]) => [s.id, p]));
      remember();
      return pos;
    }

    // 新图从哪里出生：找到它的那条线索在海岸线外的光点；没有时从它的上一张图，再没有时从核心
    function birthplace(s, prev) {
      const lead = prev.leadDots.find(L => L.lead.id === s.found_via);
      if (lead) return [lead.x, lead.y];
      const parent = app.research.parentOf(s), pn = parent != null && stage.nodes.find(n => n.s.id === parent && n.x != null);
      return pn ? [pn.x, pn.y] : [prev.core.x, prev.core.y];
    }

    // 筛选：只把选中的图重新排成一座完整的小岛；其余的图原地淡出
    function filtered(f) {
      const sub = Sea.domain.createResearch({ ...app.research.data, screens: app.research.screens.filter(s => f.ids.has(s.id)) });
      const order = Sea.layout.patternOrder(sub), positions = Sea.layout.islandPositions(sub, order);
      return { positions, scene: Sea.layout.composeScene(sub, "island", positions, null, order) };
    }

    // 切换布局、筛选或数据更新：计算新场景，节点从当前位置出发；animate 时由 step() 插值过去
    stage.apply = animate => {
      let positions, lanes = null, scene;
      const research = app.research, order = stage.order, prev = stage.scene;
      if (stage.filter) ({ positions, scene } = filtered(stage.filter));
      else {
        if (app.view.layout === "lanes") ({ positions, info: lanes } = Sea.layout.lanePositions(research, order));
        else positions = islandCache ||= island(research, order);
        scene = Sea.layout.composeScene(research, app.view.layout, positions, lanes, order);
      }
      // 生长中的岛屿：取景按最终的轮廓，图从中央小小地长起，镜头不必跟着一次次拉远
      if (!stage.filter && app.view.layout === "island" && outline) {
        const { TW, TH } = config.grid, b = scene.bounds;
        Object.assign(b, { x0: Math.min(b.x0, -outline - TW), x1: Math.max(b.x1, outline + TW), y0: Math.min(b.y0, -outline - TH), y1: Math.max(b.y1, outline + TH) });
      }
      for (const n of stage.nodes) {
        const p = positions.get(n.s);
        n.out = !p;
        if (n.out) {                          // 被筛掉：留在原地淡出
          if (n.x == null) { n.x = n.gx = scene.core.x; n.y = n.gy = scene.core.y; n.vis = 0; }
          n.gx = n.x; n.gy = n.y; n.x0 = n.x; n.y0 = n.y;
          continue;
        }
        const [x, y] = p;
        n.gx = x; n.gy = y;
        if (n.x == null && animate && prev && !config.reduced) [n.x, n.y] = birthplace(n.s, prev);
        else if (!animate || n.x == null) { n.x = x; n.y = y; }
        n.x0 = n.x; n.y0 = n.y;
        n.cd = scene.coreDist.get(n.s);
      }
      stage.layoutT = animate && !config.reduced ? performance.now() : 0;
      stage.scene = scene;
      app.camera.setBounds(scene.bounds);
    };

    stage.setFilter = f => { stage.filter = f; stage.apply(true); };

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
