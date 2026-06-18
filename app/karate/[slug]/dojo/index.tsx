// ============================================================
// Login OTP do Portal do Dojô — Aura Karatê (Fase 0 / Canal B)
//
// Rota: /karate/[slug]/dojo
// Fluxo: e-mail/telefone → OTP de 6 dígitos → redireciona para /portal
//
// API (backend Fase 0):
//   POST /public/karate/:slug/dojo/portal/request-otp  { identifier }
//   POST /public/karate/:slug/dojo/portal/verify-otp   { identifier, code }
// ============================================================
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KarateColors } from "@/constants/karateTheme";
import { useDojoPortal } from "./_layout";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type Stage = "identifier" | "code";

export default function DojoPortalLogin() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { setAuth } = useDojoPortal();

  const [stage, setStage] = useState<Stage>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [channelHint, setChannelHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp() {
    if (!identifier.trim()) { setError("Informe seu e-mail ou telefone."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/v1/public/karate/${slug}/dojo/portal/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await r.json();
      setChannelHint(data.channel_hint || null);
      setStage("code");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!code.trim()) { setError("Informe o código recebido."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/v1/public/karate/${slug}/dojo/portal/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      const data = await r.json();
      if (!data.ok || !data.token) {
        setError(data.error || "Código inválido ou expirado.");
        return;
      }
      setAuth(data.token, data.dojo?.id ?? "", data.dojo?.federation_id ?? "");
      router.replace(`/karate/${slug}/dojo/portal` as any);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.kanji}>空</Text>
            <Text style={styles.title}>Portal do Dojô</Text>
            <Text style={styles.subtitle}>Acesse as informações do seu dojô na federação.</Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            {stage === "identifier" ? (
              <>
                <Text style={styles.label}>E-mail ou telefone do responsável</Text>
                <TextInput
                  style={styles.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="seuemail@exemplo.com"
                  placeholderTextColor={KarateColors.ink3}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleRequestOtp}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Enviar código</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>
                  Código enviado{channelHint ? ` para ${channelHint}` : ""}
                </Text>
                <TextInput
                  style={[styles.input, styles.inputCode]}
                  value={code}
                  onChangeText={setCode}
                  placeholder="000000"
                  placeholderTextColor={KarateColors.ink3}
                  keyboardType="numeric"
                  maxLength={6}
                  editable={!loading}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Entrar</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={() => { setStage("identifier"); setCode(""); setError(null); }}>
                  <Text style={styles.linkText}>← Usar outro contato</Text>
                </TouchableOpacity>
              </>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 24 } as ViewStyle,
  header: { alignItems: "center", gap: 8, paddingVertical: 24 } as ViewStyle,
  kanji: { fontSize: 48, color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  title: { fontSize: 22, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  subtitle: { fontSize: 14, color: KarateColors.ink3, textAlign: "center" } as TextStyle,
  card: { backgroundColor: KarateColors.bg2, borderRadius: 16, borderWidth: 1, borderColor: KarateColors.border, padding: 20, gap: 12 } as ViewStyle,
  label: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: KarateColors.ink, backgroundColor: KarateColors.bg } as TextStyle,
  inputCode: { fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: 8, fontFamily: "monospace" } as TextStyle,
  btn: { backgroundColor: KarateColors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" } as ViewStyle,
  btnDisabled: { opacity: 0.6 } as ViewStyle,
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 } as TextStyle,
  linkBtn: { alignItems: "center", paddingVertical: 4 } as ViewStyle,
  linkText: { color: KarateColors.ink3, fontSize: 13 } as TextStyle,
  errorText: { color: "#ef4444", fontSize: 13, textAlign: "center" } as TextStyle,
});
