/**
 * ceramicSpecimenAnalyzer.js
 * 
 * Script độc lập chuyên trách Đọc & Bóc Tách Tự Động từ Tiêu Bản / Ảnh Mẫu Gốm:
 * 1. Phân tích màu men nền thực tế (Base Glaze) trên phôi gốc.
 * 2. Tự động nhận diện có viền miệng hay không (Rim Banding), xác định màu sắc (caramel/vàng kim) và độ dày viền.
 * 3. Tự động bóc tách riêng lẻ hoa văn vẽ tay (Motif/Decal) trên thân trước của phôi thành ảnh PNG trong suốt.
 * 4. Tự động chuyển giao các thông số này để đắp lên mô hình 3D và đồng bộ 6 góc chiếu 2D trực giao.
 */

// Helper: Tải ảnh bất đồng bộ vào HTMLImageElement
function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) return reject(new Error('Nguồn ảnh không hợp lệ'));
    if (source instanceof HTMLImageElement && source.complete) {
      return resolve(source);
    }
    const img = new Image();
    const srcStr = typeof source === 'string' ? source : (source.src || '');
    if (!srcStr.startsWith('data:') && !srcStr.startsWith('blob:') && srcStr.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Thử lại không dùng crossOrigin nếu gặp hạn chế CORS
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = (e) => reject(new Error('Không thể tải ảnh tiêu bản: ' + e));
      fallbackImg.src = srcStr;
    };
    img.src = srcStr;
  });
}

/**
 * Phân tích chuyên sâu tiêu bản ảnh gốm và tự động bóc tách hoa văn, viền miệng, màu men
 */
