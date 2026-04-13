import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter, Tabs } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import {
  getGetFeedQueryKey,
  useGetFeed,
  type Post,
} from "@workspace/api-client-react";

const NAV_HEIGHT = 60;

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
    ({ item, index }: { item: Post; index: number }) => (
      <PostCard post={item} onDeleted={handlePostDeleted} index={index} />
    ),
    [handlePostDeleted]
  );

  const renderHeaderOptions = () => (
    <Tabs.Screen
      options={{
        title: strings.home.navTitle,
        headerRight: () => (
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={{ paddingRight: 20 }}>
            <Avatar uri={profile?.avatarUrl} displayName={profile?.displayName ?? ""} size={30} />
          </Pressable>
        ),
      }}
    />
  );

  if (isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {renderHeaderOptions()}
        <LoadingState />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {renderHeaderOptions()}
        <EmptyState icon="alert-circle" title={strings.home.errorTitle} message={strings.home.errorMessage} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {renderHeaderOptions()}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={{
          paddingTop: 8,
          ...(posts.length === 0 ? { flex: 1 } : {}),
        }}
        ListEmptyComponent={
          <EmptyState icon="wind" title={strings.home.emptyTitle} message={strings.home.emptyMessage} />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />
        }
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      />

      <Animated.View
        entering={FadeIn.delay(400).duration(400)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.foreground,
            bottom: insets.bottom + 72,
          },
        ]}
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
  fab: {
    position: "absolute",
    right: 20,
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
  fabInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
