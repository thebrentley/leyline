import { cva, type VariantProps } from "class-variance-authority";
import { useColorScheme } from "nativewind";
import * as React from "react";
import { Pressable, Text, type PressableProps } from "react-native";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "flex-row items-center justify-center overflow-hidden rounded-lg",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        outline: "",
        secondary: "",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-12 px-5 py-3",
        sm: "h-10 px-4",
        lg: "h-14 px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant = "default", size, children, ...props }, ref) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    const variantStyles = {
      default: isDark ? "bg-purple-600 active:bg-purple-700" : "bg-purple-600 active:bg-purple-700",
      destructive: isDark ? "bg-red-600 active:bg-red-700" : "bg-red-500 active:bg-red-600",
      outline: isDark
        ? "border border-slate-700 bg-slate-800 active:bg-slate-700"
        : "border border-slate-200 bg-white active:bg-slate-100",
      secondary: isDark ? "bg-slate-800 active:bg-slate-700" : "bg-slate-100 active:bg-slate-200",
      ghost: isDark ? "active:bg-slate-800" : "active:bg-slate-100",
      link: "",
    };

    const textStyles = {
      default: "text-white",
      destructive: "text-white",
      outline: isDark ? "text-white" : "text-slate-900",
      secondary: isDark ? "text-white" : "text-slate-900",
      ghost: isDark ? "text-white" : "text-slate-900",
      link: isDark ? "text-purple-400 underline" : "text-purple-600 underline",
    };

    return (
      <Pressable
        ref={ref}
        className={cn(
          buttonVariants({ size, className }),
          variantStyles[variant || "default"]
        )}
        {...props}
      >
        {typeof children === "string" ? (
          <Text className={cn("text-sm font-medium", textStyles[variant || "default"])}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
