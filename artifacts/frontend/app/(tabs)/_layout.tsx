import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

// Custom tab icon — only used on Android
function AndroidTabIcon({
  name,
  label,
  focused,
}: {
  name: keyof typeof Feather.glyphMap;
  label: string;
  focused: boolean;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 1, { damping: 10, stiffness: 260 });
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.tabItem}>
      <Animated.View style={iconStyle}>
        <Feather
          name={name}
          size={22}
          color={focused ? colors.foreground : colors.mutedForeground}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: focused ? colors.foreground : colors.mutedForeground,
            fontFamily: focused ? "Amiri_700Bold" : "Amiri_400Regular",
            opacity: focused ? 1 : 0.5,
          },
        ]}
      >
        {label}
      </Text>
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        // On iOS: show native labels, hide custom icon label
        // On Android: hide native label (we render our own)
        tabBarShowLabel: isIOS,
        headerShown: true,
        headerTransparent: true,
        headerBlurEffect: isDark ? "dark" : "light",
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: "Amiri_700Bold_Italic",
          fontSize: 22,
        },
        // On iOS use native tab bar label font via tabBarLabelStyle
        tabBarLabelStyle: isIOS
          ? {
              fontFamily: "Amiri_700Bold",
              fontSize: 10,
              writingDirection: "rtl",
            }
          : undefined,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          height: Platform.OS === "web" ? 64 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={92}
              tint={isDark ? "dark" : "extraLight"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ focused, color, size }) =>
            isIOS ? (
              // Native iOS: just the icon, system handles label + active state
              <Feather name="home" size={size ?? 22} color={color} />
            ) : (
              <AndroidTabIcon name="home" label="الرئيسية" focused={focused} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "ملفي",
          tabBarIcon: ({ focused, color, size }) =>
            isIOS ? (
              <Feather name="user" size={size ?? 22} color={color} />
            ) : (
              <AndroidTabIcon name="user" label="ملفي" focused={focused} />
            ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    gap: 3,
    width: 64,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
    writingDirection: "rtl",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
