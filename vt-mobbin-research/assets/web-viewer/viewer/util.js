// 第 0 层：与领域无关的纯工具函数
(function (Sea) {
  "use strict";

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n, w = 3) => String(n).padStart(w, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // 按 id 播种的确定性随机数：同一份数据每次布局都一样
  const rng = n => { let t = (n * 2654435761) >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };

  const ease = {
    inOut: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,   // 运镜：慢入慢出
    cubic: t => t < .5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2,    // 布局切换
    out: t => 1 - Math.pow(1 - t, 4),                                       // 聚焦推拉：快出缓停
    back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };

  Sea.util = Object.freeze({ esc, pad, clamp, smooth, rng, ease });
})(window.Sea = window.Sea || {});
