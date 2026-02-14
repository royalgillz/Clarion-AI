/**
 * Design system and theme constants
 * Centralized colors, spacing, and reusable styles
 */

export const colors = {
  // Primary brand colors
  primary: {
    50: '#f7fafc',
    100: '#edf2f7',
    200: '#e2e8f0',
    300: '#cbd5e0',
    400: '#a0aec0',
    500: '#718096',
    600: '#4a5568',
    700: '#2d3748',
    800: '#1a202c',
  },
  
  // Accent purple/blue
  accent: {
    primary: '#667eea',
    secondary: '#764ba2',
    light: '#9f7aea',
    lighter: '#b794f4',
  },
  
  // Status colors
  success: {
    50: '#f0fff4',
    100: '#c6f6d5',
    200: '#9ae6b4',
    500: '#48bb78',
    600: '#38a169',
    700: '#276749',
    800: '#22543d',
  },
  
  error: {
    50: '#fff5f5',
    100: '#fed7d7',
    200: '#feb2b2',
    500: '#fc8181',
    600: '#f56565',
    700: '#c53030',
    800: '#9b2c2c',
    900: '#742a2a',
  },
  
  warning: {
    50: '#fef5f5',
    100: '#fbd38d',
    500: '#ed8936',
    700: '#744210',
    800: '#975a16',
  },
  
  info: {
    50: '#ebf8ff',
    100: '#bee3f8',
    200: '#90cdf4',
    300: '#63b3ed',
    500: '#3182ce',
    600: '#2b6cb0',
    700: '#2c5282',
    800: '#2a4365',
  },
  
  // Utility
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#fafafa',
    100: '#f7fafc',
    200: '#e2e8f0',
    300: '#cbd5e0',
    400: '#a0aec0',
    500: '#718096',
    600: '#4a5568',
    700: '#2d3748',
    800: '#1a202c',
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 2px 4px rgba(0,0,0,0.05)',
  md: '0 4px 12px rgba(0,0,0,0.05)',
  lg: '0 8px 24px rgba(0,0,0,0.1)',
  xl: '0 12px 36px rgba(0,0,0,0.15)',
} as const;

export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  success: 'linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)',
  error: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
  background: 'linear-gradient(to bottom, #f7fafc 0%, #edf2f7 100%)',
} as const;

// Reusable button styles
export const buttonStyles = {
  base: {
    border: 'none',
    borderRadius: borderRadius.md,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '15px',
    padding: '12px 24px',
    outline: 'none',
  },
  
  primary: {
    background: colors.accent.primary,
    color: colors.white,
  },
  
  secondary: {
    background: colors.white,
    color: colors.primary[600],
    border: `2px solid ${colors.primary[200]}`,
  },
  
  success: {
    background: colors.success[500],
    color: colors.white,
  },
  
  danger: {
    background: colors.error[700],
    color: colors.white,
  },
} as const;

// Focus styles for accessibility
export const focusRing = {
  default: {
    outline: `3px solid ${colors.info[300]}`,
    outlineOffset: '2px',
  },
  
  primary: {
    outline: `3px solid ${colors.accent.lighter}`,
    outlineOffset: '2px',
  },
} as const;

// Typography
export const typography = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  
  sizes: {
    xs: '11px',
    sm: '13px',
    base: '15px',
    lg: '18px',
    xl: '22px',
    '2xl': '28px',
    '3xl': '32px',
    '4xl': '48px',
  },
  
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
} as const;
