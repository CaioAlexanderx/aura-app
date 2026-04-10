import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ visible, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", destructive = true, onConfirm, onCancel }: Props) {
  if (!visible) return null;
  const isWeb = Platform.OS === "web";
  // Use fixed on web so the dialog stays in the viewport regardless of scroll position
  const overlayPosition = isWeb ? "fixed" : "absolute";
  return (
    <View style={[s.overlay, { position: overlayPosition as any }]}>
      <Pressable style={s.backdrop} onPress={onCancel} />
      <View style={[s.dialog, isWeb && { boxShadow: "0 16px 48px rgba(0,0,0,0.4)" } as any]}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>{destructive ? "!" : "?"}</Text>
        </View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{message}</Text>
        <View style={s.actions}>
          <Pressable onPress={onCancel} style={s.cancelBtn}>
            <Text style={s.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable onPress={onConfirm} style={[s.confirmBtn, destructive && { backgroundColor: Colors.red }]}>
            <Text style={s.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center", alignItems: "center",
    zIndex: 9999,
  },
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  dialog: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 28,
    maxWidth: 380,
    width: "90%",
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    zIndex: 10000,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.redD,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  icon: { fontSize: 22, color: Colors.red, fontWeight: "800" },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 8, textAlign: "center" },
  message: { fontSize: 13, color: Colors.ink3, lineHeight: 20, textAlign: "center", marginBottom: 24 },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: Colors.violet,
    alignItems: "center",
  },
  confirmText: { fontSize: 14, color: "#fff", fontWeight: "700" },
});

export default ConfirmDialog;
