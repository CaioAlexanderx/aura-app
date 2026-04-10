import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: string | null };

// ErrorBoundary precisa ser class component (API React)
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error?.message || "Erro desconhecido" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack?.slice(0, 200));
  }

  handleReload() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.wrap}>
        <View style={s.card}>
          {/* Logo */}
          <Text style={s.logo}>aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>

          <View style={s.iconWrap}>
            <Text style={s.iconText}>!</Text>
          </View>

          <Text style={s.title}>Algo deu errado</Text>
          <Text style={s.sub}>
            Ocorreu um erro inesperado. Seus dados estao seguros.
          </Text>

          {__DEV__ && this.state.error && (
            <View style={s.errorBox}>
              <Text style={s.errorText} numberOfLines={4}>{this.state.error}</Text>
            </View>
          )}

          <Pressable onPress={() => this.handleReload()} style={s.btn}>
            <Text style={s.btnText}>Recarregar app</Text>
          </Pressable>

          <Text style={s.hint}>Se o problema persistir, entre em contato pelo suporte.</Text>
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap:     { flex: 1, backgroundColor: "#08090f", alignItems: "center", justifyContent: "center", padding: 24 },
  card:     { width: "100%", maxWidth: 400, backgroundColor: "#0f1019", borderRadius: 24, padding: 32, borderWidth: 1, borderColor: "#1e1b4b", alignItems: "center" },
  logo:     { fontSize: 22, fontWeight: "800", color: "#e2e8f0", marginBottom: 24, letterSpacing: -0.5 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#1e1b4b", borderWidth: 2, borderColor: "#7c3aed", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  iconText: { fontSize: 28, fontWeight: "800", color: "#a78bfa" },
  title:    { fontSize: 20, fontWeight: "700", color: "#e2e8f0", marginBottom: 8, textAlign: "center" },
  sub:      { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  errorBox: { backgroundColor: "#0c0d18", borderRadius: 10, padding: 12, width: "100%", marginBottom: 20 },
  errorText:{ fontSize: 10, color: "#ef4444", fontFamily: "monospace" as any, lineHeight: 15 },
  btn:      { backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 16 },
  btnText:  { fontSize: 14, color: "#fff", fontWeight: "700" },
  hint:     { fontSize: 11, color: "#475569", textAlign: "center" },
});

export default ErrorBoundary;
