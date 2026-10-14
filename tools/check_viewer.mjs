#!/usr/bin/env node
// 查看器回归检查：先对 viewer/ 下所有脚本做语法检查（任何一个出错，页面都会缺层）；
// 再在 Node 里加载纯函数层（domain、layout、cards），用演示数据算出布局、关联、线索链、场景和面板模板，与快照逐项比对。
//
//   node tools/check_viewer.mjs            比对；有差异时退出码为 1
//   node tools/check_viewer.mjs --update   有意改变行为后，更新快照
//
// 交互（唤醒、聚焦、镜头）依赖浏览器，按 ARCHITECTURE.md 的"验证"一节手动检查。
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIEWER = join(ROOT, "mobbin-research/assets/web-viewer/viewer");
const DEMO = join(ROOT, "mobbin-research/examples/research-web-demo/research.json");
const SNAPSHOT = join(ROOT, "tools/viewer.snapshot.json");

for (const f of readdirSync(VIEWER).filter(f => f.endsWith(".js"))) {
  try { new vm.Script(readFileSync(join(VIEWER, f), "utf8"), { filename: f }); }
  catch (e) { console.log(`语法错误 viewer/${f}：${e.message}`); process.exit(1); }
}

const window = { matchMedia: () => ({ matches: false }) };
const ctx = vm.createContext({ window, matchMedia: window.matchMedia });
for (const m of ["util", "config", "glyph", "domain", "layout", "cards"]) vm.runInContext(readFileSync(join(VIEWER, `${m}.js`), "utf8"), ctx, { filename: `${m}.js` });
const { Sea } = window;

const H = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const r6 = v => Math.round(v * 1e6) / 1e6;

const R = Sea.domain.createResearch(JSON.parse(readFileSync(DEMO, "utf8")));
const L = Sea.layout, screens = R.screens, order = L.patternOrder(R);
const isl = L.islandPositions(R, order), ln = L.lanePositions(R, order);
const scene = name => {
  const sc = L.composeScene(R, name, name === "lanes" ? ln.positions : isl, name === "lanes" ? ln.info : null, order);
  return { bounds: Object.fromEntries(Object.entries(sc.bounds).map(([k, v]) => [k, r6(v)])), core: [r6(sc.core.x), r6(sc.core.y)], seaR: r6(sc.seaR),
    leads: sc.leadDots.map(l => [l.lead.id, r6(l.x), r6(l.y)]), covered: H([...sc.covered].sort().join(";")), coveredN: sc.covered.size };
};
const data = {
  island: screens.map(s => [s.id, ...isl.get(s).map(r6)]),
  lanes: screens.map(s => [s.id, ...ln.positions.get(s).map(r6)]),
  lanesInfo: JSON.parse(JSON.stringify(ln.info)),
  related: screens.map(s => [s.id, R.relatedOf(s).map(o => [o.s.id, o.tag, r6(o.score)])]),
  trail: screens.map(s => [s.id, R.trail(s).map(c => c.id)]),
  patOrder: order.map(p => p.id),
  sceneLanes: scene("lanes"),
  sceneIsland: scene("island"),
};
const C = Sea.cards.create(R), html = {};
for (const id of [1, 11, 25, 51, 99]) { const s = R.byId.get(id); html["screen" + id] = C.screen(s, R.relatedOf(s)); }
html.overview = C.overview();
for (const p of R.data.patterns) html["pattern-" + p.id] = C.pattern(p.id);
html.selection = C.selection(screens.slice(0, 12));

const current = {
  ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, H(JSON.stringify(v))])),
  ...Object.fromEntries(Object.entries(html).map(([k, v]) => ["html:" + k, H(v)])),
};

if (process.argv.includes("--update")) {
  writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + "\n");
  console.log(`快照已更新：${Object.keys(current).length} 项`);
} else {
  const saved = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const keys = [...new Set([...Object.keys(saved), ...Object.keys(current)])];
  const diff = keys.filter(k => saved[k] !== current[k]);
  if (diff.length) { console.log(`不一致 ${diff.length} 项：${diff.join("、")}`); process.exit(1); }
  console.log(`一致：${keys.length} 项`);
}
