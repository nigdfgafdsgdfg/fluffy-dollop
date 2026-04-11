import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  getGetFeedQueryKey,
  getGetUserPostsQueryKey,
  useCreatePost,
} from "@workspace/api-client-react";

const MAX_CHARS = 280;

export default function ComposeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const inputRef = useRef<TextInput>(null);
  const remaining = MAX_CHARS - content.length;
  const isOverLimit = remaining < 0;
  const isEmpty = content.trim().length === 0;

  const createPost = useCreatePost({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        if (user?.uid) {
          queryClient.invalidateQueries({
            queryKey: getGetUserPostsQueryKey(user.uid),
          });
        }
        router.back();
      },
    },
  });

  const handlePost = () => {
    if (isEmpty || isOverLimit || createPost.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createPost.mutate({ data: { content: content.trim() } });
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const remainingColor =
    remaining < 0
      ? colors.destructive
      : remaining < 20
      ? "#F4212E"
      : remaining < 50
      ? "#FF7A00"
      : colors.mutedForeground;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable onPress={handleCancel} hitSlop={8}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>

        <Pressable
          onPress={handlePost}
          disabled={isEmpty || isOverLimit || createPost.isPending}
          style={[
            styles.postButton,
            {
              backgroundColor:
                isEmpty || isOverLimit ? colors.muted : colors.primary,
              opacity: createPost.isPending ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.postButtonText,
              {
                color:
                  isEmpty || isOverLimit
                    ? colors.mutedForeground
                    : colors.primaryForeground,
              },
            ]}
          >
            {createPost.isPending ? "Posting…" : "Post"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Avatar
          uri={profile?.avatarUrl}
          displayName={profile?.displayName ?? "Me"}
          size={44}
        />

        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground }]}
          placeholder="What is happening?!"
          placeholderTextColor={colors.mutedForeground}
          multiline
          autoFocus
          value={content}
          onChangeText={setContent}
          maxLength={MAX_CHARS + 50}
          textAlignVertical="top"
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 8,
            borderTopColor: colors.border,
          },
        ]}
      >
        {createPost.isError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            Failed to post. Please try again.
          </Text>
        ) : null}
        <View style={styles.footerRight}>
          <Text style={[styles.counter, { color: remainingColor }]}>
            {remaining}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    lineHeight: 26,
    paddingTop: 0,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  footerRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  counter: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
  },
});
