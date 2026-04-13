import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CommentCard } from "@/components/CommentCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import { resolveImageUrl } from "@/utils/imageUrl";

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
        <Feather name={icon as any} size={20} color={iconColor} />
      </Animated.View>
      {!!label && (
        <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}
import {
  getGetPostCommentsQueryKey,
  useGetPost,
  useGetPostComments,
  useLikePost,
  useUnlikePost,
  getGetPostQueryKey,
  getGetFeedQueryKey,
  type Comment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PostDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const s = strings.postDetail;

  const { data: post, isLoading: postLoading } = useGetPost(postId ?? "", {
    query: { enabled: !!postId },
  });

  const { data: commentsData, isLoading: commentsLoading, refetch } = useGetPostComments(
    postId ?? "",
    { limit: 100 },
    { query: { enabled: !!postId } }
  );

  const comments = commentsData?.comments ?? [];

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const nestedMap = React.useMemo(() => {
    const m: Record<string, Comment[]> = {};
    comments
      .filter((c) => c.parentCommentId)
      .forEach((c) => {
        const pid = c.parentCommentId!;
        if (!m[pid]) m[pid] = [];
        m[pid].push(c);
      });
    return m;
  }, [comments]);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const likeMutation = useLikePost({
    mutation: {
      onSuccess: () => {
        if (postId) queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
      }
    }
  });

  const unlikeMutation = useUnlikePost({
    mutation: {
      onSuccess: () => {
        if (postId) queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
      }
    }
  });

  const handleCommentDeleted = useCallback(() => {
    if (postId) queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(postId) });
  }, [queryClient, postId]);

  const handleReply = useCallback(
    (commentId: string, username: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/compose",
        params: {
          replyToPostId: postId,
          replyToCommentId: commentId,
          replyToUsername: username,
        },
      });
    },
    [router, postId]
  );

  const handleReplyToPost = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/compose",
      params: {
        replyToPostId: postId,
        replyToUsername: post?.authorUsername ?? "",
      },
    });
  };

  const handleLike = () => {
    if (!post || likeMutation.isPending || unlikeMutation.isPending) return;
    if (post.likedByMe) unlikeMutation.mutate({ postId: post.id });
    else likeMutation.mutate({ postId: post.id });
  };

  const imageUrl = resolveImageUrl(post?.imageUrl);

  const renderComment = useCallback(
    ({ item, index }: { item: Comment; index: number }) => {
      const replies = nestedMap[item.id] ?? [];
      return (
        <View>
          <CommentCard
            comment={item}
            postId={postId ?? ""}
            onDeleted={handleCommentDeleted}
            onReply={handleReply}
            index={index}
          />
          {replies.map((reply, ri) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              postId={postId ?? ""}
              onDeleted={handleCommentDeleted}
              onReply={handleReply}
              index={index + ri + 1}
              isNested
            />
          ))}
        </View>
      );
    },
    [nestedMap, postId, handleCommentDeleted, handleReply]
  );

  const headerOptions = (
    <Stack.Screen
      options={{
        title: strings.postDetail.navTitle,
        headerTransparent: true,
        headerBlurEffect: colors.background === "#14120E" ? "dark" : "light",
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "Amiri_700Bold", fontSize: 18 },
      }}
    />
  );

  if (postLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {headerOptions}
        <LoadingState />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {headerOptions}
        <EmptyState icon="alert-circle" title="لم يُعثر على المنشور" message="ربما تم حذفه." />
      </View>
    );
  }

  const ListHeader = (
    <>
      <View style={[styles.postContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.authorRow}>
          <View style={styles.authorMeta}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {post.authorDisplayName}
            </Text>
            <Text style={[styles.handle, { color: colors.mutedForeground }]}>
              @{post.authorUsername}
            </Text>
          </View>
          <Avatar uri={post.authorAvatarUrl} displayName={post.authorDisplayName} size={44} />
        </View>

        <Text style={[styles.body, { color: colors.foreground }]}>
          {post.content}
        </Text>

        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { borderColor: colors.border }]}
            resizeMode="cover"
          />
        ) : null}

        <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
          {formatFullDate(post.createdAt)}
        </Text>

        <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
          <ActionButton
            icon="message-circle"
            label={post.commentsCount > 0 ? post.commentsCount : s.reply}
            onPress={handleReplyToPost}
          />
          <ActionButton
            icon="heart"
            label={post.likesCount > 0 ? post.likesCount : s.like}
            onPress={handleLike}
            active={post.likedByMe}
            activeColor={colors.destructive}
          />
          <ActionButton icon="share-2" label="" />
        </View>
      </View>

      {topLevel.length > 0 && (
        <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {s.repliesTitle}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {headerOptions}

      <FlatList
        data={topLevel}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        ListHeaderComponent={ListHeader}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: 16 }}
        ListEmptyComponent={
          commentsLoading ? null : (
            <EmptyState icon="message-circle" title={s.noReplies} message={s.noRepliesMessage} />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.mutedForeground} />
        }
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      />

      <View
        style={[
          styles.fab,
          { backgroundColor: colors.foreground, bottom: insets.bottom + 20 },
        ]}
      >
        <Pressable style={styles.fabInner} onPress={handleReplyToPost}>
          <Feather name="corner-up-left" size={16} color={colors.background} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  postContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  authorMeta: { alignItems: "flex-end", gap: 2 },
  displayName: {
    fontFamily: "Amiri_700Bold",
    fontSize: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  handle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "right",
  },
  body: {
    fontFamily: "Amiri_400Regular",
    fontSize: 24,
    lineHeight: 38,
    textAlign: "right",
    writingDirection: "rtl",
  },
  image: {
    width: "100%",
    height: 320,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timestamp: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "right",
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 30,
    justifyContent: "space-around",
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minWidth: 16,
    textAlign: "right",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
  },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.2 },
  fab: {
    position: "absolute",
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fabInner: { flex: 1, alignItems: "center", justifyContent: "center" },
});
