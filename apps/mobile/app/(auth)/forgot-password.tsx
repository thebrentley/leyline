import { Link } from "expo-router";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LeylineLogo } from "~/components/brand";
import { Spinner } from "~/components/Spinner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authApi } from "~/lib/api";

export default function ForgotPasswordScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      const result = await authApi.forgotPassword(email);
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
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
        <View className="flex-1 justify-center px-6 lg:px-8">
          <View className="w-full max-w-md mx-auto">
            {/* Logo / Header */}
            <View className="mb-10 items-center">
              <LeylineLogo size="medium" />
              <Text
                className={`mt-4 text-base ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Reset your password
              </Text>
            </View>

            {sent ? (
              <View className="gap-4 items-center">
                <Text
                  className={`text-center text-base leading-6 ${
                    isDark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Check your email for a reset link. Follow the link in your
                  email to set a new password.
                </Text>

                <View className="mt-6 flex-row items-center justify-center gap-1">
                  <Link href="/(auth)/login" asChild>
                    <Text
                      className={`font-semibold ${
                        isDark ? "text-purple-400" : "text-purple-600"
                      }`}
                    >
                      Back to Sign In
                    </Text>
                  </Link>
                </View>
              </View>
            ) : (
              <>
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
                      returnKeyType="go"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>

                  {error ? (
                    <Text className="text-center text-red-500">{error}</Text>
                  ) : null}

                  <Button
                    onPress={handleSubmit}
                    disabled={isLoading}
                    className="mt-2"
                  >
                    {isLoading ? (
                      <Spinner
                        size={20}
                        strokeWidth={2}
                        color="white"
                        backgroundColor="rgba(255,255,255,0.2)"
                      />
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </View>

                {/* Back to Login Link */}
                <View className="mt-8 flex-row items-center justify-center gap-1">
                  <Text
                    className={isDark ? "text-slate-400" : "text-slate-500"}
                  >
                    Remember your password?
                  </Text>
                  <Link href="/(auth)/login" asChild>
                    <Text
                      className={`font-semibold ${
                        isDark ? "text-purple-400" : "text-purple-600"
                      }`}
                    >
                      Sign In
                    </Text>
                  </Link>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
