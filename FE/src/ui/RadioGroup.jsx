import React from 'react';

/**
 * Accessible Radio Group - used for fulfillment type selection,
 * payment method, and any single-choice picker.
 *
 * Accepts an array of options: { value, label, description }
 * Icon prop removed for clean editorial interface.
 */
export default function RadioGroup({
  options = [],
  value,
  onChange,
  name = 'radio-group',
  layout = 'vertical',
  className = '',
}) {
  const isHorizontal = layout === 'horizontal';

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`
        grid gap-3
        ${isHorizontal ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}
        ${className}
      `}
    >
      {options.map((opt) => {
        const selected = value === opt.value;

        return (
          <label
            key={opt.value}
            className={`
              relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
              transition-all duration-200 text-left
              ${
                selected
                  ? 'border-ceramic-terracotta bg-ceramic-paper shadow-card ring-1 ring-ceramic-terracotta/20'
                  : 'border-ceramic-border bg-ceramic-cream hover:border-ceramic-terracotta'
              }
            `}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
              aria-describedby={opt.description ? `${opt.value}-desc` : undefined}
            />
            <div className="flex-1">
              <div className={`font-semibold text-sm ${selected ? 'text-ceramic-charcoal' : 'text-ceramic-slate'}`}>
                {opt.label}
              </div>
              {opt.description && (
                <p
                  id={opt.description ? `${opt.value}-desc` : undefined}
                  className="text-[10px] text-ceramic-slate mt-0.5 leading-relaxed"
                >
                  {opt.description}
                </p>
              )}
            </div>
            {selected && (
              <div className="w-5 h-5 rounded-full bg-ceramic-terracotta text-ceramic-paper flex items-center justify-center flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M8 2L3.5 6.5L2 5L1 6L3.5 8.5L9 3.5L8 2Z" />
                </svg>
              </div>
            )}
          </label>
        );
      })}
    </div>
  );
}
