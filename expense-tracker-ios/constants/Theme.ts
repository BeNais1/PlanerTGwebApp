// Theme constants — Apple-style dark design system
// Matches the web app's CSS variables

export const Colors = {
  // Primary
  black: '#000000',
  white: '#ffffff',
  lightGray: '#f5f5f7',
  nearBlack: '#1d1d1f',

  // Interactive
  blue: '#0071e3',
  linkBlue: '#0066cc',
  brightBlue: '#2997ff',

  // Text
  textPrimary: '#1d1d1f',
  textSecondary: 'rgba(0, 0, 0, 0.56)',
  textOnDark: '#ffffff',
  textOnDarkSecondary: 'rgba(255, 255, 255, 0.7)',
  textOnDarkTertiary: 'rgba(255, 255, 255, 0.48)',

  // Surfaces (Dark Mode)
  surface1: '#1c1c1e',
  surface2: '#2c2c2e',
  surface3: '#3a3a3c',
  surfaceElevated: '#272729',

  // Semantic
  income: '#0071e3',
  expense: '#ffffff',
  destructive: '#ff453a',
  success: '#34C759',
  warning: '#FF9500',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 32,
  pill: 980,
  full: 9999,
};

export const Typography = {
  // Display
  displayLarge: {
    fontSize: 56,
    fontWeight: '600' as const,
    letterSpacing: -0.28,
  },
  displayMedium: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.28,
  },
  // Title
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.374,
  },
  // Body
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.374,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500' as const,
    letterSpacing: -0.224,
  },
  // Caption
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.12,
  },
  captionSemibold: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: -0.12,
  },
};
