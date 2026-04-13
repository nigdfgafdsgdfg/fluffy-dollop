import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import { resolveImageUrl } from "@/utils/imageUrl";
import type { Comment } from "@workspace/api-client-react";
import { useDeleteComment } from "@workspace/api-client-react";

interface CommentCardProps {
  comment: Comment;
  postId: string;
  onDeleted?: () => void;
  onReply?: (commentId: string, username: string) => void;
  index?: number;
  isNested?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const s = strings.postCard;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return s.secondsAgo(Math.max(1, diff));
  if (diff < 3600) return s.minutesAgo(Math.floor(diff / 60));
  if (diff < 86400) return s.hoursAgo(Math.floor(diff / 3600));
  return s.daysAgo(Math.floor(diff / 86400));
}

export function CommentCard({ comment, postId, onDeleted, onReply, index = 0, isNested = false }: CommentCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isOwn = user?.uid === comment.authorId;
  const s = strings.comments;

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const deleteMutation = useDeleteComment({
    mutation: { onSuccess: () => onDeleted?.() },
  });

  const handleDelete = () => {
    Alert.alert(s.deleteTitle, s.deleteMessage, [
      { text: s.deleteCancel, style: "cancel" },
      {
        text: s.deleteConfirm,
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteMutation.mutate({ postId, commentId: comment.id });
        },
      },
    ]);
  };

  const handleReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply?.(comment.id, comment.authorUsername);
  };

  const handleAuthorPress = () => {
    if (user?.uid === comment.authorId) router.push("/(tabs)/profile");
    else router.push(`/user/${comment.authorId}`);
  };

  const handlePressIn = () => { scale.value = withSpring(0.988, { damping: 20, stiffness: 400 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); };

  const imageUrl = resolveImageUrl(comment.imageUrl);

  return (
    <Animated.View style={cardStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          { borderBottomColor: colors.border },
          isNested && { paddingStart: 50 },
        ]}
      >
        {isNested && (
          <View style={[styles.nestedLine, { backgroundColor: colors.border }]} />
        )}

        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.topRow}>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {formatRelativeTime(comment.createdAt)}
            </Text>
            <Pressable onPress={handleAuthorPress} style={styles.authorRow}>
              <View style={styles.authorText}>
                <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
                  {comment.authorDisplayName}
                </Text>
                <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  @{comment.authorUsername}
                </Text>
              </View>
              <Avatar uri={comment.authorAvatarUrl} displayName={comment.authorDisplayName} size={34} />
            </Pressable>
          </View>

          {/* Body */}
          <Text style={[styles.body, { color: colors.foreground }]}>
            {comment.content}
          </Text>

          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[styles.image, { borderColor: colors.border }]}
              resizeMode="cover"
            />
          ) : null}

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Pressable onPress={handleReply} hitSlop={8} style={styles.replyBtn}>
                <Feather name="corner-up-left" size={13} color={colors.mutedForeground} />
                <Text style={[styles.replyLabel, { color: colors.mutedForeground }]}>
                  {s.replyToThis}
                </Text>
              </Pressable>
              {comment.repliesCount > 0 && (
                <Text style={[styles.repliesCount, { color: colors.mutedForeground }]}>
                  {s.viewReplies(comment.repliesCount)}
                </Text>
              )}
            </View>
            {isOwn && (
              <Pressable onPress={handleDelete} hitSlop={12}>
                <Feather name="trash-2" size={13} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  inner: { paddingTop: 14, paddingBottom: 6, gap: 10 },
  nestedLine: {
    position: "absolute",
    top: 14,
    bottom: 14,
    width: 1.5,
    start: 32,
    borderRadius: 1,
    opacity: 0.35,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flexShrink: 1,
    justifyContent: "flex-end",
  },
  authorText: { alignItems: "flex-end", gap: 2, flexShrink: 1 },
  displayName: {
    fontFamily: "Amiri_700Bold",
    fontSize: 14.5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  handle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    textAlign: "right",
    opacity: 0.6,
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
    flexShrink: 0,
    opacity: 0.55,
  },
  body: {
    fontFamily: "Amiri_400Regular",
    fontSize: 17.5,
    lineHeight: 29,
    textAlign: "right",
    writingDirection: "rtl",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
    marginTop: 2,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  replyBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  replyLabel: { fontFamily: "Inter_400Regular", fontSize: 12.5, opacity: 0.7 },
  repliesCount: { fontFamily: "Inter_400Regular", fontSize: 12.5, opacity: 0.6 },
});
