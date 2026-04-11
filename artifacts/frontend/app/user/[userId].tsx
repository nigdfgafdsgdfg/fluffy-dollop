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
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {profile?.displayName ?? "Profile"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {profileLoading ? (
        <LoadingState size="large" />
      ) : profile ? (
        <View
          style={[styles.profileHeader, { borderBottomColor: colors.border }]}
        >
          <View style={styles.avatarRow}>
            <Avatar
              uri={profile.avatarUrl}
              displayName={profile.displayName}
              size={72}
            />

            {!isOwnProfile && (
              <Pressable
                onPress={handleFollowToggle}
                disabled={isPending}
                style={[
                  styles.followButton,
                  {
                    backgroundColor: isFollowing
                      ? "transparent"
                      : colors.primary,
                    borderColor: isFollowing ? colors.foreground : colors.primary,
                    borderWidth: isFollowing ? 1 : 0,
                    opacity: isPending ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    {
                      color: isFollowing
                        ? colors.foreground
                        : colors.primaryForeground,
                    },
                  ]}
                >
                  {isPending ? "…" : isFollowing ? "Following" : "Follow"}
                </Text>
              </Pressable>
            )}
          </View>

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

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {profile.followingCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Following
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {profile.followersCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Followers
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Posts
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
              title="No posts yet"
              message="This user hasn't posted anything yet."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  profileHeader: {
    padding: 20,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 20,
  },
  followButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  displayName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  username: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  stats: {
    flexDirection: "row",
    gap: 20,
    marginTop: 8,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
