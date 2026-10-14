import fs from 'fs';
import path from 'path';

const API = 'http://localhost:8001';
const imgPath = path.resolve('FE/src/data/processed/pottery-bowl-004.png');
const img64 = 'data:image/png;base64,' + fs.readFileSync(imgPath, 'base64');

async function post(body) {
  const r = await fetch(API + '/api/ai/clean-and-deconstruct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

const health = await (await fetch(API + '/api/health')).json();
console.log('health:', health.status);

for (const id of ['pottery-bowl-004', 'pottery-mug-001', 'pottery-vase-001']) {
  const j = await post({ sampleId: id });
  const s = j.suitability || {};
  console.log(`[${id}] success=${j.success} views=${j.views.length} lathe=${j.lathePoints.length} | suitable=${s.suitable} score=${s.score} ${s.scoreLabel} | ${s.pliability} | aspect=${s.aspectFit} wall=${s.wallThickness} rim=${s.rimRisk}`);
}

const up = await post({ imageBase64: img64, isolateSingleObject: true });
console.log(`[upload base64] success=${up.success} views=${up.views.length} lathe=${up.lathePoints.length} | suitable=${up.suitability?.suitable} ${up.suitability?.scoreLabel}`);

// verify 6 views each have previewImg + distinct content hashes
const { views } = await post({ sampleId: 'pottery-bowl-004' });
const hashes = views.map((v) => (v.previewImg || '').slice(250, 258)); // small slice of body
console.log('view preview hashes (distinct => right-view fix):', hashes);
console.log('right != back (byte)?', views[3].previewImg !== views[1].previewImg);

// Lock Phase 2 normalization: every view MUST be exactly 750x750 chuẩn hoá
const dimOk = views.every((v) => {
  try {
    const b = Buffer.from((v.previewImg || '').split(',')[1], 'base64');
    return b.length > 24 && b.readUInt32BE(16) === 750 && b.readUInt32BE(20) === 750;
  } catch { return false; }
});
console.log('all 6 views are 750x750 (Phase 2 normalize):', dimOk);
