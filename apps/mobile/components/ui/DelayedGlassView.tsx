import { GlassView } from "expo-glass-effect";
import { useEffect, useState, type ComponentProps } from "react";

/**
 * Mounts GlassView immediately but invisible (opacity 0) so the native blur
 * can initialize, then reveals it after a short delay. Prevents the white
 * flash that occurs before the blur effect is ready.
 */
export function DelayedGlassView({ style, ...props }: ComponentProps<typeof GlassView>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(id);
  }, []);
  return <GlassView {...props} style={[style, { opacity: visible ? 1 : 0 }]} />;
}