export async function analyzeAndDeconstructSpecimen(imageSource, options = {}) {
  try {
    const img = await loadImage(imageSource);
    const canvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width || 750;
    const height = img.naturalHeight || img.height || 750;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // 1. Tự động nhận diện màu nền thực tế từ 4 góc ảnh (hỗ trợ nền Studio #F8F7F4, nền trắng #FFFFFF, hoặc ảnh chụp)
    const corners = [
      0,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + width - 1) * 4
    ];
    let bgSumR = 0, bgSumG = 0, bgSumB = 0, bgCount = 0;
    for (const c of corners) {
      if (data[c + 3] > 30) {
        bgSumR += data[c];
        bgSumG += data[c + 1];
        bgSumB += data[c + 2];
        bgCount++;
      }
    }
    const bgR = bgCount > 0 ? Math.round(bgSumR / bgCount) : 248;
    const bgG = bgCount > 0 ? Math.round(bgSumG / bgCount) : 247;
    const bgB = bgCount > 0 ? Math.round(bgSumB / bgCount) : 244;

    // 1. Xác định Bounding Box của vật thể gốm
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        const isTransparent = a < 35;
        const colorDiff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        const isNearBg = colorDiff < 22 || (r > 240 && g > 240 && b > 238 && bgR > 235);

        if (!isTransparent && !isNearBg) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minX >= maxX || minY >= maxY) {
      // Fallback an toàn nếu ảnh toàn màu trắng hoặc không phân biệt được
      return {
        success: false,
        message: 'Không tìm thấy phôi gốm hợp lệ trong ảnh',
        glazeColor: '#EDE8DC',
        glazeName: 'Men Sứ Trắng Ngà',
        rimStyle: 'brown',
        pattern: 'none',
        patternImage: null,
      };
    }

    const objW = maxX - minX;
    const objH = maxY - minY;

    // 2. Tự động nhận diện Viền Miệng (Rim Banding)
    // Quét vùng vòng cung vành miệng (vùng 18% trên cùng của phôi)
    const rimYEnd = minY + Math.round(objH * 0.18);
    const rimPixels = [];

    for (let y = minY; y < rimYEnd; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a > 100) {
          // Tiêu chí nhận diện men da lươn / nâu hổ phách / caramel:
          // Sắc đỏ cam trội, r > 130, g vừa phải (70 - 150), b thấp (< 90), r - b > 45
          const isCaramel = r > 130 && g > 65 && g < 155 && b < 95 && (r - b) > 45;
          // Tiêu chí nhận diện chỉ vàng hoàng kim:
          // r > 170, g > 140, b < 70
          const isGold = r > 170 && g > 135 && b < 80 && (r - b) > 80;

          if (isCaramel || isGold) {
            rimPixels.push({ r, g, b, isGold });
          }
        }
      }
    }

    let detectedRimStyle = 'none';
    let detectedRimHex = '#A45E26';

    if (rimPixels.length >= 35) {
      const goldCount = rimPixels.filter((p) => p.isGold).length;
      const isGoldRim = goldCount > rimPixels.length * 0.6;
      detectedRimStyle = isGoldRim ? 'gold' : 'brown';

      const avgR = Math.round(rimPixels.reduce((s, p) => s + p.r, 0) / rimPixels.length);
      const avgG = Math.round(rimPixels.reduce((s, p) => s + p.g, 0) / rimPixels.length);
      const avgB = Math.round(rimPixels.reduce((s, p) => s + p.b, 0) / rimPixels.length);
      detectedRimHex = '#' + [avgR, avgG, avgB].map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    // 3. Phân tích Men Nền Chủ Đạo (Base Body Glaze)
    // Lấy mẫu tại phần sườn bụng dưới của phôi (tránh hoa văn ở trung tâm mặt trước)
    const bodyPixels = [];
    const sampleY1 = minY + Math.round(objH * 0.40);
    const sampleY2 = minY + Math.round(objH * 0.85);

    for (let y = sampleY1; y < sampleY2; y += 2) {
      // Sườn bên trái
      for (let x = minX + Math.round(objW * 0.06); x < minX + Math.round(objW * 0.18); x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        const isNotBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) > 16;
        if (a > 180 && isNotBg) bodyPixels.push({ r, g, b });
      }
      // Sườn bên phải
      for (let x = maxX - Math.round(objW * 0.18); x < maxX - Math.round(objW * 0.06); x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        const isNotBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) > 16;
        if (a > 180 && isNotBg) bodyPixels.push({ r, g, b });
      }
    }

    let avgBodyR = 237, avgBodyG = 232, avgBodyB = 220; // Default #EDE8DC
    if (bodyPixels.length > 20) {
      avgBodyR = Math.round(bodyPixels.reduce((s, p) => s + p.r, 0) / bodyPixels.length);
      avgBodyG = Math.round(bodyPixels.reduce((s, p) => s + p.g, 0) / bodyPixels.length);
      avgBodyB = Math.round(bodyPixels.reduce((s, p) => s + p.b, 0) / bodyPixels.length);
    }

    const detectedGlazeHex = '#' + [avgBodyR, avgBodyG, avgBodyB].map((v) => v.toString(16).padStart(2, '0')).join('');
    
    // Đặt tên men thích ứng với sắc độ nhận diện được
    let detectedGlazeName = 'Men Sứ Trắng Ngà Bát Tràng';
    let detectedRoughness = 0.16;

    if (avgBodyR > 180 && avgBodyG > 135 && avgBodyB < 95) {
      detectedGlazeName = 'Men Vàng Hoàng Yến Biên Hòa';
    } else if (avgBodyG > avgBodyR + 15 && avgBodyG > avgBodyB + 10) {
      detectedGlazeName = 'Men Xanh Đồng Trổ (Vert de Biên Hòa)';
    } else if (avgBodyB > avgBodyR + 15 && avgBodyB > avgBodyG) {
      detectedGlazeName = 'Men Lam Cổ / Xanh Biển Hỏa Biến';
      detectedRoughness = 0.14;
    } else if (avgBodyR > 140 && avgBodyG < 110 && avgBodyB < 95) {
      detectedGlazeName = 'Men Đá Đỏ Bazan';
      detectedRoughness = 0.28;
    } else if (avgBodyR > 220 && avgBodyG > 215 && avgBodyB > 205) {
      detectedGlazeName = 'Men Sứ Trắng Vẽ Hoa Đào (Tiêu Bản Cổ)';
      detectedRoughness = 0.15;
    }

    // 4. Tự động bóc tách riêng lẻ Hoa Văn Vẽ Tay (Motif / Decal Extraction)
    // Quét vùng bụng trước ($X \in [0.15, 0.85]$, $Y \in [0.25, 0.88]$)
    const mStartX = minX + Math.round(objW * 0.12);
    const mEndX = maxX - Math.round(objW * 0.12);
    const mStartY = minY + Math.round(objH * 0.22);
    const mEndY = maxY - Math.round(objH * 0.08);

    let mMinX = width, mMaxX = 0, mMinY = height, mMaxY = 0;
    let motifPixelCount = 0;
    const motifMask = new Uint8Array(width * height);

    for (let y = mStartY; y < mEndY; y++) {
      for (let x = mStartX; x < mEndX; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a > 100) {
          // Bỏ qua pixel lóa sáng (đèn studio / hạt lóa) — R>245, G>245, B>240
          if (r > 245 && g > 245 && b > 240) continue;
          // Tính khoảng cách màu sắc Euclidean so với men nền
          const colorDist = Math.sqrt(
            Math.pow(r - avgBodyR, 2) +
            Math.pow(g - avgBodyG, 2) +
            Math.pow(b - avgBodyB, 2)
          );

          // Nếu lệch màu đáng kể so với men nền (các nét vẽ cành, nụ hoa đào, lá xanh)
          if (colorDist > 26) {
            motifMask[y * width + x] = 1;
            motifPixelCount++;
            if (x < mMinX) mMinX = x;
            if (x > mMaxX) mMaxX = x;
            if (y < mMinY) mMinY = y;
            if (y > mMaxY) mMaxY = y;
          }
        }
      }
    }

    // --- Connected Component Filtering (BFS) ---
    // Loại bỏ các cụm liên thông nhỏ hơn ngưỡng 180px (đốm rác, hạt bụi, đường chân lông)
    const componentMask = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let componentId = 0;

    for (let y = mStartY; y < mEndY; y++) {
      for (let x = mStartX; x < mEndX; x++) {
        const px = y * width + x;
        if (motifMask[px] === 1 && visited[px] === 0) {
          componentId++;
          // BFS flood-fill
          const queue = [[x, y]];
          visited[px] = 1;
          let area = 0;
          const pixels = [];

          while (queue.length > 0) {
            const [cx2, cy2] = queue.shift();
            area++;
            pixels.push([cx2, cy2]);

            for (const [dx2, dy2] of directions) {
              const nx2 = cx2 + dx2, ny2 = cy2 + dy2;
              if (nx2 < mStartX || nx2 >= mEndX || ny2 < mStartY || ny2 >= mEndY) continue;
              const nIdx = ny2 * width + nx2;
              if (motifMask[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push([nx2, ny2]);
              }
            }
          }

          // Xóa cụm nhỏ hơn 180px
          if (area < 180) {
            for (const [px2, py2] of pixels) {
              motifMask[py2 * width + px2] = 0;
            }
          }
        }
      }
    }

    // Tính lại bbox và count sau khi lọc cụm
    motifPixelCount = 0;
    mMinX = width; mMaxX = 0; mMinY = height; mMaxY = 0;
    for (let y = mStartY; y < mEndY; y++) {
      for (let x = mStartX; x < mEndX; x++) {
        if (motifMask[y * width + x] === 1) {
          motifPixelCount++;
          if (x < mMinX) mMinX = x;
          if (x > mMaxX) mMaxX = x;
          if (y < mMinY) mMinY = y;
          if (y > mMaxY) mMaxY = y;
        }
      }
    }

    let isolatedDecalDataUrl = null;
    let hasDetectedMotif = false;

    // Nếu tìm thấy cụm hoa văn vẽ tay thực sự (số pixel đủ lớn)
    if (motifPixelCount >= 45 && mMinX < mMaxX && mMinY < mMaxY) {
      hasDetectedMotif = true;
      // Safe padding 20px mỗi cạnh (theo chuẩn đầu ra)
      const pad = 20;
      const cropX = Math.max(0, mMinX - pad);
      const cropY = Math.max(0, mMinY - pad);
      const cropW = Math.min(width - cropX, (mMaxX - mMinX) + pad * 2);
      const cropH = Math.min(height - cropY, (mMaxY - mMinY) + pad * 2);

      const motifCanvas = document.createElement('canvas');
      motifCanvas.width = cropW;
      motifCanvas.height = cropH;
      const mCtx = motifCanvas.getContext('2d');
      const mImgData = mCtx.createImageData(cropW, cropH);
      const mData = mImgData.data;

      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          const srcX = cropX + cx;
          const srcY = cropY + cy;
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (cy * cropW + cx) * 4;

          const r = data[srcIdx];
          const g = data[srcIdx + 1];
          const b = data[srcIdx + 2];
          const a = data[srcIdx + 3];

          const colorDist = Math.sqrt(
            Math.pow(r - avgBodyR, 2) +
            Math.pow(g - avgBodyG, 2) +
            Math.pow(b - avgBodyB, 2)
          );

          if (motifMask[srcY * width + srcX] === 1 || colorDist > 24) {
            // Giữ nguyên pixel nét vẽ của hoa văn
            mData[dstIdx] = r;
            mData[dstIdx + 1] = g;
            mData[dstIdx + 2] = b;
            // Làm mịn biên viền (Anti-aliasing feathering)
            const edgeAlpha = Math.min(255, Math.round(((colorDist - 20) / 18) * 255));
            mData[dstIdx + 3] = Math.min(a, edgeAlpha);
          } else {
            // Edge bleed: nếu pixel này là biên (alpha > 0) nhưng không phải motif,
            // lan truyền RGB từ pixel motif gần nhất để tránh viền đen (0,0,0)
            if (a > 100 && a < 255) {
              // Tìm pixel motif gần nhất trong bán kính 3px
              let found = false;
              for (let dy = -3; dy <= 3 && !found; dy++) {
                for (let dx = -3; dx <= 3 && !found; dx++) {
                  const nx = srcX + dx, ny = srcY + dy;
                  if (nx < mStartX || nx >= mEndX || ny < mStartY || ny >= mEndY) continue;
                  if (motifMask[ny * width + nx] === 1) {
                    const nIdx = (ny * width + nx) * 4;
                    mData[dstIdx] = data[nIdx];
                    mData[dstIdx + 1] = data[nIdx + 1];
                    mData[dstIdx + 2] = data[nIdx + 2];
                    mData[dstIdx + 3] = 0; // vẫn trong suốt
                    found = true;
                  }
                }
              }
              if (!found) {
                mData[dstIdx] = 0; mData[dstIdx + 1] = 0; mData[dstIdx + 2] = 0;
                mData[dstIdx + 3] = 0;
              }
            } else {
              mData[dstIdx] = 0;
              mData[dstIdx + 1] = 0;
              mData[dstIdx + 2] = 0;
              // Trong suốt hoàn toàn để hòa vào men 3D
              mData[dstIdx + 3] = 0;
            }
          }
        }
      }

      mCtx.putImageData(mImgData, 0, 0);

      // Gaussian Feathering 2px ở rìa ngoài cùng của motif canvas
      const imgData = mCtx.getImageData(0, 0, cropW, cropH);
      const d = imgData.data;
      const tmp = new Uint8ClampedArray(d.length);

      // Kernel Gaussian 5-tap (sigma≈1.0): [0.227, 0.194, 0.194, 0.194, 0.194] x [0.227, 0.194] x [0.227, 0.194]
      // Simplified 1D separable pass: blur alpha channel only (preserve RGB)
      const kernel3 = [0.227027, 0.194456, 0.194456]; // outer taps truncated for 3-tap
      const gauss3 = [0.333, 0.333, 0.333]; // simpler approximation for 2px radius

      // Horizontal blur (alpha only)
      for (let row = 0; row < cropH; row++) {
        for (let col = 0; col < cropW; col++) {
          const i = (row * cropW + col) * 4;
          let a = 0;
          for (let tap = -1; tap <= 1; tap++) {
            const tc = Math.max(0, Math.min(cropW - 1, col + tap));
            a += d[(row * cropW + tc) * 4 + 3] * gauss3[tap + 1];
          }
          tmp[i + 3] = a;
        }
      }
      // Vertical blur (alpha only)
      const tmp2 = new Uint8ClampedArray(d.length);
      for (let row = 0; row < cropH; row++) {
        for (let col = 0; col < cropW; col++) {
          const i = (row * cropW + col) * 4;
          let a = 0;
          for (let tap = -1; tap <= 1; tap++) {
            const tr = Math.max(0, Math.min(cropH - 1, row + tap));
            a += tmp[(tr * cropW + col) * 4 + 3] * gauss3[tap + 1];
          }
          tmp2[i + 3] = a;
        }
      }
      // Merge blurred alpha back
      for (let i = 0; i < d.length; i += 4) {
        d[i + 3] = tmp2[i + 3];
      }
      mCtx.putImageData(imgData, 0, 0);

      isolatedDecalDataUrl = motifCanvas.toDataURL('image/png');
    }

    // 5. Kết luận phân tích và đóng gói
    return {
      success: true,
      glazeColor: detectedGlazeHex,
      glazeName: detectedGlazeName,
      glazeRoughness: detectedRoughness,
      rimStyle: detectedRimStyle,
      rimColor: detectedRimHex,
      hasMotif: hasDetectedMotif,
      pattern: hasDetectedMotif ? 'specimen_custom' : 'none',
      patternImage: isolatedDecalDataUrl,
      specimenStats: {
        motifPixelCount,
        rimPixelCount: rimPixels.length,
        boundingBox: { minX, maxX, minY, maxY, w: objW, h: objH },
      },
      summary: hasDetectedMotif
        ? `Đã tự động đọc ảnh mẫu: Nhận diện ${detectedGlazeName}, bóc tách hoa văn vẽ tay trong suốt và áp dụng viền miệng ${detectedRimStyle === 'gold' ? 'chỉ vàng' : 'nâu da lươn'}.`
        : `Đã tự động đọc ảnh mẫu: Nhận diện ${detectedGlazeName} với viền miệng ${detectedRimStyle === 'none' ? 'mộc' : 'caramel da lươn'}.`,
    };
  } catch (err) {
    console.error('Lỗi khi phân tích tiêu bản gốm:', err);
    return {
      success: false,
      message: err.message,
      glazeColor: '#EDE8DC',
      glazeName: 'Men Sứ Trắng Ngà',
      rimStyle: 'brown',
      pattern: 'none',
      patternImage: null,
    };
  }
}
