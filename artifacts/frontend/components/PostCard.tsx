import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import type { Post } from "@workspace/api-client-react";
import { useDeletePost } from "@workspace/api-client-react";

interface PostCardProps {
  post: Post;
  onDeleted?: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PostCard({ post, onDeleted }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isOwn = user?.uid === post.authorId;

  const deleteMutation = useDeletePost({
    mutation: {
      onSuccess: () => {
        onDeleted?.();
      },
    },
  });

  const handleDelete = () => {
    Alert.alert("Delete post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteMutation.mutate({ postId: post.id });
        },
      },
    ]);
  };

  const handleUserPress = () => {
    if (isOwn) {
      router.push("/(tabs)/profile");
    } else {
      router.push(`/user/${post.authorId}`);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Pressable onPress={handleUserPress}>
        <Avatar
          uri={post.authorAvatarUrl}
          displayName={post.authorDisplayName}
          size={44}
        />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={handleUserPress} style={styles.authorInfo}>
            <Text
              style={[styles.displayName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {post.authorDisplayName}
            </Text>
            <Text
              style={[styles.username, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              @{post.authorUsername}
            </Text>
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>
              ·
            </Text>
            <Text
              style={[styles.time, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {formatRelativeTime(post.createdAt)}
            </Text>
          </Pressable>

          {isOwn && (
            <Pressable
              onPress={handleDelete}
              style={styles.deleteButton}
              hitSlop={8}
            >
              <Feather
                name="trash-2"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        <Text style={[styles.body, { color: colors.foreground }]}>
          {post.content}
        </Text>

        <View style={styles.actions}>
          <View style={styles.action}>
            <Feather name="message-circle" size={16} color={colors.mutedForeground} />
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
              {post.commentsCount}
            </Text>
          </View>
          <View style={styles.action}>
            <Feather name="heart" size={16} color={colors.mutedForeground} />
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
              {post.likesCount}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    overflow: "hidden",
  },
  displayName: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    flexShrink: 1,
  },
  username: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flexShrink: 1,
  },
  dot: {
    fontSize: 14,
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flexShrink: 0,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 24,
    marginTop: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
