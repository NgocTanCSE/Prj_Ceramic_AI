// tools/verify_live.mjs — Verify live deployment of ceramicai.vercel.app
const URL = 'https://ceramicai.vercel.app';

console.log('Verifying live deployment:', URL);

const res = await fetch(URL);
console.log('Index HTML status:', res.status, res.headers.get('content-type'));
const html = await res.text();

const titleMatch = html.match(/<title>([^<]+)<\/title>/);
console.log('Page Title:', titleMatch ? titleMatch[1] : 'N/A');

const scriptMatches = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
const cssMatches = [...html.matchAll(/href="([^"]+\.css)"/g)].map(m => m[1]);

console.log('\nFound scripts:', scriptMatches);
for (const s of scriptMatches) {
  const assetUrl = s.startsWith('http') ? s : URL + s;
  const assetRes = await fetch(assetUrl);
  console.log(`  [${assetRes.status}] ${s} (${assetRes.headers.get('content-type')})`);
}

console.log('\nFound stylesheets:', cssMatches);
for (const c of cssMatches) {
  const assetUrl = c.startsWith('http') ? c : URL + c;
  const assetRes = await fetch(assetUrl);
  console.log(`  [${assetRes.status}] ${c} (${assetRes.headers.get('content-type')})`);
}

// Check SPA fallback routing
console.log('\nTesting SPA Fallback routing on non-root URL:');
const routes = ['/studio', '/gallery', '/aico'];
for (const r of routes) {
  const spaRes = await fetch(URL + r);
  console.log(`  [${spaRes.status}] ${r} (${spaRes.headers.get('content-type')})`);
}
