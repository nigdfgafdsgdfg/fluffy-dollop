import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
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
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTextInput } from "@/components/AppTextInput";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError(strings.login.errorFillAll); return; }
    setError(""); setIsLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setError(strings.login.errorInvalidCredential);
      } else {
        setError(e.message ?? strings.login.errorGeneric);
      }
    } finally { setIsLoading(false); }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true); setError("");
    try { await signInWithGoogle(); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? strings.login.errorGoogleFailed); }
    finally { setIsGoogleLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(600).springify().damping(18)} style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>
            {strings.appName}
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            {strings.appTaglineLogin}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).duration(500).springify().damping(20)}
          style={[styles.dividerLine, { backgroundColor: colors.border }]}
        />

        <View style={styles.form}>
          {error ? (
            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}
            >
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(160).duration(500).springify().damping(20)}>
            <AppTextInput
              label={strings.login.email}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(500).springify().damping(20)}>
            <View>
              <AppTextInput
                ref={passwordRef}
                label={strings.login.password}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(320).duration(500).springify().damping(20)}>
            <Button label={strings.login.continue} onPress={handleLogin} isLoading={isLoading} disabled={isGoogleLoading} fullWidth />
          </Animated.View>

          {Platform.OS === "web" && (
            <Animated.View entering={FadeInDown.delay(400).duration(500).springify().damping(20)} style={styles.googleWrap}>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{strings.login.or}</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
              <Button label={strings.login.continueGoogle} onPress={handleGoogle} variant="outline" isLoading={isGoogleLoading} disabled={isLoading} fullWidth />
            </Animated.View>
          )}
        </View>

        <Animated.View entering={FadeInUp.delay(480).duration(500).springify().damping(20)} style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{strings.login.newHere} </Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable>
              <Text style={[styles.footerLink, { color: colors.foreground }]}>{strings.login.createAccount}</Text>
            </Pressable>
          </Link>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 32, gap: 28 },
  header: { alignItems: "flex-end", gap: 6 },
  wordmark: {
    fontFamily: "Amiri_700Bold_Italic",
    fontSize: 48,
    letterSpacing: 0,
  },
  tagline: {
    fontFamily: "Amiri_400Regular",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  form: { gap: 14 },
  errorBox: { padding: 12, borderRadius: 6, borderWidth: 1 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  eyeButton: { position: "absolute", left: 14, bottom: 14 },
  googleWrap: { gap: 14 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  footer: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  footerText: { fontFamily: "Amiri_400Regular", fontSize: 16, textAlign: "right", writingDirection: "rtl" },
  footerLink: { fontFamily: "Amiri_700Bold", fontSize: 16, textDecorationLine: "underline" },
});
