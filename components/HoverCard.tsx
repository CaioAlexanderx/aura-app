import { useState } from "react";
import { Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  children: React.ReactNode;
  style?: any;
  highlight?: boolean;
  onPress?: () => void;
};

export function HoverCard({ children, style, highlight, onPress }: Props) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        style,
        hovered && {
          transform: [{ translateY: -3 }, { scale: 1.015 }],
          borderColor: highlight ? Colors.violet2 : Colors.border2,
          shadowColor: Colors.violet,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 8,
        },
        isWeb && { transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)" } as any,
      ]}
    >
      {children}
    </Pressable>
  );
}
