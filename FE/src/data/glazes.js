/**
 * Glaze Catalog - Kho Tàng Men Mỹ Nghệ Gốm Việt (Biên Hòa - Bát Tràng - Cây Mai - Chu Đậu)
 *
 * Hệ thống 20 sắc men kinh điển trứ danh hơn 300 năm lịch sử:
 * - Dòng men Vert de Biên Hòa (HCV Paris 1925), Men Đá Đỏ Bazan Bửu Long, Men Hoàng Yến
 * - Men Lam Cổ Chu Đậu, Men Ngọc Celadon, Men Rạn Cốt Ngà Bát Tràng, Men Hỏa Biến Đại Dương
 * - Men Cây Mai Sài Gòn, Men Hắc Diệu Thiên Mục, Men Nâu Da Lươn Nam Bộ...
 */

export const GLAZE_LIST = [
  {
    id: 'men-xanh-dong',
    name: 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
    color: '#2A6B5C',
    roughness: 0.15,
    origin: 'Biên Hòa 1903',
  },
  {
    id: 'men-lam-co',
    name: 'Men Lam Cổ Chu Đậu',
    color: '#1E3A5F',
    roughness: 0.14,
    origin: 'Chu Đậu Thế Kỷ XV',
  },
  {
    id: 'men-ngoc-celadon',
    name: 'Men Ngọc Celadon (Long Tuyền)',
    color: '#7BA086',
    roughness: 0.12,
    origin: 'Gốm Cổ Á Đông',
  },
  {
    id: 'men-da-do',
    name: 'Men Đá Đỏ Bazan Bửu Long',
    color: '#9E472A',
    roughness: 0.32,
    origin: 'Tân Vạn Nam Bộ',
  },
  {
    id: 'men-vang-hoang-yen',
    name: 'Men Vàng Hoàng Yến Khảm Màu',
    color: '#C88A2E',
    roughness: 0.18,
    origin: 'Pháp Lam Biên Hòa',
  },
  {
    id: 'men-xanh-ve-chai',
    name: 'Men Xanh Lục Dưa Cải (Cây Mai)',
    color: '#3D6E50',
    roughness: 0.16,
    origin: 'Gốm Cây Mai Chợ Lớn',
  },
  {
    id: 'men-tro-trang-nga',
    name: 'Men Tro Trấu Trắng Ngà',
    color: '#EDE8DC',
    roughness: 0.16,
    origin: 'Lò Gốm Cổ Tân Vạn',
  },
  {
    id: 'men-ran-co',
    name: 'Men Rạn Cổ Cốt Ngà Bát Tràng',
    color: '#D9D1C1',
    roughness: 0.22,
    origin: 'Bát Tràng Thế Kỷ XVI',
  },
  {
    id: 'men-hoa-bien-ocean',
    name: 'Men Hỏa Biến Sắc Lam Đại Dương',
    color: '#154360',
    roughness: 0.10,
    origin: 'Lò Rồng Củi 1250°C',
  },
  {
    id: 'men-hac-dieu',
    name: 'Men Hắc Diệu Thiên Mục (Tenmoku)',
    color: '#1F1E24',
    roughness: 0.12,
    origin: 'Thiền Trà Á Đông',
  },
  {
    id: 'men-chu-do',
    name: 'Men Chu Sa Đỏ Huyết Dụ',
    color: '#8B263E',
    roughness: 0.18,
    origin: 'Cung Đình Xưa',
  },
  {
    id: 'men-nau-da-luon',
    name: 'Men Nâu Da Lươn Oxit Sắt',
    color: '#A45E26',
    roughness: 0.20,
    origin: 'Bát Tràng & Nam Bộ',
  },
  {
    id: 'men-cay-mai-luc',
    name: 'Men Lục Ngọc Gốm Cây Mai Sài Gòn',
    color: '#2E6F40',
    roughness: 0.15,
    origin: 'Gốm Sài Gòn Xưa',
  },
  {
    id: 'men-bup-sen',
    name: 'Men Búp Sen Hồng Phấn',
    color: '#D88A8A',
    roughness: 0.18,
    origin: 'Thanh Nhã Mỹ Nghệ',
  },
  {
    id: 'men-ho-phach',
    name: 'Men Vàng Hổ Phách Ánh Mật',
    color: '#D49B37',
    roughness: 0.16,
    origin: 'Trường Mỹ Nghệ 1903',
  },
  {
    id: 'men-sa-thach',
    name: 'Men Sa Thạch Mộc Mạc Đá Ong',
    color: '#8D7B68',
    roughness: 0.38,
    origin: 'Tân Vạn Đồng Nai',
  },
  {
    id: 'men-co-vit',
    name: 'Men Xanh Cổ Vịt Cù Lao Phố',
    color: '#1B4D54',
    roughness: 0.14,
    origin: 'Cù Lao Phố Xưa',
  },
  {
    id: 'men-bach-dinh',
    name: 'Men Bạch Định Trắng Tuyết Mộc',
    color: '#F7F6F2',
    roughness: 0.14,
    origin: 'Bát Tràng Mỹ Nghệ',
  },
  {
    id: 'men-gam-tia',
    name: 'Men Gấm Tía Tử Sa Khoáng Thạch',
    color: '#5E3A4D',
    roughness: 0.28,
    origin: 'Đất Khoáng Núi',
  },
  {
    id: 'men-tro-tram',
    name: 'Men Tro Tràm Trầm Tích Sông',
    color: '#4A5568',
    roughness: 0.24,
    origin: 'Lưu Vực Đồng Nai',
  },
];

export const getGlaze = (id) => GLAZE_LIST.find((g) => g.id === id);
export const DEFAULT_GLAZE = GLAZE_LIST[0];
