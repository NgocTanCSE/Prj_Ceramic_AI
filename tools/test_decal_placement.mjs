// VALIDATE (plain Node, NO WebGL): computeDecalPlacement lands decals on the lathe
// surface, normals are outward unit vectors, and DecalGeometry constructs without error.
import * as THREE from '../FE/node_modules/three/build/three.module.js';
import { DecalGeometry } from '../FE/node_modules/three/examples/jsm/geometries/DecalGeometry.js';
import { computeDecalPlacement, getDefaultModelProfile, getDefaultLatheProfile } from '../FE/src/utils/ceramicTextureGenerator.js';

let failures = 0;
const ok = (c, m) => { if (!c) { console.error('  FAIL:', m); failures++; } };

// Dòng chảy: profile = {x:r,y} (cùng dạng createCeramicGeometry nhận), build lathe + placement đồng bộ
const build = (profile) => profile.map((p) => new THREE.Vector2(p.x !== undefined ? p.x : p.r, p.y));

for (const modelType of ['bowl', 'mug', 'plate', 'vase', 'vase-narrow-neck']) {
  const profile = getDefaultModelProfile(modelType);              // shipped curves (used by body + placement)
  const pts = build(profile);
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.rotateY(Math.PI);
  const mesh = new THREE.Mesh(geo);
  mesh.updateMatrixWorld(true);

  for (const [cx, cy] of [[512, 800], [512, 300], [640, 700], [384, 500]]) {
    const pl = computeDecalPlacement(modelType, profile, cx, cy, 1024, 1024, 330, 330);
    // 1) position nằm trên bề mặt: |projected xz| ≈ r
    const pos = pl.position;
    const xzMag = Math.hypot(pos[0], pos[2]);
    ok(Math.abs(xzMag - pl.r) < 0.02, `${modelType} (${cx},${cy}): pos xz=${xzMag.toFixed(3)} != r=${pl.r.toFixed(3)}`);
    // 2) normal đơn vị
    const n = pl.normal;
    const nlen = Math.hypot(n[0], n[1], n[2]);
    ok(Math.abs(nlen - 1) < 1e-6, `${modelType}: normal len=${nlen.toFixed(4)} != 1`);
    // 3) normal hướng ra ngoài (dot pos_xz·normal_xz > 0)
    ok((pos[0] * n[0] + pos[2] * n[2]) >= -1e-9, `${modelType}: normal không hướng ra ngoài`);
    // 4) y trong phạm vi profile
    const ymin = Math.min(...profile.map(p => p.y)), ymax = Math.max(...profile.map(p => p.y));
    ok(pos[1] >= ymin - 1e-6 && pos[1] <= ymax + 1e-6, `${modelType}: y=${pos[1].toFixed(3)} ngoài [${ymin},${ymax}]`);
    // 5) size dương
    ok(pl.size[0] > 0 && pl.size[1] > 0 && pl.size[2] > 0, `${modelType}: size không dương`);
    // 6) DecalGeometry cấu tạo OK (CPU-only)
    let geoOk = true;
    try {
      const p = new THREE.Vector3(...pl.position);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...pl.normal));
      const s = new THREE.Vector3(...pl.size);
      const dg = new DecalGeometry(mesh, p, q, s);
      // lệch nhẹ cued để không z-fight (không ép buộc, chỉ kiểm tra có vertex)
      ok(dg.attributes.position.count > 0, `${modelType}: DecalGeometry rỗng`);
    } catch (e) { geoOk = false; ok(false, `${modelType}: DecalGeometry ném lỗi: ${e.message}`); }
  }
  console.log(`[ok] ${modelType}: profile validated (${profile.length} pts, r_max=${Math.max(...profile.map(p=>p.r)).toFixed(3)})`);
}

console.log(failures === 0 ? 'PASS: computeDecalPlacement + DecalGeometry validated for all profiles' : `FAIL: ${failures} assertion(s)`);
process.exit(failures === 0 ? 0 : 1);
