// ============================================================
// /sign/[token]
//
// Rota PUBLICA (sem auth) que redireciona pra rota REST do backend
// que serve o HTML do canvas de assinatura digital.
//
// Por que essa rota existe?
//   Antes (bug PR33): generateWsToken gerava qr_payload apontando pra
//   APP_URL/sign/<token> (frontend), mas o frontend nao tinha rota
//   /sign/:token. Pacientes que abriam o link recebiam 404.
//
//   Backend ja foi corrigido pra gerar qr_payload apontando direto pro
//   endpoint backend (/api/v1/dental/sign/:token/pad). Esta rota
//   frontend e safety net pras URLs antigas que ja foram enviadas
//   (em WhatsApp de pacientes, etc) e ainda apontam pra getaura.com.br.
// ============================================================

import { useEffect } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";

const API_BASE = (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

export default function SignRedirect() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  useEffect(() => {
    if (!token) return;
    const padUrl = `${API_BASE.replace(/\/$/, "")}/dental/sign/${token}/pad`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Substitui a URL atual (paciente nao volta pra essa rota se apertar back)
      window.location.replace(padUrl);
    }
  }, [token]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#f5f5f5" }}>
      <ActivityIndicator color="#06B6D4" size="large" />
      <Text style={{ marginTop: 12, fontSize: 14, color: "#444" }}>
        Abrindo pagina de assinatura...
      </Text>
      {!token && (
        <Text style={{ marginTop: 8, fontSize: 12, color: "#e74c3c" }}>
          Token invalido. Solicite um novo link ao seu dentista.
        </Text>
      )}
    </View>
  );
}
