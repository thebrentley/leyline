import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  progress?: number; // 0-100, if undefined shows indeterminate spinner
  color?: string;
  backgroundColor?: string;
}

export function CircularProgress({
  size = 20,
  strokeWidth = 2,
  progress,
  color = "#f59e0b",
  backgroundColor = "rgba(0,0,0,0.1)",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const dashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (progress === undefined) {
      // Indeterminate animation
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      const dashAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(dashAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: false,
          }),
          Animated.timing(dashAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: false,
          }),
        ])
      );

      rotateAnimation.start();
      dashAnimation.start();

      return () => {
        rotateAnimation.stop();
        dashAnimation.stop();
      };
    }
  }, [progress, rotateAnim, dashAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const strokeDashoffset = progress !== undefined
    ? circumference - (progress / 100) * circumference
    : dashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference * 0.75, circumference * 0.25],
      });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          transform: [{ rotate: progress === undefined ? rotation : "0deg" }],
        }}
      >
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            {/* Background circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={backgroundColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
