// ============================================================
// components/studio/storefront/PaginaDaVitrine.tsx
// A vitrine inteira, servida por DUAS rotas.
// Onda 0: monolito decomposto em sub-componentes.
//
// Este arquivo so monta o hook de estado + roteia entre stages.
// Toda a UI esta em components/studio/storefront/.
//
// Onda 1B (25/09/2026): a casca (loja carregada, fonte, tema, cookies,
// avisos) e o conteudo (qual tela desenhar) viraram pecas separadas. A
// vitrine publica (`app/[slug]/_layout.tsx`) monta a CASCA uma vez no
// layout e cada rota filha desenha o conteudo da sua tela — trocar de
// tela nao recarrega a loja nem perde a sacola. O endereco de dentro de
// casa (`app/cardapio/studio/[slug]`) continua com PaginaDaVitrine, a
// tela sendo so estado, como antes. Ver VitrineNaRota.tsx.
//
// Sub-componentes:
//   useStorefront         -- estado + API calls
//   ProductList           -- stage="list" (hero + grade de produtos)
//   ProductConfigurator   -- stage="configure" (fields + preview)
//   Checkout              -- stage="checkout" (dados + pagamento)
//   SentConfirmation      -- stage="sent" (confirmacao + pix + revisoes)
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Contexto, useVitrine, type ContextoDaVitrine } from "@/components/studio/storefront/ContextoDaVitrine";
import { Platform, View, Pressable, Linking } from "react-native";
import { cssDaVitrineStudio } from "@/constants/fonts";
import { useStorefront, type StorefrontState } from "@/components/studio/storefront/useStorefront";
import { ProductList } from "@/components/studio/storefront/ProductList";
import { HomeDaVitrineNova } from "@/components/studio/storefront/home/HomeDaVitrineNova";
import { vitrineV2NoNavegador } from "@/components/studio/storefront/chaveVitrineV2";
import { ProductConfigurator } from "@/components/studio/storefront/ProductConfigurator";
import { Checkout } from "@/components/studio/storefront/Checkout";
// Fase 2 (chave vitrine_v2): checkout em etapas e sacola em gaveta.
import { CheckoutEmEtapas } from "@/components/studio/storefront/CheckoutEmEtapas";
import { SacolaEmGaveta } from "@/components/studio/storefront/SacolaEmGaveta";
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
import { tituloDaPagina, chaveDaCategoria, type NavegarNaVitrine } from "@/components/studio/storefront/rotasDaVitrine";

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

// ── O contexto da vitrine ────────────────────────────────────
// A casca guarda o estado da loja (useStorefront) e o aviso passageiro;
// quem esta dentro dela le daqui em vez de receber por prop. E o que
// deixa o layout da rota montar a loja uma vez e as telas filhas so
// escolherem o que desenhar.

type AvisoNaTela = { texto: string; icone: "check" | "info"; n: number };

export { useVitrine };

/** Tempo do aviso na tela: da para ler uma frase curta sem pressa. */
const DURACAO_DO_AVISO = 2600;

/**
 * O aviso passageiro: uma pilula escura no pe da tela, acima da barra de
 * acao (mockup da Fase 1, Tela 2 — "Copiado"). Sem animacao de entrada:
 * aparece e some, o que ja respeita "reduzir movimento". Anunciado ao
 * leitor de tela pela regiao viva.
 */
function AvisoDaVitrine({ aviso }: { aviso: AvisoNaTela | null }) {
  const T = usePaletaDaVitrine();
  if (!aviso) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 16, right: 16, bottom: 128, alignItems: "center", zIndex: 70 }}
    >
      <View
        testID="aviso-da-vitrine"
        accessibilityLiveRegion="polite"
        accessibilityRole={"status" as any}
        style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          backgroundColor: T.ink, borderRadius: 999,
          paddingHorizontal: 16, paddingVertical: 9, maxWidth: 420,
        }}
      >
        <Icon name={aviso.icone} size={15} color={T.bg} />
        <Texto style={{ color: T.bg, fontSize: 12.5, fontWeight: "600" }}>{aviso.texto}</Texto>
      </View>
    </View>
  );
}

/**
 * A casca da vitrine: carrega a loja, poe fonte, tema e consentimento em
 * volta de tudo e desenha o esqueleto ou o erro enquanto nao ha loja.
 *
 * `children` fica montado o tempo todo, inclusive carregando: no layout
 * da rota ele e o <Slot/>, e o navegador das telas filhas tem que existir
 * desde o primeiro quadro para a vitrine poder arrumar o historico (ver
 * VitrineNaRota.tsx). Quem esta dentro nao desenha nada ate a loja chegar.
 */
