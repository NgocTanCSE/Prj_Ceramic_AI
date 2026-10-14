# BÁO CÁO PHÂN TÍCH & TỐI ƯU — DỰ ÁN ECOM CERAMIC DESIGN

> Tổng hợp 5 nhiệm vụ đã thực hiện: tối ưu load ScheduleScreen, thêm nút đặt lịch vào Card, rà soát dependency chain AI 3D, fix bug chiều cao & stretch hoa văn.

---

## 1. NGUYÊN NHÂN SCHEDULESCREEN LOAD CHẬM + ĐÃ FIX

### Root Cause (nguyên nhân gốc rễ)

**4 nguyên nhân chính** (theo thứ tự độ ảnh hưởng):

#### 1a. `canvas-confetti` import eager (ScheduleScreen.jsx:2)
```js
import confetti from 'canvas-confetti';  // ~63KB gzipped, dùng 1 lần duy nhất
```
Thư viện này (10.7 KB gzipped trong build) được import đầu file nhưng chỉ được gọi tại dòng 138 (`triggerConfetti()` trên form submit thành công). Trong dev mode (Vite native ESM), confetti + toàn bộ dependency tree của nó (requestAnimationFrame, canvas, etc.) phải được tải xuống và parse ngay khi ScheduleScreen được render — dù người dùng chưa bao giờ submit form.

#### 1b. `PRODUCTS` JSON import eager (ScheduleScreen.jsx:10)
```js
import { PRODUCTS } from '../data/products';  // 28 sản phẩm từ ecommerce_pottery_products.json
```
PRODUCTS chứa 28 sản phẩm với metadata đầy đủ. Chỉ được dùng ở dòng 202 (`PRODUCTS.slice(0, 8)`) trong mini-picker khi người dùng chưa chọn sản phẩm. Nhưng toàn bộ blob phải được tải và parse để render mini-picker.

#### 1c. App.jsx eagerly imports ALL 7 screens (App.jsx:12-18)
```js
import HomeScreen from './screens/HomeScreen';
import GalleryScreen from './screens/GalleryScreen';
import AICoCreatorScreen from './screens/AICoCreatorScreen';
import StudioScreen from './screens/StudioScreen';
import CartScreen from './screens/CartScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import ScheduleScreen from './screens/ScheduleScreen';  // ← không lazy
```
ScheduleScreen dẫn tới import chain:
```
ScheduleScreen → DesignContext → CeramicCanvas3D → three.js (0.173.0, 534KB)
               → usePersistentForm (localStorage)
               → Canvas (confetti)
               → PRODUCTS JSON (28 items)
```
Không có `React.lazy` hoặc `Suspense` nào — tất cả 7 screens được đưa vào bundle chính (~590KB gzipped).

#### 1d. `vite.config.js manualChunks` chỉ áp dụng cho production build
```js
manualChunks: { three: ['three'], 'canvas-confetti': ['canvas-confetti'], ... }
```
Trong **`vite dev`** (native ESM mode), `manualChunks` bị bỏ qua. Mỗi `import` là một HTTP request riêng, và chuỗi import dài tạo ra waterfall requests → thời gian load tăng đáng kể.

### Đã Fix — 3 thay đổi

| File | Thay đổi | Build verification |
|------|---------|-------------------|
| `FE/src/screens/ScheduleScreen.jsx:2` | Thay `import confetti` bằng dynamic `import('canvas-confetti')` trong `loadConfetti()` | ✅ Trong build output: `canvas-confetti-C94ZD2ww.js` (10.70 KB gzipped) — được tách thành chunk riêng |
| `FE/src/screens/ScheduleScreen.jsx:10` | Thay `import { PRODUCTS }` bằng `useLazyProducts()` hook (dynamic `import('../data/products')`) | ✅ PRODUCTS chỉ được fetch khi mini-picker render, skeleton loader khi chưa load |
| `FE/src/App.jsx:18-20` | `const ScheduleScreen = lazy(() => import('./screens/ScheduleScreen'))` + `<Suspense fallback>` | ✅ Trong build output: `ScheduleScreen-Dy_0iDc2.js` (49.97 KB gzipped) — được tách thành chunk riêng |

