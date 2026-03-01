import { Link } from "expo-router";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LeylineLogo } from "~/components/brand";
import { Spinner } from "~/components/Spinner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/contexts/AuthContext";

export default function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { signIn, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setError("");
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-slate-950" : "bg-white"}`}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View className="w-full max-w-md mx-auto px-6 lg:px-8">
            {/* Logo / Header */}
            <View className="mb-10 items-center">
              <LeylineLogo size="medium" />
              <Text
                className={`mt-4 text-base ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Sign in to your account
              </Text>
            </View>

            {/* Form */}
            <View className="gap-4">
            <View>
              <Text
                className={`mb-2 text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Email
              </Text>
              <Input
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View>
              <Text
                className={`mb-2 text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Password
              </Text>
              <Input
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <View className="flex-row justify-end mt-1">
                <Link href="/(auth)/forgot-password" asChild>
                  <Text
                    className={`text-sm font-medium ${
                      isDark ? "text-purple-400" : "text-purple-600"
                    }`}
                  >
                    Forgot password?
                  </Text>
                </Link>
              </View>
            </View>

            {error ? (
              <Text className="text-center text-red-500">{error}</Text>
            ) : null}

              <Button
                onPress={handleLogin}
                disabled={isLoading}
                className="mt-2"
              >
                {isLoading ? (
                  <Spinner size={20} strokeWidth={2} color="white" backgroundColor="rgba(255,255,255,0.2)" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </View>

            {/* Sign Up Link */}
            <View className="mt-8 flex-row items-center justify-center gap-1">
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                Don't have an account?
              </Text>
              <Link href="/(auth)/signup" asChild>
                <Text
                  className={`font-semibold ${
                    isDark ? "text-purple-400" : "text-purple-600"
                  }`}
                >
                  Sign Up
                </Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
