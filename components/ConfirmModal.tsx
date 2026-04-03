import { View, Text, Pressable, Modal, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmColor,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  const btnColor = confirmColor || (destructive ? Colors.red : Colors.violet);

  if (Platform.OS === "web") {
    if (!visible) return null;
    return (
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.card}>
          <View style={[s.iconCircle, destructive && { backgroundColor: Colors.redD }]}>
            <Text style={[s.iconText, destructive && { color: Colors.red }]}>
              {destructive ? "!" : "?"}
            </Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.actions}>
            <Pressable onPress={onCancel} style={s.cancelBtn}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[s.confirmBtn, { backgroundColor: btnColor }]}>
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.card}>
          <View style={[s.iconCircle, destructive && { backgroundColor: Colors.redD }]}>
            <Text style={[s.iconText, destructive && { color: Colors.red }]}>
              {destructive ? "!" : "?"}
            </Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.actions}>
            <Pressable onPress={onCancel} style={s.cancelBtn}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[s.confirmBtn, { backgroundColor: btnColor }]}>
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook helper for common use
import { useState, useCallback } from "react";

export function useConfirmModal() {
  const [state, setState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (opts: { title: string; message: string; confirmLabel?: string; destructive?: boolean }) =>
      new Promise<boolean>((resolve) => {
        setState({
          visible: true,
          ...opts,
          onConfirm: () => {
            setState((prev) => ({ ...prev, visible: false }));
            resolve(true);
          },
        });
      }),
    []
  );

  const cancel = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const modal = (
    <ConfirmModal
      visible={state.visible}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      destructive={state.destructive}
      onConfirm={state.onConfirm}
      onCancel={cancel}
    />
  );

  return { confirm, modal };
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  backdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 28,
    maxWidth: 380,
    width: "90%",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    zIndex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.violet3,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: Colors.ink3,
    textAlign: "center",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    color: Colors.ink3,
    fontWeight: "500",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
});