export function CascaDaVitrine({
  slug, navegar, children,
}: {
  slug: string;
  navegar?: NavegarNaVitrine;
  children?: ReactNode;
}) {
  const sf = useStorefront(slug, { navegar });
  // Lido uma vez: so escolhe o desenho do esqueleto (ver abaixo).
  const [esqueletoNovo] = useState(() => Platform.OS === "web" && !!slug && vitrineV2NoNavegador(null, slug));

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

  const [aviso, setAviso] = useState<AvisoNaTela | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = useCallback((texto: string, icone: "check" | "info" = "check") => {
    if (relogio.current) clearTimeout(relogio.current);
    setAviso((a) => ({ texto, icone, n: (a?.n || 0) + 1 }));
    relogio.current = setTimeout(() => setAviso(null), DURACAO_DO_AVISO);
  }, []);
  useEffect(() => () => { if (relogio.current) clearTimeout(relogio.current); }, []);

  const contexto = useMemo<ContextoDaVitrine>(() => ({ sf, slug, avisar }), [sf, slug, avisar]);

  // A fonte da loja vale pra PAGINA TODA, nao so pros titulos. Medido na
  // loja de teste antes disto: de 20 textos da tela de produto, 19 saiam
  // em -apple-system. Ver TipografiaVitrine.tsx.
  // A cor da lojista vale pra vitrine INTEIRA, nao so pros 3 componentes
  // que ja montavam o tema. Ver TemaDaVitrine.tsx: ate aqui os outros 27
  // liam uma paleta cravada, e a cliente entrava na loja da lojista e
  // comprava numa loja da Aura.
  // Enquanto a loja nao chega, os tres providers recebem "nada" e caem
  // no padrao — papel quente com o violeta da Aura, par do Studio, sem
  // rastreador —, que e o que o esqueleto e a tela de erro usavam fora
  // deles. A arvore fica a mesma antes e depois da carga: trocar o pai do
  // <Slot/> no meio remontaria as telas.
  return (
    <Contexto.Provider value={contexto}>
    <TemaDaVitrine cor={(sf.store as any)?.site?.primary_color}>
    <TipografiaDaVitrine chave={parEscolhido}>
    {/* 05/09/2026: GA4/Pixel so entram depois do "Aceitar". Loja sem
        rastreador configurado nao renderiza aviso nenhum. 25/09: o
        provider decide aqui, uma vez; a barra (BarraDeCookies) cada tela
        poe no fluxo, acima da propria barra de acao. */}
    <ConsentimentoDaVitrine rastreadores={(sf.store as any)?.site?.rastreadores}>
      <View style={{ flex: 1 }}>
        {sf.loading ? (
          // Esqueleto no lugar do spinner: a tela vazia era indistinguivel de
          // loja quebrada pra quem clicou no link do WhatsApp da lojista.
          // Fase 5: com a vitrine nova ja escolhida nesta aba (?v2=1), o
          // esqueleto desenha a home nova. A chave da loja so chega com o
          // payload; ate la, o de sempre.
          <VitrineSkeleton variante={esqueletoNovo ? "home" : "grade"} />
        ) : !sf.store ? (
          // Sem loja e sem carregamento em curso e falha — mesmo que o status
          // nao tenha chegado. Nunca uma tela em branco.
          <TelaDeErroDaVitrine erro={sf.erroDeCarga} onTentarDeNovo={sf.recarregar} />
        ) : null}
        {children}
        <AvisoDaVitrine aviso={aviso} />
      </View>
    </ConsentimentoDaVitrine>
    </TipografiaDaVitrine>
    </TemaDaVitrine>
    </Contexto.Provider>
  );
}

/**
 * Qual tela desenhar, pelo estado (`sf.stage`). O mesmo para as duas
 * rotas: na publica, a rota filha so chama isto depois de o estado
 * alcancar a URL (VitrineNaRota.tsx, telaPronta).
 */
export function ConteudoDaVitrine({ telaNova }: { telaNova?: ReactNode } = {}) {
  const v = useVitrine();
  const sf = v?.sf;
  const slug = v?.slug || "";

  // O titulo da aba acompanha a tela: "Caneca Alca Coracao · Sheid
  // Mania". O servidor escreve o mesmo na casca de /p/<id> (BE-1) para a
  // previa do link; este e o do navegador depois que a cliente anda.
  const titulo = sf?.store
    ? tituloDaPagina({
        stage: sf.stage,
        nomeDaLoja: (sf.store as any)?.site?.name,
        produto: sf.activeProduct?.name,
        categoria: sf.grupoAberto?.categoria?.name,
      })
    : null;
  useEffect(() => {
    if (!titulo || Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = titulo;
  }, [titulo]);

  if (!sf || !sf.store) return null;

  // Fase 3 (chave vitrine_v2): a rota pode trocar a TELA — a página do
  // produto nova, a grade nova (VitrineNaRota.tsx, ConteudoDaRota) — e o
  // que mora em volta dela, aqui, continua valendo para as duas.
  return (
    <>
      {telaNova ? telaNova : sf.stage === "modelos" && sf.grupoAberto ? (
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
        sf.vitrineV2 ? <CheckoutEmEtapas sf={sf} /> : <Checkout sf={sf} />
      ) : sf.vitrineV2 ? (
        // Fase 5 (chave vitrine_v2): a home nova. Aqui, e nao na rota, para
        // o endereco de dentro de casa (/cardapio/studio/<slug>) tambem.
        <HomeDaVitrineNova sf={sf} slug={slug} />
      ) : (
        <ProductList sf={sf} />
      )}
      {/* A gaveta abre por cima de qualquer tela; sem a chave, nao desenha. */}
      <SacolaEmGaveta sf={sf} />
    </>
  );
}

/** A chave da categoria aberta, para a rota conferir se ja e a da URL. */
export function categoriaAberta(sf: StorefrontState | null | undefined): string | null {
  return sf?.grupoAberto ? chaveDaCategoria(sf.grupoAberto.categoria) : null;
}

/**
 * A vitrine inteira num componente so, com a tela sendo so estado — o
 * endereco de dentro de casa (`/cardapio/studio/<slug>`) e os testes.
 */
export function PaginaDaVitrine({ slug }: { slug: string }) {
  return (
    <CascaDaVitrine slug={slug}>
      <ConteudoDaVitrine />
    </CascaDaVitrine>
  );
}
