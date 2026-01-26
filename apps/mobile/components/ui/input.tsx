import { useColorScheme } from "nativewind";
import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "~/lib/utils";

interface InputProps extends TextInputProps {
  className?: string;
}

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, ...props }, ref) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    return (
      <TextInput
        ref={ref}
        className={cn(
          "h-12 w-full rounded-lg border px-4 text-base",
          isDark
            ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-400"
            : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400",
          className
        )}
        placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
