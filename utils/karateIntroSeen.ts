// ============================================================
// karateIntroSeen — flag "já viu a entrada Shoji" (one-shot)
//
// A animação de portas (KarateLoginTransition) deve aparecer APENAS
// no PRIMEIRO login de uma conta karatê. Persistimos um marcador por
// usuário: web → localStorage; native → SecureStore (mesmo padrão do
// stores/auth.ts). Falhas de storage nunca quebram o login — no pior
// caso a animação reaparece (degradação suave), nunca trava.
// ============================================================
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";
const PREFIX = "aura_karate_intro_seen_";

// SecureStore aceita chaves alfanuméricas + ".-_"; UUID (com hífens) é ok.
function keyFor(userId?: string | null): string {
  return PREFIX + (userId || "anon");
}

export const karateIntroSeen = {
  async has(userId?: string | null): Promise<boolean> {
    const k = keyFor(userId);
    try {
      if (isWeb) {
        return typeof localStorage !== "undefined" && localStorage.getItem(k) === "1";
      }
      return (await SecureStore.getItemAsync(k)) === "1";
    } catch {
      return false;
    }
  },
  async mark(userId?: string | null): Promise<void> {
    const k = keyFor(userId);
    try {
      if (isWeb) {
        if (typeof localStorage !== "undefined") localStorage.setItem(k, "1");
        return;
      }
      await SecureStore.setItemAsync(k, "1");
    } catch {
      // ignora — não bloqueia o fluxo de login
    }
  },
};

export default karateIntroSeen;
