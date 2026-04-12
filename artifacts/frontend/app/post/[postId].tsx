import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CommentCard } from "@/components/CommentCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import { resolveImageUrl } from "@/utils/imageUrl";
import {
  getGetPostCommentsQueryKey,
  useGetPost,
  useGetPostComments,
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  if (postLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <NavBar colors={colors} insets={insets} />
        <LoadingState />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <NavBar colors={colors} insets={insets} />
        <EmptyState icon="alert-circle" title="لم يُعثر على المنشور" message="ربما تم حذفه." />
      </View>
    );
  }

  const ListHeader = (
    <>
      <Animated.View
        entering={FadeInDown.delay(0).duration(400).springify().damping(20)}
        style={[styles.postContainer, { borderBottomColor: colors.border }]}
      >
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

        <View style={[styles.statsRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          <Text style={[styles.stat, { color: colors.mutedForeground }]}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{post.commentsCount}</Text>
            {"  "}رد
          </Text>
          <Text style={[styles.stat, { color: colors.mutedForeground }]}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{post.likesCount}</Text>
            {"  "}إعجاب
          </Text>
        </View>

        <Pressable onPress={handleReplyToPost} style={[styles.replyButton, { borderColor: colors.border }]}>
          <Feather name="corner-up-left" size={14} color={colors.mutedForeground} />
          <Text style={[styles.replyButtonText, { color: colors.mutedForeground }]}>
            {s.repliesTitle}
          </Text>
        </Pressable>
      </Animated.View>

      {topLevel.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(80).duration(400).springify().damping(20)}
          style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {s.repliesTitle}
          </Text>
        </Animated.View>
      )}
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <NavBar colors={colors} insets={insets} />

      <FlatList
        data={topLevel}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingTop: 60 + insets.top }}
        ListEmptyComponent={
          commentsLoading ? null : (
            <EmptyState icon="message-circle" title={s.noReplies} message={s.noRepliesMessage} />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />
        }
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      />

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={[
          styles.fab,
          { backgroundColor: colors.foreground, bottom: insets.bottom + 20 },
        ]}
      >
        <Pressable style={styles.fabInner} onPress={handleReplyToPost}>
          <Feather name="corner-up-left" size={16} color={colors.background} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function NavBar({ colors, insets }: { colors: any; insets: any }) {
  const router = useRouter();
  return (
    <View
      style={[
        styles.navBar,
        {
          paddingTop: insets.top + 8,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={{ width: 32 }} />
      <Text style={[styles.navTitle, { color: colors.foreground }]}>
        {strings.postDetail.navTitle}
      </Text>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Feather name="chevron-right" size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: { fontFamily: "Amiri_700Bold", fontSize: 18, writingDirection: "rtl" },
  backBtn: { padding: 2 },
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
    fontSize: 22,
    lineHeight: 36,
    textAlign: "right",
    writingDirection: "rtl",
  },
  image: {
    width: "100%",
    height: 280,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timestamp: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
    justifyContent: "flex-end",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { fontFamily: "Amiri_400Regular", fontSize: 15 },
  statNum: { fontFamily: "Amiri_700Bold", fontSize: 15 },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  replyButtonText: { fontFamily: "Amiri_400Regular", fontSize: 16, writingDirection: "rtl" },
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
