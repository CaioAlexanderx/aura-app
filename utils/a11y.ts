// ============================================================
// FE-07: Accessibility helpers for React Native
// Provides consistent a11y props for common patterns
// ============================================================

import { AccessibilityRole, Platform } from "react-native";

/**
 * Generate consistent accessibility props for interactive elements
 */
export function a11yButton(label: string, hint?: string) {
  return {
    accessible: true,
    accessibilityRole: "button" as AccessibilityRole,
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

export function a11yLink(label: string, hint?: string) {
  return {
    accessible: true,
    accessibilityRole: "link" as AccessibilityRole,
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

export function a11yHeader(label: string, level: 1 | 2 | 3 = 1) {
  return {
    accessible: true,
    accessibilityRole: "header" as AccessibilityRole,
    accessibilityLabel: label,
    ...(Platform.OS === "web" ? { "aria-level": level } : {}),
  };
}

export function a11yImage(label: string) {
  return {
    accessible: true,
    accessibilityRole: "image" as AccessibilityRole,
    accessibilityLabel: label,
  };
}

export function a11yInput(label: string, hint?: string) {
  return {
    accessible: true,
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : {}),
  };
}

export function a11yTab(label: string, selected: boolean) {
  return {
    accessible: true,
    accessibilityRole: "tab" as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityState: { selected },
  };
}

export function a11yAlert(label: string) {
  return {
    accessible: true,
    accessibilityRole: "alert" as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityLiveRegion: "polite" as const,
  };
}

export function a11ySwitch(label: string, checked: boolean) {
  return {
    accessible: true,
    accessibilityRole: "switch" as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityState: { checked },
  };
}

export function a11yProgress(label: string, value: number, max: number = 100) {
  return {
    accessible: true,
    accessibilityRole: "progressbar" as AccessibilityRole,
    accessibilityLabel: label,
    accessibilityValue: {
      min: 0,
      max,
      now: value,
      text: `${Math.round(value / max * 100)}%`,
    },
  };
}

/**
 * Hide decorative elements from screen readers
 */
export function a11yHidden() {
  return {
    accessible: false,
    importantForAccessibility: "no" as const,
    accessibilityElementsHidden: true,
  };
}

/**
 * Group children into a single accessible element
 */
export function a11yGroup(label: string) {
  return {
    accessible: true,
    accessibilityLabel: label,
  };
}

export default {
  button: a11yButton,
  link: a11yLink,
  header: a11yHeader,
  image: a11yImage,
  input: a11yInput,
  tab: a11yTab,
  alert: a11yAlert,
  switch: a11ySwitch,
  progress: a11yProgress,
  hidden: a11yHidden,
  group: a11yGroup,
};
