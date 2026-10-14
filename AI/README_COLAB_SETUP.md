---
# ⚠️ DEPRECATED — GPU / LLM Colab Worker Layer (removed in v1.1)
> **Status: DISABLED.** The `AI/server.py`, `AI/ai_3d_worker.py`, and
> `AI/Colab_AI_3D_Worker.ipynb` files have been **DELETED** and the
> `Zero123++ GPU bridge`, `/api/ai/worker-health`, and `pythonAiUrl` wiring in
> `API/server.js` + `FE/src/screens/AICoCreatorScreen.jsx` have been **REMOVED**.
>
> The 6-orthographic-view generation now runs **exclusively** on the pure
> Node.js rule engine (Sharp + silhouette analysis), with **no LLM / GPU**
> dependency. This README is preserved for historical reference only.
> Do NOT reinstall the Python dependencies (`torch`, `uvicorn`, etc.) — they are
> no longer used by the pipeline.
---

# Hướng Dẫn Kích Hoạt Server Python AI GPU Cho Bóc Tách 6 Mặt 3D

Để tạo ra **6 mặt trực giao chân thực (Front, Back, Left, Right, Top, Bottom)** và **Mô hình 3D Mesh (.glb)** từ 1 bức ảnh chụp bất kỳ (tượng người, đồ gốm sứ phức tạp), hệ thống đã được thiết kế sẵn để kết nối với **Server GPU (Google Colab hoặc RunPod)**.

---

## 🚀 Cách 1: Chạy Miễn Phí Trên Google Colab (GPU NVIDIA Tesla T4)

1. Mở trình duyệt và truy cập [Google Colab](https://colab.research.google.com/).
2. Chọn **Upload** và tải lên file:
   `AI/Colab_AI_3D_Worker.ipynb` (đã tạo sẵn trong dự án của bạn).
3. Trên thanh công cụ Colab, vào menu **Runtime** ➔ **Change runtime type** ➔ Chọn **T4 GPU** (miễn phí) ➔ Bấm **Save**.
4. Chạy từng ô lệnh (hoặc bấm `Runtime` ➔ `Run all`).
5. Khi ô lệnh cuối cùng chạy xong, bạn sẽ nhận được một đường link HTTPS công khai dạng:
   ```text
   https://xxxxxx.trycloudflare.com
   ```
6. **Kích hoạt trên Web Gốm**:
   - Mở màn hình **AI Co-Creator** trên web (`http://localhost:3002`).
   - Bấm vào nút `⚙️ Cấu hình GPU Server (Colab/RunPod)`.
   - Dán đường link `https://xxxxxx.trycloudflare.com` vào ô nhập và bấm **"Lưu & Áp Dụng"**.
   - Đèn trạng thái sẽ chuyển sang: `🟢 MODEL AI GPU: NVIDIA T4 (ONLINE)`.
   - Từ lúc này, mọi bức ảnh phôi bạn tải lên sẽ được GPU AI xử lý và bóc tách chuẩn xác 6 mặt lập phương!

---

## ⚡ Cách 2: Chạy Trên Server Riêng Hoặc RunPod (Có Card NVIDIA RTX)

1. Mở terminal trên máy chủ GPU:
   ```bash
   cd AI
   pip install fastapi uvicorn pillow pydantic torch torchvision
   python ai_3d_worker.py
   ```
2. Mặc định server sẽ lắng nghe tại `http://localhost:5000`.
3. Nhập `http://localhost:5000` vào ô cấu hình trên web.
