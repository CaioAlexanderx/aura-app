import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import Svg, { Circle, Path, Defs, RadialGradient, Stop, G } from "react-native-svg";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

// Logo Aura reconstruído em SVG
function AuraLogo({ size = 120 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#e0c4ff" stopOpacity="1" />
          <Stop offset="40%" stopColor="#a855f7" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="orb" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <Stop offset="50%" stopColor="#d8b4fe" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0.4" />
        </RadialGradient>
      </Defs>
      {/* Glow de fundo */}
      <Circle cx={60} cy={60} r={52} fill="url(#glow)" opacity={0.25} />
      {/* Arcos concêntricos */}
      {[44, 35, 26, 18].map((r, i) => (
        <Circle
          key={r}
          cx={60} cy={60} r={r}
          fill="none"
          stroke="url(#glow)"
          strokeWidth={i === 0 ? 1.5 : 1.2}
          opacity={0.55 - i * 0.08}
        />
      ))}
      {/* Meio-círculo (efeito corte) */}
      <Path
        d="M60 16 A44 44 0 0 1 104 60"
        fill="none"
        stroke="#c4b5fd"
        strokeWidth={2}
        opacity={0.7}
      />
      <Path
        d="M60 25 A35 35 0 0 1 95 60"
        fill="none"
        stroke="#a78bfa"
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Orbe central */}
      <Circle cx={60} cy={60} r={9} fill="url(#orb)" opacity={0.9} />
      <Circle cx={60} cy={60} r={4} fill="#fff" opacity={0.95} />
    </Svg>
  );
}

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading }    = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao entrar.");
    }
  }

  const leftPanel = (
    <View style={s.left}>
      {/* Logo clicável */}
      <TouchableOpacity
        style={s.logoArea}
        onPress={() => Linking.openURL("https://getaura.com.br")}
        activeOpacity={0.8}
      >
        <AuraLogo size={isWeb ? 100 : 72} />
        <View style={s.wordmarkRow}>
          <Text style={s.wordmark}>aura</Text>
          <Text style={s.wordmarkDot}>.</Text>
        </View>
        <Text style={s.taglineSmall}>TECNOLOGIA PARA NEGÓCIOS</Text>
      </TouchableOpacity>

      {isWeb && (
        <>
          <View style={s.dividerH} />
          <Text style={s.pitch}>
            Gestão completa para{"\n"}MEI e ME —{"\n"}com analista CRC incluso.
          </Text>
          <View style={s.badgeCol}>
            {["✓ Financeiro & DRE", "✓ PDV & Estoque", "✓ Contabilidade", "✓ Analista humano"].map(b => (
              <View key={b} style={s.badge}>
                <Text style={s.badgeText}>{b}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const rightPanel = (
    <View style={s.right}>
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
    </View>
  );

  if (isWeb) {
    return (
      <View style={s.rootWeb}>
        {leftPanel}
        <View style={s.separator} />
        {rightPanel}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.rootMobile}>
      {leftPanel}
      {rightPanel}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // ── Web: dois painéis lado a lado ───────────────────────────
  rootWeb: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.bg,
    // Gradiente simulado via camadas
    backgroundImage: Platform.OS === "web"
      ? "radial-gradient(ellipse at 20% 50%, rgba(109,40,217,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(91,140,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 60% 80%, rgba(139,92,246,0.1) 0%, transparent 50%)"
      : undefined,
  } as any,

  // ── Mobile: stack vertical ───────────────────────────────────
  rootMobile: {
    flexGrow: 1,
    backgroundColor: Colors.bg,
    padding: 24,
    justifyContent: "center",
  },

  // ── Separador vertical ───────────────────────────────────────
  separator: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 40,
  },

  // ── Painel esquerdo ──────────────────────────────────────────
  left: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },

  logoArea:    { alignItems: "center", marginBottom: 32 },
  wordmarkRow: { flexDirection: "row", alignItems: "baseline", marginTop: 16 },
  wordmark:    { fontSize: 44, color: Colors.ink, fontWeight: "300", letterSpacing: -1 },
  wordmarkDot: { fontSize: 44, color: Colors.violet3, fontWeight: "300" },
  taglineSmall:{ fontSize: 10, color: Colors.ink3, letterSpacing: 3, marginTop: 4 },

  dividerH: { width: 48, height: 1, backgroundColor: Colors.border2, marginVertical: 28 },

  pitch: {
    fontSize: 18,
    color: Colors.ink2,
    lineHeight: 30,
    textAlign: "center",
    marginBottom: 24,
  },

  badgeCol:  { gap: 8, alignItems: "flex-start" },
  badge:     { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2 },
  badgeText: { fontSize: 13, color: Colors.violet3 },

  // ── Painel direito ───────────────────────────────────────────
  right: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
    backgroundColor: "rgba(9,12,26,0.5)",
  },

  // ── Card formulário ──────────────────────────────────────────
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.border2,
    shadowColor: Colors.violet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
  },

  title:    { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:    { marginBottom: 16 },
  label:    { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input: {
    backgroundColor: Colors.bg4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 13,
    fontSize: 14,
    color: Colors.ink,
  },
  btn: {
    backgroundColor: Colors.violet,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
    shadowColor: Colors.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  btnText:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText:{ fontSize: 13, color: Colors.ink3 },
  link:      { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
