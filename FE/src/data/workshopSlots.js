/**
 * Workshop Slots - Các ca giờ workshop tại làng gốm Biên Hòa (Tân Vạn, Đồng Nai)
 *
 * Đồng bộ với BE workshopSlots.
 * Mỗi ca 2.5 tiếng, bao gồm: đất sét xám Tân Vạn, bàn xoay, nghệ nhân hướng dẫn
 * kỹ thuật khắc chìm (champlevé), chấm men Vert de Biên Hòa và nung lò rồng.
 */

export const WORKSHOP_SLOTS = [
  '08:30 - 11:00 (Sáng - Ca 1)',
  '14:00 - 16:30 (Chiều - Ca 2)',
  '16:45 - 19:15 (Hoàng hôn bờ sông Đồng Nai - Ca 3)',
];

/**
 * Workshop venue details.
 */
export const WORKSHOP_VENUE = {
  name: 'Không Gian Sáng Tạo Gốm Biên Hòa (Atelier Gốm Tân Vạn)',
  address: 'Khu phố 1, Đường Bùi Hữu Nghĩa, Phường Tân Vạn, TP. Biên Hòa, Tỉnh Đồng Nai',
  included: [
    '1 Phôi gốm theo mẫu thiết kế 3D từ đất sét xám Tân Vạn trầm tích',
    'Bàn xoay cơ học & bộ dao trổ khắc chìm (champlevé) thủ công',
    'Bảng men màu Vert de Biên Hòa, men đá đỏ và men tro rơm pha sẵn',
    'Nghệ nhân ưu tú Biên Hòa kèm 1-on-1 hướng dẫn kỹ thuật khắc lộng và chấm men',
    'Bao gồm chi phí sấy, nung lò rồng củi 1220°C và đóng gói hộp quà giao tận nhà',
  ],
};

export const WORKSHOP_PRICE_PER_PERSON = 250000;
