# Công Cụ Crawl Sản Phẩm — GỐM VIỆT

Công cụ (script) dùng để **dò (crawl) toàn bộ sản phẩm** cũng với thông tin chi tiết của
từng sản phẩm trong dự án **GỐM VIỆT**, **làm giàu thông tin ảnh** (giữ dưới dạng link),
rồi **xuất ra một file JSON tổng hợp duy nhất**.

> 📍 Được viết bởi trợ lực dựa trên file `FE/src/contexts/CartContext.jsx` và các nguồn
> dữ liệu: `BE/server.js`, `FE/src/data/{products,glazes,patterns,workshopSlots}.js`.

---

## 📋 Đặc Tính

- **Hai nguồn dữ liệu thông minh:**
  1. `BE API` — ưu tiên, gọi `GET /api/products` + `GET /api/products/:id` để lấy dữ liệu sống.
  2. `File tĩnh FE` — dự phòng, parse trực tiếp `FE/src/data/products.js` (+ glazes/patterns/workshop)
     khi BE chưa chạy.
  3. `BE server.js seed` — dự phòng cuối cùng (parse `initialProducts` trong `BE/server.js`).

- **Thông tin ảnh dưới dạng link:** mỗi sản phẩm giữ `image` nguyên là **link ảnh**, đồng thời
  được bổ sung `imageInfo` chứa:
  - `url` — link ảnh gốc
  - `alt` — mô tả thay thế (dựa trên tên sản phẩm)
  - `contentType` — mime type (ví dụ `image/jpeg`)
  - `contentLength` — kích thước (bytes)
  - `width` / `height` — số pixel (probe qua Range request, hỗ trợ JPEG / PNG / WebP)
  - `reachable` — ảnh còn truy cập được không

- **Gắn catalog liên quan:** tự động gán `recommendedGlazes` / `recommendedPatterns`
  vào mỗi sản phẩm dựa trên tên/giới thiệu (ví dụ *Đá Đỏ Bazan* → men `men-da-do`).

- **Catalog tham chiếu kèm theo:** `glazes`, `patterns`, `workshop` (slots + venue).

---

## 🚀 Cách Dùng

### Yêu cầu
- **Node.js >= 18** (có `fetch`, `AbortController`, dynamic `import`).
- Không cần cài thêm package nào (chỉ dùng built-in Node).

### Câu lệnh

```bash
# Mặc định: tự động chọn nguồn (thử API trước, fallback file), crawl ảnh
node tools/crawl-products.js

# Không probe ảnh (nhanh, không cần mạng ảnh)
node tools/crawl-products.js --no-images

# Ép dùng API (lỗi ra nếu không kết nối được)
node tools/crawl-products.js --api http://localhost:5000

# Ép dùng file tĩnh (bỏ qua API)
node tools/crawl-products.js --source files

# Thiết lập đường dẫn xuất JSON
node tools/crawl-products.js --out path/to/file.json

# Số request ảnh đồng thời (mặc định 8)
node tools/crawl-products.js --concurrency 6

# Timeout cho mỗi request (mili giây)
node tools/crawl-products.js --timeout 10000
```

### Flags tham chiếu

| Flag | Mặc định | Mô tả |
|------|----------|-------|
| `--api <url>` | `http://localhost:5000` | URL gốc của BE API |
| `--source <api\|files\|auto>` | `auto` | Chọn nguồn dữ liệu |
| `--out <path>` | `tools/output/products.json` | Đường dẫn file JSON xuất |
| `--no-images` | (tắt) | Bỏ qua việc probe metadata ảnh |
| `--concurrency <n>` | `8` | Số request ảnh đồng thời |
| `--timeout <ms>` | `10000` | Timeout request |

---

## 📂 Cấu Trúc File JSON Đầu Ra

```jsonc
{
  "generatedAt": "2026-10-09T...",
  "project": "GỐM VIỆT • 3D Ceramic Design Studio & Workshop O2O Platform",
  "sources": { "products": "api", "catalogs": "fe-data-files" },
  "summary": {
    "totalProducts": 7,
    "blankProducts": 4,
    "signatureProducts": 3,
    "uniqueImages": 6,
    "imagesEnriched": 6,
    "totalGlazes": 5,
    "totalPatterns": 5
  },
  "products": [
    {
      "id": "blank-mug-01",
      "name": "Cốc Gốm Khắc Chìm Tân Vạn",
      "slug": "blank-mug-01",
      "category": "blank",          // 'blank' (phôi mộc) | 'signature' (bản nguyên)
      "type": "mug",                // mug | vase | bowl | plate
      "price": 180000,
      "dimensions": "8.5cm x 10.5cm",
      "volume": "380ml",
      "clayType": "Đất sét xám Tân Vạn...",
      "firingTemp": "1200°C",
      "image": "https://images.unsplash.com/...",   // ← LINK ẢNH
      "description": "...",
      "modelLabel": "Cốc Khắc Chìm Tân Vạn",
      "isSignature": false,
      "source": "api",
      "imageInfo": {                // ← THÔNG TIN ẢNH ĐƯỢC LÀM GIÀU
        "url": "https://images.unsplash.com/...",
        "alt": "Cốc Gốm Khắc Chìm Tân Vạn",
        "contentType": "image/jpeg",
        "contentLength": 92548,
        "width": 600,
        "height": 900,
        "reachable": true
      },
      "recommendedGlazes": [ { "id": "men-da-do", "name": "...", "color": "#9E472A" } ],
      "recommendedPatterns": [ { "id": "dong_son", "label": "Hoa Cúc Dây Chạm Lộng", "icon": "sunburst" } ]
    }
    // ... còn lại
  ],
  "catalogs": { "glazes": [...], "patterns": [...], "workshop": {...}, "modelLabels": {...} }
}
```

---

## 🔧 Cách Hoạt Động Nội Bộ

1. **Chọn nguồn** (`auto` → thử API; nếu lỗi → parse file FE; nếu file lỗi → parse BE seed).
2. **Chuẩn hoá schema**: thống nhất `price` (BE dùng `basePrice`), `category`, `type` giữa API & FE.
3. **Làm giàu ảnh**: HEAD request lấy `contentType`/`contentLength`; GET `Range: bytes=0-65535` để
   parse header ảnh → lấy `width`/`height` cho JPEG / PNG / WebP. (Bật bằng `--no-images` để tắt.)
4. **Gắn catalog liên quan**: dò tên men / họa tiết trong `name` + `description` của sản phẩm.
5. **Ghi JSON**: tạo thư mục nếu chưa có, ghi pretty-print 2-space.

---

## 🗒 Lưu Ý

- Ảnh luôn giữ ở dạng **link** (theo yêu cầu: "ảnh thì mình để link").
- Nếu ảnh không truy cập được (`!reachable`), `imageInfo` vẫn ghi `url` + `alt`, còn lại để `null`.
- Công cụ chỉ dùng built-in Node → **không cần `npm install`**.
