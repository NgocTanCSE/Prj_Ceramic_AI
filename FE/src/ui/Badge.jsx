import React from 'react';

/**
 * Shared Badge primitive - status indicator, numeric count, or tag.
 *
 * Variants:
 *  - primary:   cobalt filled, white text    → active states / counts
 *  - secondary: celadon filled, white text   → highlights / new
 *  - outline:   transparent, bordered        → subtle tags
 *  - soft:      bg-tint, muted text          → informational
 *  - success:   emerald filled               → confirmations
 *
 * Icon prop removed for clean editorial interface.
 */
export default function Badge({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  className = '',
}) {
  const variantClasses = {
    primary: 'bg-ceramic-terracotta text-ceramic-paper',
    secondary: 'bg-ceramic-terracotta text-ceramic-paper',
    outline: 'bg-transparent border border-ceramic-border text-ceramic-slate',
    soft: 'bg-ceramic-cream text-ceramic-slate',
    success: 'bg-ceramic-terracotta text-ceramic-paper',
  };

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[9px] font-bold',
    sm: 'px-2.5 py-0.5 text-[10px] font-bold',
    md: 'px-3 py-1 text-xs font-bold',
  };

  const shapeClasses = {
    rounded: 'rounded-md',
    pill: 'rounded-full',
    square: 'rounded-sm',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-semibold
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${shapeClasses[shape]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
