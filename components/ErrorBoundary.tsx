import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in dev, Sentry in production
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <View style={s.card}>
            <Text style={s.icon}>!</Text>
            <Text style={s.title}>Algo deu errado</Text>
            <Text style={s.message}>
              Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.
            </Text>
            {__DEV__ && this.state.error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{this.state.error.message}</Text>
              </View>
            )}
            <Pressable onPress={this.handleRetry} style={s.retryBtn}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "transparent",
  },
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border2,
    gap: 12,
  },
  icon: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.red,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.redD,
    textAlign: "center",
    lineHeight: 56,
    overflow: "hidden",
  },
  title: {
    fontSize: 20,
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
  errorBox: {
    backgroundColor: Colors.redD,
    borderRadius: 10,
    padding: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.red + "33",
  },
  errorText: {
    fontSize: 11,
    color: Colors.red,
    fontFamily: "monospace",
  },
  retryBtn: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