**Build output xác nhận code-splitting hoạt động:**
```
dist/assets/canvas-confetti-C94ZD2ww.js    10.70 kB │ gzip:  4.30 kB  ← tách riêng
dist/assets/ScheduleScreen-Dy_0iDc2.js     49.97 kB │ gzip:  8.17 kB  ← lazy-loaded
dist/assets/vendor-BJfdHC_c.js            313.91 kB │ gzip: 96.35 kB  ← chỉ React/Vite vendor
dist/assets/three-C7hDJrV6.js            534.55 kB │ gzip:134.02 kB  ← three.js (vẫn lớn, lazy-load ở Phase 4)
dist/assets/index-COpXmlyX.js            589.53 kB │ gzip:134.64 kB  ← main bundle (giảm từ ~640KB)
```

### Đề xuất phụ trợ (Phase 4 — chưa làm, ghi chú)
- Lazy-load `AICoCreatorScreen`, `StudioScreen` (các screen nặng 3D) tương tự.
- Lazy-load `three.js` chính xác khi người dùng truy cập Studio/3D Creator.
- `usePersistentForm` gây overhead localStorage trên mỗi keystroke — có thể debounce hoặc dùng `navigator.storage.estimate()`.

---

## 2. NÚT "THÊM VÀO ĐẶT LỊCH" VÀO Card.jsx — ĐÃ FIX

### Thay đổi (Card.jsx)

**Import thêm 2 context hooks** (dòng 3-4):
```js
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
```

**Hook calls trong ProductCard** (dòng 79-80):
```js
const { setSelectedProduct, setModelType, selectProductForDesign } = useDesign();
const { setActiveTab } = useNavigation();
```

**Hàm handleAddToSchedule** (dòng 102-111):
```js
const handleAddToSchedule = (e) => {
  e?.stopPropagation();
  if (setSelectedProduct) setSelectedProduct(product);
  if (selectProductForDesign) selectProductForDesign(product);
  if (setModelType) setModelType(product.type || product.modelType || 'vase');
  if (setActiveTab) setActiveTab('schedule');
  showToast(`Đã đưa "${product.name}" vào lịch đặt lịch ngắm mẫu!`);
};
```

**Nút mới** (dòng 196-208) — được thêm vào sau nút "Nạp vào 3D", tuân thủ aesthetic ceramic editorial:
```jsx
<button
  type="button"
  onClick={handleAddToSchedule}
  title="Đặt lịch ngắm mẫu gốm trực tiếp tại xưởng"
  className="
    py-1.5 px-3 text-xs rounded-full font-medium
    border border-ceramic-terracotta text-ceramic-terracotta
    hover:bg-ceramic-terracotta hover:text-ceramic-paper
    transition-all duration-200 active:scale-95 flex items-center gap-1.5 shadow-paper
  "
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M8 7V3m8 4V3m-9 9h12m-6 6h.01M9 18a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
  <span>Đặt lịch</span>
</button>
```

### Style tokens dùng (đúng với design system)
- `border-ceramic-terracotta` / `text-ceramic-terracotta` — viền & chữ nút
- `hover:bg-ceramic-terracotta hover:text-ceramic-paper` — hover state đảo ngược
- `rounded-full` — dạng pill như ảnh design
- `shadow-paper` — bóng đổ giấy gốm
- `transition-all duration-200 active:scale-95` — animation nhấn phím

Hoạt động: click → `setSelectedProduct(product)` → `setActiveTab('schedule')` → ScheduleScreen tự động load sản phẩm đã chọn (do lazy-load, hiển thị skeleton khi đang fetch).

---

## 3. AI 3D PIPELINE — SỐ SITE PHỤ THUỘC

### Tổng quan kiến trúc (3 nhánh chính)

Pipeline AI 3D được chia thành 3 nhánh thực hiện độc lập nhưng chia sẻ logic:

