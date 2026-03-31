import { useEffect } from "react";
import { Slot, useRouter, useSegments, usePathname } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function AuthGuard() {
  const { token, isHydrated, hydrate, onboardingComplete } = useAuthStore();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = pathname === "/onboarding";

    // Not logged in -> go to login
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    // Logged in but in auth pages -> go to tabs
    if (token && inAuth) {
      // If onboarding not complete, go to onboarding
      if (!onboardingComplete) {
        router.replace("/(tabs)/onboarding" as any);
      } else {
        router.replace("/(tabs)");
      }
      return;
    }

    // Logged in, onboarding not complete, not already on onboarding
    if (token && !onboardingComplete && !inOnboarding) {
      router.replace("/(tabs)/onboarding" as any);
      return;
    }
  }, [token, isHydrated, onboardingComplete, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
    </QueryClientProvider>
  );
}
