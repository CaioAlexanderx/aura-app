import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const { register, isLoading } = useAuthStore();

  async function handleRegister() {
    if (!name || !email || !password || !companyName) { Alert.alert("Preencha todos os campos"); return; }
    try {
      await register(name.trim(), email.trim().toLowerCase(), password, companyName.trim());
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao criar conta.");
    }
  }

  const fields = [
    { label: "Seu nome", value: name, set: setName, placeholder: "João Mendes" },
    { label: "E-mail", value: email, set: setEmail, placeholder: "joao@empresa.com", keyboard: "email-address" as const },
    { label: "Senha", value: password, set: setPassword, placeholder: "8+ caracteres", secure: true },
    { label: "Nome da empresa", value: companyName, set: setCompanyName, placeholder: "Minha Empresa Ltda." },
  ];

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Text style={s.wordmark}>Aura.</Text>
        <Text style={s.subtitle}>Crie sua conta grátis</Text>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Criar conta</Text>
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
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Criar conta</Text>}
        </TouchableOpacity>
        <View style={s.footer}>
          <Text style={s.footerText}>Já tem conta? </Text>
          <Link href="/(auth)/login"><Text style={s.link}>Entrar</Text></Link>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flexGrow: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: 24 },
  header:     { alignItems: "center", marginBottom: 32 },
  wordmark:   { fontSize: 42, color: Colors.violet4, fontWeight: "300", letterSpacing: -1 },
  subtitle:   { fontSize: 14, color: Colors.ink3, marginTop: 4 },
  card:       { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2 },
  title:      { fontSize: 22, color: Colors.ink, fontWeight: "600", marginBottom: 20 },
  field:      { marginBottom: 14 },
  label:      { fontSize: 12, color: Colors.ink3, marginBottom: 6, fontWeight: "500" },
  input:      { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, padding: 12, fontSize: 14, color: Colors.ink },
  btn:        { backgroundColor: Colors.violet, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  btnText:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  footer:     { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  footerText: { fontSize: 13, color: Colors.ink3 },
  link:       { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
