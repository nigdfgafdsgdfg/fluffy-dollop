import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
import { useCreateUserProfile } from "@workspace/api-client-react";

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setProfile } = useAuth();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");

  const displayNameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  const s = strings.profileSetup;

  const createProfile = useCreateUserProfile({
    mutation: {
      onSuccess: (data) => {
        setProfile(data);
      },
      onError: (err: unknown) => {
        const e = err as { status?: number; data?: { error?: string } };
        if (e.status === 409) {
          setUsernameError(s.errorUsernameTaken);
        } else if (e.data?.error) {
          setUsernameError(e.data.error);
        }
      },
    },
  });

  const validate = () => {
    let valid = true;
    setUsernameError("");
    setDisplayNameError("");

    if (!username.trim()) {
      setUsernameError(s.errorUsernameRequired);
      valid = false;
    } else if (!/^[a-zA-Z0-9_]{1,30}$/.test(username.trim())) {
      setUsernameError(s.errorUsernameFormat);
      valid = false;
    }

    if (!displayName.trim()) {
      setDisplayNameError(s.errorDisplayNameRequired);
      valid = false;
    } else if (displayName.trim().length > 50) {
      setDisplayNameError(s.errorDisplayNameLength);
      valid = false;
    }

    return valid;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createProfile.mutate({
      data: {
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        avatarUrl: null,
      },
    });
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
          <Text style={[styles.title, { color: colors.foreground }]}>
            {s.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {s.subtitle}
          </Text>
        </View>

        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

        <View style={styles.form}>
          <AppTextInput
            label={s.username}
            value={username}
            onChangeText={(t) => {
              setUsername(t.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ""));
              setUsernameError("");
            }}
            placeholder={s.usernamePlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            returnKeyType="next"
            onSubmitEditing={() => displayNameRef.current?.focus()}
            error={usernameError}
            hint={s.usernameHint}
          />

          <AppTextInput
            ref={displayNameRef}
            label={s.displayName}
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              setDisplayNameError("");
            }}
            placeholder={s.displayNamePlaceholder}
            maxLength={50}
            returnKeyType="next"
            onSubmitEditing={() => bioRef.current?.focus()}
            error={displayNameError}
          />

          <AppTextInput
            ref={bioRef}
            label={s.bio}
            value={bio}
            onChangeText={setBio}
            placeholder={s.bioPlaceholder}
            multiline
            numberOfLines={3}
            maxLength={160}
            returnKeyType="done"
            style={styles.bioInput}
          />

          {createProfile.error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {(createProfile.error as { data?: { error?: string } })?.data?.error ??
                s.errorGeneric}
            </Text>
          ) : null}

          <Button
            label={s.createProfile}
            onPress={handleSubmit}
            isLoading={createProfile.isPending}
            fullWidth
          />
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
    gap: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
  },
  form: {
    gap: 14,
  },
  bioInput: {
    height: 88,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
