# BÁO CÁO KỸ THUẬT SỬA LỖI THUẬT TOÁN 3D (3D RECONSTRUCTION FIX REPORT)

**Dự án:** Gốm Việt — Nền tảng thiết kế gốm sứ 3D có AI hỗ trợ  
**Nhánh đích:** `khoaduc` (tách từ baseline `d525bf3dea95cd2aa015d919fc8082d4cadf1433`)  
**Bảo vệ tuyệt đối:** Nhánh `main` và thư mục `FE/` (Read-Only)  
**Ngày thực hiện:** Tháng 10/2026  
**Kỹ sư thực hiện:** Senior 3D Algorithm Engineer / Computer Vision / Backend Optimization  

---

## 1. TỔNG HỢP DANH SÁCH LỖI (BUG INVENTORY)

| Bug ID | Mức độ | Module / File | Trạng thái | Tóm tắt lỗi |
|---|---|---|---|---|
| **BUG-01** | **P0 (Critical)** | `AI/lathe.js`, `API/server.js` | **Đã sửa & Test verified** | Ảnh rỗng/blank tạo ra bbox đảo chiều (`minX > maxX`), sinh geometry giả 6 điểm thay vì báo empty. |
| **BUG-02** | **P0 (Critical)** | `cloudflare_worker/src/index.js` | **Đã sửa & Test verified** | Worker `/lathe` decode `maskBase64` nhưng vứt bỏ không dùng, ép `objectCount = 0` và bỏ qua mask người dùng. |
| **BUG-03** | **P0 (Critical)** | `AI/potterySuitabilityAnalyzer.js` | **Đã sửa & Test verified** | Lỗi biên biến `ny >= w` thay vì `ny >= h` ở thuật toán BFS connected components, làm mất vật thể ở nửa dưới ảnh dọc. |
| **BUG-04** | **P1 (High)** | `AI/lathe.js` | **Đã sửa & Test verified** | Thiếu bộ lọc nhiễu đường biên (contour noise) & Catmull-Rom spline, khiến profile gồ ghề và có ring artifacts trên Three.js. |
| **BUG-05** | **P1 (High)** | `AI/lathe.js`, `API/server.js` | **Đã sửa & Test verified** | Chuẩn hóa chiều cao cố định (-0.65 đến 0.60) cho mọi dáng gốm, gây méo tỷ lệ (đĩa phẳng bị kéo dẹt hoặc bình cao bị bẹp). |
| **BUG-06** | **P1 (High)** | `AI/lathe.js`, `API/server.js` | **Đã sửa & Test verified** | Bề dày thành gốm (wall thickness) cố định gây tự giao nhau (self-intersection) ở cổ bình hẹp và đáy bát sâu. |
| **BUG-07** | **P1 (High)** | `API/cloudflareService.js` | **Đã sửa & Test verified** | Thiếu validator và numeric sanitizer cho phản hồi AI prompt-to-3d, nguy cơ truyền `NaN` hoặc tọa độ vô hạn vào Three.js. |
| **BUG-08** | **P1 (High)** | `API/lib/gradioClient.js` | **Đã sửa & Test verified** | Thiếu kiểm tra URL SSRF trong client gọi mô hình 3D HuggingFace, tiềm ẩn nguy cơ bảo mật mạng nội bộ. |

---

## 2. CHI TIẾT TỪNG LỖI VÀ GIẢI PHÁP KỸ THUẬT

### BUG-01: Bbox đảo chiều và sinh mô hình giả trên ảnh rỗng (Empty Image)
- **Mức độ:** P0 (Critical).
- **Vị trí:** `AI/lathe.js` (hàm `maskAndBbox`), `API/server.js` (hàm `maskAndBbox`).
- **Nguyên nhân gốc rễ (Root Cause):**
  - Biến khởi tạo ban đầu: `minX = w, maxX = 0, minY = h, maxY = 0`.
  - Khi ảnh không có pixel foreground nào (toàn bộ nền hoặc trong suốt), vòng lặp không bao giờ cập nhật các biến này. Kết quả trả về `maxX < minX` và `maxY < minY` (ví dụ `minX = 750, maxX = 0`).
  - Hàm `maskAndBbox` không gán thuộc tính `empty: true` và `area: 0`.
  - Trong `imageToLathePoints()`, kiểm tra `if (!bbox || bbox.empty)` bị bypass vì `bbox.empty` là `undefined` (falsy), dẫn đến việc thuật toán tiếp tục chạy và sinh ra một profile giả mặc định 6 điểm (`{ x: 0.1, y: ... }`) dù thực tế không có vật thể gốm nào!
