// ============================================================
// components/studio/storefront/quadro/PersonalizadorNoQuadro.tsx
//
// p-181 (loja única 3.3a, 17/11/2026): SÓ o personalizador de uma peça,
// para a loja comum (HTML do backend) abrir num quadro (iframe) quando a
// cliente toca em "Personalizar". Rota: app/[slug]/personalizar/[id].tsx.
// Mockup: p-132, versão A ("o personalizador abre num quadro por cima da
// loja"; no celular, tela cheia com ← ).
//
// O CONTRATO das mensagens com a página mãe (o que entra, o que sai, de
// que origem) está no topo de ./mensagensDoQuadro.ts — é o que o p-182
// implementa do lado da loja.
//
// O que é reuso, e não cópia:
//   - o estado da peça é o useStorefront de sempre (sem `navegar`: aqui
//     não há URL por tela) e a página é a PaginaDoProduto da vitrine
//     Studio no modo `quadro` (sem cabeçalho, trilha, rodapé, entrega);
//   - a validação é a do commit (useStorefront.linhaDaPeca →
//     validateRequiredFields, o espelho de services/personalizavel.js);
//   - o `customization` é o do pedido (cotacaoDaSacola.itensDoPedido);
//   - o preço é o do servidor (POST /studio/cotacao), com a conta local
//     só quando a cotação não responde;
//   - o resumo é o da sacola (resumoDaPeca.resumoDaLinha).
//
// Peso: a rota baixa o bundle do app (o mesmo de toda tela) e o payload
// da loja. O three.js NÃO vem junto: o palco abre na foto da peça e o
// motor 3D só é pedido quando a cliente personaliza (ou quando a peça não
// tem foto) — o loadThree() de sempre (visualEngine/threeLoader.ts).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, View, useWindowDimensions } from "react-native";
import { useStorefront } from "../useStorefront";
import { Contexto, type ContextoDaVitrine } from "../ContextoDaVitrine";
import { TemaDaVitrine, MODO_STUDIO, useTemaDaVitrine } from "../TemaDaVitrine";
import { TipografiaDaVitrine, Texto, chaveDaTipografia } from "../TipografiaVitrine";
import { TelaDeErroDaVitrine, useFontesDaVitrine } from "../PaginaDaVitrine";
import { PaginaDoProduto, LARGURA_DESKTOP, PALCO_DO_QUADRO } from "../produto/PaginaDoProduto";
import { BotaoIcone, Botao } from "../produto/kitDaPagina";
import { itensDoPedido, lerCotacao } from "../cotacaoDaSacola";
import { resumoDaLinha } from "../resumoDaPeca";
import { valoresIniciaisDaRepeticao } from "../repeticaoDoPedido";
import { enderecoDaApi } from "../enderecoDaApi";
import type { StudioStoreProduct } from "../types";
import {
  envelope, lerMensagemDaLoja, origemDaLoja, origensPermitidas, temaDaConsulta,
  ORIGEM_DA_LOJA_AURA, type MensagemDoQuadro, type MotivoDoErro, type PrecoConfirmado,
} from "./mensagensDoQuadro";
import { miniaturaDaPeca } from "./miniaturaDoQuadro";

const API_BASE = enderecoDaApi();
const EM_DESENVOLVIMENTO = typeof __DEV__ !== "undefined" && !!__DEV__;
/** "Adicionado" no botão, depois de a loja receber a peça. */
const TEMPO_DO_ADICIONADO = 1400;

/** O que o navegador diz sobre quem enquadrou esta página. */
function janelaMae(): { enquadrado: boolean; ancestral: string | null; referrer: string | null; propria: string | null } {
  if (Platform.OS !== "web" || typeof window === "undefined") return { enquadrado: false, ancestral: null, referrer: null, propria: null };
  let enquadrado = false;
  try { enquadrado = window.parent !== window; } catch { enquadrado = true; }
  let ancestral: string | null = null;
  try {
    const a: any = (window.location as any).ancestorOrigins;
    if (a && a.length) ancestral = String(a[0]);
  } catch { /* sem a lista: vale o ?origem= */ }
  let referrer: string | null = null;
  try { referrer = document.referrer || null; } catch { /* ok */ }
  let propria: string | null = null;
  try { propria = window.location.origin; } catch { /* ok */ }
  return { enquadrado, ancestral, referrer, propria };
}

