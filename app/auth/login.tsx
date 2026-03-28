import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/services/api";
import { Colors } from "@/constants/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading } = useAuthStore();

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Preencha e-mail e senha"); return; }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Erro ao entrar.");
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.wordmark}>Aura.</Text>
        <Text style={s.subtitle}>Gestão para o seu negócio</Text>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Entrar</Text>
        <View style={s.field}>
          <Text style={s.label}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            placeholder="seu@email.com" placeholderTextColor={Colors.ink3}
            autoCapitalize="none" keyboardType="email-address" />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Senha</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={Colors.ink3} secureTextEntry />
        </View>
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
        </TouchableOpacity>
        <View style={s.footer}>
          <Text style={s.footerText}>Ainda não tem conta? </Text>
          <Link href="/(auth)/register"><Text style={s.link}>Criar conta</Text></Link>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: 24 },
  header:     { alignItems: "center", marginBottom: 40 },
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