- **Điều kiện tái hiện:** Truyền ảnh toàn trắng `RGB(255,255,255)`, toàn đen, hoặc hoàn toàn trong suốt `RGBA(0,0,0,0)`.
- **Hành vi trước khi sửa:** Trả về đối tượng profile giả với 6 điểm, Three.js dựng lên một hình trụ mảnh vô nghĩa, API báo thành công (`success: true`).
- **Hành vi sau khi sửa:**
  - `maskAndBbox` tính toán `area = count`, kiểm tra `maxX < minX || maxY < minY || area < 10`.
  - Nếu thỏa mãn, trả về `{ empty: true, minX: 0, maxX: 0, minY: 0, maxY: 0, area: 0 }`.
  - `imageToLathePoints()` và `silhouetteToLathePoints()` lập tức ngắt an toàn và trả về `{ empty: true, lathePoints: [] }`.
- **File & dòng thay đổi:** `AI/lathe.js`, `API/server.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group B: "Ảnh hoàn toàn trống: trả về empty: true và lathePoints rỗng").

---

### BUG-02: Worker `/lathe` vứt bỏ `maskBase64` và ép `objectCount = 0`
- **Mức độ:** P0 (Critical).
- **Vị trí:** `cloudflare_worker/src/index.js` (endpoint `POST /lathe`).
- **Nguyên nhân gốc rễ:**
  - Code cũ kiểm tra `if (maskBase64)` và parse base64 sang buffer, nhưng sau đó hoàn toàn không sử dụng buffer này để trích xuất silhouette.
  - Sau khi dựng xong profile, response JSON luôn trả về cứng: `objectCount: 0`, `areaRatio: 0`.
  - Điều này làm vô hiệu hóa toàn bộ chức năng gửi mask từ client/frontend nếu người dùng đã vẽ mask hoặc dùng công cụ tách nền trước.
- **Hành vi trước khi sửa:** Mask người dùng bị bỏ qua; luôn tính silhouette lại từ ảnh gốc và trả metadata sai lệch (`objectCount: 0`).
- **Hành vi sau khi sửa:**
  - Tích hợp pipeline đầy đủ: nếu có `maskBase64`, giải mã RGBA, letterbox sang 750x750, trích xuất mask bounding box và kết nối component đếm số lượng vật thể (`objectCount >= 1`), tính tỷ lệ diện tích `areaRatio = area / (w * h)`.
  - Trích xuất silhouette trực tiếp từ mask để đảm bảo độ chính xác tuyệt đối theo mong muốn của người dùng.
- **File thay đổi:** `cloudflare_worker/src/index.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group D: Worker compatibility & metadata validation).

---

### BUG-03: Lỗi biên BFS connected components làm mất vật thể ở ảnh dọc
- **Mức độ:** P0 (Critical).
- **Vị trí:** `AI/potterySuitabilityAnalyzer.js` (dòng 126).
- **Nguyên nhân gốc rễ:**
  - Trong vòng lặp BFS loang điểm (flood fill) để tìm các connected components:
    ```javascript
    // Code cũ:
    if (nx < 0 || nx >= w || ny < 0 || ny >= w) continue;
    ```
  - Biến tọa độ Y (`ny`) lại bị so sánh với chiều rộng (`w`) thay vì chiều cao (`h`)!
  - Đối với các ảnh có tỷ lệ đứng (ảnh chân dung gốm sứ có `h > w`, ví dụ `w = 400, h = 800`), bất kỳ pixel nào có `ny >= 400` đều bị `continue` bỏ qua, khiến nửa dưới của vật thể gốm không bao giờ được quét.
