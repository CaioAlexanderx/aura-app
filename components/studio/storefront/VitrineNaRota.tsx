// ============================================================
// components/studio/storefront/VitrineNaRota.tsx
//
// Onda 1B (Fase 1 · Endereços): a vitrine pública com uma URL por tela.
//
//   app/[slug]/_layout.tsx      → LayoutDaVitrine (a loja, montada UMA vez)
//   app/[slug]/index.tsx        → <TelaNaRota tela={{ tipo: "home" }} />
//   app/[slug]/c/[categoria]    → modelos da categoria
//   app/[slug]/p/[id]           → produto
//   app/[slug]/finalizar        → checkout (e a confirmação, nesta fase)
//   app/[slug]/orcamento        → orçamento em lote
//   app/[slug]/pedido/[token]   → Fase 2: o pedido (Pix, cartão, confirmação),
//                                 lido do servidor pelo token (PaginaDoPedido)
//   app/[slug]/sacola           → Fase 2: a home com a gaveta da sacola aberta
//
// POR QUE O LAYOUT GUARDA O ESTADO: o layout de uma rota do Expo Router
// fica montado enquanto a navegação acontece dentro dele. A loja
// (useStorefront) mora ali, então trocar de tela não busca a loja de
// novo, não perde a sacola nem o que a cliente preencheu na peça. As
// rotas filhas só dizem QUAL tela é — e desenham quando o estado chega
// nela (rotasDaVitrine.ts, telaPronta).
//
// O fluxo tem duas mãos:
//   - ação da cliente (abrir peça, finalizar, voltar) → useStorefront
//     muda o estado E chama `navegar`, que troca a URL;
//   - URL mudou por fora (voltar do navegador, F5, link colado) → a rota
//     filha chama `sf.sincronizarComTela`, que põe o estado nela.
//
// Este arquivo é o único da vitrine que conhece o roteador.
// ============================================================
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type MutableRefObject, type ReactNode,
} from "react";
import { Platform, Pressable, View } from "react-native";
import { Slot, router, useLocalSearchParams } from "expo-router";
import { CascaDaVitrine, ConteudoDaVitrine, categoriaAberta } from "./PaginaDaVitrine";
import { useVitrine } from "./ContextoDaVitrine";
import { slugDaVitrine } from "./slugDaVitrine";
import {
  caminhoDaTela, mesmaTela, telaDeEntradaProfunda, telaPronta,
  type ModoDeNavegar, type TelaDaVitrine,
} from "./rotasDaVitrine";
import { guardarAtribuicao, lerLinkDaAurinha, veioDaAurinha } from "./linkDaAurinha";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { Texto } from "./TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { PaginaDoPedido } from "./PaginaDoPedido";
import { lerRetornoDoCartao, lerPedidoPendente } from "./pedidoGuardado";
import { storageLocal } from "./dadosLembrados";
import { enderecoDaApi } from "./enderecoDaApi";

const API_BASE = enderecoDaApi();

// ── O que o layout sabe sobre a navegação ────────────────────

type RotaDaVitrine = {
  navegar: (tela: TelaDaVitrine, modo: ModoDeNavegar) => void;
  /** A próxima tela a abrir quando a home montar (ver arrumarEntrada). */
  pendente: MutableRefObject<TelaDaVitrine | null>;
  /** Ainda não montou nenhuma tela nesta carga da página? */
  primeira: MutableRefObject<boolean>;
  /** A peça que veio do link da Aurinha, para a faixa. */
  faixaDaAurinha: string | null;
  setFaixaDaAurinha: (id: string | null) => void;
};

const RotaCtx = createContext<RotaDaVitrine | null>(null);

/** Marca na aba: a loja já passou por aqui nesta sessão. */
const chaveNaAba = (slug: string) => "aura-vitrine-na-aba-" + String(slug || "").toLowerCase();

function lojaJaNaAba(slug: string): boolean {
  try { return typeof window !== "undefined" && !!window.sessionStorage?.getItem(chaveNaAba(slug)); }
  catch { return false; }
}
function marcarLojaNaAba(slug: string): void {
  try { if (typeof window !== "undefined") window.sessionStorage?.setItem(chaveNaAba(slug), "1"); }
  catch { /* sem storage: só perde o atalho */ }
}

/**
 * O que o layout sabe sobre a navegação, em volta das telas. Separado do
 * layout para o teste de tela montar a vitrine com um `navegar` falso,
 * sem roteador.
 */