export function PersonalizadorNoQuadro({
  slug, produtoId, consulta,
}: {
  slug: string;
  produtoId: string;
  /** Os parâmetros da URL: origem, cor, modo, fonte. */
  consulta?: Record<string, unknown>;
}) {
  const sf = useStorefront(slug);
  const site: any = (sf.store as any)?.site || null;
  const pedido = useMemo(() => temaDaConsulta(consulta), [consulta?.cor, consulta?.modo, consulta?.fonte]); // eslint-disable-line react-hooks/exhaustive-deps
  const cor = pedido.cor || site?.primary_color || null;
  const modo = pedido.modo || MODO_STUDIO;
  const par = chaveDaTipografia(pedido.fonte || site?.font_family) || null;
  const carregou = !!sf.store || !!sf.erroDeCarga;
  useFontesDaVitrine(par, carregou);

  // ── Com quem conversar ─────────────────────────────────────
  // Decidido quando a loja chega: o domínio próprio vem no payload dela.
  const origem = useMemo(() => {
    if (!carregou) return null;
    const j = janelaMae();
    const permitidas = origensPermitidas({ propria: j.propria, dominioProprio: site?.dominio_proprio, dev: EM_DESENVOLVIMENTO });
    return origemDaLoja({
      enquadrado: j.enquadrado, ancestral: j.ancestral, pedida: consulta?.origem, referrer: j.referrer,
      permitidas, dev: EM_DESENVOLVIMENTO,
    });
  }, [carregou, site?.dominio_proprio, consulta?.origem]); // eslint-disable-line react-hooks/exhaustive-deps

  const falar = useCallback((m: MensagemDoQuadro) => {
    if (!origem || typeof window === "undefined") return;
    try { window.parent.postMessage(envelope(m), origem); } catch { /* a mãe saiu */ }
  }, [origem]);

  // ── A peça ─────────────────────────────────────────────────
  const produto: StudioStoreProduct | null = useMemo(
    () => (sf.store?.products || []).find((p) => String(p.id) === String(produtoId)) || null,
    [sf.store, produtoId],
  );
  const [editando, setEditando] = useState(false);
  // Cada "editar" remonta a página: o palco abre no mockup do item, como
  // abre quando a cliente acabou de personalizar.
  const [edicao, setEdicao] = useState(0);
  const abriu = useRef(false);
  useEffect(() => {
    if (!produto || abriu.current || !origem) return;
    abriu.current = true;
    sf.openConfigure(produto, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto, origem]);

  const avisouOEstado = useRef(false);
  useEffect(() => {
    if (!origem || avisouOEstado.current || !carregou) return;
    const motivo: MotivoDoErro | null = !sf.store ? "loja_indisponivel" : !produto ? "produto_indisponivel" : null;
    if (motivo) { avisouOEstado.current = true; falar({ tipo: "erro", motivo }); return; }
    if (sf.activeProduct && String(sf.activeProduct.id) === String(produtoId)) {
      avisouOEstado.current = true;
      falar({ tipo: "pronto", produto_id: String(produtoId), nome: produto!.name });
    }
  }, [origem, carregou, sf.store, produto, sf.activeProduct, produtoId, falar]);

  // "Editar" na sacola da loja: a peça reabre com o item.
  useEffect(() => {
    if (!origem || Platform.OS !== "web" || typeof window === "undefined") return;
    const ouvir = (e: MessageEvent) => {
      const m = lerMensagemDaLoja(e, { origemDaLoja: origem, fonteOk: e.source === window.parent });
      if (!m || !produto) return;
      const c = m.customization;
      const valores: Record<string, any> = { ...c };
      delete valores.has_back_selected;
      delete valores.has_middle_selected;
      const ini = valoresIniciaisDaRepeticao(
        { product_id: String(produto.id), nome: produto.name, quantidade: m.quantidade, indisponivel: false,
          personalizacao: { valores, verso: c.has_back_selected === true, meio: c.has_middle_selected === true } },
        produto,
      );
      sf.openConfigure(produto, [], ini);
      sf.setError(null);
      setEditando(true);
      setEdicao((n) => n + 1);
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, produto]);

  // ── Confirmar ──────────────────────────────────────────────
  const [ocupado, setOcupado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (relogio.current) clearTimeout(relogio.current); }, []);

  async function confirmar() {
    if (ocupado || !produto) return;
    const r = sf.linhaDaPecaAberta();
    if (!r) return;
    if ("erro" in r) { sf.setError(r.erro); return; }
    sf.setError(null);
    const linha = { lineId: "quadro", ...r.linha };
    const item = itensDoPedido([linha])[0];
    let preco: PrecoConfirmado = { unitario: sf.configuringUnitPrice, total: sf.configuringLineTotal, fonte: "estimativa" };
    setOcupado(true);
    try {
      const resp = await fetch(API_BASE + "/storefront/" + slug + "/studio/cotacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item] }),
      });
      const j = await resp.json().catch(() => null);
      // O servidor recusou a peça (a mesma validação do pedido): a cliente
      // vê o motivo na barra, como vê o que falta.
      if (resp.status === 400 && j?.error) { sf.setError(String(j.error)); return; }
      const c = resp.ok ? lerCotacao(j, 1) : null;
      if (c?.itens[0]) preco = { unitario: c.itens[0].preco_unitario, total: c.itens[0].total, fonte: "servidor" };
    } catch {
      // Sem rede para a cotação: vai a estimativa, e o pedido recota.
    } finally {
      setOcupado(false);
    }
    const raiz = typeof document !== "undefined" ? document.querySelector(`[data-testid="${PALCO_DO_QUADRO}"]`) : null;
    falar({
      tipo: "confirmou",
      produto_id: String(produto.id),
      nome: produto.name,
      quantidade: item.quantity,
      customization: item.customization,
      resumo: resumoDaLinha(linha),
      preco,
      miniatura: miniaturaDaPeca({ raiz, fotoDaPeca: produto.image_url }),
      editando,
    });
    setConfirmado(true);
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setConfirmado(false), TEMPO_DO_ADICIONADO);
  }

  function cancelar() {
    falar({ tipo: "cancelou", produto_id: String(produtoId) });
  }

  const contexto = useMemo<ContextoDaVitrine>(() => ({ sf, slug, avisar: () => {} }), [sf, slug]);

  let corpo: ReactNode;
  if (!carregou) corpo = <Carregando />;
  else if (!origem) corpo = <ForaDaLoja slug={slug} />;
  else if (!sf.store) corpo = <TelaDeErroDaVitrine erro={sf.erroDeCarga} onTentarDeNovo={sf.recarregar} />;
  else if (!produto) corpo = <PecaIndisponivel onVoltar={cancelar} />;
  else if (!sf.activeProduct) corpo = <Carregando />;
  else {
    corpo = (
      <PaginaDoProduto
        key={"edicao-" + edicao}
        sf={sf}
        slug={slug}
        quadro={{
          cabecalho: <CabecalhoDoQuadro nome={produto.name} onFechar={cancelar} />,
          onConfirmar: () => { void confirmar(); },
          editando,
          ocupado,
          confirmado,
        }}
      />
    );
  }

  return (
    <Contexto.Provider value={contexto}>
      <TemaDaVitrine cor={cor} modo={modo}>
        <TipografiaDaVitrine chave={par}>
          <Fundo>{corpo}</Fundo>
        </TipografiaDaVitrine>
      </TemaDaVitrine>
    </Contexto.Provider>
  );
}