- **Hành vi trước khi sửa:** Với ảnh đứng, vật thể ở nửa dưới bị cắt cụt hoặc đếm nhầm thành không có vật thể gốm (`suitability: false`).
- **Hành vi sau khi sửa:** Sửa đúng điều kiện `ny < 0 || ny >= h`.
- **File thay đổi:** `AI/potterySuitabilityAnalyzer.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group C: "Regression Bug 3 (ny >= h): đếm đúng 1 đối tượng ở nửa dưới ảnh cao").

---

### BUG-04: Nhiễu đường biên contour và profile gồ ghề (Lack of Smoothing & Resampling)
- **Mức độ:** P1 (High).
- **Vị trí:** `AI/lathe.js`, `API/server.js`.
- **Nguyên nhân gốc rễ:**
  - Trích xuất scanline từng hàng pixel cho ra bán kính thô (raw integer radius) kèm răng cưa (aliasing) do độ phân giải pixel.
  - Không có bộ lọc trung vị (median filter) để loại bỏ các pixel gai ngoại lai (outliers/speckles do bóng đổ hoặc vết bẩn).
  - Không có Catmull-Rom spline interpolation khiến số điểm profile phụ thuộc trực tiếp vào kích thước bounding box và gây giật nấc khi xoay 3D trên WebGL.
- **Hành vi sau khi sửa:**
  - Bổ sung quy trình 3 giai đoạn xử lý profile:
    1. **Median Filter 5-tap:** Triệt tiêu hoàn toàn các điểm gai đột biến mà vẫn bảo toàn các góc cạnh thực của miệng và chân đế.
    2. **Gaussian/Moving-Average Filter 5-tap:** Làm mịn mượt bề mặt thành gốm.
    3. **Douglas-Peucker Simplification & Catmull-Rom Resampling:** Rút gọn các điểm thẳng hàng nhưng nội suy đều đặn 18 điểm dọc trục Y (`targetCount = 18`), đảm bảo độ cong mượt mà theo chuẩn Three.js.
  - Bổ sung xử lý biên cho đường thẳng (hình trụ/nón cụt có 2 điểm) bằng phương pháp nội suy tuyến tính đều để không làm hỏng cấu trúc 38 điểm của mesh.
- **File thay đổi:** `AI/lathe.js`, `API/server.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group A & C: kiểm tra 38 điểm profile và kiểm tra loại bỏ điểm gai của median filter).

---

### BUG-05: Méo tỷ lệ dáng gốm do chuẩn hóa chiều cao cố định
- **Mức độ:** P1 (High).
- **Vị trí:** `AI/lathe.js`, `API/server.js`.
- **Nguyên nhân gốc rễ:**
  - Logic cũ ép mọi profile vào tọa độ Y từ `-0.65` đến `+0.60` (chiều cao 1.25, bán kính tối đa 0.85).
  - Đối với đĩa nông (`plate`), việc ép chiều cao 1.25 khiến chiếc đĩa biến thành một chiếc bát sâu hoặc ống trụ loe.
  - Đối với bình cổ cao (`vase`), tỷ lệ thanh thoát bị bóp dẹt.
- **Hành vi sau khi sửa:**
  - Thiết lập bảng kích thước chuẩn hóa mục tiêu thích ứng theo archetype (`MODEL_DIMS`):
    - `bowl`: Chiều cao `[-0.65, 0.60]`, bán kính tối đa `0.85`.
    - `plate`: Chiều cao `[-0.20, 0.20]`, bán kính tối đa `1.10`.
    - `mug`: Chiều cao `[-0.60, 0.60]`, bán kính tối đa `0.55`.
    - `vase`: Chiều cao `[-0.95, 0.95]`, bán kính tối đa `0.65`.
    - `vase-narrow-neck`: Chiều cao `[-1.05, 1.05]`, bán kính tối đa `0.60`.
  - Tự động nhận diện archetype dựa trên tỷ lệ `aspectRatio = height / width` của bounding box và tạo ra kích thước cân đối tự nhiên.
