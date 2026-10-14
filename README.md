# GỐM VIỆT • 3D CERAMIC DESIGN STUDIO & WORKSHOP O2O PLATFORM (MVP)

Dự án nền tảng thương mại điện tử kết hợp trải nghiệm thực tế ảo (3D WebGL) và dịch vụ O2O (Online-to-Offline) cho làng gốm mỹ nghệ truyền thống Việt Nam — trọng tâm Làng gốm Biên Hòa (Tân Vạn, Đồng Nai).

---

## 🏛 CẤU TRÚC THƯ MỤC CHUẨN YÊU CẦU

Dự án gồm **3 folder bắt buộc** (`FE`, `BE`, `API`), file cấu hình môi trường `.env` và `docker-compose.yml`:

```
Prj_Ecom_Design/
├── .env                  # Biến môi trường hệ thống (Cổng, API keys, endpoints)
├── .env.example          # File mẫu biến môi trường
├── docker-compose.yml    # Docker Compose — 3 services với healthcheck
├── FE/                   # [1] FRONTEND (React, Vite, Tailwind CSS, Three.js 3D Studio)
│   ├── src/
│   │   ├── ui/          # UI primitives (Button, Card, Input, Badge, RadioGroup)
│   │   ├── data/        # Data layer (glazes, patterns, products, workshopSlots)
│   │   ├── contexts/    # Context API (Navigation, Design, Cart, Toast)
│   │   ├── lib/         # Utilities (cn, formatVND, truncate, debounce)
│   │   ├── components/  # LeftSidebar, RightSidebar, CeramicCanvas3D, ChatbotAI
│   │   ├── screens/     # HomeScreen, GalleryScreen, AICoCreatorScreen, StudioScreen, CheckoutScreen
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile       # Multi-stage (node:builder → nginx:alpine)
│   ├── nginx.conf       # nginx config (SPA fallback, gzip, caching)
│   ├── .dockerignore
│   └── package.json
├── BE/                   # [2] BACKEND CORE (Quản lý catalog, đơn hàng, workshop)
│   ├── server.js          # Express, in-memory storage (MVP — no DB)
│   ├── Dockerfile
│   ├── .dockerignore
│   └── package.json
└── API/                  # [3] AI & GENERATIVE ENGINE
    ├── server.js          # Express, Cloudflare LLaMA primary / Gemini / rule-engine fallback
    ├── geminiService.js   # Google Gemini backend (backup)
    ├── cloudflareService.js # Cloudflare Workers AI LLaMA backend (primary)
    ├── aiService.js       # Adapter: Cloudflare → Gemini → rule engine
    ├── Dockerfile
    ├── .dockerignore
    └── package.json
```

### v1.1 — CPU-only no-LLM rule engine (đã triển khai)
| Thành phần | Nơi | Chức năng |
|---|---|---|
| `AI/potterySuitabilityAnalyzer.js` | AI → import dyanimc bởi API | "Đọc vật thể": phân tích mask/silhouette → đánh giá khả năng **nặn** (symmetry, circularity, rim-risk, pliability) trả về response JSON `suitability` |
| `FE/src/utils/textNormalizer.js` | FE | Chuẩn hoá **bất kỳ** text nào (unicode/emoji/dài) lên thân gốm: tự động wrap + auto-scale fontSize — không còn "tạo đại"/tràn |
| `FE/src/utils/ceramicTextureGenerator.js` (cập nhật) | FE | Pattern **circumference-aware** (scale theo bán kính thành) + texture canvas cache |
| `FE/src/components/CeramicCanvas3D.jsx` | FE | Truyền `latheProfile` (customLathePoints) để pattern/text đồng bộ với mô hình 3D |

**Lưu ý:** `PYTHON_AI_URL` / Colab GPU layer (Zero123++) đã bị xóa toàn bộ; 6-view + lathe + feasibility chạy **CPU-only**.

### v1.2 — Cloudflare LLaMA AI Backend
| Thành phần | Nơi | Chức năng |
|---|---|---|
| `API/cloudflareService.js` | API | **Cloudflare Workers AI LLaMA** — backend chính: chat, prompt→3D, vision |
| `API/aiService.js` | API | Adapter: **Cloudflare → rule engine** (Gemini đã bị xóa hoàn toàn) |
| `API/server.js` | API | Import từ `aiService.js`, health check trả về `aiBackend` |

- **Model mặc định**: `@cf/meta/llama-3.1-8b-instruct-fp8` (đã thay thế `@cf/meta/llama-3.1-8b-instruct` bị deprecated từ 2026-05-30)
- **Model dự phòng**: `@cf/meta/llama-3.2-3b-instruct`, `@cf/meta/llama-3.2-1b-instruct` (tự động thử khi primary 410)
- **Vision model**: `@cf/meta/llama-3.2-11b-vision-instruct`

**Cấu hình:** Thêm `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` vào `.env` rồi `docker compose up -d --build api`. Khi có key, hệ thống tự động dùng LLaMA. Khi không, tự động chuyển sang Gemini (nếu có key) hoặc rule engine dựng sẵn. Không cần khởi động lại nếu chưa có key.

---

## 🏗 KIẾN TRÚC HỆ THỐNG (Monolith MVP)

Dự án áp dụng **kiến trúc monolith 3 service** — không có Database, mỗi service dùng bộ nhớ trong (in-memory):

| Service | Ngôn ngữ | Framework | Port | Chức năng |
|---------|----------|-----------|------|-----------|
| **FE** | JavaScript | React 18 + Vite 6 | 3000 | Giao diện người dùng, 3D WebGL studio |
| **BE** | JavaScript | Express 4 | 5000 | Quản lý sản phẩm, đơn hàng, đặt workshop |
| **API** | JavaScript | Express 4 | 8000 | AI Chatbot, 6-view vector generation (CPU-only Sharp rule engine), feasibility scoring |

