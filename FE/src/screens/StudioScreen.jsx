import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RightSidebar from '../components/RightSidebar';
import { useDesign } from '../contexts/DesignContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useScrollReveal } from '../hooks/useScrollReveal';
import Button from '../ui/Button';
import { createCeramicTextureCanvas, imageCache } from '../utils/ceramicTextureGenerator';
import { createCeramicGeometry, createMugHandleGeometry } from '../utils/orthographicRenderer';
import { createRadialShadowCanvas, createContactShadowCanvas } from '../utils/shadowCanvas';

export default function StudioScreen() {
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [isRotating, setIsRotating] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  const {
    modelType,
    glazeColor,
    glazeRoughness,
    glazeName,
    pattern,
    patternImage,
    patternTransform,
    setPatternTransform,
    customText,
    textTransform,
    setTextTransform,
    interactionMode,
    setInteractionMode,
    activeElement,
    setActiveElement,
    customLathePoints,
    customGlbUrl,
    selectedProduct,
    isAiDeconstructing,
  } = useDesign();
  const { showToast } = useToast();
  const { setActiveTab } = useNavigation();

  // Check if a product was explicitly selected from Gallery or AI Creator
  const hasSelectedProduct = !!selectedProduct;
  const containerRef = useRef(null);
  useScrollReveal(containerRef);

  // ── Three.js Refs ──
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const rotationGroupRef = useRef(null);
  const ceramicMeshRef = useRef(null);
  const handleMeshRef = useRef(null);
  const shadowMeshRef = useRef(null);
  const contactMeshRef = useRef(null);
  const textureCanvasRef = useRef(null);
  const textureMapRef = useRef(null);
  const handleTextureMapRef = useRef(null);

  // Interaction refs
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const autoRotateRef = useRef(true);

  // Trạng thái giữ phím Alt để tương tác trực tiếp lên khối 3D
  const [isAltPressed, setIsAltPressed] = useState(false);
  const isAltPressedRef = useRef(false);
  const activeDragTypeRef = useRef(null); // 'pattern' | 'text' | 'orbit' | null

  // Synchronized refs for fresh values inside animation loop & listeners
  const patternRef = useRef(pattern);
  useEffect(() => { patternRef.current = pattern; }, [pattern]);

  const patternImageRef = useRef(patternImage);
  useEffect(() => {
    patternImageRef.current = patternImage;
    if (patternImage) {
      const img = new Image();
      img.onload = () => {
        imageCache.set(patternImage, img);
        updateTextureFast();
      };
      img.src = patternImage;
    }
  }, [patternImage]);

  const patternTransformRef = useRef(patternTransform);
  useEffect(() => { patternTransformRef.current = patternTransform; }, [patternTransform]);

  const setPatternTransformRef = useRef(setPatternTransform);
  useEffect(() => { setPatternTransformRef.current = setPatternTransform; }, [setPatternTransform]);

  const customTextRef = useRef(customText);
  useEffect(() => { customTextRef.current = customText; }, [customText]);

  const textTransformRef = useRef(textTransform);
  useEffect(() => { textTransformRef.current = textTransform; }, [textTransform]);

  const setTextTransformRef = useRef(setTextTransform);
  useEffect(() => { setTextTransformRef.current = setTextTransform; }, [setTextTransform]);

  const interactionModeRef = useRef(interactionMode);
  useEffect(() => { interactionModeRef.current = interactionMode; }, [interactionMode]);

  const activeElementRef = useRef(activeElement);
  useEffect(() => { activeElementRef.current = activeElement; }, [activeElement]);

  // ── 1. Tạo & Cập nhật Texture men gốm + họa tiết siêu tốc (không rebuild mesh) ──
  const updateTextureFast = useCallback((currentPatTransform, currentTxtTransform) => {
    const canvas = createCeramicTextureCanvas({
      glazeColor,
      glazeName,
      pattern: patternRef.current,
      patternImage: patternImageRef.current,
      patternTransform: currentPatTransform || patternTransformRef.current,
      rimStyle: 'brown',
      customText: customTextRef.current,
      textTransform: currentTxtTransform || textTransformRef.current,
      modelType,
      width: 1024,
      height: 1024,
      latheProfile: customLathePoints,
      onImageLoaded: () => {
        if (textureMapRef.current) {
          updateTextureFast(currentPatTransform, currentTxtTransform);
        }
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
  }, [glazeColor, glazeName, modelType, customLathePoints]);

  // ── 2. Khởi tạo Three.js WebGL Scene & Viewport ──
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera góc nhìn 38 độ, căn giữa bàn xoay
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 4.6);
    camera.lookAt(0, 0.05, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ánh sáng Studio chuyên nghiệp phản chiếu men bóng
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

    // Group xoay 360 độ chứa mô hình gốm (thứ tự YXZ để xoay ngang quanh bàn xoay và gật dọc không bị khoá trục)
    const rotationGroup = new THREE.Group();
    rotationGroup.rotation.order = 'YXZ';
    scene.add(rotationGroup);
    rotationGroupRef.current = rotationGroup;

    // Bóng đổ sàn tiếp xúc chân đế
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowTex = new THREE.CanvasTexture(createRadialShadowCanvas());
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.002;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    const contactGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const contactTex = new THREE.CanvasTexture(createContactShadowCanvas());
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const contactMesh = new THREE.Mesh(contactGeo, contactMat);
    contactMesh.rotation.x = -Math.PI / 2;
    contactMesh.position.y = -1.001;
    scene.add(contactMesh);
    contactMeshRef.current = contactMesh;

    // ── Animation Loop ──
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotateRef.current && rotationGroupRef.current) {
        rotationGroupRef.current.rotation.y += 0.0035;
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Mouse & Touch Orbit & Direct 3D Surface Drag Listeners ──
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

      if (rotationGroupRef.current) {
        rotationGroupRef.current.updateMatrixWorld(true);
      }

      raycaster.setFromCamera(mouseNDC, cameraRef.current);
      const intersects = raycaster.intersectObject(ceramicMeshRef.current, false);

      if (intersects.length > 0 && intersects[0].uv) {
        const hit = intersects[0];
        const uv = hit.uv;
        // uv.y: 0.0 (chân đế ngoài) -> 1.0 (lòng trong gốm)
        // Canvas yPercent: 0% (lòng trong/miệng) -> 100% (chân đế ngoài)
        const newY = Math.max(0, Math.min(100, Math.round((1.0 - uv.y) * 100)));
        // uv.x: 0.0 -> 1.0 quanh thân gốm (0.5 là chính diện mặt trước 0°)
        let newAngle = Math.round((uv.x - 0.5) * 360);
        if (newAngle > 180) newAngle -= 360;
        if (newAngle < -180) newAngle += 360;

        if (dragType === 'pattern') {
          const cur = patternTransformRef.current || { yPercent: 68, rotationAngle: 0, scale: 1.0, rotation: 0 };
          const next = { ...cur, rotationAngle: newAngle, yPercent: newY };
          patternTransformRef.current = next;
          updateTextureFast(next, textTransformRef.current);
          if (setPatternTransformRef.current) {
            setPatternTransformRef.current(next);
          }
        } else if (dragType === 'text') {
          const cur = textTransformRef.current || { yPercent: 82, rotationAngle: 0, fontSize: 44, placement: 'belly' };
          const next = { ...cur, rotationAngle: newAngle, yPercent: newY };
          textTransformRef.current = next;
          updateTextureFast(patternTransformRef.current, next);
          if (setTextTransformRef.current) {
            setTextTransformRef.current(next);
          }
        }
        return;
      }

      // Fallback khi chuột kéo trượt ra ngoài viền phôi gốm trong khi đang giữ chuột kéo
      if (!isMouseDownSnap) {
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
          if (setPatternTransformRef.current) {
            setPatternTransformRef.current(next);
          }
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
          if (setTextTransformRef.current) {
            setTextTransformRef.current(next);
          }
        }
      }
    };

    const handleMouseDown = (e) => {
      const isAlt = e.altKey || isAltPressedRef.current;
      const isDragPattern = interactionModeRef.current === 'drag-pattern';
      const isDragText = interactionModeRef.current === 'drag-text';

      let dragType = null;
      if (isDragText || (isAlt && activeElementRef.current === 'text')) {
        dragType = 'text';
      } else if (isDragPattern || (isAlt && activeElementRef.current === 'pattern')) {
        dragType = 'pattern';
      } else if (isAlt && patternRef.current !== 'none') {
        dragType = 'pattern';
      } else if (isAlt && customTextRef.current?.trim()) {
        dragType = 'text';
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
      // Mở rộng biên độ xoay đứng lên ±1.54 rad (±88.2°) — loại bỏ hoàn toàn các góc chết để soi trọn miệng gốm và đáy mộc
      rotationGroupRef.current.rotation.x = Math.max(
        -1.54,
        Math.min(1.54, rotationGroupRef.current.rotation.x + deltaY * 0.008)
      );
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      activeDragTypeRef.current = null;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const isDragPattern = interactionModeRef.current === 'drag-pattern';
      const isDragText = interactionModeRef.current === 'drag-text';

      let dragType = null;
      if (isDragText) {
        dragType = 'text';
      } else if (isDragPattern) {
        dragType = 'pattern';
      }

      isDraggingRef.current = true;
      activeDragTypeRef.current = dragType;
      autoRotateRef.current = false;
      setIsRotating(false);
      previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };

      if (dragType) {
        updateDecalFromPointer(touch, dragType, true);
      }
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
        -1.54,
        Math.min(1.54, rotationGroupRef.current.rotation.x + deltaY * 0.008)
      );
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      activeDragTypeRef.current = null;
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Alt') {
        isAltPressedRef.current = true;
        setIsAltPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt') {
        isAltPressedRef.current = false;
        setIsAltPressed(false);
      }
    };

    const handleBlur = () => {
      isAltPressedRef.current = false;
      setIsAltPressed(false);
      isDraggingRef.current = false;
      activeDragTypeRef.current = null;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      if (cameraRef.current) {
        cameraRef.current.position.z = Math.max(2.8, Math.min(7.2, cameraRef.current.position.z + e.deltaY * 0.003));
        setZoomLevel(Number(((4.6 / cameraRef.current.position.z) * 100).toFixed(0)));
      }
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

    // Responsive Canvas Resizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const entry = entries[0];
      const newWidth = entry ? entry.contentRect.width : container.clientWidth;
      const newHeight = entry ? entry.contentRect.height : container.clientHeight;
      if (newWidth <= 0 || newHeight <= 0) return;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

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
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // ── 3. Tái tạo hình học 3D (Geometry) khi dáng phôi thay đổi ──
  useEffect(() => {
    if (!rotationGroupRef.current) return;

    // Dọn dẹp mesh cũ
    while (rotationGroupRef.current.children.length > 0) {
      const child = rotationGroupRef.current.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      rotationGroupRef.current.remove(child);
    }

    if (customGlbUrl) {
      const loader = new GLTFLoader();
      loader.load(
        customGlbUrl,
        (gltf) => {
          if (!rotationGroupRef.current) return;
          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 2.0 / maxDim : 1.0;
          model.scale.setScalar(scale);

          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          model.position.x = -scaledCenter.x;
          model.position.z = -scaledCenter.z;
          model.position.y = -scaledBox.min.y - 1.0;

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              // Apply ceramic material so color/pattern/text adjustments work live.
              // Without this, the GLB keeps its baked materials and ignores RightSidebar controls.
              const texture = textureMapRef.current || updateTextureFast();
              child.material = new THREE.MeshPhysicalMaterial({
                roughness: glazeRoughness,
                metalness: 0.02,
                clearcoat: 0.85,
                clearcoatRoughness: 0.1,
                map: texture,
                envMapIntensity: 1.2,
              });
              child.material.needsUpdate = true;
            }
          });

          rotationGroupRef.current.add(model);
          ceramicMeshRef.current = model;

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
        },
        undefined,
        (err) => console.warn('[StudioScreen] Lỗi load GLB:', err)
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
    });

    const mainGeometry = createCeramicGeometry(modelType, customLathePoints);
    const handleGeometry = createMugHandleGeometry(modelType, customLathePoints);

    // Căn chuẩn đáy phôi tiếp đất vững vàng tại Y = -1.0
    mainGeometry.computeBoundingBox();
    const bbox = mainGeometry.boundingBox;
    const shiftY = bbox ? -bbox.min.y - 1.0 : 0;
    mainGeometry.translate(0, shiftY, 0);

    if (handleGeometry) {
      handleGeometry.translate(0, shiftY, 0);
    }

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

    if (handleGeometry) {
      // Quai cầm (handle): Sử dụng chất liệu men gốm trơn thuần túy (không dán hoa văn hay chữ của thân)
      const handleCanvas = createCeramicTextureCanvas({
        glazeColor,
        glazeName,
        pattern: 'none',
        patternImage: null,
        customText: '',
        rimStyle: 'none',
        modelType: 'mug',
        width: 512,
        height: 512,
      });
      const handleMap = new THREE.CanvasTexture(handleCanvas);
      handleMap.wrapS = THREE.RepeatWrapping;
      handleMap.wrapT = THREE.ClampToEdgeWrapping;
      handleTextureMapRef.current = handleMap;

      const handleMat = new THREE.MeshPhysicalMaterial({
        roughness: glazeRoughness,
        metalness: 0.02,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
        map: handleMap,
        envMapIntensity: 1.2,
      });
      const handleMesh = new THREE.Mesh(handleGeometry, handleMat);
      handleMesh.castShadow = true;
      handleMesh.receiveShadow = true;
      rotationGroupRef.current.add(handleMesh);
      handleMeshRef.current = handleMesh;
    }
  }, [customGlbUrl, modelType, customLathePoints, updateTextureFast, glazeColor, glazeName, glazeRoughness]);

  // ── 4. Cập nhật Men & Họa tiết siêu tốc khi chỉnh màu, hoa văn hoặc chữ ──
  useEffect(() => {
    if (!ceramicMeshRef.current) return;
    const texture = updateTextureFast();
    // Update material on ALL mesh children — works for both single Mesh and GLB Group
    ceramicMeshRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.roughness = glazeRoughness;
        if (child.material.map) {
          child.material.map = texture;
        }
        child.material.needsUpdate = true;
      }
    });
    if (handleMeshRef.current && handleMeshRef.current.material) {
      // Cập nhật men trơn cho quai cầm đồng bộ màu men và độ bóng (không có hoa văn hay chữ)
      const handleCanvas = createCeramicTextureCanvas({
        glazeColor,
        glazeName,
        pattern: 'none',
        patternImage: null,
        customText: '',
        rimStyle: 'none',
        modelType: 'mug',
        width: 512,
        height: 512,
      });
      if (handleTextureMapRef.current) {
        handleTextureMapRef.current.image = handleCanvas;
        handleTextureMapRef.current.needsUpdate = true;
      }
      handleMeshRef.current.material.roughness = glazeRoughness;
      handleMeshRef.current.material.needsUpdate = true;
    }
  }, [glazeColor, glazeRoughness, glazeName, pattern, patternImage, patternTransform, customText, textTransform, updateTextureFast]);

  // Bật/tắt xoay tự động bàn xoay
  const toggleAutoRotate = () => {
    const nextState = !isRotating;
    setIsRotating(nextState);
    autoRotateRef.current = nextState;
  };

  // Đặt lại góc nhìn chính diện
  const resetCamera = () => {
    if (cameraRef.current && rotationGroupRef.current) {
      cameraRef.current.position.set(0, 0.25, 4.6);
      cameraRef.current.lookAt(0, 0.05, 0);
      rotationGroupRef.current.rotation.set(0, 0, 0);
      setZoomLevel(100);
    }
  };

  // Góc nhìn soi thẳng miệng gốm & lòng bên trong từ trên xuống
  const viewTop = () => {
    if (rotationGroupRef.current) {
      autoRotateRef.current = false;
      setIsRotating(false);
      rotationGroupRef.current.rotation.x = 1.40;
    }
  };

  // Góc nhìn soi thẳng đáy gốm & dấu khắc chân mộc từ dưới lên
  const viewBottom = () => {
    if (rotationGroupRef.current) {
      autoRotateRef.current = false;
      setIsRotating(false);
      rotationGroupRef.current.rotation.x = -1.40;
    }
  };

  // Chụp ảnh tiêu bản 3D sắc nét
  const handleSnapshot = () => {
    if (!rendererRef.current) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `tieu-ban-gom-${modelType}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      showToast('Đã chụp tiêu bản kết quả render vào máy!');
    } catch (_) {
      showToast('Không thể chụp ảnh từ canvas WebGL.');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-[100dvh] md:h-full flex-1 flex overflow-hidden bg-ceramic-cream select-none">
      {/* Ghi chú thao tác chuột góc trái */}
      <div className="absolute bottom-5 left-5 pointer-events-none hidden sm:flex items-center gap-3 z-10">
        <div className="bg-ceramic-paper/80 backdrop-blur-md px-3 py-2 rounded-full border border-ceramic-border text-[11px] font-mono text-ceramic-warmGray shadow-paper flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-state-success animate-pulse" />
          <span>Kéo chuột xoay 360° • Cuộn chuột phóng to ({zoomLevel}%)</span>
        </div>
      </div>
      {/* ── Bàn Xoay 3D Trung Tâm ── */}
      <div className="relative flex-1 h-full min-w-0 flex flex-col">

        {/* Nút Thu Gọn / Ẩn Thanh Công Cụ Bên Phải Khi Đang Mở */}
        {showRightSidebar && (
          <button
            type="button"
            onClick={() => setShowRightSidebar(false)}
            className="
              absolute top-5 right-6 z-20
              bg-ceramic-paper/95 backdrop-blur-md hover:bg-ceramic-terracotta hover:text-ceramic-paper text-ceramic-charcoal
              p-2.5 border border-ceramic-border hover:border-ceramic-terracotta transition-all rounded-xl shadow-paper cursor-pointer
              flex items-center justify-center group focus-visible:ring-2 focus-visible:ring-ceramic-terracotta
            "
            title="Ẩn bảng tạo tác"
            aria-label="Ẩn bảng tạo tác"
          >
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Nút Mở Lại Thanh Công Cụ Khi Đã Ẩn (Đồng bộ với nút Mở menu bên trái của dự án) */}
        {!showRightSidebar && (
          <button
            type="button"
            onClick={() => setShowRightSidebar(true)}
            className="
              absolute top-5 right-6 z-30
              px-3.5 py-2.5 bg-ceramic-paper/95 backdrop-blur-md border border-ceramic-border rounded-xl shadow-card
              text-ceramic-charcoal hover:bg-ceramic-cream hover:border-ceramic-terracotta flex items-center gap-2 text-xs font-medium
              transition-all group cursor-pointer focus-visible:ring-2 focus-visible:ring-ceramic-terracotta animate-in fade-in duration-200
            "
            title="Mở bảng điều khiển tạo tác"
            aria-label="Mở bảng điều khiển tạo tác"
          >
            <svg className="w-4 h-4 text-ceramic-slate group-hover:text-ceramic-terracotta transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
              <path d="m11 9-3 3 3 3" />
            </svg>
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Bảng tạo tác</span>
          </button>
        )}

        {/* 3D WebGL Canvas Viewport */}
        <div className="w-full flex-1 min-h-0 relative">
          {/* AI Banner: Phân tích & Bóc tách phôi thực tế */}
          {isAiDeconstructing && (
            <div className="absolute top-5 left-5 z-20 flex items-center gap-2.5 bg-ceramic-paper/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-ceramic-terracotta/40 shadow-card text-xs font-mono text-ceramic-charcoal animate-in fade-in">
              <span className="w-2.5 h-2.5 rounded-full bg-ceramic-terracotta animate-ping flex-shrink-0" />
              <span className="font-semibold text-ceramic-terracotta">✦ AI Nghệ Nhân:</span>
              <span className="text-ceramic-slate">Đang bóc tách phôi 3D & hoa văn từ ảnh thật...</span>
            </div>
          )}
          {!isAiDeconstructing && (customLathePoints || patternImage) && (
            <div className="absolute top-5 left-5 z-20 hidden md:flex items-center gap-2.5 bg-ceramic-paper/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-ceramic-border shadow-paper text-xs font-mono text-ceramic-charcoal animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-state-success flex-shrink-0" />
              <span className="font-semibold text-ceramic-charcoal">✦ AI Phôi Thực Tế:</span>
              <span className="text-ceramic-slate text-[11px]">
                {customLathePoints ? 'Biên dạng tiện độc bản' : 'Dáng gốm chuẩn'} • {patternImage ? 'Hoa văn bóc tách độc bản' : 'Men độc bản'}
              </span>
            </div>
          )}

          {/* Top HUD Banner khi đang giữ Alt hoặc bật chế độ kéo hoa văn / chữ */}
          {(isAltPressed || interactionMode === 'drag-pattern' || interactionMode === 'drag-text') && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-ceramic-charcoal/92 text-ceramic-paper px-4 py-2 rounded-2xl shadow-card backdrop-blur-md text-xs font-mono border border-ceramic-paper/10 animate-in fade-in duration-200">
              <span className="w-2.5 h-2.5 rounded-full bg-state-success animate-pulse flex-shrink-0" />
              <span className="font-semibold text-ceramic-paper">
                {activeElement === 'text' || interactionMode === 'drag-text' ? '✍️ Di chuyển Chữ khắc' : '🎨 Di chuyển Hoa văn'}
              </span>
              <span className="hidden sm:inline text-[11px] text-ceramic-paper/80 border-l border-ceramic-paper/20 pl-2.5">
                Kéo chuột trên gốm để đặt vị trí (đáy mộc, lòng trong, miệng, thân)
              </span>
              {pattern !== 'none' && customText?.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    const next = (activeElement === 'pattern' && interactionMode !== 'drag-text') ? 'text' : 'pattern';
                    setActiveElement(next);
                    if (interactionMode !== 'orbit') {
                      setInteractionMode(next === 'pattern' ? 'drag-pattern' : 'drag-text');
                    }
                  }}
                  className="ml-1 px-2.5 py-1 bg-ceramic-paper/20 hover:bg-ceramic-paper/30 rounded-lg text-[10px] text-ceramic-paper transition-colors cursor-pointer font-semibold flex items-center gap-1"
                  title="Chuyển đổi đối tượng di chuyển trên gốm"
                >
                  <span>Đổi sang:</span>
                  <span className="text-ceramic-terracotta font-bold">{activeElement === 'pattern' ? '✍️ Chữ' : '🎨 Hoa văn'}</span>
                </button>
              )}
            </div>
          )}

          <div
            ref={mountRef}
            className={`absolute inset-0 w-full h-full ${isAltPressed || interactionMode === 'drag-pattern' || interactionMode === 'drag-text'
              ? 'cursor-crosshair active:cursor-crosshair'
              : 'cursor-grab active:cursor-grabbing'
              }`}
          />

          {/* Overlay: nếu chưa chọn sản phẩm từ Gallery/AI Creator */}
          {!hasSelectedProduct && (
            <div
              className="absolute inset-0 bg-ceramic-paper/70 backdrop-blur-sm flex items-center justify-center z-30"
            >
              <div className="text-center space-y-5 max-w-sm px-6">
                <div className="text-3xl text-ceramic-terracotta font-editorial">●</div>
                <div className="space-y-2">
                  <h4 className="font-editorial text-xl font-bold text-ceramic-charcoal">
                    Chưa chọn sản phẩm gốm
                  </h4>
                  <p className="text-xs text-ceramic-slate font-body">
                    Hãy chọn một mẫu gốm từ Thư viện, tạo mới qua AI Creator,
                    hoặc nhấn núới bên dưới để chuyển đến Thư viện mẫu.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="primary" size="sm" onClick={() => setActiveTab('gallery')}>
                    Chọn từ Thư viện
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab('ai-co-creator')}>
                    Tạo bởi AI
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Thanh Điều Khiển Dưới Cùng (Bottom Studio Toolbar) */}
          <div className="absolute bottom-5 right-5 flex items-center gap-1.5 bg-ceramic-paper/92 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-ceramic-border shadow-card text-xs font-mono text-ceramic-charcoal z-10">
            {/* Alt key hint */}
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono text-ceramic-slate/90 mr-1 border-r border-ceramic-border/60">
              <kbd className="px-1.5 py-0.5 bg-ceramic-paper border border-ceramic-border rounded text-[10px] font-bold text-ceramic-charcoal shadow-paper">Alt</kbd>
              <span>+ di chuyển họa tiết/chữ</span>
            </div>

            <button
              type="button"
              onClick={toggleAutoRotate}
              title="Bật/Tắt xoay tự động 360 độ"
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer font-semibold ${isRotating
                ? 'bg-ceramic-terracotta text-ceramic-paper shadow-paper'
                : 'hover:bg-ceramic-beige text-ceramic-slate'
                }`}
            >
              {isRotating ? 'Đang xoay 360°' : 'Tạm dừng xoay'}
            </button>

            <button
              type="button"
              onClick={resetCamera}
              title="Đặt lại góc nhìn chính diện"
              className="px-2.5 py-1.5 rounded-xl hover:bg-ceramic-beige transition-all text-ceramic-slate cursor-pointer"
            >
              Chính diện
            </button>

            <button
              type="button"
              onClick={viewTop}
              title="Soi thẳng miệng gốm & lòng bên trong"
              className="px-2.5 py-1.5 rounded-xl hover:bg-ceramic-beige transition-all text-ceramic-slate cursor-pointer"
            >
              Xem miệng
            </button>

            <button
              type="button"
              onClick={viewBottom}
              title="Soi thẳng đáy gốm & dấu khắc chân mộc"
              className="px-2.5 py-1.5 rounded-xl hover:bg-ceramic-beige transition-all text-ceramic-slate cursor-pointer"
            >
              Xem đáy
            </button>

            <button
              type="button"
              onClick={handleSnapshot}
              title="Chụp ảnh render độ nét cao về máy"
              className="px-2.5 py-1.5 rounded-xl hover:bg-ceramic-beige transition-all text-ceramic-slate flex items-center gap-1 cursor-pointer"
            >
              <span>Chụp ảnh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Bảng Công Cụ Thiết Kế Bên Phải ── */}
      <div
        className={`
          h-full flex-shrink-0 z-20 transition-all duration-300 ease-in-out
          ${showRightSidebar ? 'w-84 md:w-96 translate-x-0 opacity-100' : 'w-0 translate-x-full opacity-0 pointer-events-none overflow-hidden'}
        `}
      >
        <RightSidebar
          onClose={() => setShowRightSidebar(false)}
          onGetSnapshot={() => {
            if (!rendererRef.current) return null;
            try {
              return rendererRef.current.domElement.toDataURL('image/png');
            } catch (_) {
              return null;
            }
          }}
        />
      </div>
    </div>
  );
}
