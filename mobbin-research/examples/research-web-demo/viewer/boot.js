// 第 5 层：任务书开场。把简报像终端启动一样逐行打在画布中央，结束时标题收进左上角
//   Loop 刚开始、还没有图：打完后停在"等待第一张图"，第一批图到来时收起
//   Replay：快速打一遍，收起后入场
(function (Sea) {
  "use strict";

  function create(app) {
    const { config, util } = app, { esc, pad } = util, B = config.boot, REDUCED = config.reduced;
    const el = document.getElementById("boot");
    let raf = 0, done = null, rush = null;

    // 简报 → 终端里的行：机器标签 + 人话
    function lines(data) {
      const b = data.brief || {}, seeds = (data.leads || []).filter(l => l.from == null);
      const out = [];
      if (b.users) out.push(["Users", b.users]);
      (b.questions || []).forEach((q, i) => out.push([i ? "" : "Questions", `${pad(i + 1, 2)}  ${q}`]));
      if ((b.screen_types || []).length) out.push(["Screens", b.screen_types.join(" · ")]);
      if (b.target) out.push(["Quota", [`${b.target} frames`, ...Object.entries(b.quotas || {}).map(([r, q]) => `${r} ${q}`)].join(" · ")]);
      if (seeds.length) out.push(["Seeds", seeds.map(l => l.text).join(" · ")]);
      return out;
    }

    // 逐字打出：每个文字节点按顺序显现，光标跟在正在打的那一行后面
    function play(data, { hold = false, char = B.char } = {}) {
      stop();
      const b = data.brief || {};
      el.innerHTML = `<div class="term">
        <div class="sys"><span data-t="Research sea / ${esc(b.date || "")}"></span></div>
        <div class="boot-title"><span data-t="${esc(b.product || "Research")}"></span></div>
        ${lines(data).map(([k, v]) => `<div class="kv"><span data-t="${esc(k)}"></span><span class="v" data-t="${esc(v)}"></span></div>`).join("")}
        ${hold ? `<div class="sys wait"><span data-t="Waiting for the first frame"></span></div>` : ""}
      </div>`;
      const parts = [...el.querySelectorAll("[data-t]")].map(node => ({ node, text: node.dataset.t }));
      const cursor = document.createElement("i"); cursor.className = "cursor";
      document.body.classList.add("booting"); el.classList.add("on");
      let t0 = performance.now(), base = 0;
      // 提前收起时：从已经打到的位置起，换成快速档补完
      rush = () => { const now = performance.now(); base += (now - t0) / char; t0 = now; char = Math.min(char, B.replayChar); };
      return new Promise(resolve => {
        done = resolve;
        const frame = now => {
          let left = REDUCED ? Infinity : base + (now - t0) / char, at = null;
          for (const p of parts) {
            const n = Math.min(p.text.length, Math.max(0, Math.floor(left)));
            if (p.node.textContent.length !== n) p.node.textContent = p.text.slice(0, n);
            if (n > 0 || !at) at = p.node;
            left -= p.text.length;
            if (left < 0) break;
          }
          if (cursor.previousSibling !== at) at.after(cursor);
          if (left >= 0) { raf = 0; rush = null; const d = done; done = null; d(); } else raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      });
    }

    // 收起：还没打完就快速补完；标题飞到左上角、落地时与那里的标题无缝交接，其余文字上移、模糊、淡出
    async function exit() {
      if (raf) { const typed = new Promise(r => { const d = done; done = () => { d && d(); r(); }; }); rush(); await typed; await new Promise(r => setTimeout(r, B.pause)); }
      stop();
      const title = el.querySelector(".boot-title span"), target = document.querySelector("#masthead .title");
      if (!title || REDUCED) { document.body.classList.remove("booting"); el.classList.remove("on"); return; }
      document.body.classList.add("landing"); document.body.classList.remove("booting");
      const a = title.getBoundingClientRect(), z = target.getBoundingClientRect(), s = z.height / a.height;
      const fly = title.animate([{ transform: "none" }, { transform: `translate(${z.left - a.left}px, ${z.top - a.top}px) scale(${s})` }],
        { duration: B.exit, easing: "cubic-bezier(.32,.72,0,1)", fill: "forwards" });
      [...el.querySelectorAll(".term > :not(.boot-title)")].forEach((row, i) => row.animate(
        [{ opacity: 1, transform: "none", filter: "blur(0)" }, { opacity: 0, transform: "translateY(-10px)", filter: "blur(3px)" }],
        { duration: B.exit * .5, delay: i * 18, easing: "ease-out", fill: "forwards" }));
      await fly.finished;
      document.body.classList.remove("landing"); el.classList.remove("on");
    }

    // 立即收起（用户在 Replay 打字时直接操作，交互还给用户）
    function cut() { stop(); el.classList.remove("on"); document.body.classList.remove("booting", "landing"); }
    function stop() { cancelAnimationFrame(raf); raf = 0; rush = null; if (done) { done(); done = null; } }

    return { play, exit, cut, get on() { return el.classList.contains("on"); } };
  }

  Sea.boot = Object.freeze({ create });
})(window.Sea = window.Sea || {});
