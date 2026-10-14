# Implementation Plan: Gradio Spaces 3D Pipeline (Text → 2D → .glb)

## Overview
Thêm 2 con AI Gradio Spaces (FLUX.1-schnell Text→2D, stable-fast-3d / TRELLIS 2D→.glb) làm backend mới cho **AICoCreatorScreen**, thay/complement luồng Gemini hiện tại. Toại nhiên mình chọn “render thật” để tính `fidelityScore` (3D thật vs ảnh 2D).

## Current State (verified)
- **`AICoCreatorScreen.jsx`** (truncated trên đĩa ~201 dòng; intended full version có 6-view grid, `<CeramicCanvas3D>`, nút “Tải 3D” / “Chuyển sang Studio”). Flow hiện tại:
  - `handleGenerateFromPrompt`: FE → `${VITE_AI_API_BASE_URL}/api/ai/prompt-to-3d` (Gemini) → fallback `parsePromptToConcept` → `generateOrthographicViews` (2D canvas) → `conceptResult` → `<CeramicCanvas3D modelType glazeColor… lathePoints />`.
  - `handleUploadSketch`: FE → `/api/ai/image-to-3d` (Gemini Vision) → fallback `analyzeAndDeconstructSpecimen` (client) → lathe inference.
- **`API/server.js`** (Node+express+sharp): routes `prompt-to-3d`, `image-to-3d`, `concept-6views`, `clean-and-deconstruct` (mask+lathePoints+6 views), `chat`. **Chưa có Gradio client.**
- **CeramicCanvas3D**: vừa được rebuild = DecalGeometry viewer (body glaze-base + decal mesh). Hiện chỉ build từ `createCeramicGeometry(modelType, lathePoints)` — chưa load được `.glb` bên ngoài.
- **`ceramicExporter.js`**: chỉ xuất OBJ (`OBJExporter`) — chưa có GLB export, chưa có GLTFLoader.
- **Deps**: `@gradio/client` chưa cài ở đâu; `three` có ở FE; `sharp` ở AI/API.
- **Env**: `VITE_AI_API_BASE_URL=http://localhost:8000`; `.env.example` có `GEMINI_API_KEY` — có thể thêm `HF_TOKEN`.

## Architecture Decisions
1. **Gradio client ở API (Node), không phải FE** — tránh leak token + bypass CORS; FE chỉ gọi API nội bộ.
2. **Gradio trả về `.glb` link tạm** → API **download + lưu local** (`API/public/uploads/<id>.glb`) ngay, gửi link nội bộ cho FE (tránh glb hết hạn). Dùng `@gradio/client` để gọi + `node:https`/`fetch` để download binary.
3. **GLB loader mới cho CeramicCanvas3D** (tùy chọn `glbUrl`/`glbBuffer`): `GLTFLoader` → nhúng mesh → giữ nguyên DecalGeometry decals (placement tính theo mesh bbox). Khi có `glb`, bỏ qua `lathePoints`.
4. **Fidelity “render thật”** (theo lựa chọn user “2 render thài”): render 3D (WebGL) từ góc front → so với ảnh 2D gốc: IoU silhouette (robust) **+** RGB MSE (shading). Tính ở FE (browser có WebGL) hoặc fallback CPU IoU nếu WebGL không khả dụng.
5. **6-view**: khi có GLB, sinh 6 view thật qua Three ortho-cameras (thay `generateOrthographicViews` 2D canvas); giữ fallback 2D nếu không GLB.
6. **Feature flag**: `ENABLE_GRADIO=1` → bật luồng Gradio; mặc định tắt = dùng Gemini/rule-engine (không thay đổi hiện trạng). `HF_TOKEN` optional — nếu thiếu, Gradio path trả lỗi thân thiện (queue/rate-limit UX theo spec user).

## Task List (vertical slices, risk-first)

### Phase 0 — Nền tảng (Foundation)  [dependency root]
- [ ] T0.1: `npm install @gradio/client` trong API + thêm `HF_TOKEN`/`HF_SF3D_SPACE`/`HF_FLUX_SPACE` vào `.env.example`. (`API/package.json` deps)
- [ ] T0.2: `API/lib/gradioClient.js` — wrapper `callSpace(spaceId, fn, args)` + `fetchGlb(url)→buffer`. Bọc try/catch; trả về `{ok, data/url, error}`.
- [ ] T0.3: 2 endpoint proxy `/api/ai/gradio/text-to-image` + `/api/ai/gradio/image-to-3d`. Validate `node --check` + API boot health. (Không test được HF live ở đây — mock unit test.)

