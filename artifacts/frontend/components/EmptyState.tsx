import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const colors = useColors();
  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify().damping(18)}
      style={styles.container}
    >
      <View style={[styles.iconWrap, { borderColor: colors.border }]}>
        <Feather name={icon} size={22} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: 10,
    paddingVertical: 80,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Amiri_700Bold",
    fontSize: 20,
    textAlign: "center",
    writingDirection: "rtl",
  },
  message: {
    fontFamily: "Amiri_400Regular",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
    writingDirection: "rtl",
  },
});
