/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ─────────────────────────────────────────────────────────
      // CERAMIC BRAND — 5-Color System (Tối đa 5 màu)
      // 1. Paper / White:    #FCFCFC / #FFFFFF
      // 2. Charcoal:         #141414
      // 3. Neutral Stone:    #D9DCE1 (border) & #5C6068 (slate text)
      // 4. Terracotta:       #B85D38
      // ─────────────────────────────────────────────────────────
      colors: {
        ceramic: {
          // 1. Màu Nền & Bề Mặt
          white:    '#FFFFFF',
          paper:    '#FCFCFC',
          cream:    '#FCFCFC',
          beige:    '#FCFCFC',
          crackled: '#FCFCFC',

          // 2. Màu Chữ & Tương phản chính
          charcoal: '#141414',

          // 3. Màu Viền & Chữ phụ trung tính
          slate:    '#5C6068',
          warmGray: '#5C6068',
          border:    '#D9DCE1',
          borderAlt: '#D9DCE1',
          stone:    '#D9DCE1',
          linen:    '#D9DCE1',
          shadow:    '#D9DCE1',

          // 4. Bỏ hoàn toàn màu xanh - Quy chuẩn về Terracotta #B85D38
          cobalt:    '#B85D38',
          celadon:   '#B85D38',

          // 5. Màu Men Đất Nung (Accent highlight)
          terracotta:'#B85D38',
          amber:     '#B85D38',
        },
        // Semantic aliases
        brand: {
          primary:   '#B85D38',   // Terracotta (Màu nút bấm chính)
          secondary: '#B85D38',   // Terracotta
          accent:    '#B85D38',   // Terracotta
        },
        state: {
          success:   '#B85D38',   // Terracotta (bỏ màu xanh hoàn toàn)
          warning:   '#B85D38',   // Terracotta
          error:     '#B85D38',   // Terracotta
        },
      },

      // ─────────────────────────────────────────────────────────
      // Typography System — Editorial Ceramic Brand
      // Serif headings (heritage justified) + clean sans body
      // Fonts are self-hosted via @font-face in index.css
      // ─────────────────────────────────────────────────────────
      fontFamily: {
        // Editorial serif for headings (heritage/artisanal justification)
        editorial: ['Cormorant Garamond', 'Georgia', 'serif'],
        // Clean sans body — not Inter
        body: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        // Monospace for technical specs
        mono: ['Fira Code', 'Menlo', 'monospace'],
      },

      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1.25rem' }],   // 12
        sm:   ['0.875rem', { lineHeight: '1.375rem' }],  // 14
        base: ['1rem',     { lineHeight: '1.75rem' }],   // 16
        md:   ['1.125rem', { lineHeight: '1.85rem' }],   // 18
        lg:   ['1.25rem',  { lineHeight: '1.85rem' }],   // 20
        xl:   ['1.5rem',   { lineHeight: '2.25rem' }],   // 24
        '2xl':['1.75rem',  { lineHeight: '2.5rem' }],    // 28
        '3xl':['2.25rem',  { lineHeight: '3rem' }],     // 36
        '4xl':['3rem',     { lineHeight: '3.5rem' }],    // 48
        '5xl':['3.75rem',  { lineHeight: '1.1' }],        // 60
        '6xl':['4.5rem',   { lineHeight: '1.05' }],       // 72
      },

      // ─────────────────────────────────────────────────────────
      // Spacing — 4px grid system
      // ─────────────────────────────────────────────────────────
      spacing: {
        0: '0', 1: '0.25rem', 1.5: '0.375rem', 2: '0.5rem',
        2.5: '0.625rem', 3: '0.75rem', 3.5: '0.875rem', 4: '1rem',
        5: '1.25rem', 6: '1.5rem', 7: '1.75rem', 8: '2rem',
        9: '2.25rem', 10: '2.5rem', 11: '2.75rem', 12: '3rem',
        14: '3.5rem', 16: '4rem', 20: '5rem', 24: '6rem',
        28: '7rem', 32: '8rem', 40: '10rem', 48: '12rem',
        56: '14rem', 64: '16rem',
      },

      // ─────────────────────────────────────────────────────────
      // Elevation System — soft, paper-like layers
      // ─────────────────────────────────────────────────────────
      boxShadow: {
        paper: '0 1px 3px rgba(18, 18, 18, 0.04), 0 1px 2px rgba(18, 18, 18, 0.03)',
        card: '0 4px 12px -2px rgba(18, 18, 18, 0.06), 0 2px 6px -2px rgba(18, 18, 18, 0.05)',
        'card-hover': '0 12px 24px -4px rgba(18, 18, 18, 0.09), 0 6px 12px -4px rgba(18, 18, 18, 0.06)',
        floating: '0 20px 40px -15px rgba(18, 18, 18, 0.12)',
        bezel: 'inset 0 1px 1px rgba(255, 255, 255, 0.5), 0 12px 30px -8px rgba(0, 0, 0, 0.06)',
        'focus-ring': '0 0 0 3px',
      },

      // ─────────────────────────────────────────────────────────
      // Border Radius — ceramic curves
      // ─────────────────────────────────────────────────────────
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        full: '9999px',
      },

      // ─────────────────────────────────────────────────────────
      // Animation & Transition presets
      // ─────────────────────────────────────────────────────────
      transitionProperty: {
        'height': 'height', 'width': 'width', 'spacing': 'margin, padding',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
