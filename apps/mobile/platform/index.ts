import { Platform, Dimensions } from 'react-native';

/**
 * Breakpoint constants matching tailwind.config.js
 */
export const BREAKPOINTS = {
  mobile: 0,      // 0-640px
  sm: 640,        // 640-768px (mobile landscape)
  md: 768,        // 768-1024px (tablet)
  lg: 1024,       // 1024-1440px (desktop)
  xl: 1440,       // 1440-1920px (wide desktop)
  '2xl': 1920,    // 1920px+ (ultra-wide)
} as const;

/**
 * Check if running on web platform
 */
export const isWeb = Platform.OS === 'web';

/**
 * Check if running on mobile (iOS or Android)
 */
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Get current viewport width
 */
export function getViewportWidth(): number {
  return Dimensions.get('window').width;
}

/**
 * Check if viewport width is at or above a breakpoint
 */
export function isBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const width = getViewportWidth();
  return width >= BREAKPOINTS[breakpoint];
}

/**
 * Check if viewport is desktop size (≥1024px)
 */
export function isDesktop(): boolean {
  return isBreakpoint('lg');
}

/**
 * Check if viewport is tablet size (768px-1023px)
 */
export function isTablet(): boolean {
  const width = getViewportWidth();
  return width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
}

/**
 * Check if viewport is mobile size (<768px)
 */
export function isMobileViewport(): boolean {
  const width = getViewportWidth();
  return width < BREAKPOINTS.md;
}

/**
 * Get current breakpoint name
 */
export function getCurrentBreakpoint(): keyof typeof BREAKPOINTS {
  const width = getViewportWidth();

  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'mobile';
}

/**
 * Platform-specific value selector
 */
export function selectPlatform<T>(options: {
  web?: T;
  mobile?: T;
  ios?: T;
  android?: T;
  default: T;
}): T {
  if (Platform.OS === 'web' && options.web !== undefined) {
    return options.web;
  }
  if (Platform.OS === 'ios' && options.ios !== undefined) {
    return options.ios;
  }
  if (Platform.OS === 'android' && options.android !== undefined) {
    return options.android;
  }
  if (isMobile && options.mobile !== undefined) {
    return options.mobile;
  }
  return options.default;
}
