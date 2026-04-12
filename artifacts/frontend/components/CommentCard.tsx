import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
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
  const enterDelay = Math.min(index, 10) * 50;

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(350).springify().damping(20)}
      style={cardStyle}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          { borderBottomColor: colors.border },
          isNested && { paddingStart: 44 },
        ]}
      >
        {isNested && (
          <View style={[styles.nestedLine, { backgroundColor: colors.border }]} />
        )}

        <View style={styles.inner}>
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
              <Avatar uri={comment.authorAvatarUrl} displayName={comment.authorDisplayName} size={32} />
            </Pressable>
          </View>

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

          <View style={styles.footer}>
            {isOwn && (
              <Pressable onPress={handleDelete} hitSlop={10} style={styles.deleteBtn}>
                <Feather name="trash-2" size={12} color={colors.mutedForeground} />
              </Pressable>
            )}
            <Pressable onPress={handleReply} style={styles.replyBtn}>
              <Feather name="corner-up-left" size={12} color={colors.mutedForeground} />
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
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  inner: { paddingVertical: 14, gap: 8 },
  nestedLine: {
    position: "absolute",
    top: 14,
    bottom: 14,
    width: 1.5,
    start: 32,
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
    gap: 8,
    flexShrink: 1,
    justifyContent: "flex-end",
  },
  authorText: { alignItems: "flex-end", gap: 1, flexShrink: 1 },
  displayName: {
    fontFamily: "Amiri_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  handle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
    flexShrink: 0,
  },
  body: {
    fontFamily: "Amiri_400Regular",
    fontSize: 17,
    lineHeight: 28,
    textAlign: "right",
    writingDirection: "rtl",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 14,
    marginTop: 2,
  },
  deleteBtn: { opacity: 0.5 },
  replyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  replyLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  repliesCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
});
