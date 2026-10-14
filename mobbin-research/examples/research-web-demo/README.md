# 调研网演示

用模拟数据演示查看器：100 张图、6 个模式、四个圈层，领域是手机端网络安全防护 App。

```bash
python3 -m http.server 4317 --directory mobbin-research/examples/research-web-demo
```

然后打开 <http://localhost:4317>。也可以直接双击 `index.html`。

`index.html`、`viewer/` 和 `research.js` 都是构建产物，不要直接修改：

```bash
python3 tools/make_demo.py          # 重新生成 research.json（可选）
python3 mobbin-research/scripts/build_web.py mobbin-research/examples/research-web-demo
```

- `research.json` 中的 App 名、洞察、线索都是**模拟数据**，用来展示交互，不是真实调研结论。
- `screens/` 中的图片由 5 张 Unsplash 抽象图裁切成手机截图比例，代替 Mobbin 截图。原图：
  [5Q9Gf0WSyLk](https://unsplash.com/photos/5Q9Gf0WSyLk)、
  [5q4zsTaVN4I](https://unsplash.com/photos/5q4zsTaVN4I)、
  [c0B1HYG6ZK4](https://unsplash.com/photos/c0B1HYG6ZK4)、
  [dYksH3vHorc](https://unsplash.com/photos/dYksH3vHorc)、
  [ZQSPIiFEMoU](https://unsplash.com/photos/ZQSPIiFEMoU)
