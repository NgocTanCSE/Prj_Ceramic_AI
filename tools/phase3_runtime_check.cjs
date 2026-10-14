/**
 * Phase 3 runtime verification (browser).
 * Verifies — against the REAL FE modules, rendered in Chromium — that:
 *  - text-on-pottery ("Chúc mùa giới mới 2026 🎉") renders centered on a 750×750
 *    Studio-bg canvas, wraps to multiple lines, font not too small, NO overflow/clipping;
 *  - circumference-aware `circScale` (derived from latheProfile) actually modulates the
 *    pattern render (regression guard for the cacheKey fix: latheProfile is now in cacheKey).
 *
 * Run:  node tools/phase3_runtime_check.cjs
 * (Playwright + Chromium must be installed: `npx playwright install chromium`.)
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FE_DIR = path.resolve(__dirname, '..', 'FE');
const HTML = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.module.js" } }</script>
</head><body><script type="module">
import { createCeramicTextureCanvas, getDefaultLatheProfile, radiusAtHeight } from './src/utils/ceramicTextureGenerator.js';
import { normalizeTextForPottery } from './src/utils/textNormalizer.js';
const W=750,H=750,glaze='#2A6B5C',bg={r:248,g:247,b:244};
const isTextInk=(d,i)=>d[i]>235&&d[i+1]>235&&d[i+2]>235;
function inkBbox(c,pred,y0,y1){const ctx=c.getContext('2d');const id=ctx.getImageData(0,0,c.width,c.height);const d=id.data,w=c.width;let minX=w,maxX=0,minY=w,maxY=0,count=0;for(let y=y0;y<=y1;y++){for(let x=0;x<w;x++){const i=(y*w+x)*4;if(pred(d,i)){count++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}}return{minX,maxX,minY,maxY,count};}
const bowl=getDefaultLatheProfile('bowl');
const tex=createCeramicTextureCanvas({glazeColor:glaze,customText:'Chúc mùa giới mới 2026 🎉',modelType:'bowl',width:W,height:H,latheProfile:bowl,pattern:'none'});
const t=inkBbox(tex,isTextInk,570,690);
const all=inkBbox(tex,isTextInk,0,H-1);
const norm=normalizeTextForPottery('Chúc mùa giới mới 2026 🎉');
const wide=[{y:-1,r:1.0},{y:1,r:1.0}],narrow=[{y:-1,r:1.0},{y:1,r:0.2}];
const rcW=0.85+0.45*radiusAtHeight(0.68*H,H,'bowl',wide);
const rcN=0.85+0.45*radiusAtHeight(0.68*H,H,'bowl',narrow);
const wc=createCeramicTextureCanvas({glazeColor:glaze,pattern:'hoa_dao',modelType:'bowl',width:W,height:H,latheProfile:wide});
const nc=createCeramicTextureCanvas({glazeColor:glaze,pattern:'hoa_dao',modelType:'bowl',width:W,height:H,latheProfile:narrow});
function bh(c){const id=c.getContext('2d').getImageData(0,420,W,140);const d=id.data;let h=0;for(let i=0;i<d.length;i+=4){h=(h*131+(d[i]+d[i+1]+d[i+2]))&0x7fffffff;}return h;}
window.__PHASE3={canvasSize:[tex.width,tex.height],textNorm:{lines:norm.lines,fontSize:norm.fontSize,lineCount:norm.lines.length},textInk:t,hasTextInkInBand:t.count,textHorizOverflow:(t.minX<=20||t.maxX>=W-20),textVertClip:(t.minY<570||t.maxY>690),allInkBbox:all,rcW,rcN,bhW: bh(wc),bhN: bh(nc),circF:true};
window.__PHASE3_READY=true;
</script></body></html>`;
const TMP = path.join(FE_DIR, '__phase3_test.html');

(async () => {
  fs.writeFileSync(TMP, HTML);
  const server = http.createServer((req, res) => {
    const file = req.url === '/' ? '__phase3_test.html' : req.url.replace(/^\//, '');
    const p = path.join(FE_DIR, file);
    fs.readFile(p, (e, data) => {
      if (e) { res.statusCode = 404; res.end('not found'); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.end(data);
    });
  });
  await new Promise(r => server.listen(5181, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[browser]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5181/', { waitUntil: 'networkidle', timeout: 30000 });
  const r = await page.waitForFunction(() => window.__PHASE3_READY && window.__PHASE3, null, { timeout: 20000 })
    .then(() => page.evaluate(() => window.__PHASE3));
  await browser.close();
  await new Promise(r => server.close(r));
  fs.unlinkSync(TMP);

  console.log('\n=== Phase 3 runtime result ===');
  console.log('canvas:', r.canvasSize, '| textNorm:', JSON.stringify(r.textNorm));
  console.log('textInk:', r.textInk.count, 'px | bbox x:', r.textInk.minX, '-', r.textInk.maxX, '| y:', r.textInk.minY, '-', r.textInk.maxY);
  console.log('  overflow(margin<20):', r.textHorizOverflow, '| vertClip:', r.textVertClip);
  console.log('circScale: wide=', r.rcW, 'narrow=', r.rcN, '| patternHashDiffers:', r.bhW !== r.bhN);

  let ok = true;
  const checks = [
    ['canvas 750x750', r.canvasSize[0] === 750 && r.canvasSize[1] === 750],
    ['text rendered (>500 px ink)', r.hasTextInkInBand > 500],
    ['no horizontal overflow (≥20px)', !r.textHorizOverflow],
    ['no vertical clipping', !r.textVertClip],
    ['font not too small (≥28px)', r.textNorm.fontSize >= 28],
    ['text wraps multi-line', r.textNorm.lineCount >= 2],
    ['circScale wide in [0.85,1.30]', r.rcW >= 0.85 && r.rcW <= 1.30],
    ['circScale narrow in [0.85,1.30]', r.rcN >= 0.85 && r.rcN <= 1.30],
    ['circScale profile-sensitive (wide≠narrow)', Math.abs(r.rcW - r.rcN) > 0.02],
    ['pattern reaches render (cacheKey includes latheProfile)', r.bhW !== r.bhN],
  ];
  console.log('\n=== Assertions ===');
  for (const [n, p] of checks) { console.log((p ? '✅' : '❌') + ' ' + n); if (!p) ok = false; }
  console.log('\n' + (ok ? '✅ PHASE 3 RUNTIME: ALL PASS' : '❌ PHASE 3 RUNTIME: FAILURES'));
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('RUN ERROR:', e.message); process.exit(2); });
