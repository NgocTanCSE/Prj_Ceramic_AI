# KHẾ ƯỚC DỮ LIỆU VÀ GIAO TIẾP API 3D (3D API CONTRACT SPECIFICATION)

**Dự án:** Gốm Việt — Nền tảng thiết kế gốm sứ 3D có AI hỗ trợ  
**Nhánh:** `khoaduc`  
**Quy tắc:** Bảo toàn tính tương thích ngược (Backward Compatibility) 100% với Frontend nguyên bản (`FE/`).  

---

## 1. TỔNG QUAN LUỒNG GIAO TIẾP VÀ MÔI TRƯỜNG HOẠT ĐỘNG

```
[Người dùng]
     │
     ▼
[FE - React Vite (GitHub Pages)]
     │
     ├── (1) Text Prompt -> POST /api/ai/prompt-to-3d
     ├── (2) Image Upload -> POST /api/ai/clean-and-deconstruct
     ├── (3) Edge/Worker -> POST /lathe (Cloudflare Worker)
     └── (4) Client-side Fallback -> Three.js LatheGeometry / meshInflator
```

> **LƯU Ý QUAN TRỌNG:**
> - GitHub Pages là dịch vụ lưu trữ static web, **không chạy Node.js / Express**.
> - Vì vậy, các endpoint backend (`API/server.js`) cần được triển khai trên nền tảng phù hợp (Render, Railway, Fly.io, VPS) hoặc gọi qua Cloudflare Workers.
> - Nếu chưa có backend production trực tuyến, Frontend nguyên bản có cơ chế fallback client-side dựng hình trực tiếp trên WebGL qua các thuật toán nội suy sẵn có.

---

## 2. CHI TIẾT CÁC ENDPOINT HOẠT ĐỘNG (ACTIVE API ENDPOINTS)

### 2.1. `POST /api/ai/prompt-to-3d`
Khởi tạo thông số hình học và men gốm từ mô tả văn bản tiếng Việt/tiếng Anh.

- **Request Headers:** `Content-Type: application/json`
- **Request Body Schema:**
  ```json
  {
    "prompt": "Bình hoa Bát Tràng cổ hẹp men lam truyền thống",
    "style": "traditional_bat_trang",
    "archetype": "vase" // Optional: "vase" | "bowl" | "plate" | "mug"
  }
  ```
- **Response Schema (`200 OK`):**
  ```json
  {
    "success": true,
    "modelType": "vase",
    "archetype": "vase-narrow-neck",
    "shapeParams": {
      "height": 2.1,
      "maxRadius": 0.65,
      "neckRatio": 0.35,
      "rimFlare": 0.5,
      "baseRadius": 0.4
    },
    "lathePoints": [
      { "x": 0.0, "y": -1.05 },
      { "x": 0.4, "y": -1.05 },
      { "x": 0.65, "y": -0.2 },
      { "x": 0.22, "y": 0.6 },
      { "x": 0.35, "y": 1.05 },
      { "x": 0.0, "y": -0.95 }
    ],
    "suggestedGlaze": {
      "color": "#1B3F8B",
      "roughness": 0.25,
      "metalness": 0.05,
      "name": "Men Lam Bát Tràng"
    },
    "pattern": {
      "type": "lotus_scroll",
      "scale": 1.0,
      "name": "Họa tiết hoa sen dây"
    },
    "title": "Bình gốm men lam cổ cao",
    "description": "Thiết kế lấy cảm hứng từ gốm hoa lam thế kỷ XV"
  }
  ```
- **Xác minh an toàn:**
  - `lathePoints` luôn là mảng đối tượng có tọa độ hữu hạn (`isFinite`).
  - `suggestedGlaze.color` đúng định dạng mã màu hex `#RRGGBB`.
  - Nếu prompt rỗng, API tự động trả về preset an toàn thay vì lỗi 500.

---

### 2.2. `POST /api/ai/clean-and-deconstruct`
Tách nền ảnh tải lên, phân tích độ phù hợp làm mẫu gốm sứ xoay tròn (Lathe Suitability), trích xuất đường bao và tạo ảnh các góc nhìn trực giao.

- **Request Body Schema:**
  ```json
  {
    "imageBase64": "data:image/jpeg;base64,...",
    "mimeType": "image/jpeg",
    "autoDeconstruct": true
  }
  ```
- **Response Schema (`200 OK`):**
  ```json
  {
    "success": true,
    "cleanImageBase64": "data:image/png;base64,...",
    "views": {
      "front": "data:image/png;base64,...",
      "back": "data:image/png;base64,...",
      "left": "data:image/png;base64,...",
      "right": "data:image/png;base64,...",
      "top": "data:image/png;base64,...",
      "bottom": "data:image/png;base64,..."
    },
    "suitability": {
      "suitable": true,
      "score": 0.92,
      "symmetryScore": 0.95,
      "aspectRatio": 1.45,
      "objectCount": 1,
      "issues": []
    },
    "latheProfile": {
      "empty": false,
      "modelType": "vase",
      "lathePoints": [
        { "x": 0.0, "y": -0.95 },
        { "x": 0.38, "y": -0.95 },
        { "x": 0.62, "y": -0.1 },
        { "x": 0.3, "y": 0.95 },
        { "x": 0.0, "y": -0.85 }
      ],
      "bbox": { "minX": 120, "maxX": 630, "minY": 50, "maxY": 700 }
    }
  }
  ```
- **Xác minh an toàn:**
  - Khi ảnh đầu vào hoàn toàn rỗng hoặc không có vật thể gốm, trả về `suitability.suitable: false`, `latheProfile.empty: true`, `latheProfile.lathePoints: []` mà không tạo hình học giả mạo.

---

### 2.3. Cloudflare Worker `POST /lathe`
Phiên bản Edge Serverless tính toán nhanh profile xoay từ ảnh hoặc mask.

- **Request Body Schema:**
  ```json
  {
    "imageBase64": "data:image/png;base64,...",
    "maskBase64": "data:image/png;base64,...", // Optional: mask do người dùng vẽ/tách
    "modelType": "bowl",
    "numPoints": 18
  }
  ```
- **Response Schema (`200 OK`):**
  ```json
  {
    "success": true,
    "modelType": "bowl",
    "lathePoints": [
      { "x": 0.0, "y": -0.65 },
      { "x": 0.35, "y": -0.65 },
      { "x": 0.85, "y": 0.60 },
      { "x": 0.0, "y": -0.55 }
    ],
    "bbox": { "minX": 95, "maxX": 655, "minY": 180, "maxY": 570 },
    "objectCount": 1,
    "areaRatio": 0.384
  }
  ```
- **Xác minh an toàn:**
  - Nếu `maskBase64` được cung cấp, worker giải mã và sử dụng trực tiếp để trích xuất profile thay vì bỏ qua như trước.
  - Hỗ trợ đầy đủ CORS Headers (`Access-Control-Allow-Origin: *`).

---

## 3. KHẲNG ĐỊNH TÍNH TOÀN VẸN CONTRACT
- Tất cả các trường dữ liệu và kiểu giá trị (types) mà các components trong `FE/src/` đang lắng nghe đều được giữ nguyên 100%.
- Không thêm bất kỳ breaking change nào khiến frontend bị lỗi parse hoặc crash.
