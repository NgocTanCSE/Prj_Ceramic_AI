import React, { useState, useEffect, useRef } from 'react';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import Button from '../ui/Button';
import CeramicCanvas3D from '../components/CeramicCanvas3D';
import { generateOrthographicViews, generateOrthographicViewsFromObject } from '../utils/orthographicRenderer';
import { preloadImage } from '../utils/ceramicTextureGenerator';
import { parsePromptToConcept, paramsToLathePoints } from '../utils/aiPromptParser';
import { analyzeAndDeconstructSpecimen } from '../utils/ceramicSpecimenAnalyzer.js';
import { sketchPatternImage } from '../utils/patternSketcher.js';
import { downloadCeramicPackage } from '../utils/ceramicExporter.js';
import { extractSilhouetteMaskFromCanvas } from '../utils/meshInflator.js';

/* ──────────────────────────────────────────────────────────
   AICoCreatorScreen - Bàn Phác Thảo & Bản Vẽ Trực Giao 6 Mặt
   - Pipeline AI đơn giản hóa (bỏ HF ZeroGPU/InstantMesh):
     1. Cloudflare LLaMA Vision: Khách upload ảnh ➔ concept {archetype, shapeParams}
     2. Catmull-Rom spline: shapeParams ➔ lathePoints (parametric 3D geometry)
     3. Three.js: Render lathePoints ngay trên StudioCanvas (không cần .glb)
   ────────────────────────────────────────────────────────── */

