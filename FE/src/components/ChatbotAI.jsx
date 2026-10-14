import React, { useState, useRef, useEffect } from 'react';

/* ──────────────────────────────────────────────────────────
   Cố Vấn Làng Nghề • Cụ Thành (Làng gốm Biên Hòa - Tân Vạn)
   Text-based artisan consultation window with extended UI.
   ────────────────────────────────────────────────────────── */

const CERAMIC_KNOWLEDGE = [
  'Trong nghệ thuật gốm Biên Hòa, dòng men xanh đồng trổ Vert de Biên Hòa là đỉnh cao danh tiếng thế giới từ triển lãm Paris 1925.',
  'Men xanh đồng pha từ oxit đồng, tro rơm nếp và quặng đá ong, nung lò rồng ở 1200°C - 1220°C cho sắc xanh ngọc ánh đồng rực rỡ.',
  'Kỹ thuật khắc chìm (champlevé) kết hợp chạm lộng và chấm men màu là linh hồn sáng tạo từ Trường Mỹ nghệ Biên Hòa 1903.',
  'Đất sét xám Tân Vạn dẻo dai, chịu lửa lò rồng tốt, co ngót khoảng 9-11% khi nung chín.',
  'Gợi ý từ nghệ nhân: giữ thành gốm dày 5-7mm để thuận lợi cho việc trổ nét khắc hoa văn mà không làm yếu cấu trúc.',
  'Họa tiết hoa cúc dây lá lật và hoa sen khắc chìm là biểu tượng vương giả trên các tác phẩm đôn voi Paris 1925.',
  'Bạn có thể vào mục "Phác thảo mẫu" để tính toán hình khối trực giao chuẩn xác trước khi lên bàn xoay.',
];

