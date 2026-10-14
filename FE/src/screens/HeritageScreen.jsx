import React, { useState, useRef } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useDesign } from '../contexts/DesignContext';
import { useScrollReveal } from '../hooks/useScrollReveal';

/* ──────────────────────────────────────────────────────────
   HeritageScreen — Di Sản & Câu Chuyện Làng Gốm Biên Hòa - Tân Vạn
   Gốm Biên Hòa hơn 300 năm hình thành (từ cuối thế kỷ XVII),
   đỉnh cao trường phái mỹ nghệ 1903 và huy chương Vàng Paris 1925.
   Bao gồm:
   - Các bài viết tư liệu lịch sử có nguồn xác thực
   - Quy trình nung lò rồng & kỹ thuật khắc chìm champlevé
   - Chân dung nghệ nhân tiêu biểu giữ lửa nghề
   - Video tài liệu / phóng sự thực tế phát được trực tiếp
   ────────────────────────────────────────────────────────── */

const HERITAGE_ARTICLES = [
  {
    id: 'lich-su-300-nam',
    title: 'Hơn 300 năm lửa đỏ gốm Biên Hòa bên dòng sông Đồng Nai',
    subtitle: 'Từ những lò gốm lu Cây Mai, cù lao Phố đến chiếc nôi gốm mỹ nghệ phương Nam',
    era: 'Thế kỷ XVII – Nay',
    tag: 'LỊCH SỬ LÀNG NGHỀ',
    readTime: '6 phút đọc',
    image: 'https://cdnmedia.baotintuc.vn/Upload/rGkvwNpj74Z1EcpzQ6ltA/files/2024/06/tuan1/gom-3624(1).jpg',
    excerpt: 'Dọc theo khúc sông Đồng Nai chảy qua phường Tân Vạn và Bửu Long, nghề gốm đã gắn chặt với sinh kế của biết bao thế hệ cư dân phương Nam...',
    content: [
      'Cuối thế kỷ XVII, khi những lưu dân người Việt và di thần phương Bắc tìm về vùng đất Cù Lao Phố (Biên Hòa) khai hoang lập nghiệp, họ đã phát hiện ra mỏ đất sét dẻo mịn tuyệt hảo nằm sâu dọc đôi bờ sông Đồng Nai.',
      'Sự kết hợp giữa nguồn đất sét xám Tân Vạn dẻo dai, nguồn củi rừng cao su dồi dào và tuyến giao thương đường thủy tấp nập đã biến Biên Hòa thành trung tâm sản xuất gốm quy mô nhất Nam Bộ.',
      'Từ các sản phẩm gia dụng mộc mạc ban đầu như lu, khạp, hũ đựng mắm muối, thợ gốm Biên Hòa dần nâng tầm thành những tác phẩm trang trí mỹ nghệ tinh xảo, trở thành một trong ba cái nôi gốm lớn nhất Việt Nam bên cạnh gốm Bát Tràng và gốm Chu Đậu.'
    ],
    source: 'Tư liệu Bảo tàng Đồng Nai & Hội đồng Lịch sử Thành phố Biên Hòa',
  },
  {
    id: 'vert-de-bien-hoa',
    title: 'Huy chương Vàng Paris 1925 và huyền thoại men xanh đồng Vert de Biên Hòa',
    subtitle: 'Sự giao thoa độc bản giữa nghệ thuật tạo hình phương Tây và hồn cốt gốm Nam Bộ',
    era: '1903 – 1925',
    tag: 'MEN GỐM ĐỘC BẢN',
    readTime: '5 phút đọc',
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
    excerpt: 'Năm 1903, Trường Mỹ nghệ Biên Hòa (nay là Trường CĐ Mỹ thuật Trang trí Đồng Nai) được thành lập. Vợ chồng ông bà Robert Balick đã cùng các nghệ nhân bản địa khai sinh dòng men lừng danh thế giới...',
    content: [
      'Men xanh đồng trổ (được giới mỹ thuật Pháp xưng tụng là "Vert de Biên Hòa") là phát minh vĩ đại kết hợp giữa oxit đồng đỏ, tro rơm nếp cấy trên đất phù sa, cùng bột quặng đá ong Bửu Long nghiền mịn.',
      'Khi đưa vào lò nung ở nhiệt độ 1.200°C - 1.220°C, men thủy tinh tan chảy, oxit đồng tương tác với khí CO trong lò rồng tạo ra lớp men xanh ngọc ánh đồng rực rỡ, lấp lánh như men ngọc cổ.',
      'Tại Triển lãm Quốc tế Nghệ thuật Trang trí và Công nghiệp Hiện đại Paris 1925, bộ sưu tập gốm men Vert de Biên Hòa cùng tác phẩm Đôn Voi chạm lộng đã làm rung động giới mộ điệu châu Âu, xuất sắc đoạt Huy chương Vàng danh giá.'
    ],
    source: 'Kỷ yếu 110 năm Trường Mỹ thuật Trang trí Đồng Nai (1903 - 2013)',
  },
  {
    id: 'champleve-ky-thuat',
    title: 'Kỹ thuật chạm khắc chìm champlevé và chấm men màu khảm thủy tinh',
    subtitle: 'Đường dao vạch chuẩn xác khi đất còn ẩm se tạo nên ranh giới bất biến cho men màu',
    era: 'Kỹ nghệ thủ công',
    tag: 'KỸ NGHỆ TẠO TÁC',
    readTime: '4 phút đọc',
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80',
    excerpt: 'Khác với gốm vẽ hoa lam dưới men của Bát Tràng hay gốm mộc nung tro, gốm Biên Hòa chinh phục người xem bằng thủ pháp champlevé đầy thử thách...',
    content: [
      'Sau khi chuốt phôi trên bàn xoay và để gốm ráo nước đến độ se da bò, nghệ nhân dùng đầu kim loại sắc mảnh để vạch khắc từng nét hoa văn chìm sâu khoảng 0.8 - 1.2mm.',
      'Rãnh khắc chìm này không chỉ tạo nên đường viền thẩm mỹ sắc sảo mà còn đóng vai trò như bức tường ngăn cách giữa các mảng men khác nhau, giữ cho men xanh đồng, men vàng hoàng yến và men đá đỏ không bị lem chảy vào nhau khi nung chảy ở nhiệt độ cao.',
      'Sau đó, người thợ dùng cọ lông chấm men màu thủ công từng khoang nhỏ, tạo nên hiệu ứng phối màu khảm men rực rỡ tựa như tranh ghép kính màu nhà thờ cổ kính.'
    ],
    source: 'Nghiên cứu Kỹ thuật Gốm mỹ nghệ Biên Hòa — PGS.TS Nguyễn Văn Hiệp',
  },
  {
    id: 'lo-rong-tan-van',
    title: 'Lò rồng Tân Vạn: Ngọn lửa 36 giờ giữ hồn đất phù sa Đồng Nai',
    subtitle: 'Kết cấu vòm lò uốn lượn như lưng rồng dài hơn 50 mét dọc triền đồi',
    era: 'Di sản Lò nung truyền thống',
    tag: 'LÒ RỒNG BÁCH NIÊN',
    readTime: '5 phút đọc',
    image: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=800&q=80',
    excerpt: 'Lò rồng (lò bầu dài) là một kỳ quan kỹ thuật dân gian của vùng Tân Vạn. Nằm thoai thoải theo triền đồi hướng ra sông, lò có thể chứa hàng nghìn sản phẩm gốm trong một mẻ nung...',
    content: [
      'Mỗi mẻ lò rồng nung ròng rã suốt 36 đến 48 giờ liên tục, tiêu tốn hàng chục tấn củi cao su già. Các nghệ nhân nung lò ("thợ coi lò") phải thức trắng đêm, chỉ nhìn màu ngọn lửa và sắc đỏ của phôi qua lỗ dòm lò để phán đoán nhiệt độ chính xác đến từng độ C.',
      'Tro củi cao su bay lơ lửng trong không gian lò bám tự nhiên vào thân gốm, tạo nên lớp men tro phong hóa mộc mạc và độc bản mà lò điện hay lò gas hiện đại không bao giờ sao chép được.',
      'Hiện nay, các lò rồng cổ tại phường Tân Vạn đang được tỉnh Đồng Nai và cộng đồng nghệ nhân bảo tồn nghiêm ngặt như di sản công nghiệp - văn hóa quý giá của đất phương Nam.'
    ],
    source: 'Sở Văn hóa, Thể thao và Du lịch tỉnh Đồng Nai',
  },
];

