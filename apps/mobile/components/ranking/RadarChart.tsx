import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import type { DeckScores } from "~/lib/api";

interface RadarChartProps {
  scores: DeckScores;
  size?: number;
}

const AXIS_COLORS = {
  power: "#a855f7",
  salt: "#ef4444",
  fear: "#f97316",
  airtime: "#3b82f6",
};

const AXIS_LABELS = {
  power: "Power",
  salt: "Salt",
  fear: "Fear",
  airtime: "Airtime",
};

export function RadarChart({ scores, size = 200 }: RadarChartProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 30;

  // Calculate positions for 4 axes (square/diamond layout)
  const axes = [
    { key: "power" as const, angle: -90 }, // top
    { key: "salt" as const, angle: 0 }, // right
    { key: "fear" as const, angle: 90 }, // bottom
    { key: "airtime" as const, angle: 180 }, // left
  ];

  const points = axes.map(({ key, angle }) => {
    const score = scores[key];
    const radian = (angle * Math.PI) / 180;
    const distance = (score / 100) * radius;
    return {
      x: centerX + distance * Math.cos(radian),
      y: centerY + distance * Math.sin(radian),
      key,
      angle,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid circles at 25, 50, 75, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <View>
      <Svg width={size} height={size}>
        {/* Grid circles */}
        {gridLevels.map((level) => (
          <Circle
            key={level}
            cx={centerX}
            cy={centerY}
            r={radius * level}
            fill="none"
            stroke={isDark ? "#334155" : "#e2e8f0"}
            strokeWidth="1"
            strokeDasharray={level === 1 ? undefined : "2,2"}
          />
        ))}

        {/* Axis lines */}
        {axes.map(({ angle }) => {
          const radian = (angle * Math.PI) / 180;
          const x = centerX + radius * Math.cos(radian);
          const y = centerY + radius * Math.sin(radian);
          return (
            <Line
              key={angle}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke={isDark ? "#334155" : "#e2e8f0"}
              strokeWidth="1"
            />
          );
        })}

        {/* Score polygon */}
        <Polygon
          points={polygonPoints}
          fill={isDark ? "rgba(168, 85, 247, 0.2)" : "rgba(168, 85, 247, 0.15)"}
          stroke="#a855f7"
          strokeWidth="2"
        />

        {/* Score points */}
        {points.map(({ x, y, key }) => (
          <Circle
            key={key}
            cx={x}
            cy={y}
            r="4"
            fill={AXIS_COLORS[key]}
          />
        ))}

        {/* Axis labels */}
        {axes.map(({ key, angle }) => {
          const radian = (angle * Math.PI) / 180;
          const labelDistance = radius + 20;
          const x = centerX + labelDistance * Math.cos(radian);
          const y = centerY + labelDistance * Math.sin(radian);
          return (
            <SvgText
              key={key}
              x={x}
              y={y}
              fontSize="12"
              fontWeight="600"
              fill={AXIS_COLORS[key]}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {AXIS_LABELS[key]}
            </SvgText>
          );
        })}
      </Svg>

      {/* Score values below chart */}
      <View className="flex-row justify-around mt-4">
        {axes.map(({ key }) => (
          <View key={key} className="items-center">
            <Text
              className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              {AXIS_LABELS[key]}
            </Text>
            <Text
              className="text-lg font-bold mt-1"
              style={{ color: AXIS_COLORS[key] }}
            >
              {scores[key]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
