import React from 'react';

/**
 * Shared Input primitive - consistent form field with label, helper text,
 * and inline validation feedback.
 *
 * Icon prop removed for clean editorial interface.
 */
export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error = '',
  helperText = '',
  className = '',
  maxLength,
  showCount = false,
  ...rest
}) {
  const inputClasses = `
    w-full px-4 py-3 rounded-sm border transition-all duration-200
    bg-ceramic-cream text-ceramic-charcoal placeholder-ceramic-slate
    focus:outline-none focus:ring-1 focus:ring-ceramic-terracotta/30
    disabled:bg-ceramic-cream/50 disabled:cursor-not-allowed
    ${error ? 'border-state-error focus:ring-state-error/30' : 'border-ceramic-border'}
  `;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="flex items-center justify-between text-xs font-semibold text-ceramic-slate">
          <span>
            {label}
            {required && <span className="text-state-error ml-1">*</span>}
          </span>
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={inputClasses}
          {...rest}
        />
        {showCount && maxLength && label && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ceramic-slate">
            {(value || '').length}/{maxLength}
          </span>
        )}
      </div>
      {error && <p className="text-[10px] text-state-error">{error}</p>}
      {!error && helperText && <p className="text-[10px] text-ceramic-slate">{helperText}</p>}
    </div>
  );
}