const ARTISANS = [
  {
    name: 'Nghệ nhân Nhân dân Hoàng Ngọc Trâm',
    title: 'Bậc thầy chạm khắc champlevé & Men Vert de Biên Hòa',
    experience: 'Hơn 50 năm gắn bó với đất và men màu',
    quote: 'Gốm Biên Hòa quý ở chỗ người thợ phải khắc dao thật dứt khoát. Dao ngập ngừng thì đường men nung ra sẽ đục, mất đi cái thần phóng khoáng của sông Đồng Nai.',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    contribution: 'Phục dựng thành công công thức men xanh đồng cổ điển và đào tạo hơn 200 thế hệ thợ vuốt gốm trẻ tại Biên Hòa.',
  },
  {
    name: 'Cụ Nghệ nhân Hai Dẫn (Lò gốm Tân Vạn)',
    title: 'Truyền nhân đời thứ 4 giữ lửa lò rồng cổ',
    experience: '60 năm kinh nghiệm điều khiển ngọn lửa lò rồng',
    quote: 'Lò rồng nung bằng củi cao su có cái hồn riêng. Con lửa uốn lượn qua từng bầu lò như hơi thở của rồng, biến đất bùn tầm thường thành ngọc quý.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    contribution: 'Bảo tồn nguyên vẹn cấu trúc lò rồng 36 bầu nung dài 60m bên bờ sông Tân Vạn, đón hàng chục nghìn lượt khách trong và ngoài nước.',
  },
];

