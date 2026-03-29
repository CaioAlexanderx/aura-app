import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

function AuraLogo({ size = 96 }: { size?: number }) {
  if (Platform.OS !== "web") {
    return (
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: size * 0.45, color: Colors.violet4, fontWeight: "300", letterSpacing: -2 }}>aura.</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: "block" }}>
        <defs>
          <radialGradient id="rg2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0c4ff" stopOpacity="1" />
            <stop offset="40%" stopColor="#a855f7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ro2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="60%" stopColor="#d8b4fe" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#rg2)" opacity="0.2" />
        {[46, 37, 28, 20].map((r, i) => (
          <circle key={r} cx="60" cy="60" r={r} fill="none"
            stroke={`rgba(196,181,253,${0.6 - i * 0.1})`} strokeWidth={i === 0 ? 1.8 : 1.3}
          />
        ))}
        <path d="M60 14 A46 46 0 0 1 106 60" fill="none" stroke="#c4b5fd" strokeWidth="2.2" opacity="0.8" />
        <path d="M60 23 A37 37 0 0 1 97 60" fill="none" stroke="#a78bfa" strokeWidth="1.6" opacity="0.65" />
        <circle cx="60" cy="60" r="10" fill="url(#ro2)" opacity="0.95" />
        <circle cx="60" cy="60" r="4.5" fill="white" opacity="1" />
      </svg>
    </View>
  );
}

export default function RegisterScreen() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany]   = useState("");
  const { register, isLoading } = useAuthStore();
  const isWeb = Platform.OS === "web";

  async function handleRegister() {
    if (!name || !email || !password || !company) { Alert.alert("Preencha todos os campos"); return; }
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

  const formCard = (
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
        <Link href="/(auth)/login"><Text style={s.link}>Entrar</Text></Link>
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

  const GRAD = "radial-gradient(ellipse at 15% 50%, rgba(109,40,217,0.22) 0%, transparent 55%), " +
    "radial-gradient(ellipse at 85% 15%, rgba(91,140,255,0.14) 0%, transparent 50%), " +
    "radial-gradient(ellipse at 55% 85%, rgba(139,92,246,0.12) 0%, transparent 45%)";

  return (
    <View style={[s.webRoot, { background: GRAD + ", " + Colors.bg } as any]}>
      {/* Painel esquerdo */}
      <View style={s.leftPanel}>
        <TouchableOpacity onPress={() => Linking.openURL("https://getaura.com.br")} style={s.logoBlock} activeOpacity={0.8}>
          <AuraLogo size={100} />
          <Text style={s.logoWordmark}>aura<Text style={{ color: Colors.violet3 }}>.</Text></Text>
          <Text style={s.logoTagline}>TECNOLOGIA PARA NEGÓCIOS</Text>
        </TouchableOpacity>

        <View style={s.divH} />

        <Text style={s.pitch}>Comece grátis.{"\n"}Sem cartão de crédito.{"\n"}Cancele quando quiser.</Text>

        <View style={s.planBox}>
          <Text style={s.planLabel}>A PARTIR DE</Text>
          <Text style={s.planPrice}>R$ 59<Text style={s.planSub}>/mês</Text></Text>
          <Text style={s.planNote}>Analista CRC incluso em todos os planos pagos</Text>
        </View>
      </View>

      <View style={s.vDivider} />

      {/* Painel direito */}
      <View style={s.rightPanel}>
        {formCard}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  mobile:         { flexGrow: 1, backgroundColor: Colors.bg, padding: 28, justifyContent: "center", alignItems: "center" },
  mobileLogo:     { alignItems: "center", marginBottom: 32 },
  mobileWordmark: { fontSize: 36, color: Colors.ink, fontWeight: "300", letterSpacing: -1, marginTop: 10 },

  webRoot:    { flex: 1, flexDirection: "row", backgroundColor: Colors.bg } as any,
  leftPanel:  { flex: 1, justifyContent: "center", alignItems: "center", padding: 56 },
  logoBlock:  { alignItems: "center", marginBottom: 36 },
  logoWordmark:{ fontSize: 48, color: Colors.ink, fontWeight: "300", letterSpacing: -2, marginTop: 14 },
  logoTagline: { fontSize: 9, color: Colors.ink3, letterSpacing: 3.5, marginTop: 5 },
  divH:        { width: 44, height: 1, backgroundColor: Colors.border2, marginBottom: 28 },
  pitch:       { fontSize: 18, color: Colors.ink2, lineHeight: 32, textAlign: "center", marginBottom: 28 },

  planBox:   { backgroundColor: Colors.violetD, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", width: 200 },
  planLabel: { fontSize: 9, color: Colors.violet3, letterSpacing: 2, marginBottom: 6 },
  planPrice: { fontSize: 38, color: Colors.ink, fontWeight: "800", letterSpacing: -1 },
  planSub:   { fontSize: 14, color: Colors.ink3, fontWeight: "400" },
  planNote:  { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 8, lineHeight: 16 },

  vDivider:   { width: 1, backgroundColor: Colors.border, marginVertical: 48 },
  rightPanel: { flex: 1, justifyContent: "center", alignItems: "center", padding: 56, backgroundColor: "rgba(6,8,22,0.55)" },

  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: Colors.border2,
    boxShadow: "0 8px 40px rgba(109,40,217,0.15)",
  } as any,
  title:     { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:     { marginBottom: 14 },
  label:     { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:     { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 13, fontSize: 14, color: Colors.ink },
  btn:       { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 4, boxShadow: "0 4px 16px rgba(109,40,217,0.4)" } as any,
  btnText:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText:{ fontSize: 13, color: Colors.ink3 },
  link:      { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
