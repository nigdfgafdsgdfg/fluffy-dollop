import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import { resolveImageUrl } from "@/utils/imageUrl";
import type { Post } from "@workspace/api-client-react";
import { useDeletePost } from "@workspace/api-client-react";

interface PostCardProps {
  post: Post;
  onDeleted?: () => void;
  index?: number;
}

function formatRelativeTime(dateStr: string): string {
  const s = strings.postCard;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return s.secondsAgo(Math.max(1, diff));
  if (diff < 3600) return s.minutesAgo(Math.floor(diff / 60));
  if (diff < 86400) return s.hoursAgo(Math.floor(diff / 3600));
  if (diff < 604800) return s.daysAgo(Math.floor(diff / 86400));
  return new Date(dateStr).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function ActionButton({ icon, label, onPress }: {
  icon: string;
  label: string | number;
  onPress?: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.75, { damping: 6, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    onPress?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable onPress={handlePress} style={styles.action}>
      <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Animated.View style={animStyle}>
        <Feather name={icon as any} size={14} color={colors.mutedForeground} />
      </Animated.View>
    </Pressable>
  );
}

export function PostCard({ post, onDeleted, index = 0 }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isOwn = user?.uid === post.authorId;
  const s = strings.postCard;

  const scale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const deleteMutation = useDeletePost({
    mutation: { onSuccess: () => onDeleted?.() },
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.984, { damping: 20, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const handleDelete = () => {
    Alert.alert(s.deleteTitle, s.deleteMessage, [
      { text: s.deleteCancel, style: "cancel" },
      {
        text: s.deleteConfirm,
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteMutation.mutate({ postId: post.id });
        },
      },
    ]);
  };

  const handleUserPress = () => {
    if (isOwn) router.push("/(tabs)/profile");
    else router.push(`/user/${post.authorId}`);
  };

  const enterDelay = Math.min(index, 8) * 70;

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(380).springify().damping(18)}
      style={cardAnimStyle}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, { backgroundColor: colors.background }]}
      >
        <View style={[styles.inner, { borderBottomColor: colors.border }]}>
          <View style={styles.topRow}>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {formatRelativeTime(post.createdAt)}
            </Text>
            <Pressable onPress={handleUserPress} style={styles.authorRow}>
              <View style={styles.authorText}>
                <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
                  {post.authorDisplayName}
                </Text>
                <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  @{post.authorUsername}
                </Text>
              </View>
              <Avatar uri={post.authorAvatarUrl} displayName={post.authorDisplayName} size={38} />
            </Pressable>
          </View>

          {post.content.trim().length > 0 && (
            <Text style={[styles.body, { color: colors.foreground }]}>
              {post.content}
            </Text>
          )}

          {resolveImageUrl(post.imageUrl) && (
            <Image
              source={{ uri: resolveImageUrl(post.imageUrl)! }}
              style={[styles.postImage, { borderColor: colors.border }]}
              contentFit="cover"
            />
          )}

          <View style={styles.footer}>
            {isOwn && (
              <Pressable onPress={handleDelete} hitSlop={10} style={styles.deleteBtn}>
                <Feather name="trash-2" size={13} color={colors.mutedForeground} />
              </Pressable>
            )}
            <View style={styles.actions}>
              <ActionButton icon="message-circle" label={post.commentsCount > 0 ? post.commentsCount : s.reply} />
              <ActionButton icon="heart" label={post.likesCount > 0 ? post.likesCount : s.like} />
              <ActionButton icon="share" label="" />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 20 },
  inner: {
    paddingVertical: 18,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    justifyContent: "flex-end",
  },
  authorText: { alignItems: "flex-end", gap: 1, flexShrink: 1 },
  displayName: {
    fontFamily: "Amiri_700Bold",
    fontSize: 15,
    letterSpacing: -0.1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  handle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "right",
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
    flexShrink: 0,
  },
  body: {
    fontFamily: "Amiri_400Regular",
    fontSize: 19,
    lineHeight: 30,
    textAlign: "right",
    writingDirection: "rtl",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: { padding: 4, opacity: 0.5 },
  actions: { flexDirection: "row", gap: 18, alignItems: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    minWidth: 14,
    textAlign: "right",
  },
});
