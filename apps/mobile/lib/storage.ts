import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Platform-aware secure storage
 * Uses SecureStore on native, localStorage on web
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};
