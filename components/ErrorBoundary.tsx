import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <View style={s.card}>
            <View style={s.iconWrap}><Icon name="alert" size={32} color={Colors.red} /></View>
            <Text style={s.title}>Algo deu errado</Text>
            <Text style={s.msg}>{this.state.error?.message || "Erro inesperado"}</Text>
            <Pressable onPress={() => this.setState({ hasError: false, error: null })} style={s.btn}>
              <Text style={s.btnText}>Tentar novamente</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: Colors.bg },
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", maxWidth: 400, width: "100%", borderWidth: 1, borderColor: Colors.border },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  msg: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
