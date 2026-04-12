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
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import {
  getGetFeedQueryKey,
  getGetUserPostsQueryKey,
  useCreatePost,
} from "@workspace/api-client-react";

const MAX_CHARS = 280;
const RING_SIZE = 28;
const RING_STROKE = 2.5;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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

  const s = strings.compose;

  const progress = Math.min(content.length / MAX_CHARS, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const ringColor = isOverLimit
    ? colors.destructive
    : remaining < 20
    ? colors.destructive
    : remaining < 50
    ? colors.accent
    : colors.foreground;

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

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={handlePost}
          disabled={isEmpty || isOverLimit || createPost.isPending}
          style={[
            styles.postButton,
            {
              backgroundColor:
                isEmpty || isOverLimit ? colors.muted : colors.foreground,
              opacity: createPost.isPending ? 0.6 : 1,
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
                    : colors.background,
              },
            ]}
          >
            {createPost.isPending ? s.publishing : s.publish}
          </Text>
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.mutedForeground }]}>
          {s.headerTitle}
        </Text>

        <Pressable onPress={handleCancel} hitSlop={8} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
            {s.cancel}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.inputWrap}>
          <Text style={[styles.authorName, { color: colors.mutedForeground }]}>
            {profile?.displayName ?? ""}
          </Text>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder={s.placeholder}
            placeholderTextColor={colors.mutedForeground}
            multiline
            autoFocus
            value={content}
            onChangeText={setContent}
            maxLength={MAX_CHARS + 50}
            textAlignVertical="top"
            textAlign="right"
            writingDirection="rtl"
          />
        </View>
        <Avatar
          uri={profile?.avatarUrl}
          displayName={profile?.displayName ?? "Me"}
          size={42}
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 10,
            borderTopColor: colors.border,
          },
        ]}
      >
        {createPost.isError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {s.errorPost}
          </Text>
        ) : (
          <View style={styles.footerLeft} />
        )}

        <View style={styles.ringWrap}>
          {remaining < 50 && (
            <Text
              style={[
                styles.remainingText,
                {
                  color: ringColor,
                  marginLeft: 6,
                },
              ]}
            >
              {remaining < 0 ? remaining : remaining}
            </Text>
          )}
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    minWidth: 52,
    alignItems: "flex-end",
  },
  cancelText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    writingDirection: "rtl",
  },
  headerTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.8,
    writingDirection: "rtl",
  },
  postButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: "center",
  },
  postButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.2,
    writingDirection: "rtl",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    padding: 20,
    gap: 14,
  },
  inputWrap: {
    flex: 1,
    gap: 6,
    alignItems: "flex-end",
  },
  authorName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    writingDirection: "rtl",
  },
  input: {
    flex: 1,
    width: "100%",
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    lineHeight: 29,
    paddingTop: 0,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  footerLeft: {
    flex: 1,
  },
  ringWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  remainingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    minWidth: 24,
    textAlign: "right",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
