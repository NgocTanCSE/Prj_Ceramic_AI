import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Suppress fingerprinting
app.disable('x-powered-by');

// Restrictive CORS: reflect FE_ORIGIN (+ localhost dev ports) only; deny all others.
const BE_ALLOWED_ORIGINS = new Set();
if (process.env.FE_ORIGIN) BE_ALLOWED_ORIGINS.add(process.env.FE_ORIGIN);
for (const o of ['http://localhost:3000','http://127.0.0.1:3000','http://localhost:3002','http://127.0.0.1:3002','http://localhost:5173','http://127.0.0.1:5173','http://localhost:8080']) BE_ALLOWED_ORIGINS.add(o);
const beCorsOrigin = (origin, cb) => cb(null, (origin && BE_ALLOWED_ORIGINS.has(origin)) ? origin : false);
app.use(cors({
  origin: beCorsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.options('*', cors({ origin: beCorsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Initial Seed Data for Ceramic Blanks & Signature Products
const initialProducts = [
  {
    id: 'blank-mug-01',
    name: 'Cốc Gốm Khắc Chìm Tân Vạn',
    category: 'blank',
    type: 'mug',
    basePrice: 180000,
    dimensions: '8.5cm x 10.5cm',
    volume: '380ml',
    description: 'Phôi cốc đất dẻo trầm tích sông Đồng Nai, bề mặt mịn hoàn hảo cho nghệ thuật khắc chìm (champlevé) và chấm men màu xanh đồng.',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất sét xám Tân Vạn pha cao lanh Chơn Thành',
    firingTemp: '1200°C'
  },
  {
    id: 'blank-vase-01',
    name: 'Bình Hoa Dáng Khí Khắc Chìm Biên Hòa',
    category: 'blank',
    type: 'vase',
    basePrice: 320000,
    dimensions: '12cm x 22cm',
    volume: '1200ml',
    description: 'Dáng bình mỹ nghệ trường phái Bá Nghệ Biên Hòa 1903, thân bình khoáng đạt để khắc hoa cúc dây chạm lộng, phối men Vert de Biên Hòa trứ danh.',
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất sét phù sa sông Đồng Nai & cát thạch anh',
    firingTemp: '1220°C'
  },
  {
    id: 'blank-bowl-01',
    name: 'Bát Trà Thiền Men Đá Đỏ Bửu Long',
    category: 'blank',
    type: 'bowl',
    basePrice: 210000,
    dimensions: '13cm x 7.5cm',
    volume: '450ml',
    description: 'Dáng bát đầm tay, nung lò rồng giữ trọn độ mộc, tôn vinh sắc men đá đỏ bazan và men tro rơm tự nhiên phương Nam.',
    image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất sét pha quặng đá ong Bửu Long',
    firingTemp: '1200°C'
  },
  {
    id: 'blank-plate-01',
    name: 'Đĩa Mỹ Nghệ Chạm Lộng Cù Lao Phố',
    category: 'blank',
    type: 'plate',
    basePrice: 260000,
    dimensions: 'Đường kính 21cm',
    volume: '-',
    description: 'Mặt đĩa viền chạm lộng hoa văn rồng mây và cúc dây, thích hợp phối men nhiều màu theo kỹ thuật khảm men thủy tinh truyền thống Biên Hòa.',
    image: 'https://images.unsplash.com/photo-1603199506016-b9a594b593c0?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất sét xám Tân Vạn tuyển lọc',
    firingTemp: '1200°C'
  },
  {
    id: 'artisan-don-voi',
    name: 'Đôn Voi Gốm Men Xanh Đồng (Vert de Biên Hòa)',
    category: 'signature',
    type: 'vase',
    basePrice: 1850000,
    dimensions: '38cm x 45cm',
    volume: 'Tác phẩm điêu khắc',
    description: 'Kiệt tác biểu tượng của gốm Biên Hòa từng đạt Huy chương Vàng Paris 1925. Tạo hình voi dũng mãnh, chạm khắc hoa lá lộng men xanh đồng Vert de Biên Hòa độc bản.',
    image: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất sét xám Tân Vạn & cao lanh Chơn Thành',
    firingTemp: '1220°C'
  },
  {
    id: 'artisan-vase-cuc-day',
    name: 'Bình Hoa Khắc Chìm Cúc Dây Lộng Men Màu',
    category: 'signature',
    type: 'vase',
    basePrice: 920000,
    dimensions: '15cm x 26cm',
    volume: '1600ml',
    description: 'Tác phẩm nguyên bản từ truyền nhân Trường Mỹ nghệ Biên Hòa, kỹ thuật khắc chìm phối men xanh đồng, men vàng hoàng yến và men đá đỏ.',
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất trầm tích lưu vực sông Đồng Nai',
    firingTemp: '1220°C'
  },
  {
    id: 'artisan-choe-rong',
    name: 'Chóe Rồng Ẩn Mây Men Đá Đỏ Đông Nam Bộ',
    category: 'signature',
    type: 'bowl',
    basePrice: 1250000,
    dimensions: '22cm x 32cm',
    volume: '4500ml',
    description: 'Chóe gốm cổ phong chạm nổi hình tượng rồng mây phương Nam, phủ lớp men đá đỏ bazan óng ánh ánh lửa lò rồng.',
    image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=600&q=80',
    clayType: 'Đất sét Tân Vạn nung củi truyền thống',
    firingTemp: '1200°C'
  }
];

// In-Memory Data Storage for MVP
const db = {
  products: [...initialProducts],
  designs: [
    {
      id: 'DES-DEMO-01',
      modelType: 'mug',
      glazeName: 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
      glazeColor: '#2A6B5C',
      glazeRoughness: 0.15,
      pattern: 'dong_son',
      customText: 'Biên Hòa 1903',
      createdAt: new Date().toISOString()
    }
  ],
  orders: [],
  workshops: [
    {
      id: 'WS-001',
      customerName: 'Nguyễn Văn Nam',
      customerPhone: '0912345678',
      date: '2026-10-15',
      timeSlot: '14:00 - 16:30',
      attendees: 2,
      designId: 'DES-DEMO-01',
      status: 'confirmed',
      notes: 'Đã chuẩn bị trước màu men xanh đồng Vert de Biên Hòa và phôi cốc khắc chìm Tân Vạn'
    }
  ]
};

// Available workshop time slots
// Configurable via WORKSHOP_SLOTS env var (JSON array) with fallback to defaults
let workshopSlots = [
  '09:00 - 11:30 (Sáng - Ca 1)',
  '14:00 - 16:30 (Chiều - Ca 2)',
  '17:00 - 19:30 (Hoàng hôn - Ca 3)'
];
try {
  const envSlots = JSON.parse(process.env.WORKSHOP_SLOTS || '');
  if (Array.isArray(envSlots) && envSlots.length > 0) {
    workshopSlots = envSlots;
  }
} catch {
  // Fall back to hardcoded defaults if env var is missing or invalid JSON
}

// Lightweight input validation helpers (MVP — no extra deps)
const sanitizeStr = (val, max = 500) => {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, max);
};

const validatePhone = (val) => {
  if (typeof val !== 'string') return false;
  const digits = val.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 11;
};

const validateDate = (val) => {
  if (typeof val !== 'string') return false;
  return !isNaN(Date.parse(val));
};

// --- ROUTES ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ceramic-backend-core',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Products & Base Blanks
app.get('/api/products', (req, res) => {
  const { category, type } = req.query;
  let results = db.products;

  if (category) {
    results = results.filter(p => p.category === category);
  }
  if (type) {
    results = results.filter(p => p.type === type);
  }

  res.json({
    success: true,
    total: results.length,
    data: results
  });
});

app.get('/api/products/:id', (req, res) => {
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
  }
  res.json({ success: true, data: product });
});

// 3D Designs Management
app.post('/api/designs', (req, res) => {
  try {
    const { modelType, glazeName, glazeColor, glazeRoughness, pattern, customText, previewImage } = req.body;
    const newDesign = {
      id: `DES-${Date.now().toString().slice(-6)}`,
      modelType: modelType || 'mug',
      glazeName: glazeName || 'Men Lam Cổ',
      glazeColor: glazeColor || '#1E3A5F',
      glazeRoughness: glazeRoughness ?? 0.2,
      pattern: pattern || 'none',
      customText: customText || '',
      previewImage: previewImage || null,
      createdAt: new Date().toISOString()
    };

    db.designs.push(newDesign);
    res.status(201).json({
      success: true,
      message: 'Lưu bản thiết kế 3D thành công',
      data: newDesign
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lưu thiết kế', error: error.message });
  }
});

app.get('/api/designs/:id', (req, res) => {
  const design = db.designs.find(d => d.id === req.params.id);
  if (!design) {
    return res.status(404).json({ success: false, message: 'Bản thiết kế không tồn tại' });
  }
  res.json({ success: true, data: design });
});

// Orders (Artisan Production & Delivery - Option 1)
app.post('/api/orders', (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      items,
      designData,
      paymentMethod,
      totalAmount,
      customerNotes
    } = req.body;

    // Input validation & sanitization
    if (!sanitizeStr(customerName, 100) || !validatePhone(customerPhone) || !sanitizeStr(customerAddress, 500)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đủ Tên, Số điện thoại và Địa chỉ nhận hàng'
      });
    }

    if (totalAmount !== undefined && (typeof totalAmount !== 'number' || totalAmount < 0 || totalAmount > 100000000)) {
      return res.status(400).json({ success: false, message: 'Số tiền thanh toán không hợp lệ' });
    }

    if (items !== undefined && !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu giỏ hàng không hợp lệ' });
    }

    const orderId = `GV-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder = {
      orderId,
      customerName: sanitizeStr(customerName, 100),
      customerPhone: sanitizeStr(customerPhone, 20),
      customerAddress: sanitizeStr(customerAddress, 500),
      items: Array.isArray(items) ? items : [],
      designData: designData || null,
      paymentMethod: paymentMethod || 'momo',
      paymentStatus: 'pending',
      fulfillmentType: 'artisan_craft_delivery',
      estimatedDays: '7 - 10 ngày làm việc (nung 2 lửa thủ công)',
      totalAmount: totalAmount || 280000,
      customerNotes: sanitizeStr(customerNotes, 1000),
      disclaimerAcknowledged: true,
      ceramicNotice: 'Sản phẩm thủ công nung lò rồng 1220°C. Độ biến thiên của men xanh đồng Vert de Biên Hòa và độ co ngót đất sét Tân Vạn (khoảng 8-11%) tạo nên nét độc bản riêng biệt của từng tác phẩm.',
      createdAt: new Date().toISOString()
    };

    db.orders.push(newOrder);

    res.status(201).json({
      success: true,
      message: 'Đặt đơn hàng sản xuất thủ công thành công!',
      order: newOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xử lý đơn hàng', error: error.message });
  }
});

app.get('/api/orders', (req, res) => {
  res.json({
    success: true,
    total: db.orders.length,
    data: db.orders
  });
});

// Workshops Booking (Option 2)
app.get('/api/workshops/available-slots', (req, res) => {
  res.json({
    success: true,
    slots: workshopSlots,
    location: 'Xưởng Gốm Sáng Tạo Biên Hòa - Khu phố 1, Đường Bùi Hữu Nghĩa, Phường Tân Vạn, TP. Biên Hòa, Tỉnh Đồng Nai',
    included: [
      '1 Phôi gốm theo mẫu thiết kế 3D từ đất sét xám Tân Vạn trầm tích',
      'Bàn xoay cơ học & bộ dao trổ khắc chìm (champlevé) thủ công',
      'Bảng men màu Vert de Biên Hòa, men đá đỏ và men tro rơm pha sẵn',
      'Nghệ nhân ưu tú Biên Hòa kèm 1-on-1 hướng dẫn kỹ thuật khắc lộng và chấm men',
      'Bao gồm chi phí sấy, nung lò rồng củi 1220°C và đóng gói hộp quà xuất xưởng giao tận nhà'
    ]
  });
});

app.post('/api/workshops', (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      date,
      timeSlot,
      attendees,
      designData,
      notes
    } = req.body;

    // Input validation & sanitization
    if (!sanitizeStr(customerName, 100) || !validatePhone(customerPhone) || !validateDate(date) || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Họ tên, Số điện thoại, Ngày và Ca giờ workshop mong muốn'
      });
    }

    if (!workshopSlots.includes(timeSlot)) {
      return res.status(400).json({ success: false, message: 'Ca giờ workshop không hợp lệ' });
    }

    const attendeeCount = Number(attendees) || 1;
    if (attendeeCount < 1 || attendeeCount > 10) {
      return res.status(400).json({ success: false, message: 'Số lượng khách phải từ 1 đến 10' });
    }

    const bookingId = `GV-WS-${Math.floor(100000 + Math.random() * 900000)}`;
    const newBooking = {
      bookingId,
      customerName: sanitizeStr(customerName, 100),
      customerPhone: sanitizeStr(customerPhone, 20),
      customerEmail: sanitizeStr(customerEmail, 100),
      date,
      timeSlot,
      attendees: attendeeCount,
      designData: designData || null,
      notes: sanitizeStr(notes, 1000),
      pricePerPerson: 250000,
      totalPrice: attendeeCount * 250000,
      status: 'confirmed',
      prepStatus: 'Xưởng đang chuẩn bị phôi đất & bảng màu theo bản thiết kế 3D',
      createdAt: new Date().toISOString()
    };

    db.workshops.push(newBooking);

    res.status(201).json({
      success: true,
      message: 'Đặt lịch trải nghiệm Workshop làng gốm thành công!',
      booking: newBooking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi đặt lịch workshop', error: error.message });
  }
});

app.get('/api/workshops', (req, res) => {
  res.json({
    success: true,
    total: db.workshops.length,
    data: db.workshops
  });
});

// ──────────────────────────────────────────────────────────
// Appointments (Visit booking — Đặt lịch đến ngắm mẫu tại xưởng)
// ──────────────────────────────────────────────────────────

// Available visit time slots (configurable via env, fallback to defaults)
let visitSlots = [
  '08:30 - 10:30 (Sáng)',
  '10:30 - 12:30 (Trưa)',
  '14:00 - 16:00 (Chiều)',
  '16:00 - 18:00 (Hoàng hôm)'
];
try {
  const envSlots = JSON.parse(process.env.VISIT_SLOTS || '');
  if (Array.isArray(envSlots) && envSlots.length > 0) {
    visitSlots = envSlots;
  }
} catch {
  // Fall back to hardcoded defaults
}

app.get('/api/appointments/available-slots', (req, res) => {
  res.json({
    success: true,
    slots: visitSlots,
    location: 'Xưởng Gốm Sáng Tạo Biên Hòa - Khu phố 1, Đường Bùi Hữu Nghĩa, Phường Tân Vạn, TP. Biên Hòa, Tỉnh Đồng Nai',
    free: true,
    note: 'Lịch hẹn ngắm mẫu là hoạt động hoàn toàn miễn phí.'
  });
});

app.post('/api/appointments', (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      date,
      timeSlot,
      attendees,
      notes,
      bookingType,
      purpose,
      paymentMethod,
      depositAmount
    } = req.body;

    // Input validation & sanitization
    if (!sanitizeStr(customerName, 100) || !validatePhone(customerPhone) || !validateDate(date) || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Họ tên, Số điện thoại, Ngày và Ca giờ mong muốn'
      });
    }

    if (!visitSlots.includes(timeSlot)) {
      return res.status(400).json({ success: false, message: 'Ca giờ không hợp lệ' });
    }

    const attendeeCount = Number(attendees) || 1;
    if (attendeeCount < 1 || attendeeCount > 8) {
      return res.status(400).json({ success: false, message: 'Số lượng khách phải từ 1 đến 8' });
    }

    const appointmentId = `GV-VST-${Math.floor(100000 + Math.random() * 900000)}`;
    const newAppointment = {
      appointmentId,
      customerName: sanitizeStr(customerName, 100),
      customerPhone: sanitizeStr(customerPhone, 20),
      customerEmail: sanitizeStr(customerEmail, 100),
      date,
      timeSlot,
      attendees: attendeeCount,
      notes: sanitizeStr(notes, 1000),
      bookingType: bookingType || 'visit',
      purpose: purpose || 'sample_viewing',
      paymentMethod: paymentMethod || 'momo',
      depositAmount: depositAmount || 0,
      depositStatus: paymentMethod === 'cod' ? 'pending_cod' : 'pending',
      status: 'confirmed',
      prepStatus: 'Xưởng đang chuẩn bị bộ sưu tập mẫu men màu & bảng họa tiết theo yêu cầu của bạn',
      totalPrice: 0,
      createdAt: new Date().toISOString()
    };

    db.appointments = db.appointments || [];
    db.appointments.push(newAppointment);

    res.status(201).json({
      success: true,
      message: 'Đặt lịch ngắm mẫu tại xưởng thành công!',
      appointment: newAppointment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi đặt lịch ngắm mẫu', error: error.message });
  }
});

app.get('/api/appointments', (req, res) => {
  res.json({
    success: true,
    total: (db.appointments || []).length,
    data: db.appointments || []
  });
});

// 404 handler — catch-all for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
});

// Centralized error handler — never leak internal details to the client
app.use((err, req, res, next) => {
  console.error('[Backend Core] Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS không được cho phép' });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ'
  });
});

app.listen(PORT, () => {
  console.log(`[Backend Core] Ceramic E-Com & Workshop Server running on http://localhost:${PORT}`);
});
