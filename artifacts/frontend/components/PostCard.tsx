import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useQueryClient } from "@tanstack/react-query";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import { resolveImageUrl } from "@/utils/imageUrl";
import type { Post } from "@workspace/api-client-react";
import {
  useDeletePost,
  useLikePost,
  useUnlikePost,
  getGetFeedQueryKey,
  getGetPostQueryKey,
} from "@workspace/api-client-react";

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

function ActionButton({ icon, label, onPress, active, activeColor }: {
  icon: string;
  label: string | number;
  onPress?: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.7, { damping: 5, stiffness: 320 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    });
    onPress?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const iconColor = active && activeColor ? activeColor : colors.mutedForeground;
  const labelColor = active && activeColor ? activeColor : colors.mutedForeground;

  return (
    <Pressable onPress={handlePress} style={styles.action} hitSlop={8}>
      <Animated.View style={animStyle}>
        <Feather name={icon as any} size={16} color={iconColor} />
      </Animated.View>
      {!!label && (
        <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function PostCard({ post, onDeleted, index = 0 }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwn = user?.uid === post.authorId;
  const s = strings.postCard;

  const scale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const deleteMutation = useDeletePost({
    mutation: { onSuccess: () => onDeleted?.() },
  });

  const likeMutation = useLikePost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(post.id) });
      }
    }
  });

  const unlikeMutation = useUnlikePost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(post.id) });
      }
    }
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.985, { damping: 20, stiffness: 400 });
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

  const handlePostPress = () => {
    router.push(`/post/${post.id}`);
  };

  const handleLike = () => {
    if (likeMutation.isPending || unlikeMutation.isPending) return;
    if (post.likedByMe) {
      unlikeMutation.mutate({ postId: post.id });
    } else {
      likeMutation.mutate({ postId: post.id });
    }
  };

  return (
    <Animated.View style={cardAnimStyle}>
      <Pressable
        onPress={handlePostPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, { borderBottomColor: colors.border }]}
      >
        {/* Author row */}
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
            <Avatar uri={post.authorAvatarUrl} displayName={post.authorDisplayName} size={40} />
          </Pressable>
        </View>

        {/* Body */}
        {post.content.trim().length > 0 && (
          <Text style={[styles.body, { color: colors.foreground }]}>
            {post.content}
          </Text>
        )}

        {/* Image */}
        {resolveImageUrl(post.imageUrl) && (
          <Image
            source={{ uri: resolveImageUrl(post.imageUrl)! }}
            style={[styles.postImage, { borderColor: colors.border }]}
            contentFit="cover"
          />
        )}

        {/* Action bar */}
        <View style={styles.footer}>
          <View style={styles.actions}>
            <ActionButton
              icon="message-circle"
              label={post.commentsCount > 0 ? post.commentsCount : ""}
              onPress={handlePostPress}
            />
            <ActionButton
              icon="heart"
              label={post.likesCount > 0 ? post.likesCount : ""}
              onPress={handleLike}
              active={post.likedByMe}
              activeColor={colors.destructive}
            />
            <ActionButton icon="share-2" label="" />
          </View>
          {isOwn && (
            <Pressable onPress={handleDelete} hitSlop={12} style={styles.deleteBtn}>
              <Feather name="trash-2" size={14} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
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
  authorText: { alignItems: "flex-end", gap: 2, flexShrink: 1 },
  displayName: {
    fontFamily: "Amiri_700Bold",
    fontSize: 15.5,
    letterSpacing: -0.1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  handle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "right",
    opacity: 0.6,
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    marginTop: 4,
    flexShrink: 0,
    opacity: 0.55,
  },
  body: {
    fontFamily: "Amiri_400Regular",
    fontSize: 19,
    lineHeight: 32,
    textAlign: "right",
    writingDirection: "rtl",
  },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 2,
  },
  deleteBtn: { padding: 4 },
  actions: { flexDirection: "row", gap: 20, alignItems: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    minWidth: 14,
  },
});
