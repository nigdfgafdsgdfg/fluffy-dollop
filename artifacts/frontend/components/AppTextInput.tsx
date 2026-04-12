import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  ({ label, error, hint, style, onFocus, onBlur, ...props }, ref) => {
    const colors = useColors();
    const [focused, setFocused] = useState(false);

    return (
      <View style={styles.container}>
        {label && (
          <Text
            style={[
              styles.label,
              {
                color: focused ? colors.accent : colors.mutedForeground,
              },
            ]}
          >
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: focused ? colors.background : colors.card,
              borderColor: error
                ? colors.destructive
                : focused
                ? colors.accent
                : colors.border,
              color: colors.foreground,
              borderRadius: colors.radius,
              borderWidth: focused ? 1.5 : 1,
            },
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          textAlign="right"
          writingDirection="rtl"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <Text style={[styles.error, { color: colors.destructive }]}>
            {error}
          </Text>
        )}
        {hint && !error && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {hint}
          </Text>
        )}
      </View>
    );
  }
);

AppTextInput.displayName = "AppTextInput";

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
    letterSpacing: 0.4,
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
