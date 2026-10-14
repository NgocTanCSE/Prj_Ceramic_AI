/**
 * Pattern / Decal Catalog - Họa Tiết & Chạm Lộng Gốm Biên Hòa
 *
 * Kỹ thuật chạm lộng, khắc chìm (champlevé) trứ danh của Làng gốm Biên Hòa.
 * Đường nét được khắc sâu vào xương gốm se khô trước khi tráng và chấm men màu.
 */

export const PATTERNS = [
  {
    id: 'sen_co',
    label: 'Hoa Sen Khắc Chìm',
    badge: 'Biên Hòa 1903',
    description: 'Hoa sen trổ nét chìm thanh nhã theo trường phái mỹ nghệ Biên Hòa, tượng trưng cho sự thuần khiết vươn lên.',
    icon: 'lotus',
    origin: 'Trường Mỹ nghệ Biên Hòa',
  },
  {
    id: 'dong_son',
    label: 'Hoa Cúc Dây Chạm Lộng',
    badge: 'Kinh điển đôn voi',
    description: 'Họa tiết hoa cúc dây lá lật kinh điển trên các tác phẩm đôn voi và bình hoa Biên Hòa xuất khẩu Paris 1925.',
    icon: 'sunburst',
    origin: 'Biên Hòa Heritage',
  },
  {
    id: 'ca_chep',
    label: 'Song Ngư Sông Đồng Nai',
    badge: 'Sông nước Nam Bộ',
    description: 'Đôi cá vờn sóng nước miêu tả vẻ trù phú, phóng khoáng của lưu vực hạ lưu sông Đồng Nai.',
    icon: 'koi',
    origin: 'Cù Lao Phố',
  },
  {
    id: 'cham_bi',
    label: 'Chấm Men Khảm Màu',
    badge: 'Kỹ nghệ Cloisonné',
    description: 'Chấm men màu đa sắc tinh tế vào từng ô hoa văn, kỹ nghệ phối men màu độc nhất của gốm Biên Hòa.',
    icon: 'dots',
    origin: 'Tân Vạn Art',
  },
  {
    id: 'hoa_dao',
    label: 'Cành Hoa Đào Cổ',
    badge: 'Men Khảm Đào Hồng',
    description: 'Họa tiết cành hoa đào phai thanh thoát vẽ tay mềm mại trên thân gốm mộc mạc.',
    icon: 'flower',
    origin: 'Biên Hòa & Bát Tràng',
  },
  {
    id: 'none',
    label: 'Men Trơn Mộc Tân Vạn',
    badge: 'Mộc',
    description: 'Bề mặt men bóng suôn sẻ, thuần khiết - để vẻ đẹp tự nhiên của đất sét trầm tích và ngọn lửa lò rồng tự kể chuyện.',
    icon: 'plain',
    origin: 'Gốc gác',
  },
];

/**
 * Get pattern by ID.
 */
export const getPattern = (id) => PATTERNS.find((p) => p.id === id);
