// app/loja/[slug].tsx
// Redireciona getaura.com.br/loja/:slug → backend /storefront/:slug/page
import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

const BACKEND_BASE = (
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1"
).replace(/\/api\/v1\/?$/, "");

export default function StorefrontRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  useEffect(() => {
    if (typeof window !== "undefined" && slug) {
      window.location.replace(
        `${BACKEND_BASE}/storefront/${encodeURIComponent(String(slug))}/page`
      );
    }
  }, [slug]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", gap: 12 }}>
      <ActivityIndicator size="large" color="#7c3aed" />
      <Text style={{ fontSize: 13, color: "#888" }}>Carregando loja...</Text>
    </View>
  );
}
