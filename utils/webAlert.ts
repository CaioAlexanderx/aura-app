// ============================================================
// Feedback/confirmação cross-plataforma.
// No react-native-web, o Alert.alert do RN mostra só o título e, com botões,
// o onPress NUNCA dispara (no-op) — quebrando confirmações. Aqui usamos
// window.alert/window.confirm no web e Alert.alert no nativo.
// ============================================================
import { Alert, Platform } from "react-native";
import { toast } from "@/components/Toast";

// Feedback NAO-bloqueante: usa o toast in-app. Evita o window.alert nativo
// (aparece como "app.getaura.com.br diz" — feio e fora da marca p/ leigos).
export function notify(title: string, message?: string): void {
  const text = message ? `${title} — ${message}` : title;
  const isError = /n[\u00e3a]o foi poss[\u00edi]vel|erro\b|falh|inv[\u00e1a]lid|falhou/i.test(title);
  if (isError) toast.error(text);
  else toast.success(text);
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
