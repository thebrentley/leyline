import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack, useRouter } from 'expo-router';
import { MoonStarIcon, ActivityIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { LeylineLogo } from '@/components/brand/LeylineLogo';

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 rounded-full web:mx-4">
      <Icon as={THEME_ICONS[colorScheme ?? 'light']} className="size-5" />
    </Button>
  );
}

const SCREEN_OPTIONS = {
  title: 'Leyline',
  headerTransparent: true,
  headerRight: () => <ThemeToggle />,
};

export default function Screen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <View className="flex-1 items-center justify-center gap-8 p-6">
        <LeylineLogo size={120} />

        {Platform.OS !== 'web' && (
          <View className="w-full max-w-sm gap-3">
            <Button
              onPress={() => router.push('/life-counter')}
              size="lg"
              className="w-full">
              <Icon as={ActivityIcon} className="mr-2 size-5" />
              <Text className="text-lg font-semibold">Life Counter</Text>
            </Button>

            <Text className="text-center text-sm text-muted-foreground">
              Track life, poison, commander damage, and more for paper games
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 rounded-full web:mx-4">
      <Icon as={THEME_ICONS[colorScheme ?? 'light']} className="size-5" />
    </Button>
  );
}
