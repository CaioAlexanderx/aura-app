import { useRef } from "react";
import { Animated, Pressable, Platform } from "react-native";

type Props = React.ComponentProps<typeof Pressable> & {
  scaleDown?: number;
  children: React.ReactNode;
};

// Mobile: opacity + slight scale on press
// Web: no change (hover handles feedback)
export function PressableScale({ scaleDown = 0.97, style, children, ...props }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isWeb = Platform.OS === "web";

  function onPressIn() {
    if (isWeb) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: scaleDown, duration: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.7, duration: 100, useNativeDriver: true }),
    ]).start();
  }

  function onPressOut() {
    if (isWeb) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity }, style as any]}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        {...props}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default PressableScale;
