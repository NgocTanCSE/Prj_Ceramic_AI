import { useEffect } from 'react';

/**
 * useScrollReveal Hook
 * Tự động gắn IntersectionObserver vào các phần tử .scroll-reveal
 * Khi người dùng kéo cuộn trang đến đâu, các phần tử mềm mại trồi lên (fade-in + translateY).
 */
export function useScrollReveal(containerRef, deps = []) {
  useEffect(() => {
    // Delay 50ms để DOM render đầy đủ
    const timer = setTimeout(() => {
      const root = containerRef?.current || null;
      const elements = root
        ? root.querySelectorAll('.scroll-reveal')
        : document.querySelectorAll('.scroll-reveal');

      if (!elements || elements.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        {
          root: root,
          rootMargin: '0px 0px -40px 0px',
          threshold: 0.1,
        }
      );

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('is-visible');
        } else {
          observer.observe(el);
        }
      });

      return () => {
        observer.disconnect();
      };
    }, 50);

    return () => clearTimeout(timer);
  }, [containerRef, ...deps]);
}
