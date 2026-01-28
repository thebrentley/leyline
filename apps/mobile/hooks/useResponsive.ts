import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import {
  BREAKPOINTS,
  getCurrentBreakpoint,
  isDesktop as checkIsDesktop,
  isTablet as checkIsTablet,
  isMobileViewport as checkIsMobileViewport,
  isBreakpoint
} from '~/platform';

export interface ResponsiveState {
  width: number;
  height: number;
  breakpoint: keyof typeof BREAKPOINTS;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  /**
   * Check if viewport is at or above a specific breakpoint
   */
  isBreakpoint: (breakpoint: keyof typeof BREAKPOINTS) => boolean;
}

/**
 * Hook to track viewport dimensions and responsive breakpoints
 *
 * @example
 * ```tsx
 * const { isDesktop, isMobile, breakpoint, width } = useResponsive();
 *
 * if (isDesktop) {
 *   return <DesktopLayout />;
 * }
 * return <MobileLayout />;
 * ```
 */
export function useResponsive(): ResponsiveState {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener(
      'change',
      ({ window }: { window: ScaledSize }) => {
        setDimensions(window);
      }
    );

    return () => subscription?.remove();
  }, []);

  const breakpoint = getCurrentBreakpoint();
  const isDesktop = checkIsDesktop();
  const isTablet = checkIsTablet();
  const isMobile = checkIsMobileViewport();

  return {
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    isDesktop,
    isTablet,
    isMobile,
    isBreakpoint,
  };
}

/**
 * Hook to check if viewport is at a specific breakpoint
 * Optimized for a single breakpoint check
 *
 * @example
 * ```tsx
 * const isDesktop = useBreakpoint('lg');
 * ```
 */
export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const [matches, setMatches] = useState(() => isBreakpoint(breakpoint));

  useEffect(() => {
    const updateMatch = () => {
      setMatches(isBreakpoint(breakpoint));
    };

    const subscription = Dimensions.addEventListener('change', updateMatch);
    return () => subscription?.remove();
  }, [breakpoint]);

  return matches;
}
