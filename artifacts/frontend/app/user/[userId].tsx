import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import {
  getGetUserFollowersQueryKey,
  getGetUserFollowingQueryKey,
  getGetUserPostsQueryKey,
  getGetUserProfileQueryKey,
  useFollowUser,
  useGetUserFollowers,
  useGetUserPosts,
  useGetUserProfile,
  useUnfollowUser,
  type Post,
} from "@workspace/api-client-react";

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const s = strings.userProfile;

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useGetUserProfile(userId ?? "");

  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } =
    useGetUserPosts(userId ?? "", { limit: 30 });

  const { data: followersData, refetch: refetchFollowers } = useGetUserFollowers(
    userId ?? ""
  );

  const isFollowing = !!(
    followersData?.users && user?.uid &&
    followersData.users.some((f) => f.uid === user.uid)
  );

  const followMutation = useFollowUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(userId ?? "") });
        queryClient.invalidateQueries({ queryKey: getGetUserFollowersQueryKey(userId ?? "") });
        queryClient.invalidateQueries({ queryKey: getGetUserFollowingQueryKey(user?.uid ?? "") });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const unfollowMutation = useUnfollowUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(userId ?? "") });
        queryClient.invalidateQueries({ queryKey: getGetUserFollowersQueryKey(userId ?? "") });
        queryClient.invalidateQueries({ queryKey: getGetUserFollowingQueryKey(user?.uid ?? "") });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    },
  });

  const handleFollowToggle = () => {
    if (!userId) return;
    if (isFollowing) {
      unfollowMutation.mutate({ targetUserId: userId });
    } else {
      followMutation.mutate({ targetUserId: userId });
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchPosts(), refetchFollowers()]);
    setRefreshing(false);
  }, [refetchProfile, refetchPosts, refetchFollowers]);

  const handlePostDeleted = useCallback(() => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(userId) });
    }
  }, [queryClient, userId]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onDeleted={handlePostDeleted} />
    ),
    [handlePostDeleted]
  );

  const isOwnProfile = user?.uid === userId;
  const isPending = followMutation.isPending || unfollowMutation.isPending;

  const renderHeader = () => (
    <>
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
        <Text style={[styles.navTitle, { color: colors.mutedForeground }]}>
          {profile?.displayName ?? ""}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {profileLoading ? (
        <LoadingState size="large" />
      ) : profile ? (
        <View
          style={[styles.profileHeader, { borderBottomColor: colors.border }]}
        >
          <View style={styles.avatarRow}>
            {!isOwnProfile && (
              <Pressable
                onPress={handleFollowToggle}
                disabled={isPending}
                style={[
                  styles.followButton,
                  {
                    backgroundColor: isFollowing
                      ? "transparent"
                      : colors.foreground,
                    borderColor: colors.foreground,
                    borderWidth: 1,
                    opacity: isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    {
                      color: isFollowing
                        ? colors.foreground
                        : colors.background,
                    },
                  ]}
                >
                  {isPending ? "…" : isFollowing ? s.following : s.follow}
                </Text>
              </Pressable>
            )}

            <Avatar
              uri={profile.avatarUrl}
              displayName={profile.displayName}
              size={64}
            />
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {profile.displayName}
            </Text>
            <Text style={[styles.username, { color: colors.mutedForeground }]}>
              @{profile.username}
            </Text>
            {profile.bio ? (
              <Text style={[styles.bio, { color: colors.foreground }]}>
                {profile.bio}
              </Text>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {profile.followersCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {strings.profile.followers}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {profile.followingCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {strings.profile.following}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          {s.posts}
        </Text>
      </View>
    </>
  );

  const posts = postsData?.posts ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={
          postsLoading ? (
            <LoadingState />
          ) : (
            <EmptyState
              icon="edit-3"
              title={s.emptyTitle}
              message={s.emptyMessage}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.mutedForeground}
          />
        }
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
    textAlign: "right",
    letterSpacing: 0.2,
    writingDirection: "rtl",
  },
  profileHeader: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 6,
  },
  followButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.2,
    writingDirection: "rtl",
  },
  profileInfo: {
    gap: 3,
    alignItems: "flex-end",
  },
  displayName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  username: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "right",
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 4,
    justifyContent: "flex-end",
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    letterSpacing: 0.3,
    writingDirection: "rtl",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    writingDirection: "rtl",
  },
});
