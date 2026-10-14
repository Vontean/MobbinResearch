// 第 1 层：领域模型。只依赖 config，不碰 DOM，也不改动原始数据
// 术语见仓库根目录 CONTEXT.md
(function (Sea) {
  "use strict";
  const { config } = Sea;

  function createResearch(data) {
    const screens = data.screens;
    const leads = data.leads || [];
    const byId = new Map(screens.map(s => [s.id, s]));
    const leadById = new Map(leads.map(l => [l.id, l]));
    const patternById = new Map(data.patterns.map(p => [p.id, p]));

    // 呼应 / 对照是双向的：两张图互相可见
    const echoes = new Map();
    for (const e of data.echoes || []) for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) {
      if (!echoes.has(a)) echoes.set(a, []);
      echoes.get(a).push({ other: b, kind: e.kind, note: e.note });
    }

    // 每张图由哪条线索找到，以及那条线索从哪张图长出来（父节点 id）
    const leadOf = new Map(), parentOf = new Map();
    for (const s of screens) {
      const lead = s.found_via ? leadById.get(s.found_via) : null;
      leadOf.set(s, lead || null);
      parentOf.set(s, lead && lead.from != null ? lead.from : null);
    }

    // 距离：1 = 直接竞品 … 4 = 表达启发（数据中的 ring）
    const distance = s => config.rings.indexOf(s.ring) + 1;

    // 线索链：从调研起点一路走到这张图
    const trail = s => {
      const out = [], seen = new Set();
      let c = s;
      while (c && !seen.has(c.id)) { out.unshift(c); seen.add(c.id); c = parentOf.get(c) != null ? byId.get(parentOf.get(c)) : null; }
      return out;
    };

    // 两张图的关系：共享模式、线索血缘、Agent 标注的呼应 / 对照、同一个 App
    function relation(a, b) {
      const pa = new Set(a.patterns), shared = b.patterns.filter(p => pa.has(p)).length;
      const jac = shared / new Set([...a.patterns, ...b.patterns]).size;
      const ap = parentOf.get(a), bp = parentOf.get(b);
      let lin = 0, tag = shared ? "PATTERN" : "APP";
      if (ap === b.id || bp === a.id) { lin = 1; tag = "LEAD"; }
      else if (a.found_via && a.found_via === b.found_via) { lin = .7; tag = "SIBLING"; }
      else if (ap != null && ap === bp) { lin = .5; tag = "SIBLING"; }
      const e = (echoes.get(a.id) || []).find(x => x.other === b.id);
      if (e) tag = e.kind === "contrast" ? "CONTRAST" : "ECHO";
      return { score: jac * .6 + lin * .55 + (e ? 1 : 0) + (a.app === b.app ? .15 : 0), tag };
    }

    const relKind = t => t === "LEAD" || t === "SIBLING" ? "lineage" : t === "ECHO" || t === "CONTRAST" ? "echo" : t === "PATTERN" ? "pattern" : "app";

    // 关联：按类型限额以保证多样，名额没用满时再按分数补齐；同分时优先距离相近、来自不同 App 的图
    function relatedOf(f) {
      const { max, minScore, cap } = config.related;
      const all = screens.filter(s => s !== f).map(s => ({ s, ...relation(f, s) })).filter(o => o.score >= minScore)
        .sort((x, y) => y.score - x.score || Math.abs(distance(x.s) - distance(f)) - Math.abs(distance(y.s) - distance(f)) || (x.s.app === f.app) - (y.s.app === f.app) || x.s.id - y.s.id);
      const used = {}, out = [];
      for (const o of all) { const k = relKind(o.tag); if (out.length < max && (used[k] || 0) < cap[k]) { out.push(o); used[k] = (used[k] || 0) + 1; } }
      for (const o of all) { if (out.length >= max) break; if (!out.includes(o)) out.push(o); }
      return out.sort((x, y) => y.score - x.score);
    }

    // 调研是否已完成：Agent 标记了 now.done，或已达到目标数量（没有目标时视为完成）
    const target = (data.brief || {}).target || 0;
    const complete = !!(data.now && data.now.done) || !target || screens.length >= target;

    return Object.freeze({
      data, screens, leads, byId, patternById, target, complete,
      echoesOf: id => echoes.get(id) || [],
      leadOf: s => leadOf.get(s),
      parentOf: s => parentOf.get(s),
      membersOf: pid => screens.filter(s => s.patterns.includes(pid)),
      distance, trail, relation, relatedOf,
    });
  }

  Sea.domain = Object.freeze({ createResearch });
})(window.Sea = window.Sea || {});
