import React, { forwardRef } from "react";
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
  ({ label, error, hint, style, ...props }, ref) => {
    const colors = useColors();

    return (
      <View style={styles.container}>
        {label && (
          <Text style={[styles.label, { color: colors.foreground }]}>
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: error ? colors.destructive : colors.input,
              color: colors.foreground,
              borderRadius: colors.radius / 2,
            },
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
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
    fontSize: 14,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
