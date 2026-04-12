import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

interface LoadingStateProps {
  size?: "small" | "large";
  fullScreen?: boolean;
}

export function LoadingState({ fullScreen = false }: LoadingStateProps) {
  const colors = useColors();
  const opacity = useSharedValue(0.2);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? colors.background : "transparent" },
      ]}
    >
      <Animated.Text style={[styles.wordmark, { color: colors.foreground }, animStyle]}>
        مرمر
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  fullScreen: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  wordmark: {
    fontFamily: "Amiri_700Bold_Italic",
    fontSize: 36,
    letterSpacing: 0,
  },
});
