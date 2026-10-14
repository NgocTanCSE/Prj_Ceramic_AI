/**
 * Gallery Products - Thư Viện Phôi Gốm & Tác Phẩm Làng Gốm Biên Hòa
 *
 * Dữ liệu kết nối trực tiếp từ file ecommerce_pottery_products.json
 * (28 sản phẩm thực tế phân loại chuẩn xác 100%:
 *  - 4 nhóm phôi bàn xoay: Bình hoa, Ly cốc, Bát chén, Đĩa mỹ nghệ
 *  - 1 nhóm phôi điêu khắc: Tượng mỹ nghệ đắp tay nghệ nhân)
 */

import ecommerceData from './ecommerce_pottery_products.json';

// Danh mục nhãn hiển thị cho loại hình gốm
export const CATEGORY_LABELS = {
  vase: 'Bình hoa dáng khí',
  mug: 'Ly & Cốc vuốt tay',
  bowl: 'Bát trà & Bát cơm',
  plate: 'Đĩa mỹ nghệ',
};

// Chuyển đổi các sản phẩm thực tế thành danh sách phôi mộc hoàn chỉnh
export const PRODUCTS = (ecommerceData.products || []).map((item) => {
  const baseType = item.category || item.aiDeconstructed?.base3DType || 'vase';

  return {
    id: item.id,
    name: item.name,
    slug: item.id,
    category: baseType,
    type: baseType,
    price: item.price,
    formattedPrice: item.formattedPrice,
    dimensions: item.aiDeconstructed?.dimensions || '12cm × 20cm',
    volume: item.aiDeconstructed?.volume || '—',
    clayType: item.aiDeconstructed?.recommendedClay || 'Đất sét Tân Vạn pha cát thạch anh',
    firingTemp: item.aiDeconstructed?.firingTemp || '1200°C',
    wallThickness: item.aiDeconstructed?.wallThickness || '5.5 - 6.5mm',
    shrinkageRate: item.aiDeconstructed?.shrinkageRate || '10% (Ủ lò rồng)',
    craftDifficulty: item.aiDeconstructed?.craftDifficulty || 'Bàn xoay thủ công',
    estimatedCraftTime: item.aiDeconstructed?.estimatedCraftTime || '60 - 90 phút',
    image: item.image,
    thumbnail: item.thumbnail,
    difficulty: item.aiDeconstructed?.craftDifficulty || 'Dễ tạo hình',
    tag: item.tag || 'Gốm mỹ nghệ',
    description:
      item.vietnameseArtisanStory ||
      `Tiêu bản đối chiếu thực tế. AI đã giải mã tỷ lệ hình khối ${item.aiDeconstructed?.dimensions || ''}, độ co ngót ${item.aiDeconstructed?.shrinkageRate || ''}.`,
    recommendedGlazes: item.recommendedGlazes || [],
    craftOptions: item.craftOptions || null,
    aiDeconstructed: item.aiDeconstructed || null,
    rating: item.rating || 5,
    reviewCount: item.reviewCount || 10,
    isRealEcommerce: true,
  };
});

// Danh mục tác phẩm tuyển (đã dọn sạch mock cũ Unsplash)
export const SIGNATURE_PRODUCTS = [];

export const MODEL_LABELS = {
  mug: 'Ly Cốc Vuốt Tay',
  vase: 'Bình Dáng Khí',
  bowl: 'Bát Trà & Bát Cơm',
  plate: 'Đĩa Mỹ Nghệ Chạm Lộng',
};
