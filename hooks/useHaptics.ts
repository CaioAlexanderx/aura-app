import { Platform } from "react-native";

// UX-05: Haptic feedback hook
// Uses expo-haptics on native, no-op on web
// Install: npx expo install expo-haptics

let Haptics: any = null;
if (Platform.OS !== "web") {
  try { Haptics = require("expo-haptics"); } catch {}
}

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

/**
 * Trigger haptic feedback
 * @param style - light, medium, heavy, success, warning, error, selection
 */
export function haptic(style: HapticStyle = "light") {
  if (!Haptics) return;

  try {
    switch (style) {
      case "light":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "heavy":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case "selection":
        Haptics.selectionAsync();
        break;
    }
  } catch {}
}

/**
 * Convenience functions
 */
export const hapticLight = () => haptic("light");
export const hapticMedium = () => haptic("medium");
export const hapticSuccess = () => haptic("success");
export const hapticError = () => haptic("error");
export const hapticSelection = () => haptic("selection");

/**
 * Wrap a handler with haptic feedback
 * Usage: <Pressable onPress={withHaptic(() => doThing(), "medium")} />
 */
export function withHaptic<T extends (...args: any[]) => any>(
  handler: T,
  style: HapticStyle = "light"
): T {
  return ((...args: any[]) => {
    haptic(style);
    return handler(...args);
  }) as any as T;
}
