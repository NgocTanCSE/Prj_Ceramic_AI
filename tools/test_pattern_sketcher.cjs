const { chromium } = require('playwright');

const SKETCHER_JS = `
export async function sketchPatternImage(imgDataUrl, opts = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.CanvasRenderingContext2D) return imgDataUrl;
  if (typeof imgDataUrl !== 'string' || !imgDataUrl.startsWith('data:image')) return imgDataUrl;
  const threshold = opts.threshold ?? 0.04;
  const strength = opts.strength ?? 1.0;
  const img = await new Promise((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject;
    i.crossOrigin = 'anonymous'; i.src = imgDataUrl;
  });
  const w = img.width, h = img.height;
  if (w === 0 || h === 0) return imgDataUrl;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) return imgDataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h); const src = id.data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) { const r=src[i*4],g=src[i*4+1],b=src[i*4+2]; gray[i]=(0.299*r+0.587*g+0.114*b)|0; }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y=1;y<h-1;y++){ for (let x=1;x<w-1;x++){ const i=y*w+x; const n=gray[i-w],s=gray[i+w],wL=gray[i-1],e=gray[i+1],nw=gray[i-w-1],ne=gray[i-w+1],sw=gray[i+w-1],se=gray[i+w+1]; const gx=-nw-2*n-ne+sw+2*s+se; const gy=-nw-2*wL-sw+ne+2*e+se; const mag=Math.hypot(gx,gy)/(4*Math.SQRT2); if(mag>threshold){const a=(mag*255*Math.min(1,strength))|0;const j=i*4;out[j]=0;out[j+1]=0;out[j+2]=0;out[j+3]=a;} } }
  ctx.clearRect(0,0,w,h); ctx.putImageData(new ImageData(out,w,h),0,0);
  return canvas.toDataURL('image/png');
}
`;

const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body><script type="module">
${SKETCHER_JS}
(async () => {
  // synthetic: white bg + black filled circle (120x120)
  const c = document.createElement('canvas'); c.width=120; c.height=120;
  const ctx = c.getContext('2d');
  ctx.fillStyle='white'; ctx.fillRect(0,0,120,120);
  ctx.fillStyle='black'; ctx.beginPath(); ctx.arc(60,60,42,0,Math.PI*2); ctx.fill();
  const src = c.toDataURL('image/png');

  const sk = await sketchPatternImage(src);
  const o = document.createElement('canvas'); o.width=120; o.height=120;
  const octx = o.getContext('2d');
  const oimg = new Image();
  oimg.onload = () => {
    octx.drawImage(oimg, 0, 0);
    const d = octx.getImageData(0, 0, o.width, o.height).data;
    let transparent=0, lines=0;
    for (let i=0;i<120*120;i++){ const a=d[i*4+3]; if(a===0) transparent++; else lines++; }
    const cornerAlpha = d[3]; // (0,0)
    const pass = cornerAlpha===0 && transparent>10000 && lines>40 && lines<5000 && sk.length>200;
    console.log('SKETCH_RESULT ' + (pass?'PASS':'FAIL') + ' transparent='+transparent+' lines='+lines+' cornerAlpha='+cornerAlpha+' urlLen='+sk.length);
    window.__skDone = pass;
  };
  oimg.src = sk;
})();
</script></body></html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const msgs = [];
  page.on('console', m => msgs.push(m.text()));
  await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await page.waitForFunction('window.__skDone', null, { timeout: 6000 }).catch(() => {});
  await browser.close();
  const line = msgs.find(m => m.startsWith('SKETCH_RESULT')) || '';
  console.log('▶ ' + (line || 'no SKETCH_RESULT logged'));
  console.log(line.includes('PASS') ? '✅ patternSketcher functional check: PASS' : '❌ patternSketcher functional check: FAIL');
  process.exit(line.includes('PASS') ? 0 : 1);
})();
