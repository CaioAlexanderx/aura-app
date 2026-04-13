import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Platform, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { create } from "zustand";

// -- Toast store --
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
    setTimeout(() => get().remove(id), 4500);
  },
  remove: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}));

export const toast = {
  success: (msg: string) => useToast.getState().show(msg, "success"),
  error: (msg: string) => useToast.getState().show(msg, "error"),
  warning: (msg: string) => useToast.getState().show(msg, "warning"),
  info: (msg: string) => useToast.getState().show(msg, "info"),
};

// -- Icons + colors per type --
const CFG: Record<ToastType, { name: string; color: string; bg: string; border: string }> = {
  success: { name: "check", color: Colors.green, bg: Colors.greenD, border: Colors.green },
  error: { name: "alert", color: Colors.red, bg: Colors.redD, border: Colors.red },
  warning: { name: "alert", color: Colors.amber, bg: Colors.amberD, border: Colors.amber },
  info: { name: "star", color: Colors.violet3, bg: Colors.violetD, border: Colors.violet3 },
};

// -- Single toast --
function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const cfg = CFG[item.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -30, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.toast, { opacity, transform: [{ translateY }, { scale }], borderLeftColor: cfg.border }]}>
      <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
        <Icon name={cfg.name as any} size={14} color={cfg.color} />
      </View>
      <Text style={s.message} numberOfLines={3}>{item.message}</Text>
      <Pressable onPress={onDismiss} style={s.close} hitSlop={8}>
        <Text style={s.closeText}>x</Text>
      </Pressable>
    </Animated.View>
  );
}

// -- P0 #12: Toast container centered on content area (offset for sidebar) --
export function ToastContainer() {
  const { toasts, remove } = useToast();
  if (toasts.length === 0) return null;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return (
      <div style={{
        position: "fixed",
        top: 20,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        pointerEvents: "none",
        // Offset for sidebar: on wide screens, sidebar is ~240px, so shift right
        paddingLeft: window.innerWidth > 768 ? 240 : 0,
      } as any}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: "auto", width: "100%", maxWidth: 440, padding: "0 16px" } as any}>
            <ToastItemView item={t} onDismiss={() => remove(t.id)} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <View style={s.container} pointerEvents="box-none">
      {toasts.map(t => (
        <ToastItemView key={t.id} item={t} onDismiss={() => remove(t.id)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute" as any,
    top: 16, left: 16, right: 16,
    zIndex: 9999, alignItems: "center", gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    // P0 #12: colored left border for type visibility
    borderLeftWidth: 4,
    maxWidth: 440,
    minWidth: 240,
    width: "100%",
    ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)" } as any : { elevation: 12 }),
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  message: {
    flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "500", lineHeight: 18,
  },
  close: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: { fontSize: 14, color: Colors.ink3, fontWeight: "500" },
});

export default ToastContainer;
