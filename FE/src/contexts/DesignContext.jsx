import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { GLAZE_LIST, DEFAULT_GLAZE } from '../data/glazes';
import { PATTERNS } from '../data/patterns';

/**
 * Design Context - holds the entire 3D ceramic studio state.
 *
 * Instead of prop-drilling 10+ values from App.jsx into StudioScreen →
 * RightSidebar → CeramicCanvas3D, all design state lives here.
 */
const DesignContext = createContext(null);

export const useDesign = () => {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used within a DesignProvider');
  return ctx;
};

const MODEL_BASE_PRICES = {
  mug: 180000,
  vase: 320000,
  bowl: 210000,
  plate: 260000,
};

export function DesignProvider({ children }) {
  // ── Core Design State ──
  const [modelType, setModelType] = useState('mug');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [glazeColor, setGlazeColor] = useState(DEFAULT_GLAZE.color);
  const [glazeName, setGlazeName] = useState(DEFAULT_GLAZE.name);
  const [glazeRoughness, setGlazeRoughness] = useState(DEFAULT_GLAZE.roughness);
  const [pattern, setPattern] = useState('sen_co');
  const [patternImage, setPatternImage] = useState(null);
  const [customText, setCustomText] = useState('');
  const [customLathePoints, setCustomLathePoints] = useState(null);
  const [customGlbUrl, setCustomGlbUrl] = useState(null);

  // ── Trạng thái AI phân tích & bóc tách tiêu bản thực tế ──
  const [isAiDeconstructing, setIsAiDeconstructing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);

  // ── Lưu giữ họa tiết ban đầu của phôi để có thể ấn 'Mặc định' khôi phục bất cứ lúc nào ──
  const [defaultPattern, setDefaultPattern] = useState('sen_co');
  const [defaultPatternImage, setDefaultPatternImage] = useState(null);
  const [defaultPatternTransform, setDefaultPatternTransform] = useState({
    yPercent: 68,
    rotationAngle: 0,
    scale: 1.0,
    rotation: 0,
  });

  const resetPatternToDefault = useCallback(() => {
    setPattern(defaultPattern);
    setPatternImage(defaultPatternImage);
    setPatternTransform(defaultPatternTransform);
  }, [defaultPattern, defaultPatternImage, defaultPatternTransform]);

  // ── Tự do điều chỉnh vị trí, kích thước, góc xoay của hoa văn & chữ ──
  const [patternTransform, setPatternTransform] = useState({
    yPercent: 68,        // Vị trí dọc: 15% (miệng) -> 85% (đáy)
    rotationAngle: 0,    // Xoay 360 độ quanh thân gốm (-180° đến +180°)
    scale: 1.0,          // Kích thước (0.5x đến 2.0x)
    rotation: 0,         // Độ nghiêng xoay (-45° đến +45°)
  });

  const [textTransform, setTextTransform] = useState({
    yPercent: 82,        // Vị trí dọc chữ
    rotationAngle: 0,    // Xoay 360 độ quanh thân gốm
    fontSize: 44,        // Cỡ chữ (24px đến 64px)
    placement: 'belly',  // 'belly' (thân trước) hoặc 'bottom' (chân mộc đáy)
  });

  // ── Chế độ tương tác chuột: 'orbit' (xoay 3D), 'drag-pattern' (kéo hoa văn), 'drag-text' (kéo chữ) ──
  const [interactionMode, setInteractionMode] = useState('orbit');
  // Đối tượng đang được chọn để di chuyển trên 3D: 'pattern' hoặc 'text'
  const [activeElement, setActiveElement] = useState('pattern');

  // ── Danh sách dáng phôi do người dùng tự thêm vào ──
  const [customShapes, setCustomShapes] = useState([]);

  const addCustomShape = useCallback((shape) => {
    if (!shape) return;
    const newShape = {
      id: shape.id || `custom_${Date.now()}`,
      name: shape.name || 'Dáng Gốm Tự Tạo',
      code: shape.code || `CUST.${String(customShapes.length + 1).padStart(2, '0')}`,
      lathePoints: shape.lathePoints || null,
      base3DType: shape.base3DType || 'bowl',
    };
    setCustomShapes((prev) => [newShape, ...prev]);
    setModelType(newShape.id);
    if (newShape.lathePoints) {
      setCustomLathePoints(newShape.lathePoints);
    }
    return newShape;
  }, [customShapes.length]);

  // ── Convenience setters ──

  const setGlazeById = useCallback((id) => {
    const glaze = GLAZE_LIST.find((g) => g.id === id);
    if (!glaze) return;
    setGlazeColor(glaze.color);
    setGlazeName(glaze.name);
    setGlazeRoughness(glaze.roughness);
  }, []);

  const setPatternById = useCallback((id) => {
    const pat = PATTERNS.find((p) => p.id === id);
    setPattern(pat ? pat.id : id);
  }, []);

  const resetDesign = useCallback(() => {
    setModelType('mug');
    setGlazeColor(DEFAULT_GLAZE.color);
    setGlazeName(DEFAULT_GLAZE.name);
    setGlazeRoughness(DEFAULT_GLAZE.roughness);
    setPattern('sen_co');
    setPatternImage(null);
    setCustomText('');
    setCustomLathePoints(null);
    setPatternTransform({ yPercent: 68, rotationAngle: 0, scale: 1.0, rotation: 0 });
    setTextTransform({ yPercent: 82, rotationAngle: 0, fontSize: 44, placement: 'belly' });
  }, []);

  // ── Computed Design Object ──

  const basePrice = MODEL_BASE_PRICES[modelType] || MODEL_BASE_PRICES.mug;
  const patternSurcharge = pattern !== 'none' && pattern !== undefined ? 20000 : 0;
  const textSurcharge = customText.trim() ? 30000 : 0;
  const currentPrice = basePrice + patternSurcharge + textSurcharge;

  const activeDesign = useMemo(
    () => ({
      modelType,
      glazeColor,
      glazeName,
      glazeRoughness,
      pattern,
      patternImage,
      patternTransform,
      customText,
      textTransform,
      customLathePoints,
      customShapes,
      price: currentPrice,
      basePrice,
    }),
    [
      modelType, glazeColor, glazeName, glazeRoughness, pattern, patternImage, patternTransform,
      customText, textTransform, customLathePoints, customShapes, currentPrice, basePrice
    ]
  );

  const selectProductForDesign = useCallback(async (product) => {
    if (!product) return;
    setSelectedProduct(product);
    const targetType = product.type || product.category || product.aiDeconstructed?.base3DType || 'vase';
    setModelType(targetType);

    // Men màu khởi đầu từ phôi (tránh màn hình giật/trống trong lúc chờ AI)
    if (product.recommendedGlazes && product.recommendedGlazes.length > 0) {
      const g = product.recommendedGlazes[0];
      if (g.colorHex) setGlazeColor(g.colorHex);
      if (g.name) setGlazeName(g.name);
    }

    // Reset phôi 3D cũ & xóa chữ khắc tùy chỉnh
    setCustomGlbUrl(null);
    setCustomLathePoints(null);
    setPattern('none');
    setPatternImage(null);
    setCustomText('');
    setPatternTransform({ yPercent: 68, rotationAngle: 0, scale: 1.0, rotation: 0 });
    setTextTransform({ yPercent: 82, rotationAngle: 0, fontSize: 44, placement: 'belly' });

    // Đã loại bỏ AI xử lý ảnh (analyzeAndDeconstructSpecimen + /api/ai/clean-and-deconstruct)
    // Chỉ set state đơn giản — không gọi API AI, không phân tích ảnh.
    setDefaultPattern('none');
    setDefaultPatternImage(null);
    setDefaultPatternTransform({ yPercent: 68, rotationAngle: 0, scale: 1.0, rotation: 0 });
    setIsAiDeconstructing(false);
  }, []);

  const value = useMemo(
    () => ({
      // State
      modelType,
      setModelType,
      selectedProduct,
      setSelectedProduct,
      selectProductForDesign,
      isAiDeconstructing,
      setIsAiDeconstructing,
      aiAnalysisResult,
      setAiAnalysisResult,
      defaultPattern,
      defaultPatternImage,
      resetPatternToDefault,
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
      patternTransform,
      setPatternTransform,
      customText,
      setCustomText,
      textTransform,
      setTextTransform,
      customLathePoints,
      setCustomLathePoints,
      customGlbUrl,
      setCustomGlbUrl,
      customShapes,
      setCustomShapes,
      addCustomShape,
      interactionMode,
      setInteractionMode,
      activeElement,
      setActiveElement,
      // Convenience
      setGlazeById,
      setPatternById,
      resetDesign,
      // Computed
      activeDesign,
      currentPrice,
      basePrice,
    }),
    [
      modelType, selectedProduct, selectProductForDesign, isAiDeconstructing, aiAnalysisResult,
      defaultPattern, defaultPatternImage, resetPatternToDefault,
      glazeColor, glazeName, glazeRoughness,
      pattern, patternImage, patternTransform, customText, textTransform, customLathePoints, customGlbUrl, customShapes, addCustomShape,
      interactionMode, activeElement, setGlazeById, setPatternById, resetDesign, activeDesign, currentPrice, basePrice,
    ]
  );

  return (
    <DesignContext.Provider value={value}>
      {children}
    </DesignContext.Provider>
  );
}
