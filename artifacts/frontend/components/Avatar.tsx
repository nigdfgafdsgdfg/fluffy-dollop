import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface AvatarProps {
  uri?: string | null;
  displayName: string;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getColorForName(name: string): string {
  const palette = [
    "#C47A3A",
    "#7A6B55",
    "#5B7A6B",
    "#8B5E52",
    "#4A6B8A",
    "#7A5B8B",
    "#6B7A4A",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ uri, displayName, size = 40 }: AvatarProps) {
  const colors = useColors();
  const initials = getInitials(displayName || "?");
  const bgColor = getColorForName(displayName || "?");

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: colors.border,
          },
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        styles.initialsContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.36, color: "#FFFFFF" },
        ]}
        numberOfLines={1}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 0,
  },
  initialsContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  initials: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
