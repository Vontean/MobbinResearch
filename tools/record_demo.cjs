#!/usr/bin/env node
// 录制产品演示：从任务书开场到收网，模拟一次完整的 Agent Loop，并演示设计师在其中能做的交互。
//
//   NODE_PATH=$(npm root -g) node tools/record_demo.cjs [out-dir]     默认 docs/media
//
// 需要：全局安装的 playwright（含 Chromium）、ffmpeg。产出：
//   research-sea-demo.mov   2880×1800 母版（H.264），不进版本库
//   research-sea-demo.mp4   1440 宽，体积小，可上传到 GitHub
//   research-sea-demo.gif   README 首屏用的精华动图（每一幕截一小段）
//
// 演示数据来自 tools/simulate_live.py --manual：录制脚本每发一行，它就写入下一批图并构建。
// 光标和字幕是录制时注入的，只存在于视频里，不属于查看器。
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "docs/media"));
const LIVE = fs.mkdtempSync(path.join(os.tmpdir(), "sea-live-"));
const FRAMES = fs.mkdtempSync(path.join(os.tmpdir(), "sea-frames-"));
const PORT = 4330, W = 1440, H = 900;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 录制时叠加的光标与字幕 ----------
const OVERLAY = `
addEventListener("DOMContentLoaded", () => {
  const css = document.createElement("style");
  css.textContent = \`
    #rec-cursor { position: fixed; z-index: 99; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border: 1.5px solid #fff; border-radius: 50%;
      pointer-events: none; opacity: 0; transition: opacity .3s, width .12s, height .12s, margin .12s; box-shadow: 0 0 0 1px rgba(0,0,0,.4); }
    #rec-cursor::after { content: ""; position: absolute; left: 50%; top: 50%; width: 3px; height: 3px; margin: -1.5px; border-radius: 50%; background: #fff; }
    #rec-cursor.down { width: 12px; height: 12px; margin: -6px 0 0 -6px; }
    #rec-cap { position: fixed; z-index: 98; left: 50%; top: 64px; width: min(560px, 60vw); transform: translate(-50%, -6px); opacity: 0; pointer-events: none;
      text-align: center; transition: opacity .45s cubic-bezier(.4,0,.2,1), transform .45s cubic-bezier(.4,0,.2,1); }
    #rec-cap.on { opacity: 1; transform: translate(-50%, 0); }
    #rec-cap .k { font: 400 11px/1.6 "Space Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: #999; }
    #rec-cap .t { margin-top: 4px; font: 500 17px/1.5 "Space Grotesk", "PingFang SC", sans-serif; color: #fff; text-shadow: 0 0 16px #000, 0 0 4px #000; }
    #rec-cap .k b { color: #f26522; font-weight: 400; }\`;
  document.head.append(css);
  const cur = Object.assign(document.createElement("div"), { id: "rec-cursor" });
  const cap = Object.assign(document.createElement("div"), { id: "rec-cap" });
  document.body.append(cur, cap);
  addEventListener("mousemove", e => { cur.style.opacity = 1; cur.style.transform = \`translate(\${e.clientX}px, \${e.clientY}px)\`; }, true);
  addEventListener("mousedown", () => cur.classList.add("down"), true);
  addEventListener("mouseup", () => cur.classList.remove("down"), true);
  let t = 0;
  window.__cap = (k, text) => {
    clearTimeout(t); cap.classList.remove("on");
    if (!text) return;
    t = setTimeout(() => { cap.innerHTML = \`<div class="k">\${k}</div><div class="t">\${text}</div>\`; cap.classList.add("on"); }, cap.textContent ? 380 : 0);
  };
});`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const sim = spawn("python3", [path.join(ROOT, "tools/simulate_live.py"), LIVE, "--manual", "--batch", "3"], { stdio: ["pipe", "pipe", "inherit"] });
  let shown = 0;
  sim.stdout.on("data", d => { const m = String(d).trim().split("\n").pop().match(/(\d+)\//); if (m) shown = +m[1]; });
  const step = async (n = 1, gap = 0) => { for (let i = 0; i < n; i++) { sim.stdin.write("\n"); if (gap) await sleep(gap); } };
  await sleep(1200);
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", LIVE], { stdio: "ignore" });
  await sleep(800);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = [], marks = [];
  // 精华片段：从某一刻起截取若干秒，拼成 README 用的动图
  const clip = secs => marks.push({ t: Date.now() / 1000, secs });
  cdp.on("Page.screencastFrame", f => {
    const file = path.join(FRAMES, `f${String(frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });

  // 镜头潜到最深一档的某个比例（以光标为中心滚动）
  const depthTo = async ratio => { for (let i = 0; i < 40; i++) { const r = await page.evaluate(() => Sea.app.camera.state.tk / Sea.app.camera.maxK()); if (Math.abs(r - ratio) < .04) break; await mouse.wheel(0, r < ratio ? 60 : -60); await sleep(45); } };
  const cap = (k, text) => page.evaluate(([k, t]) => window.__cap(k, t), [k, text]);
  const mouse = page.mouse;
  const glide = async (x, y, steps = 30) => mouse.move(x, y, { steps });
  const wheel = async (dy, times, gap = 40) => { for (let i = 0; i < times; i++) { await mouse.wheel(0, dy); await sleep(gap); } };
  // 某张图当前在屏幕上的中心
  const frameAt = id => page.evaluate(id => { const n = Sea.app.stage.nodes.find(n => n.s.id === id); const r = n && n.rect; return r ? [r.x + r.w / 2, r.y + r.h / 2] : null; }, id);
  const count = () => page.evaluate(() => Sea.app.stage.nodes.length);
  const waitCount = async n => { while (await count() < n) await sleep(100); };

  await page.goto(`http://localhost:${PORT}/`);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });

  // 01 任务启动：任务书逐字打出
  await sleep(900);
  clip(4.5);
  await cap("01 · Task starts", "Agent 写好任务书，在内置浏览器里打开调研之海");
  await page.waitForFunction(() => document.querySelector("#boot .wait")?.textContent.length > 20, null, { timeout: 30000 });
  await sleep(1400);

  // 02 生长：第一批图到来，标题收进左上角，入场下潜
  await cap("02 · Grow", "每保存一张截图，海就长出一张");
  await step(); await waitCount(3);
  clip(4);
  await sleep(4200);
  await glide(W * .5, H * .55, 20);
  await wheel(-120, 3, 60);                       // 稍微浮起，看着海长
  await sleep(600);
  await cap("02 · Grow", "新图从找到它的那条线索飞来；左上角是 Agent 此刻在追什么");
  clip(4);
  for (let i = 0; i < 8; i++) { await step(); await sleep(900); }
  await cap("02 · Grow", "每满 25%，Agent 写下检查点，海也整理一次");
  await step(); await sleep(2600);

  // 03 唤醒：停在一张图上，相关的图对上焦
  await cap("03 · Relate", "停下来，相关的图对上焦，其余的退进景深");
  let p = await frameAt(2); await glide(p[0], p[1], 30);
  await depthTo(.32); await sleep(700);           // 潜到中等深度，景深才看得清
  p = await frameAt(2); await glide(p[0] + 3, p[1] + 2, 12);
  clip(4); await sleep(2800);
  p = await frameAt(14); if (p) { await glide(p[0], p[1], 30); await sleep(2400); }

  // 04 排队：拖拽浏览时新图先等着
  await cap("04 · Browse", "你在浏览时，新图先排队（左上角的 +N），停手再落地");
  await mouse.move(W * .55, H * .5); await mouse.down();
  await step();
  for (let i = 0; i < 40; i++) { await mouse.move(W * .55 - i * 4, H * .5 - i * 1.5); await sleep(40); if (i === 15) await step(); }
  await sleep(900); await mouse.up();
  await sleep(2600);

  // 05 引导：设计师在聊天里说话，Agent 把它变成线索
  await cap("05 · Steer — <b>Designer, in chat</b>", "「多看看用温和语气表达状态的产品，别都是警报式的」");
  await sleep(3000);
  await cap("05 · Steer — Agent", "收到。下一轮去找健康和习惯类产品的温和状态，标为设计师的线索");
  await glide(W * .5, H * .5, 20); await wheel(-120, 4, 60);
  await glide(W * .82, H * .5, 25);
  while (shown < 39) { await step(); await sleep(700); }
  await waitCount(39); await sleep(1500);

  // 06 聚焦：点开设计师线索找到的那张图
  await cap("06 · Focus", "点开一张图：洞察、Agent 的笔记、它是怎么被找到的");
  p = await frameAt(38); await glide(p[0], p[1], 40); await sleep(500);
  clip(4.5);
  await mouse.down(); await sleep(90); await mouse.up();
  await sleep(2600);
  await page.evaluate(() => { const t = document.querySelector("#panel .trail"); t.closest(".card").scrollIntoView({ behavior: "smooth", block: "center" }); });
  await sleep(1200);
  await cap("06 · Focus", "Trail 里标着 DESIGNER 的一步，来自你在聊天里的引导");
  const row = await page.evaluate(() => { const li = [...document.querySelectorAll("#panel .trail li")].pop().getBoundingClientRect(); return [li.x + 120, li.y + li.height / 2]; });
  await glide(row[0], row[1], 30); await sleep(3200);
  await cap("06 · Focus", "Esc：面板收起，镜头往后拉，看见更多");
  await glide(W * .4, H * .5, 25); await sleep(400);
  await page.keyboard.press("Escape"); await sleep(2600);
  await page.keyboard.press("f"); await sleep(1400);

  // 07 继续 Loop
  await cap("07 · Loop", "Agent 继续扩散：直接竞品 → 间接竞品 → 结构相似 → 表达启发");
  await glide(W * .9, H * .2, 20);
  while (shown < 99) { await step(); await sleep(420); }
  await waitCount(99); await sleep(2400);

  // 08 收网
  await cap("08 · Finale", "Loop 结束：镜头回到全貌，一道光扫过整片海");
  clip(5);
  await step(); await sleep(6200);
  await cap("08 · Finale", "蒸馏的洞察、精选与缺口，都在 Insight 里");
  const ib = await page.evaluate(() => { const r = document.getElementById("t-insight").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await glide(ib[0], ib[1], 30); await mouse.down(); await sleep(90); await mouse.up();
  await sleep(4200);
  await cap(null); await sleep(1200);

  await cdp.send("Page.stopScreencast");
  await browser.close(); server.kill(); sim.kill();
  encode(frames, marks);
}

// 屏幕帧按真实时间戳排成 30fps，再输出三种格式
function encode(frames, marks) {
  const list = path.join(FRAMES, "list.txt");
  fs.writeFileSync(list, frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1] || f).t - f.t || 1 / 30).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`);
  const ff = args => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  const mov = path.join(OUT, "research-sea-demo.mov"), mp4 = path.join(OUT, "research-sea-demo.mp4"), gif = path.join(OUT, "research-sea-demo.gif");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=2880:1800:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mov]);
  ff(["-i", mov, "-vf", "scale=1440:-2:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
  // 精华动图：按录制时打下的标记截取片段，拼接后统一调色板
  const t0 = frames[0].t, cuts = marks.map(m => `[0:v]trim=${(m.t - t0).toFixed(2)}:${(m.t - t0 + m.secs).toFixed(2)},setpts=PTS-STARTPTS[c${marks.indexOf(m)}]`);
  const join = `${cuts.join(";")};${marks.map((_, i) => `[c${i}]`).join("")}concat=n=${marks.length}:v=1,fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  ff(["-i", mov, "-filter_complex", join, gif]);
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.rmSync(LIVE, { recursive: true, force: true });
  for (const f of [mov, mp4, gif]) console.log(`${path.relative(ROOT, f)}  ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
}

main().catch(e => { console.error(e); process.exit(1); });
