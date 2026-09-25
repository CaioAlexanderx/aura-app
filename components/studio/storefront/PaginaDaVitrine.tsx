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
import { Platform, View, Pressable, Linking } from "react-native";
import { cssDaVitrineStudio } from "@/constants/fonts";
import { useStorefront } from "@/components/studio/storefront/useStorefront";
import { ProductList } from "@/components/studio/storefront/ProductList";
import { ProductConfigurator } from "@/components/studio/storefront/ProductConfigurator";
import { Checkout } from "@/components/studio/storefront/Checkout";
import { SentConfirmation } from "@/components/studio/storefront/SentConfirmation";

import { VitrineSkeleton } from "@/components/studio/storefront/VitrineSkeleton";
import { TipografiaDaVitrine, Texto, useTipografia } from "@/components/studio/storefront/TipografiaVitrine";
import { TemaDaVitrine, usePaletaDaVitrine, useTemaDaVitrine } from "@/components/studio/storefront/TemaDaVitrine";
import { OrcamentoEmLote } from "@/components/studio/storefront/OrcamentoEmLote";
import { GradeDeModelos } from "@/components/studio/storefront/GradeDeModelos";
import { ConsentimentoDaVitrine } from "@/components/studio/storefront/ConsentimentoDaVitrine";
import { erroDaLoja, LINK_DA_AURA, type ErroDeCarga } from "@/components/studio/storefront/erroDaVitrine";
import { wash } from "@/components/studio/storefront/theme";
import { Icon } from "@/components/Icon";

/**
 * A tela de erro com a voz da loja (Tela 4 do mockup da Fase 1).
 *
 * Roda ANTES de a loja carregar, entao a cor da lojista ainda nao existe:
 * fora do provider, o tema cai no padrao — papel quente com o violeta da
 * Aura — e nao numa paleta congelada. Hoje era um "!" de 36 px e a
 * mensagem crua da API; agora diz o que aconteceu e o que fazer.
 */
export function TelaDeErroDaVitrine({
  erro, onTentarDeNovo,
}: {
  erro: ErroDeCarga | null;
  onTentarDeNovo: () => void;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  const e = erroDaLoja(erro);
  const naoAchamos = e.tipo === "nao_achamos";

  return (
    <View
      testID={"erro-da-vitrine-" + e.tipo}
      style={{
        flex: 1, backgroundColor: T.bg,
        alignItems: "center", justifyContent: "center",
        paddingHorizontal: 30, paddingVertical: 40, gap: 14,
      }}
    >
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          alignItems: "center", justifyContent: "center",
          backgroundColor: naoAchamos ? tema.bg3 : wash(T.red, 0.1),
        }}
      >
        <Icon name={naoAchamos ? "store" : "alert"} size={26} color={naoAchamos ? T.ink3 : T.red} />
      </View>

      <View style={{ alignItems: "center", maxWidth: 360 }}>
        <Texto
          accessibilityRole="header"
          style={{ fontFamily: tipo.display, fontSize: 26, lineHeight: 30, color: T.ink, textAlign: "center" }}
        >
          {e.titulo}
        </Texto>
        <Texto style={{ fontSize: 13.5, lineHeight: 20, color: T.ink2, textAlign: "center", marginTop: 8 }}>
          {e.texto}
        </Texto>
      </View>

      {naoAchamos ? (
        <Pressable
          onPress={() => Linking.openURL(LINK_DA_AURA)}
          accessibilityRole="link"
          style={{
            minHeight: 48, paddingHorizontal: 20, borderRadius: 12,
            alignItems: "center", justifyContent: "center",
            backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
          }}
        >
          <Texto style={{ fontSize: 15, fontWeight: "600", color: T.ink }}>{e.acao}</Texto>
        </Pressable>
      ) : (
        <Pressable
          onPress={onTentarDeNovo}
          accessibilityRole="button"
          style={{
            minHeight: 48, paddingHorizontal: 20, borderRadius: 12,
            alignItems: "center", justifyContent: "center",
            backgroundColor: tema.marcaFill,
          }}
        >
          <Texto style={{ fontSize: 15, fontWeight: "600", color: tema.sobreMarca }}>{e.acao}</Texto>
        </Pressable>
      )}
    </View>
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
  const falhou = !!sf.erroDeCarga && !sf.store;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    // A tela de erro tambem fala com a voz do Studio: sem a loja, carrega o
    // par padrao; se a loja chegar depois (o "Tentar de novo" deu certo),
    // o link troca para o par que a lojista escolheu.
    if (!sf.store && !falhou) return;
    const href = cssDaVitrineStudio(parEscolhido);
    const existente = document.getElementById("aura-storefront-fonts") as HTMLLinkElement | null;
    if (existente) {
      if (existente.getAttribute("href") !== href) existente.setAttribute("href", href);
      return;
    }
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "";
    const link = document.createElement("link");
    link.id = "aura-storefront-fonts";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }, [sf.store, falhou, parEscolhido]);

  if (sf.loading) {
    // Esqueleto no lugar do spinner: a tela vazia era indistinguivel de
    // loja quebrada pra quem clicou no link do WhatsApp da lojista.
    return <VitrineSkeleton />;
  }
  if (!sf.store) {
    // Sem loja e sem carregamento em curso e falha — mesmo que o status
    // nao tenha chegado. Nunca uma tela em branco.
    return <TelaDeErroDaVitrine erro={sf.erroDeCarga} onTentarDeNovo={sf.recarregar} />;
  }

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
    {/* 05/09/2026: GA4/Pixel so entram depois do "Aceitar". Loja sem
        rastreador configurado nao renderiza aviso nenhum. 25/09: o
        provider decide aqui, uma vez; a barra (BarraDeCookies) cada tela
        poe no fluxo, acima da propria barra de acao. */}
    <ConsentimentoDaVitrine rastreadores={(sf.store as any)?.site?.rastreadores}>
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
    </ConsentimentoDaVitrine>
    </TipografiaDaVitrine>
    </TemaDaVitrine>
  );
}