### Phase 1 — Backend pipeline (Text→2D→3D)
- [ ] T1.1: Endpoint `/api/ai/text-to-3d-full` {prompt} → FLUX 2D → SF3D/TRELLIS glb → download+save local → trả `{success, imageUrl, glbUrl, modelType?}`. Mock-test contract.
- [ ] T1.2: Endpoint `/api/ai/image-to-3d-full` {imageBase64} → SF3D GLB (từ ảnh gốc) → trả glbUrl. (Dùng cho upload thay vì Gemini Vision.)
- [ ] T1.3: Thêm `fidelityScore` server-side silhouette-IoU trong `AI/lathe.js` (`computeSilhouetteFidelity`) — fallback cho khi GL không khả dụng; test Node.

### Phase 2 — FE: load GLB + DecalGeometry trên mesh bên ngoài
- [ ] T2.1: `CeramicCanvas3D` accept `glbUrl`/`glbBuffer`; `GLTFLoader` load → replace LatheGeometry mesh; giữ decal (recompute placement từ mesh bbox). Feature flag.
- [ ] T2.2: `ceramicExporter.js` thêm `exportGLB` (GLTFExporter) cho nút “Tải xuống file 3D (.glb)”.
- [ ] T2.3: vite build xanh.

### Phase 3 — FE pipeline UI (AICoCreatorScreen)
- [ ] T3.1: mode toggle Gemini | Gradio (flag `ENABLE_GRADIO`). Gradio: gọi `/text-to-3d-full` → `<CeramicCanvas3D glbUrl>` + “Chuyển sang Studio” set DesignContext.
- [ ] T3.2: upload path → `/image-to-3d-full` → GLB.
- [ ] T3.3: Queue/progress UX (“Nghệ nhân AI đang nhào đất… 30s–1p”) + glb tạm thời đã lưu local.

### Phase 4 — 6-view thật + Fidelity render
- [ ] T4.1: `generateOrthographicViews` mode GLB: 6 ortho-cameras render thật (Top/Bottom/Left/Right/Front/Back) → PNG previews.
- [ ] T4.2: `renderFidelity.js` (FE): WebGL render GLB front + so ảnh 2D → `{score, silhouetteIoU, rgbMse, note}`. `AICoCreatorScreen` hiển thị `%` + gate `<0.55` cảnh báo.
- [ ] T4.3: Node unit-test pure math (IoU/MSE) + vite build.

### Phase 5 — Polish & deploy
- [ ] T5.1: persist glb upload, `HF_TOKEN` qua secrets, rate-limit queue UX.
- [ ] T5.2: E2E manual (browser): Text→GLB→3D turntable→6 view→download.

## Checkpoints
- **Sau T0.3**: API boot + `node --check` xanh; @gradio/client cài.
- **Sau T2.3**: FE vite build xanh; CeramicCanvas3D render được cả lathe-mesh lẫn GLB.
- **Sau T4.3**: fidelity math unit-test xanh; build xanh.

## Risks & Mitigations
| Rủ quozi | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| HF Space free tier queue / timeout | UX chờ 30s–1p, thỉnh thoảng fail | queue bar, retry 1 lần, fallback Gemini khi fail |
| Glb tạm hết hạn | ảnh/render mất | download + lưu local ngay (T1.1/T1.2) |
| WebGL headless không chạy ở CI | fidelity server không test được | fallback silhouette-IoU CPU (T1.3) + FE WebGL (T4.2) có guard try/catch |
| GLB load + decal placement offset | decal lệch | recompute từ mesh bbox; guard bằng test_decal_placement |
| `AICoCreatorScreen` hiện truncate trên đĩa | cần rebuild render | kiểm tra lại trước T3.1; nếu truncate phục hồi từ plan |
| Token HF | Gradio 401 | `HF_TOKEN` env; báo lỗi thân thiện nếu thiếu |

## Lệnh verify (cập nhật dần)
- `node --check AI/lathe.js API/lib/gradioClient.js`
- `cd FE && npx vite build`
- `node tools/test_decal_placement.mjs` && `node tools/test_render_fidelity_pure.mjs`
- `docker compose -f docker-compose.test.yml run --rm test` (sau khi thêm mock cho Gradio)
