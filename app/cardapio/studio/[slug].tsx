// ============================================================
// app/cardapio/studio/[slug].tsx
// Shell fino do storefront Studio.
// Onda 0: monolito decomposto em sub-componentes.
//
// Este arquivo so monta o hook de estado + roteia entre stages.
// Toda a UI esta em components/studio/storefront/.
//
// Sub-componentes:
//   useStorefront         -- estado + API calls
//   ProductList           -- stage="list" (hero + grade de produtos)
//   ProductConfigurator   -- stage="configure" (fields + preview)
//   Checkout              -- stage="checkout" (dados + pagamento)
//   SentConfirmation      -- stage="sent" (confirmacao + pix + revisoes)
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View, Text } from "react-native";
import { useStorefront } from "@/components/studio/storefront/useStorefront";
import { T } from "@/components/studio/storefront/types";
import { ProductList } from "@/components/studio/storefront/ProductList";
import { ProductConfigurator } from "@/components/studio/storefront/ProductConfigurator";
import { Checkout } from "@/components/studio/storefront/Checkout";
import { SentConfirmation } from "@/components/studio/storefront/SentConfirmation";

function Center({ children }: { children: any }) {
  return (
    <View
      style={{
        flex: 1, backgroundColor: T.bg,
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      {children}
    </View>
  );
}

export default function StudioStorefrontPage() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = String(params.slug || "");
  const sf = useStorefront(slug);

  if (sf.loading) {
    return <Center><ActivityIndicator color={T.primary} size="large" /></Center>;
  }
  if (sf.error && !sf.store) {
    return (
      <Center>
        <Text style={{ fontSize: 36 }}>!</Text>
        <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12 }}>{sf.error}</Text>
      </Center>
    );
  }
  if (!sf.store) return null;

  if (sf.stage === "sent") {
    return <SentConfirmation sf={sf} />;
  }
  if (sf.stage === "configure" && sf.activeProduct) {
    // slug e passado explicitamente pro ProductConfigurator
    // para que o FieldImage monte a URL do endpoint de upload
    return <ProductConfigurator sf={sf} slug={slug} />;
  }
  if (sf.stage === "checkout") {
    return <Checkout sf={sf} />;
  }
  // stage === "list" (default)
  return <ProductList sf={sf} />;
}
