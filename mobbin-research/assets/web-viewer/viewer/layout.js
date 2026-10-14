// 第 2 层：场景几何。纯函数：输入调研数据，输出每张图的世界坐标和场景信息，不读写任何状态
(function (Sea) {
  "use strict";
  const { config, util } = Sea;
  const { G, TW, TH, CX, CY, LANE_Y } = config.grid;
  const RINGS = config.rings;

  // 模式顺序：常一起出现的模式相邻
  function patternOrder(research) {
    const { screens, data } = research;
    const pats = data.patterns.map(p => ({ id: p.id, name: p.name, n: screens.filter(s => s.patterns[0] === p.id).length }));
    const co = new Map(), key = (a, b) => [a, b].sort().join("|");
    for (const s of screens) for (const p of s.patterns.slice(1)) co.set(key(s.patterns[0], p), (co.get(key(s.patterns[0], p)) || 0) + 1);
    const order = [pats.slice().sort((a, b) => b.n - a.n)[0]];
    while (order.length < pats.length) {
      const last = order[order.length - 1];
      order.push(pats.filter(p => !order.includes(p)).sort((a, b) => (co.get(key(last.id, b.id)) || 0) - (co.get(key(last.id, a.id)) || 0) || b.n - a.n)[0]);
    }
    return order;
  }

  // 岛屿：圈层定半径、模式定方向，关系弹簧拉近相关的图，再把每张图分配进一个对称的点阵圆
  function islandPositions(research, order) {
    const { screens } = research;
    const total = order.reduce((t, p) => t + Math.max(p.n, 2), 0);
    const sec = new Map(); let a = -Math.PI / 2;
    for (const p of order) { const w = Math.max(p.n, 2) / total * Math.PI * 2; sec.set(p.id, { a0: a, w, idx: sec.size }); a += w; }
    const area = CX * CY / .8, bands = {};
    let r0 = 0;
    for (const r of RINGS) { const n = screens.filter(s => s.ring === r).length; const r1 = Math.sqrt(r0 * r0 + n * area / Math.PI); bands[r] = [r0, r1]; r0 = r1 + 8; }
    const P = new Map();
    for (const s of screens) {
      const rnd = util.rng(s.id), sc = sec.get(s.patterns[0]), s2 = s.patterns[1] && sec.get(s.patterns[1]);
      let t = .15 + .7 * rnd();
      if (s2) t = s2.idx === (sc.idx + 1) % sec.size ? .7 + .25 * rnd() : .05 + .25 * rnd();
      const ang = sc.a0 + sc.w * t, [b0, b1] = bands[s.ring], rad = b0 + (b1 - b0) * (.15 + .7 * rnd());
      P.set(s, { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, rt: (b0 + b1) / 2 });
    }
    const springs = [];
    for (let i = 0; i < screens.length; i++) for (let j = i + 1; j < screens.length; j++) {
      const r = research.relation(screens[i], screens[j]);
      if (r.score >= .3) { const w = Math.min(1, r.score); springs.push([P.get(screens[i]), P.get(screens[j]), w, CX + 80 * (1 - w)]); }
    }
    const all = [...P.values()], N = 320;
    for (let it = 0; it < N; it++) {
      const heat = 1 - it / N;
      for (const [A, B, w, L] of springs) {
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, f = (d - L) / d * w * .045 * heat;
        A.x += dx * f; A.y += dy * f; B.x -= dx * f; B.y -= dy * f;
      }
      for (const p of all) { const d = Math.hypot(p.x, p.y) || 1, f = (p.rt - d) / d * .035; p.x += p.x * f; p.y += p.y * f; }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const A = all[i], B = all[j], dx = B.x - A.x, dy = B.y - A.y, ox = CX - Math.abs(dx), oy = CY - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) { const m = ox / 2 * Math.sign(dx || 1); A.x -= m; B.x += m; }
          else { const m = oy / 2 * Math.sign(dy || 1); A.y -= m; B.y += m; }
        }
      }
    }
    // 形状由数量决定：取包含 N 个格点的最小完整圆，多出来的格子在最外圈按角度均匀挑掉
    const n = screens.length, cells = [];
    const R = Math.ceil(Math.sqrt(n)) + 2;
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) cells.push({ x: i * CX, y: j * CY });
    cells.sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
    const rN = Math.hypot(cells[n - 1].x, cells[n - 1].y) + 1e-6;
    let slots = cells.filter(c => Math.hypot(c.x, c.y) <= rN);
    const extra = slots.length - n;
    if (extra > 0) {
      const shell = slots.filter(c => Math.hypot(c.x, c.y) > rN - CY * .75).sort((p, q) => Math.atan2(p.y, p.x) - Math.atan2(q.y, q.x));
      const drop = new Set(Array.from({ length: extra }, (_, i) => shell[Math.floor((i + .5) * shell.length / extra)]));
      slots = slots.filter(c => !drop.has(c));
    }
    // 把弹簧算出的理想位置缩放到圆的大小，再求总位移最小的一一对应
    const rs = Math.max(...slots.map(c => Math.hypot(c.x, c.y))), rp = Math.max(...all.map(p => Math.hypot(p.x, p.y))) || 1;
    const cost = screens.map(s => { const p = P.get(s); return slots.map(c => (p.x * rs / rp - c.x) ** 2 + (p.y * rs / rp - c.y) ** 2); });
    const assign = hungarian(cost), out = new Map();
    screens.forEach((s, i) => out.set(s, [slots[assign[i]].x, slots[assign[i]].y]));
    return out;
  }

  // 匈牙利算法：n×n 代价矩阵的最小权完美匹配，返回每行分到的列
  function hungarian(c) {
    const n = c.length, u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = new Float64Array(n + 1).fill(Infinity), used = new Uint8Array(n + 1);
      do {
        used[j0] = 1; const i0 = p[j0]; let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const ans = new Array(n);
    for (let j = 1; j <= n; j++) ans[p[j] - 1] = j - 1;
    return ans;
  }

  // 航道：每个模式一条横向航道，从左到右由直接竞品到远方启发；同一距离的列跨航道对齐
  function lanePositions(research, order) {
    const { screens, distance } = research;
    const lanes = order.map(p => ({ p, items: screens.filter(s => s.patterns[0] === p.id) }));
    const width = [1, 2, 3, 4].map(d => Math.max(1, ...lanes.map(l => l.items.filter(s => distance(s) === d).length)));
    const off = []; let x = 0;
    for (let d = 0; d < 4; d++) { off.push(x); x += width[d] + 1; }
    const positions = new Map();
    lanes.forEach((l, li) => [1, 2, 3, 4].forEach(d => l.items.filter(s => distance(s) === d).sort((a, b) => a.id - b.id).forEach((s, i) => positions.set(s, [(off[d - 1] + i) * CX, li * LANE_Y]))));
    const info = {
      lanes: lanes.map((l, li) => ({ name: l.p.name, n: l.items.length, y: li * LANE_Y, end: Math.max(0, ...l.items.map(s => positions.get(s)[0])) })),
      cols: off.map((o, d) => ({ x: (o + (width[d] - 1) / 2) * CX })),
    };
    return { positions, info };
  }

  // 场景：由布局坐标推出点阵遮挡、边界、核心、每张图到核心的距离，以及未走过线索的位置
  function composeScene(research, layout, positions, lanes, order) {
    const { screens, byId } = research;
    const at = s => positions.get(s);
    const covered = new Set();
    for (const s of screens) {
      const [gx, gy] = at(s);
      for (let i = Math.ceil((gx - TW / 2 - 6) / G); i <= Math.floor((gx + TW / 2 + 6) / G); i++)
        for (let j = Math.ceil((gy - TH / 2 - 6) / G); j <= Math.floor((gy + TH / 2 + 6) / G); j++) covered.add(`${i},${j}`);
    }
    const xs = screens.map(s => at(s)[0]), ys = screens.map(s => at(s)[1]);
    const bounds = { x0: Math.min(...xs) - TW, x1: Math.max(...xs) + TW, y0: Math.min(...ys) - TH, y1: Math.max(...ys) + TH };
    if (layout === "lanes") bounds.x0 -= CX * 3;
    const cs = screens.filter(s => s.ring === "R1").length ? screens.filter(s => s.ring === "R1") : screens;
    const core = { x: cs.reduce((t, s) => t + at(s)[0], 0) / cs.length, y: cs.reduce((t, s) => t + at(s)[1], 0) / cs.length };
    const coreDist = new Map(screens.map(s => [s, Math.hypot(at(s)[0] - core.x, at(s)[1] - core.y)]));
    const seaR = Math.max(...coreDist.values()) + CY;

    // 还没走过的线索：岛屿里漂到海岸线外，航道里排在航道的尽头
    const open = research.leads.filter(l => l.status !== "done" && l.from != null && byId.get(l.from));
    const taken = new Set();
    const free = (x, y) => !taken.has(`${x},${y}`) && !covered.has(`${x},${y}`);
    let leadDots;
    if (layout === "lanes") {
      const tail = new Map();
      leadDots = open.map(l => {
        const lane = lanes.lanes[order.findIndex(p => p.id === byId.get(l.from).patterns[0])];
        const n = (tail.get(lane) || 0) + 1; tail.set(lane, n);
        return { lead: l, x: lane.end + CX + n * G, y: lane.y };
      });
    } else {
      leadDots = open.map(l => {
        const f = byId.get(l.from), [fx, fy] = at(f), dx = fx - core.x, dy = fy - core.y, d = Math.hypot(dx, dy) || 1;
        for (let t = 0; t < 60; t++) {
          const x = Math.round((fx + dx / d * G * t) / G), y = Math.round((fy + dy / d * G * t) / G);
          const clear = screens.every(s => Math.abs(at(s)[0] - x * G) > TW / 2 + 30 || Math.abs(at(s)[1] - y * G) > TH / 2 + 30);
          if (clear && free(x, y)) { taken.add(`${x},${y}`); return { lead: l, x: x * G, y: y * G }; }
        }
        return null;
      }).filter(Boolean);
    }
    for (const L of leadDots) covered.add(`${Math.round(L.x / G)},${Math.round(L.y / G)}`);
    return { layout, positions, lanes: layout === "lanes" ? lanes : null, covered, bounds, core, coreDist, seaR, leadDots };
  }

  Sea.layout = Object.freeze({ patternOrder, islandPositions, lanePositions, composeScene, hungarian });
})(window.Sea = window.Sea || {});
