# HƯỚNG DẪN VÀ BÁO CÁO TRIỂN KHAI GITHUB PAGES TỪ KHOADUC (DEPLOYMENT GUIDE)

**Dự án:** Gốm Việt — Nền tảng thiết kế gốm sứ 3D có AI hỗ trợ  
**Kho mã nguồn (Repository):** `https://github.com/NgocTanCSE/Prj_Ceramic_AI`  
**Nhánh nguồn và đích duy nhất:** `khoaduc` (tracking `origin/khoaDuc`)  
**Nhánh bảo vệ tuyệt đối:** `main` (SHA: `d525bf3dea95cd2aa015d919fc8082d4cadf1433`)  
**Thư mục bảo vệ nguyên vẹn:** `FE/` (Read-Only 100%)  

---

## 1. KIẾN TRÚC TRIỂN KHAI (DEPLOYMENT ARCHITECTURE)

```
[GitHub Repository]
      │
      ├── Branch: khoaduc (chứa mã nguồn 3D algorithm đã sửa & test)
      │      │
      │      ▼
[GitHub Actions Workflow: deploy-khoaduc-pages.yml]
      │
      ├── 1. Checkout commit trên branch khoaduc
      ├── 2. Cài đặt dependency từ lockfile: npm ci (trong FE/)
      ├── 3. Chạy kiểm thử tự động: node tools/test_3d_comprehensive.mjs (56/56 PASS)
      ├── 4. Build Vite Frontend với cờ: --base=/Prj_Ceramic_AI/
      ├── 5. Upload artifact và triển khai tới GitHub Pages
      │
      ▼
[GitHub Pages Hosting]
      URL: https://ngoctancse.github.io/Prj_Ceramic_AI/
```

---

## 2. PHÂN ĐỊNH RÕ RÀNG KHẢ NĂNG CỦA CÁC THÀNH PHẦN

### 2.1. Frontend trên GitHub Pages
- **Dịch vụ:** GitHub Pages là web server tĩnh (Static File Server).
- **Tính năng hoạt động đầy đủ trên Pages:**
  - Giao diện người dùng React 18 & Three.js WebGL canvas.
  - Bộ hiển thị gốm 3D (`CeramicCanvas3D.jsx`) với khả năng xoay 360°, zoom, đổi màu men, hoa văn, khắc chữ.
  - Bộ sinh mô hình từ dáng chuẩn và mesh inflation trực tiếp trên client.
  - Xem và lưu trữ thiết kế trong bộ nhớ cục bộ (Local State/Session).

### 2.2. Backend & AI Services (Express / Cloudflare Worker)
- **Thực tế kỹ thuật:** GitHub Pages **KHÔNG** chạy được runtime Node.js, Express server (`API/server.js`), Docker Compose hay native binary `sharp`.
- **Phương án kết nối Backend:**
  - Nếu muốn kết nối AI sinh hình thời gian thực từ server, quản trị viên chỉ cần thiết lập biến môi trường trên GitHub Repository:
    - Vào **Settings** -> **Secrets and variables** -> **Actions** -> **Variables**.
    - Tạo biến `VITE_AI_API_BASE_URL` trỏ về địa chỉ backend HTTPS đã deploy (ví dụ: `https://api-ceramic.yourdomain.com`).
    - Tạo biến `VITE_API_BASE_URL` trỏ về backend Express.
  - Khi workflow chạy, Vite sẽ tự động đưa các biến này vào bản build.
  - Nếu chưa cấu hình backend URL, ứng dụng tự động kích hoạt chế độ mô phỏng / client-side reconstruction không để xảy ra màn hình trắng hay lỗi ứng dụng.

---

## 3. CẤU HÌNH GITHUB ACTIONS WORKFLOW

File: `.github/workflows/deploy-khoaduc-pages.yml`

- **Sự kiện kích hoạt (Triggers):**
  - Push vào nhánh `khoaduc` hoặc `khoaDuc`.
  - Manual trigger (`workflow_dispatch`) qua giao diện GitHub Actions.
  - Tuyệt đối **không** kích hoạt khi push vào `main`.
- **Bảo mật và Phân quyền:**
  - `contents: read`
  - `pages: write`
  - `id-token: write`
- **Chống tranh chấp tài nguyên (Concurrency):**
  - Nhóm `pages-khoaduc`, tự động hủy các build cũ nếu có commit mới được push liên tục.
- **Tiêu chuẩn chất lượng:**
  - Chạy toàn bộ bộ test suite 56 test cases trước khi tiến hành đóng gói và deploy.

---

## 4. HƯỚNG DẪN KÍCH HOẠT VÀ KIỂM CHỨNG TRÊN GITHUB

1. **Bật GitHub Pages trong Repository Settings:**
   - Truy cập: `https://github.com/NgocTanCSE/Prj_Ceramic_AI/settings/pages`
   - Tại mục **Build and deployment** -> **Source**: Chọn **GitHub Actions**.
2. **Theo dõi Workflow:**
   - Truy cập tab **Actions**: `https://github.com/NgocTanCSE/Prj_Ceramic_AI/actions`
   - Chọn workflow `Deploy GitHub Pages from khoaduc`.
   - Xem tiến trình các bước: `Checkout` -> `Install dependencies` -> `Run 3D Algorithm Test Suite` -> `Build Frontend` -> `Deploy to GitHub Pages`.
3. **Kiểm tra Website:**
   - Truy cập URL triển khai: `https://ngoctancse.github.io/Prj_Ceramic_AI/`
   - Xác nhận đường dẫn base assets không gặp lỗi 404.
   - Thử nghiệm tương tác với canvas 3D trên trình duyệt.