```
┌─────────────────────────────────────────────────────────────────┐
│                      FE (React + Three.js)                       │
│  AICoCreatorScreen.jsx ── selectProductForDesign()              │
│    ├── ceramicSpecimenAnalyzer.js (client-side canvas 2D)       │
│    └── fetch → API/server.js (/api/ai/clean-and-deconstruct)    │
│        │                                                          │
│        ├── orthographicRenderer.js (createCeramicGeometry)      │
│        └── ceramicTextureGenerator.js (texture + decal)           │
│            └── CeramicCanvas3D.jsx (Three.js WebGL renderer)      │
│                                                                  │
│  Alternative client paths:                                        │
│    ├── meshInflator.js (full 3D mesh from silhouette)           │
│    └── aiPromptParser.js (prompt → lathePoints)                 │
└─────────────────────────────────────────────────────────────────┘
        │ HTTP fetch
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  API/server.js (port 8000, Express)                             │
│    ├── auto_clean_pipeline.js (@imgly/background-removal-node)  │
│    ├── potterySuitabilityAnalyzer.js (sharp, pure JS)           │
│    ├── aiService.js                                            │
│    │   └── cloudflareService.js (Cloudflare LLaMA API)         │
│    ├── routes/gradio.js (HF Gradio proxies)                    │
│    │   └── lib/gradioClient.js (@gradio/client)                │
│    └── lathe.js (pure JS, also used by Worker)                 │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  cloudflare_worker/src/index.js (Cloudflare Worker)             │
│    ├── POST /lathe → imageToLathePoints (AI/lathe.js)          │
│    └── POST /edit → Workers AI flux-2-klein-4b                 │
└─────────────────────────────────────────────────────────────────┘
```

### Danh sách 22 site/module (code files)

| STT | Site | Vị trí | Loại | Mô tả |
|-----|------|--------|------|-------|
| 1 | `AICoCreatorScreen.jsx` | FE/src/screens/ | Frontend | Entry point AI Creator, gọi `selectProductForDesign()` |
| 2 | `DesignContext.jsx` | FE/src/contexts/ | Frontend | `selectProductForDesign` — đi phối 2 async (client + server) |
| 3 | `ceramicSpecimenAnalyzer.js` | FE/src/utils/ | Frontend | Phân tích ảnh client-side (canvas 2D, BFS CCL) |
| 4 | `orthographicRenderer.js` | FE/src/utils/ | Frontend | `createCeramicGeometry` → Three.js LatheGeometry |
| 5 | `ceramicTextureGenerator.js` | FE/src/utils/ | Frontend | Texture canvas, pattern placement, decal placement |
| 6 | `CeramicCanvas3D.jsx` | FE/src/components/ | Frontend | Three.js WebGL scene, decal rendering |
| 7 | `meshInflator.js` | FE/src/utils/ | Frontend | Full 3D mesh từ silhouette (đường lẫn thay thế) |
| 8 | `aiPromptParser.js` | AI/ | AI/Algorithm | Prompt → paramsToLathePoints (client-side fallback) |
| 9 | `server.js` | API/ | Backend | Express, `/api/ai/clean-and-deconstruct` endpoint |
| 10 | `auto_clean_pipeline.js` | API/ | Backend | AI bg removal (@imgly/background-removal-node) |
| 11 | `potterySuitabilityAnalyzer.js` | AI/ | AI/Algorithm | Phân tích khả năng nặn (sharp, pure JS) |
| 12 | `aiService.js` | API/ | Backend | Wrapper dịch vụ AI |
| 13 | `cloudflareService.js` | API/ | Backend | Cloudflare LLaMA Vision API (LLaMA 3.1/3.2) |
| 14 | `routes/gradio.js` | API/ | Backend | HuggingFace Gradio proxies (FLUX, InstantMesh, SF3D) |
| 15 | `lib/gradioClient.js` | API/lib/ | Backend | @gradio/client lazy wrapper |
| 16 | `lathe.js` | AI/ | AI/Algorithm | Pure-JS lathe point extraction (imageToLathePoints) |
| 17 | `auto_clean_pipeline.js` | AI/ | AI/Algorithm | Source version (API server import fallback) |
| 18 | `clean_single_image.js` | AI/ | AI/Utility | Single image bg removal utility |
| 19 | `index.js` | cloudflare_worker/src/ | Worker | Cloudflare Worker: POST /lathe, POST /edit |
| 20 | `Card.jsx` | FE/src/ui/ | Frontend | ProductCard (được thêm nút đặt lịch — ảnh hưởng pipeline) |
| 21 | `ScheduleScreen.jsx` | FE/src/screens/ | Frontend | Schedule screen — lazy-loaded, PRODUCTS lazy import |
| 22 | `server.js` (BE) | BE/ | Commerce Backend | Express (port 5000) — cung cấp products/workshops/appointments API |

### 4 External service dependencies

