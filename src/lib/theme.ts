/**
 * Design system and theme constants
 *
 * Design language: calm, clinical, editorial. Cool slate neutrals for text and
 * surfaces, a single teal brand accent (deliberately NOT the #667eea purple
 * cliché), and muted, accessible status colors. Headings use a serif stack
 * (see globals.css) to read as a considered medical product rather than a
 * generic template.
 */

export const colors = {
  // Neutral slate ramp - used for text, borders, and surfaces
  primary: {
    50: '#f6f8fa',
    100: '#eef1f5',
    200: '#e1e6ec',
    300: '#c5cdd8',
    400: '#94a1b2',
    500: '#647082',
    600: '#46505f',
    700: '#1d2733',
    800: '#101720',
  },

  // Teal brand accent
  accent: {
    primary: '#0e7c7b',
    secondary: '#0a5d5c',
    light: '#3a9d97',
    lighter: '#a7d9d4',
  },

  // Status colors (muted, clinical)
  success: {
    50: '#eef7f0',
    100: '#cfead6',
    200: '#a6d8b3',
    500: '#2f9e58',
    600: '#268049',
    700: '#1c6238',
    800: '#16492b',
  },

  error: {
    50: '#fdf3f2',
    100: '#f9dcd9',
    200: '#f0b3ad',
    500: '#d65a4e',
    600: '#c0392b',
    700: '#a52f23',
    800: '#86271d',
    900: '#5f1c15',
  },

  warning: {
    50: '#fdf6ec',
    100: '#f4e3c0',
    500: '#c98a2b',
    700: '#8a5a14',
    800: '#6f4910',
  },

  info: {
    50: '#eef4fb',
    100: '#cfe1f5',
    200: '#a6c8ec',
    300: '#7aa9df',
    500: '#2f6fc4',
    600: '#255aa3',
    700: '#1d4880',
    800: '#16395f',
  },

  // Utility
  white: '#ffffff',
  black: '#0a0e13',
  gray: {
    50: '#f7f9fb',
    100: '#eef1f5',
    200: '#e1e6ec',
    300: '#c5cdd8',
    400: '#8a96a6',
    500: '#647082',
    600: '#46505f',
    700: '#27313f',
    800: '#131a24',
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
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(16,23,32,0.06)',
  md: '0 2px 8px rgba(16,23,32,0.06), 0 1px 2px rgba(16,23,32,0.04)',
  lg: '0 8px 24px rgba(16,23,32,0.08), 0 2px 6px rgba(16,23,32,0.04)',
  xl: '0 16px 40px rgba(16,23,32,0.12)',
} as const;

export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;

export const gradients = {
  // Deep teal-navy header - restrained, not a rainbow gradient
  primary: 'linear-gradient(155deg, #0f2a33 0%, #0c4a47 100%)',
  success: 'linear-gradient(135deg, #eef7f0 0%, #d8efdd 100%)',
  error: 'linear-gradient(135deg, #fdf3f2 0%, #f7e0dd 100%)',
  background: 'linear-gradient(180deg, #f8fafb 0%, #eef2f6 100%)',
} as const;

// Reusable button styles
export const buttonStyles = {
  base: {
    border: 'none',
    borderRadius: borderRadius.md,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    fontSize: '15px',
    padding: '11px 22px',
    outline: 'none',
    letterSpacing: '0.01em',
  },

  primary: {
    background: colors.accent.primary,
    color: colors.white,
  },

  secondary: {
    background: colors.white,
    color: colors.primary[700],
    border: `1px solid ${colors.primary[300]}`,
  },

  success: {
    background: colors.success[600],
    color: colors.white,
  },

  danger: {
    background: colors.error[600],
    color: colors.white,
  },
} as const;

// Focus styles for accessibility
export const focusRing = {
  default: {
    outline: `3px solid ${colors.accent.lighter}`,
    outlineOffset: '2px',
  },

  primary: {
    outline: `3px solid ${colors.accent.lighter}`,
    outlineOffset: '2px',
  },
} as const;

// Typography
export const typography = {
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontFamilySerif:
    "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif",

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