const HERITAGE_VIDEOS = [
  {
    id: 'vid-1',
    title: 'Gốm Biên Hòa: Nơi lửa và đất kể chuyện trăm năm | VTV',
    author: 'VTV - Những Mảnh Ghép Cuộc Sống',
    duration: '14:20',
    thumbnail: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
    embedUrl: 'https://www.youtube.com/embed/Za8fEmuB3Q4',
    desc: 'Phóng sự đặc sắc của VTV về lịch sử hình thành, sự hưng thịnh và sắc men xanh đồng huyền thoại của làng gốm trăm năm bên sông Đồng Nai.',
  },
  {
    id: 'vid-2',
    title: 'Màu men đặc biệt của gốm Biên Hòa Đồng Nai | Phóng sự tư liệu',
    author: 'Đài Phát thanh - Truyền hình Đồng Nai',
    duration: '11:15',
    thumbnail: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=800&q=80',
    embedUrl: 'https://www.youtube.com/embed/8CnHb6BERSg',
    desc: 'Cận cảnh thao tác vuốt phôi đất sét Tân Vạn, kỹ thuật khắc chìm champlevé và giải mã công thức pha chế sắc men ngọc độc bản.',
  },
  {
    id: 'vid-3',
    title: 'Lan tỏa nét đẹp di sản dòng gốm Biên Hòa – Đồng Nai',
    author: 'CLB Di vật & Cổ vật Biên Hòa',
    duration: '09:45',
    thumbnail: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=800&q=80',
    embedUrl: 'https://www.youtube.com/embed/Uk-HDpAT71E',
    desc: 'Chiêm ngưỡng những cổ vật gốm Biên Hòa thế kỷ XIX - XX đoạt giải thưởng quốc tế và câu chuyện bảo tồn của các nhà sưu tập, nghệ nhân lão thành.',
  },
];

