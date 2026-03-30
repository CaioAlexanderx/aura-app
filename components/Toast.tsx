import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Platform, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { create } from "zustand";

// ── Toast store ──────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";
type ToastItem = { id: string; message: string; type: ToastType };
type ToastState = {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
};

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, type = "success") => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().remove(id), 3000);
  },
  remove: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}));

// Shorthand
export const toast = {
  success: (msg: string) => useToast.getState().show(msg, "success"),
  error: (msg: string) => useToast.getState().show(msg, "error"),
  warning: (msg: string) => useToast.getState().show(msg, "warning"),
  info: (msg: string) => useToast.getState().show(msg, "info"),
};

// ── Single toast item ────────────────────────────────────────
const ICONS: Record<ToastType, { name: string; color: string; bg: string }> = {
  success: { name: "check", color: Colors.green, bg: Colors.greenD },
  error: { name: "alert", color: Colors.red, bg: Colors.redD },
  warning: { name: "alert", color: Colors.amber, bg: Colors.amberD },
  info: { name: "star", color: Colors.violet3, bg: Colors.violetD },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const cfg = ICONS[item.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.toast, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
        <Icon name={cfg.name as any} size={14} color={cfg.color} />
      </View>
      <Text style={s.message}>{item.message}</Text>
      <Pressable onPress={onDismiss} style={s.close}>
        <Text style={s.closeText}>x</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Toast container (render once in layout) ──────────────────
export function ToastContainer() {
  const { toasts, remove } = useToast();
  if (toasts.length === 0) return null;

  return (
    <View style={s.container} pointerEvents="box-none">
      {toasts.map(t => (
        <ToastItem key={t.id} item={t} onDismiss={() => remove(t.id)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute" as any,
    top: 16,
    right: 16,
    left: 16,
    zIndex: 9999,
    alignItems: "flex-end",
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    maxWidth: 420,
    minWidth: 240,
    ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.25)" } as any : { elevation: 10 }),
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "500",
  },
  close: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 14,
    color: Colors.ink3,
    fontWeight: "500",
  },
});

export default ToastContainer;
