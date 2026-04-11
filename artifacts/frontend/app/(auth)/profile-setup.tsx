import { Feather } from "@expo/vector-icons";
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

  const createProfile = useCreateUserProfile({
    mutation: {
      onSuccess: (data) => {
        setProfile(data);
      },
      onError: (err: unknown) => {
        const e = err as { status?: number; data?: { error?: string } };
        if (e.status === 409) {
          setUsernameError("This username is already taken.");
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
      setUsernameError("Username is required.");
      valid = false;
    } else if (!/^[a-zA-Z0-9_]{1,30}$/.test(username.trim())) {
      setUsernameError("Only letters, numbers, and underscores. Max 30 chars.");
      valid = false;
    }

    if (!displayName.trim()) {
      setDisplayNameError("Display name is required.");
      valid = false;
    } else if (displayName.trim().length > 50) {
      setDisplayNameError("Display name must be 50 characters or less.");
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
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Feather name="user-check" size={36} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Set up your profile
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Tell the world who you are
          </Text>
        </View>

        <View style={styles.form}>
          <AppTextInput
            label="Username"
            value={username}
            onChangeText={(t) => {
              setUsername(t.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ""));
              setUsernameError("");
            }}
            placeholder="yourhandle"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            returnKeyType="next"
            onSubmitEditing={() => displayNameRef.current?.focus()}
            error={usernameError}
            hint="Letters, numbers, and underscores only"
          />

          <AppTextInput
            ref={displayNameRef}
            label="Display name"
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              setDisplayNameError("");
            }}
            placeholder="Your Name"
            maxLength={50}
            returnKeyType="next"
            onSubmitEditing={() => bioRef.current?.focus()}
            error={displayNameError}
          />

          <AppTextInput
            ref={bioRef}
            label="Bio (optional)"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            multiline
            numberOfLines={3}
            maxLength={160}
            returnKeyType="done"
            style={styles.bioInput}
          />

          {createProfile.error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {(createProfile.error as { data?: { error?: string } })?.data?.error ??
                "Failed to create profile. Please try again."}
            </Text>
          ) : null}

          <Button
            label="Create profile"
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
    paddingHorizontal: 28,
    gap: 32,
  },
  header: {
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
  bioInput: {
    height: 88,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
});