export default function HeritageScreen() {
  const containerRef = useRef(null);
  useScrollReveal(containerRef);

  const { setActiveTab } = useNavigation();
  const { setModelType, setGlazeColor, setGlazeName } = useDesign();

  const [activeArticleId, setActiveArticleId] = useState(HERITAGE_ARTICLES[0].id);
  const [activeVideo, setActiveVideo] = useState(HERITAGE_VIDEOS[0]);

  const activeArticle = HERITAGE_ARTICLES.find((a) => a.id === activeArticleId) || HERITAGE_ARTICLES[0];

  const handleApplyHeritageGlaze = () => {
    if (setModelType) setModelType('vase');
    if (setGlazeColor) setGlazeColor('#2A6B5C');
    if (setGlazeName) setGlazeName('Men Xanh Đồng Trổ (Vert de Biên Hòa)');
    setActiveTab('studio-3d');
  };

  return (
    <div ref={containerRef} className="w-full bg-ceramic-paper text-ceramic-charcoal font-body selection:bg-ceramic-terracotta selection:text-ceramic-paper pb-24">
      {/* ── HEADER HERO ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-12 border-b border-ceramic-border">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ceramic-cream border border-ceramic-border text-xs font-mono text-ceramic-terracotta">
            <span className="w-2 h-2 rounded-full bg-ceramic-terracotta animate-pulse" />
            <span>DI SẢN VĂN HÓA GỐM NAM BỘ</span>
          </div>

          <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ceramic-charcoal leading-tight">
            Gốm Biên Hòa: Hồn đất, lửa thiêng và sắc men huyền thoại
          </h1>

          <p className="text-ceramic-slate text-base sm:text-lg leading-relaxed">
            Hành trình hơn 3 thế kỷ gìn giữ tinh hoa nghệ thuật gốm Đồng Nai — từ bãi sét phù sa Tân Vạn đến giải Vàng Paris 1925 và công nghệ phục dựng 3D đương đại.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleApplyHeritageGlaze}
              className="px-5 py-2.5 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-xs font-mono uppercase tracking-wider font-semibold transition-all shadow-paper cursor-pointer"
            >
              Thử sắc men Vert de Biên Hòa trong 3D →
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className="px-5 py-2.5 rounded-xl bg-ceramic-paper hover:bg-ceramic-cream text-ceramic-charcoal border border-ceramic-border text-xs font-mono uppercase tracking-wider font-semibold transition-all shadow-paper cursor-pointer"
            >
              Xem các mẫu gốm di sản
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 1: VIDEO TÀI LIỆU PHÓNG SỰ THỰC TẾ ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 border-b border-ceramic-border">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-mono text-ceramic-terracotta font-semibold uppercase tracking-wider mb-1">
              Phóng sự & Tư liệu nghệ nhân
            </div>
            <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal">
              Thước phim tư liệu làng gốm bên sông Đồng Nai
            </h2>
          </div>
          <div className="text-xs text-ceramic-slate font-mono">
            Phát trực tiếp chuẩn HD • Nguồn tư liệu truyền hình & bảo tàng
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cột chính phát video */}
          <div className="lg:col-span-8 bg-ceramic-paper border border-ceramic-border rounded-2xl overflow-hidden shadow-card">
            <div className="relative aspect-video w-full bg-ceramic-charcoal">
              <iframe
                title={activeVideo.title}
                src={activeVideo.embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-ceramic-slate">
                <span className="text-ceramic-terracotta font-semibold">{activeVideo.author}</span>
                <span>Thời lượng: {activeVideo.duration}</span>
              </div>
              <h3 className="font-editorial text-xl sm:text-2xl font-bold text-ceramic-charcoal">
                {activeVideo.title}
              </h3>
              <p className="text-sm text-ceramic-slate leading-relaxed">
                {activeVideo.desc}
              </p>
            </div>
          </div>

          {/* Danh sách video chọn xem */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-ceramic-slate mb-2">
              Chọn phóng sự cần xem ({HERITAGE_VIDEOS.length}):
            </div>
            {HERITAGE_VIDEOS.map((v) => {
              const isSelected = activeVideo.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveVideo(v)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                    isSelected
                      ? 'bg-ceramic-paper border-ceramic-terracotta ring-1 ring-ceramic-terracotta/40 shadow-paper'
                      : 'bg-ceramic-paper/70 border-ceramic-border hover:border-ceramic-terracotta/60 hover:bg-ceramic-cream/50'
                  }`}
                >
                  <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-ceramic-cream flex-shrink-0">
                    <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-ceramic-charcoal/20 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full bg-ceramic-terracotta text-ceramic-paper flex items-center justify-center text-[10px] pl-0.5 shadow-sm">
                        ▶
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-ceramic-charcoal line-clamp-2 leading-snug">
                      {v.title}
                    </div>
                    <div className="text-[10px] text-ceramic-slate font-mono mt-1 flex items-center justify-between">
                      <span className="truncate">{v.author.split('(')[0]}</span>
                      <span>{v.duration}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="p-4 rounded-xl bg-ceramic-cream/60 border border-ceramic-border text-xs text-ceramic-slate space-y-1.5 mt-4">
              <div className="font-bold text-ceramic-charcoal flex items-center gap-1.5">
                <span>🏛</span>
                <span>Trung tâm Di sản Văn hóa</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Các phóng sự được thu thập từ nguồn tư liệu chính thống của Đài Phát thanh Truyền hình Đồng Nai và Bảo tàng Lịch sử Nam Bộ, nhằm quảng bá và số hóa văn hóa làng nghề truyền thống.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: CÂU CHUYỆN LỊCH SỬ & KỸ THUẬT NGHỀ GỐM ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 border-b border-ceramic-border">
        <div className="mb-8">
          <div className="text-xs font-mono text-ceramic-terracotta font-semibold uppercase tracking-wider mb-1">
            Tư liệu nghiên cứu lịch sử
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal">
            Biên niên sử & Nghệ thuật tạo tác gốm Biên Hòa
          </h2>
        </div>

        {/* Tabs chọn bài viết */}
        <div className="flex flex-wrap gap-2 pb-6 border-b border-ceramic-border/60">
          {HERITAGE_ARTICLES.map((article) => {
            const isActive = activeArticle.id === article.id;
            return (
              <button
                key={article.id}
                type="button"
                onClick={() => setActiveArticleId(article.id)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-ceramic-terracotta text-ceramic-paper shadow-paper'
                    : 'bg-ceramic-paper text-ceramic-slate border border-ceramic-border hover:border-ceramic-charcoal'
                }`}
              >
                <span>{article.tag}</span>
              </button>
            );
          })}
        </div>

        {/* Nội dung bài viết chi tiết */}
        <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-xs font-mono text-ceramic-slate">
                <span className="text-ceramic-terracotta font-semibold">{activeArticle.era}</span>
                <span>•</span>
                <span>{activeArticle.readTime}</span>
              </div>
              <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-ceramic-charcoal leading-tight">
                {activeArticle.title}
              </h3>
              <p className="font-editorial text-lg italic text-ceramic-terracotta">
                {activeArticle.subtitle}
              </p>
            </div>

            <div className="space-y-4 text-ceramic-slate text-sm sm:text-base leading-relaxed">
              {activeArticle.content.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            <div className="pt-4 border-t border-ceramic-border/60 text-xs font-mono text-ceramic-slate flex items-center justify-between">
              <span>Nguồn xác thực:</span>
              <strong className="text-ceramic-charcoal">{activeArticle.source}</strong>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-ceramic-paper border border-ceramic-border rounded-2xl overflow-hidden shadow-paper">
              <div className="relative aspect-[4/3] bg-ceramic-cream overflow-hidden">
                <img
                  src={activeArticle.image}
                  alt={activeArticle.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 bg-ceramic-cream/50 border-t border-ceramic-border text-xs text-ceramic-slate italic">
                {activeArticle.excerpt}
              </div>
            </div>

            {/* Quick action: đưa vào 3D Studio */}
            <div className="p-5 rounded-2xl bg-ceramic-paper border border-ceramic-border space-y-3 shadow-paper">
              <div className="text-xs font-mono uppercase tracking-wider text-ceramic-terracotta font-semibold">
                Khám phá trực tiếp trong xưởng
              </div>
              <div className="text-sm font-editorial font-bold text-ceramic-charcoal">
                Dùng thử men Vert de Biên Hòa trên mô hình xoay 360°
              </div>
              <p className="text-xs text-ceramic-slate leading-relaxed">
                Tái hiện chân thực độ phản xạ bóng mờ (roughness 0.16) và ánh đồng đặc trưng nung lò rồng 1220°C.
              </p>
              <button
                type="button"
                onClick={handleApplyHeritageGlaze}
                className="w-full py-2.5 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-xs font-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer"
              >
                Mở Xưởng Gốm 3D ngay →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: NGHỆ NHÂN LÀNG GỐM BIÊN HÒA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
        <div className="mb-8">
          <div className="text-xs font-mono text-ceramic-terracotta font-semibold uppercase tracking-wider mb-1">
            Bàn tay vàng & Hồn cốt làng nghề
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal">
            Nghệ nhân tiêu biểu giữ lửa ngàn năm
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {ARTISANS.map((artisan, index) => (
            <div
              key={index}
              className="bg-ceramic-paper border border-ceramic-border rounded-2xl p-6 sm:p-8 space-y-5 shadow-paper flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img
                    src={artisan.image}
                    alt={artisan.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-ceramic-terracotta/40 shadow-sm"
                  />
                  <div>
                    <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal">
                      {artisan.name}
                    </h3>
                    <div className="text-xs text-ceramic-terracotta font-medium mt-0.5">
                      {artisan.title}
                    </div>
                    <div className="text-[11px] text-ceramic-slate font-mono">
                      {artisan.experience}
                    </div>
                  </div>
                </div>

                <blockquote className="p-4 rounded-xl bg-ceramic-cream/50 border-l-2 border-ceramic-terracotta text-sm text-ceramic-charcoal italic font-editorial leading-relaxed">
                  "{artisan.quote}"
                </blockquote>

                <p className="text-xs text-ceramic-slate leading-relaxed">
                  <strong className="text-ceramic-charcoal">Cống hiến:</strong> {artisan.contribution}
                </p>
              </div>

              <div className="pt-4 border-t border-ceramic-border/60 flex items-center justify-between text-xs">
                <span className="font-mono text-ceramic-slate">Làng gốm Tân Vạn, Biên Hòa</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="font-mono font-medium text-ceramic-terracotta hover:underline cursor-pointer"
                >
                  Đặt lịch gặp gỡ tại xưởng →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
