# BÁO CÁO TRIỂN KHAI VÀ KHẮC PHỤC LỖI VERCEL — GỐM VIỆT 3D

**Dự án:** Gốm Việt — Nền tảng thiết kế gốm sứ 3D có AI hỗ trợ  
**Vercel Scope / Team:** `visionary19`  
**Vercel Project:** `ceramic_ai`  
**Production URL:** [https://ceramicai.vercel.app/](https://ceramicai.vercel.app/)  
**Deployment ID:** `dpl_Hpzkt7pPWsTPNR6nBzyW3cvXem6S`  
**Trạng thái Deployment:** ● Ready (Production)  
**Thời gian hoàn thành:** Tháng 10/2026  

---

## 1. NGUYÊN NHÂN GỐC RỄ WEBSITE CŨ BỊ LỖI (ROOT CAUSE ANALYSIS)

Trước khi can thiệp, truy cập `https://ceramicai.vercel.app/` trả về lỗi **404 NOT_FOUND**. Qua điều tra chuyên sâu bằng Vercel CLI và API, phát hiện 4 nguyên nhân chính:

1. **Sai Root Directory:** Project trên Vercel ban đầu cấu hình Root Directory là `.` (thư mục gốc repository) thay vì thư mục `FE` chứa ứng dụng React + Vite. Ở thư mục gốc không có `package.json` và không có `index.html`.
2. **Framework Preset sai (`Other`):** Vercel coi project là một thư mục file tĩnh thông thường (build duration 0ms/5s), không chạy lệnh `npm ci` và `npm run build`. Vercel chỉ phục vụ các file ở thư mục gốc, dẫn tới việc truy cập root `/` bị lỗi 404 NOT_FOUND.
3. **Deployment Protection / SSO Bật mặc định:** Project bị kích hoạt cấu hình `ssoProtection` (`all_except_custom_domains`), khiến người dùng khi truy cập các URL xem trước của Vercel bị chuyển hướng sang trang đăng nhập Vercel (`Login – Vercel`).
4. **Vite Base Path lệch chuẩn:** Cấu hình trước đây chạy cho GitHub Pages với tiền tố `/Prj_Ceramic_AI/`, trong khi Vercel yêu cầu base path tại gốc `/`.

---

## 2. CÁC THAY ĐỔI CẤU HÌNH ĐÃ THỰC HIỆN

| Hạng mục | Cấu hình cũ (Lỗi) | Cấu hình mới (Chuẩn hóa) | Mục đích / Tác dụng |
|---|---|---|---|
| **Root Directory** | `.` | `FE` | Trỏ chính xác vào source code React Vite |
| **Framework Preset** | `Other` | `Vite` | Kích hoạt bộ tiền xử lý và tối ưu hóa của Vite |
| **Build Command** | `npm run build` | `npm run build -- --base=/` | Xuất assets sạch tại `/assets/` thay vì `/Prj_Ceramic_AI/` |
| **Output Directory** | `.` | `dist` | Phục vụ chính xác bundle HTML/CSS/JS sau build |
| **Install Command** | Mặc định | `npm ci` | Cài đặt chính xác theo `FE/package-lock.json` |
| **Node.js Version** | `20.x` (bị Vercel ngừng hỗ trợ) | `24.x` | Tương thích runtime mới nhất của Vercel CLI |
| **SSO Protection** | `all_except_custom_domains` | `disabled` | Mở quyền truy cập công khai cho người dùng |
| **SPA Routing** | Không có (refresh 404) | `vercel.json` rewrites `/(.*) -> /index.html` | Đảm bảo tải lại trang tại `/studio`, `/gallery` không bị 404 |

---

## 3. KẾT QUẢ KIỂM CHỨNG TRỰC TIẾP (VERIFICATION RESULTS)

### 3.1. Kiểm tra HTTP và Assets qua Script tự động ([tools/verify_live.mjs](file:///c:/Users/asus/Documents/Prj_Ceramic_AI/tools/verify_live.mjs))
- **Trang chủ (`/`):** HTTP `200 OK`, Title: *Gốm Việt • Không Gian Mỹ Nghệ Làng Gốm Biên Hòa (Đồng Nai)*.
- **JavaScript Bundle (`/assets/index-DPTzpn78.js`):** HTTP `200 OK` (`application/javascript`).
- **CSS Stylesheet (`/assets/index-BtFQGh18.css`):** HTTP `200 OK` (`text/css`).
- **Three.js Chunks & Fonts:** Tải đầy đủ với mã 200, không có asset nào 404.
- **SPA Fallback Routing:**
  - `GET /studio` $\to$ HTTP 200
  - `GET /gallery` $\to$ HTTP 200
  - `GET /aico` $\to$ HTTP 200

### 3.2. Kiểm tra trực quan qua Browser Automation (Chrome Headless)
- **Giao diện người dùng:**
  - Hiển thị đầy đủ thanh điều hướng Sidebar (`Trang chủ`, `Thư viện mẫu`, `Phác thảo mẫu`, `Xưởng tạo hình`).
  - Banner thương hiệu: *LÀNG GỐM BIÊN HÒA — Bảo tồn và Phát triển Nghề Gốm Truyền Thống Việt Nam*.
  - Tiêu đề hero: *Gốm men xanh đồng Biên Hòa bên bờ sông Đồng Nai*.
- **Bộ dựng hình 3D (Three.js WebGL Studio):**
  - Đã nạp thành công mô hình gốm vào canvas 3D.
  - Tương tác xoay 360°, thu phóng mượt mà.
  - Thử nghiệm chuyển đổi men gốm sang *Men Lam Cổ Chu Đậu*, canvas WebGL cập nhật vật liệu phản chiếu ánh sáng tức thì trong thời gian thực.
- **Console & Network:** 0 lỗi cú pháp, 0 lỗi runtime, 0 cảnh báo bảo mật.
