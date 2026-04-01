import { Platform } from "react-native";

// Accessibility helpers for web and native
export function a11yProps(label: string, role?: string) {
  if (Platform.OS === "web") {
    return {
      "aria-label": label,
      role: role || undefined,
    } as any;
  }
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: role as any,
  };
}

export function a11yButton(label: string) {
  return a11yProps(label, "button");
}

export function a11yHeading(label: string) {
  if (Platform.OS === "web") {
    return { "aria-label": label, role: "heading" } as any;
  }
  return { accessible: true, accessibilityLabel: label, accessibilityRole: "header" as any };
}

export function a11yImage(label: string) {
  return a11yProps(label, "img");
}

export function a11yLink(label: string) {
  return a11yProps(label, "link");
}

export function a11yLive(label: string) {
  if (Platform.OS === "web") {
    return { "aria-live": "polite", "aria-label": label } as any;
  }
  return { accessible: true, accessibilityLabel: label, accessibilityLiveRegion: "polite" as any };
}
