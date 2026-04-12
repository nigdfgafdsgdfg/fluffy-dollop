import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTextInput } from "@/components/AppTextInput";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handleSignup = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      setError(strings.signup.errorFillAll);
      return;
    }
    if (password.length < 6) {
      setError(strings.signup.errorPasswordLength);
      return;
    }
    if (password !== confirmPassword) {
      setError(strings.signup.errorPasswordMatch);
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/email-already-in-use") {
        setError(strings.signup.errorEmailInUse);
      } else if (e.code === "auth/invalid-email") {
        setError(strings.signup.errorInvalidEmail);
      } else {
        setError(e.message ?? strings.signup.errorGeneric);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>
            {strings.appName}
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            {strings.appTaglineSignup}
          </Text>
        </View>

        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

        <View style={styles.form}>
          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.destructive,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <AppTextInput
            label={strings.signup.email}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <View>
            <AppTextInput
              ref={passwordRef}
              label={strings.signup.password}
              value={password}
              onChangeText={setPassword}
              placeholder={strings.signup.passwordPlaceholder}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>

          <AppTextInput
            ref={confirmRef}
            label={strings.signup.confirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={strings.signup.confirmPasswordPlaceholder}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          <Button
            label={strings.signup.createAccount}
            onPress={handleSignup}
            isLoading={isLoading}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {strings.signup.haveAccount}{" "}
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={[styles.footerLink, { color: colors.foreground }]}>
                {strings.signup.signIn}
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 32,
    gap: 28,
  },
  header: {
    alignItems: "flex-end",
    gap: 6,
  },
  wordmark: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 42,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  form: {
    gap: 14,
  },
  errorBox: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  eyeButton: {
    position: "absolute",
    left: 14,
    bottom: 14,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  footerLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
