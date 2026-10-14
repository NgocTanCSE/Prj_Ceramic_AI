import React, { useRef } from 'react';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
import { SIGNATURE_PRODUCTS, PRODUCTS } from '../data/products';
import { useScrollReveal } from '../hooks/useScrollReveal';

/* ──────────────────────────────────────────────────────────
   HomeScreen - Không Gian Làng Gốm Biên Hòa (Tân Vạn, Đồng Nai)
   Tuân thủ nguyên tắc humanizer: Viết chân thực, có bối cảnh
   lịch sử thật từ Trường Mỹ nghệ Biên Hòa 1903, bãi đất phù sa
   sông Đồng Nai, kỹ thuật khắc chìm champlevé và lò rồng Tân Vạn.
   Loại bỏ toàn bộ sáo ngữ AI, từ ngữ tiếp thị rỗng và bố cục SaaS.
   ────────────────────────────────────────────────────────── */

export default function HomeScreen() {
  const containerRef = useRef(null);
  useScrollReveal(containerRef);

  const { setModelType } = useDesign();
  const { setActiveTab } = useNavigation();

  const handleSelectFeaturedModel = (modelType) => {
    if (setModelType) {
      setModelType(modelType);
    }
    setActiveTab('studio-3d');
  };

  return (
    <div ref={containerRef} className="w-full bg-ceramic-paper text-ceramic-charcoal font-body selection:bg-ceramic-terracotta selection:text-ceramic-paper">
      {/* ════════════════════════════════════════════════════
         SECTION 1: HERO EDITORIAL - SẮC MEN XANH ĐỒNG VÀ ĐẤT TÂN VẠN
         ════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 lg:pt-14 pb-14 lg:pb-20 border-b border-ceramic-border">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

          {/* Cột trái (7 cols): Câu chuyện nguồn cội và công cụ trải nghiệm */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2.5 text-xs font-mono text-ceramic-slate">
            </div>

            <div className="space-y-3">
              <h1 className="font-editorial text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight text-ceramic-charcoal leading-[1.08]">
                Gốm men xanh đồng Biên Hòa bên bờ sông Đồng Nai
              </h1>
              <p className="font-editorial text-xl sm:text-2xl italic text-ceramic-terracotta leading-snug">
                Từ lối khắc champlevé thời Trường Mỹ nghệ Biên Hòa 1903 đến những mẻ nung củi trong lò rồng Tân Vạn.
              </p>
            </div>

            <p className="text-ceramic-slate text-sm sm:text-base leading-relaxed max-w-2xl">
              Ở Tân Vạn, người thợ giữ thói quen lấy đất sét phù sa từ bãi bồi ven sông Đồng Nai, ủ qua mùa mưa rồi lọc sạch sạn trước khi lên bàn xoay. Men xanh đồng pha từ gỉ đồng và tro rơm nếp, đưa vào lò rồng đốt củi cao su suốt 36 giờ để men tự biến hóa. Bạn có thể tự dựng bản vẽ trực giao để tính độ dày thành gốm, thử men màu trên bàn xoay 3D, hoặc gửi mẫu để thợ xưởng tiện phôi theo kích thước mong muốn.
            </p>

            {/* Nhóm thao tác chính */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('ai-creator')}
                className="px-5 py-3 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-terracotta/90 text-ceramic-paper text-xs font-medium tracking-wide flex items-center gap-2 transition-all shadow-paper"
              >
                <span>Phác thảo bản vẽ dáng gốm</span>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSelectFeaturedModel('vase');
                }}
                className="px-5 py-3 rounded-xl bg-ceramic-paper hover:bg-ceramic-cream text-ceramic-charcoal border border-ceramic-border text-xs font-medium tracking-wide flex items-center gap-2 transition-all shadow-paper"
              >
                <span>Thử men trên bàn xoay 3D</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('gallery')}
                className="px-3.5 py-3 text-xs text-ceramic-slate hover:text-ceramic-charcoal underline underline-offset-4 font-medium transition-colors"
              >
                Xem thư viện phôi gốm →
              </button>
            </div>

            {/* 3 ghi chú vật liệu thực tế của xưởng */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-ceramic-border/60 text-xs">
              <div className="p-3 rounded-lg bg-ceramic-cream/40 border border-ceramic-border/50">
                <div className="font-semibold text-ceramic-charcoal">Đất sét xám Tân Vạn</div>
                <div className="text-[11px] text-ceramic-slate mt-0.5">Dẻo dai, lọc 3 tầng bể, co ngót 9–11%</div>
              </div>
              <div className="p-3 rounded-lg bg-ceramic-cream/40 border border-ceramic-border/50">
                <div className="font-semibold text-ceramic-charcoal">Rãnh khắc champlevé</div>
                <div className="text-[11px] text-ceramic-slate mt-0.5">Vạch khi đất ẩm se, ngăn các mảng men loang</div>
              </div>
              <div className="p-3 rounded-lg bg-ceramic-cream/40 border border-ceramic-border/50">
                <div className="font-semibold text-ceramic-charcoal">Men Vert de Biên Hòa</div>
                <div className="text-[11px] text-ceramic-slate mt-0.5">Oxit đồng & tro rơm nếp, nung củi 1.220°C</div>
              </div>
            </div>
          </div>

          {/* Cột phải (5 cols): Thẻ tác phẩm tiêu biểu có ảnh thực tế */}
          <div className="lg:col-span-5 scroll-reveal delay-150">
            <div className="bg-ceramic-paper border border-ceramic-border rounded-2xl overflow-hidden shadow-paper hover:shadow-card transition-shadow">
              {/* Hình ảnh tác phẩm */}
              <div className="relative aspect-[8/9] bg-ceramic-cream overflow-hidden">
                <img
                  src="https://cdnmedia.baotintuc.vn/Upload/rGkvwNpj74Z1EcpzQ6ltA/files/2024/06/tuan1/gom-3624(1).jpg"
                  alt="Bình gốm khắc chìm hoa cúc dây Biên Hòa"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
         SECTION 2: BA CÔNG ĐOẠN TỪ BẢN VẼ ĐẾN MẺ LÒ
         (Bố cục 3 cột song song có chiều sâu, thay cho 3 dòng SaaS)
         ════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-ceramic-border">
        <div className="max-w-2xl mb-12 scroll-reveal">
          <div className="text-xs font-mono text-ceramic-terracotta tracking-wider uppercase font-semibold">
            Quy trình tạo tác
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal mt-1.5">
            Ba công đoạn từ bản vẽ đến mẻ lò
          </h2>
          <p className="text-xs sm:text-sm text-ceramic-slate mt-2 leading-relaxed">
            Từ bản vẽ trực giao trên máy đến bàn tay thợ gọt đất bên bờ sông Đồng Nai.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Bước 1 */}
          <div
            onClick={() => setActiveTab('ai-creator')}
            className="group cursor-pointer p-6 rounded-2xl bg-ceramic-paper border border-ceramic-border hover:border-ceramic-terracotta/40 hover:shadow-card transition-all flex flex-col justify-between scroll-reveal delay-100"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('ai-creator')}
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-ceramic-cream border border-ceramic-border flex items-center justify-center font-editorial text-lg font-bold text-ceramic-terracotta group-hover:bg-ceramic-terracotta group-hover:text-ceramic-paper transition-colors">
                1
              </div>
              <div>
                <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal group-hover:text-ceramic-terracotta transition-colors">
                  Dựng hình học & tỉ lệ phôi
                </h3>
                <p className="text-xs sm:text-sm text-ceramic-slate mt-2.5 leading-relaxed">
                  Tính toán chiều cao, đường kính miệng và độ dày thành gốm 5–7mm qua 6 góc chiếu trực giao. Người làm gốm tính trước tỷ lệ co ngót 9–11% của đất Tân Vạn để khi nung chín sản phẩm không bị méo lệch.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-ceramic-border/60 flex items-center text-xs font-medium text-ceramic-terracotta group-hover:text-ceramic-terracotta/80 transition-colors">
              <span>Mở phòng phác thảo bản vẽ</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Bước 2 */}
          <div
            onClick={() => setActiveTab('studio-3d')}
            className="group cursor-pointer p-6 rounded-2xl bg-ceramic-paper border border-ceramic-border hover:border-ceramic-terracotta/40 hover:shadow-card transition-all flex flex-col justify-between scroll-reveal delay-200"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('studio-3d')}
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-ceramic-cream border border-ceramic-border flex items-center justify-center font-editorial text-lg font-bold text-ceramic-terracotta group-hover:bg-ceramic-terracotta group-hover:text-ceramic-paper transition-colors">
                2
              </div>
              <div>
                <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal group-hover:text-ceramic-terracotta transition-colors">
                  Vạch rãnh khắc & Phối men màu
                </h3>
                <p className="text-xs sm:text-sm text-ceramic-slate mt-2.5 leading-relaxed">
                  Dùng mũi sắt vạch rãnh sâu khi đất còn ẩm se mặt. Từng đường rãnh giữ vai trò như bờ đê ngăn các dòng men Vert de Biên Hòa, men đá đỏ Bửu Long và men vàng hoàng yến không chảy tràn lẫn vào nhau khi nhiệt độ lò dâng cao.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-ceramic-border/60 flex items-center text-xs font-medium text-ceramic-terracotta group-hover:text-ceramic-terracotta/80 transition-colors">
              <span>Vào xưởng phối men 3D</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Bước 3 */}
          <div
            onClick={() => setActiveTab('checkout')}
            className="group cursor-pointer p-6 rounded-2xl bg-ceramic-paper border border-ceramic-border hover:border-ceramic-terracotta/40 hover:shadow-card transition-all flex flex-col justify-between scroll-reveal delay-300"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('checkout')}
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-ceramic-cream border border-ceramic-border flex items-center justify-center font-editorial text-lg font-bold text-ceramic-terracotta group-hover:bg-ceramic-terracotta group-hover:text-ceramic-paper transition-colors">
                3
              </div>
              <div>
                <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal group-hover:text-ceramic-terracotta transition-colors">
                  Ủ lửa trong lò rồng 36 giờ
                </h3>
                <p className="text-xs sm:text-sm text-ceramic-slate mt-2.5 leading-relaxed">
                  Lò bầu Tân Vạn xây dốc theo triền đất ven sông, đốt củi cao su liên tục suốt 36 giờ. Người thợ nhìn qua lỗ giòi quan sát ngọn lửa trắng để biết khi nào men trổ bông tự nhiên rồi mới ngưng củi ủ lò.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-ceramic-border/60 flex items-center text-xs font-medium text-ceramic-terracotta group-hover:text-ceramic-terracotta/80 transition-colors">
              <span>Xem lịch hẹn & Đặt chế tác</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
         SECTION 3: BỘ SƯU TẬP TÁC PHẨM ĐẶC TRƯNG BIÊN HÒA
         ════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-ceramic-border">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4 scroll-reveal">
          <div>
            <div className="text-xs font-mono text-ceramic-terracotta tracking-wider uppercase font-semibold">
              Di sản tạo hình
            </div>
            <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal mt-1">
              Các dáng gốm tiêu biểu của xưởng
            </h2>
            <p className="text-xs sm:text-sm text-ceramic-slate mt-1.5">
              Những mẫu phôi gắn liền với lịch sử Trường Mỹ nghệ Biên Hòa và lò gốm ven sông Đồng Nai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className="text-xs font-semibold text-ceramic-terracotta hover:text-ceramic-terracotta/80 transition-colors self-start md:self-auto"
          >
            Xem tất cả phôi mẫu trong kho →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1: Đôn Voi */}
          <div className="bg-ceramic-paper border border-ceramic-border rounded-2xl overflow-hidden flex flex-col group hover:shadow-card transition-shadow scroll-reveal delay-100">
            <div className="relative aspect-[4/3] bg-ceramic-cream overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=600&q=80"
                alt="Đôn voi gốm men xanh đồng Biên Hòa"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-ceramic-charcoal/80 text-ceramic-paper text-[10px] font-mono">
                PARIS 1925
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal">
                    Đôn Voi Men Xanh Đồng
                  </h3>
                  <span className="text-xs font-semibold text-ceramic-terracotta font-mono">
                    1.850.000đ
                  </span>
                </div>
                <p className="text-xs text-ceramic-slate mt-2 leading-relaxed">
                  Tượng voi mang hoa văn cúc dây và hoa sen lá lật, biểu tượng từng đạt giải danh dự tại triển lãm Quốc tế Paris năm 1925.
                </p>
              </div>
              <div className="pt-3 border-t border-ceramic-border/60 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-ceramic-slate">Nung củi 36h</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('gallery')}
                  className="font-medium text-ceramic-terracotta hover:text-ceramic-terracotta/80"
                >
                  Xem chi tiết tác phẩm
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Bình hoa Cúc dây */}
          <div className="bg-ceramic-paper border border-ceramic-border rounded-2xl overflow-hidden flex flex-col group hover:shadow-card transition-shadow scroll-reveal delay-200">
            <div className="relative aspect-[4/3] bg-ceramic-cream overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80"
                alt="Bình hoa cúc dây chạm lộng"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-ceramic-charcoal/80 text-ceramic-paper text-[10px] font-mono">
                CHAMPLEVÉ
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal">
                    Bình Hoa Cúc Dây Chạm Lộng
                  </h3>
                  <span className="text-xs font-semibold text-ceramic-terracotta font-mono">
                    920.000đ
                  </span>
                </div>
                <p className="text-xs text-ceramic-slate mt-2 leading-relaxed">
                  Dáng bình tròn nở, bề mặt khắc chìm hoa cúc dây champlevé lộng men Vert de Biên Hòa kết hợp men vàng hoàng yến và men đá đỏ.
                </p>
              </div>
              <div className="pt-3 border-t border-ceramic-border/60 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-ceramic-slate">Thành gốm 6mm</span>
                <button
                  type="button"
                  onClick={() => handleSelectFeaturedModel('vase')}
                  className="font-medium text-ceramic-terracotta hover:text-ceramic-terracotta/80"
                >
                  Phối men mẫu này
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Bát Trà Men Đá Đỏ */}
          <div className="bg-ceramic-paper border border-ceramic-border rounded-2xl overflow-hidden flex flex-col group hover:shadow-card transition-shadow scroll-reveal delay-300">
            <div className="relative aspect-[4/3] bg-ceramic-cream overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=600&q=80"
                alt="Bát trà men đá đỏ Bửu Long"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-ceramic-charcoal/80 text-ceramic-paper text-[10px] font-mono">
                GỐM MỘC NAM BỘ
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal">
                    Bát Trà Men Đá Đỏ Bửu Long
                  </h3>
                  <span className="text-xs font-semibold text-ceramic-terracotta font-mono">
                    210.000đ
                  </span>
                </div>
                <p className="text-xs text-ceramic-slate mt-2 leading-relaxed">
                  Dáng bát đầm tay, nung củi lò rồng giữ trọn độ mộc của đất sét pha quặng đá ong, tôn vinh sắc nâu đỏ bazan nguyên bản phương Nam.
                </p>
              </div>
              <div className="pt-3 border-t border-ceramic-border/60 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-ceramic-slate">Đường kính 13cm</span>
                <button
                  type="button"
                  onClick={() => handleSelectFeaturedModel('bowl')}
                  className="font-medium text-ceramic-terracotta hover:text-ceramic-terracotta/80"
                >
                  Phối men mẫu này
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
         SECTION 4: LÒ GỐM BÊN BỜ SÔNG VÀ TRẢI NGHIỆM TẬN XƯỞNG
         (Thay thế khối xanh than nặng nề cũ bằng không gian xưởng ấm áp)
         ════════════════════════════════════════════════════ */}
      <section className="bg-ceramic-cream/50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

            {/* Cột trái (7 cols): Câu chuyện xưởng lò bờ sông */}
            <div className="lg:col-span-7 space-y-6 scroll-reveal delay-100">
              <div className="flex items-center gap-2 text-xs font-mono text-ceramic-terracotta uppercase tracking-wider font-semibold">
                <span>Ghé thăm xưởng gốm</span>
              </div>

              <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal leading-tight">
                Lò gốm bên bờ sông Đồng Nai
              </h2>

              <p className="text-ceramic-slate text-sm sm:text-base leading-relaxed">
                Dọc theo khúc sông Tân Vạn, những xưởng gốm gia đình vẫn duy trì lò rồng nung củi qua nhiều thế hệ. Ghe thuyền chở đất sét phù sa cập bến từ hạ lưu, củi cao su xếp thành từng đống dài chờ ngày nổi lửa. Nếu bạn muốn tự tay nặn đất và cảm nhận độ trơn mịn của bàn xoay, xưởng luôn mở cửa đón khách vào mỗi dịp cuối tuần.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-xs">
                <div className="p-4 rounded-xl bg-ceramic-paper border border-ceramic-border">
                  <div className="font-semibold text-ceramic-charcoal">Địa chỉ xưởng Tân Vạn</div>
                  <div className="text-ceramic-slate mt-1 leading-relaxed">
                    Bờ kè sông Đồng Nai, phường Tân Vạn, thành phố Biên Hòa
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-ceramic-paper border border-ceramic-border">
                  <div className="font-semibold text-ceramic-charcoal">Thời gian mở cửa</div>
                  <div className="text-ceramic-slate mt-1 leading-relaxed">
                    Thứ Bảy và Chủ Nhật: 8:30 sáng – 16:30 chiều
                  </div>
                </div>
              </div>
            </div>

            {/* Cột phải (5 cols): Thẻ Workshop trải nghiệm */}
            <div className="lg:col-span-5 bg-ceramic-paper border border-ceramic-border rounded-2xl p-6 sm:p-8 space-y-5 shadow-paper scroll-reveal delay-200">
              <div className="flex items-center justify-between pb-3 border-b border-ceramic-border/60">
                <span className="text-xs font-mono uppercase tracking-wider text-ceramic-terracotta font-semibold">
                  Buổi học nặn gốm
                </span>
                <span className="text-xs font-mono text-ceramic-slate">Kèm 1-kèm-1</span>
              </div>

              <div>
                <h3 className="font-editorial text-2xl font-bold text-ceramic-charcoal">
                  Tự tay vuốt phôi & Khắc chìm hoa văn
                </h3>
                <p className="text-xs text-ceramic-slate mt-2 leading-relaxed">
                  Nghệ nhân xưởng hướng dẫn từng thao tác: từ vỗ đất, lấy tâm trên bàn xoay, vuốt thành gốm đến dùng mũi dao sắt vạch nét rãnh champlevé.
                </p>
              </div>

              <div className="space-y-2 text-xs font-mono text-ceramic-slate pt-2 border-t border-ceramic-border/60">
                <div className="flex justify-between py-1">
                  <span>Thời lượng:</span>
                  <span className="text-ceramic-charcoal font-medium">120 phút bên bàn xoay</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Vật liệu:</span>
                  <span className="text-ceramic-charcoal font-medium">Đất sét xám Tân Vạn không giới hạn</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Sau khi xong:</span>
                  <span className="text-ceramic-terracotta font-medium">Xưởng tráng men xanh đồng & nung giao tận nhà</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('checkout')}
                className="w-full py-3.5 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-terracotta/90 text-ceramic-paper text-xs font-medium tracking-wide transition-colors text-center shadow-paper"
              >
                Đặt lịch hẹn trải nghiệm tại xưởng Tân Vạn →
              </button>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
