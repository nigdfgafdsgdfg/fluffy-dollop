import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  getGetUserPostsQueryKey,
  useGetUserPosts,
  type Post,
} from "@workspace/api-client-react";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data, isLoading, refetch } = useGetUserPosts(
    user?.uid ?? "",
    { limit: 30 },
    { query: { enabled: !!user?.uid } }
  );

  const posts = data?.posts ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePostDeleted = useCallback(() => {
    if (user?.uid) {
      queryClient.invalidateQueries({
        queryKey: getGetUserPostsQueryKey(user.uid),
      });
    }
  }, [queryClient, user?.uid]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await signOut();
    } catch {
      setIsSigningOut(false);
    }
  };

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onDeleted={handlePostDeleted} />
    ),
    [handlePostDeleted]
  );

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
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          Profile
        </Text>
        <Pressable onPress={handleSignOut} hitSlop={8} disabled={isSigningOut}>
          <Feather name="log-out" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={[styles.profileHeader, { borderBottomColor: colors.border }]}>
        <Avatar
          uri={profile?.avatarUrl}
          displayName={profile?.displayName ?? ""}
          size={72}
        />

        <View style={styles.profileInfo}>
          <Text style={[styles.displayName, { color: colors.foreground }]}>
            {profile?.displayName ?? ""}
          </Text>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>
            @{profile?.username ?? ""}
          </Text>
          {profile?.bio ? (
            <Text style={[styles.bio, { color: colors.foreground }]}>
              {profile.bio}
            </Text>
          ) : null}

          <View style={styles.stats}>
            <Pressable
              style={styles.stat}
              onPress={() =>
                user?.uid && router.push(`/user/${user.uid}`)
              }
            >
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {profile?.followingCount ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Following
              </Text>
            </Pressable>
            <Pressable
              style={styles.stat}
              onPress={() =>
                user?.uid && router.push(`/user/${user.uid}`)
              }
            >
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {profile?.followersCount ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Followers
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Posts
        </Text>
      </View>
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {isLoading && posts.length === 0 ? (
        <>
          {renderHeader()}
          <LoadingState />
        </>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={
            <EmptyState
              icon="edit-3"
              title="No posts yet"
              message="Share what's on your mind."
            />
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
      )}

      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + 90,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/compose");
        }}
      >
        <Feather name="feather" size={22} color="#FFFFFF" />
      </Pressable>
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
    fontSize: 18,
  },
  profileHeader: {
    padding: 20,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileInfo: {
    gap: 6,
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
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
