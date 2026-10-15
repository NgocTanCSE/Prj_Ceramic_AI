import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createCeramicTextureCanvas, createDecalCanvases, computeDecalPlacement,
  getDefaultModelProfile, getDefaultLatheProfile, imageCache,
} from '../utils/ceramicTextureGenerator';
import { createCeramicGeometry, createMugHandleGeometry } from '../utils/orthographicRenderer';
import { renderFidelityScore } from '../utils/renderFidelity';
import { createRadialShadowCanvas, createContactShadowCanvas } from '../utils/shadowCanvas';

// Studio backdrop colour (warm paper). Kept as {r,g,b} (0-255) so the scene
// background can be built from separate channels — passing a single float to
// THREE.Color is misread as a hex code (0x000000 = black).
const STUDIO_BG = { r: 0xf4, g: 0xf1, b: 0xea };

// Small outward offset (world units) applied along a placement normal so decals
// sit just above the ceramic surface and avoid z-fighting.
const DECAL_NUDGE = 0.006;
import { useDesign } from '../contexts/DesignContext';

export default function CeramicCanvas3D({
  glbUrl = null,
  onModelLoaded = null,
  modelType = 'bowl',
  glazeColor = '#2A6B5C',
  glazeRoughness = 0.18,
  glazeName = 'Men Xanh Đồng Trổ',
  pattern = 'none',
  patternImage = null,
  patternTransform = null,
  onPatternTransformChange,
  rimStyle = 'brown',
  customText = '',
  textTransform = null,
  onTextTransformChange,
  customLathePoints = null,
  showControls = false,
  showInteractionPill = true,
  interactionMode = null,
  onInteractionModeChange,
  onSnapshotCapture,
  sourceImage = null,
  onFidelityScore = null,
  customGeometry = null,
}) {
  let design = null;
  try {
    design = useDesign();
  } catch (err) {
    /* instantiated outside DesignProvider — optional context */
  }

  const effectiveInteractionMode = interactionMode || design?.interactionMode || 'orbit';
  const setEffectivePatternTransform = onPatternTransformChange || design?.setPatternTransform;
  const setEffectiveTextTransform = onTextTransformChange || design?.setTextTransform;
  const setEffectiveInteractionMode = onInteractionModeChange || design?.setInteractionMode;

  const [isRotating, setIsRotating] = useState(true);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [zoomLevel, _setZoomLevel] = useState(100);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const ceramicMeshRef = useRef(null);
  const handleMeshRef = useRef(null);
  const shadowMeshRef = useRef(null);
  const contactMeshRef = useRef(null);
  const textureMapRef = useRef(null);
  const textureCanvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const activeDragTypeRef = useRef(null);
  const rotationGroupRef = useRef(null);
  const autoRotateRef = useRef(true);
  const isAltPressedRef = useRef(false);
  const decalMeshesRef = useRef([]);
  const shiftYRef = useRef(0);

  // Synced refs for event handlers (tránh stale closure)
  const interactionModeRef = useRef(effectiveInteractionMode);
  useEffect(() => { interactionModeRef.current = effectiveInteractionMode; }, [effectiveInteractionMode]);

  const patternRef = useRef(pattern);
  useEffect(() => { patternRef.current = pattern; }, [pattern]);

  const patternImageRef = useRef(patternImage);
  useEffect(() => {
    patternImageRef.current = patternImage;
  }, [patternImage]);

  const patternTransformRef = useRef(patternTransform);
  useEffect(() => { patternTransformRef.current = patternTransform; }, [patternTransform]);

  const textTransformRef = useRef(textTransform);
  useEffect(() => { textTransformRef.current = textTransform; }, [textTransform]);

  const customTextRef = useRef(customText);
  useEffect(() => { customTextRef.current = customText; }, [customText]);

  const setPatternTransformRef = useRef(setEffectivePatternTransform);
  useEffect(() => { setPatternTransformRef.current = setEffectivePatternTransform; }, [setEffectivePatternTransform]);

  const setTextTransformRef = useRef(setEffectiveTextTransform);
  useEffect(() => { setTextTransformRef.current = setEffectiveTextTransform; }, [setEffectiveTextTransform]);

  const buildProfile = () => customLathePoints || getDefaultModelProfile(modelType);

  // ── 1. Texture kem CƠ SỞ (glaze + rim + speckle) — thân đối xứng, không seam ──
  //    Họa tiết & chữ được tách thành DecalGeometry (xem rebuildDecals) → thay thế cylindrical UV.
  const updateTextureFast = useCallback((currentPatTransform, currentTxtTransform) => {
    const canvas = createCeramicTextureCanvas({
      glazeColor,
      glazeName,
      pattern: 'none',           // body chỉ có kem base
      customText: '',            // chữ dán qua decal
      rimStyle,
      modelType,
      width: 1024,
      height: 1024,
      latheProfile: customLathePoints,
      onImageLoaded: () => {
        if (textureMapRef.current) updateTextureFast(currentPatTransform, currentTxtTransform);
      },
    });
    textureCanvasRef.current = canvas;

    if (!textureMapRef.current) {
      textureMapRef.current = new THREE.CanvasTexture(canvas);
      textureMapRef.current.wrapS = THREE.RepeatWrapping;
      textureMapRef.current.wrapT = THREE.ClampToEdgeWrapping;
    } else {
      textureMapRef.current.image = canvas;
      textureMapRef.current.needsUpdate = true;
    }
    return textureMapRef.current;
  }, [glazeColor, glazeName, modelType, rimStyle, customLathePoints]);

  // ── 2. Dựng lại decal (DecalGeometry) cho hoa văn / chữ trên thân gốm ──
  const rebuildDecals = useCallback(() => {
    if (decalMeshesRef.current) {
      for (const m of decalMeshesRef.current) {
        m.geometry && m.geometry.dispose();
        m.material && (Array.isArray(m.material) ? m.material.forEach((mm) => mm.dispose()) : m.material.dispose());
      }
    }
    decalMeshesRef.current = [];

    const body = ceramicMeshRef.current;
    if (!body) return;

    const profile = buildProfile();
    const decals = createDecalCanvases({
      glazeColor,
      glazeName,
      pattern: patternRef.current,
      patternImage: patternImageRef.current,
      patternTransform: patternTransformRef.current,
      rimStyle,
      customText: customTextRef.current,
      textTransform: textTransformRef.current,
      modelType,
      width: 1024,
      height: 1024,
      latheProfile: profile,
      onImageLoaded: (img) => {
        if (patternImageRef.current) imageCache.set(patternImageRef.current, img);
        rebuildDecals();
      },
    });

    for (const d of decals) {
      const pl = computeDecalPlacement(
        modelType, profile, d.cx, d.cy, 1024, 1024, d.footprintW, d.footprintH
      );
      // Tính position trong local của mesh (rotateY(PI) + shiftY đã áp dụng trên geometry)
      const pos = new THREE.Vector3(
        pl.position[0],
        pl.position[1] + shiftYRef.current,
        pl.position[2]
      );
      // lùi dọc theo normal để tránh z-fighting với thân gốm
      pos.addScaledVector(new THREE.Vector3(pl.normal[0], pl.normal[1], pl.normal[2]), DECAL_NUDGE);

      const ori = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(pl.normal[0], pl.normal[1], pl.normal[2])
      );
      const size = new THREE.Vector3(pl.size[0], pl.size[1], pl.size[2]);

      let dgeo;
      try {
        dgeo = new DecalGeometry(body, pos, ori, size);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('DecalGeometry lỗi:', e?.message);
        continue;
      }
      if (!dgeo.attributes.position.count) continue;

      const dtex = new THREE.CanvasTexture(d.canvas);
      dtex.wrapS = THREE.ClampToEdgeWrapping;
      dtex.wrapT = THREE.ClampToEdgeWrapping;

      const dmat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffffff),
        map: dtex,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
        roughness: glazeRoughness,
        metalness: 0.05,
        clearcoat: 0.95,
        clearcoatRoughness: 0.08,
        reflectivity: 0.85,
        envMapIntensity: 1.2,
      });

      const dmesh = new THREE.Mesh(dgeo, dmat);
      body.add(dmesh); // con của body → thừa hưởng rotateY(PI) + shiftY + quay bàn xoay
      decalMeshesRef.current.push(dmesh);
    }
  }, [
    glazeColor, glazeRoughness, modelType, customLathePoints,
    glazeName, rimStyle,
  ]);

  // ── 3. Khởi tạo Three.js scene / renderer / ánh sáng / bóng / animation ──
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    // FIX (bug 1 — màn hình đen): THREE.Color(singleFloat) được thông dịch
    // như mã hex nguyên 0x000000 = đen tuyệt đối. Phải truyền 3 tham số r,g,b riêng biệt.
    scene.background = new THREE.Color(STUDIO_BG.r / 255, STUDIO_BG.g / 255, STUDIO_BG.b / 255);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 4.6);
    camera.lookAt(0, 0.05, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ánh sáng Studio chuyên nghiệp (đồng bộ StudioScreen)
    const ambientLight = new THREE.AmbientLight(0xfff5eb, 1.25);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(4, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xd4e5ff, 1.1);
    fillLight.position.set(-4, 3, -2);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffecd2, 1.3);
    rimLight.position.set(0, -3, -4);
    scene.add(rimLight);

    // Group xoay 360° (order YXZ để tránh khoá trục)
    const rotationGroup = new THREE.Group();
    rotationGroup.rotation.order = 'YXZ';
    scene.add(rotationGroup);
    rotationGroupRef.current = rotationGroup;

    // Bóng đổ nền + bóng tiếp xúc chân đế
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(createRadialShadowCanvas()),
      transparent: true, opacity: 0.65, depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.002;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    const contactGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const contactMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(createContactShadowCanvas()),
      transparent: true, opacity: 0.85, depthWrite: false,
    });
    const contactMesh = new THREE.Mesh(contactGeo, contactMat);
    contactMesh.rotation.x = -Math.PI / 2;
    contactMesh.position.y = -1.001;
    scene.add(contactMesh);
    contactMeshRef.current = contactMesh;

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const newWidth = entry ? entry.contentRect.width : container.clientWidth;
      const newHeight = entry ? entry.contentRect.height : container.clientHeight;
      if (newWidth <= 0 || newHeight <= 0) return;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

    // Animation
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (autoRotateRef.current && rotationGroupRef.current) {
        rotationGroupRef.current.rotation.y += 0.0035;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Mouse / touch / wheel / keyboard listeners (orbit + bề mặt drag)
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();

    const updateDecalFromPointer = (e, dragType, isMouseDownSnap = false) => {
      if (!rendererRef.current || !cameraRef.current || !ceramicMeshRef.current) return;
      const canvasEl = rendererRef.current.domElement;
      const rect = canvasEl.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      if (rotationGroupRef.current) rotationGroupRef.current.updateMatrixWorld(true);

      raycaster.setFromCamera(mouseNDC, cameraRef.current);
      const intersects = raycaster.intersectObject(ceramicMeshRef.current, true);

      if (intersects.length > 0 && intersects[0].uv) {
        const uv = intersects[0].uv;
        const newY = Math.max(0, Math.min(100, Math.round((1.0 - uv.y) * 100)));
        let newAngle = Math.round((uv.x - 0.5) * 360);
        if (newAngle > 180) newAngle -= 360;
        if (newAngle < -180) newAngle += 360;

        if (dragType === 'pattern') {
          const cur = patternTransformRef.current || { yPercent: 68, rotationAngle: 0, scale: 1.0, rotation: 0 };
          const next = { ...cur, rotationAngle: newAngle, yPercent: newY };
          patternTransformRef.current = next;
          updateTextureFast(next, textTransformRef.current);
          rebuildDecals();
          if (setPatternTransformRef.current) setPatternTransformRef.current(next);
        } else if (dragType === 'text') {
          const cur = textTransformRef.current || { yPercent: 82, rotationAngle: 0, fontSize: 44, placement: 'belly' };
          const next = { ...cur, rotationAngle: newAngle, yPercent: newY };
          textTransformRef.current = next;
          updateTextureFast(patternTransformRef.current, next);
          rebuildDecals();
          if (setTextTransformRef.current) setTextTransformRef.current(next);
        }
      } else if (!isMouseDownSnap) {
        const deltaX = clientX - previousMousePositionRef.current.x;
        const deltaY = clientY - previousMousePositionRef.current.y;
        const domWidth = rect.width || window.innerWidth || 800;
        const domHeight = rect.height || window.innerHeight || 800;
        if (dragType === 'pattern') {
          const cur = patternTransformRef.current || { yPercent: 68, rotationAngle: 0, scale: 1.0, rotation: 0 };
          const angleDelta = Math.round((deltaX / domWidth) * 360 * 1.1);
          let newAngle = cur.rotationAngle + angleDelta;
          if (newAngle > 180) newAngle -= 360;
          if (newAngle < -180) newAngle += 360;
          const yDelta = (deltaY / domHeight) * 100 * 0.9;
          const newY = Math.max(0, Math.min(100, Math.round(cur.yPercent + yDelta)));
          const next = { ...cur, rotationAngle: newAngle, yPercent: newY };
          patternTransformRef.current = next;
          updateTextureFast(next, textTransformRef.current);
          rebuildDecals();
          if (setPatternTransformRef.current) setPatternTransformRef.current(next);
        } else if (dragType === 'text') {
          const cur = textTransformRef.current || { yPercent: 82, rotationAngle: 0, fontSize: 44, placement: 'belly' };
          const angleDelta = Math.round((deltaX / domWidth) * 360 * 1.1);
          let newAngle = cur.rotationAngle + angleDelta;
          if (newAngle > 180) newAngle -= 360;
          if (newAngle < -180) newAngle += 360;
          const yDelta = (deltaY / domHeight) * 100 * 0.9;
          const newY = Math.max(0, Math.min(100, Math.round(cur.yPercent + yDelta)));
          const next = { ...cur, rotationAngle: newAngle, yPercent: newY };
          textTransformRef.current = next;
          updateTextureFast(patternTransformRef.current, next);
          rebuildDecals();
          if (setTextTransformRef.current) setTextTransformRef.current(next);
        }
      }
    };

    const handleMouseDown = (e) => {
      const isAlt = e.altKey || isAltPressedRef.current;
      const isDragPattern = interactionModeRef.current === 'drag-pattern';
      const isDragText = interactionModeRef.current === 'drag-text';
      let dragType = null;
      if (isDragText || (isAlt && customTextRef.current?.trim())) {
        dragType = 'text';
      } else if (isDragPattern || (isAlt && patternRef.current !== 'none')) {
        dragType = 'pattern';
      }
      isDraggingRef.current = true;
      activeDragTypeRef.current = dragType;
      autoRotateRef.current = false;
      setIsRotating(false);
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      if (dragType) {
        if (e.altKey) e.preventDefault();
        updateDecalFromPointer(e, dragType, true);
      }
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dragType = activeDragTypeRef.current;
      if (dragType === 'pattern' || dragType === 'text') {
        updateDecalFromPointer(e, dragType, false);
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (!rotationGroupRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      rotationGroupRef.current.rotation.y += deltaX * 0.008;
      rotationGroupRef.current.rotation.x = Math.max(
        -1.54, Math.min(1.54, rotationGroupRef.current.rotation.x + deltaY * 0.008)
      );
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      activeDragTypeRef.current = null;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const isDragText = interactionModeRef.current === 'drag-text';
      const isDragPattern = interactionModeRef.current === 'drag-pattern';
      let dragType = isDragText ? 'text' : (isDragPattern ? 'pattern' : null);
      isDraggingRef.current = true;
      activeDragTypeRef.current = dragType;
      autoRotateRef.current = false;
      setIsRotating(false);
      previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };
      if (dragType) updateDecalFromPointer(touch, dragType, true);
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dragType = activeDragTypeRef.current;
      if (dragType === 'pattern' || dragType === 'text') {
        updateDecalFromPointer(touch, dragType, false);
        previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };
        return;
      }
      if (!rotationGroupRef.current) return;
      const deltaX = touch.clientX - previousMousePositionRef.current.x;
      const deltaY = touch.clientY - previousMousePositionRef.current.y;
      previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };
      rotationGroupRef.current.rotation.y += deltaX * 0.008;
      rotationGroupRef.current.rotation.x = Math.max(
        -1.54, Math.min(1.54, rotationGroupRef.current.rotation.x + deltaY * 0.008)
      );
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      activeDragTypeRef.current = null;
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Alt') { isAltPressedRef.current = true; setIsAltPressed(true); }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Alt') { isAltPressedRef.current = false; setIsAltPressed(false); }
    };
    const handleBlur = () => {
      isAltPressedRef.current = false;
      setIsAltPressed(false);
      isDraggingRef.current = false;
      activeDragTypeRef.current = null;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const next = Math.max(1.2, Math.min(12, cameraRef.current.position.z - e.deltaY * 0.004));
      cameraRef.current.position.z = next;
      _setZoomLevel(Math.round((4.6 / next) * 100));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    domElement.addEventListener('touchend', handleTouchEnd);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // Chụp tiêu bản (double-click) → callback cho cha
    const handleDblClick = () => {
      if (!rendererRef.current) return;
      try {
        const url = rendererRef.current.domElement.toDataURL('image/png');
        onSnapshotCapture && onSnapshotCapture(url);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Snapshot thất bại:', e?.message);
      }
    };
    domElement.addEventListener('dblclick', handleDblClick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
      domElement.removeEventListener('touchend', handleTouchEnd);
      domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      domElement.removeEventListener('dblclick', handleDblClick);
      resizeObserver.disconnect();
      renderer.dispose();
    };
    // capture onSnapshotCapture by ref to avoid re-init on change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 4. Tái tạo hình học khi dáng phôi / lathePoints thay đổi ──
  useEffect(() => {
    if (!rotationGroupRef.current) return;

    // Dọn mesh cũ (kể cả decal con)
    while (rotationGroupRef.current.children.length > 0) {
      const child = rotationGroupRef.current.children[0];
      child.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            Array.isArray(obj.material)
              ? obj.material.forEach((m) => m.dispose())
              : obj.material.dispose();
          }
        }
      });
      rotationGroupRef.current.remove(child);
    }
    // Nếu có mô hình GLB tải về từ AI (Hugging Face SF3D / Trellis)
    if (glbUrl) {
      const loader = new GLTFLoader();
      loader.load(
        glbUrl,
        (gltf) => {
          if (!rotationGroupRef.current) return;
          const model = gltf.scene;

          // Căn giữa và chuẩn hóa scale của model
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 2.0 / maxDim : 1.0;
          model.scale.setScalar(scale);

          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          model.position.x = -scaledCenter.x;
          model.position.z = -scaledCenter.z;
          model.position.y = -scaledBox.min.y - 1.0; // Đặt đáy tiếp đất tại Y = -1.0

          // FIX: Áp dụng texture men gốm + glazeColor vào model GLB
          // (trước đây chỉ set DoubleSide + roughness → model hiển thị texture mặc định "vũ trụ")
          // Lưu ý: GLB từ SF3D có UV mapping riêng, không khớp với texture cylindrical.
          // Dùng color đơn (glazeColor) thay vì map texture để tránh texture bị méo.
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.geometry) {
                child.geometry.computeVertexNormals();
              }
              if (child.material) {
                // Thay thế material bằng MeshPhysicalMaterial có màu men gốm
                const oldRoughness = ('roughness' in child.material && child.material.roughness !== undefined)
                  ? child.material.roughness
                  : glazeRoughness;
                const newMat = new THREE.MeshPhysicalMaterial({
                  color: new THREE.Color(glazeColor),
                  roughness: Math.min(oldRoughness, glazeRoughness),
                  metalness: 0.0,
                  clearcoat: 0.3,
                  clearcoatRoughness: 0.4,
                  envMapIntensity: 0.2,
                  side: THREE.DoubleSide,
                });
                child.material.dispose();
                child.material = newMat;
              }
            }
          });

          rotationGroupRef.current.add(model);

          // FIX: Tìm mesh cụ thể (không phải Group) để rebuildDecals có thể dùng DecalGeometry
          let targetMesh = null;
          model.traverse((child) => {
            if (child.isMesh && !targetMesh && child.geometry) {
              targetMesh = child;
            }
          });
          ceramicMeshRef.current = targetMesh || model;

          // Cập nhật bóng đổ tiếp xúc
          const footprintRadius = Math.max(scaledBox.max.x - scaledBox.min.x, 0.8) * 0.5;
          if (shadowMeshRef.current) {
            shadowMeshRef.current.position.y = -1.002;
            const s = Math.max(2.0, footprintRadius * 2.8);
            shadowMeshRef.current.scale.set(s, s, 1);
          }
          if (contactMeshRef.current) {
            contactMeshRef.current.position.y = -1.001;
            const s = Math.max(1.3, footprintRadius * 2.2);
            contactMeshRef.current.scale.set(s, s, 1);
          }

          // FIX: Áp dụng decals (họa tiết + chữ) lên model GLB
          rebuildDecals();

          if (onModelLoaded) {
            onModelLoaded(model);
          }
        },
        undefined,
        (err) => {
          console.warn('[CeramicCanvas3D] Lỗi load GLB:', err);
        }
      );
      return;
    }

    const texture = updateTextureFast();

    const ceramicMaterial = new THREE.MeshPhysicalMaterial({
      roughness: glazeRoughness,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      map: texture,
      envMapIntensity: 1.2,
      // FIX (bug 2 — bát lông như lưỡi liềm): side: DoubleSide để nhìn thấy
      // cả mặt trong bát khi nhìn từ trên xuống. Không có dòng này, các mặt
      // sau bị culling → chỉ còn lại mép vành phát sáng như lưỡi liềm.
      side: THREE.DoubleSide,
    });

    const mainGeometry = customGeometry ? customGeometry.clone() : createCeramicGeometry(modelType, buildProfile());
    const handleGeometry = (!customGeometry && modelType === 'mug') ? createMugHandleGeometry(modelType, buildProfile()) : null;

    // Căn đáy phôi tiếp đất tại Y = -1.0
    mainGeometry.computeBoundingBox();
    const bbox = mainGeometry.boundingBox;
    const shiftY = bbox ? -bbox.min.y - 1.0 : 0;
    shiftYRef.current = shiftY;
    mainGeometry.translate(0, shiftY, 0);
    if (handleGeometry) handleGeometry.translate(0, shiftY, 0);

    mainGeometry.computeBoundingBox();
    const groundedBbox = mainGeometry.boundingBox;
    const footprintRadius = groundedBbox
      ? Math.max(Math.abs(groundedBbox.max.x), Math.abs(groundedBbox.min.x), 0.8)
      : 1.0;

    if (shadowMeshRef.current) {
      shadowMeshRef.current.position.y = -1.002;
      const s = Math.max(2.0, footprintRadius * 2.2);
      shadowMeshRef.current.scale.set(s, s, 1);
    }
    if (contactMeshRef.current) {
      contactMeshRef.current.position.y = -1.001;
      const s = Math.max(1.3, footprintRadius * 1.8);
      contactMeshRef.current.scale.set(s, s, 1);
    }

    const mainMesh = new THREE.Mesh(mainGeometry, ceramicMaterial);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    rotationGroupRef.current.add(mainMesh);
    ceramicMeshRef.current = mainMesh;

    // Xây decal SAU khi body tồn tại + shiftY đã cập nhật
    rebuildDecals();

    if (handleGeometry) {
      const handleMat = ceramicMaterial.clone();
      const handleMesh = new THREE.Mesh(handleGeometry, handleMat);
      handleMesh.castShadow = true;
      handleMesh.receiveShadow = true;
      rotationGroupRef.current.add(handleMesh);
      handleMeshRef.current = handleMesh;
    }
  }, [glbUrl, modelType, customLathePoints, updateTextureFast]);

  // ── 5. Cập nhật men & decal khi glaze / pattern / text thay đổi ──
  useEffect(() => {
    if (!ceramicMeshRef.current) return;
    updateTextureFast();
    rebuildDecals();
    const applyRoughness = (m) => {
      if (m && m.material) {
        m.material.roughness = glazeRoughness;
        m.material.needsUpdate = true;
      }
    };
    applyRoughness(ceramicMeshRef.current);
    applyRoughness(handleMeshRef.current);
  }, [
    glazeColor, glazeRoughness, glazeName, pattern, patternImage,
    patternTransform, customText, textTransform, updateTextureFast,
  ]);

  // ── (Tùy chọn) Đánh giá "3D vs ảnh gốc" bằng render WebGL thật ──
  // Chỉ bật khi cha truyền sourceImage + onFidelityScore. Ở AICoCreator hiện tại
  // chưa truyền → effect này là inert (không chạy WebGL không cần thiết).
  useEffect(() => {
    if (!sourceImage || !onFidelityScore || !sceneRef.current || !rendererRef.current || !cameraRef.current) {
      return;
    }
    // chờ renderer vẽ frame mới nhất của model trước khi sample
    const id = setTimeout(() => {
      renderFidelityScore({
        threeScene: sceneRef.current,
        threeCamera: cameraRef.current,
        threeRenderer: rendererRef.current,
        sourceImage,
        size: 256,
      }).then((res) => onFidelityScore(res)).catch((e) => {
        onFidelityScore({ score: null, note: 'fidelity effect lỗi: ' + (e && e.message ? e.message : e) });
      });
    }, 64);
    return () => clearTimeout(id);
  }, [
    sourceImage, onFidelityScore,
    modelType, customLathePoints, glazeColor, glazeName, pattern, patternImage,
    rimStyle, customText, patternTransform, textTransform,
  ]);

  const toggleAutoRotate = useCallback(() => {
    autoRotateRef.current = !autoRotateRef.current;
    setIsRotating(autoRotateRef.current);
  }, []);

  const resetCamera = useCallback(() => {
    if (cameraRef.current && rotationGroupRef.current) {
      cameraRef.current.position.set(0, 0.25, 4.6);
      cameraRef.current.lookAt(0, 0.05, 0);
      rotationGroupRef.current.rotation.set(0, 0, 0);
    }
  }, []);

  return (
    <div ref={mountRef} className="relative w-full h-full">
      {showControls && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 bg-ceramic-paper/92 backdrop-blur-md px-2.5 py-1 rounded-xl border border-ceramic-border shadow-card text-xs font-mono text-ceramic-charcoal">
          <button
            type="button"
            onClick={toggleAutoRotate}
            className="px-2.5 py-1 rounded-lg border border-ceramic-border text-ceramic-terracotta font-semibold hover:bg-ceramic-cream transition"
          >
            {isRotating ? '⏸ Dừng' : '▶ Quay'}
          </button>
          <button
            type="button"
            onClick={resetCamera}
            className="px-2.5 py-1 rounded-lg border border-ceramic-border hover:bg-ceramic-paper transition"
          >
            ⟲ Chính diện
          </button>
        </div>
      )}
      {showInteractionPill && (isAltPressed || effectiveInteractionMode === 'drag-pattern' || effectiveInteractionMode === 'drag-text') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-ceramic-charcoal/90 text-ceramic-paper text-xs font-mono border border-ceramic-paper/10">
          <span className="w-2 h-2 rounded-full bg-bg-state-success animate-pulse" />
          <span className="font-semibold">
            {effectiveInteractionMode === 'drag-text' ? '✍️ Di chuyển Chữ khắc' : '🎨 Di chuyển Hoa văn'}
          </span>
        </div>
      )}
    </div>
  );
}
