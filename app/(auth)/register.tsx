import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Platform, ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

const LOGO_URL = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/logo.jpeg";

const FEATURES = [
  { icon: "📊", label: "Organização Financeira" },
  { icon: "📦", label: "Controle de Estoque e Vendas" },
  { icon: "📋", label: "Contabilidade Integrada" },
  { icon: "🌐", label: "Identidade Digital para seu negócio" },
];

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
          <TextInput style={s.input} value={f.value} onChangeText={f.set}
            placeholder={f.placeholder} placeholderTextColor={Colors.ink3}
            secureTextEntry={f.secure} keyboardType={f.keyboard ?? "default"}
            autoCapitalize={f.keyboard === "email-address" ? "none" : "words"} />
        </View>
      ))}
      <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar conta grátis</Text>}
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
          <img src={LOGO_URL} alt="Aura." style={{ width: 180, height: "auto" } as any} />
        </TouchableOpacity>
        {formCard}
      </ScrollView>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "row", height: "100vh", width: "100vw",
      background: `radial-gradient(ellipse at 15% 50%, rgba(109,40,217,0.22) 0%, transparent 55%),
                   radial-gradient(ellipse at 85% 15%, rgba(91,140,255,0.14) 0%, transparent 50%),
                   radial-gradient(ellipse at 55% 85%, rgba(139,92,246,0.12) 0%, transparent 45%),
                   ${Colors.bg}`,
    } as any}>

      {/* Painel esquerdo */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 56px" } as any}>
        <a href="https://getaura.com.br" target="_blank" rel="noreferrer"
          style={{ display: "block", textDecoration: "none", marginBottom: 40 } as any}>
          <img
            src={LOGO_URL}
            alt="Aura."
            style={{ width: 260, height: "auto", display: "block" } as any}
          />
        </a>

        <p style={{ fontSize: 16, color: Colors.ink2, lineHeight: 1.7, textAlign: "center", margin: "0 0 28px" } as any}>
          Você fez a escolha certa, hora de{" "}
          <span style={{ color: Colors.violet3, fontWeight: 600 } as any}>revolucionar</span>{" "}
          sua empresa com:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 } as any}>
          {FEATURES.map(f => (
            <div key={f.label} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: Colors.violetD,
              border: `1px solid ${Colors.border2}`,
              borderRadius: 12, padding: "12px 16px",
            } as any}>
              <span style={{ fontSize: 20 } as any}>{f.icon}</span>
              <span style={{ fontSize: 14, color: Colors.ink, fontWeight: 500 } as any}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ width: 1, background: Colors.border, margin: "48px 0" } as any} />

      {/* Painel direito */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: 56, background: "rgba(6,8,22,0.55)" } as any}>
        {formCard}
      </div>
    </div>
  );
}

const s = StyleSheet.create({
  mobile:     { flexGrow: 1, backgroundColor: Colors.bg, padding: 28, justifyContent: "center", alignItems: "center" },
  mobileLogo: { marginBottom: 32, alignItems: "center" },
  card: {
    width: "100%", maxWidth: 400,
    backgroundColor: Colors.bg3,
    borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: Colors.border2,
  },
  title:     { fontSize: 24, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginBottom: 24 },
  field:     { marginBottom: 14 },
  label:     { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:     { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 13, fontSize: 14, color: Colors.ink },
  btn:       { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 4 },
  btnText:   { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText:{ fontSize: 13, color: Colors.ink3 },
  link:      { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