export default function AICoCreatorScreen({
  aiApiBase = import.meta.env.VITE_AI_API_BASE_URL || 'http://localhost:8000'
}) {
  const [prompt, setPrompt] = useState('');
  const [creatorState, setCreatorState] = useState('IDLE'); // 'IDLE' | 'AWAITING_CONFIRMATION' | 'GENERATING' | 'PREVIEW_READY'
  const [specDraft, setSpecDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Đang xử lý...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stage2D, setStage2D] = useState(null); // { imageUrl, prompt }
  const [conceptResult, setConceptResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const {
    setModelType,
    setGlazeColor,
    setGlazeName,
    setGlazeRoughness,
    setPattern,
    setPatternImage,
    setCustomText,
    setCustomLathePoints,
    setCustomGlbUrl,
    selectedProduct,
    setSelectedProduct,
    currentPrice,
  } = useDesign();
  const { setActiveTab } = useNavigation();
  const { showToast } = useToast();

  const [activeView, setActiveView] = useState('front');
  const [viewportMode, setViewportMode] = useState('3d'); // Mặc định 3D
  const [isExporting, setIsExporting] = useState(false);

  // Bộ đếm thời gian khi chờ AI xử lý
  useEffect(() => {
    let timer = null;
    if (isLoading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  // Bắt sự kiện khi mô hình 3D (.glb) load xong trong CeramicCanvas3D -> Tự động chụp 6 góc
  const handleModelLoaded = (model3D) => {
    if (!model3D) return;
    try {
      const views = generateOrthographicViewsFromObject(model3D, conceptResult?.modelType || conceptResult?.archetype || 'bowl');
      if (views && views.length > 0) {
        setConceptResult((prev) => (prev ? { ...prev, views } : prev));
      }
    } catch (err) {
      console.warn('Lỗi tự động chụp 6 góc trực giao từ model 3D:', err);
    }
  };

  // Procedural fallback: khi API Cloudflare không khả dụng, dùng parsePromptToConcept local
  const handleGenerateAIFallback = async (text) => {
    let concept = null;
    try {
      const res = await fetch(`${aiApiBase}/api/ai/prompt-to-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      if (res.ok) {
        const jsonRes = await res.json();
        if (jsonRes.success) concept = jsonRes;
      }
    } catch (netErr) {
      console.warn('API prompt-to-3d không phản hồi:', netErr);
    }

    if (!concept) {
      concept = parsePromptToConcept(text);
    }

    // Parametric synthesis: if LLaMA returns shapeParams but no lathePoints,
    // generate via Catmull-Rom spline from parametric anchors
    if (!concept.lathePoints && concept.shapeParams) {
      concept = { ...concept, lathePoints: paramsToLathePoints(concept.shapeParams) };
    }
    // Fallback: ensure parsePromptToConcept's own shapeParams generates points if missing
    if (!concept.lathePoints && concept.modelType) {
      concept = { ...concept, lathePoints: paramsToLathePoints({ archetype: concept.modelType, ...concept.shapeParams }) };
    }

    const isBlossom = concept.pattern === 'hoa_dao';
    const initialPatternImg = isBlossom ? '/assets/motifs/hoa_dao_branch.png' : null;
    if (initialPatternImg) {
      await preloadImage(initialPatternImg);
    }

    const finalViews = generateOrthographicViews(
      null,
      concept.modelType,
      concept.suggestedGlaze.hex,
      concept.suggestedGlaze.roughness,
      concept.lathePoints,
      concept.pattern || 'none',
      concept.customText || '',
      concept.suggestedGlaze.name,
      initialPatternImg,
      'brown'
    );

    setConceptResult({
      ...concept,
      patternImage: initialPatternImg,
      rimStyle: 'brown',
      views: finalViews,
    });
    setStage2D(null);
    setActiveView('front');
    setViewportMode('3d');
    showToast(`Đã tạo mẫu 3D "${concept.title}"!`, 'success');
  };

  // GIAI ĐOẠN 1: Khách gõ prompt -> Tổng hợp đặc tả kỹ thuật dự kiến (CHƯA tạo mô hình)
  const handlePreparePromptSpec = (queryText) => {
    const text = (queryText || prompt).trim();
    if (!text) {
      showToast('Vui lòng nhập mô tả ý tưởng hoặc chọn gợi ý', 'info');
      return;
    }
    setPrompt(text);

    // Phân tích tham số ban đầu từ prompt
    const initialConcept = parsePromptToConcept(text);
    const mType = initialConcept.modelType || 'vase';
    const draft = {
      title: initialConcept.title || `Bản Vẽ Gốm Biên Hòa: ${text.slice(0, 24)}`,
      prompt: text,
      archetype: mType,
      height: initialConcept.shapeParams?.height || (mType === 'mug' ? 12 : mType === 'bowl' ? 8 : mType === 'plate' ? 4 : 25),
      maxRadius: initialConcept.shapeParams?.maxRadius || (mType === 'mug' ? 5 : mType === 'bowl' ? 7 : mType === 'plate' ? 10 : 11),
      glazeName: initialConcept.suggestedGlaze?.name || 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
      glazeHex: initialConcept.suggestedGlaze?.hex || '#2A6B5C',
      roughness: initialConcept.suggestedGlaze?.roughness || 0.16,
      pattern: initialConcept.pattern || 'cuc_day',
      customText: initialConcept.customText || '',
      wallThickness: '5.5 mm',
      shrinkage: '9.2%',
      firingTemp: '1220°C Lò rồng Tân Vạn',
    };

    setSpecDraft(draft);
    setCreatorState('AWAITING_CONFIRMATION');
    showToast('Đã tổng hợp đặc tả thiết kế! Vui lòng kiểm tra và bấm "Tạo mô hình 3D" để xác nhận.', 'info');
  };

  // GIAI ĐOẠN 1.5: Người dùng đã kiểm tra và bấm xác nhận -> BẮT ĐẦU DỰNG 3D
  const handleConfirmAndGenerate = async () => {
    if (!specDraft) return;
    setCreatorState('GENERATING');
    setIsLoading(true);
    setLoadingMessage('Đang đúc khuôn & tính toán Catmull-Rom spline 3D theo đặc tả đã duyệt...');
    setError(null);

    try {
      // 1. Generate Lathe points from confirmed specification
      let lathePoints = paramsToLathePoints({
        archetype: specDraft.archetype,
        height: specDraft.height,
        maxRadius: specDraft.maxRadius,
      });

      if (!lathePoints || lathePoints.length === 0) {
        lathePoints = [
          { x: 0, y: -0.8 },
          { x: 0.45, y: -0.75 },
          { x: 0.95, y: -0.2 },
          { x: 0.55, y: 0.4 },
          { x: 0.7, y: 0.75 },
          { x: 0.58, y: 0.75 },
          { x: 0.45, y: 0.35 },
          { x: 0.75, y: -0.15 },
          { x: 0.32, y: -0.65 },
          { x: 0, y: -0.65 },
        ];
      }

      // 2. Generate orthographic views
      const initialPatternImg = (specDraft.pattern && specDraft.pattern !== 'none')
        ? imageCache.get(specDraft.pattern) || null
        : null;

      const finalViews = generateOrthographicViews(
        null,
        specDraft.archetype,
        specDraft.glazeHex,
        specDraft.roughness,
        lathePoints,
        specDraft.pattern || 'none',
        specDraft.customText || '',
        specDraft.glazeName,
        initialPatternImg,
        'brown'
      );

      const conceptObj = {
        title: specDraft.title,
        prompt: specDraft.prompt,
        modelType: specDraft.archetype,
        archetype: specDraft.archetype,
        dimensions: `Cao ${specDraft.height}cm × ĐK ${specDraft.maxRadius * 2}cm`,
        shapeParams: {
          height: specDraft.height,
          maxRadius: specDraft.maxRadius,
        },
        suggestedGlaze: {
          name: specDraft.glazeName,
          hex: specDraft.glazeHex,
          roughness: specDraft.roughness,
        },
        lathePoints,
        pattern: specDraft.pattern,
        patternImage: initialPatternImg,
        customText: specDraft.customText,
        rimStyle: 'brown',
        feasibility: {
          wallThickness: specDraft.wallThickness,
          shrinkage: specDraft.shrinkage,
          firingTemp: specDraft.firingTemp,
        },
        views: finalViews,
      };

      setConceptResult(conceptObj);
      setCreatorState('PREVIEW_READY');
      setActiveView('front');
      setViewportMode('3d');
      showToast(`Đã tạo thành công mô hình 3D "${specDraft.title}"!`, 'success');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi dựng 3D: ' + err.message);
      setCreatorState('AWAITING_CONFIRMATION');
    } finally {
      setIsLoading(false);
    }
  };

  // GIAI ĐOẠN 2: Khách duyệt ảnh 2D -> gọi trực tiếp Cloudflare Vision → concept parametric → spline
  const handleBuild3DFrom2D = async (imageUrl, promptText) => {
    setIsLoading(true);
    setLoadingMessage('Cloudflare Vision đang phân tích & sinh model 3D tham số...');
    setError(null);

    // Chuyển ảnh 2D sang dạng base64 để gửi Cloudflare Vision
    let imageBase64 = imageUrl || null;
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const imgRes = await fetch(imageUrl);
        const imgBlob = await imgRes.blob();
        imageBase64 = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(imgBlob);
        });
      } catch (convErr) {
        console.warn('Không chuyển đổi được imageUrl sang base64:', convErr);
      }
    }

    if (imageBase64) {
      // Gọi handleSpecimenFallback — Cloudflare Vision → shapeParams → Catmull-Rom spline
      try {
        await handleSpecimenFallback(imageBase64, promptText, null);
      } catch (fbErr) {
        console.warn('handleSpecimenFallback failed:', fbErr);
        setError('Phân tích ảnh sang 3D thất bại. Vui lòng thử lại.');
        showToast('Phân tích ảnh sang 3D thất bại. Vui lòng thử lại.', 'error');
      }
    } else {
      // Không có ảnh — dùng LLaMA text-to-concept
      setLoadingMessage('Cloudflare LLaMA đang sinh model 3D từ mô tả...');
      await handleGenerateAIFallback(promptText || 'Tiêu Bản Gốm Sứ');
    }
  };

  // Nạp ảnh phác thảo/chụp tay -> AI làm sạch & dựng 3D
  const handleUploadSketch = async (file) => {
    if (!file) return;
    setIsLoading(true);
    setLoadingMessage('Đang phân tích');
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const imageBase64 = reader.result;
          const promptText = prompt.trim() || file.name.replace(/\.[^/.]+$/, '');

          // Trực tiếp chuyển sang phân tích tham số LLaMA (bỏ qua HF ZeroGPU — luôn quota thấp)
          try {
            await handleSpecimenFallback(imageBase64, promptText, file);
          } catch (fbErr) {
            console.warn('Specimen fallback failed:', fbErr);
            const userMsg = 'Phân tích ảnh sang 3D thất bại. Vui lòng thử lại với ảnh rõ ràng hơn.';
            setError(userMsg);
            showToast(userMsg, 'error');
          }
        } catch (err) {
          setError(err.message);
          showToast(`Lỗi: ${err.message}`, 'error');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleSpecimenFallback = async (imageBase64, promptText, file) => {
    // Cloudflare Vision API không chấp nhận data URL → dùng LLaMA text API (prompt) + local analysis ảnh
    let aiConcept = null;
    try {
      const res = await fetch(`${aiApiBase}/api/ai/prompt-to-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      if (res.ok) {
        const jsonRes = await res.json();
        if (jsonRes.success) aiConcept = jsonRes;
      }
    } catch (netErr) {
      console.warn('API prompt-to-3d không khả dụng:', netErr);
    }

    if (!aiConcept) {
      aiConcept = parsePromptToConcept(promptText);
    }

    const frontPhoto = imageBase64;
    let finalGlazeHex = aiConcept?.suggestedGlaze?.hex || '#EDE8DC';
    let finalGlazeName = aiConcept?.suggestedGlaze?.name || 'Men Gốm Nghệ Thuật';
    let finalRoughness = aiConcept?.suggestedGlaze?.roughness || 0.16;
    let finalRimStyle = 'brown';
    let finalPattern = aiConcept?.pattern || 'none';
    let finalPatternImage = null;

    try {
      const analysis = await analyzeAndDeconstructSpecimen(frontPhoto);
      if (analysis && analysis.success) {
        // Luôn dùng local analysis cho glaze/pattern — LLaMA text không thấy được ảnh thực
        finalGlazeHex = analysis.glazeColor || finalGlazeHex;
        finalGlazeName = analysis.glazeName || finalGlazeName;
        finalRoughness = analysis.glazeRoughness || finalRoughness;
        finalRimStyle = analysis.rimStyle || finalRimStyle;
        if (!aiConcept?.pattern || aiConcept.pattern === 'none') {
          finalPattern = analysis.pattern || finalPattern;
        }
        finalPatternImage = analysis.patternImage || finalPatternImage;
      }
    } catch (aErr) {
      console.warn('Lỗi phân tích tiêu bản tự động:', aErr);
    }

    let inferredModelType = aiConcept?.modelType || aiConcept?.archetype || null;
    let cleanLathePoints = aiConcept?.lathePoints || null;

    // Parametric synthesis: generate lathePoints from shapeParams if LLaMA returned none
    if (!cleanLathePoints && aiConcept?.shapeParams) {
      cleanLathePoints = paramsToLathePoints({ archetype: inferredModelType || 'vase', ...aiConcept.shapeParams });
    }

    // Cross-check model type with silhouette analysis từ ảnh thực (ground truth)
    try {
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        imgEl.onload = resolve;
        imgEl.onerror = resolve;
        imgEl.src = frontPhoto;
      });

      if (imgEl.width > 0 && imgEl.height > 0) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 128;
        offCanvas.height = 128;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(imgEl, 0, 0, 128, 128);
        const maskData = extractSilhouetteMaskFromCanvas(offCanvas);

        if (!maskData.isEmpty) {
          const { minX, maxX, minY, maxY } = maskData.bbox;
          const aspect = (maxY - minY) / Math.max(1, maxX - minX);
          let silhouetteType;
          if (aspect < 0.45) silhouetteType = 'plate';
          else if (aspect < 0.85) silhouetteType = 'bowl';
          else if (aspect < 1.35) silhouetteType = 'mug';
          else silhouetteType = 'vase';

          // Ưu tiên silhouette (ảnh thực) nếu LLaMA chưa có modelType hoặc trùng khớp prompt
          if (!inferredModelType || promptText.toLowerCase().includes('ảnh')) {
            inferredModelType = silhouetteType;
          }
        }
      }
    } catch (mErr) {
      console.warn('Lỗi phân tích tỷ lệ phôi:', mErr);
    }
    if (!inferredModelType) inferredModelType = 'bowl';

    if (finalPatternImage) {
      try {
        finalPatternImage = await sketchPatternImage(finalPatternImage);
      } catch (sErr) {
        console.warn('Phác thảo họa tiết thất bại:', sErr);
      }
      await preloadImage(finalPatternImage, true);
    }

    const finalViews = generateOrthographicViews(
      frontPhoto,
      inferredModelType,
      finalGlazeHex,
      finalRoughness,
      cleanLathePoints,
      finalPattern,
      '',
      finalGlazeName,
      finalPatternImage,
      finalRimStyle
    );

    setConceptResult({
      title: aiConcept?.title || promptText || 'Tiêu Bản Gốm Sứ',
      modelType: inferredModelType,
      lathePoints: cleanLathePoints,
      suggestedGlaze: {
        hex: finalGlazeHex,
        name: finalGlazeName,
        roughness: finalRoughness,
      },
      dimensions: aiConcept?.dimensions || (inferredModelType === 'plate' ? 'Ø24cm x H3cm' : 'Ø12cm x H9cm'),
      feasibility: { wallThickness: '5.2mm', shrinkage: '9.2%' },
      pattern: finalPattern,
      patternImage: finalPatternImage,
      rimStyle: finalRimStyle,
      views: finalViews,
    });

    setActiveView('front');
    setViewportMode('3d');
    showToast('Đã nhận diện tiêu bản & đúc khuôn 3D chuẩn xác!', 'success');
  };

  // Tải trọn bộ hồ sơ 3D (.GLB/.OBJ) và 6 ảnh chiếu (.ZIP)
  const handleDownloadPackage = async () => {
    if (!conceptResult) return;
    setIsExporting(true);
    showToast('Đang trích xuất mô hình 3D và đóng gói 6 ảnh chiếu...', 'info');
    try {
      await downloadCeramicPackage({
        title: conceptResult.title || 'Gom_3D_Co_Creator',
        modelType: conceptResult.modelType || 'bowl',
        lathePoints: conceptResult.lathePoints,
        suggestedGlaze: conceptResult.suggestedGlaze,
        rimStyle: conceptResult.rimStyle || 'brown',
        pattern: conceptResult.pattern || 'none',
        patternImage: conceptResult.patternImage || null,
        customText: conceptResult.customText || '',
        views: conceptResult.views || [],
        dimensions: conceptResult.dimensions || '',
        feasibility: conceptResult.feasibility || null,
        glbFileUrl: conceptResult.glbFileUrl || null,
      });
      showToast('Đã tải xuống thành công trọn bộ file 3D & 6 ảnh chiếu!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tải gói file: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Duyệt bản vẽ & chuyển sang Studio chính
  const handleProceed = () => {
    if (!conceptResult) return;

    // Parametric synthesis: ensure lathePoints exist from shapeParams if missing
    let finalLathePoints = conceptResult.lathePoints;
    if (!finalLathePoints && conceptResult.shapeParams) {
      finalLathePoints = paramsToLathePoints({
        archetype: conceptResult.archetype || conceptResult.modelType,
        ...conceptResult.shapeParams,
      });
    }

    if (conceptResult.glbFileUrl && setCustomGlbUrl) {
      setCustomGlbUrl(conceptResult.glbFileUrl);
    }
    if (conceptResult.modelType) setModelType(conceptResult.modelType);
    if (finalLathePoints) {
      setCustomLathePoints(finalLathePoints);
    } else {
      setCustomLathePoints(null);
    }
    if (conceptResult.suggestedGlaze) {
      setGlazeColor(conceptResult.suggestedGlaze.hex);
      setGlazeName(conceptResult.suggestedGlaze.name);
      setGlazeRoughness(conceptResult.suggestedGlaze.roughness || 0.16);
    }
    if (conceptResult.pattern) setPattern(conceptResult.pattern);
    if (conceptResult.patternImage) {
      setPatternImage(conceptResult.patternImage);
    } else {
      setPatternImage(null);
    }
    if (conceptResult.prompt) setCustomText(conceptResult.prompt.slice(0, 18));
    setActiveTab('studio-3d');
    showToast('Đang đưa tác phẩm vào Xưởng Gốm 3D...');
  };

  // ── Đặt lịch ngắm mẫu tại xưởng (giống nút "Đặt lịch" trên ProductCard) ──
  // Đóng gói concept đang xem (tiêu đề, dáng, ảnh view đầu tiên) thành "mẫu đã chọn"
  // rồi chuyển thẳng sang form đặt lịch. KHÔNG gọi selectProductForDesign
  // để không reset lathePoints/pattern của bản phác thảo.
  const handleScheduleVisit = () => {
    if (!conceptResult) return;
    const firstViewImg =
      (conceptResult.views || []).find((v) => v.id === 'front')?.previewImg ||
      conceptResult.views?.[0]?.previewImg ||
      conceptResult.cleanedImage ||
      undefined;
    const scheduleProduct = selectedProduct?.id === `concept-${conceptResult.id || 'draft'}` && selectedProduct
      ? selectedProduct
      : {
          id: `concept-${conceptResult.id || 'draft'}`,
          name: conceptResult.title || prompt.trim() || 'Phác thảo mẫu AI',
          type: conceptResult.modelType || 'vase',
          modelType: conceptResult.modelType || 'vase',
          image: firstViewImg,
          price: conceptResult.price || currentPrice,
        };
    setSelectedProduct(scheduleProduct);
    if (scheduleProduct.type) setModelType(scheduleProduct.type);
    setActiveTab('schedule');
    showToast(`Đã đưa "${scheduleProduct.name}" vào lịch đặt lịch ngắm mẫu!`);
  };

  const currentViewObj = (conceptResult?.views || []).find((v) => v.id === activeView) || conceptResult?.views?.[0];

  return (
    <div className="w-full h-full overflow-hidden bg-ceramic-paper flex flex-col">
      {/* ────────────────────────────────────────────────────────
          TRẠNG THÁI 1: Giao diện AI Tư vấn ở màn hình khởi đầu
          ──────────────────────────────────────────────────────── */}
      {!conceptResult && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-4xl mx-auto w-full space-y-8 animate-fade-in">
          {/* Logo & Headline */}
          <div className="text-center space-y-3">
            <br></br>
            <br></br>
            <br></br>
            <h1 className="font-editorial text-4xl md:text-5xl lg:text-6xl font-bold text-ceramic-charcoal tracking-tight">
              Phác thảo ý tưởng của bạn
            </h1>
            <br></br>
            <br></br>
            <br></br>

          </div>

          {/* NẾU ĐÃ CÓ ẢNH 2D (BƯỚC 1.5): Xem ảnh 2D và bấm Dựng 3D */}
          {stage2D && !isLoading && (
            <div className="w-full max-w-md bg-ceramic-paper rounded-3xl border border-ceramic-border p-5 shadow-card space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ceramic-terracotta bg-ceramic-cream px-3 py-1 rounded-full border border-ceramic-border">
                  BƯỚC 1: Ý TƯỞNG (Cloudflare LLaMA)
                </span>
                <button
                  type="button"
                  onClick={() => setStage2D(null)}
                  className="text-xs text-ceramic-slate hover:text-ceramic-charcoal font-mono"
                >
                  ✕ Đổi mô tả
                </button>
              </div>

              <div className="aspect-square w-full rounded-2xl overflow-hidden bg-ceramic-paper border border-ceramic-border flex items-center justify-center relative shadow-inner">
                <img
                  src={stage2D.imageUrl}
                  alt={stage2D.prompt}
                  className="w-full h-full object-contain filter drop-shadow-paper"
                />
              </div>

              <p className="text-sm font-body text-ceramic-charcoal italic text-center px-2 truncate">
                "{stage2D.prompt}"
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setStage2D(null)}
                >
                  Vẽ lại ảnh khác
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleBuild3DFrom2D(stage2D.imageUrl, stage2D.prompt)}
                  className="bg-ceramic-terracotta text-ceramic-paper font-semibold"
                >
                  Dựng thành 3D →
                </Button>
              </div>
            </div>
          )}

          {/* NẾU ĐANG CHỜ XÁC NHẬN ĐẶC TẢ: Hiển thị Thẻ Review Đặc Tả Kỹ Thuật */}
          {specDraft && (creatorState === 'AWAITING_CONFIRMATION' || creatorState === 'EDITING_SPEC') && !isLoading && (
            <div className="w-full max-w-xl bg-ceramic-paper rounded-3xl border border-ceramic-border p-6 shadow-card space-y-5 animate-scale-in">
              <div className="flex items-center justify-between border-b border-ceramic-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-ceramic-terracotta animate-pulse" />
                  <h3 className="font-editorial text-lg font-bold text-ceramic-charcoal">
                    Bản Đặc Tả Thiết Kế Trước Khi Tạo 3D
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSpecDraft(null);
                    setCreatorState('IDLE');
                  }}
                  className="text-xs font-mono text-ceramic-slate hover:text-ceramic-charcoal cursor-pointer"
                >
                  ✕ Hủy & Nhập lại
                </button>
              </div>

              <p className="text-xs text-ceramic-slate leading-relaxed">
                Dựa trên ý tưởng: <strong className="text-ceramic-charcoal font-semibold">"{specDraft.prompt}"</strong>, AI đã tổng hợp các thông số kỹ thuật chế tác sau:
              </p>

              {/* Thông số chi tiết */}
              <div className="space-y-3.5 text-xs font-mono bg-ceramic-cream/50 p-4 rounded-2xl border border-ceramic-border">
                {/* 1. Dáng sản phẩm */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-ceramic-slate">
                    <span>1. LOẠI SẢN PHẨM:</span>
                    <span className="font-bold text-ceramic-charcoal uppercase">{specDraft.archetype}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'vase', label: 'Bình hoa' },
                      { id: 'mug', label: 'Cốc gốm' },
                      { id: 'bowl', label: 'Bát thiền' },
                      { id: 'plate', label: 'Đĩa mộc' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSpecDraft(prev => ({ ...prev, archetype: item.id }))}
                        className={`px-3 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                          specDraft.archetype === item.id
                            ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold'
                            : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-charcoal'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Chiều cao & Đường kính */}
                <div className="space-y-1.5 pt-2 border-t border-ceramic-border/50">
                  <div className="flex justify-between items-center text-ceramic-slate">
                    <span>2. CHIỀU CAO THIẾT KẾ:</span>
                    <span className="font-bold text-ceramic-terracotta">{specDraft.height} cm</span>
                  </div>
                  <div className="flex gap-2">
                    {[18, 22, 25, 30].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSpecDraft(prev => ({ ...prev, height: h }))}
                        className={`flex-1 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                          specDraft.height === h
                            ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold'
                            : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-charcoal'
                        }`}
                      >
                        {h} cm
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Màu men truyền thống */}
                <div className="space-y-1.5 pt-2 border-t border-ceramic-border/50">
                  <div className="flex justify-between items-center text-ceramic-slate">
                    <span>3. MEN GỐM NUNG LÒ RỒNG:</span>
                    <span className="font-bold text-ceramic-charcoal truncate max-w-[180px]">{specDraft.glazeName}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Men Xanh Đồng Trổ (Vert de Biên Hòa)', hex: '#2A6B5C', label: 'Xanh đồng' },
                      { name: 'Men Đá Đỏ Bazan Bửu Long', hex: '#9E472A', label: 'Đá đỏ' },
                      { name: 'Men Vàng Hoàng Yến', hex: '#C88A2E', label: 'Vàng hổ phách' },
                      { name: 'Men Trắng Rạn Phù Sa', hex: '#DCD3C1', label: 'Trắng rạn' },
                    ].map((g) => (
                      <button
                        key={g.hex}
                        type="button"
                        onClick={() => setSpecDraft(prev => ({ ...prev, glazeName: g.name, glazeHex: g.hex }))}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                          specDraft.glazeHex === g.hex
                            ? 'bg-ceramic-charcoal text-ceramic-paper border-ceramic-charcoal font-semibold shadow-paper'
                            : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-charcoal'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full inline-block border border-ceramic-border" style={{ backgroundColor: g.hex }} />
                        <span>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Họa tiết khắc chìm */}
                <div className="space-y-1.5 pt-2 border-t border-ceramic-border/50">
                  <div className="flex justify-between items-center text-ceramic-slate">
                    <span>4. HỌA TIẾT CHẾ TÁC:</span>
                    <span className="font-bold text-ceramic-charcoal">{specDraft.pattern || 'Hoa cúc dây'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'cuc_day', label: 'Hoa cúc dây 1925' },
                      { id: 'sen_co', label: 'Hoa sen cổ' },
                      { id: 'dong_son', label: 'Trống đồng' },
                      { id: 'none', label: 'Gốm trơn mộc' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSpecDraft(prev => ({ ...prev, pattern: p.id }))}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                          specDraft.pattern === p.id
                            ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold'
                            : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-charcoal'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Tiêu chuẩn xưởng Tân Vạn */}
                <div className="pt-2 border-t border-ceramic-border/50 grid grid-cols-2 gap-2 text-[10.5px] text-ceramic-slate">
                  <div>Thành gốm: <strong className="text-ceramic-charcoal">{specDraft.wallThickness}</strong></div>
                  <div>Độ co ngót bù trừ: <strong className="text-ceramic-terracotta">{specDraft.shrinkage}</strong></div>
                  <div className="col-span-2">Nhiệt độ nung: <strong className="text-ceramic-charcoal">{specDraft.firingTemp}</strong></div>
                </div>
              </div>

              {/* XÁC NHẬN - CHỈ BẤM NÚT NÀY MỚI SINH 3D */}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-body text-ceramic-charcoal text-center italic">
                  "Bạn có muốn tôi tạo mô hình 3D theo thông số này không?"
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setSpecDraft(null);
                      setCreatorState('IDLE');
                    }}
                  >
                    ✕ Hủy bỏ
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleConfirmAndGenerate}
                    className="bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper font-semibold shadow-paper"
                  >
                    ✓ Tạo mô hình 3D ngay
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Ô Chat Trung Tâm khi ở trạng thái IDLE */}
          {!stage2D && !specDraft && !isLoading && (
            <div className="w-full max-w-2xl bg-ceramic-paper rounded-3xl border border-ceramic-border shadow-card hover:shadow-card focus-within:shadow-card focus-within:border-ceramic-terracotta transition-all p-3 md:p-4">
              <div className="flex items-center gap-3">
                {/* Nút Upload file ảnh mẫu */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadSketch(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Tải ảnh phác thảo hoặc mẫu chụp lên"
                  className="w-10 h-10 rounded-full bg-ceramic-cream hover:bg-ceramic-border/60 text-ceramic-charcoal flex items-center justify-center transition-all flex-shrink-0 text-lg font-bold cursor-pointer"
                >
                  +
                </button>

                {/* Input Chat */}
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePreparePromptSpec()}
                  placeholder="Nhập mô tả ý tưởng (VD: một chiếc bình gốm Biên Hòa cao 25cm men xanh đồng)..."
                  maxLength={200}
                  className="flex-1 text-sm md:text-base bg-transparent border-none outline-none text-ceramic-charcoal placeholder-ceramic-slate/70 font-body px-1"
                  aria-label="Nhập mô tả ý tưởng gốm sứ"
                />

                {/* Nút Submit Tạo hình */}
                <button
                  type="button"
                  disabled={isLoading || !prompt.trim()}
                  onClick={() => handlePreparePromptSpec()}
                  className={`
                    h-10 px-5 rounded-2xl text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 flex-shrink-0
                    ${prompt.trim()
                      ? 'bg-ceramic-terracotta text-ceramic-paper hover:bg-ceramic-charcoal shadow-paper cursor-pointer'
                      : 'bg-ceramic-cream text-ceramic-slate/60 cursor-not-allowed'
                    }
                  `}
                >
                  <span>Xem thông số →</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator Kể Chuyện Làng Nghề */}
          {isLoading && (
            <div className="py-8 px-6 bg-ceramic-paper rounded-3xl border border-ceramic-border max-w-md w-full text-center space-y-4 shadow-paper animate-fade-in">
              <div className="w-12 h-12 text-ceramic-terracotta mx-auto animate-spin border-3 border-ceramic-terracotta border-t-transparent rounded-full" />
              <div className="space-y-1.5">
                <div className="font-editorial text-lg font-bold text-ceramic-charcoal">
                  {loadingMessage}
                </div>
                <div className="font-mono text-xs text-ceramic-slate">
                  Đang xử lý: {elapsedSeconds}s (Có thể mất 20s - 45s khi xếp hàng)
                </div>
              </div>
              <div className="w-full bg-ceramic-paper h-2 rounded-full overflow-hidden border border-ceramic-border">
                <div
                  className="bg-ceramic-terracotta h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(95, elapsedSeconds * 2.5 + 10)}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-ceramic-cream/30 border border-ceramic-border text-xs font-mono text-ceramic-charcoal rounded-lg max-w-md">
              <span className="font-bold">Lỗi: </span> {error}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          TRẠNG THÁI 2: Bản vẽ & Không gian 3D tương tác (Kết quả)
          ──────────────────────────────────────────────────────── */}
      {conceptResult && (
        <div className="px-6 md:px-8 py-3 space-y-2 animate-fade-in flex-1 flex flex-col overflow-hidden">
          {/* Top Search Bar (Cho phép gõ lại / tải ảnh mới mà không mất giao diện) */}
          <div className="flex flex-col md:flex-row gap-3 items-center pb-2">
            <button
              type="button"
              onClick={() => setConceptResult(null)}
              className="text-xs font-mono text-ceramic-slate hover:text-ceramic-terracotta transition-colors flex items-center gap-1 self-start md:self-auto py-2"
            >
              ← Tạo mẫu mới
            </button>
            <div className="flex-1 relative w-full">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePreparePromptSpec()}
                placeholder="Nhập mô tả ý tưởng khác..."
                className="w-full text-sm px-4 py-3 bg-ceramic-paper border border-ceramic-border rounded-xl focus:outline-none focus:border-ceramic-terracotta text-ceramic-charcoal placeholder-ceramic-slate font-body"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadSketch(file);
                }}
              />
              <Button
                variant="secondary"
                size="md"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-4 text-xs"
              >
                Tải ảnh khác
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isLoading || !prompt.trim()}
                onClick={() => handlePreparePromptSpec()}
                className="py-2.5 px-4 text-xs bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper"
              >
                {isLoading ? 'Đang tạo...' : 'Xem thông số mới →'}
              </Button>
            </div>
          </div>

          {/* Thông Tin Bản Vẽ Kỹ Nghệ Chuẩn Xác */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-ceramic-border/60 pb-3">
            {/* Khối bên trái: Ảnh + (Tiêu đề & Nút 3D/2D ngang hàng + Thông số) */}
            <div className="flex items-center gap-3 min-w-0">
              {conceptResult.cleanedImage && (
                <div className="w-12 h-12 border border-ceramic-border p-1 bg-ceramic-paper rounded-lg flex-shrink-0 flex items-center justify-center shadow-paper" title="Ảnh mẫu đối chiếu">
                  <img src={conceptResult.cleanedImage} alt="Ảnh mẫu" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="space-y-1.5 min-w-0 w-fit max-w-full">
                {/* Phần chữ tiêu đề và nút 3D/2D ngang hàng nhau, mép phải dóng thẳng với CO NGÓT */}
                <div className="flex items-center justify-between gap-3 flex-wrap w-full">
                  <h2 className="font-editorial text-xl md:text-2xl font-bold text-ceramic-charcoal leading-tight">
                    {conceptResult.title}
                  </h2>
                  {/* Toggle 3D Turntable / Ảnh Chiếu 2D */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setViewportMode('3d')}
                      className={`
                        px-3 py-1 rounded-xl text-xs transition-all font-mono flex items-center gap-1.5 border
                        ${viewportMode === '3d'
                          ? 'bg-ceramic-cream border border-ceramic-terracotta text-ceramic-terracotta font-semibold'
                          : 'bg-ceramic-paper text-ceramic-charcoal border-ceramic-border hover:border-ceramic-terracotta'
                        }
                      `}
                    >
                      <span>Mô hình 3D</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportMode('2d')}
                      className={`
                        px-3 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all border
                        ${viewportMode === '2d'
                          ? 'bg-ceramic-cream border border-ceramic-terracotta text-ceramic-terracotta font-semibold'
                          : 'bg-ceramic-paper text-ceramic-charcoal border-ceramic-border hover:border-ceramic-charcoal'
                        }
                      `}
                    >
                      <span>Ảnh Chiếu 2D</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-ceramic-slate flex-wrap">
                  <span className="bg-ceramic-cream px-2 py-0.5 border border-ceramic-border text-ceramic-charcoal rounded">
                    DÁNG GỐM: <strong className="uppercase text-ceramic-terracotta">{conceptResult.modelType}</strong>
                  </span>
                  <span className="bg-ceramic-cream px-2 py-0.5 border border-ceramic-border text-ceramic-charcoal rounded">
                    QUY CÁCH: <strong className="uppercase text-ceramic-terracotta">{conceptResult.dimensions}</strong>
                  </span>
                  <span className="bg-ceramic-cream px-2 py-0.5 border border-ceramic-border text-ceramic-charcoal rounded">
                    ĐỘ DÀY: <strong className="uppercase text-ceramic-terracotta">{conceptResult.feasibility?.wallThickness || '5.5mm'}</strong>
                  </span>
                  <span className="bg-ceramic-cream px-2 py-0.5 border border-ceramic-border text-ceramic-charcoal rounded">
                    CO NGÓT: <strong className="uppercase text-ceramic-terracotta">{conceptResult.feasibility?.shrinkage || '9.5%'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Nút Thao Tác (Bên phải - xếp dọc) */}
            <div className="flex flex-col gap-1.5 flex-shrink-0 items-stretch sm:items-end">
              <button
                type="button"
                onClick={handleDownloadPackage}
                disabled={isExporting}
                className={`
                  w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-mono flex items-center justify-center gap-1.5 transition-all border
                  bg-ceramic-paper text-ceramic-charcoal border-ceramic-border hover:border-ceramic-charcoal disabled:opacity-50
                `}
              >
                <span>{isExporting ? 'Đang Đóng Gói...' : 'Tải File 3D & 6 Ảnh'}</span>
              </button>
              <button
                type="button"
                onClick={handleProceed}
                className={`
                  w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-mono flex items-center justify-center gap-1.5 transition-all border
                  bg-ceramic-cream border-ceramic-terracotta text-ceramic-terracotta font-semibold hover:bg-ceramic-terracotta hover:text-ceramic-paper
                `}
              >
                <span>Chuyển vào Studio→</span>
              </button>
              <button
                type="button"
                onClick={handleScheduleVisit}
                title="Đặt lịch ngắm mẫu gốm trực tiếp tại xưởng — hệ thống sẽ chuyển đến trang đặt lịch"
                className={`
                  w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-mono flex items-center justify-center gap-1.5 transition-all border active:scale-95
                  bg-ceramic-paper border-ceramic-terracotta text-ceramic-terracotta hover:bg-ceramic-terracotta hover:text-ceramic-paper
                `}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 9h12m-6 6h.01M9 18a3 3 0 100-6 3 3 0 000 6zm6 0a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                <span>Đặt lịch ngắm mẫu</span>
              </button>
            </div>
          </div>

          {/* Khung Hiển Thị Chính: 3D Turntable & Thumbnail 6 Mặt */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
            {/* Cột Trái (7 cols): Viewport 3D hoặc Bản vẽ 2D */}
            <div className="lg:col-span-7 border border-ceramic-border bg-ceramic-paper rounded-2xl p-4 relative flex flex-col items-center justify-center min-h-[360px] h-full bg-[radial-gradient(#d6d3cd_1px,transparent_1px)] [background-size:16px_16px]">


              {viewportMode === '3d' ? (
                <div className="w-full h-full min-h-[300px] relative">
                  <CeramicCanvas3D
                    glbUrl={conceptResult.glbFileUrl || null}
                    onModelLoaded={handleModelLoaded}
                    modelType={conceptResult.modelType || 'bowl'}
                    glazeColor={conceptResult.suggestedGlaze?.hex || '#2A6B5C'}
                    glazeRoughness={conceptResult.suggestedGlaze?.roughness || 0.16}
                    glazeName={conceptResult.suggestedGlaze?.name || 'Men Gốm Nghệ Thuật'}
                    pattern={conceptResult.pattern || 'none'}
                    patternImage={conceptResult.patternImage || null}
                    rimStyle={conceptResult.rimStyle || 'brown'}
                    customLathePoints={conceptResult.lathePoints}
                    showControls={false}
                  />
                </div>
              ) : (
                <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center relative">
                  {currentViewObj?.previewImg ? (
                    <img
                      src={currentViewObj.previewImg}
                      alt={currentViewObj.name}
                      className="max-w-full max-h-full object-contain filter drop-shadow-card transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono text-xs text-ceramic-slate">
                      Chưa có ảnh
                    </div>
                  )}

                  {/* Lưới định vị tọa độ kỹ thuật */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-full h-px border-t border-dashed border-ceramic-border/40" />
                  </div>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="h-full w-px border-l border-dashed border-ceramic-border/40" />
                  </div>
                </div>
              )}
            </div>

            {/* Cột Phải (5 cols): Lưới 6 góc trực giao */}
            <div className="lg:col-span-5 p-4 bg-ceramic-paper border border-ceramic-border rounded-2xl flex flex-col justify-center h-full min-h-[360px]">
              <div className="grid grid-cols-3 gap-2.5">
                {(conceptResult.views || []).map((v) => {
                  const isSel = activeView === v.id && viewportMode === '2d';
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        setActiveView(v.id);
                        setViewportMode('2d');
                      }}
                      className={`
                        border p-2 cursor-pointer transition-all rounded-xl text-center space-y-1.5
                        ${isSel
                          ? 'border-ceramic-terracotta ring-2 ring-ceramic-terracotta bg-ceramic-cream shadow-paper'
                          : 'border-ceramic-border bg-ceramic-paper hover:border-ceramic-charcoal'
                        }
                      `}
                    >
                      <div className="aspect-square w-full flex items-center justify-center overflow-hidden bg-ceramic-paper rounded-lg p-1">
                        {v.previewImg ? (
                          <img
                            src={v.previewImg}
                            alt={v.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="font-mono text-[9px] text-ceramic-slate">VIEW</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-ceramic-terracotta font-semibold block leading-tight">
                          {v.code}
                        </span>
                        <div className="text-[10px] font-mono font-medium text-ceramic-charcoal leading-tight truncate mt-0.5">
                          {v.shortName || v.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
