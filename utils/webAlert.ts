// ============================================================
// Feedback/confirmação cross-plataforma.
// No react-native-web, o Alert.alert do RN mostra só o título e, com botões,
// o onPress NUNCA dispara (no-op) — quebrando confirmações. Aqui usamos
// window.alert/window.confirm no web e Alert.alert no nativo.
// ============================================================
import { Alert, Platform } from "react-native";

export function notify(title: string, message?: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAlert(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  opts?: { destructive?: boolean }
): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      { text: confirmLabel, style: opts?.destructive ? "destructive" : "default", onPress: onConfirm },
    ]);
  }
}
