import { useEffect } from "react";
import { Platform } from "react-native";

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  label?: string;
};

/**
 * UX-04: Keyboard shortcuts hook (web only)
 * Usage:
 *   useKeyboard([
 *     { key: "Escape", handler: () => closeModal() },
 *     { key: "n", ctrl: true, handler: () => newItem() },
 *   ]);
 */
export function useKeyboard(shortcuts: KeyCombo[], deps: any[] = []) {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      for (const s of shortcuts) {
        const keyMatch = e.key === s.key || e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && altMatch) {
          if (isInput && s.key !== "Escape") continue;
          e.preventDefault();
          s.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, deps);
}

/**
 * Simple hook for just Escape key
 */
export function useEscapeKey(handler: () => void, deps: any[] = []) {
  useKeyboard([{ key: "Escape", handler }], deps);
}
