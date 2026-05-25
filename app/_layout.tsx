// F-01 (CF Pages trigger 2026-05-25T15:35 — hotfix studio shell)
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

    const isInternalAura = ((user?.email || "") as string).toLowerCase().endsWith("@getaura.com.br");

    const onInvite       = segments[0] === "invite";
    const onPublicDental = segments[0] === "dental" && (segments[1] === "book" || segments[1] === "portal");
    const onPublicReport = segments[0] === "relatorios";
    // Fase 4: cardápio QR público da mesa em /m/[tableId].
    const onPublicQrTable = segments[0] === "m";
    // Fase 5: storefront público de delivery em /cardapio/[slug].
    const onPublicCardapio = segments[0] === "cardapio";
    // Fase 5 Studio: aprovação de arte pública em /aprovacao/[token]
    // (link enviado via wa.me pro cliente — não exige login).
    const onPublicApproval = segments[0] === "aprovacao";
    if (onInvite || onPublicDental || onPublicReport || onPublicQrTable || onPublicCardapio || onPublicApproval) return;

    const onDentalClinic = segments[0] === "dental";
    const onFoodSalao    = segments[0] === "food";
    // 2026-05-25 (hotfix Sheid Mania): Studio também tem porta dedicada
    // /studio/(estudio) com shell próprio (navy + magenta).
    const onStudio       = segments[0] === "studio";

    const isOdonto = (company as any)?.vertical_active === "odonto";
    const isFood   = (company as any)?.vertical_active === "food";
    const isStudio = (company as any)?.vertical_active === "studio";

    if (!token && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    if (token && !isDemo && user && !emailVerified && !isInternalAura && !onVerify) {
      router.replace("/(auth)/verify-email");
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && inAuth && !onVerify) {
      router.replace(
        isOdonto ? "/dental/(clinic)/hoje" :
        isFood   ? "/food/(salao)/mesas"   :
        isStudio ? "/studio/(estudio)"     :
        "/(tabs)"
      );
      return;
    }
    if (token && (emailVerified || isInternalAura) && onVerify) {
      router.replace(
        isOdonto ? "/dental/(clinic)/hoje" :
        isFood   ? "/food/(salao)/mesas"   :
        isStudio ? "/studio/(estudio)"     :
        "/(tabs)"
      );
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && isOdonto && inTabs && !onCheckout) {
      router.replace("/dental/(clinic)/hoje");
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && isFood && inTabs && !onCheckout) {
      router.replace("/food/(salao)/mesas");
      return;
    }

    // 2026-05-25 (hotfix Sheid Mania): mesma lógica para Studio.
    if (token && (emailVerified || isDemo || isInternalAura) && isStudio && inTabs && !onCheckout) {
      router.replace("/studio/(estudio)");
      return;
    }

    const billingStatus    = (company as any)?.billing_status;
    const hasActiveBilling = billingStatus === "active" || trialActive;
    const memberRole       = (company as any)?.member_role || "owner";
    const isOwner          = memberRole === "owner";
    const needsCheckout    = !isDemo && !isStaff && emailVerified && !!company && isOwner && !hasActiveBilling;

    if (token && needsCheckout && (inTabs || onDentalClinic || onFoodSalao || onStudio) && !onCheckout) {
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
