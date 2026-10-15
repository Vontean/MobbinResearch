// 第 0 层：调参。所有时序、阈值和尺寸只在这里定义，DESIGN.md 解释它们的设计意图
(function (Sea) {
  "use strict";

  const G = 26;
  Sea.config = Object.freeze({
    // 世界单位：点阵间距 G，截图 TW×TH；截图中心落在格点上（列距 2G、行距 4G），航道间距 6G
    grid: { G, TW: 36, TH: 78, CX: 2 * G, CY: 4 * G, LANE_Y: 6 * G },
    rings: ["R1", "R2", "R3", "R4"],
    layouts: ["island", "lanes"],

    // 关联：最多 8 张，按类型限额以保证多样
    related: { max: 8, minScore: .3, cap: { lineage: 3, echo: 3, pattern: 4, app: 2 } },

    camera: {
      diveRatio: .18,      // 入场下潜后，每张图占画面高度的比例
      focusRatio: .75,     // 最深一档（聚焦）
      leaveRatio: .4,      // 退出聚焦后，停在最深一档的这个比例
      minFitRatio: .95,    // 最浅只能缩到适配视图的这个比例
      deepFitRatio: 1.8,   // 超过适配视图这么多倍，算"已潜入"
      follow: 11,          // 镜头跟随的指数速率
      glideFriction: 3.2,  // 松手滑行的衰减
      fly: { dive: 1300, surface: 1200, focus: 850, snap: 480, leave: 700, deepLink: 900, finale: 1600, filter: 900, step: 560, stepRow: 760 },
    },

    // 聚焦：迟滞区间（进入 60%、松开 45%），预判容差，延迟收起；聚焦时用滚轮往回缩到 85% 以下就当作离开
    focus: { enter: .6, release: .45, pullOut: .85, hoverPick: .85, settle: 90, pickX: .9, pickY: .7, closeDelay: 280, closeQuiet: 260 },

    // 唤醒（悬停景深）：停留门槛、切换门槛、操作后的冷却、离开延迟、扩散速度（px/ms）、明暗速率
    wake: { dwell: 320, switchDwell: 420, speed: .6, switchSpeed: .35, cooldown: 250, leave: 450, spread: 2.2, rate: 16 },

    entrance: { speed: 1.6, diveDelay: 350, diveSlack: 200 },
    // 收网：镜头回到首帧后，一道光波从核心荡过整片海（只照亮，不隐藏）；光带宽度与亮度
    finale: { band: 70, lift: .35, delay: 200 },
    layoutMorph: { duration: 900, stagger: 14 },
    panel: { width: 400, gap: 16 },
    // 聚焦时的上一张 / 下一张按钮：离图片底边的距离、按钮尺寸（px）
    focusNav: { gap: 48, size: 40 },
    // 卡片内滚动条：停止滚动后多久淡出、光标离开卡片后多久淡出、滑块最短长度（ms / px）
    scrollbar: { idle: 900, leave: 300, minThumb: 24 },
    // 任务书开场：每个字的间隔、第一张图来时没打完的部分改用的快速档、补完后的停顿、收起时长（ms）
    boot: { char: 22, rushChar: 7, pause: 450, exit: 640 },
    // 实时更新：读取间隔、用户停手多久后才并入新数据（ms）
    live: { poll: 1500, settle: 1200 },

    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
})(window.Sea = window.Sea || {});
