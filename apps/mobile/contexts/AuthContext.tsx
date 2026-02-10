import { useRouter, useSegments } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, User } from "~/lib/api";
import { secureStorage } from "~/lib/storage";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  // Check for existing session on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace("/(tabs)");
    }
  }, [user, segments, isLoading]);

  async function loadStoredAuth() {
    try {
      const storedToken = await secureStorage.getItem(TOKEN_KEY);

      if (storedToken) {
        // Verify token is still valid by fetching user
        const response = await authApi.getMe();

        if (response.data) {
          setUser(response.data);
          setToken(storedToken);
          await secureStorage.setItem(USER_KEY, JSON.stringify(response.data));
        } else {
          // Token is invalid, clear stored data
          setToken(null);
          await secureStorage.deleteItem(TOKEN_KEY);
          await secureStorage.deleteItem(USER_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load auth:", error);
      // Clear potentially corrupted data
      setToken(null);
      await secureStorage.deleteItem(TOKEN_KEY);
      await secureStorage.deleteItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, password);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        await secureStorage.setItem(TOKEN_KEY, response.data.accessToken);
        await secureStorage.setItem(
          USER_KEY,
          JSON.stringify(response.data.user),
        );
        setToken(response.data.accessToken);
        setUser(response.data.user);
      }
    } catch (error) {
      console.error("Sign in failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(email: string, password: string, name: string) {
    setIsLoading(true);
    try {
      const response = await authApi.register(email, password, name);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        await secureStorage.setItem(TOKEN_KEY, response.data.accessToken);
        await secureStorage.setItem(
          USER_KEY,
          JSON.stringify(response.data.user),
        );
        setToken(response.data.accessToken);
        setUser(response.data.user);
      }
    } catch (error) {
      console.error("Sign up failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    try {
      await secureStorage.deleteItem(USER_KEY);
      await secureStorage.deleteItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }

  async function refreshUser() {
    try {
      const response = await authApi.getMe();
      if (response.data) {
        setUser(response.data);
        await secureStorage.setItem(USER_KEY, JSON.stringify(response.data));
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signIn, signUp, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
