// tools/benchmark_3d.mjs — Performance benchmark for 3D Lathe & Silhouette algorithms
import { performance } from 'perf_hooks';
import { imageToLathePoints, maskAndBbox, silhouetteToLathePoints, buildObjectMask, STUDIO_BG } from '../AI/lathe.js';

function createSyntheticPotteryImage(w, h, modelType = 'bowl') {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const { r: br, g: bg, b: bb } = STUDIO_BG;

  // Fill with studio background
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    rgba[idx] = br;
    rgba[idx + 1] = bg;
    rgba[idx + 2] = bb;
    rgba[idx + 3] = 255;
  }

  // Draw ceramic silhouette
  for (let y = Math.round(h * 0.2); y < Math.round(h * 0.85); y++) {
    const normY = (y - h * 0.2) / (h * 0.65); // 0 at top, 1 at foot
    let r;
    if (modelType === 'bowl') {
      // parabolic/flare shape: wide top, narrow foot
      r = (w * 0.35) * (0.3 + 0.7 * (1 - normY));
    } else if (modelType === 'vase') {
      // bulbous body, narrow neck
      r = (w * 0.25) * (0.4 + 0.6 * Math.sin(normY * Math.PI));
    } else if (modelType === 'plate') {
      // flat, wide
      r = (w * 0.45) * Math.sqrt(Math.max(0.01, 1 - normY * 0.8));
    } else {
      // mug: cylindrical with belly
      r = (w * 0.22) * (0.9 + 0.1 * Math.sin(normY * Math.PI));
    }

    const xLeft = Math.round(cx - r);
    const xRight = Math.round(cx + r);
    for (let x = Math.max(0, xLeft); x <= Math.min(w - 1, xRight); x++) {
      const idx = (y * w + x) * 4;
      rgba[idx] = 42;    // Teal glaze
      rgba[idx + 1] = 107;
      rgba[idx + 2] = 92;
      rgba[idx + 3] = 255;
    }
  }

  return { rgba, w, h };
}

function runBenchmark(iterations = 30) {
  const shapes = ['bowl', 'vase', 'plate', 'mug'];
  const testImages = shapes.map(s => ({
    type: s,
    ...createSyntheticPotteryImage(800, 800, s)
  }));

  // Warmup
  for (let i = 0; i < 5; i++) {
    for (const img of testImages) {
      imageToLathePoints(img.rgba, img.w, img.h, { modelType: img.type });
    }
  }

  const results = {};

  for (const img of testImages) {
    const times = [];
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = imageToLathePoints(img.rgba, img.w, img.h, { modelType: img.type });
      const t1 = performance.now();
      times.push(t1 - t0);
    }

    const memAfter = process.memoryUsage().heapUsed;

    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;

    results[img.type] = {
      medianMs: Number(median.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      meanMs: Number(mean.toFixed(2)),
      minMs: Number(times[0].toFixed(2)),
      maxMs: Number(times[times.length - 1].toFixed(2)),
      heapDeltaMB: Number(((memAfter - memBefore) / 1024 / 1024).toFixed(3))
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

runBenchmark(40);
