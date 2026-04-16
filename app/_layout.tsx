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

    // 4. Billing gate — verified user with company but no active plan → checkout
    //
    // hasActiveBilling = true when ANY of:
    //   - billing_status === 'active'  (paid via Asaas)
    //   - trialActive === true         (access-code with trial days)
    //   - access_code_used === true    (alpha/beta testers, no billing_status yet)
    //   - isDemo / isStaff             (exempt)
    //
    // company must exist (invite-only users have company = null until they join)
    const billingStatus    = (company as any)?.billing_status;
    const accessCodeUsed   = !!(company as any)?.access_code_used;
    const hasActiveBilling = billingStatus === "active" || trialActive || accessCodeUsed;
    const needsCheckout    = !isDemo && !isStaff && emailVerified && !!company && !hasActiveBilling;

    if (token && needsCheckout && inTabs && !onCheckout) {
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
