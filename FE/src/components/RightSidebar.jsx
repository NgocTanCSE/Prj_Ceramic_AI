import React, { useState, useMemo, useRef } from 'react';
import { GLAZE_LIST } from '../data/glazes';
import { PATTERNS } from '../data/patterns';
import { MODEL_LABELS } from '../data/products';
import { imageCache, makeImageTransparent } from '../utils/ceramicTextureGenerator';
import { generateOrthographicViews } from '../utils/orthographicRenderer';
import { extractSilhouetteMaskFromCanvas, extractSymmetricLatheProfileFromMask } from '../utils/meshInflator';
import { useDesign } from '../contexts/DesignContext';
import { useCart } from '../contexts/CartContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import Button from '../ui/Button';

/* ──────────────────────────────────────────────────────────
   Right Sidebar - Bảng Điều Khiển Tạo Tác Xưởng Gốm 3D
   - Dáng phôi: Hỗ trợ tự nạp dáng mới từ ảnh/vẽ biên dạng.
   - Men gốm: Danh sách gọn chỉ có tiêu đề (không mô tả dài),
     kèm bảng màu đa sắc phong phú và color picker tự do.
   - Họa tiết & Chữ: Điều chỉnh vị trí, xoay, kích thước tự do.
   ────────────────────────────────────────────────────────── */

const STANDARD_MODELS = [
  { id: 'mug', name: 'Cốc Trụ', code: 'MOD.01' },
  { id: 'vase', name: 'Bình Khí', code: 'MOD.02' },
  { id: 'bowl', name: 'Bát Thiền', code: 'MOD.03' },
  { id: 'plate', name: 'Đĩa Mộc', code: 'MOD.04' },
  { id: 'vase-narrow-neck', name: 'Bình Cổ Nhỏ', code: 'MOD.05' },
];

