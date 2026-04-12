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

function TabIcon({
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
  const dotScale = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, { damping: 10, stiffness: 260 });
    dotScale.value = withSpring(focused ? 1 : 0, { damping: 12, stiffness: 300 });
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotScale.value,
  }));

  return (
    <View style={styles.tabItem}>
      <Animated.View style={iconStyle}>
        <Feather
          name={name}
          size={20}
          color={focused ? colors.foreground : colors.mutedForeground}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: focused ? colors.foreground : colors.mutedForeground,
            fontFamily: focused ? "Amiri_700Bold" : "Amiri_400Regular",
          },
        ]}
      >
        {label}
      </Text>
      <Animated.View
        style={[styles.dot, { backgroundColor: colors.accent }, dotStyle]}
      />
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
        tabBarShowLabel: false,
        headerShown: false,
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
              intensity={85}
              tint={isDark ? "dark" : "extraLight"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" label="الرئيسية" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="user" label="ملفي" focused={focused} />
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
    gap: 3,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
    writingDirection: "rtl",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
