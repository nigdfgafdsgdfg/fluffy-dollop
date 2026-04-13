import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter, Tabs } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
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
  const s = strings.profile;

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
    if (user?.uid) queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(user.uid) });
  }, [queryClient, user?.uid]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try { await signOut(); } catch { setIsSigningOut(false); }
  };

  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => (
      <PostCard post={item} onDeleted={handlePostDeleted} index={index} />
    ),
    [handlePostDeleted]
  );

  const renderHeaderOptions = () => (
    <Tabs.Screen
      options={{
        title: s.navTitle,
        headerLeft: () => (
          <Pressable onPress={handleSignOut} hitSlop={8} disabled={isSigningOut} style={{ paddingLeft: 20 }}>
            <Feather name="log-out" size={18} color={isSigningOut ? colors.mutedForeground : colors.destructive} />
          </Pressable>
        ),
      }}
    />
  );

  const renderHeader = () => (
    <>
      <Animated.View
        entering={FadeInDown.delay(80).duration(500).springify().damping(20)}
        style={[styles.profileHeader, { borderBottomColor: colors.border }]}
      >
        {/* Avatar + Stats Row */}
        <View style={styles.avatarRow}>
          <View style={styles.statsRow}>
            <Pressable style={styles.stat} onPress={() => user?.uid && router.push(`/user/${user.uid}`)}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{profile?.followingCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.following}</Text>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.stat} onPress={() => user?.uid && router.push(`/user/${user.uid}`)}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{profile?.followersCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.followers}</Text>
            </Pressable>
          </View>
          <Avatar uri={profile?.avatarUrl} displayName={profile?.displayName ?? ""} size={66} />
        </View>

        {/* Name / username / bio */}
        <View style={styles.profileInfo}>
          <Text style={[styles.displayName, { color: colors.foreground }]}>{profile?.displayName ?? ""}</Text>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>@{profile?.username ?? ""}</Text>
          {profile?.bio ? (
            <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(160).duration(500).springify().damping(20)}
        style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
      >
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{s.posts}</Text>
      </Animated.View>
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {renderHeaderOptions()}
      {isLoading && posts.length === 0 ? (
        <>{renderHeader()}<LoadingState /></>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<EmptyState icon="edit-3" title={s.emptyTitle} message={s.emptyMessage} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.background }}
        />
      )}

      <Animated.View
        entering={FadeInDown.delay(300).duration(500).springify().damping(20)}
        style={[styles.fab, { backgroundColor: colors.foreground, bottom: insets.bottom + 72 }]}
      >
        <Pressable
          style={styles.fabInner}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/compose"); }}
        >
          <Feather name="edit-2" size={18} color={colors.background} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  stat: { alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 26 },
  statNum: { fontFamily: "Amiri_700Bold", fontSize: 22, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Amiri_400Regular", fontSize: 13, writingDirection: "rtl", opacity: 0.65 },
  profileInfo: { gap: 4, alignItems: "flex-end" },
  displayName: { fontFamily: "Amiri_700Bold", fontSize: 24, letterSpacing: -0.3, textAlign: "right", writingDirection: "rtl" },
  username: { fontFamily: "Inter_400Regular", fontSize: 13.5, textAlign: "right", opacity: 0.6 },
  bio: { fontFamily: "Amiri_400Regular", fontSize: 16, lineHeight: 26, marginTop: 6, textAlign: "right", writingDirection: "rtl" },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "flex-end" },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10.5, letterSpacing: 1.4, writingDirection: "rtl", opacity: 0.45, textTransform: "uppercase" },
  fab: {
    position: "absolute",
    left: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fabInner: { flex: 1, alignItems: "center", justifyContent: "center" },
});
