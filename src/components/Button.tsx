/**
 * Accessible Button Component
 * Includes proper focus states and keyboard navigation
 */

import React, { ButtonHTMLAttributes, CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';
import { buttonStyles, focusRing } from '@/lib/theme';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export function Button({ 
  variant = 'primary', 
  fullWidth = false,
  isLoading = false,
  children,
  disabled,
  style,
  className,
  ...props 
}: ButtonProps) {
  const variantStyles = buttonStyles[variant];
  
  const buttonStyle: CSSProperties = {
    ...buttonStyles.base,
    ...variantStyles,
    ...(fullWidth && { width: '100%' }),
    ...(disabled && { opacity: 0.6, cursor: 'not-allowed' }),
    ...style,
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={className}
      style={buttonStyle}
      onFocus={(e) => {
        Object.assign(e.currentTarget.style, focusRing.default);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
        props.onBlur?.(e);
      }}
    >
      {isLoading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} className="spin" aria-hidden="true" /> Processing…
        </span>
      ) : children}
    </button>
  );
}