export function ProvedorDaRota({
  navegar, children,
}: {
  navegar: (tela: TelaDaVitrine, modo: ModoDeNavegar) => void;
  children?: ReactNode;
}) {
  const pendente = useRef<TelaDaVitrine | null>(null);
  const primeira = useRef(true);
  const [faixaDaAurinha, setFaixaDaAurinha] = useState<string | null>(null);
  const rota = useMemo<RotaDaVitrine>(
    () => ({ navegar, pendente, primeira, faixaDaAurinha, setFaixaDaAurinha }),
    [navegar, faixaDaAurinha],
  );
  return <RotaCtx.Provider value={rota}>{children}</RotaCtx.Provider>;
}

/**
 * O layout de `app/[slug]`: a casca da loja + as telas filhas.
 *
 * O slug da LOJA vem de slugDaVitrine (o injetado pelo backend vence); o
 * dos LINKS é o segmento como está na URL — ver caminhoDaTela.
 */
export function LayoutDaVitrine() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slugDoCaminho = String(params.slug || "");
  const slug = slugDaVitrine(params.slug);

  const navegar = useCallback((tela: TelaDaVitrine, modo: ModoDeNavegar) => {
    const href = caminhoDaTela(slugDoCaminho, tela) as any;
    if (modo === "empilhar") router.push(href);
    else if (modo === "trocar") router.replace(href);
    // "voltar": volta até a tela se ela está no histórico da loja; senão
    // troca a atual por ela (popTo do React Navigation).
    else router.dismissTo(href);
  }, [slugDoCaminho]);

  return (
    <ProvedorDaRota navegar={navegar}>
      <CascaDaVitrine slug={slug} navegar={navegar}>
        <Slot />
        <RetornoDoCartao slugDoCaminho={slugDoCaminho} />
      </CascaDaVitrine>
    </ProvedorDaRota>
  );
}

/** Identidade de uma tela, para os efeitos rodarem quando ela muda. */
function chaveDaTela(t: TelaDaVitrine): string {
  return t.tipo === "produto" ? "p:" + t.id : t.tipo === "categoria" ? "c:" + t.categoria : t.tipo;
}

/**
 * Uma tela da vitrine pública. `consulta` são os parâmetros da URL
 * (`useLocalSearchParams` da rota): é por eles que chega o link da
 * Aurinha.
 */
