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
    "#1D9BF0",
    "#794BC4",
    "#00BA7C",
    "#FF7A00",
    "#F4212E",
    "#FF6B6B",
    "#4ECDC4",
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
          { fontSize: size * 0.38, color: "#FFFFFF" },
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
    borderWidth: 0.5,
  },
  initialsContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  initials: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
