import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import strings from "@/constants/strings";
import {
  getGetFeedQueryKey,
  getGetUserPostsQueryKey,
  getGetPostCommentsQueryKey,
  getGetPostQueryKey,
  requestUploadUrl,
  useCreatePost,
  useCreateComment,
} from "@workspace/api-client-react";

const MAX_CHARS = 280;
const RING_SIZE = 28;
const RING_STROKE = 2.5;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ComposeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ replyToPostId?: string; replyToCommentId?: string; replyToUsername?: string }>();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [imageSize, setImageSize] = useState<number>(1);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const remaining = MAX_CHARS - content.length;
  const isOverLimit = remaining < 0;
  const isEmpty = content.trim().length === 0 && !imageUri;

  const s = strings.compose;

  const progress = Math.min(content.length / MAX_CHARS, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const ringColor = isOverLimit
    ? colors.destructive
    : remaining < 20
    ? colors.destructive
    : remaining < 50
    ? colors.accent
    : colors.foreground;

  const createPost = useCreatePost({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        if (user?.uid) {
          queryClient.invalidateQueries({
            queryKey: getGetUserPostsQueryKey(user.uid),
          });
        }
        router.back();
      },
    },
  });

  const createComment = useCreateComment({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (params.replyToPostId) {
          queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(params.replyToPostId) });
          queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(params.replyToPostId) });
        }
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        if (user?.uid) {
          queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(user.uid) });
        }
        router.back();
      },
    },
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageMime(asset.mimeType ?? "image/jpeg");
      setImageSize(Math.max(1, asset.fileSize ?? 1));
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const handlePost = async () => {
    if (isEmpty || isOverLimit || createPost.isPending || isUploading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let imageUrl: string | null = null;

    if (imageUri) {
      setIsUploading(true);
      try {
        const { uploadURL, objectPath } = await requestUploadUrl({
          name: "post-image", size: imageSize, contentType: imageMime,
        });

        const fileResponse = await fetch(imageUri);
        const blob = await fileResponse.blob();
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": imageMime },
          body: blob,
        });
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        imageUrl = objectPath;
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload Failed", "Failed to upload image. Please try again.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    if (params.replyToPostId) {
      createComment.mutate({
        postId: params.replyToPostId,
        data: {
          content: content.trim(),
          imageUrl,
          parentCommentId: params.replyToCommentId ?? null,
        },
      });
    } else {
      createPost.mutate({
        data: { content: content.trim(), imageUrl },
      });
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const isBusy = isUploading || createPost.isPending || createComment.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={handlePost}
          disabled={isEmpty || isOverLimit || isBusy}
          style={[
            styles.postButton,
            {
              backgroundColor:
                isEmpty || isOverLimit ? colors.muted : colors.foreground,
              opacity: isBusy ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.postButtonText,
              {
                color:
                  isEmpty || isOverLimit
                    ? colors.mutedForeground
                    : colors.background,
              },
            ]}
          >
            {isUploading ? s.uploadingImage : (createPost.isPending || createComment.isPending) ? s.publishing : s.publish}
          </Text>
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.mutedForeground }]}>
          {params.replyToUsername ? s.headerTitle + ` (@${params.replyToUsername})` : s.headerTitle}
        </Text>

        <Pressable onPress={handleCancel} hitSlop={8} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
            {s.cancel}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.body}>
          <View style={styles.inputWrap}>
            <Text style={[styles.authorName, { color: colors.mutedForeground }]}>
              {profile?.displayName ?? ""}
            </Text>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.foreground }]}
              placeholder={s.placeholder}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
              value={content}
              onChangeText={setContent}
              maxLength={MAX_CHARS + 50}
              textAlignVertical="top"
              textAlign="right"
              writingDirection="rtl"
            />
            {imageUri && (
              <View style={styles.imagePreviewWrap}>
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.imagePreview, { borderColor: colors.border }]}
                  contentFit="cover"
                />
                <Pressable
                  onPress={removeImage}
                  style={[styles.removeImageBtn, { backgroundColor: colors.foreground }]}
                  hitSlop={6}
                >
                  <Feather name="x" size={12} color={colors.background} />
                </Pressable>
              </View>
            )}
          </View>
          <Avatar
            uri={profile?.avatarUrl}
            displayName={profile?.displayName ?? "Me"}
            size={42}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 10,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.footerLeft}>
          {(createPost.isError || createComment.isError) ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {s.errorPost}
            </Text>
          ) : isUploading ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Pressable
              onPress={pickImage}
              hitSlop={8}
              style={styles.imagePickerBtn}
              disabled={isBusy}
            >
              <Feather
                name="image"
                size={20}
                color={imageUri ? colors.foreground : colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.ringWrap}>
          {remaining < 50 && (
            <Text
              style={[
                styles.remainingText,
                {
                  color: ringColor,
                  marginLeft: 6,
                },
              ]}
            >
              {remaining < 0 ? remaining : remaining}
            </Text>
          )}
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    minWidth: 52,
    alignItems: "flex-end",
  },
  cancelText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    writingDirection: "rtl",
  },
  headerTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.8,
    writingDirection: "rtl",
  },
  postButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: "center",
  },
  postButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.2,
    writingDirection: "rtl",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    padding: 20,
    gap: 14,
  },
  inputWrap: {
    flex: 1,
    gap: 6,
    alignItems: "flex-end",
  },
  authorName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    writingDirection: "rtl",
  },
  input: {
    flex: 0,
    width: "100%",
    minHeight: 80,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    lineHeight: 29,
    paddingTop: 0,
  },
  imagePreviewWrap: {
    width: "100%",
    position: "relative",
    marginTop: 8,
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  footerLeft: {
    flex: 1,
    alignItems: "flex-start",
  },
  imagePickerBtn: {
    padding: 4,
  },
  ringWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  remainingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    minWidth: 24,
    textAlign: "right",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
