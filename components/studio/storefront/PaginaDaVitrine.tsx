// ============================================================
// components/studio/storefront/PaginaDaVitrine.tsx
// A vitrine inteira, servida por DUAS rotas.
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
import { cssDaVitrineStudio } from "@/constants/fonts";
import { ActivityIndicator, View, Text } from "react-native";
import { useStorefront } from "@/components/studio/storefront/useStorefront";
import { ProductList } from "@/components/studio/storefront/ProductList";
import { ProductConfigurator } from "@/components/studio/storefront/ProductConfigurator";
import { Checkout } from "@/components/studio/storefront/Checkout";
import { SentConfirmation } from "@/components/studio/storefront/SentConfirmation";

import { VitrineSkeleton } from "@/components/studio/storefront/VitrineSkeleton";
import { TipografiaDaVitrine } from "@/components/studio/storefront/TipografiaVitrine";
import { TemaDaVitrine, usePaletaDaVitrine } from "@/components/studio/storefront/TemaDaVitrine";
import { OrcamentoEmLote } from "@/components/studio/storefront/OrcamentoEmLote";
import { GradeDeModelos } from "@/components/studio/storefront/GradeDeModelos";
import { ConsentimentoDaVitrine } from "@/components/studio/storefront/ConsentimentoDaVitrine";

// A tela de erro roda ANTES de a loja carregar, entao a cor da lojista
// ainda nao existe. O hook fora do provider cai no tema padrao — o papel
// quente do Studio — e nao na paleta congelada de antes do S1.
function Center({ children }: { children: any }) {
  const T = usePaletaDaVitrine();
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

function AvisoDeErro({ texto }: { texto: string }) {
  const T = usePaletaDaVitrine();
  return (
    <Text style={{ color: T.ink, fontWeight: "700", marginTop: 12 }}>{texto}</Text>
  );
}

export function PaginaDaVitrine({ slug }: { slug: string }) {
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
    link.href = cssDaVitrineStudio(parEscolhido);
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }, [sf.store, parEscolhido]);

  if (sf.loading) {
    // Esqueleto no lugar do spinner: a tela vazia era indistinguivel de
    // loja quebrada pra quem clicou no link do WhatsApp da lojista.
    return <VitrineSkeleton />;
  }
  if (sf.error && !sf.store) {
    return (
      <Center>
        <Text style={{ fontSize: 36 }}>!</Text>
        <AvisoDeErro texto={sf.error} />
      </Center>
    );
  }
  if (!sf.store) return null;

  // A fonte da loja vale pra PAGINA TODA, nao so pros titulos. Medido na
  // loja de teste antes disto: de 20 textos da tela de produto, 19 saiam
  // em -apple-system. Ver TipografiaVitrine.tsx.
  // A cor da lojista vale pra vitrine INTEIRA, nao so pros 3 componentes
  // que ja montavam o tema. Ver TemaDaVitrine.tsx: ate aqui os outros 27
  // liam uma paleta cravada, e a cliente entrava na loja da lojista e
  // comprava numa loja da Aura.
  return (
    <TemaDaVitrine cor={(sf.store as any)?.site?.primary_color}>
    <TipografiaDaVitrine chave={parEscolhido}>
      {sf.stage === "modelos" && sf.grupoAberto ? (
        <GradeDeModelos
          categoria={sf.grupoAberto.categoria}
          produtos={sf.grupoAberto.produtos}
          corDaLoja={(sf.store as any)?.site?.primary_color}
          estiloCartao={(sf.store as any)?.site?.card_style}
          pixPct={sf.pixDiscountPct}
          onEscolher={(p) => sf.openConfigure(p, sf.grupoAberto!.produtos)}
          onVoltar={() => sf.goTo("list")}
        />
      ) : sf.stage === "lote" ? (
        <OrcamentoEmLote store={sf.store} slug={slug} onVoltar={() => sf.goTo("list")} />
      ) : sf.stage === "sent" ? (
        <SentConfirmation sf={sf} />
      ) : sf.stage === "configure" && sf.activeProduct ? (
        // slug e passado explicitamente pro ProductConfigurator
        // para que o FieldImage monte a URL do endpoint de upload
        <ProductConfigurator sf={sf} slug={slug} />
      ) : sf.stage === "checkout" ? (
        <Checkout sf={sf} />
      ) : (
        <ProductList sf={sf} />
      )}
      {/* 05/09/2026: GA4/Pixel so entram depois do "Aceitar". Loja sem
          rastreador configurado nao renderiza aviso nenhum. */}
      <ConsentimentoDaVitrine
        rastreadores={(sf.store as any)?.site?.rastreadores}
        corDaLoja={(sf.store as any)?.site?.primary_color}
      />
    </TipografiaDaVitrine>
    </TemaDaVitrine>
  );
}
