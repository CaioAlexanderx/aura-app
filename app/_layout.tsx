// F-01
if (typeof document !== "undefined" && !document.getElementById("aura-splash")) { const _s = document.createElement("style"); _s.id = "aura-splash"; _s.textContent = "@keyframes splashFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}} @keyframes splashLogo{0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.02)}50%,100%{opacity:1;transform:scale(1)}} @keyframes splashRing{0%{opacity:0;transform:scale(0.6)}40%{opacity:0.4;transform:scale(1)}100%{opacity:0.2;transform:scale(1.1)}}"; document.head.appendChild(_s); }

import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { startAutoSync } from "@/services/offlineSync";

const queryClient = new QueryClient();

function AuthGuard() {
  const { token, isHydrated, isDemo, onboardingComplete, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
    // UX-02: Start offline sync listener
    startAutoSync(
      "https://aura-backend-production-f805.up.railway.app/api/v1",
      () => useAuthStore.getState().token
    );
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    const inOnboarding = inTabs && segments[1] === "onboarding";

    // Not logged in -> login
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    // Logged in but on auth pages -> go to app
    if (token && inAuth) {
      // New user needs onboarding
      if (!onboardingComplete && !isDemo) {
        router.replace("/(tabs)/onboarding");
      } else {
        router.replace("/(tabs)");
      }
      return;
    }

    // Logged in, not demo, onboarding incomplete, not already on onboarding
    if (token && !isDemo && !onboardingComplete && inTabs && !inOnboarding) {
      router.replace("/(tabs)/onboarding");
      return;
    }
  }, [token, isHydrated, isDemo, onboardingComplete, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
