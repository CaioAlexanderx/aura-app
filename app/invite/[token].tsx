import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { inviteApi } from "@/services/inviteApi";
import { toast } from "@/components/Toast";

/**
 * Route: /invite/[token]
 * Catches invite links like https://app.getaura.com.br/app/invite/UUID
 *
 * Flow:
 * - If user is logged in  -> accept invite via API, redirect to dashboard
 * - If user is NOT logged in -> redirect to register with invite_token param
 */
export default function InvitePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { token: authToken, user } = useAuthStore();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "redirecting">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Link de convite invalido.");
      return;
    }

    async function handleInvite() {
      if (authToken && user) {
        // User is logged in -> try to accept invite directly
        try {
          await inviteApi.accept(token!);
          toast.success("Convite aceito! Bem-vindo a equipe.");
          setStatus("redirecting");
          setTimeout(() => router.replace("/(tabs)/" as any), 500);
        } catch (err: any) {
          const msg = err?.message || "Erro ao aceitar convite";
          if (msg.includes("invalido") || msg.includes("utilizado")) {
            setStatus("error");
            setErrorMsg("Este convite ja foi utilizado ou expirou.");
          } else {
            toast.error(msg);
            setStatus("error");
            setErrorMsg(msg);
          }
        }
      } else {
        // Not logged in -> redirect to register with invite token
        setStatus("redirecting");
        router.replace({
          pathname: "/(auth)/register",
          params: { invite_token: token },
        } as any);
      }
    }

    handleInvite();
  }, [token, authToken]);

  const content = (
    <View style={s.container}>
      <View style={s.card}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={Colors.violet3} />
            <Text style={s.text}>Processando convite...</Text>
          </>
        )}
        {status === "redirecting" && (
          <>
            <ActivityIndicator size="large" color={Colors.green} />
            <Text style={s.text}>Redirecionando...</Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text style={s.errorIcon}>!</Text>
            <Text style={s.errorText}>{errorMsg}</Text>
            <Text
              style={s.link}
              onPress={() => router.replace("/(auth)/login" as any)}
            >
              Ir para o login
            </Text>
          </>
        )}
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <div style={{
        minHeight: "100vh", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: Colors.bg,
      } as any}>
        {content}
      </div>
    );
  }

  return content;
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { alignItems: "center", gap: 16, backgroundColor: Colors.bg3, borderRadius: 20, padding: 40, borderWidth: 1, borderColor: Colors.border2, maxWidth: 380, width: "100%" },
  text: { fontSize: 14, color: Colors.ink3, fontWeight: "500" },
  errorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.redD, textAlign: "center", lineHeight: 48, fontSize: 22, fontWeight: "800", color: Colors.red, overflow: "hidden" },
  errorText: { fontSize: 14, color: Colors.red, fontWeight: "500", textAlign: "center" },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
