// Validate PURE parts of renderFidelity.js (silhouetteIoU / rgbMse) on synthetic data.
// WebGL capture path can only run in a real browser; the math here is the testable core.
import { silhouetteIoU, rgbMse } from '../FE/src/utils/renderFidelity.js';

let failures = 0;
const eq = (a, b, m) => { if (!(Math.abs(a - b) < 1e-6)) { console.error('  FAIL:', m, 'got', a, 'want', b); failures++; } };
const ok = (c, m) => { if (!c) { console.error('  FAIL:', m); failures++; } };

const size = 4;
const n = size * size;

// --- silhouetteIoU ---
const full = new Uint8Array(n).fill(1);
const empty = new Uint8Array(n).fill(0);
const half = new Uint8Array(n).fill(0);
for (let i = 0; i < n / 2; i++) half[i] = 1;

eq(silhouetteIoU(full, full, size, size), 1.0, 'identical masks IoU should be 1');
ok(Number.isNaN(silhouetteIoU(full, full, size, size)) === false, 'identical -> numeric');
eq(silhouetteIoU(full, empty, size, size), 0.0, 'disjoint masks IoU should be 0');
eq(silhouetteIoU(half, full, size, size), 0.5, 'half-overlap IoU should be 0.5');
eq(silhouetteIoU(empty, empty, size, size), 0.0, 'two empty masks IoU should be 0');

// --- rgbMse ---
const rgbaA = new Uint8Array(n * 4).fill(100); // all (100,100,100,100)
const rgbaB = new Uint8Array(n * 4).fill(100);
eq(rgbMse(rgbaA, rgbaB, n), 0, 'identical rgba mse should be 0');
// shift red +50 everywhere -> per-pixel (50^2)=2500 for R channel only -> mse = 2500
for (let i = 0; i < n * 4; i += 4) rgbaB[i] = 150; // r = 150
eq(rgbMse(rgbaA, rgbaB, n), 2500, 'red-shifted mse should be 2500');
// length mismatch -> Infinity
// length mismatch -> Infinity (note: eq() can't compare Inf-Inf=NaN, so check identity)
ok(rgbMse(rgbaA, new Uint8Array(n * 4 - 1), n) === Infinity, 'short buffer -> Infinity');

console.log(failures === 0 ? 'PASS: renderFidelity pure math (IoU + MSE)' : `FAIL: ${failures} assertion(s)`);
process.exit(failures === 0 ? 0 : 1);
