/**
 * textNormalizer.js
 *
 * Universal text-on-pottery normalizer.
 *
 * Mục tiêu: "nhập kiểu gì cũng tạo ra được chung chung" — dán bất kỳ string nào
 * (unicode có dấu, emoji, câu dài, nhiều từ) lên thân gốm mà không bị tràn khung,
 * chữ nhỏ quá nhỏ (tạo "đại") hay cắt chữ.
 *
 * Cơ chế (browser):
 *  - Dùng offscreen canvas `measureText` để đo thực tế.
 *  - Thay vì vẽ 1 dòng dài 1 lần thuẫng fontSize cố định (44) rồi tràn, ta:
 *    1. Tách thành dòng theo `\n` rồi greedy-wrap sao cho mỗi dòng ròng < maxWidth.
 *    2. Tìm fontSize lớn nhất sao cho dòng dài nhất vừa vừa trong ngưỡng (binary search).
 *    3. Trả về { lines[], fontSize, lineHeight }.
 *
 * Fallback (no canvas / SSR): wrap theo độ dài ký tự để vẫn "chạy được chung chung".
 */

let _measureCanvas = null;
let _measureCtx = null;
function getMeasureCtx(fontCss) {
  if (typeof document === 'undefined') return null;
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCtx = _measureCanvas.getContext('2d');
  }
  _measureCtx.font = fontCss;
  return _measureCtx;
}

const DEFAULT_FAMILY = '"Cormorant Garamond", Georgia, serif';
const DEFAULT_MAX_WIDTH = 500; // px — chiều rộng tính trên texture 1024, để lại lề trái/phải
const DEFAULT_MAX_LINES = 6;
const DEFAULT_BASE_FONT_SIZE = 52; // điểm khởi đầu binary-search

/**
 * @param {string} text
 * @param {object} options
 * @returns {{ lines: string[], fontSize: number, lineHeight: number, textWidth: number, scale: number }}
 */
export function normalizeTextForPottery(text, options = {}) {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxLines = DEFAULT_MAX_LINES,
    baseFontSize = DEFAULT_BASE_FONT_SIZE,
    fontStyle = 'italic',
    fontWeight = '700',
    fontFamily = DEFAULT_FAMILY,
  } = options;

  const raw = (text == null ? '' : String(text)).trim();
  if (!raw) {
    return { lines: [], fontSize: 0, lineHeight: 0, textWidth: 0, scale: 0 };
  }

  const ctx = getMeasureCtx(`${fontStyle} ${fontWeight} ${baseFontSize}px ${fontFamily}`);

  // Greedy wrap theo chiều rộng thực (measureText) — rủi ro trường hợp canvas thiếu thời gian
  // được giữ lại (font chưa load): dùng fallback char-count.
  let lines;
  if (ctx) {
    lines = greedyWrap(ctx, raw, maxWidth, maxLines);
  } else {
    lines = fallbackWrap(raw, maxWidth, maxLines, baseFontSize);
  }

  // Binary search tìm fontSize lớn nhất để dòng dài nhất ≤ maxWidth (giữa 14..baseFontSize)
  let fontSize = baseFontSize;
  if (ctx && lines.length > 0 && lines.length <= maxLines) {
    let lo = 14, hi = baseFontSize, best = 14;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const w = measureLineWidth(ctx, lines, `${fontStyle} ${fontWeight} ${mid}px ${fontFamily}`);
      if (w <= maxWidth) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    fontSize = Math.max(14, best);
  } else if (!ctx) {
    // fallback: scale fontSize tỉ lệ theo số dòng
    const ratio = Math.min(1, maxLines / Math.max(1, lines.length));
    fontSize = Math.max(14, Math.round(baseFontSize * ratio * 0.82));
  }

  const finalLines = lines.slice(0, maxLines);
  const lineHeight = Math.round(fontSize * 1.2);
  const textWidth = ctx ? measureLineWidth(ctx, finalLines, `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`) : maxWidth;
  return {
    lines: finalLines,
    fontSize,
    lineHeight,
    textWidth: Math.round(textWidth),
    scale: fontSize / baseFontSize,
  };
}

// ---- internals ----
function measureLineWidth(ctx, lines, fontCss) {
  ctx.font = fontCss;
  let max = 0;
  for (const ln of lines) {
    if (ln) max = Math.max(max, ctx.measureText(ln).width);
  }
  return max;
}

function greedyWrap(ctx, text, maxWidth, maxLines) {
  ctx.font = `${DEFAULT_BASE_FONT_SIZE}px ${DEFAULT_FAMILY}`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const push = (s) => { if (s.trim()) lines.push(s.trim()); };
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    const w = ctx.measureText(candidate).width;
    if (w > maxWidth && cur) {
      push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
    // nếu từ đơn còn vượ quá, cắt thành nhỏ (hyphenate)
    if (ctx.measureText(cur).width > maxWidth && !cur.includes(' ')) {
      const broke = hardSplitWord(ctx, cur, maxWidth);
      push(broke.taken);
      cur = broke.rest;
    }
  }
  push(cur);
  return lines.length ? lines : [text];
}

function hardSplitWord(ctx, word, maxWidth) {
  // cắt từ quá dài thành từng đoạn vừa maxWidth
  let taken = '';
  let i = 0;
  while (i < word.length) {
    taken = word.slice(0, i + 1);
    if (ctx.measureText(taken).width > maxWidth) {
      taken = word.slice(0, i);
      return { taken, rest: word.slice(i) };
    }
    i++;
  }
  return { taken: word, rest: '' };
}

function fallbackWrap(text, maxWidth, maxLines, baseFontSize) {
  // ~7 chars mỗi 100px ở baseFontSize 52 — ước lượng an toàn khi không có canvas
  const charsPerLine = Math.max(2, Math.round((maxWidth / 100) * 7));
  const lines = [];
  const paragraphs = text.split(/\n+/);
  for (const para of paragraphs) {
    for (let i = 0; i < para.length; i += charsPerLine) {
      lines.push(para.slice(i, i + charsPerLine));
    }
    lines.push('');
  }
  return lines.filter((l, i, a) => i === 0 || l || a[i - 1] !== '');
}
