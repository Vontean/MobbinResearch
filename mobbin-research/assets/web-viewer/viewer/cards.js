// 第 5 层：面板卡片模板。纯函数：输入领域数据，输出 HTML 字符串；交互由 ui.js 统一绑定
//   data-goto      点击后聚焦到这张图
//   data-pattern   点击后打开模式面板
//   data-close     点击后离开
//   data-insight   悬停时高亮这条洞察的证据
//   data-tip       悬停或键盘聚焦时显示说明
(function (Sea) {
  "use strict";
  const { esc, pad } = Sea.util, glyph = Sea.glyph;

  // 说明提示：一句总述，加一张对照表（ol）或一个短列表（ul），可选一句补充（foot）
  const TIPS = {
    distance: { lead: "这张图离直接竞品有多远", ol: [["01", "同类产品"], ["02", "解决同一需求的其他产品"], ["03", "结构相似的产品"], ["04", "任意品类的表达启发"]], foot: "画布上格数越多，离中心越远" },
    trail: { lead: "这张图是怎么被找到的", ul: ["从调研起点出发", "Agent 每看到一张图，就顺着它想到下一条线索", "一路走到这张图；点任意一步可以跳过去"] },
    related: { lead: "和这张图最相关的图，最多 8 张", ol: [["LEAD", "由它的线索直接引出"], ["SIBLING", "来自同一条线索"], ["ECHO", "Agent 标注的呼应"], ["CONTRAST", "Agent 标注的对照"], ["PATTERN", "同一设计模式"], ["APP", "来自同一个 App"]] },
  };
  const tipHTML = t => `<p class="tip-lead">${esc(t.lead)}</p>`
    + (t.ol ? `<dl>${t.ol.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "")
    + (t.ul ? `<ul>${t.ul.map(v => `<li>${esc(v)}</li>`).join("")}</ul>` : "")
    + (t.foot ? `<p class="tip-foot">${esc(t.foot)}</p>` : "");
  const tipText = t => [t.lead, ...(t.ol || []).map(x => x.join(" ")), ...(t.ul || []), t.foot].filter(Boolean).join("；");
  const info = key => `<span class="info" tabindex="0" data-tip="${key}" aria-label="${esc(tipText(TIPS[key]))}">i</span>`;

  // Agent 笔记：以 "- " 开头的行排成列表，"标签：内容" 的标签加粗；其余按段落
  function rich(text, cls = "") {
    const lines = String(text ?? "").split(/\n+/).map(l => l.trim()).filter(Boolean);
    const item = l => { const m = l.match(/^([^：:]{1,8})[：:]\s*(.+)$/); return m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : esc(l); };
    if (!lines.some(l => /^[-·•]\s/.test(l))) return `<p class="${cls}">${lines.map(esc).join("<br>")}</p>`;
    const out = []; let list = [];
    const flush = () => { if (list.length) out.push(`<ul class="rich ${cls}">${list.map(l => `<li>${item(l)}</li>`).join("")}</ul>`); list = []; };
    for (const l of lines) { if (/^[-·•]\s/.test(l)) list.push(l.replace(/^[-·•]\s+/, "")); else { flush(); out.push(`<p class="${cls}">${esc(l)}</p>`); } }
    flush(); return out.join("");
  }

  const closeBtn = `<button class="meta" id="panel-close" data-close>Esc ${glyph("close")}</button>`;
  const thumb = (s, tag) => `<button class="thumb" data-goto="${s.id}" title="${esc(s.app)}"><img src="${esc(s.thumb)}" alt="" loading="lazy">${tag ? `<span class="tag">${tag}</span>` : ""}</button>`;
  const bar = (label, n, total) => `<div class="bar"><span>${esc(label)}</span><em>${pad(n, 2)}</em><span class="segs">${Array.from({ length: 12 }, (_, i) => `<i class="${i < Math.round(n / Math.max(1, total) * 12) ? "on" : ""}"></i>`).join("")}</span></div>`;

  function create(research) {
    const { distance, patternById: patById, byId, data: DATA, screens } = research;
    return {
      // 单张图：标题、Distance、Insight 与 Agent 笔记、Trail、Related、来源
      screen(s, related) {
        const tr = research.trail(s), ech = research.echoesOf(s.id);
        return `
      <section class="card"><div class="row meta"><span><i class="led"></i>Frame ${pad(s.id)}</span>${closeBtn}</div>
        <div class="title">${esc(s.app)}</div><div class="meta" style="margin-top:6px">${esc(s.screen_type)}</div>
        <div class="chips">${s.patterns.map(p => `<button class="chip" data-pattern="${esc(p)}">${esc(patById.get(p)?.name || p)}</button>`).join("")}</div></section>
      <section class="card"><div class="row meta"><span class="ttl">Distance ${info("distance")}</span><span class="dim">${pad(distance(s), 2)} / 04</span></div><div class="big-segs">${[1, 2, 3, 4].map(i => `<i class="${i <= distance(s) ? "on" : ""}"></i>`).join("")}</div></section>
      <section class="card"><div class="meta">Insight</div><div class="clip" style="--clip:168px"><p class="body-text">${esc(s.insight)}</p></div>
        <div class="note"><div class="meta dim">Agent note / round ${pad(s.round ?? 0, 2)}</div><div class="clip" style="--clip:150px">${rich(s.why_saved)}</div></div></section>
      <section class="card"><div class="row meta"><span class="ttl">Trail ${info("trail")}</span><span class="dim">${pad(tr.length, 2)} steps</span></div>
        <ol class="trail clip" style="--clip:300px">${tr.map((c, i) => { const lead = research.leadOf(c); return `<li data-goto="${c.id}" class="${c === s ? "self" : ""}"><span class="n">${pad(i + 1, 2)}</span><img src="${esc(c.thumb)}" alt=""><div><b>${esc(c.app)}</b><span>${esc(lead ? lead.text : "起点")}</span>${lead && lead.reason && i > 0 ? `<em>${esc(lead.reason)}</em>` : ""}</div></li>`; }).join("")}</ol></section>
      <section class="card"><div class="row meta"><span class="ttl">Related ${info("related")}</span><span class="rel-n">${pad(related.length, 2)}</span></div>
        <div class="thumbs">${related.map(o => thumb(o.s, o.tag)).join("")}</div>
        ${ech.length ? `<div class="clip" style="--clip:168px">${ech.map(e => `<p class="echo"><b>${e.kind === "contrast" ? "CONTRAST" : "ECHO"} ${pad(e.other)}</b>${esc(e.note)}</p>`).join("")}</div>` : ""}</section>
      ${s.source_url ? `<a class="card source" href="${esc(s.source_url)}" target="_blank" rel="noopener"><span class="meta">Open in Mobbin</span>${glyph("out")}</a>` : ""}`;
      },
      // 框选：数量、距离分布、共有模式、涉及的洞察、选中的图
      selection(list) {
        const pc = new Map(); list.forEach(s => s.patterns.forEach(p => pc.set(p, (pc.get(p) || 0) + 1)));
        const ids = new Set(list.map(s => s.id)), ins = (DATA.insights || []).filter(i => i.evidence.some(x => ids.has(x)));
        return `
      <section class="card"><div class="row meta"><span>Selection</span>${closeBtn}</div><div class="dot-num">${pad(list.length, 2)}</div><div class="meta" style="margin-top:8px">frames</div></section>
      <section class="card"><div class="meta">Distance</div><div class="bars">${[1, 2, 3, 4].map(d => bar("Distance " + pad(d, 2), list.filter(s => distance(s) === d).length, list.length)).join("")}</div></section>
      <section class="card"><div class="meta">Patterns</div><div class="bars">${[...pc].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, n]) => bar(patById.get(p)?.name || p, n, list.length)).join("")}</div></section>
      ${ins.length ? `<section class="card"><div class="meta">Insights</div><div class="clip" style="--clip:260px">${ins.map(i => `<div class="list-item"><p class="body-text">${esc(i.text)}</p></div>`).join("")}</div></section>` : ""}
      <section class="card"><div class="meta">Frames</div><div class="thumbs clip" style="--clip:380px">${list.map(s => thumb(s)).join("")}</div></section>`;
      },
      // 模式：名称与说明、数量与平均距离、共性 / 分叉 / 例外、成员
      pattern(id) {
        const p = patById.get(id), m = screens.filter(s => s.patterns.includes(id));
        const part = (t, v) => v ? `<section class="card"><div class="meta">${t}</div><div class="clip" style="--clip:180px">${rich(v, "body-text")}</div></section>` : "";
        return `
      <section class="card"><div class="row meta"><span>Pattern</span>${closeBtn}</div><div class="title">${esc(p.name)}</div><div class="clip" style="--clip:120px;margin-top:8px"><p class="sub-text">${esc(p.summary)}</p></div></section>
      <div class="stats">
        <section class="card"><div class="meta">Frames</div><div class="dot-num">${pad(m.length, 2)}</div></section>
        <section class="card"><div class="meta">Avg distance</div><div class="dot-num">${(m.reduce((t, s) => t + distance(s), 0) / Math.max(1, m.length)).toFixed(1)}</div></section>
      </div>
      ${part("Common", p.common)}${part("Forks", p.forks)}${part("Exceptions", p.exceptions)}
      <section class="card"><div class="meta">Members</div><div class="thumbs clip" style="--clip:380px">${m.map(s => thumb(s)).join("")}</div></section>`;
      },
      // 概览：简报、洞察、Agent 日志、精选、缺口
      overview() {
        const b = DATA.brief || {};
        return `
      <section class="card"><div class="row meta"><span>Brief / ${esc(b.date || "")}</span>${closeBtn}</div><div class="title">${esc(b.product || "Research")}</div>
        ${b.users ? `<p class="sub-text" style="margin-top:8px">${esc(b.users)}</p>` : ""}
        ${(b.questions || []).length ? `<ol class="qs">${b.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}</section>
      <section class="card"><div class="row meta"><span>Insights</span><span class="dim">${pad((DATA.insights || []).length, 2)}</span></div>
        <div class="clip" style="--clip:380px">${(DATA.insights || []).map(i => `<button class="list-item" data-insight="${esc(i.id)}"><p class="body-text">${esc(i.text)}</p><div class="meta dim">${pad(i.evidence.length, 2)} frames</div></button>`).join("")}</div></section>
      ${(DATA.checkpoints || []).length ? `<section class="card"><div class="meta">Agent log</div><div class="clip" style="--clip:340px">${DATA.checkpoints.map(c => `<div class="list-item"><div class="meta">${pad(c.at)}% / round ${pad(c.round, 2)}</div><div style="margin-top:6px">${rich(c.note, "body-text")}</div>${c.next ? `<p class="sub-text" style="margin-top:4px">→ ${esc(c.next)}</p>` : ""}</div>`).join("")}</div></section>` : ""}
      ${(DATA.picks || []).length ? `<section class="card"><div class="meta">Picks</div><div class="thumbs clip" style="--clip:320px">${DATA.picks.map(p => byId.get(p.id)).filter(Boolean).map(s => thumb(s)).join("")}</div></section>` : ""}
      ${(DATA.gaps || []).length ? `<section class="card"><div class="meta">Gaps</div><div class="clip" style="--clip:260px">${DATA.gaps.map(g => `<div class="list-item">${rich(g, "body-text")}</div>`).join("")}</div></section>` : ""}`;
      },
    };
  }

  Sea.cards = Object.freeze({ create, TIPS, tipHTML });
})(window.Sea = window.Sea || {});
