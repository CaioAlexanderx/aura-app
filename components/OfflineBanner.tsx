import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";

interface OfflineBannerProps {
  status: "online" | "offline" | "syncing";
  pendingCount?: number;
  onRetrySync?: () => void;
}

export function OfflineBanner({ status, pendingCount = 0, onRetrySync }: OfflineBannerProps) {
  if (status === "online" && pendingCount === 0) return null;

  const isOffline = status === "offline";
  const isSyncing = status === "syncing";
  const hasPending = pendingCount > 0;

  const bgColor = isOffline
    ? (Colors.amberD || "rgba(245,158,11,0.12)")
    : isSyncing
    ? (Colors.violetD || "rgba(124,58,237,0.12)")
    : (Colors.greenD || "rgba(16,185,129,0.12)");

  const textColor = isOffline
    ? (Colors.amber || "#F59E0B")
    : isSyncing
    ? (Colors.violet3 || "#7C3AED")
    : (Colors.green || "#10B981");

  const icon = isOffline ? "\u26A0" : isSyncing ? "" : "\u2713";
  const message = isOffline
    ? "Modo offline" + (hasPending ? " \u2014 " + pendingCount + " venda(s) pendente(s)" : "")
    : isSyncing
    ? "Sincronizando " + pendingCount + " venda(s)..."
    : pendingCount + " venda(s) sincronizada(s)";

  return (
    <View style={[s.bar, { backgroundColor: bgColor }]}>
      {isSyncing && <ActivityIndicator size="small" color={textColor} />}
      <Text style={[s.text, { color: textColor }]}>
        {icon} {message}
      </Text>
      {isOffline && hasPending && onRetrySync && (
        <Pressable onPress={onRetrySync} style={[s.retry, { borderColor: textColor }]}>
          <Text style={[s.retryText, { color: textColor }]}>Sincronizar</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  text: { fontSize: 12, fontWeight: "600", flex: 1 },
  retry: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  retryText: { fontSize: 11, fontWeight: "600" },
});
