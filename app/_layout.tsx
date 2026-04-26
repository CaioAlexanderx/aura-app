// F-01
if (typeof document !== "undefined" && !document.getElementById("aura-splash")) { const _s = document.createElement("style"); _s.id = "aura-splash"; _s.textContent = "@keyframes splashFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}} @keyframes splashLogo{0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.02)}50%,100%{opacity:1;transform:scale(1)}} @keyframes splashRing{0%{opacity:0;transform:scale(0.6)}40%{opacity:0.4;transform:scale(1)}100%{opacity:0.2;transform:scale(1.1)}}"; document.head.appendChild(_s); }

import { useEffect } from "react";
import { Platform } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LGPDConsent } from "@/components/LGPDConsent";
import { startAutoSync } from "@/services/offlineSync";

const queryClient = new QueryClient();

function checkVerifiedParam() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("email_verified") === "true") {
    const url = new URL(window.location.href);
    url.searchParams.delete("email_verified");
    url.searchParams.delete("verify_error");
    window.history.replaceState({}, "", url.pathname + url.search);
    return true;
  }
  return false;
}

function AuthGuard() {
  const { token, user, company, isHydrated, isDemo, isStaff, trialActive, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
    startAutoSync(
      "https://aura-backend-production-f805.up.railway.app/api/v1",
      () => useAuthStore.getState().token
    );
  }, []);

  useEffect(() => {
    if (!isHydrated || !token) return;
    const verified = checkVerifiedParam();
    if (verified) {
      authApi.me(token).then(res => {
        if ((res.user as any)?.email_verified) {
          useAuthStore.setState({ user: { ...res.user, email_verified: true } as any });
        }
      }).catch(() => {});
    }
  }, [isHydrated, token]);

  useEffect(() => {
    if (!isHydrated) return;

    const inAuth     = segments[0] === "(auth)";
    const onVerify   = segments[1] === "verify-email";
    const inTabs     = segments[0] === "(tabs)";
    const onCheckout = segments[1] === "checkout";
    const emailVerified = !!(user as any)?.email_verified;

    // Contas @getaura.com.br sao internas Aura. Ja sao detectadas como
    // is_staff=true em useAuthStore (bypassa billing gate). Aqui bypassam
    // tambem o verify-email gate — sao confiaveis por construcao e exigir
    // verificacao so prende contas de teste internas.
    const isInternalAura = ((user?.email || "") as string).toLowerCase().endsWith("@getaura.com.br");

    // Paginas publicas dental — agendamento e portal do paciente sao
    // acessiveis sem login. (clinic) e auth-required entao NAO entra aqui.
    const onInvite       = segments[0] === "invite";
    const onPublicDental = segments[0] === "dental" && (segments[1] === "book" || segments[1] === "portal");
    if (onInvite || onPublicDental) return;

    // Shell dental autenticado (qualquer rota /dental/* que NAO seja publica).
    // expo-router omite groups (parenteses) na pathname, entao /dental/(clinic)/hoje
    // aparece como segments=["dental", "hoje"]. Como ja excluimos book/portal acima,
    // qualquer outro segments[0]="dental" eh shell autenticado.
    const onDentalClinic = segments[0] === "dental";

    // Vertical odonto: redirect /(tabs) -> /dental/(clinic)/hoje.
    // Decisao 2026-04-25 (memory: plano_aura_odonto_portal):
    // odonto vira porta dedicada. Modulos genericos do Aura ERP
    // continuam acessiveis via deep-link, mas o roteamento default
    // leva ao shell dental.
    const isOdonto = (company as any)?.vertical_active === "odonto";

    // 1. Not logged in → login
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    // 2. Logged in but email not verified → verify-email
    //    Bypass para contas internas Aura (@getaura.com.br).
    if (token && !isDemo && user && !emailVerified && !isInternalAura && !onVerify) {
      router.replace("/(auth)/verify-email");
      return;
    }

    // 3. Logged in + verified (ou interno) → bounce out of auth pages.
    //    Odonto vai pro shell dental, demais vao pro (tabs).
    if (token && (emailVerified || isDemo || isInternalAura) && inAuth && !onVerify) {
      router.replace(isOdonto ? "/dental/(clinic)/hoje" : "/(tabs)");
      return;
    }
    if (token && (emailVerified || isInternalAura) && onVerify) {
      router.replace(isOdonto ? "/dental/(clinic)/hoje" : "/(tabs)");
      return;
    }

    // 3.5 Odonto navegando em /(tabs) → redireciona pro shell dental.
    //     Excecao: /(tabs)/checkout precisa continuar funcionando para
    //     billing gate (passo 4) atender odonto tambem.
    if (token && (emailVerified || isDemo || isInternalAura) && isOdonto && inTabs && !onCheckout) {
      router.replace("/dental/(clinic)/hoje");
      return;
    }

    // 4. Billing gate. Aplica em (tabs) E em /dental/(clinic) — usuario
    //    odonto sem billing ativo tambem precisa passar pelo checkout.
    //    isStaff (que inclui @getaura.com.br) ja bypassa needsCheckout.
    const billingStatus  = (company as any)?.billing_status;
    const hasActiveBilling = billingStatus === "active" || trialActive;

    const memberRole = (company as any)?.member_role || "owner";
    const isOwner    = memberRole === "owner";

    const needsCheckout = !isDemo && !isStaff && emailVerified && !!company && isOwner && !hasActiveBilling;

    if (token && needsCheckout && (inTabs || onDentalClinic) && !onCheckout) {
      router.replace("/(tabs)/checkout");
      return;
    }
  }, [token, user, company, isHydrated, isDemo, isStaff, trialActive, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
        <LGPDConsent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
