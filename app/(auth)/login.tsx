import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

// Logo Aura em SVG puro (sem react-native-svg, funciona em web e mobile)
function AuraLogo({ size = 96 }: { size?: number }) {
  if (Platform.OS !== "web") {
    // No mobile mostra apenas o texto até ter suporte nativo
    return (
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: size * 0.45, color: Colors.violet4, fontWeight: "300", letterSpacing: -2 }}>aura.</Text>
      </View>
    );
  }
  // Web: SVG inline via dangerouslySetInnerHTML
  return (
    <View style={{ width: size, height: size }}>
      <svg
        width={size} height={size} viewBox="0 0 120 120"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient id="lg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0c4ff" stopOpacity="1" />
            <stop offset="40%" stopColor="#a855f7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="60%" stopColor="#d8b4fe" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#lg)" opacity="0.2" />
        {[46, 37, 28, 20].map((r, i) => (
          <circle key={r} cx="60" cy="60" r={r} fill="none"
            stroke="rgba(196,181,253," + (0.6 - i * 0.1) + ")"
            strokeWidth={i === 0 ? 1.8 : 1.3}
          />
        ))}
        <path d="M60 14 A46 46 0 0 1 106 60" fill="none" stroke="#c4b5fd" strokeWidth="2.2" opacity="0.8" />
        <path d="M60 23 A37 37 0 0 1 97 60" fill="none" stroke="#a78bfa" strokeWidth="1.6" opacity="0.65" />
        <circle cx="60" cy="60" r="10" fill="url(#lo)" opacity="0.95" />
        <circle cx="60" cy="60" r="4.5" fill="white" opacity="1" />
      </svg>
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading }  = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao entrar.");
    }
  }

  const formCard = (
    <View style={s.card}>
      <Text style={s.title}>Entrar</Text>
      <Text style={s.subtitle}>Bem-vindo de volta</Text>

      <View style={s.field}>
        <Text style={s.label}>E-mail</Text>
        <TextInput
          style={s.input} value={email} onChangeText={setEmail}
          placeholder="seu@email.com" placeholderTextColor={Colors.ink3}
          autoCapitalize="none" keyboardType="email-address"
        />
      </View>

      <View style={s.field}>
        <Text style={s.label}>Senha</Text>
        <TextInput
          style={s.input} value={password} onChangeText={setPassword}
          placeholder="••••••••" placeholderTextColor={Colors.ink3}
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={isLoading}>
        {isLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Entrar</Text>}
      </TouchableOpacity>

      <View style={s.footerRow}>
        <Text style={s.footerText}>Ainda não tem conta? </Text>
        <Link href="/(auth)/register">
          <Text style={s.link}>Criar conta</Text>
        </Link>
      </View>
    </View>
  );

  if (!isWeb) {
    return (
      <ScrollView contentContainerStyle={s.mobile}>
        <TouchableOpacity onPress={() => Linking.openURL("https://getaura.com.br")} style={s.mobileLogo}>
          <AuraLogo size={72} />
          <Text style={s.mobileWordmark}>aura<Text style={{ color: Colors.violet3 }}>.</Text></Text>
        </TouchableOpacity>
        {formCard}
      </ScrollView>
    );
  }

  // Web: dois painéis lado a lado
  return (
    <View style={s.webRoot}>
      {/* Gradiente de fundo via HTML nativo */}
      <View style={StyleSheet.absoluteFill as any}
        // @ts-ignore
        __html=""
        pointerEvents="none"
      />

      {/* Painel esquerdo */}
      <View style={s.leftPanel}>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://getaura.com.br")}
          activeOpacity={0.8}
          style={s.logoBlock}
        >
          <AuraLogo size={100} />
          <Text style={s.logoWordmark}>aura<Text style={{ color: Colors.violet3 }}>.</Text></Text>
          <Text style={s.logoTagline}>TECNOLOGIA PARA NEGÓCIOS</Text>
        </TouchableOpacity>

        <View style={s.divH} />

        <Text style={s.pitch}>Gestão completa{"\n"}para MEI e ME —{"\n"}com analista CRC incluso.</Text>

        <View style={s.badgeList}>
          {["✓ Financeiro & DRE", "✓ PDV & Estoque", "✓ Contabilidade", "✓ Analista humano"].map(b => (
            <View key={b} style={s.badge}><Text style={s.badgeText}>{b}</Text></View>
          ))}
        </View>
      </View>

      {/* Divisor */}
      <View style={s.vDivider} />

      {/* Painel direito */}
      <View style={s.rightPanel}>
        {formCard}
      </View>
    </View>
  );
}

const GRAD = "radial-gradient(ellipse at 15% 50%, rgba(109,40,217,0.22) 0%, transparent 55%), " +
  "radial-gradient(ellipse at 85% 15%, rgba(91,140,255,0.14) 0%, transparent 50%), " +
  "radial-gradient(ellipse at 55% 85%, rgba(139,92,246,0.12) 0%, transparent 45%)";

const s = StyleSheet.create({
  // Mobile
  mobile:      { flexGrow: 1, backgroundColor: Colors.bg, padding: 28, justifyContent: "center", alignItems: "center" },
  mobileLogo:  { alignItems: "center", marginBottom: 32 },
  mobileWordmark: { fontSize: 36, color: Colors.ink, fontWeight: "300", letterSpacing: -1, marginTop: 10 },

  // Web root
  webRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.bg,
    background: GRAD + ", " + Colors.bg,
  } as any,

  // Painel esquerdo
  leftPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 56,
  },
  logoBlock:    { alignItems: "center", marginBottom: 36 },
  logoWordmark: { fontSize: 48, color: Colors.ink, fontWeight: "300", letterSpacing: -2, marginTop: 14 },
  logoTagline:  { fontSize: 9, color: Colors.ink3, letterSpacing: 3.5, marginTop: 5 },
  divH:         { width: 44, height: 1, backgroundColor: Colors.border2, marginBottom: 28 },
  pitch:        { fontSize: 18, color: Colors.ink2, lineHeight: 32, textAlign: "center", marginBottom: 28 },
  badgeList:    { gap: 8, alignItems: "stretch", width: 200 },
  badge:        { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border2 },
  badgeText:    { fontSize: 13, color: Colors.violet3 },

  // Divisor vertical
  vDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 48 },

  // Painel direito
  rightPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 56,
    backgroundColor: "rgba(6,8,22,0.55)",
  },

  // Card formulário
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.border2,
    boxShadow: "0 8px 40px rgba(109,40,217,0.15)",
  } as any,
  title:     { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:     { marginBottom: 16 },
  label:     { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:     { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 13, fontSize: 14, color: Colors.ink },
  btn:       { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 4, boxShadow: "0 4px 16px rgba(109,40,217,0.4)" } as any,
  btnText:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText:{ fontSize: 13, color: Colors.ink3 },
  link:      { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
