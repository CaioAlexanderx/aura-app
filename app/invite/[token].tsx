import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams, useRouter, useRootNavigationState } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { inviteApi } from "@/services/inviteApi";
import { toast } from "@/components/Toast";

/**
 * Route: /invite/[token]
 * FIX: validates invite BEFORE redirecting to register, passes invite_email
 */
export default function InvitePage() {
  var { token } = useLocalSearchParams<{ token: string }>();
  var { token: authToken, user } = useAuthStore();
  var router = useRouter();
  var navState = useRootNavigationState();
  var [status, setStatus] = useState<"loading" | "error" | "redirecting">("loading");
  var [errorMsg, setErrorMsg] = useState("");
  var [handled, setHandled] = useState(false);
  var navReady = navState?.key != null;

  var safeReplace = useCallback(function(target: any) {
    setTimeout(function() {
      try { router.replace(target); }
      catch { setTimeout(function() { try { router.replace(target); } catch {} }, 500); }
    }, 100);
  }, [router]);

  useEffect(function() {
    if (!navReady || handled) return;
    if (!token) { setStatus("error"); setErrorMsg("Link de convite invalido."); return; }

    setHandled(true);

    async function handleInvite() {
      if (authToken && user) {
        // User already logged in — accept invite directly
        try {
          await inviteApi.accept(token!);
          toast.success("Convite aceito! Bem-vindo a equipe.");
          setStatus("redirecting");
          safeReplace("/(tabs)/" as any);
        } catch (err: any) {
          var msg = err?.message || "Erro ao aceitar convite";
          if (msg.includes("invalido") || msg.includes("utilizado")) {
            setStatus("error"); setErrorMsg("Este convite ja foi utilizado ou expirou.");
          } else {
            setStatus("error"); setErrorMsg(msg);
          }
        }
      } else {
        // Not logged in — validate invite first to get email, then redirect to register
        try {
          var details = await inviteApi.validate(token!);
          setStatus("redirecting");
          safeReplace({
            pathname: "/(auth)/register",
            params: {
              invite_token: token,
              invite_email: details.email || "",
            },
          } as any);
        } catch (err: any) {
          // Even if validation fails, let user try to register
          setStatus("redirecting");
          safeReplace({
            pathname: "/(auth)/register",
            params: { invite_token: token },
          } as any);
        }
      }
    }

    handleInvite();
  }, [token, authToken, navReady, handled]);

  var content = (
    <View style={s.container}>
      <View style={s.card}>
        {status === "loading" && (<><ActivityIndicator size="large" color={Colors.violet3} /><Text style={s.text}>Validando convite...</Text></>)}
        {status === "redirecting" && (<><ActivityIndicator size="large" color={Colors.green} /><Text style={s.text}>Redirecionando...</Text></>)}
        {status === "error" && (<>
          <Text style={s.errorIcon}>!</Text>
          <Text style={s.errorText}>{errorMsg}</Text>
          <Text style={s.link} onPress={function() { safeReplace("/(auth)/login" as any); }}>Ir para o login</Text>
        </>)}
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: Colors.bg } as any}>{content}</div>;
  }
  return content;
}

var s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { alignItems: "center", gap: 16, backgroundColor: Colors.bg3, borderRadius: 20, padding: 40, borderWidth: 1, borderColor: Colors.border2, maxWidth: 380, width: "100%" },
  text: { fontSize: 14, color: Colors.ink3, fontWeight: "500" },
  errorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.redD, textAlign: "center", lineHeight: 48, fontSize: 22, fontWeight: "800", color: Colors.red, overflow: "hidden" },
  errorText: { fontSize: 14, color: Colors.red, fontWeight: "500", textAlign: "center" },
  link: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
