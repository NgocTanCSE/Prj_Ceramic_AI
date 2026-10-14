# TODO — Gradio Spaces 3D Pipeline

## Phase 0 — Nền tảng (Foundation)
- [x] T0.1: `npm install @gradio/client` trong API + cập nhật `.env` và `docker-compose.yml` (HF_TOKEN, GEMINI_API_KEY)
- [x] T0.2: `API/lib/gradioClient.js` — wrapper callSpace + fetchBuffer + handleFile
- [x] T0.3: endpoints proxy `/api/ai/gradio/text-to-image` + `/api/ai/gradio/image-to-3d`; node --check + API boot health

## Phase 1 — Backend pipeline (Text→2D→3D)
- [x] T1.1: endpoint `/api/ai/gradio/text-to-3d-full` {prompt} → FLUX 2D → SF3D glb → download+save local → {success, imageUrl, glbUrl, glbFileUrl}
- [x] T1.2: endpoint `/api/ai/gradio/image-to-3d-full` {imageBase64} → SF3D glb → glbUrl, glbFileUrl
- [x] T1.3: Caching local vĩnh viễn trên `/api/ai/gradio/uploads`

## Phase 2 — FE: load GLB + 3D Viewport
- [x] T2.1: `CeramicCanvas3D` accept `glbUrl` + `onModelLoaded`; GLTFLoader load → auto-center & normalize scale
- [x] T2.2: `ceramicExporter.js` đóng gói cả file `.glb` vào ZIP khi tải về
- [x] T2.3: vite build xanh

## Phase 3 — FE UI (AICoCreatorScreen)
- [x] T3.1: Giai đoạn 1 Text → 2D FLUX với Card duyệt ảnh 2D trước khi nặn 3D
- [x] T3.2: Giai đoạn 2 Nút "Dựng thành 3D" gọi SF3D sinh file `.glb`
- [x] T3.3: Queue/progress UX nghệ nhân nhào đất + Elapsed timer + Local caching
- [x] T3.4: Chuyển tiếp Module 2 `StudioScreen` giữ nguyên mô hình 3D (`customGlbUrl`)

## Phase 4 — 6-view thật từ Model 3D
- [x] T4.1: `generateOrthographicViewsFromObject` trong `orthographicRenderer.js`: 6 ortho cameras chụp thật từ mesh 3D
- [x] T4.2: Tự động cập nhật 6 góc chiếu vào Thumbnail Grid khi model 3D load xong

## Checkpoints
- [x] Sau T0.3: API boot xanh, @gradio/client cài, node --check OK
- [x] Sau T2.3: FE vite build xanh; CeramicCanvas3D render được cả lathe-mesh + GLB
- [x] Sau T4.2: 6 camera trực giao tự động snapshot từ model 3D
- [x] Container Docker `ceramic_api` & `ceramic_fe` đồng bộ hoạt động