**CORS**: BE & API chỉ chấp nhận origin từ `FE_ORIGIN` (mặc định `http://localhost:3000`)

---

## 🚀 CÁCH KHỞI CHẠY BẰNG DOCKER

### Production (Multi-stage Build → nginx)

```bash
docker compose up --build -d
```

Sau khi khởi chạy thành công:
* **Frontend (FE):** [http://localhost:3000](http://localhost:3000) — nginx serving static build
* **Backend Core (BE):** [http://localhost:5000/api/health](http://localhost:5000/api/health)
* **AI Generative Engine (API):** [http://localhost:8000/api/health](http://localhost:8000/api/health)

Mỗi service đều có **healthcheck tự động** và `restart: unless-stopped`.

### Dừng hệ thống

```bash
docker compose down
```

### Xem logs realtime

```bash
docker compose logs -f --tail 100
```

---

## 🌟 TÍNH NĂNG NỔI BẬT TRONG BẢN MVP

### 1. Không dùng Header - Điều hướng toàn diện bằng Left Sidebar
* **Trang chủ:** Triết lý làng nghề di sản, giới thiệu hành trình khép kín O2O.
* **Thư viện mẫu:** Danh mục các phôi gốm chuẩn xưởng (Cốc trụ quai uốn, Bình hoa thon, Bát thiền, Đĩa mỹ nghệ).
* **AI Tư vấn:** Trợ lý phác họa concept và sinh ảnh vector 6 mặt trực giao.
* **Xưởng 3D:** Trung tâm thiết kế mô hình 3D tương tác 360 độ.
* **Giỏ hàng & Đặt lịch:** Thanh toán và lựa chọn cách thức sở hữu.
* **Avatar người dùng:** Góc dưới bên trái cân bằng thị giác.

### 2. Màn hình AI Co-Creator (Tạo ảnh Vector 6 mặt trực giao)
> ⚠️ **DEPRECATED (v1.1):** The previous Google Colab / RunPod GPU layer
> (Zero123++ + Qwen LLM via `AI/server.py` / `ai_3d_worker.py`) has been **removed**.
> 6-view generation now runs **entirely on CPU** via the integrated Node.js rule engine
> (`Sharp` + silhouette analysis) — no external GPU/Colab tunnel required. Legacy setup
> preserved (archived) in `AI/README_COLAB_SETUP.md`.
* Nhập mô tả ý tưởng bằng văn bản (hoặc chọn gợi ý mẫu).
* Hệ thống phân tích và tạo **6 mặt Vector SVG** (Top, Bottom, Front, Back, Left, Right) với lưới đo đạc chuẩn tỷ lệ 1:1.
* Phân tích **chỉ số khả thi tạo hình (%)**, cảnh báo độ co ngót đất sét (8-12%) và nguy cơ nứt lò.
* Nút chuyển thẳng thông số sang **Xưởng 3D & Tô màu**.

### 3. Màn hình Xưởng Thiết Kế 3D (3D Studio)
* **Canvas trung tâm (Three.js WebGL):**
  * Mô hình 3D gốm chân thực với vật liệu phản chiếu men gốm PBR (Clearcoat, roughness, sheen).
  * Xoay tự do 360°, zoom, chụp ảnh render và **xuất file 3D (.OBJ)** tải về máy.
* **Right Sidebar (Trượt ra khi thiết kế):**
  * Chọn các dòng men di sản: Men Lam cổ, Men Ngọc Celadon, Men Rạn trắng, Men Hỏa Biến, Men Nâu đất nung.
  * Tùy chỉnh độ bóng / độ ráp của men nung.
  * Dán họa tiết: Hoa Sen Cổ, Họa Tiết Đông Sơn, Song Ngư Vượt Sóng, Chấm Bi.
  * **Khắc chữ cá nhân hóa:** Chữ người dùng nhập được khắc chìm trực tiếp vào thân gốm 3D trong thời gian thực!

### 4. Màn hình Thanh Toán & 2 Lựa Chọn Sở Hữu (O2O)
* **Option 1: Để nghệ nhân làm giúp bạn:**
  * Điền địa chỉ nhận hàng.
  * Xưởng tại Biên Hòa (Tân Vạn) tiếp nhận bản thiết kế 3D, nghệ nhân vuốt phôi thủ công, khắc chìm, tráng men và nung lò rồng củi 1220°C (7-10 ngày).
  * Cam kết độ biến thiên màu sắc tự nhiên của gốm thủ công.
* **Option 2: Đặt lịch đến Workshop tự làm:**
  * Chọn ngày hẹn và ca giờ (Sáng 08:30, Chiều 14:00, Hoàng hôn sông Đồng Nai 16:45).
  * Xưởng chuẩn bị sẵn đúng loại đất sét, phôi và màu men mà bạn đã chọn trên 3D.
  * Nghệ nhân kèm 1-on-1 hướng dẫn kỹ thuật.
* Tích hợp thanh toán mô phỏng MoMo, VNPAY QR, Thẻ ngân hàng với hiệu ứng pháo hoa Confetti chúc mừng!

### 5. Chatbot AI Nghệ Nhân (Góc Dưới Phải)
* Luôn đồng hành ở góc phải dưới màn hình.
* Đóng vai Cụ Đạt - Cố vấn cao cấp về gốm sứ Việt Nam.
* Sẵn sàng giải đáp kỹ thuật nung, ý nghĩa hoa văn, cách chọn men hợp phong thủy và hướng dẫn đặt workshop.
* Hoạt động ổn định ngay cả khi không có kết nối internet/API key nhờ bộ máy tri thức gốm sứ tích hợp sẵn.
