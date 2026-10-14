import React, { useState, useRef, useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useDesign } from '../contexts/DesignContext';
import { CeramicAdvisorEngine } from '../utils/ceramicChatAdvisor';

/* ──────────────────────────────────────────────────────────
   Cố Vấn Làng Nghề • Cụ Thành (Làng gốm Biên Hòa - Tân Vạn)
   Hệ thống trò chuyện tư vấn thông minh, hiểu rõ ngữ cảnh
   nhiều lượt (multi-turn), ghi nhớ dáng phôi, kích thước,
   sắc men và hoa văn mà người dùng lựa chọn.
   ────────────────────────────────────────────────────────── */

export default function ChatbotAI({
  isOpen: controlledIsOpen,
  setIsOpen: setControlledIsOpen,
  aiApiBase = 'http://localhost:8000',
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = setControlledIsOpen || setInternalIsOpen;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { setActiveTab } = useNavigation();
  const { setModelType, setGlazeColor, setGlazeName } = useDesign();

  // Multi-turn ceramic context engine
  const advisorEngineRef = useRef(new CeramicAdvisorEngine());

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Kính chào bạn! Tôi là Cụ Thành — Nghệ nhân làng gốm Tân Vạn, Biên Hòa.\n\nTôi có thể tư vấn cho bạn về dáng phôi (bình hoa, cốc, bát thiền), cách chọn kích thước cân đối, dòng men xanh đồng Vert de Biên Hòa hay kỹ thuật khắc chìm champlevé. Bạn đang dự tính làm sản phẩm gốm nào?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Tôi muốn làm một chiếc bình hoa',
        'Tôi muốn tạo một chiếc cốc gốm',
        'Tư vấn men xanh đồng Vert de Biên Hòa',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isFullscreen]);

  // ── Message send handler ──
  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    // Check special quick action triggers from suggestion pills
    if (query === 'Chuyển sang Phác thảo AI') {
      setActiveTab('ai-creator');
      setIsOpen(false);
      return;
    }
    if (query === 'Mở trong Xưởng tạo hình 3D') {
      const ctx = advisorEngineRef.current.context;
      if (ctx.archetype && setModelType) setModelType(ctx.archetype);
      if (ctx.glazeHex && setGlazeColor) setGlazeColor(ctx.glazeHex);
      if (ctx.glaze && setGlazeName) setGlazeName(ctx.glaze);
      setActiveTab('studio-3d');
      setIsOpen(false);
      return;
    }
    if (query === 'Chuyển sang trang Đặt lịch') {
      setActiveTab('schedule');
      setIsOpen(false);
      return;
    }
    if (query === 'Khám phá video phóng sự xưởng') {
      setActiveTab('heritage');
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

    try {
      // Try backend with a fast 2.5s timeout; fall back gracefully to client CeramicAdvisorEngine
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${aiApiBase}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: messages.slice(-4),
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestions: data.suggestions || [],
          },
        ]);
        return;
      }
      throw new Error('API reply invalid');
    } catch (_) {
      // Built-in Contextual Ceramic Intelligence Engine
      const advice = advisorEngineRef.current.processMessage(query);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: advice.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: advice.suggestions || [],
          specReady: advice.specReady || false,
          context: advice.context || null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySpec = (contextData) => {
    if (!contextData) return;
    if (contextData.archetype && setModelType) setModelType(contextData.archetype);
    if (contextData.glazeHex && setGlazeColor) setGlazeColor(contextData.glazeHex);
    if (contextData.glaze && setGlazeName) setGlazeName(contextData.glaze);
    setActiveTab('studio-3d');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`
        z-50 select-none flex flex-col bg-ceramic-paper shadow-card transition-all duration-300
        ${isFullscreen
          ? 'fixed inset-0 w-screen h-[100dvh] max-h-none rounded-none border-none'
          : 'fixed left-4 lg:left-[17.5rem] bottom-4 w-[calc(100vw-2rem)] sm:w-[440px] h-[85vh] max-h-[850px] min-h-[580px] rounded-3xl border border-ceramic-border animate-in fade-in slide-in-from-bottom-4'
        }
        overflow-hidden
      `}
      role="dialog"
      aria-label="Cửa sổ tư vấn nghệ nhân gốm Biên Hòa"
    >
      {/* ── Header ── */}
      <div className="bg-ceramic-terracotta text-ceramic-paper px-5 py-4 flex items-center justify-between border-b border-ceramic-border/30">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-ceramic-paper/20 text-ceramic-paper flex items-center justify-center font-editorial text-base font-bold shadow-paper border border-ceramic-paper/30">
              T
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-ceramic-terracotta" />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-editorial text-base font-bold leading-none tracking-tight">
              Cụ Thành • Nghệ Nhân Gốm
            </h3>
            <div className="text-[10px] text-ceramic-cream/80 truncate mt-1 font-mono">
              Làng gốm Biên Hòa - Tân Vạn, Đồng Nai
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => advisorEngineRef.current.reset()}
            title="Bắt đầu hội thoại mới"
            className="w-7 h-7 rounded-lg bg-ceramic-paper/10 hover:bg-ceramic-paper/25 text-ceramic-paper flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            className="w-7 h-7 rounded-lg bg-ceramic-paper/10 hover:bg-ceramic-paper/25 text-ceramic-paper flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            {isFullscreen ? '⤦' : '⤢'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title="Đóng cửa sổ tư vấn"
            className="w-7 h-7 rounded-lg bg-ceramic-paper/10 hover:bg-ceramic-paper/25 text-ceramic-paper flex items-center justify-center text-base transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Contextual Active Specs Pill (nếu đã nhận diện được) ── */}
      {advisorEngineRef.current.context.archetype && (
        <div className="bg-ceramic-cream px-4 py-2 border-b border-ceramic-border flex items-center justify-between text-[11px] font-mono text-ceramic-slate">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-ceramic-charcoal">Đang thiết kế:</span>
            <span className="text-ceramic-terracotta font-semibold truncate">
              {advisorEngineRef.current.context.archetypeName || 'Sản phẩm gốm'}
              {advisorEngineRef.current.context.height ? ` • ${advisorEngineRef.current.context.height}` : ''}
              {advisorEngineRef.current.context.glaze ? ` • ${advisorEngineRef.current.context.glaze.split(' ')[0]}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => advisorEngineRef.current.reset()}
            className="text-[10px] text-ceramic-slate hover:text-ceramic-charcoal underline cursor-pointer flex-shrink-0"
          >
            Đổi mẫu
          </button>
        </div>
      )}

      {/* ── Messages Container ── */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-ceramic-paper/50 font-body">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onSelectPrompt={handleSend}
            onApplySpec={handleApplySpec}
          />
        ))}
        {isLoading && <LoadingDots />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Box ── */}
      <div className="p-3 bg-ceramic-paper border-t border-ceramic-border">
        <div className="flex items-center gap-2 bg-ceramic-cream rounded-2xl p-1.5 border border-ceramic-border focus-within:border-ceramic-terracotta focus-within:ring-1 focus-within:ring-ceramic-terracotta/30 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Hỏi về men gốm, kích thước hoặc kỹ thuật..."
            className="flex-1 text-xs px-3 py-2 bg-transparent outline-none text-ceramic-charcoal placeholder-ceramic-slate/70 font-body"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal disabled:opacity-40 text-ceramic-paper flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            aria-label="Gửi tin nhắn"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onSelectPrompt, onApplySpec }) {
  const isBot = message.sender === 'bot';
  const bubbleClasses = isBot
    ? 'bg-ceramic-paper text-ceramic-charcoal border border-ceramic-border shadow-paper'
    : 'bg-ceramic-terracotta text-ceramic-paper shadow-paper';

  return (
    <div className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div className="w-7 h-7 rounded-xl bg-ceramic-terracotta text-ceramic-paper flex-shrink-0 flex items-center justify-center text-xs font-editorial font-bold shadow-paper mt-0.5">
          T
        </div>
      )}
      <div className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${bubbleClasses}`}>
        <div className="font-body text-xs leading-relaxed">{message.text}</div>

        {/* Action card if specification is finalized */}
        {message.specReady && message.context && (
          <div className="mt-3 p-2.5 rounded-xl bg-ceramic-cream/90 border border-ceramic-border space-y-2">
            <div className="text-[11px] font-mono font-bold text-ceramic-charcoal">
              ✓ ĐẶC TẢ KỸ THUẬT ĐÃ SẴN SÀNG
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onApplySpec(message.context)}
                className="flex-1 py-1.5 px-2 bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-[10px] font-mono rounded-lg transition-colors font-semibold shadow-paper cursor-pointer"
              >
                Mở trong Xưởng 3D →
              </button>
            </div>
          </div>
        )}

        <div className={`text-[9px] mt-1.5 font-mono text-right ${isBot ? 'text-ceramic-slate/60' : 'text-ceramic-cream/70'}`}>
          {message.time}
        </div>

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && isBot && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-ceramic-border/50">
            {message.suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt && onSelectPrompt(s)}
                className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-ceramic-cream hover:bg-ceramic-border/50 text-ceramic-slate hover:text-ceramic-charcoal border border-ceramic-border transition-colors text-left cursor-pointer"
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

function LoadingDots() {
  return (
    <div className="flex gap-2.5 items-center text-ceramic-slate text-xs">
      <div className="w-7 h-7 rounded-xl bg-ceramic-terracotta text-ceramic-paper flex-shrink-0 flex items-center justify-center text-xs font-editorial font-bold shadow-paper">
        T
      </div>
      <div className="bg-ceramic-paper px-3 py-2 rounded-xl border border-ceramic-border flex items-center gap-1.5 shadow-paper">
        <span className="w-1.5 h-1.5 bg-ceramic-slate animate-pulse rounded-full" />
        <span className="w-1.5 h-1.5 bg-ceramic-slate animate-pulse [animation-delay:0.2s] rounded-full" />
        <span className="w-1.5 h-1.5 bg-ceramic-slate animate-pulse [animation-delay:0.4s] rounded-full" />
      </div>
    </div>
  );
}
