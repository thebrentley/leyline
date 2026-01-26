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
import { CircularProgress } from "~/components/CircularProgress";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/contexts/AuthContext";

export default function SignUpScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { signUp, isLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      setError("");
      await signUp(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
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
        <View className="flex-1 justify-center px-6">
          {/* Logo / Header */}
          <View className="mb-10 items-center">
            <Text
              className={`text-4xl font-bold ${
                isDark ? "text-emerald-400" : "text-emerald-600"
              }`}
            >
              Deck Tutor
            </Text>
            <Text
              className={`mt-2 text-base ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Create your account
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
                Name
              </Text>
              <Input
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

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
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View>
              <Text
                className={`mb-2 text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Confirm Password
              </Text>
              <Input
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            {error ? (
              <Text className="text-center text-red-500">{error}</Text>
            ) : null}

            <Button
              onPress={handleSignUp}
              disabled={isLoading}
              className="mt-2"
            >
              {isLoading ? (
                <CircularProgress size={20} strokeWidth={2} color="white" backgroundColor="rgba(255,255,255,0.2)" />
              ) : (
                "Create Account"
              )}
            </Button>
          </View>

          {/* Sign In Link */}
          <View className="mt-8 flex-row items-center justify-center gap-1">
            <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text
                className={`font-semibold ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              >
                Sign In
              </Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
