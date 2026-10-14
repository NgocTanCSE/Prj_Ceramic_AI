/**
 * Regression test: the EXACT user scenario.
 *   Upload a REAL ceramic bowl photograph (fetched live from Wikimedia Commons) to
 *   :8001/api/ai/clean-and-deconstruct with isolateSingleObject:true and assert the
 *   gate returns suitable=true (NOT blocked as flat_surface / multi_object).
 *
 *   Network is optional: if no real photo can be fetched (offline CI), the step
 *   WARNs and exits 0 so the overall suite still passes on the sample-based smoke.
 */
const API = process.env.AI_API_URL || 'http://localhost:8001';

let b64 = null;
try {
  const q = encodeURIComponent('ceramic bowl photograph');
  const listing = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&list=search&srlimit=40&srnamespace=6&srsearch=${q}&format=json`
  ).then(r => r.json());
  const titles = (listing.query?.search || []).map(i => i.title).filter(t => /\.(jpe?g|png)$/i.test(t));
  if (!titles.length) throw new Error('no bowl photo found on Commons');
  const info = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles[0])}&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json`
  ).then(r => r.json());
  const page = Object.values(info.query?.pages || {})[0];
  const url = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
  if (!url) throw new Error('no image url');
  const ab = await (await fetch(url)).arrayBuffer();
  b64 = 'data:image/jpeg;base64,' + Buffer.from(ab).toString('base64');
  console.log('[bowl] fetched real bowl photo:', titles[0], '(' + Buffer.from(ab).length + ' bytes)');
} catch (e) {
  console.warn('[bowl] WARN: could not fetch a real bowl photo (offline?), skipping real-photo gate check:', e.message);
  process.exit(0); // non-fatal: smoke_phases1to3 still covers the sample bowl
}

const j = await fetch(`${API}/api/ai/clean-and-deconstruct`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageBase64: b64, isolateSingleObject: true }),
}).then(r => r.json());

const s = j.suitability || {};
console.log('[bowl] real bowl photo -> success=' + j.success,
  'suitable=' + s.suitable, 'category=' + s.category,
  'objectCount=' + s.objectCount, 'circ=' + s.circularity,
  'areaRatio=' + s.areaRatio, 'shapeNote=' + s.shapeNote);

if (!j.success || s.suitable !== true) {
  console.error('[bowl] FAIL: a real bowl photo MUST be suitable=true (not blocked).');
  process.exit(1);
}
console.log('[bowl] PASS: real bowl photo accepted by the physical-object gate.');
process.exit(0);
