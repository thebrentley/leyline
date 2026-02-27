import { useColorScheme } from "nativewind";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Filter, FeGaussianBlur, G } from "react-native-svg";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

const PALETTE = [
  "#22d3ee", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#f97316", // orange
];

export function getSegmentColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function DonutChart({
  segments,
  size = 180,
  strokeWidth = 18,
}: DonutChartProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const glowPad = 16; // extra space for glow bleed
  const svgSize = size + glowPad * 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = svgSize / 2;

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Consolidate small segments into "Other" so the chart stays readable
  const MAX_SEGMENTS = 5;
  const sorted = [...segments].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const displaySegments: DonutSegment[] =
    sorted.length <= MAX_SEGMENTS + 1
      ? sorted
      : [
          ...sorted.slice(0, MAX_SEGMENTS),
          {
            label: "Other",
            value: sorted.slice(MAX_SEGMENTS).reduce((s, seg) => s + seg.value, 0),
            color: "#64748b",
          },
        ];

  // Small gap between segments (in radians worth of circumference)
  const gapSize = displaySegments.length > 1 ? 3 : 0;

  // Build arc offsets
  let cumulative = 0;
  const arcs = displaySegments.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const dashLength = Math.max(0, fraction * circumference - gapSize);
    const offset = cumulative;
    cumulative += fraction;
    return {
      ...s,
      fraction,
      dashLength,
      dashOffset: circumference - offset * circumference - gapSize / 2,
    };
  });

  // Format the total as dollars + cents
  const dollars = Math.floor(total);
  const cents = Math.round((total - dollars) * 100)
    .toString()
    .padStart(2, "0");

  return (
    <View className="items-center pt-4 pb-2 px-4">
      {/* Donut */}
      <View style={{ width: svgSize, height: svgSize, marginHorizontal: -glowPad }}>
        <Svg width={svgSize} height={svgSize}>
          <Defs>
            <Filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <FeGaussianBlur stdDeviation="6" />
            </Filter>
          </Defs>
          <G rotation={-90} origin={`${center}, ${center}`}>
            {/* Background track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={isDark ? "#1e293b" : "#f1f5f9"}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Glow layer — blurred, wider, semi-transparent duplicates */}
            {[...arcs].reverse().map((arc) => (
              <Circle
                key={`glow-${arc.label}`}
                cx={center}
                cy={center}
                r={radius}
                stroke={arc.color}
                strokeWidth={strokeWidth + 8}
                fill="none"
                strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="round"
                opacity={isDark ? 0.35 : 0.25}
                filter="url(#glow)"
              />
            ))}
            {/* Segments drawn back-to-front so first segment is on top */}
            {[...arcs].reverse().map((arc) => (
              <Circle
                key={arc.label}
                cx={center}
                cy={center}
                r={radius}
                stroke={arc.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="round"
              />
            ))}
          </G>
        </Svg>
        {/* Center label */}
        <View
          className="absolute items-center justify-center"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <View className="flex-row items-baseline">
            <Text
              className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
              style={{ marginBottom: 2 }}
            >
              $
            </Text>
            <Text
              className={`font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}
              style={{ fontSize: 32, lineHeight: 38 }}
            >
              {dollars.toLocaleString()}
            </Text>
            <Text
              className={`text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}
              style={{ marginBottom: 2 }}
            >
              .{cents}
            </Text>
          </View>
          <Text
            className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            Total value
          </Text>
        </View>
      </View>

      {/* Legend row below chart */}
      <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-1 mt-3 px-2">
        {arcs.map((arc) => (
          <View key={arc.label} className="items-center min-w-[56px]">
            <Text
              className="text-sm font-bold"
              style={{ color: arc.color }}
            >
              ${arc.value >= 1000 ? `${(arc.value / 1000).toFixed(1)}k` : arc.value.toFixed(2)}
            </Text>
            <Text
              className={`text-[10px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              numberOfLines={1}
            >
              {arc.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
