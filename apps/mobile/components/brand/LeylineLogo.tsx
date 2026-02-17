import { useColorScheme } from "nativewind";
import { Text, View } from "react-native";
import Svg, {
  Defs,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

interface LeylineLogoProps {
  size?: "small" | "medium" | "large" | number;
  showTagline?: boolean;
}

export function LeylineLogo({
  size = "large",
  showTagline = true,
}: LeylineLogoProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const scale = typeof size === "number"
    ? size / 280
    : size === "large" ? 1 : size === "medium" ? 0.7 : 0.5;
  const width = 280 * scale;
  const taglineSize = 11 * scale;

  return (
    <View className="flex-col items-left">
      <Svg viewBox="0 0 300 80" width={width} height={(80 / 300) * width}>
        <Defs>
          <LinearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B5CF6" />
            <Stop offset="50%" stopColor="#A78BFA" />
            <Stop offset="100%" stopColor="#C4B5FD" />
          </LinearGradient>
          <Filter id="glowFx">
            <FeGaussianBlur stdDeviation="2" result="coloredBlur" />
            <FeMerge>
              <FeMergeNode in="coloredBlur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>
        <Path
          d="M30 60 L30 25 Q30 15 40 15 L55 15"
          stroke="url(#glowGrad)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          filter="url(#glowFx)"
        />
        <SvgText
          x="68"
          y="52"
          fontFamily="System"
          fontSize="38"
          fontWeight="300"
          fill={isDark ? "#FFFFFF" : "#1f2937"}
          letterSpacing={3}
        >
          LEYLINE
        </SvgText>
      </Svg>
      {showTagline && (
        <Text
          className={`tracking-widest ${isDark ? "text-purple-300" : "text-purple-500"}`}
          style={{ fontSize: taglineSize, marginTop: 4 }}
        >
          EVERYTHING. CONNECTED.
        </Text>
      )}
    </View>
  );
}
