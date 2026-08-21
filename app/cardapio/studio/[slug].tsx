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
import { useEffect } from "react";
import { Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { cssDaVitrine } from "@/constants/fonts";
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

  // A vitrine nunca carregou fonte nenhuma: o painel e a pagina de
  // orcamento injetavam as fontes da marca, e justamente a superficie que
  // vende renderizava tudo em fonte de sistema. Aqui entram a marca e as
  // fontes de ARTE, que sao a letra estampada na peca — sem elas o
  // preview cai num fallback silencioso e a caneca "Pacifico" aparece em
  // Arial.
  // Espera a loja carregar: o par tipografico e escolha DELA, entao o
  // link so pode ser montado depois de saber qual e. Carregamos apenas o
  // par escolhido — as quatro opcoes somam oito familias, e pagar banda
  // por escolha que a lojista nao fez seria desperdicio.
  const parEscolhido = (sf.store as any)?.site?.font_family;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!sf.store) return;
    if (document.getElementById("aura-storefront-fonts")) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "";
    const link = document.createElement("link");
    link.id = "aura-storefront-fonts";
    link.rel = "stylesheet";
    link.href = cssDaVitrine(parEscolhido);
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }, [sf.store, parEscolhido]);

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
