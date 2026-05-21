// ─── CrmErrorBoundary ────────────────────────────────────────────────────────
// Boundary local que mostra o erro detalhado (mensagem + stack) ao inves de
// cair no ErrorBoundary global "Algo deu errado". Para debug de prod.
// ============================================================================

import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: React.ErrorInfo | null };

export class CrmErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info });
    // tambem loga no console pra Sentry capturar com mais contexto
    if (typeof console !== "undefined") {
      console.error("[CrmErrorBoundary] CRM crashed:", error);
      console.error("[CrmErrorBoundary] Component stack:", info.componentStack);
    }
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ScrollView contentContainerStyle={s.box}>
        <Text style={s.title}>🐛 Erro no CRM (debug)</Text>
        <Text style={s.subtitle}>Stack capturado antes do ErrorBoundary global.</Text>

        <View style={s.section}>
          <Text style={s.label}>Mensagem</Text>
          <Text style={s.msg} selectable>{this.state.error.message}</Text>
        </View>

        {this.state.error.stack && (
          <View style={s.section}>
            <Text style={s.label}>Stack</Text>
            <Text style={s.code} selectable>{this.state.error.stack}</Text>
          </View>
        )}

        {this.state.info?.componentStack && (
          <View style={s.section}>
            <Text style={s.label}>Component stack</Text>
            <Text style={s.code} selectable>{this.state.info.componentStack}</Text>
          </View>
        )}

        <Pressable onPress={this.reset} style={s.btn}>
          <Text style={s.btnText}>Tentar novamente</Text>
        </Pressable>
      </ScrollView>
    );
  }
}

const s = StyleSheet.create({
  box: {
    padding: 16,
    backgroundColor: Colors.red + "08",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.red + "44",
    margin: 12,
  },
  title: { fontSize: 16, fontWeight: "800", color: Colors.red, marginBottom: 4 },
  subtitle: { fontSize: 11, color: Colors.ink3, marginBottom: 16 },
  section: { marginBottom: 14 },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 },
  msg: { fontSize: 12, color: Colors.red, fontWeight: "600", lineHeight: 18 },
  code: {
    fontSize: 10,
    color: Colors.ink,
    backgroundColor: Colors.bg4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: "monospace" as any,
    lineHeight: 14,
  },
  btn: {
    backgroundColor: Colors.violet,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
