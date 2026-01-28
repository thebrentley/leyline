import { Platform, Switch, SwitchProps, StyleSheet } from "react-native";

interface StyledSwitchProps extends SwitchProps {
  isDark?: boolean;
}

export function StyledSwitch({ isDark, ...props }: StyledSwitchProps) {
  if (Platform.OS === "web") {
    return (
      <div
        style={{
          position: "relative",
          display: "inline-block",
        }}
      >
        <style>{`
          .custom-switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }

          .custom-switch {
            position: relative;
            display: inline-block;
            width: 51px;
            height: 31px;
          }

          .custom-switch-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #cbd5e1;
            transition: 0.3s;
            border-radius: 31px;
          }

          .custom-switch-slider:before {
            position: absolute;
            content: "";
            height: 27px;
            width: 27px;
            left: 2px;
            bottom: 2px;
            background-color: ${isDark ? "#3B0A70" : "#5B21B6"};
            transition: 0.3s;
            border-radius: 50%;
          }

          .custom-switch input:checked + .custom-switch-slider {
            background-color: #7C3AED;
          }

          .custom-switch input:checked + .custom-switch-slider:before {
            transform: translateX(20px);
            background-color: ${isDark ? "#3B0A70" : "#5B21B6"};
          }
        `}</style>
        <label className="custom-switch">
          <input
            type="checkbox"
            checked={props.value}
            onChange={(e) => props.onValueChange?.(e.target.checked)}
          />
          <span className="custom-switch-slider" />
        </label>
      </div>
    );
  }

  // Native platforms use the standard Switch with proper colors
  return (
    <Switch
      {...props}
      trackColor={{ false: "#cbd5e1", true: "#7C3AED" }}
      thumbColor={isDark ? "#3B0A70" : "#5B21B6"}
      ios_backgroundColor="#cbd5e1"
    />
  );
}