function Fundo({ children }: { children: ReactNode }) {
  const t = useTemaDaVitrine();
  return <View testID="personalizador-no-quadro" style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

/** "Personalizar · <peça>": ← no celular (tela cheia), × no desktop (quadro por cima da loja). */
export function CabecalhoDoQuadro({ nome, onFechar }: { nome: string; onFechar: () => void }) {
  const t = useTemaDaVitrine();
  const { width } = useWindowDimensions();
  const desktop = width >= LARGURA_DESKTOP;
  const titulo = (
    <Texto numberOfLines={1} accessibilityRole="header" style={{ flex: 1, fontSize: desktop ? 16 : 15, fontWeight: "700", color: t.ink }}>
      {`Personalizar · ${nome}`}
    </Texto>
  );
  return (
    <View
      testID="cabecalho-do-quadro"
      style={{
        height: desktop ? 64 : 52, flexDirection: "row", alignItems: "center", gap: 6,
        paddingLeft: desktop ? 24 : 4, paddingRight: desktop ? 12 : 16,
        backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: t.border,
      }}
    >
      {desktop ? null : <BotaoIcone icone="chevron_left" rotulo="Voltar para a loja" onPress={onFechar} testID="quadro-voltar" />}
      {titulo}
      {desktop ? <BotaoIcone icone="x" rotulo="Fechar e voltar para a loja" onPress={onFechar} testID="quadro-fechar" /> : null}
    </View>
  );
}

function Carregando() {
  const t = useTemaDaVitrine();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="quadro-carregando">
      <ActivityIndicator size="large" color={t.marcaTexto} />
    </View>
  );
}

/** A peça saiu da loja (oculta, apagada) entre o cartão e o toque. */
function PecaIndisponivel({ onVoltar }: { onVoltar: () => void }) {
  const t = useTemaDaVitrine();
  return (
    <View testID="quadro-peca-indisponivel" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
      <Texto style={{ fontSize: 17, fontWeight: "700", color: t.ink, textAlign: "center" }}>Esta peça não está disponível agora</Texto>
      <Texto style={{ fontSize: 14, color: t.ink2, textAlign: "center", maxWidth: 360 }}>
        Ela pode ter saído da loja há pouco. Volte e escolha outra, ou fale com a loja pelo WhatsApp.
      </Texto>
      <Botao rotulo="Voltar para a loja" onPress={onVoltar} />
    </View>
  );
}

/**
 * Aberto fora da loja (direto no navegador ou num site que não é o da
 * loja): nada de personalizador, nada de mensagem. Leva para a loja.
 */
function ForaDaLoja({ slug }: { slug: string }) {
  const t = useTemaDaVitrine();
  const href = `${ORIGEM_DA_LOJA_AURA}/${encodeURIComponent(slug)}`;
  return (
    <View testID="quadro-fora-da-loja" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
      <Texto style={{ fontSize: 17, fontWeight: "700", color: t.ink, textAlign: "center" }}>O personalizador abre pela loja</Texto>
      <Texto style={{ fontSize: 14, color: t.ink2, textAlign: "center", maxWidth: 360 }}>
        Toque em "Personalizar" na página da peça, na loja online.
      </Texto>
      <Botao
        rotulo="Ir para a loja"
        onPress={() => {
          if (Platform.OS !== "web" || typeof window === "undefined") return;
          try { (window.top || window).location.href = href; } catch { window.location.href = href; }
        }}
      />
    </View>
  );
}
