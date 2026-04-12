import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "ghost";

interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  onPress,
  label,
  variant = "primary",
  isLoading = false,
  disabled = false,
  style,
  fullWidth = false,
}: ButtonProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 18, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };
  const handlePress = () => {
    if (disabled || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getBgColor = () => {
    if (disabled) return colors.muted;
    switch (variant) {
      case "primary": return colors.primary;
      case "secondary": return colors.secondary;
      case "outline": return "transparent";
      case "destructive": return colors.destructive;
      case "ghost": return "transparent";
    }
  };
  const getTextColor = () => {
    if (disabled) return colors.mutedForeground;
    switch (variant) {
      case "primary": return colors.primaryForeground;
      case "secondary": return colors.secondaryForeground;
      case "outline": return colors.foreground;
      case "destructive": return colors.destructiveForeground;
      case "ghost": return colors.foreground;
    }
  };

  return (
    <Animated.View style={[animStyle, fullWidth && styles.fullWidth]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        style={[
          styles.button,
          {
            backgroundColor: getBgColor(),
            borderColor: variant === "outline" ? colors.border : "transparent",
            borderWidth: variant === "outline" ? 1 : 0,
            borderRadius: colors.radius,
          },
          style,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={variant === "primary" ? colors.primaryForeground : colors.foreground} />
        ) : (
          <Text style={[styles.label, { color: getTextColor() }]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: "stretch" },
  button: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    letterSpacing: 0.3,
    writingDirection: "rtl",
  },
});