export function TelaNaRota({
  tela, consulta,
}: {
  tela: TelaDaVitrine;
  consulta?: Record<string, unknown>;
}) {
  const v = useVitrine();
  const rota = useContext(RotaCtx);
  const sf = v?.sf;
  const slug = v?.slug || "";
  const chave = chaveDaTela(tela);

  // ── 1. A entrada na loja ───────────────────────────────────
  // Só na primeira tela desta carga da página (o layout vive enquanto a
  // cliente anda pela loja).
  //
  // Link de peça ou de categoria aberto de fora — WhatsApp, Instagram —
  // chega sem a loja no histórico: o voltar do navegador sairia dela
  // (demo de 16/10: "o voltar do navegador volta para a loja"). A
  // vitrine arruma o histórico ANTES de a loja carregar, enquanto o
  // esqueleto está na tela: troca a entrada pela home e empilha a peça
  // por cima. Se a loja já passou por esta aba (F5, voltar para ela),
  // o navegador já tem o histórico certo e nada muda.
  //
  // O link da Aurinha (`/<slug>?produto=`) faz o mesmo: a home entra
  // limpa, sem os parâmetros, e a peça por cima — senão o voltar
  // reabriria a peça pela própria URL.
  //
  // Em setTimeout, uma troca de cada vez: navegar no mesmo quadro em que
  // o navegador monta pode chegar antes de ele estar pronto, e o
  // histórico do navegador só fica certo se a troca da entrada for
  // gravada antes de a peça ser empilhada. Os tempos não são cancelados
  // na desmontagem de propósito: a primeira tela É desmontada pela
  // própria troca, e o empilhar tem que acontecer mesmo assim.
  useEffect(() => {
    if (!rota || !rota.primeira.current) return;
    rota.primeira.current = false;
    const link = lerLinkDaAurinha(consulta);
    guardarAtribuicao(slug, link);
    let alvo: TelaDaVitrine | null = null;
    if (tela.tipo === "home" && link.produto) {
      alvo = { tipo: "produto", id: link.produto };
      if (veioDaAurinha(link)) rota.setFaixaDaAurinha(link.produto);
    } else if (Platform.OS === "web" && telaDeEntradaProfunda(tela) && !lojaJaNaAba(slug)) {
      alvo = tela;
    }
    marcarLojaNaAba(slug);
    if (!alvo) return;
    const proxima = alvo;
    rota.pendente.current = proxima;
    setTimeout(() => {
      rota.navegar({ tipo: "home" }, "trocar");
      setTimeout(() => {
        rota.pendente.current = null;
        rota.navegar(proxima, "empilhar");
      }, 0);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. O estado alcança a URL ───────────────────────────────
  // Quando a loja chega e sempre que a tela da URL muda. Peça que saiu
  // da loja volta para a home com o aviso discreto; categoria que não
  // existe mais volta em silêncio.
  const temLoja = !!sf?.store;
  // Antes da pintura: a rota não desenha nada até o estado chegar, e
  // esperar um efeito comum seria um quadro em branco a cada voltar.
  useLayoutEffect(() => {
    if (!sf || !temLoja) return;
    if (tela.tipo === "home" && rota?.pendente.current) return; // a peça vem já
    const r = sf.sincronizarComTela(tela);
    if (r?.acao === "redirecionar" && !mesmaTela(r.para, tela)) {
      if (r.aviso) v?.avisar(r.aviso, "info");
      if (rota) rota.navegar(r.para, r.para.tipo === "home" ? "voltar" : "trocar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, temLoja]);

  if (!sf || !sf.store) return null;
  if (tela.tipo === "home" && rota?.pendente.current) return null;
  const pronta = telaPronta(tela, {
    stage: sf.stage,
    produtoAtivoId: sf.activeProduct ? String(sf.activeProduct.id) : null,
    categoriaAbertaChave: categoriaAberta(sf),
  });
  // Um quadro, no máximo: o efeito acima põe o estado na tela e a rota
  // desenha. Desenhar a tela anterior aqui montaria um componente que
  // não devia existir nesta URL.
  if (!pronta) return null;

  const comFaixa = tela.tipo === "produto" && rota?.faixaDaAurinha === tela.id;
  if (!comFaixa) return <ConteudoDaVitrine />;
  return (
    <View style={{ flex: 1 }}>
      <FaixaDaAurinha onFechar={() => rota?.setFaixaDaAurinha(null)} />
      <View style={{ flex: 1 }}>
        <ConteudoDaVitrine />
      </View>
    </View>
  );
}

/**
 * "Separamos esta peça para você" (mockup da Fase 1, Tela 3).
 *
 * Contexto, não alerta: na cor da loja (não âmbar), uma linha, ícone só,
 * sem exclamação. Não some sozinha; fecha com um toque.
 */
export function FaixaDaAurinha({ onFechar }: { onFechar: () => void }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  return (
    <View style={{ backgroundColor: T.card, paddingHorizontal: 16, paddingTop: 12 }}>
      <View
        testID="faixa-da-aurinha"
        style={{
          flexDirection: "row", alignItems: "center", gap: 9,
          backgroundColor: tema.marcaWash, borderWidth: 1, borderColor: tema.borderAccent,
          borderRadius: 12, paddingLeft: 12, paddingRight: 4, minHeight: 44,
          maxWidth: 980, width: "100%", alignSelf: "center",
        }}
      >
        <Icon name="heart" size={16} color={tema.marcaTexto} />
        <Texto style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: tema.marcaTexto }}>
          Separamos esta peça para você
        </Texto>
        <Pressable
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          hitSlop={4}
          style={{ width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={16} color={tema.marcaTexto} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Rota reservada que ainda não tem tela (`/sacola`, `/pedido/<token>`,
 * `/acompanhar/<token>`, `/aprovacao/<token>` dentro da loja): abre a
 * home. O servidor já serve a casca nesses caminhos (BE-1), e as telas
 * chegam nas Fases 2 e 4 — até lá o link não pode quebrar.
 *
 * Troca, não empilha: a URL reservada sai do histórico, senão o voltar
 * do navegador cairia nela e voltaria para a home de novo.
 */
export function RotaReservada() {
  const rota = useContext(RotaCtx);
  useEffect(() => {
    setTimeout(() => rota?.navegar({ tipo: "home" }, "trocar"), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ── Fase 2 · Fechar a venda ──────────────────────────────────

/**
 * `/<slug>/pedido/<token>`: a página do pedido, lida do servidor. Não é
 * estado do hook (F5 e outro aparelho mostram o mesmo pedido); só espera
 * a loja carregar, para ter a cor, a fonte e o nome dela.
 */
export function PedidoNaRota({ token, consulta }: { token: string; consulta?: Record<string, unknown> }) {
  const v = useVitrine();
  if (!v?.sf?.store || !token) return null;
  return <PaginaDoPedido token={token} consulta={consulta} />;
}

/**
 * `/<slug>/sacola`: com a chave `vitrine_v2`, a loja abre com a gaveta da
 * sacola aberta (link direto e F5, mockup da Fase 2, Tela 1). Sem a
 * chave, continua como a rota reservada de antes: a home.
 *
 * Troca, não empilha: o voltar do navegador não cai de novo em /sacola.
 */
export function SacolaNaRota() {
  const v = useVitrine();
  const rota = useContext(RotaCtx);
  const sf = v?.sf;
  const temLoja = !!sf?.store;
  const feito = useRef(false);
  useEffect(() => {
    if (!sf || !temLoja || feito.current) return;
    feito.current = true;
    const abrir = sf.vitrineV2;
    setTimeout(() => {
      rota?.navegar({ tipo: "home" }, "trocar");
      if (abrir) sf.abrirSacola();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temLoja]);
  return null;
}

/** Os recados da volta do cartão sem a página do pedido (sem token). */
const RECADO_DO_CARTAO = {
  approved: "Pagamento confirmado. Seu pedido foi recebido.",
  analise: "Estamos confirmando seu pagamento. O aviso chega no seu WhatsApp em alguns minutos.",
  pending: "Pagamento em análise. Em breve você recebe a confirmação.",
  failed: "O pagamento não foi aprovado. Tente de novo.",
  cancelled: "Pedido cancelado.",
} as const;

/**
 * A volta do Mercado Pago: `?order_id=&payment=` (o back_url do pedido
 * no cartão, o mesmo contrato do bootstrap.js da loja Negócio). Antes a
 * cliente voltava para a home sem saber se tinha pago (JORNADA §4.7).
 *
 * Com a chave: o pedido em andamento guardado no navegador tem o token,
 * e a vitrine abre a página do pedido com o resultado — ela mostra
 * aprovado, em análise ou recusado, consultando o servidor. Sem token
 * (backend antes do B1, outro aparelho), o recado de sempre da Negócio,
 * com até 15 consultas quando o retorno diz aprovado (o webhook pode
 * chegar depois do back_url). Sem a chave, nada muda.
 */
export function RetornoDoCartao({ slugDoCaminho }: { slugDoCaminho: string }) {
  const v = useVitrine();
  const sf = v?.sf;
  const temLoja = !!sf?.store;
  const feito = useRef(false);
  useEffect(() => {
    if (!sf || !temLoja || feito.current || Platform.OS !== "web" || typeof window === "undefined") return;
    feito.current = true;
    if (!sf.vitrineV2) return;
    const r = lerRetornoDoCartao(window.location.search);
    if (!r) return;
    // A URL sai limpa: um F5 não repete o recado.
    try { window.history.replaceState(window.history.state, document.title, window.location.pathname); } catch { /* ok */ }
    const pend = lerPedidoPendente(v!.slug, storageLocal());
    if (pend && pend.id === r.orderId && pend.token) {
      const q = new URLSearchParams({ pagamento: "cartao", retorno: r.resultado }).toString();
      setTimeout(() => router.replace(`/${encodeURIComponent(slugDoCaminho)}/pedido/${encodeURIComponent(pend.token!)}?${q}` as any), 0);
      return;
    }
    if (r.resultado !== "approved") {
      v!.avisar(r.resultado === "failed" ? RECADO_DO_CARTAO.failed : RECADO_DO_CARTAO.pending, "info");
      return;
    }
    let tentativas = 0;
    let vivo = true;
    const consultar = () => {
      tentativas++;
      fetch(`${API_BASE}/storefront/${v!.slug}/studio/order/${encodeURIComponent(r.orderId)}`)
        .then((x) => x.json())
        .then((o) => {
          if (!vivo) return;
          if (o?.status === "confirmed" || o?.payment_status === "paid") return v!.avisar(RECADO_DO_CARTAO.approved);
          if (o?.status === "cancelled") return v!.avisar(RECADO_DO_CARTAO.cancelled, "info");
          if (tentativas >= 15) return v!.avisar(RECADO_DO_CARTAO.analise, "info");
          setTimeout(consultar, 2000);
        })
        .catch(() => {
          if (!vivo) return;
          if (tentativas >= 15) return v!.avisar(RECADO_DO_CARTAO.analise, "info");
          setTimeout(consultar, 2000);
        });
    };
    setTimeout(consultar, 800);
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temLoja]);
  return null;
}
