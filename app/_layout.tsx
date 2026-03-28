import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function AuthGuard() {
  const { token, isHydrated, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) router.replace("/(auth)/login");
    if (token && inAuth) router.replace("/(tabs)");
  }, [token, isHydrated, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
    </QueryClientProvider>
  );
}
