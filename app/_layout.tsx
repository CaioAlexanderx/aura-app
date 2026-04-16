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
  const { token, user, company, isHydrated, isDemo, isStaff, trialActive, trialEndsAt, hydrate } = useAuthStore();
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

    const inAuth      = segments[0] === "(auth)";
    const onVerify    = segments[1] === "verify-email";
    const inTabs      = segments[0] === "(tabs)";
    const onCheckout  = segments[1] === "checkout";
    const emailVerified = !!(user as any)?.email_verified;

    // Invite pages handle their own navigation — skip all redirects
    const onInvite = segments[0] === "invite";
    if (onInvite) return;

    // 1. Not logged in → login
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    // 2. Logged in but email not verified → verify-email
    if (token && !isDemo && user && !emailVerified && !onVerify) {
      router.replace("/(auth)/verify-email");
      return;
    }

    // 3. Logged in + verified → bounce out of auth pages
    if (token && (emailVerified || isDemo) && inAuth && !onVerify) {
      router.replace("/(tabs)");
      return;
    }
    if (token && emailVerified && onVerify) {
      router.replace("/(tabs)");
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Billing gate — verifica se o usuario precisa pagar.
    //
    // CENARIO 1 — Funcionario convidado (invite flow):
    //   company = null imediatamente apos o registro → gate nao dispara.
    //   Apos hydrate, company e preenchido com a empresa do empregador.
    //   Funcionarios tem member_role != 'owner', por isso estao isentos
    //   do gate mesmo que a empresa do empregador nao tenha pago ainda.
    //   Apenas o OWNER e responsavel pelo pagamento.
    //
    // CENARIO 2 — Codigo de acesso com trial (ex: ENCANTO15 - 15 dias):
    //   Durante o trial: trialActive = true → bypass.
    //   Apos o trial: trialActive = false. Apenas codigos SEM trial_ends_at
    //   (codigos permanentes como ALPHA, BETA01) continuam no bypass via
    //   hasPermanentCode. Codigos com prazo caem no checkout apos expirar.
    //
    // EXEMPCOES sempre ativas: isDemo, isStaff, company = null.
    // ─────────────────────────────────────────────────────────────
    const billingStatus  = (company as any)?.billing_status;
    const accessCodeUsed = !!(company as any)?.access_code_used;
    // Codigo permanente = usou codigo E empresa nao tem trial_ends_at
    // (ex: ALPHA com trial_days=0). Distingue de trial com prazo (ENCANTO15).
    const hasPermanentCode = accessCodeUsed && !trialEndsAt;

    const hasActiveBilling =
      billingStatus === "active" ||   // pagou via Asaas
      trialActive               ||   // dentro do periodo de trial
      hasPermanentCode;              // codigo sem expiracao (alpha/beta)

    // Apenas OWNERS sao responsaveis pelo pagamento.
    // Funcionarios convidados (vendedor, gerente etc) sao isentos.
    const memberRole = (company as any)?.member_role || "owner";
    const isOwner    = memberRole === "owner";

    const needsCheckout = !isDemo && !isStaff && emailVerified && !!company && isOwner && !hasActiveBilling;

    if (token && needsCheckout && inTabs && !onCheckout) {
      router.replace("/(tabs)/checkout");
      return;
    }
  }, [token, user, company, isHydrated, isDemo, isStaff, trialActive, trialEndsAt, segments]);

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
