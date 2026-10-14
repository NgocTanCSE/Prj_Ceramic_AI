import React from 'react';
import { cn } from '../lib/utils';

/**
 * Shared Button primitive - the single source of truth for all
 * interactive buttons across the Gốm Việt studio.
 *
 * Variants:
 *  - primary   : deep cobalt filled, warm text      → primary actions
 *  - secondary : white bg, charcoal text, border     → secondary actions
 *  - accent    : celadon filled                       → highlights / premium
 *  - ghost     : transparent, subtle text on hover   → minimal actions
 *  - destructive: red filled                          → destructive actions
 *
 * Sizes: sm | md | lg
 *
 * Icon prop has been removed per design system - all actions
 * are text-based for a clean, editorial interface.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  disabled = false,
  ariaLabel,
  onClick,
  type = 'button',
  ...rest
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-none md:rounded-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ceramic-terracotta disabled:opacity-40 disabled:cursor-not-allowed text-xs tracking-wide select-none';

  const variantClasses = {
    primary: 'bg-ceramic-terracotta text-ceramic-paper hover:bg-ceramic-terracotta/90 border border-ceramic-terracotta active:translate-y-px',
    secondary: 'bg-ceramic-paper text-ceramic-charcoal border border-ceramic-border hover:border-ceramic-terracotta hover:bg-ceramic-cream active:translate-y-px',
    accent: 'bg-ceramic-terracotta text-ceramic-paper hover:bg-ceramic-terracotta/90 border border-ceramic-terracotta active:translate-y-px',
    ghost: 'text-ceramic-slate hover:text-ceramic-charcoal hover:bg-ceramic-cream',
    destructive: 'bg-state-error text-ceramic-paper hover:bg-state-error/90 border border-state-error',
  };

  const sizeClasses = {
    sm: 'px-3.5 py-2 text-xs',
    md: 'px-5 py-3 text-sm',
    lg: 'px-7 py-3.5 text-sm',
  };

  return (
    <button
      type={type}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