export default function RightSidebar({ onClose, onGetSnapshot }) {
  const {
    modelType,
    setModelType,
    glazeColor,
    setGlazeColor,
    glazeName,
    setGlazeName,
    glazeRoughness,
    setGlazeRoughness,
    pattern,
    setPattern,
    patternImage,
    setPatternImage,
    resetPatternToDefault,
    patternTransform,
    setPatternTransform,
    customText,
    setCustomText,
    textTransform,
    setTextTransform,
    customLathePoints,
    setCustomLathePoints,
    customShapes,
    addCustomShape,
    interactionMode,
    setInteractionMode,
    activeElement,
    setActiveElement,
    currentPrice,
    selectedProduct,
    setSelectedProduct,
  } = useDesign();

  const { addItem, setSelectedIds } = useCart();
  const { setActiveTab } = useNavigation();
  const { showToast } = useToast();

  const shapeFileInputRef = useRef(null);
  const decalFileInputRef = useRef(null);

  // Chế độ hiển thị men gốm: 'list' (danh sách tiêu đề gọn không mô tả) hoặc 'palette' (bảng màu trực quan)
  const [glazeViewMode, setGlazeViewMode] = useState('list');
  const [customHexInput, setCustomHexInput] = useState(glazeColor);
  const [showDetailTextSliders, setShowDetailTextSliders] = useState(false);

  // ── Accordion State ──
  const [openSections, setOpenSections] = useState({
    glaze: true,
    pattern: true,
    inscription: true,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allOpen = useMemo(
    () => Object.values(openSections).every(Boolean),
    [openSections]
  );

  const toggleAll = () => {
    const nextState = !allOpen;
    setOpenSections({
      glaze: nextState,
      pattern: nextState,
      inscription: nextState,
    });
  };

  const allModelOptions = useMemo(() => {
    return [...STANDARD_MODELS, ...(customShapes || [])];
  }, [customShapes]);

  const selectedModel = useMemo(
    () => allModelOptions.find((m) => m.id === modelType),
    [modelType, allModelOptions]
  );

  const selectedPattern = useMemo(
    () => PATTERNS.find((p) => p.id === pattern),
    [pattern]
  );

  const roughnessLabel = useMemo(() => {
    if (glazeRoughness < 0.15) return 'Bóng gương (Glossy)';
    if (glazeRoughness < 0.28) return 'Bóng lụa (Satin)';
    return 'Men mộc mờ (Matte)';
  }, [glazeRoughness]);

  const designName = MODEL_LABELS[modelType] || selectedModel?.name || modelType;

  // ── Handlers Chọn Men ──
  const handleGlazeSelect = (g) => {
    setGlazeColor(g.color);
    setGlazeName(g.name);
    setGlazeRoughness(g.roughness);
    setCustomHexInput(g.color);
  };

  const handleCustomColorChange = (hex) => {
    setGlazeColor(hex);
    setGlazeName(`Men Tự Chọn (${hex.toUpperCase()})`);
    setCustomHexInput(hex);
  };

  // ── Handlers Thêm Dáng Phôi Mới Từ File Ảnh ──
  const handleUploadCustomShape = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Trích xuất biên dạng đường bao đối xứng tròn xoay thông minh từ ảnh thật
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 256, 256);
        const maskData = extractSilhouetteMaskFromCanvas(canvas);

        let pts = null;
        if (!maskData.isEmpty) {
          pts = extractSymmetricLatheProfileFromMask(
            maskData.mask,
            maskData.w,
            maskData.h,
            maskData.bbox
          );
        }

        if (!pts || pts.length < 8) {
          showToast('Ảnh không rõ đường viền dáng gốm, vui lòng dùng ảnh có nền sáng hoặc rõ nét hơn!', 'error');
          return;
        }

        const shapeName = file.name.replace(/\.[^/.]+$/, '').slice(0, 18) || 'Dáng Tự Chọn';
        addCustomShape({
          name: shapeName,
          lathePoints: pts,
          base3DType: 'bowl',
        });
        showToast(`Đã tạo thành công dáng phôi 3D "${shapeName}" từ ảnh!`, 'success');
      };
      img.onerror = () => {
        showToast('Không thể đọc file ảnh dáng, vui lòng chọn file khác!', 'error');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Thêm nhanh các dáng gốm độc bản từ thư viện
  const handleAddPresetCustomShape = (name, pts) => {
    addCustomShape({
      name,
      lathePoints: pts,
      base3DType: 'vase',
    });
    showToast(`Đã thêm dáng "${name}" vào bàn xoay 3D!`, 'success');
  };

  // ── Handlers Thêm Decal Họa Tiết Riêng ──
  const handleUploadDecal = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        // Tự động lọc nền trắng nếu có để dán trong suốt lên thân gốm
        const processed = makeImageTransparent(img);
        const finalUrl = (processed && typeof processed.toDataURL === 'function')
          ? processed.toDataURL('image/png')
          : dataUrl;
        imageCache.set(finalUrl, processed);
        imageCache.set(dataUrl, processed);
        setPattern('custom_uploaded');
        setPatternImage(finalUrl);
        setInteractionMode('drag-pattern');
        showToast('Đã áp dụng ảnh họa tiết riêng lên thân gốm 3D!', 'success');
      };
      img.onerror = () => {
        showToast('Không thể giải mã file ảnh, vui lòng thử ảnh PNG/JPG khác!', 'error');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddToCart = () => {
    let snapshot = null;
    if (typeof onGetSnapshot === 'function') {
      try {
        snapshot = onGetSnapshot();
      } catch (_) {}
    }
    if (!snapshot && selectedProduct?.image) {
      snapshot = selectedProduct.image;
    }
    if (!snapshot) {
      try {
        const views = generateOrthographicViews(
          null,
          modelType,
          glazeColor,
          glazeRoughness,
          customLathePoints,
          pattern,
          customText,
          glazeName,
          patternImage
        );
        if (views && views[0]?.previewImg) {
          snapshot = views[0].previewImg;
        }
      } catch (_) {}
    }

    const newItem = addItem({
      modelType,
      name: `${designName} (${glazeName})`,
      image: snapshot,
      glazeColor,
      glazeName,
      glazeRoughness,
      pattern,
      patternImage,
      patternTransform,
      customText,
      textTransform,
      customLathePoints,
      price: currentPrice,
      quantity: 1,
    });
    showToast('Đã ghi nhận mẫu thiết kế vào Giỏ Phôi!');
    return newItem;
  };

  const handleDirectCheckout = () => {
    const newItem = handleAddToCart();
    if (newItem && newItem.id && setSelectedIds) {
      setSelectedIds([newItem.id]);
    }
    setActiveTab('checkout');
  };

  // ── Đặt lịch ngắm mẫu tại xưởng (giống nút "Đặt lịch" trên ProductCard) ──
  // Nếu chưa chọn sản phẩm từ Thư viện, đóng gói thiết kế hiện tại
  // (dáng + men + ảnh snapshot + giá ước tính) thành "mẫu đã chọn" cho ScheduleScreen.
  // KHÔNG gọi selectProductForDesign — không reset hoa văn/chữ đang thiết kế dở.
  const handleScheduleVisit = () => {
    if (!selectedProduct) {
      let snapshot = null;
      if (typeof onGetSnapshot === 'function') {
        try { snapshot = onGetSnapshot(); } catch (_) {}
      }
      setSelectedProduct({
        id: `studio-design-${Date.now()}`,
        name: `${designName} (${glazeName})`,
        type: modelType,
        modelType,
        image: snapshot || undefined,
        price: currentPrice,
      });
    }
    setActiveTab('schedule');
    showToast(`Đã đưa "${selectedProduct?.name || `${designName} (${glazeName})`}" vào lịch đặt lịch ngắm mẫu!`);
  };

  return (
    <aside
      className="w-84 md:w-96 h-full flex-shrink-0 bg-ceramic-cream border-l border-ceramic-border flex flex-col justify-between overflow-y-auto select-none"
      aria-label="Công cụ thiết kế xưởng"
    >
      <div className="p-6 space-y-5 flex-1">
        {/* ── 1. Sắc Men Truyền Thống & Bảng Màu Đa Sắc ── */}
        <div className="border-b border-ceramic-border/60 pb-5">
          <button
            type="button"
            onClick={() => toggleSection('glaze')}
            aria-expanded={openSections.glaze}
            className="w-full flex items-center justify-between text-xs font-mono text-ceramic-slate hover:text-ceramic-charcoal transition-colors py-1 cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-left">
              <span className={`w-1.5 h-1.5 transition-colors ${openSections.glaze ? 'bg-ceramic-terracotta' : 'bg-ceramic-slate/50 group-hover:bg-ceramic-terracotta'}`} />
              <span className="font-bold uppercase tracking-wide text-ceramic-charcoal text-xs">
                Màu sắc
              </span>
              {!openSections.glaze && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-ceramic-paper border border-ceramic-border text-ceramic-terracotta font-mono font-medium ml-1">
                  <span className="w-2.5 h-2.5 inline-block border border-ceramic-border rounded-xs" style={{ backgroundColor: glazeColor }} />
                  <span className="truncate max-w-[90px]">{glazeName}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-lg border border-ceramic-border bg-ceramic-paper flex items-center justify-center transition-transform duration-200 group-hover:border-ceramic-terracotta ${openSections.glaze ? 'rotate-180 bg-ceramic-cream' : ''
                  }`}
                title={openSections.glaze ? 'Thu gọn' : 'Xổ ra'}
              >
                <svg className="w-3 h-3 text-ceramic-charcoal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </button>

          {openSections.glaze && (
            <div className="space-y-3 mt-2.5">
              {/* Thanh Chuyển Chế Độ Xem: Bảng Màu Đa Sắc / Danh Sách Gọn */}
              <div className="flex items-center justify-between bg-ceramic-paper p-1 rounded-xl border border-ceramic-border/80 text-[11px] font-mono gap-1">
                <button
                  type="button"
                  onClick={() => setGlazeViewMode('palette')}
                  className={`flex-1 py-1.5 px-2 text-center rounded-lg transition-all cursor-pointer font-medium ${glazeViewMode === 'palette'
                    ? 'bg-ceramic-terracotta text-ceramic-paper font-semibold shadow-paper'
                    : 'text-ceramic-slate hover:text-ceramic-charcoal hover:bg-ceramic-cream/50'
                    }`}
                >
                  Bảng Màu
                </button>
                <button
                  type="button"
                  onClick={() => setGlazeViewMode('list')}
                  className={`flex-1 py-1.5 px-2 text-center rounded-lg transition-all cursor-pointer font-medium ${glazeViewMode === 'list'
                    ? 'bg-ceramic-terracotta text-ceramic-paper font-semibold shadow-paper'
                    : 'text-ceramic-slate hover:text-ceramic-charcoal hover:bg-ceramic-cream/50'
                    }`}
                >
                  Màu truyền thống
                </button>
              </div>

              {/* Color Picker Tự Chọn Tự Do */}
              <div className="bg-ceramic-paper p-2.5 rounded-xl border border-ceramic-border flex items-center justify-between gap-2.5 shadow-paper">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={glazeColor}
                    onChange={(e) => handleCustomColorChange(e.target.value)}
                    className="w-7 h-7 p-0 rounded-lg cursor-pointer bg-transparent"
                    title="Mở bảng chọn màu tùy chỉnh"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-ceramic-slate uppercase">Màu Đang Chọn:</div>
                  <div className="text-xs font-mono font-bold text-ceramic-charcoal truncate max-w-[130px]">
                    {glazeName}
                  </div>
                </div>
                <input
                  type="text"
                  value={customHexInput}
                  onChange={(e) => {
                    setCustomHexInput(e.target.value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                      handleCustomColorChange(e.target.value);
                    }
                  }}
                  placeholder="#HEX"
                  className="w-[100px] font-mono px-2 py-1 rounded-lg border border-ceramic-border bg-ceramic-paper text-ceramic-charcoal uppercase text-center focus:outline-none focus:border-ceramic-terracotta"
                />
              </div>

              {/* View 1: Bảng Màu Đa Sắc (Lưới Swatches) */}
              {glazeViewMode === 'palette' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-5 gap-1.5 bg-ceramic-paper p-2.5 rounded-xl border border-ceramic-border">
                    {GLAZE_LIST.map((g) => {
                      const isSelected = glazeColor.toLowerCase() === g.color.toLowerCase();
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleGlazeSelect(g)}
                          title={`${g.name} (${g.origin})`}
                          className={`
                            aspect-square w-full rounded-lg border transition-transform relative group cursor-pointer
                            ${isSelected
                              ? 'ring-2 ring-ceramic-terracotta ring-offset-1 scale-105 z-10'
                              : 'hover:scale-105 border-ceramic-charcoal/15'
                            }
                          `}
                          style={{ backgroundColor: g.color }}
                        >
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ceramic-paper drop-shadow-[0_1px_1px_rgba(18,18,18,0.3)]">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View 2: Dạng Danh Sách Gọn Chỉ Có Tiêu Đề (Không Mô Tả) */}
              {glazeViewMode === 'list' && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {GLAZE_LIST.map((g) => {
                    const isSelected = glazeColor.toLowerCase() === g.color.toLowerCase();
                    return (
                      <div
                        key={g.id}
                        onClick={() => handleGlazeSelect(g)}
                        role="button"
                        tabIndex={0}
                        className={`
                          p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between
                          ${isSelected
                            ? 'bg-ceramic-paper border-ceramic-terracotta shadow-paper font-semibold ring-1 ring-ceramic-terracotta/20'
                            : 'bg-ceramic-paper border-ceramic-border hover:border-ceramic-charcoal hover:bg-ceramic-paper'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className="w-4 h-4 border border-ceramic-charcoal/20 flex-shrink-0 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: g.color }}
                          />
                          <span className="text-xs font-bold text-ceramic-charcoal truncate">
                            {g.name}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-mono text-ceramic-terracotta font-bold flex-shrink-0 ml-2">
                            ✓ ĐANG CHỌN
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Điều Chỉnh Độ Bóng Của Men (Roughness Slider) */}
              <div className="bg-ceramic-paper p-3 rounded-xl border border-ceramic-border space-y-1.5 shadow-paper">
                <div className="flex justify-between text-xs font-mono text-ceramic-slate">
                  <span>ĐỘ BÓNG MEN:</span>
                  <span className="font-bold text-ceramic-charcoal">{roughnessLabel}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.55"
                  step="0.05"
                  value={glazeRoughness}
                  onChange={(e) => setGlazeRoughness(parseFloat(e.target.value))}
                  className="w-full accent-ceramic-terracotta cursor-pointer"
                  aria-label="Điều chỉnh độ bóng men"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Họa Tiết Vẽ Tay (Tự do điều chỉnh vị trí, xoay, kích thước) ── */}
        <div className="border-b border-ceramic-border/60 pb-5">
          <div className="w-full flex items-center justify-between text-xs font-mono text-ceramic-slate py-1">
            <button
              type="button"
              onClick={() => toggleSection('pattern')}
              aria-expanded={openSections.pattern}
              className="flex items-center gap-1.5 text-left cursor-pointer group flex-1"
            >
              <span className={`w-1.5 h-1.5 transition-colors ${openSections.pattern ? 'bg-ceramic-terracotta' : 'bg-ceramic-slate/50 group-hover:bg-ceramic-terracotta'}`} />
              <span className="font-bold uppercase tracking-wide text-ceramic-charcoal text-xs">
                Họa Tiết
              </span>
              {!openSections.pattern && selectedPattern && (
                <span className="text-[10px] px-1.5 py-0.5 bg-ceramic-paper border border-ceramic-border text-ceramic-terracotta font-mono font-medium ml-1">
                  {selectedPattern.label}
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              {/* Nút Mặc Định - Khôi phục họa tiết ban đầu của phôi */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetPatternToDefault();
                  showToast('Đã khôi phục họa tiết ban đầu của phôi!');
                }}
                title="Khôi phục họa tiết ban đầu của phôi"
                className="px-2 py-0.5 text-[10px] font-mono rounded-lg border border-ceramic-border bg-ceramic-paper hover:bg-ceramic-cream hover:border-ceramic-terracotta text-ceramic-slate hover:text-ceramic-terracotta transition-all flex items-center gap-1 shadow-paper cursor-pointer font-medium"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Mặc định</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSection('pattern')}
                className={`w-5 h-5 rounded-lg border border-ceramic-border bg-ceramic-paper flex items-center justify-center transition-transform duration-200 hover:border-ceramic-terracotta cursor-pointer ${openSections.pattern ? 'rotate-180 bg-ceramic-cream' : ''
                  }`}
                title={openSections.pattern ? 'Thu gọn' : 'Xổ ra'}
              >
                <svg className="w-3 h-3 text-ceramic-charcoal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          </div>

          {openSections.pattern && (
            <div className="space-y-3 mt-2.5">
              {/* Danh sách họa tiết */}
              <div className="grid grid-cols-2 gap-2">
                {PATTERNS.map((p) => {
                  const isSelected = pattern === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPattern(p.id);
                        if (p.id !== 'custom_uploaded') setPatternImage(null);
                      }}
                      aria-pressed={isSelected}
                      className={`
                        p-2.5 rounded-xl border text-left transition-all font-mono cursor-pointer relative group
                        ${isSelected
                          ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta shadow-paper font-semibold'
                          : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-terracotta hover:bg-ceramic-paper hover:text-ceramic-charcoal'
                        }
                      `}
                    >
                      <div className={`text-xs font-bold truncate ${isSelected ? 'text-ceramic-paper' : 'text-ceramic-charcoal'}`}>{p.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Nút tải Decal riêng */}
              <input
                type="file"
                ref={decalFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleUploadDecal}
              />
              <button
                type="button"
                onClick={() => decalFileInputRef.current?.click()}
                className="w-full py-2 px-3 border border-dashed border-ceramic-terracotta/70 bg-ceramic-paper hover:bg-ceramic-terracotta hover:text-ceramic-paper text-ceramic-terracotta font-mono text-xs rounded-xl shadow-paper hover:shadow-paper transition-all flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <span className="font-bold">+</span>
                <span>Tải Ảnh Họa Tiết</span>
              </button>

              {/* Thẻ Xem Trước & Áp Dụng Họa Tiết Đã Tải Lên */}
              {patternImage && (
                <div className={`p-2.5 border transition-all flex items-center justify-between rounded-xl ${pattern === 'custom_uploaded'
                  ? 'bg-ceramic-paper border-ceramic-terracotta ring-1 ring-ceramic-terracotta/30 shadow-paper'
                  : 'bg-ceramic-paper/70 border-ceramic-border'
                  }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={patternImage}
                      alt="Ảnh decal đã tải lên"
                      className="w-11 h-11 object-contain rounded-lg border border-ceramic-border bg-ceramic-paper flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ceramic-charcoal truncate">Ảnh Decal Tự Tải</div>
                      <div className={`text-[10px] font-mono ${pattern === 'custom_uploaded' ? 'text-ceramic-terracotta font-semibold' : 'text-ceramic-slate'}`}>
                        {pattern === 'custom_uploaded' ? '✓ ĐANG ÁP DỤNG TRÊN 3D' : 'Nhấp để áp dụng'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {pattern !== 'custom_uploaded' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPattern('custom_uploaded');
                          setInteractionMode('drag-pattern');
                        }}
                        className="px-2.5 py-1 bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-[10px] font-mono rounded-lg cursor-pointer transition-colors shadow-paper font-medium"
                      >
                        Áp dụng
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPattern('none');
                          setPatternImage(null);
                        }}
                        className="px-2.5 py-1 text-ceramic-slate hover:text-ceramic-terracotta text-[10px] font-mono cursor-pointer transition-colors rounded-lg font-medium"
                        title="Xóa ảnh họa tiết này"
                      >
                        Gỡ bỏ
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Kích cỡ họa tiết (giữ lại khi bỏ bàn di) */}
              {pattern !== 'none' && (
                <div className="pt-1 border-t border-ceramic-border/60 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-ceramic-charcoal">
                    <span>Kích cỡ hoa văn:</span>
                    <strong className="text-ceramic-terracotta">{patternTransform?.scale ?? 1.0}×</strong>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.6"
                    step="0.1"
                    value={patternTransform?.scale ?? 1.0}
                    onChange={(e) => setPatternTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                    className="w-full accent-ceramic-terracotta cursor-pointer"
                  />
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setPatternTransform(prev => ({ ...prev, scale: 1.0 }))}
                      className="text-[10px] text-ceramic-slate hover:text-ceramic-terracotta underline cursor-pointer font-mono"
                    >
                      Mặc định (1.0×)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 3. Dấu Khắc Mộc (Điều chỉnh vị trí & kích cỡ chữ tự do) ── */}
        <div className="pb-2">
          <button
            type="button"
            onClick={() => toggleSection('inscription')}
            aria-expanded={openSections.inscription}
            className="w-full flex items-center justify-between text-xs font-mono text-ceramic-slate hover:text-ceramic-charcoal transition-colors py-1 cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-left">
              <span className={`w-1.5 h-1.5 transition-colors ${openSections.inscription ? 'bg-ceramic-terracotta' : 'bg-ceramic-slate/50 group-hover:bg-ceramic-terracotta'}`} />
              <span className="font-bold uppercase tracking-wide text-ceramic-charcoal text-xs">
                3. Dấu Khắc Chữ & Vị Trí
              </span>
              {!openSections.inscription && (
                <span className="text-[10px] px-1.5 py-0.5 bg-ceramic-paper border border-ceramic-border text-ceramic-terracotta font-mono font-medium ml-1 truncate max-w-[100px] rounded-md">
                  {customText ? `"${customText}"` : 'Chưa khắc'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-ceramic-slate">
                {customText ? `${customText.length}/24 KÝ TỰ` : 'TỐI ĐA 24 KÝ TỰ'}
              </span>
              <span
                className={`w-5 h-5 rounded-lg border border-ceramic-border bg-ceramic-paper flex items-center justify-center transition-transform duration-200 group-hover:border-ceramic-terracotta ${openSections.inscription ? 'rotate-180 bg-ceramic-cream' : ''
                  }`}
                title={openSections.inscription ? 'Thu gọn' : 'Xổ ra'}
              >
                <svg className="w-3 h-3 text-ceramic-charcoal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </button>

          {openSections.inscription && (
            <div className="space-y-3 mt-2.5">
              <div className="relative">
                <input
                  type="text"
                  placeholder="VD: An Nhiên 2026, Kỷ niệm..."
                  maxLength={48}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="
                    w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl
                    border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta
                    text-ceramic-charcoal placeholder-ceramic-slate font-mono transition-colors shadow-paper
                  "
                  aria-label="Chữ khắc"
                />
              </div>

              {/* BỘ ĐIỀU CHỈNH VỊ TRÍ CHỮ KHẮC BẰNG CHUỘT / TRỰC QUAN */}
              {customText && customText.trim() && (
                <div className="bg-ceramic-paper p-3 rounded-xl border border-ceramic-border space-y-3 text-xs font-mono shadow-paper">
                  <div className="flex items-center justify-between pb-1 border-b border-ceramic-border/50 text-[10px] text-ceramic-slate font-bold uppercase tracking-wider">
                    <span>Di Chuyển Chữ Khắc (Chuột)</span>
                    <button
                      type="button"
                      onClick={() => setTextTransform({ yPercent: 82, rotationAngle: 0, fontSize: 44, placement: 'belly' })}
                      className="text-ceramic-terracotta hover:underline cursor-pointer"
                    >
                      Mặc định
                    </button>
                  </div>

                  {/* Mặt Khắc */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] text-ceramic-charcoal font-semibold">Mặt Khắc:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTextTransform(prev => ({ ...prev, placement: 'belly' }))}
                        className={`px-2.5 py-1 text-[10px] border rounded-lg cursor-pointer transition-all ${textTransform?.placement !== 'bottom'
                          ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold shadow-paper'
                          : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-charcoal'
                          }`}
                      >
                        Thân Trước
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextTransform(prev => ({ ...prev, placement: 'bottom' }))}
                        className={`px-2.5 py-1 text-[10px] border rounded-lg cursor-pointer transition-all ${textTransform?.placement === 'bottom'
                          ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold shadow-paper'
                          : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-charcoal'
                          }`}
                      >
                        Đáy Chân Mộc
                      </button>
                    </div>
                  </div>

                  {/* Nút Bật/Tắt di chuyển chữ trên 3D */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveElement('text');
                        setInteractionMode(interactionMode === 'drag-text' ? 'orbit' : 'drag-text');
                      }}
                      className={`w-full py-1.5 px-3 text-[10px] font-mono rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                        interactionMode === 'drag-text'
                          ? 'bg-ceramic-terracotta text-ceramic-paper shadow-paper font-semibold'
                          : 'bg-ceramic-paper text-ceramic-slate border border-ceramic-border hover:border-ceramic-terracotta hover:text-ceramic-terracotta shadow-paper'
                      }`}
                    >
                      <span>✍️</span>
                      <span>{interactionMode === 'drag-text' ? 'Dừng di chuyển chữ' : 'Kéo chữ trên 3D'}</span>
                    </button>
                  </div>

                  {/* Cỡ chữ nhanh */}
                  <div className="pt-1 border-t border-ceramic-border/60 space-y-1">
                    <div className="flex justify-between text-[10px] text-ceramic-charcoal">
                      <span>Cỡ chữ khắc:</span>
                      <strong className="text-ceramic-terracotta">{textTransform?.fontSize ?? 44}px</strong>
                    </div>
                    <input
                      type="range"
                      min="24"
                      max="64"
                      step="2"
                      value={textTransform?.fontSize ?? 44}
                      onChange={(e) => setTextTransform(prev => ({ ...prev, fontSize: parseInt(e.target.value, 10) }))}
                      className="w-full accent-ceramic-terracotta cursor-pointer"
                    />
                  </div>

                  {/* Nút Xem / Ẩn Thanh Trượt Chi Tiết */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDetailTextSliders(!showDetailTextSliders)}
                      className="text-[10px] text-ceramic-slate hover:text-ceramic-charcoal underline cursor-pointer"
                    >
                      {showDetailTextSliders ? '▲ Thu gọn thanh trượt số' : '▼ Hiện thanh trượt số chi tiết'}
                    </button>
                    {showDetailTextSliders && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-ceramic-border/50 text-[11px]">
                        <div>
                          <div className="flex justify-between">
                            <span>Vị trí dọc (Y):</span>
                            <span>{textTransform?.yPercent ?? 82}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={textTransform?.yPercent ?? 82}
                            onChange={(e) => setTextTransform(prev => ({ ...prev, yPercent: parseInt(e.target.value, 10) }))}
                            className="w-full accent-ceramic-terracotta cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between">
                            <span>Xoay quanh thân (X):</span>
                            <span>{textTransform?.rotationAngle ?? 0}°</span>
                          </div>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            step="5"
                            value={textTransform?.rotationAngle ?? 0}
                            onChange={(e) => setTextTransform(prev => ({ ...prev, rotationAngle: parseInt(e.target.value, 10) }))}
                            className="w-full accent-ceramic-terracotta cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Pricing & Actions Docket ── */}
      <div className="p-6 border-t border-ceramic-border bg-ceramic-paper space-y-3">
        <div className="flex items-baseline justify-between border-b border-ceramic-border/50 pb-3">
          <span className="text-[11px] font-mono text-ceramic-slate uppercase">
            ƯỚC TÍNH PHÍ CHẾ TÁC:
          </span>
          <span className="font-editorial text-2xl font-bold text-ceramic-terracotta">
            {currentPrice.toLocaleString('vi-VN')}₫
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleAddToCart}
            className="rounded-xl py-3 font-semibold shadow-paper"
          >
            Lưu Vào Giỏ
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleDirectCheckout}
            className="rounded-xl py-3 font-semibold shadow-paper"
          >
            Đặt Chế Tác →
          </Button>
        </div>

        {/* Nút Đặt lịch — đồng bộ style với nút "Đặt lịch" trên ProductCard */}
        <button
          type="button"
          onClick={handleScheduleVisit}
          title="Đặt lịch ngắm mẫu gốm trực tiếp tại xưởng — hệ thống sẽ chuyển đến trang đặt lịch"
          className="
            w-full py-3 rounded-xl text-xs tracking-wide font-semibold shadow-paper
            border border-ceramic-terracotta text-ceramic-terracotta
            hover:bg-ceramic-terracotta hover:text-ceramic-paper
            transition-all duration-200 active:scale-95 cursor-pointer
            flex items-center justify-center gap-1.5
          "
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 9h12m-6 6h.01M9 18a3 3 0 100-6 3 3 0 000 6zm6 0a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          Đặt lịch ngắm mẫu
        </button>
      </div>
    </aside>
  );
}