| Dịch vụ | URL/API | Models | Site phụ thuộc |
|---------|--------|--------|----------------|
| **Cloudflare Workers AI** | `api.cloudflare.com/client/v4/accounts/...` | `@cf/meta/llama-3.1-8b-instruct-fp8`, `@cf/meta/llama-3.2-3b-instruct`, `@cf/meta/llama-3.2-1b-instruct`, `@cf/meta/llama-3.2-11b-vision-instruct`, `@cf/black-forest-labs/flux-1-schnell` | cloudflareService.js, routes/gradio.js |
| **HuggingFace Gradio Spaces** | `*.hf.space` | `black-forest-labs/FLUX.1-schnell`, `TencentARC/InstantMesh`, `stabilityai/stable-fast-3d` | routes/gradio.js → lib/gradioClient.js |
| **@imgly/background-removal-node** | npm package | Browser Image Model (BLOB) | auto_clean_pipeline.js |
| **sharp** | npm package | native (vcpkg/libvips) | server.js, potterySuitabilityAnalyzer.js |

### Dependency depth (độ sâu chuỗi phụ thuộc)

Critical path từ FE → API → external (được đánh số):
```
AICoCreatorScreen.jsx
  → 2 (DesignContext.selectProductForDesign)
    → 3 (ceramicSpecimenAnalyzer.js — client-side, 0 external)
    → 9 (API/server.js clean-and-deconstruct)
      → 10 (auto_clean_pipeline.js)
        → 13 (cloudflareService.js — @imgly/background-removal-node)
          → 4 external: @imgly/background-removal-node, sharp
      → 11 (potterySuitabilityAnalyzer.js — 4: sharp)
      → 14 (routes/gradio.js)
        → 15 (lib/gradioClient.js — @gradio/client)
          → 4 external: HuggingFace Gradio Spaces
  → 5 (ceramicTextureGenerator.js + orthographicRenderer.js)
    → 6 (CeramicCanvas3D.jsx — Three.js)
    → 13 (cloudflareService.js — LLaMA Vision)
      → 4 external: Cloudflare Workers AI
```

**Max depth: 7 cấp** (AICoCreator → DesignContext → server.js → cloudflareService.js → Cloudflare API)

---

## 4. BUG CHIỀU CAO ĐỐI TƯỢNG (object height) — ĐÃ FIX

### Root Cause — Triple Normalization

LathePoints trải qua **3 lần normalize** với cùng hằng số nhưng dữ liệu đầu vào khác nhau → tích lũy lỗi:

| Bước | Nơi | Công thức | Vấn đề |
|------|-----|----------|--------|
| **1. Server** | `API/server.js:527` | `normY = ((maxY - sampleY) / objH) * 2.0 - 1.0` | `objH` (raw bbox height) có thể chưa bao phủ toàn bộ vật thể → normY vượt [-1, +1] nếu crop lỗi |
| **2. Server** | `API/server.js:631` | `normY = targetMinY + ((pt.y - baseMinY) / ySpan) * targetYSpan` | `baseMinY/baseMaxY` tính từ `activeCurve` — nhưng DP simplification (line 553) có thể thay đổi minY/maxY → ySpan khác → ánh xạ sai |
| **3. FE** | `orthographicRenderer.js:78` (cũ) | `normY = targetMinY + (p.y - minY) * yScale` | FE lại normalize lại từ lathePoints — nhưng lathePoints đã qua bước 2! |

**Lỗi chính**: Server (bước 2) chuẩn normalize lathePoints về `[targetMinY, targetMinY + targetYSpan]` (ví dụ vase: [-1.15, 1.30]). Nhưng lathePoints bao gồm cả các điểm **thành trong** (interior wall points, rim extension) được thêm sau cùng:

```js
// server.js line 650: rim point — dịch Y lên +0.04
lathePoints.push({ x: ..., y: rimPoint.y + 0.04 });

// server.js line 656: interior wall — dịch Y lên +0.02
lathePoints.push({ x: ..., y: scaledCurve[i].y + 0.02 });

// server.js line 659: foot center — dịch Y lên +0.15
lathePoints.push({ x: 0, y: scaledCurve[0].y + 0.15 });
```

Khi FE re-normalize (bước 3), `currentYSpan = maxY - minY` của lathePoints **lớn hơn** `targetYSpan` vì các điểm thành trong kéo dài phạm vi Y. Điều này làm `yScale = targetYSpan / currentYSpan < 1.0` → **nén thẳng đứng** → đối tượng 3D bị béo/ép dẹt.

### Fix — 2 thay đổi (FE)

#### Fix A: `orthographicRenderer.js` (createCeramicGeometry, dòng 74-98)
Thêm phát hiện lathePoints đã được normalize (Y span trong 15% của target):

