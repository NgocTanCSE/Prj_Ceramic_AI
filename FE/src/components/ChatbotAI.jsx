import React, { useState, useRef, useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useDesign } from '../contexts/DesignContext';

/* ──────────────────────────────────────────────────────────
   Trợ Lý AI Gốm Biên Hòa (Đồng Nai)
   Tích hợp DeepSeek API thời gian thực, hiểu ngữ cảnh đàm thoại
   nhiều lượt (multi-turn), ghi nhớ dáng gốm, kích thước cm,
   men nung lò rồng và tạo đặc tả chuyển giao trực tiếp vào Xưởng 3D.
   ────────────────────────────────────────────────────────── */

export default function ChatbotAI({
  isOpen: controlledIsOpen,
  setIsOpen: setControlledIsOpen,
  aiApiBase = import.meta.env.VITE_AI_API_BASE_URL || '',
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = setControlledIsOpen || setInternalIsOpen;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { setActiveTab } = useNavigation();
  const {
    setModelType,
    setGlazeColor,
    setGlazeName,
    setPattern,
    setPendingAiDraft,
  } = useDesign();

  // Active ceramic spec tracked from conversation
  const [activeSpec, setActiveSpec] = useState(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Kính chào bạn! Tôi là Trợ lý AI của Làng Gốm Biên Hòa - Tân Vạn (Đồng Nai).\n\nTôi sẵn sàng tư vấn về dáng phôi (bình hoa, cốc gốm, bát thiền, đĩa mỹ nghệ), phối men truyền thống (Vert de Biên Hòa, Đá đỏ Bazan, Vàng Hoàng Yến, Trắng rạn), kỹ thuật nung lò rồng 1220°C hay hỗ trợ bạn đặt lịch trải nghiệm workshop. Bạn đang ấp ủ ý tưởng gốm nào hôm nay?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Tôi muốn thiết kế một chiếc bình hoa 30cm',
        'Tư vấn men xanh đồng Vert de Biên Hòa',
        'Tôi muốn đặt lịch workshop xưởng Tân Vạn',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isFullscreen, isLoading]);

  // ── Chuyển giao thông số sang Phác thảo AI Co-Creator hoặc Studio 3D ──
  const handleApplySpec = (spec, destination = 'ai-creator') => {
    if (!spec) return;
    const height = Number(spec.heightCm) || 22;
    const diameter = Number(spec.diameterCm) || (spec.archetype === 'mug' ? 9 : spec.archetype === 'bowl' ? 14 : spec.archetype === 'plate' ? 20 : 12);

    if (setPendingAiDraft) {
      setPendingAiDraft({
        prompt: spec.userQuery || `Thiết kế ${spec.archetypeName || spec.archetype || 'gốm'} cao ${height}cm`,
        archetype: spec.archetype || 'vase',
        height: height,
        maxRadius: Math.round(diameter / 2),
        glazeHex: spec.glazeHex || '#2A6B5C',
        glazeName: spec.glazeName || 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
        pattern: spec.pattern || 'sen_co',
        customText: spec.customText || '',
      });
    }

    if (spec.archetype && setModelType) setModelType(spec.archetype);
    if (spec.glazeHex && setGlazeColor) setGlazeColor(spec.glazeHex);
    if (spec.glazeName && setGlazeName) setGlazeName(spec.glazeName);
    if (spec.pattern && setPattern) setPattern(spec.pattern);

    setActiveTab(destination);
    setIsOpen(false);
  };

  // ── Reset conversation ──
  const handleReset = () => {
    setActiveSpec(null);
    setLastError(null);
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: 'Cuộc trò chuyện đã được làm mới. Bạn cần hỗ trợ tư vấn thiết kế gốm, chọn men hay đặt lịch trải nghiệm xưởng?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'Tạo một chiếc bình hoa cao 30cm dáng thon',
          'Tư vấn men xanh đồng trổ',
          'Đặt lịch trải nghiệm workshop làm gốm',
        ],
      },
    ]);
  };

  // ── Send Message Handler ──
  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    // Fast UI actions from suggestion pills
    if (query === 'Chuyển sang Phác thảo AI' || query === 'Tạo 3D ngay' || query === 'Tạo mô hình 3D') {
      if (activeSpec) {
        handleApplySpec(activeSpec, 'ai-creator');
      } else {
        setActiveTab('ai-creator');
        setIsOpen(false);
      }
      return;
    }
    if (query === 'Mở trong Xưởng 3D' || query === 'Mở trong Xưởng tạo hình 3D') {
      if (activeSpec) {
        handleApplySpec(activeSpec, 'studio-3d');
      } else {
        setActiveTab('studio-3d');
        setIsOpen(false);
      }
      return;
    }
    if (query === 'Chuyển sang trang Đặt lịch' || query === 'Xem trang Đặt lịch') {
      setActiveTab('schedule');
      setIsOpen(false);
      return;
    }
    if (query === 'Xem danh mục gốm' || query === 'Thư viện mẫu gốm') {
      setActiveTab('library');
      setIsOpen(false);
      return;
    }

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setIsLoading(true);
    setLastError(null);

    // Build history for multi-turn reasoning
    const historyPayload = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);

      const endpoint = `${aiApiBase}/api/ai/chat`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: historyPayload,
        }),
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (res.ok && data && data.success && data.reply) {
        if (data.spec) {
          data.spec.userQuery = query;
          setActiveSpec(data.spec);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestions: data.suggestions || [],
            spec: data.spec || null,
            specReady: Boolean(data.specReady),
            booking: data.booking || null,
            provider: data.provider || 'deepseek',
          },
        ]);
        return;
      }

      // Handle structured error from server
      const errorMsg = data?.reply || (res.status === 503
        ? 'Dịch vụ AI DeepSeek chưa được cấu hình khóa API Key trên máy chủ. Vui lòng thiết lập biến môi trường DEEPSEEK_API_KEY trên Vercel.'
        : `Lỗi kết nối máy chủ AI (${res.status}). Vui lòng bấm thử lại.`);

      setLastError(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          isError: true,
          text: errorMsg,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: ['Thử lại', 'Mở Xưởng 3D', 'Xem trang Đặt lịch'],
        },
      ]);
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const errMsg = isTimeout
        ? 'Yêu cầu kết nối AI quá thời gian chờ (hơn 22 giây). Vui lòng kiểm tra mạng hoặc thử lại.'
        : 'Không thể kết nối đến máy chủ AI backend. Vui lòng kiểm tra kết nối mạng.';

      setLastError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          isError: true,
          text: errMsg,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: ['Thử lại', 'Vào Xưởng 3D', 'Xem trang Đặt lịch'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`
        z-50 flex flex-col bg-ceramic-paper shadow-2xl transition-all duration-300
        ${isFullscreen
          ? 'fixed inset-0 w-screen h-[100dvh] max-h-none rounded-none border-none'
          : 'fixed left-3 sm:left-4 lg:left-[17.5rem] bottom-3 sm:bottom-4 w-[calc(100vw-1.5rem)] sm:w-[440px] h-[80vh] max-h-[780px] min-h-[520px] rounded-3xl border border-ceramic-border animate-in fade-in slide-in-from-bottom-4'
        }
        overflow-hidden
      `}
      role="dialog"
      aria-label="Cửa sổ tư vấn nghệ nhân gốm Biên Hòa"
    >
      {/* ── Header ── */}
      <div className="bg-ceramic-terracotta text-ceramic-paper px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-ceramic-border/30 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-ceramic-paper/20 text-ceramic-paper flex items-center justify-center font-editorial text-sm sm:text-base font-bold shadow-paper border border-ceramic-paper/30">
              G
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-ceramic-terracotta" />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-editorial text-sm sm:text-base font-bold leading-tight truncate">
              Trợ Lý AI • Gốm Biên Hòa
            </h3>
            <div className="text-[10px] text-ceramic-cream/90 truncate font-mono">
              DeepSeek AI • Làng gốm Tân Vạn
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleReset}
            title="Bắt đầu hội thoại mới"
            className="w-8 h-8 rounded-xl bg-ceramic-paper/15 hover:bg-ceramic-paper/30 active:scale-95 text-ceramic-paper flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            className="hidden sm:flex w-8 h-8 rounded-xl bg-ceramic-paper/15 hover:bg-ceramic-paper/30 active:scale-95 text-ceramic-paper items-center justify-center text-xs transition-colors cursor-pointer"
          >
            {isFullscreen ? '⤦' : '⤢'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title="Đóng cửa sổ tư vấn"
            className="w-8 h-8 rounded-xl bg-ceramic-paper/15 hover:bg-ceramic-paper/30 active:scale-95 text-ceramic-paper flex items-center justify-center text-lg transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Active Specs Banner (nếu có đặc tả gốm) ── */}
      {activeSpec && (
        <div className="bg-ceramic-cream px-3.5 py-2 border-b border-ceramic-border flex items-center justify-between text-[11px] font-mono text-ceramic-slate flex-shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-ceramic-charcoal">Đặc tả:</span>
            <span className="text-ceramic-terracotta font-semibold truncate">
              {activeSpec.archetypeName || activeSpec.archetype || 'Sản phẩm'}
              {activeSpec.heightCm ? ` • ${activeSpec.heightCm}cm` : ''}
              {activeSpec.glazeName ? ` • ${activeSpec.glazeName.split(' ')[0]}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleApplySpec(activeSpec, 'ai-creator')}
            className="text-[10px] bg-ceramic-terracotta text-ceramic-paper px-2.5 py-1 rounded font-semibold hover:bg-ceramic-charcoal transition-colors cursor-pointer flex-shrink-0"
          >
            Tạo 3D ({activeSpec.heightCm || 22}cm) →
          </button>
        </div>
      )}

      {/* ── Messages Container ── */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-ceramic-paper/50 font-body">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onSelectPrompt={handleSend}
            onApplySpec={handleApplySpec}
            onNavigateTab={setActiveTab}
          />
        ))}
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Box ── */}
      <div className="p-2.5 sm:p-3 bg-ceramic-paper border-t border-ceramic-border flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-ceramic-cream rounded-2xl p-1.5 border border-ceramic-border focus-within:border-ceramic-terracotta focus-within:ring-1 focus-within:ring-ceramic-terracotta/30 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi về men gốm, kích thước hoặc đặt lịch..."
            className="flex-1 text-xs sm:text-sm px-2.5 py-1.5 sm:py-2 bg-transparent outline-none text-ceramic-charcoal placeholder-ceramic-slate/70 font-body min-h-[36px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="min-w-[40px] min-h-[40px] sm:w-9 sm:h-9 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal disabled:opacity-40 text-ceramic-paper flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            aria-label="Gửi tin nhắn"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message, onSelectPrompt, onApplySpec, onNavigateTab }) {
  const isBot = message.sender === 'bot';
  const isError = Boolean(message.isError);

  const bubbleClasses = isError
    ? 'bg-amber-50 text-amber-900 border border-amber-200'
    : isBot
      ? 'bg-ceramic-paper text-ceramic-charcoal border border-ceramic-border shadow-paper'
      : 'bg-ceramic-terracotta text-ceramic-paper shadow-paper';

  return (
    <div className={`flex gap-2 sm:gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div className={`w-7 h-7 rounded-xl ${isError ? 'bg-amber-600' : 'bg-ceramic-terracotta'} text-ceramic-paper flex-shrink-0 flex items-center justify-center text-xs font-editorial font-bold shadow-paper mt-0.5`}>
          {isError ? '!' : 'G'}
        </div>
      )}
      <div className={`max-w-[88%] sm:max-w-[85%] p-3 sm:p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${bubbleClasses}`}>
        <div className="font-body text-xs sm:text-[13px] leading-relaxed break-words">{message.text}</div>

        {/* ── Action Card for 3D Spec ── */}
        {message.spec && message.specReady && (
          <div className="mt-3 p-3 rounded-xl bg-ceramic-cream/90 border border-ceramic-border space-y-2 text-ceramic-charcoal shadow-paper">
            <div className="text-[11px] font-mono font-bold text-ceramic-terracotta flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ĐẶC TẢ THIẾT KẾ ĐÃ SẴN SÀNG
              </span>
              <span className="text-[10px] text-ceramic-slate font-normal">DeepSeek</span>
            </div>
            <div className="text-[11px] font-mono text-ceramic-slate space-y-1 bg-ceramic-paper/80 p-2.5 rounded-lg border border-ceramic-border/60">
              <div className="flex justify-between">
                <span>• Dáng phôi:</span>
                <strong className="text-ceramic-charcoal">{message.spec.archetypeName || message.spec.archetype}</strong>
              </div>
              {message.spec.heightCm && (
                <div className="flex justify-between">
                  <span>• Chiều cao:</span>
                  <strong className="text-ceramic-terracotta">{message.spec.heightCm} cm</strong>
                </div>
              )}
              {message.spec.glazeName && (
                <div className="flex justify-between">
                  <span>• Sắc men:</span>
                  <strong className="text-ceramic-charcoal truncate max-w-[150px]">{message.spec.glazeName}</strong>
                </div>
              )}
              {message.spec.pattern && (
                <div className="flex justify-between">
                  <span>• Họa tiết:</span>
                  <strong className="text-ceramic-charcoal">{message.spec.patternName || message.spec.pattern}</strong>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onApplySpec(message.spec, 'ai-creator')}
                className="py-2.5 px-3 bg-ceramic-terracotta hover:bg-ceramic-charcoal active:scale-98 text-ceramic-paper text-xs font-mono rounded-lg transition-colors font-semibold shadow-paper cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
              >
                Tạo 3D ({message.spec.heightCm || 22}cm) →
              </button>
              <button
                type="button"
                onClick={() => onApplySpec(message.spec, 'studio-3d')}
                className="py-2.5 px-3 bg-ceramic-paper hover:bg-ceramic-cream active:scale-98 text-ceramic-charcoal border border-ceramic-border text-xs font-mono rounded-lg transition-colors font-semibold shadow-paper cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
              >
                Mở Xưởng 3D ⚒
              </button>
            </div>
          </div>
        )}

        {/* ── Action Card for Workshop / Visit Booking ── */}
        {message.booking && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 space-y-2 text-emerald-950">
            <div className="text-[11px] font-mono font-bold text-emerald-800 flex items-center gap-1.5">
              <span>📅 ĐẶT LỊCH XƯỞNG TÂN VẠN</span>
            </div>
            <div className="text-[11px] font-mono text-emerald-800/80">
              {message.booking.type === 'visit'
                ? 'Tham quan ngắm mẫu tại showroom Biên Hòa'
                : 'Workshop làm gốm vuốt đất cùng nghệ nhân'}
              {message.booking.partySize ? ` (${message.booking.partySize} người)` : ''}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('schedule')}
              className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono rounded-lg transition-colors font-semibold shadow-paper cursor-pointer flex items-center justify-center min-h-[40px]"
            >
              Chuyển sang trang Đặt lịch →
            </button>
          </div>
        )}

        <div className={`text-[9px] mt-1.5 font-mono text-right ${isBot ? 'text-ceramic-slate/60' : 'text-ceramic-cream/80'}`}>
          {message.time}
        </div>

        {/* ── Suggestions Pills ── */}
        {message.suggestions && message.suggestions.length > 0 && isBot && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-ceramic-border/50">
            {message.suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt && onSelectPrompt(s)}
                className="text-[10.5px] font-mono px-2.5 py-1.5 rounded-lg bg-ceramic-cream hover:bg-ceramic-border/60 text-ceramic-slate hover:text-ceramic-charcoal border border-ceramic-border transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-2.5 items-center text-ceramic-slate text-xs">
      <div className="w-7 h-7 rounded-xl bg-ceramic-terracotta text-ceramic-paper flex-shrink-0 flex items-center justify-center text-xs font-editorial font-bold shadow-paper">
        G
      </div>
      <div className="bg-ceramic-paper px-3.5 py-2.5 rounded-xl border border-ceramic-border flex items-center gap-1.5 shadow-paper">
        <span className="text-[11px] font-mono text-ceramic-slate mr-1">DeepSeek đang suy nghĩ...</span>
        <span className="w-1.5 h-1.5 bg-ceramic-terracotta animate-pulse rounded-full" />
        <span className="w-1.5 h-1.5 bg-ceramic-terracotta animate-pulse [animation-delay:0.2s] rounded-full" />
        <span className="w-1.5 h-1.5 bg-ceramic-terracotta animate-pulse [animation-delay:0.4s] rounded-full" />
      </div>
    </div>
  );
}
