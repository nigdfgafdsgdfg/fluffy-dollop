import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

  const lastScrollY = useRef(0);
  const navTranslateY = useSharedValue(0);
  const navOpacity = useSharedValue(1);

  const navBarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navTranslateY.value }],
    opacity: navOpacity.value,
  }));

  const handleScroll = (e: any) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    if (diff > 4 && currentY > NAV_HEIGHT + insets.top) {
      navTranslateY.value = withTiming(-(NAV_HEIGHT + insets.top), { duration: 200, easing: Easing.out(Easing.ease) });
      navOpacity.value = withTiming(0, { duration: 180 });
    } else if (diff < -4) {
      navTranslateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
      navOpacity.value = withTiming(1, { duration: 180 });
    }
    lastScrollY.current = currentY;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navTranslateY.value = withTiming(0, { duration: 200 });
    navOpacity.value = withTiming(1, { duration: 200 });
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

  const navBar = (
    <Animated.View
      style={[
        styles.navBar,
        navBarAnimStyle,
        {
          paddingTop: insets.top + 8,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/compose"); }}
        hitSlop={8}
      >
        <Feather name="edit-2" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.navTitle, { color: colors.foreground }]}>
        {strings.home.navTitle}
      </Text>
      <Pressable onPress={() => router.push("/(tabs)/profile")}>
        <Avatar uri={profile?.avatarUrl} displayName={profile?.displayName ?? ""} size={30} />
      </Pressable>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {navBar}
        <LoadingState />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {navBar}
        <EmptyState icon="alert-circle" title={strings.home.errorTitle} message={strings.home.errorMessage} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {navBar}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={{
          paddingTop: NAV_HEIGHT + insets.top + 8,
          ...(posts.length === 0 ? { flex: 1 } : {}),
        }}
        ListEmptyComponent={
          <EmptyState icon="wind" title={strings.home.emptyTitle} message={strings.home.emptyMessage} />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} progressViewOffset={NAV_HEIGHT + insets.top} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
  navTitle: {
    fontFamily: "Amiri_700Bold_Italic",
    fontSize: 24,
    letterSpacing: 0,
  },
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