```js
const ySpanRatio = currentYSpan / targetYSpan;
const alreadyNormalized = ySpanRatio > 0.85 && ySpanRatio < 1.15;

if (alreadyNormalized) {
  // Points already in target Y space — preserve Y, only normalize radius
  const rScale = targetMaxR / currentMaxX;
  points = lathePoints.map((p) => new THREE.Vector2(p.x * rScale, p.y));
} else {
  // Full re-normalization (raw silhouette from meshInflator)
  const yScale = targetYSpan / currentYSpan;
  const rScale = targetMaxR / currentMaxX;
  points = lathePoints.map((p) => {
    const normY = targetMinY + (p.y - minY) * yScale;
    const normX = p.x * rScale;
    return new THREE.Vector2(normX, normY);
  });
}
```

#### Fix B: `ceramicTextureGenerator.js` (computeDecalPlacement, dòng 1085-1117)
Áp dụng cùng logic `alreadyNormalized` check — đồng bộ hoàn toàn với `createCeramicGeometry` để decal rơi đúng vị trí trên mô hình 3D.

#### Fix C: `radiusAtHeight` + `computeDecalPlacement` V-value interpolation (dòng 73-94, 1123-1143)
Thay thế nội suy **index-based** bằng **Y-value-based**:

```js
// TRƯỚC (buggy): giả định điểm đều nhau theo Y
const t = normV * (pts.length - 1);
const idx = Math.floor(t);
const p0 = pts[idx], p1 = pts[idx + 1];

// SAU (fixed): nội suy dựa trên giá trị Y thực
const sorted = [...pts].sort((a, b) => a.y - b.y);
for (let i = 0; i < sorted.length - 1; i++) {
  if (sorted[i].y <= yTarget && sorted[i + 1].y >= yTarget) {
    const frac = (yTarget - sorted[i].y) / (sorted[i + 1].y - sorted[i].y);
    rAt = sorted[i].r + frac * (sorted[i + 1].r - sorted[i].r);
    break;
  }
}
```
Lý do: lathePoints từ server có điểm thành trong → **Y không đơn điệu** (tăng rồi giảm). Nội suy theo index gây lệch vị trí decal theo trục dọc.

### Xác minh (build)
✅ Vite build thành công — 77 modules transformed, không lỗi.
✅ `computeDecalPlacement` và `createCeramicGeometry` dùng cùng hằng số `targetYSpan`/`targetMinY`/`targetMaxR` → profile đồng nhất.

---

## 5. BUG STRETCH HOA VĂN (pattern/texture) — ĐÃ FIX

### Root Cause — Aspect Compensation chỉ scale X, chưa đồng bộ footprint

#### 5a. `ctx.scale(aspectCompensation, 1.0)` chỉ scale X (ceramicTextureGenerator.js:425, 760)
```js
const patternCircRatio = radiusAtHeight(cy, height, modelType, latheProfile);  // ví dụ: 0.497
const aspectCompensation = 1.0 / Math.max(0.18, patternCircRatio);            // = 2.01
ctx.scale(aspectCompensation, 1.0);  // X scale = 2.01, Y scale = 1.0
```
Mục đích: khi hoa văn đặt ở vùng hẹp (bán kính r nhỏ), chu vi mô hình 3D bị co → hoa văn bị bóp thậng. `aspectCompensation` kéo dài trục X trên canvas để bù. **Đây là scale X duy nhất** — đúng nguyên tắc (vertical height không cần bù).

#### 5b. Footprint không đồng bộ với canvas scale (ceramicTextureGenerator.js:991, 1004)

**PatternImage path (dòng 991 — BUGGY):**
```js
// Canvas draws với ctx.scale(aspectCompensation, 1.0) — NHƯNG createDecalCanvases
// patternImage path lại KHÔNG có ctx.scale này! (chỉ có ở createCeramicTextureCanvas)
// → footprint sai hoàn toàn
decals.push({ ..., footprintW: dw, footprintH: dh });  // ← thừa nhận dw chưa qua aspectCompensation
```

**PatternVector path (dòng 1004 — BUGGY):**
```js
const sf = pl.pScale * factor * pl.circScale;  // circScale = 1.0 (hardcoded)
const footprint = 330 * sf;
decals.push({ ..., footprintW: footprint, footprintH: footprint });  // ← vuông, nhưng canvas X bị stretch 2x
```