export default function ChatbotAI({
  isOpen: controlledIsOpen,
  setIsOpen: setControlledIsOpen,
  aiApiBase = 'http://localhost:8000',
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = setControlledIsOpen || setInternalIsOpen;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Kính chào bạn! Tôi là nhân viên tư vấn làng gốm Tân Vạn, Biên Hòa.\n\nBạn cần tư vấn về dòng men xanh đồng Vert de Biên Hòa, kỹ thuật khắc chìm chạm lộng hay đặt lịch đến workshop tại xưởng bên bờ sông Đồng Nai?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'Tư vấn men xanh đồng Vert de Biên Hòa',
        'Kỹ thuật khắc chìm champlevé',
        'Workshop nặn gốm tại Tân Vạn',
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
      const res = await fetch(`${aiApiBase}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-4),
        }),
      });

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
      } else {
        throw new Error('Không nhận được phản hồi');
      }
    } catch (err) {
      // Fallback to built-in ceramic knowledge engine
      const fallback =
        CERAMIC_KNOWLEDGE[Math.floor(Math.random() * CERAMIC_KNOWLEDGE.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `[Nghệ nhân Thành]: ${fallback}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: [
            'Xem phác thảo mẫu',
            'Men xanh đồng Vert de Biên Hòa',
            'Đặt lịch xưởng Tân Vạn',
          ],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Nếu không mở thì không render giao diện
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`
        z-50 select-none flex flex-col bg-ceramic-paper shadow-card transition-all duration-300
        ${isFullscreen
          ? 'fixed inset-0 w-screen h-[100dvh] max-h-none rounded-none border-none'
          : 'fixed left-4 lg:left-[17.5rem] bottom-4 w-[calc(100vw-2rem)] sm:w-[430px] h-[85vh] max-h-[850px] min-h-[580px] rounded-2xl border border-ceramic-border animate-in fade-in slide-in-from-bottom-4'
        }
        overflow-hidden
      `}
      role="dialog"
      aria-label="Cửa sổ tư vấn nghệ nhân gốm Biên Hòa"
    >
      {/* ── Header ── */}
      <div className="bg-ceramic-terracotta text-ceramic-paper px-4 py-3.5 flex items-center justify-between border-b border-ceramic-border/30">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-ceramic-paper/20 text-ceramic-paper flex items-center justify-center font-editorial text-base font-bold shadow-paper border border-ceramic-paper/30">
              T
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-ceramic-paper ring-2 ring-ceramic-terracotta" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] text-ceramic-cream/75 truncate">
              Làng gốm Biên Hòa - Tân Vạn, Đồng Nai
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 text-ceramic-cream/70">
          {/* Nút Toàn màn hình / Thu nhỏ */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="w-8 h-8 rounded-lg hover:bg-ceramic-paper/10 hover:text-ceramic-paper flex items-center justify-center transition-colors focus:outline-none"
            aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
          >
            {isFullscreen ? (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>

          {/* Nút Đóng */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg hover:bg-ceramic-paper/10 hover:text-ceramic-paper flex items-center justify-center transition-colors focus:outline-none"
            aria-label="Đóng tư vấn"
            title="Đóng tư vấn"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages Body ── */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-ceramic-cream/30 text-xs">
        <div className={`space-y-3.5 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}`}>
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onSelectPrompt={handleSend} />
          ))}

          {isLoading && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Box ── */}
      <div className="p-3 bg-ceramic-paper border-t border-ceramic-border">
        <div className={`${isFullscreen ? 'max-w-4xl mx-auto' : ''}`}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Hỏi về men Vert de Biên Hòa, tạo hình, nung lò..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
              className="
                flex-1 text-xs px-3.5 py-2.5 bg-ceramic-cream rounded-xl
                border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta focus:ring-1 focus:ring-ceramic-terracotta
                text-ceramic-charcoal placeholder-ceramic-slate/70 font-body transition-all
              "
              aria-label="Nhắn tin tư vấn"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="
                w-9 h-9 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-terracotta/90 disabled:opacity-40
                text-ceramic-paper flex items-center justify-center transition-colors shadow-paper flex-shrink-0
              "
              aria-label="Gửi tin nhắn"
              title="Gửi"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Message Bubble sub-component
   ────────────────────────────────────────────────────────── */
function MessageBubble({ message, onSelectPrompt }) {
  const isBot = message.sender === 'bot';
  const bubbleClasses = isBot
    ? 'bg-ceramic-paper text-ceramic-charcoal border border-ceramic-border/80 shadow-paper'
    : 'bg-ceramic-terracotta text-ceramic-paper shadow-paper';

  return (
    <div
      className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
    >
      {isBot && (
        <div className="w-6 h-6 rounded-lg bg-ceramic-terracotta text-ceramic-paper flex-shrink-0 flex items-center justify-center text-[10px] font-editorial font-bold shadow-paper">
          T
        </div>
      )}
      <div
        className={`
          max-w-[84%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap
          ${bubbleClasses}
        `}
      >
        <div className="font-body text-xs">{message.text}</div>
        <div
          className={`text-[9px] mt-1.5 font-mono text-right ${isBot ? 'text-ceramic-slate/50' : 'text-ceramic-cream/60'
            }`}
        >
          {message.time}
        </div>

        {/* Post-bot suggestions */}
        {message.suggestions && message.suggestions.length > 0 && isBot && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-ceramic-border/50">
            {message.suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt && onSelectPrompt(s)}
                className="text-[10.5px] font-mono px-2.5 py-1 rounded-md bg-ceramic-cream hover:bg-ceramic-border/40 text-ceramic-slate border border-ceramic-border transition-colors text-left"
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

/* ──────────────────────────────────────────────────────────
   Loading indicator sub-component
   ────────────────────────────────────────────────────────── */
function LoadingDots() {
  return (
    <div className="flex gap-2.5 items-center text-ceramic-slate text-xs">
      <div className="w-6 h-6 rounded-lg bg-ceramic-terracotta text-ceramic-paper flex-shrink-0 flex items-center justify-center text-[10px] font-editorial font-bold shadow-paper">
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
