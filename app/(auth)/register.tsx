import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from "react-native-svg";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

function AuraLogo({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="glow2" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#e0c4ff" stopOpacity="1" />
          <Stop offset="40%" stopColor="#a855f7" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="orb2" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <Stop offset="50%" stopColor="#d8b4fe" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#7c3aed" stopOpacity="0.4" />
        </RadialGradient>
      </Defs>
      <Circle cx={60} cy={60} r={52} fill="url(#glow2)" opacity={0.25} />
      {[44, 35, 26, 18].map((r, i) => (
        <Circle key={r} cx={60} cy={60} r={r} fill="none" stroke="url(#glow2)"
          strokeWidth={i === 0 ? 1.5 : 1.2} opacity={0.55 - i * 0.08} />
      ))}
      <Path d="M60 16 A44 44 0 0 1 104 60" fill="none" stroke="#c4b5fd" strokeWidth={2} opacity={0.7} />
      <Path d="M60 25 A35 35 0 0 1 95 60" fill="none" stroke="#a78bfa" strokeWidth={1.5} opacity={0.6} />
      <Circle cx={60} cy={60} r={9} fill="url(#orb2)" opacity={0.9} />
      <Circle cx={60} cy={60} r={4} fill="#fff" opacity={0.95} />
    </Svg>
  );
}

export default function RegisterScreen() {
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [company, setCompany]     = useState("");
  const { register, isLoading }   = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleRegister() {
    if (!name || !email || !password || !company) {
      Alert.alert("Preencha todos os campos"); return;
    }
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, company.trim());
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao criar conta.");
    }
  }

  const fields = [
    { label: "Seu nome",        value: name,     set: setName,     placeholder: "João Mendes" },
    { label: "E-mail",          value: email,    set: setEmail,    placeholder: "joao@empresa.com", keyboard: "email-address" as const },
    { label: "Senha",           value: password, set: setPassword, placeholder: "8+ caracteres", secure: true },
    { label: "Nome da empresa", value: company,  set: setCompany,  placeholder: "Minha Empresa Ltda." },
  ];

  const leftPanel = (
    <View style={s.left}>
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
          <Text style={s.pitch}>Comece grátis.{"\n"}Sem cartão. Sem letras miúdas.</Text>
          <View style={s.planCard}>
            <Text style={s.planLabel}>Plano Essencial</Text>
            <Text style={s.planPrice}>R$ 59<Text style={s.planSub}>/mês</Text></Text>
            <Text style={s.planNote}>Analista CRC incluso em todos os planos</Text>
          </View>
        </>
      )}
    </View>
  );

  const rightPanel = (
    <View style={s.right}>
      <View style={s.card}>
        <Text style={s.title}>Criar conta</Text>
        <Text style={s.subtitle}>Grátis para começar</Text>

        {fields.map(f => (
          <View style={s.field} key={f.label}>
            <Text style={s.label}>{f.label}</Text>
            <TextInput
              style={s.input} value={f.value} onChangeText={f.set}
              placeholder={f.placeholder} placeholderTextColor={Colors.ink3}
              secureTextEntry={f.secure}
              keyboardType={f.keyboard ?? "default"}
              autoCapitalize={f.keyboard === "email-address" ? "none" : "words"}
            />
          </View>
        ))}

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Criar conta grátis</Text>}
        </TouchableOpacity>

        <View style={s.footerRow}>
          <Text style={s.footerText}>Já tem conta? </Text>
          <Link href="/(auth)/login">
            <Text style={s.link}>Entrar</Text>
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
  rootWeb: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.bg,
    backgroundImage: Platform.OS === "web"
      ? "radial-gradient(ellipse at 20% 50%, rgba(109,40,217,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(91,140,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 60% 80%, rgba(139,92,246,0.1) 0%, transparent 50%)"
      : undefined,
  } as any,
  rootMobile: { flexGrow: 1, backgroundColor: Colors.bg, padding: 24, justifyContent: "center" },
  separator:  { width: 1, backgroundColor: Colors.border, marginVertical: 40 },

  left:        { flex: 1, justifyContent: "center", alignItems: "center", padding: 48 },
  logoArea:    { alignItems: "center", marginBottom: 32 },
  wordmarkRow: { flexDirection: "row", alignItems: "baseline", marginTop: 16 },
  wordmark:    { fontSize: 44, color: Colors.ink, fontWeight: "300", letterSpacing: -1 },
  wordmarkDot: { fontSize: 44, color: Colors.violet3, fontWeight: "300" },
  taglineSmall:{ fontSize: 10, color: Colors.ink3, letterSpacing: 3, marginTop: 4 },
  dividerH:    { width: 48, height: 1, backgroundColor: Colors.border2, marginVertical: 28 },
  pitch:       { fontSize: 18, color: Colors.ink2, lineHeight: 30, textAlign: "center", marginBottom: 24 },

  planCard:  { backgroundColor: Colors.violetD, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", width: 220 },
  planLabel: { fontSize: 11, color: Colors.violet3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  planPrice: { fontSize: 36, color: Colors.ink, fontWeight: "800", letterSpacing: -1 },
  planSub:   { fontSize: 14, color: Colors.ink3, fontWeight: "400" },
  planNote:  { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 8, lineHeight: 16 },

  right: { flex: 1, justifyContent: "center", alignItems: "center", padding: 48, backgroundColor: "rgba(9,12,26,0.5)" },

  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: Colors.border2,
    shadowColor: Colors.violet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 32,
  },
  title:     { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:     { marginBottom: 14 },
  label:     { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:     { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 13, fontSize: 14, color: Colors.ink },
  btn:       { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 4, shadowColor: Colors.violet, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  btnText:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText:{ fontSize: 13, color: Colors.ink3 },
  link:      { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
