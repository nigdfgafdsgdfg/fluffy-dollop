import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
  getGetFeedQueryKey,
  useGetFeed,
  type Post,
} from "@workspace/api-client-react";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useGetFeed({ limit: 30 });

  const posts = data?.posts ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePostDeleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
  }, [queryClient]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onDeleted={handlePostDeleted} />
    ),
    [handlePostDeleted]
  );

  const renderHeader = () => (
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
      <Pressable onPress={() => router.push("/(tabs)/profile")}>
        <Avatar
          uri={profile?.avatarUrl}
          displayName={profile?.displayName ?? "Me"}
          size={32}
        />
      </Pressable>
      <Text style={[styles.navTitle, { color: colors.foreground }]}>Home</Text>
      <Feather name="zap" size={20} color={colors.primary} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <LoadingState />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <EmptyState
          icon="alert-circle"
          title="Something went wrong"
          message="We couldn't load your feed. Pull down to try again."
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={
          <EmptyState
            icon="wind"
            title="Nothing here yet"
            message="Follow people to see their posts in your feed."
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
        contentContainerStyle={
          posts.length === 0 ? { flex: 1 } : undefined
        }
        style={{ backgroundColor: colors.background }}
      />

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