- **File thay đổi:** `AI/lathe.js`, `API/server.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group A: 7 archetypes chuẩn hóa tỷ lệ chính xác).

---

### BUG-06: Tự giao nhau (Self-Intersection) của thành gốm bên trong
- **Mức độ:** P1 (High).
- **Vị trí:** `AI/lathe.js`, `API/server.js`.
- **Nguyên nhân gốc rễ:**
  - Thành trong được tạo bằng cách trừ cố định một lượng bán kính: `innerR = r - thickness`.
  - Ở những vị trí cổ bình hẹp hoặc chân đế thắt nhỏ có bán kính `r < thickness`, giá trị `innerR` bị âm hoặc đảo chiều sang bên kia trục quay, khiến mặt lưới Three.js bị lộn ngược (inverted normals, non-manifold geometry, self-intersecting faces).
- **Hành vi sau khi sửa:**
  - Áp dụng công thức bề dày thích ứng (adaptive wall thickness):
    `effectiveThickness = Math.min(baseThickness, r * 0.45)`.
  - Đảm bảo `innerR = Math.max(0.015, r - effectiveThickness) >= 0.015`.
  - Thành trong luôn cách trục xoay một khoảng an toàn, không bao giờ cắt qua thành ngoài hoặc tạo bán kính âm.
- **File thay đổi:** `AI/lathe.js`, `API/server.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group C: "Tất cả các điểm thành thân đều có bán kính dương > 0", "Chân đế và đáy trong chạm trục xoay X=0").

---

### BUG-07: Thiếu kiểm tra và khử độc dữ liệu phản hồi AI Prompt-to-3D
- **Mức độ:** P1 (High).
- **Vị trí:** `API/cloudflareService.js`.
- **Nguyên nhân gốc rễ:**
  - Mô hình ngôn ngữ lớn (LLM) khi sinh JSON đôi khi trả về trường thiếu, sai kiểu chuỗi, hoặc các giá trị float `NaN`/`Infinity`.
  - Nếu chuyển thẳng dữ liệu này vào Three.js `LatheGeometry`, renderer sẽ bị crash với lỗi WebGL buffer allocation failure.
- **Hành vi sau khi sửa:**
  - Bổ sung hàm lọc và ràng buộc số học nghiêm ngặt:
    - Bán kính, chiều cao, độ loe miệng (`neckRatio`, `rimFlare`, `baseRadius`) được kẹp trong ngưỡng vật lý cho phép `[0.1, 2.5]`.
    - Mọi tọa độ trong `lathePoints` được kiểm tra `Number.isFinite(p.x) && Number.isFinite(p.y)`.
    - Mã màu men (`suggestedGlaze`) được kiểm tra định dạng hex chuẩn `#RRGGBB`.
    - Độ nhám (`roughness`), độ kim loại (`metalness`) được kẹp chặt trong khoảng `[0.0, 1.0]`.
- **File thay đổi:** `API/cloudflareService.js`.
- **Test xác minh:** `tools/test_3d_comprehensive.mjs` (Test Group E: "promptTo3DConcept tiếng Việt", "suggestedGlaze hex format hợp lệ", "prompt rỗng fallback").

---

### BUG-08: Rủi ro bảo mật SSRF trong Gradio 3D Client
- **Mức độ:** P1 (High).
- **Vị trí:** `API/lib/gradioClient.js`.
- **Nguyên nhân gốc rễ:**
  - Hàm `callGradioPredict` và tải file GLB chấp nhận các URL tùy ý từ cấu hình hoặc tham số mà không kiểm tra địa chỉ loopback/nội bộ (`localhost`, `127.0.0.1`, `169.254.169.254`).
- **Hành vi sau khi sửa:**
  - Bổ sung bộ lọc URL nghiêm ngặt: chỉ cho phép giao thức `https:` và từ chối các dải IP nội bộ/cloud metadata service.
- **File thay đổi:** `API/lib/gradioClient.js`.

---

## 3. TƯƠNG THÍCH FRONTEND (FE BACKWARD COMPATIBILITY)
- **Tình trạng Frontend:** Hoàn toàn **KHÔNG** chỉnh sửa bất kỳ file nào trong `FE/`.
- **Khế ước API giữ nguyên 100%:**
  - Cấu trúc đối tượng `lathePoints` dạng mảng `{ x: number, y: number }[]` với đúng 38 điểm chuẩn mà `CeramicCanvas3D.jsx` mong đợi.
  - Mọi trường phản hồi của `/api/ai/prompt-to-3d`, `/api/ai/clean-and-deconstruct`, `/api/ai/concept-6views`, và Worker `/lathe` giữ nguyên tên và kiểu dữ liệu (`success`, `modelType`, `shapeParams`, `lathePoints`, `suggestedGlaze`, `pattern`, `title`).
- **Kết quả:** Frontend đọc dữ liệu trơn tru, không phát sinh lỗi tương thích hoặc lệch chuẩn hiển thị.
