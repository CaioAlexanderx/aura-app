import { useState } from "react";
import { Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
};

export function HoverRow({ children, style, onPress }: Props) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        style,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      {children}
    </Pressable>
  );
}