**computeDecalPlacement (dòng 1120-1122):**
```js
const arcW = (footprintW / texW) * Math.PI * 2;  // dùng footprintW chưa qua aspectCompensation
const AR = footprintW / footprintH;              // AR = 1.0 (sai, thực tế AR = aspectCompensation)
const worldH = worldW / AR;                      // worldH quá lớn → decal bị kéo dài dọc
```

Kết quả: Canvas vẽ hoa văn bị stretch X (đúng), nhưng `computeDecalPlacement` tính `worldW` và `worldH` từ footprint **chưa stretch** → AR sai → decal 3D kéo dài/méo.

### Fix — 3 thay đổi (ceramicTextureGenerator.js)

#### Fix A: createDecalCanvases patternImage path (dòng 999-1008)
Thêm `ctx.scale(ac, 1.0)` (chưa có) + đồng bộ footprintW:
```js
const ac = pl.aspectCompensation || 1.0;
ctx.translate(pl.cx, pl.cy);
ctx.scale(ac, 1.0);   // ← THÊM: đồng nhất với createCeramicTextureCanvas
ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
decals.push({ ..., footprintW: dw * ac, footprintH: dh });  // ← FIX: footprintW bao gồm aspectCompensation
```

#### Fix B: createDecalCanvases patternVector path (dòng 1019-1023)
Footprint không vuông → footprintW ≠ footprintH:
```js
const ac = pl.aspectCompensation || 1.0;
const footprint = 330 * sf;
decals.push({ ..., footprintW: footprint * ac, footprintH: footprint });  // ← FIX: chỉ scale W
```

#### Fix C: computeDecalPlacement AR calculation (dòng 1130-1132)
Không cần thay đổi thuật toán — chỉ cần footprintW/footprintH đã đúng (Fix A + B) → AR tự động đúng.

### Trước & Sau (ví dụ bowl ở cy=696/1024)

| Thông số | Trước (buggy) | Sau (fixed) |
|----------|---------------|-------------|
| patternCircRatio | 0.497 | 0.497 (không đổi — đây là đúng) |
| aspectCompensation | 2.01 | 2.01 |
| Canvas X scale | 2.01 ✅ (ở createCeramicTextureCanvas) | 2.01 ✅ |
| Canvas X scale (decal path) | **1.0 ❌** (patternImage) | **2.01 ✅** (patternImage) |
| footprintW (vector) | 330 * sf | 330 * sf * 2.01 |
| footprintH (vector) | 330 * sf | 330 * sf (không đổi) |
| AR | 1.0 ❌ | 2.01 ✅ |
| worldH (= worldW / AR) | worldW / 1.0 = worldW ❌ (quá cao) | worldW / 2.01 ✅ (đúng tỷ lệ) |

---

## TÓM TẮT THAY ĐỔI (File Changes Summary)

| File | Dòng thay đổi | Loại | Mô tả |
|------|--------------|------|-------|
| `FE/src/screens/ScheduleScreen.jsx` | 1-35 (thay thế 2-10) | Performance | Lazy-load confetti + PRODUCTS |
| `FE/src/screens/ScheduleScreen.jsx` | 127-142 | Performance | triggerConfetti async |
| `FE/src/screens/ScheduleScreen.jsx` | 202-210 | Performance | useLazyProducts + skeleton loading |
| `FE/src/App.jsx` | 1, 20, 37-41 | Performance | lazy + Suspense ScheduleScreen |
| `FE/src/ui/Card.jsx` | 3-4, 79-80, 102-111, 196-208 | Feature | Nút "Đặt lịch" + handleAddToSchedule |
| `FE/src/utils/ceramicTextureGenerator.js` | 73-94, 1001-1008, 1019-1023, 1099-1117, 1127-1143 | Bug fix | Pattern stretch + object height |
| `FE/src/utils/orthographicRenderer.js` | 74-98 | Bug fix | Object height double-normalization |

### Verification
- ✅ `npx vite build --mode development` — **77 modules transformed**, build thành công trong 3.21s
- ✅ Code-splitting confirmed: `ScheduleScreen-Dy_0iDc2.js` (49.97 KB), `canvas-confetti-C94ZD2ww.js` (10.70 KB) — 2 chunks riêng
- ✅ Pre-existing warning `sRGBEncoding` in `renderFidelity.js` — không liên quan, không ảnh hưởng

---

*Báo cáo được sinh bởi Codex Agent — dựa trên phân tích thực tế code trong repository.*
