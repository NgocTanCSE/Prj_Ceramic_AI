import React, { useRef, useState, useCallback, useEffect } from 'react';

/**
 * TactileSlider — High Performance, Touch & Mouse Pointer-Captured Slider
 * Guarantees smooth, unbreakable dragging on mouse, touch, and trackpad.
 * Prevents scroll hijacking via `touch-action: none` and `setPointerCapture`.
 */
export default function TactileSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  displayValue,
  unit = '',
  ariaLabel,
  className = '',
  disabled = false,
}) {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Normalize percentage for progress bar and thumb
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const updateValueFromPointer = useCallback(
    (clientX) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      if (trackWidth <= 0) return;

      const clickX = clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / trackWidth));
      const rawValue = min + fraction * (max - min);

      // Snap to step
      const stepPrecision = (step.toString().split('.')[1] || '').length;
      const steppedValue = Math.round(rawValue / step) * step;
      const clamped = Math.max(min, Math.min(max, parseFloat(steppedValue.toFixed(stepPrecision))));

      if (clamped !== value) {
        onChange(clamped);
      }
    },
    [min, max, step, value, onChange, disabled]
  );

  const handlePointerDown = (e) => {
    if (disabled) return;
    // Prevent default scrolling and stop propagation to parent smooth-scroll wrappers
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    setIsDragging(true);
    updateValueFromPointer(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    updateValueFromPointer(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (disabled) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    setIsDragging(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    let nextVal = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextVal = Math.min(max, value + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextVal = Math.max(min, value - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextVal = min;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextVal = max;
    }
    if (nextVal !== value) {
      const stepPrecision = (step.toString().split('.')[1] || '').length;
      onChange(parseFloat(nextVal.toFixed(stepPrecision)));
    }
  };

  return (
    <div className={`space-y-1.5 select-none ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs font-mono text-ceramic-slate">
          <span className="font-semibold">{label}</span>
          <span className="font-bold text-ceramic-charcoal font-mono">
            {displayValue !== undefined ? displayValue : `${value}${unit}`}
          </span>
        </div>
      )}

      {/* Accessible Interactive Track */}
      <div
        ref={trackRef}
        role="slider"
        aria-label={ariaLabel || label || 'Thanh trượt điều chỉnh'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ touchAction: 'none' }}
        className={`
          relative w-full h-8 flex items-center cursor-pointer group outline-none
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        {/* Background Rail */}
        <div className="w-full h-2 rounded-full bg-ceramic-border/70 overflow-hidden relative shadow-inner">
          {/* Active Fill Track */}
          <div
            className="h-full bg-ceramic-terracotta transition-all duration-75 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tactile Thumb Handle */}
        <div
          className={`
            absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-ceramic-paper
            border-2 border-ceramic-terracotta shadow-md flex items-center justify-center
            transition-transform duration-75
            ${isDragging ? 'scale-125 ring-4 ring-ceramic-terracotta/30' : 'group-hover:scale-110'}
            ${isFocused ? 'ring-2 ring-ceramic-charcoal' : ''}
          `}
          style={{
            left: `calc(${percentage}% - 10px)`,
            touchAction: 'none',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-ceramic-terracotta" />
        </div>

        {/* Floating Value Bubble while dragging */}
        {isDragging && (
          <div
            className="absolute -top-7 px-2 py-0.5 rounded-md bg-ceramic-charcoal text-ceramic-paper text-[10px] font-mono font-bold pointer-events-none transform -translate-x-1/2 shadow-card animate-in fade-in zoom-in-95 duration-100"
            style={{ left: `${percentage}%` }}
          >
            {displayValue !== undefined ? displayValue : `${value}${unit}`}
          </div>
        )}
      </div>

      {/* Hidden standard range input to maintain absolute browser test & synthetic event compatibility */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
