// ============================================================
// AURA STUDIO · Modal do orçamento (29/09/2026)
//
// Mockup aprovado: docs/mockups/studio-orcamento-modal.html
// Diagnóstico:     docs/studio/orcamento-modal-diagnostico.md
//
// O PO aprovou (29/09): "similar ao de criar produto do estoque da Aura
// Negócio". O editor, que era uma página com cinco botões cheios
// empilhados, vira UM modal aberto sobre a lista de orçamentos, no molde
// do cadastro de item (app#859, ItemFormModal):
//
//   - peças à esquerda; cliente, condições e resumo à direita; no
//     celular, tela cheia numa coluna só;
//   - "Adicionar" troca a coluna das peças pelo catálogo já aberto
//     (CatalogoDoOrcamento), sem precisar digitar;
//   - cada peça abre na própria linha: quantidade, preço, "Modelo do
//     mockup" (só neste orçamento, backend 364) e a arte;
//   - as condições (validade, sinal, Pix, parcelas, prazo, observação)
//     moram aqui, num lugar só. O vídeo não pergunta de novo;
//   - rodapé com UM primário por estado (regras.acoesDoRodape): rascunho
//     → Enviar pelo WhatsApp; enviado → Aprovar; ajuste pedido →
//     Reenviar; aprovado → Ver pedido. O envio por link virou um canal
//     dentro de Enviar (OrcamentoVideoModal);
//   - confirmação de saída e de decisões dentro do próprio painel.
//
// Multi-CNPJ: tudo usa a empresa do orçamento (`cid`). No consolidado,
// o orçamento novo começa pedindo a loja, e o cabeçalho mostra o chip
// da loja.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform, Linking, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { copyText } from "@/utils/clipboard";
import { useStudioTheme } from "@/contexts/StudioThemeMode";
import {
  studioApi, type StudioQuote, type StudioQuoteStatus, type AjusteDoOrcamento,
} from "@/services/studioApi";
import { OrcamentoVideoModal } from "@/components/studio/orcamentoVideo/OrcamentoVideoModal";
import { PedidoDeAjusteModal } from "@/components/studio/orcamentoVideo/PedidoDeAjusteModal";
import { baixarVideoDoOrcamento } from "@/components/studio/orcamentoVideo/videoDoOrcamentoApi";
import { baixarArquivo, nomeDoArquivo } from "@/components/studio/orcamentoVideo/envioNoWhatsApp";
import { COR_DO_AJUSTE, rotuloDaVersao } from "@/components/studio/orcamentoVideo/ajusteDoOrcamento";
import { erroDasCondicoes, lerNumero, reais, type CondicoesDoOrcamento } from "@/components/studio/orcamentoVideo/condicoesDoOrcamento";
import { CatalogoDoOrcamento } from "./CatalogoDoOrcamento";
import { LinhaDaPeca, type Peca } from "./LinhaDaPeca";
import { useCatalogoDoOrcamento } from "./useCatalogoDoOrcamento";
import {
  TIPOS_PRIMARIOS, acoesDoRodape, chipsDeValidade, estadoDoOrcamento, podeEditar, resumoDoOrcamento,
  textoDePecas, textoDeUnidades, venceEm, lerPreco, textoDoPreco,
  type AcaoDoRodape, type EstadoDoOrcamento, type ProdutoDoCatalogo,
} from "./regras";
import { Botao, Campo, Chip, Dica, Rotulo, Secao, type Tema } from "./ui";

export type LojaDoOrcamento = { id: string; name: string; logo_url?: string | null };

export type OrcamentoModalProps = {
  /** Empresa do orçamento. null no consolidado com orçamento novo: o modal pede a loja. */
  cid: string | null;
  /** "novo" ou o id do orçamento. */
  quoteId: string;
  /** Lojas do grupo (consolidado). Uma só: sem chip nem escolha. */
  lojas: LojaDoOrcamento[];
  consolidado?: boolean;
  logoDaLoja?: string | null;
  onClose: () => void;
  /** O orçamento mudou (criado, salvo, enviado, aprovado): a lista recarrega. */
  onMudou?: (q: StudioQuote) => void;
};

const STATUS_LABEL: Record<StudioQuoteStatus, string> = {
  draft: "Rascunho", sent: "Enviado", accepted: "Aceito", rejected: "Recusado",
  expired: "Expirado", converted: "Convertido", closed: "Encerrado",
};
// Cores semânticas fixas dos selos, as mesmas da lista (claro e escuro).
const STATUS_COLORS: Record<StudioQuoteStatus, { bg: string; text: string }> = {
  draft: { bg: "#F1F5F9", text: "#64748B" }, sent: { bg: "#DBEAFE", text: "#1D4ED8" },
  accepted: { bg: "#D1FAE5", text: "#065F46" }, rejected: { bg: "#FEE2E2", text: "#991B1B" },
  expired: { bg: "#FEF3C7", text: "#92400E" }, converted: { bg: "#EDE9FE", text: "#5B21B6" },
  closed: { bg: "#E2E8F0", text: "#475569" },
};

const APP_ORIGIN = "https://app.getaura.com.br";
const CANAL_LEGIVEL: Record<string, string> = {
  compartilhar: "pelo compartilhamento do WhatsApp",
  whatsapp: "pela conversa do WhatsApp",
  baixar: "com o vídeo baixado e a conversa aberta",
  copiar: "com a mensagem copiada",
};

function dataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function dia(d: Date | string | null | undefined, ano = false): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (isNaN(x.getTime())) return "";
  return x.toLocaleDateString("pt-BR", ano ? { day: "2-digit", month: "2-digit", year: "numeric" } : { day: "2-digit", month: "2-digit" });
}
function textoDe(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n).replace(".", ",");
}
function novaChave() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function erroDaApi(e: any, padrao: string) {
  return e?.data?.error || e?.message || padrao;
}

type Confirmacao = { titulo: string; texto: string; rotulo: string; perigo?: boolean; acao: () => Promise<void> | void };

export function OrcamentoModal(props: OrcamentoModalProps) {
  return (
    <WebPortal active>
      <Painel {...props} />
    </WebPortal>
  );
}

function Painel({ cid: cidInicial, quoteId, lojas, consolidado, logoDaLoja, onClose, onMudou }: OrcamentoModalProps) {
  const router = useRouter();
  const { tokens: t, isDark } = useStudioTheme();
  const { width } = useWindowDimensions();
  const estreito = width < 700;
  const tema: Tema = { t, escuro: isDark, estreito };

  const [cid, setCid] = useState<string | null>(cidInicial);
  const [id, setId] = useState<string>(quoteId);
  const novo = id === "novo";
  const catalogo = useCatalogoDoOrcamento(cid);

  // ── Orçamento ───────────────────────────────────────────────
  const [quote, setQuote] = useState<StudioQuote | null>(null);
  const [ajustes, setAjustes] = useState<AjusteDoOrcamento[]>([]);
  const [carregando, setCarregando] = useState(!novo);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);

  const [pecas, setPecas] = useState<Peca[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [validade, setValidade] = useState(7);
  const [sinalTxt, setSinalTxt] = useState("");
  const [pixTxt, setPixTxt] = useState("");
  const [parcelasTxt, setParcelasTxt] = useState("");
  const [prazoTxt, setPrazoTxt] = useState("");
  const [obsTxt, setObsTxt] = useState("");
  const [descontoTxt, setDescontoTxt] = useState("");
  const [maisCondicoes, setMaisCondicoes] = useState(false);

  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [querSair, setQuerSair] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [videoAberto, setVideoAberto] = useState(false);
  const [ajusteAberto, setAjusteAberto] = useState(false);

  useEffect(() => {
    if (!cid || novo) { setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    setErroAoCarregar(null);
    studioApi.getQuote(cid, id)
      .then(({ quote: q, items, ajustes: hist }) => {
        if (!vivo) return;
        setQuote(q);
        setAjustes(hist || []);
        setNome(q.customer_name || "");
        setZap(q.customer_phone || "");
        setValidade(Number(q.validity_days) || 7);
        setSinalTxt(textoDe(q.deposit_pct != null ? Number(q.deposit_pct) : null));
        const c = q.condicoes || null;
        setPixTxt(textoDe(c?.pix_desconto_pct));
        setParcelasTxt(textoDe(c?.parcelas));
        setPrazoTxt(textoDe(c?.prazo_dias_uteis));
        setObsTxt(c?.observacao || "");
        setMaisCondicoes(!!(c?.parcelas || c?.prazo_dias_uteis || c?.observacao));
        setDescontoTxt(Number(q.discount) > 0 ? textoDoPreco(Number(q.discount)) : "");
        setPecas((items || []).map((it) => ({
          chave: it.id || novaChave(),
          product_id: it.product_id,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          unit_cost: it.unit_cost != null ? Number(it.unit_cost) : null,
          pricing_meta: it.pricing_meta ?? null,
          customization: it.customization ?? null,
          visual_template_key: it.visual_template_key ?? null,
        })));
        setSujo(false);
      })
      .catch((e: any) => { if (vivo) setErroAoCarregar(erroDaApi(e, "Não deu para abrir o orçamento")); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
    // Só ao abrir e ao trocar de loja; depois de criar, o estado já é o do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const estado: EstadoDoOrcamento = estadoDoOrcamento(quote);
  const editavel = podeEditar(estado);
  const loja = lojas.find((l) => l.id === cid) || null;
  const produtosPorId = useMemo(() => new Map((catalogo.produtos || []).map((p) => [p.id, p] as const)), [catalogo.produtos]);

  const condicoes: CondicoesDoOrcamento = {
    pix_desconto_pct: lerNumero(pixTxt),
    parcelas: lerNumero(parcelasTxt),
    prazo_dias_uteis: lerNumero(prazoTxt),
    observacao: obsTxt.trim() || null,
  };
  const sinalPct = lerNumero(sinalTxt);
  const desconto = lerPreco(descontoTxt) ?? 0;
  const resumo = resumoDoOrcamento(pecas, { desconto, sinalPct, pixPct: condicoes.pix_desconto_pct, parcelas: condicoes.parcelas });
  const erroCond = erroDasCondicoes(condicoes)
    || (sinalPct !== null && (sinalPct <= 0 || sinalPct > 100) ? "Sinal entre 1% e 100%" : null)
    || (desconto > resumo.subtotal && resumo.subtotal > 0 ? "O desconto passa do subtotal" : null);
  const vence = quote?.status === "sent" && quote.expires_at ? new Date(quote.expires_at) : venceEm(validade);
  const noOrcamento = useMemo(() => {
    const m: Record<string, number> = {};
    pecas.forEach((p) => { if (p.product_id) m[p.product_id] = (m[p.product_id] || 0) + p.quantity; });
    return m;
  }, [pecas]);

  const videoGuardado = !!(quote?.video_key || quote?.tem_video)
    && !!quote?.video_expira_em && new Date(quote.video_expira_em) > new Date();

  function mudou<T>(set: (v: T) => void) {
    return (v: T) => { set(v); setSujo(true); };
  }

  // ── Peças ───────────────────────────────────────────────────
  function mudarPeca(chave: string, p: Partial<Peca>) {
    setPecas((antes) => antes.map((x) => (x.chave === chave ? { ...x, ...p } : x)));
    setSujo(true);
  }

  function adicionarProduto(p: ProdutoDoCatalogo) {
    const ja = pecas.find((x) => x.product_id === p.id);
    if (ja) {
      mudarPeca(ja.chave, { quantity: Math.round((ja.quantity + 1) * 1000) / 1000 });
      return;
    }
    const chave = novaChave();
    const preco = p.price;
    setPecas((antes) => [...antes, {
      chave, product_id: p.id, description: p.name, quantity: 1, unit_price: preco,
      unit_cost: null, pricing_meta: null, customization: null, visual_template_key: null, image_url: p.image_url,
    }]);
    setSujo(true);
    // Motor de preço (Fase B): se tiver regra, troca o preço do cadastro —
    // só enquanto a lojista não mexeu no preço dessa peça.
    if (cid) {
      studioApi.calculateQuoteLine(cid, { product_id: p.id, quantity: 1 })
        .then((calc) => {
          if (!(calc?.unit_price > 0)) return;
          setPecas((antes) => antes.map((x) => (x.chave === chave && x.unit_price === preco
            ? { ...x, unit_price: calc.unit_price, pricing_meta: calc.breakdown, unit_cost: calc.breakdown?.base_cost > 0 ? calc.breakdown.base_cost : x.unit_cost }
            : x)));
        })
        .catch(() => {});
    }
  }

  function adicionarAvulso(item: { description: string; quantity: number; unit_price: number }) {
    setPecas((antes) => [...antes, {
      chave: novaChave(), product_id: null, ...item, unit_cost: null, pricing_meta: null, customization: null, visual_template_key: null,
    }]);
    setSujo(true);
  }

  // ── Salvar ──────────────────────────────────────────────────
  async function persistir(): Promise<StudioQuote | null> {
    if (!cid) return null;
    if (!pecas.length) { toast.error("Adicione ao menos uma peça"); return null; }
    if (erroCond) { toast.error(erroCond); return null; }
    const body = {
      customer_name: nome.trim() || undefined,
      customer_phone: zap.trim() || undefined,
      items: pecas.map((p, i) => ({
        product_id: p.product_id, description: p.description, quantity: p.quantity, unit_price: p.unit_price,
        unit_cost: p.unit_cost ?? null, pricing_meta: p.pricing_meta ?? null, customization: p.customization ?? null,
        visual_template_key: p.product_id ? p.visual_template_key : null, sort_order: i,
      })),
      discount: desconto,
      validity_days: validade,
      deposit_pct: sinalPct && sinalPct > 0 ? sinalPct : null,
    };
    try {
      let q: StudioQuote;
      if (novo) {
        q = await studioApi.createQuote(cid, body as any);
        setId(q.id);
      } else {
        q = await studioApi.updateQuote(cid, id, body as any);
      }
      // As condições (e o sinal/validade de novo, que o servidor recalcula
      // sobre o total) vão na rota do orçamento em vídeo, num lugar só.
      const r = await studioApi.salvarCondicoesDoOrcamento(cid, q.id, {
        ...condicoes, deposit_pct: body.deposit_pct, validity_days: validade,
      });
      const final = { ...q, ...r.quote } as StudioQuote;
      setQuote(final);
      setSujo(false);
      onMudou?.(final);
      return final;
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não deu para salvar o orçamento"));
      return null;
    }
  }

  async function comOcupado(nomeDaAcao: string, f: () => Promise<void>) {
    setOcupado(nomeDaAcao);
    try { await f(); } finally { setOcupado(null); }
  }

  // ── Ações do rodapé ─────────────────────────────────────────
  function pedirFechar() {
    if (sujo && editavel && !novo) { setQuerSair(true); return; }
    if (sujo && editavel && novo && pecas.length) { setQuerSair(true); return; }
    onClose();
  }

  async function enviar() {
    await comOcupado("enviar", async () => {
      const q = await persistir();
      if (!q) return;
      if (Platform.OS === "web") { setVideoAberto(true); return; }
      // Nativo: sem canvas para o vídeo, vai o link do orçamento.
      try {
        const r = await studioApi.sendQuote(cid!, q.id);
        setQuote(r);
        onMudou?.(r);
        const url = r.quote_url || `${APP_ORIGIN}/orcamento/${r.token}`;
        const dig = zap.replace(/\D/g, "");
        if (dig.length >= 10) Linking.openURL(`https://wa.me/${dig.length <= 11 ? "55" + dig : dig}?text=${encodeURIComponent("Segue seu orçamento: " + url)}`);
      } catch (e: any) {
        toast.error(erroDaApi(e, "Não deu para enviar o orçamento"));
      }
    });
  }

  function acionar(a: AcaoDoRodape) {
    if (!cid) return;
    switch (a.id) {
      case "cancelar": case "fechar": pedirFechar(); return;
      case "voltar_pecas": case "concluir": setCatalogoAberto(false); return;
      case "salvar":
        comOcupado("salvar", async () => { if (await persistir()) toast.success("Rascunho salvo"); });
        return;
      case "enviar": enviar(); return;
      case "ajuste": setAjusteAberto(true); return;
      case "ver_pedido":
        if (quote?.order_id) { onClose(); router.push(`/studio/pedidos/${quote.order_id}` as any); }
        return;
      case "aprovar":
        setConfirmacao({
          titulo: "Aprovar o orçamento?",
          texto: "Ele vira pedido e entra na Produção com as peças, a arte, o modelo, os valores e as condições combinadas.",
          rotulo: "Aprovar",
          acao: async () => {
            const r = await studioApi.aprovarOrcamento(cid, quote!.id);
            setQuote(r.quote); onMudou?.(r.quote);
            toast.success("Orçamento aprovado. O pedido está na Produção.");
          },
        });
        return;
      case "converter":
        setConfirmacao({
          titulo: "Converter em pedido?",
          texto: "O cliente aceitou pela página do orçamento. O pedido entra na Produção.",
          rotulo: "Converter",
          acao: async () => {
            const r = await studioApi.convertQuote(cid, quote!.id);
            setQuote(r.quote); onMudou?.(r.quote);
            toast.success("Pedido criado na Produção.");
          },
        });
        return;
      case "fechar_sem_venda":
        setConfirmacao({
          titulo: "Fechar sem venda?",
          texto: "O orçamento sai dos que estão em aberto e não vira pedido.",
          rotulo: "Fechar sem venda",
          perigo: true,
          acao: async () => {
            const r = await studioApi.fecharOrcamento(cid, quote!.id);
            setQuote(r.quote); onMudou?.(r.quote); setSujo(false);
            toast.success("Orçamento fechado");
          },
        });
        return;
    }
  }

  async function registrarAjuste(texto: string): Promise<boolean> {
    if (!cid || !quote) return false;
    try {
      const r = await studioApi.registrarAjusteDoOrcamento(cid, quote.id, texto);
      const q = { ...quote, ...r.quote } as StudioQuote;
      setQuote(q); onMudou?.(q);
      setAjustes((antes) => [r.ajuste, ...antes]);
      toast.success("Ajuste registrado. O orçamento voltou a ser editável.");
      return true;
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não deu para registrar o ajuste"));
      return false;
    }
  }

  async function manterVideo() {
    if (!cid || !quote) return;
    try {
      const r = await studioApi.manterVideoDoOrcamento(cid, quote.id);
      setQuote({ ...quote, video_expira_em: r.video.expira_em });
      toast.success("O vídeo fica guardado por mais 30 dias");
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não deu para manter o vídeo"));
    }
  }

  async function baixarVideo() {
    if (!cid || !quote) return;
    try {
      const blob = await baixarVideoDoOrcamento(cid, quote.id);
      if (!blob) { toast.info("O vídeo deste orçamento não está mais guardado"); return; }
      const ext = (blob.type || "").includes("webm") ? "webm" : "mp4";
      baixarArquivo(blob, nomeDoArquivo(loja?.name || "", quote.customer_name, ext));
    } catch (e: any) {
      toast.error(erroDaApi(e, "Não deu para baixar o vídeo"));
    }
  }

  // ── Cabeçalho ───────────────────────────────────────────────
  const titulo = novo && !quote ? "Novo orçamento" : `Orçamento · ${nome.trim() || quote?.customer_name || "sem nome"}`;
  const versao = rotuloDaVersao(quote?.versao);
  let subtitulo = "Escolha as peças, confira os valores e mande pelo WhatsApp";
  if (!cid) subtitulo = "Primeiro, a loja do orçamento";
  else if (catalogoAberto) subtitulo = "Toque numa peça do catálogo para adicionar. Você pode adicionar várias.";
  else if (estado === "rascunho" && pecas.length) subtitulo = `${textoDePecas(pecas.length)} · toque numa peça para enviar a arte e ver o vídeo`;
  else if (estado === "ajuste") subtitulo = `${versao || "Versão " + ((Number(quote?.versao) || 1))} · o cliente pediu mudança; edite e reenvie`;
  else if (estado === "enviado") subtitulo = `Enviado ${dataHora(quote?.sent_at)}${quote?.canal_envio ? " pelo WhatsApp" : ""} · em aberto até o cliente responder`;
  else if (estado === "aprovado") subtitulo = "Virou pedido · está na Produção";
  else if (estado === "aceito") subtitulo = "O cliente aceitou pela página do orçamento";
  else if (estado === "encerrado") subtitulo = quote?.status === "closed" ? "Fechado sem venda" : `${STATUS_LABEL[quote!.status]}`;

  const selo = quote
    ? estado === "ajuste"
      ? { bg: COR_DO_AJUSTE.bg, fg: COR_DO_AJUSTE.text, txt: "Ajuste pedido" }
      : { bg: STATUS_COLORS[quote.status].bg, fg: STATUS_COLORS[quote.status].text, txt: STATUS_LABEL[quote.status] }
    : { bg: STATUS_COLORS.draft.bg, fg: STATUS_COLORS.draft.text, txt: "Rascunho" };

  // ── Rodapé ──────────────────────────────────────────────────
  const acoes = cid ? acoesDoRodape(estado, { temPecas: pecas.length > 0, catalogoAberto, temPedido: !!quote?.order_id }) : [];
  let info = "", infoMenor = "";
  if (!cid) info = "Escolha a loja para começar";
  else if (catalogoAberto) info = `${textoDePecas(pecas.length)} no orçamento · ${reais(resumo.subtotal)}`;
  else if (!pecas.length) { info = "Sem peças ainda"; infoMenor = "Adicione ao menos uma para enviar"; }
  else if (estado === "enviado") { info = `Total ${reais(resumo.total)}${resumo.pix ? ` · ${reais(resumo.pix)} no Pix` : ""}`; infoMenor = `Válido até ${dia(vence)}`; }
  else if (estado === "aprovado") { info = resumo.sinal ? `Pedido criado · sinal de ${reais(resumo.sinal)} a receber` : "Pedido criado"; }
  else {
    info = `${textoDePecas(pecas.length)} · ${textoDeUnidades(resumo.unidades)} · ${reais(resumo.total)}`;
    infoMenor = estado === "ajuste" ? `O reenvio vai como versão ${(Number(quote?.versao) || 1) + 1}` : erroCond || (sujo ? "Alterações ainda não salvas" : quote ? "Tudo salvo" : "");
  }
  const primaria = acoes.find((a) => TIPOS_PRIMARIOS.includes(a.tipo));
  const outras = acoes.filter((a) => a !== primaria);
  const botaoDaAcao = (a: AcaoDoRodape, flex?: boolean) => (
    <Botao
      key={a.id}
      tema={tema}
      tipo={a.tipo}
      rotulo={a.rotulo}
      icone={a.id === "enviar" ? "whatsapp" : a.id === "aprovar" || a.id === "converter" ? "check" : undefined}
      desabilitado={a.desabilitada || (!!ocupado && ocupado !== a.id)}
      ocupado={ocupado === a.id}
      onPress={() => acionar(a)}
      testID={"acao-" + a.id}
      flex={flex}
    />
  );

  // ── Corpo ───────────────────────────────────────────────────
  const colunaDasPecas = catalogoAberto && editavel ? (
    <CatalogoDoOrcamento
      tema={tema}
      produtos={catalogo.produtos}
      erro={catalogo.erro}
      frequentes={catalogo.frequentes}
      templates={catalogo.templates}
      noOrcamento={noOrcamento}
      onAdicionar={adicionarProduto}
      onAvulso={adicionarAvulso}
      onRecarregar={catalogo.recarregar}
    />
  ) : (
    <Secao
      tema={tema}
      testID="secao-pecas"
      titulo={<>Peças{pecas.length ? <Text style={{ color: t.ink }}> · {pecas.length}</Text> : null}</>}
      direita={editavel && pecas.length ? (
        <Botao tema={tema} tipo="sec" pequeno icone="plus" rotulo="Adicionar" onPress={() => setCatalogoAberto(true)} testID="adicionar" />
      ) : null}
    >
      {pecas.length === 0 ? (
        <View style={{ borderWidth: 2, borderStyle: "dashed", borderColor: t.ink5, borderRadius: 14, paddingVertical: 28, paddingHorizontal: 18, alignItems: "center", gap: 6, backgroundColor: t.paperCardElev }} testID="pecas-vazio">
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: t.primaryGhost, alignItems: "center", justifyContent: "center" }}>
            <Icon name="file_text" size={22} color={t.primary} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: t.ink }}>Nenhuma peça ainda</Text>
          <Text style={{ fontSize: 12.5, color: t.ink3, textAlign: "center", maxWidth: 320 }}>
            Escolha do catálogo ou adicione um item avulso. O modelo 3D vem junto com o produto.
          </Text>
          {editavel ? <View style={{ marginTop: 8 }}><Botao tema={tema} tipo="pri" icone="plus" rotulo="Escolher peças" onPress={() => setCatalogoAberto(true)} testID="escolher-pecas" /></View> : null}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {pecas.map((p) => (
            <LinhaDaPeca
              key={p.chave}
              tema={tema}
              cid={cid}
              peca={p}
              produto={p.product_id ? produtosPorId.get(p.product_id) || null : null}
              aberta={aberta === p.chave}
              editavel={editavel}
              templates={catalogo.templates}
              specs={catalogo.specs}
              onAlternar={() => setAberta((a) => (a === p.chave ? null : p.chave))}
              onMudar={(m) => mudarPeca(p.chave, m)}
              onTirar={() => { setPecas((antes) => antes.filter((x) => x.chave !== p.chave)); setAberta(null); setSujo(true); }}
            />
          ))}
        </View>
      )}
    </Secao>
  );

  const acompanhamento = quote && quote.sent_at && estado !== "rascunho" ? (
    <Secao tema={tema} titulo="Acompanhamento" testID="acompanhamento">
      <View style={{ gap: 8 }}>
        <LinhaDoTempo t={t} ok rotulo="Enviado" valor={`${dataHora(quote.sent_at)}${quote.canal_envio ? " · " + (CANAL_LEGIVEL[quote.canal_envio] || "pelo WhatsApp") : quote.token ? " · pelo link" : ""}`} />
        {quote.token ? <LinhaDoTempo t={t} ok={!!quote.viewed_at} rotulo="Cliente abriu" valor={quote.viewed_at ? dataHora(quote.viewed_at) : "ainda não abriu"} mudo={!quote.viewed_at} /> : null}
        <LinhaDoTempo
          t={t}
          ok={estado !== "enviado"}
          rotulo="Resposta"
          mudo={estado === "enviado"}
          valor={estado === "enviado" ? `aguardando · válido até ${dia(quote.expires_at)}`
            : estado === "ajuste" ? `Pediu ajuste · ${dataHora(quote.ajuste_pedido_em)}`
            : estado === "aprovado" ? `Aprovado${quote.responded_at ? " · " + dataHora(quote.responded_at) : ""}`
            : estado === "aceito" ? `Aceito · ${dataHora(quote.responded_at)}`
            : `${STATUS_LABEL[quote.status]}${quote.responded_at ? " · " + dataHora(quote.responded_at) : ""}`}
        />
      </View>
      {quote.token ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Botao tema={tema} tipo="sec" pequeno icone="copy" rotulo="Copiar link" onPress={() => copyText(`${APP_ORIGIN}/orcamento/${quote.token}`, "Link copiado!")} />
          <Botao tema={tema} tipo="sec" pequeno icone="external_link" rotulo="Abrir a página" onPress={() => Linking.openURL(`${APP_ORIGIN}/orcamento/${quote.token}`)} />
        </View>
      ) : null}
      {quote.response_note && estado !== "aprovado" ? <Nota t={t} rotulo="O cliente escreveu" texto={quote.response_note} /> : null}
      <CartaoDoVideo tema={tema} quote={quote} guardado={videoGuardado} onBaixar={baixarVideo} onManter={manterVideo} />
      {ajustes.map((a) => (
        <Nota key={a.id} t={t} rotulo={`Histórico · versão ${a.versao} · ${dataHora(a.created_at)}`} texto={a.texto} cor={t.warning} />
      ))}
    </Secao>
  ) : null;

  const videoDoRascunho = quote && !quote.sent_at && videoGuardado ? (
    <Secao tema={tema} titulo="Vídeo do orçamento" testID="video-rascunho">
      <CartaoDoVideo tema={tema} quote={quote} guardado onBaixar={baixarVideo} onManter={manterVideo} onRegravar={editavel ? enviar : undefined} />
    </Secao>
  ) : null;

  const colunaDireita = (
    <>
      {videoDoRascunho}
      {acompanhamento}
      <Secao tema={tema} titulo="Cliente" testID="secao-cliente">
        <Campo tema={tema} rotulo="Nome" value={nome} onChangeText={mudou(setNome)} editable={editavel} placeholder="Quem vai receber o orçamento" testID="cliente-nome" />
        <Campo tema={tema} rotulo="WhatsApp" value={zap} onChangeText={mudou(setZap)} editable={editavel} keyboardType="phone-pad" placeholder="(DDD) número" dica="É para este número que o orçamento vai." testID="cliente-zap" />
      </Secao>
      <Secao tema={tema} titulo="Condições" testID="secao-condicoes">
        <View style={{ gap: 6 }}>
          <Rotulo t={t}>Validade</Rotulo>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }} accessibilityRole={"group" as any} accessibilityLabel="Validade em dias">
            {chipsDeValidade(validade).map((d) => (
              <Chip key={d} tema={tema} rotulo={`${d} dias`} ligado={validade === d} desabilitado={!editavel} onPress={() => { setValidade(d); setSujo(true); }} testID={"validade-" + d} />
            ))}
          </View>
          <Dica t={t}>Vale até {dia(vence, true)}</Dica>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Campo tema={tema} rotulo="Sinal para começar (%)" value={sinalTxt} onChangeText={mudou(setSinalTxt)} editable={editavel} keyboardType="decimal-pad" placeholder="—" dica={resumo.sinal ? reais(resumo.sinal) : "vazio = sem sinal"} testID="sinal" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo tema={tema} rotulo="Desconto no Pix (%)" value={pixTxt} onChangeText={mudou(setPixTxt)} editable={editavel} keyboardType="decimal-pad" placeholder="—" dica={resumo.pix ? `${reais(resumo.pix)} no Pix` : "vazio = sem desconto"} testID="pix" />
          </View>
        </View>
        <Pressable
          onPress={() => setMaisCondicoes((v) => !v)}
          accessibilityRole="button"
          aria-expanded={maisCondicoes}
          testID="mais-condicoes"
          style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: estreito ? 44 : 36, alignSelf: "flex-start" }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: isDark ? t.primary2 : t.primary }}>Mais condições</Text>
          <View style={{ transform: [{ rotate: maisCondicoes ? "180deg" : "0deg" }] }}><Icon name="chevron_down" size={14} color={isDark ? t.primary2 : t.primary} /></View>
        </Pressable>
        {maisCondicoes ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Campo tema={tema} rotulo="Parcelas sem juros" value={parcelasTxt} onChangeText={mudou(setParcelasTxt)} editable={editavel} keyboardType="number-pad" placeholder="—" dica={resumo.parcela ? `${condicoes.parcelas}× de ${reais(resumo.parcela)}` : "vazio = não menciona cartão"} />
              </View>
              <View style={{ flex: 1 }}>
                <Campo tema={tema} rotulo="Prazo (dias úteis)" value={prazoTxt} onChangeText={mudou(setPrazoTxt)} editable={editavel} keyboardType="number-pad" placeholder="—" dica="depois de aprovar a arte" />
              </View>
            </View>
            <Campo tema={tema} rotulo="Observação (vai na mensagem)" value={obsTxt} onChangeText={mudou(setObsTxt)} editable={editavel} multiline maxLength={280} placeholder="Ex.: frete por conta do cliente" />
          </View>
        ) : null}
        {erroCond && editavel ? <Dica t={t} cor={t.dangerInk}>{erroCond}</Dica> : null}
        <Dica t={t}>Só vai na mensagem o que você preencher. Nada vem da configuração da loja.</Dica>
      </Secao>
      <Secao tema={tema} titulo="Resumo" testID="secao-resumo">
        <View style={{ gap: 8 }}>
          <LinhaDoResumo t={t} rotulo={`Subtotal${resumo.unidades ? " · " + textoDeUnidades(resumo.unidades) : ""}`} valor={reais(resumo.subtotal)} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 13.5, color: t.ink2 }}>Desconto (R$)</Text>
            {editavel ? (
              <View style={{ width: 110 }}>
                <Campo tema={tema} rotulo="Desconto em reais" value={descontoTxt} onChangeText={mudou(setDescontoTxt)} keyboardType="decimal-pad" placeholder="0,00" style={{ textAlign: "right" }} testID="desconto" />
              </View>
            ) : <Text style={{ fontSize: 13.5, color: t.ink }}>{desconto > 0 ? "− " + reais(desconto) : "—"}</Text>}
          </View>
          {resumo.sinal ? <LinhaDoResumo t={t} rotulo={`Sinal (${textoDe(sinalPct)} %)`} valor={reais(resumo.sinal)} /> : null}
          <View style={{ borderTopWidth: 1, borderTopColor: t.ink5, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: t.ink }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? t.primary2 : t.primary }} testID="total">{reais(resumo.total)}</Text>
          </View>
        </View>
      </Secao>
    </>
  );

  const escolherLoja = (
    <Secao tema={tema} titulo="Para qual loja é o orçamento?" testID="escolher-loja">
      <Dica t={t}>Você está vendo todas as lojas. O orçamento, o catálogo e o pedido ficam na loja escolhida.</Dica>
      {lojas.map((l) => (
        <Pressable
          key={l.id}
          onPress={() => setCid(l.id)}
          accessibilityRole="button"
          testID={"loja-" + l.id}
          style={{ minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Icon name="store" size={18} color={t.ink3} />
          <Text style={{ flex: 1, fontWeight: "700", color: t.ink }}>{l.name}</Text>
          <Icon name="chevron_right" size={16} color={t.ink3} />
        </Pressable>
      ))}
    </Secao>
  );

  let corpo: React.ReactNode;
  if (!cid) corpo = escolherLoja;
  else if (carregando) corpo = <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator color={t.primary} /></View>;
  else if (erroAoCarregar) {
    corpo = (
      <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
        <Icon name="alert_circle" size={26} color={t.danger} />
        <Text style={{ color: t.dangerInk, textAlign: "center" }}>{erroAoCarregar}</Text>
      </View>
    );
  } else {
    // No celular, com o catálogo aberto, o corpo inteiro é o catálogo.
    corpo = (
      <View style={{ flexDirection: estreito ? "column" : "row", gap: estreito ? 12 : 18, alignItems: "flex-start" }}>
        {/* 29/09 (vídeo em primeiro plano): as peças ganham mais largura — a peça aberta é o palco do vídeo. */}
        <View style={{ flex: estreito ? undefined : 1.6, width: estreito ? "100%" : undefined, minWidth: 0, gap: 14 }}>{colunaDasPecas}</View>
        {estreito && catalogoAberto ? null : (
          <View style={{ flex: estreito ? undefined : 1, width: estreito ? "100%" : undefined, minWidth: 0, gap: 14 }}>{colunaDireita}</View>
        )}
      </View>
    );
  }

  const aviso = !cid || carregando ? null
    : estado === "ajuste" ? { bg: t.warningSoft, fg: t.warningInk, icone: "edit", titulo: `O cliente pediu ajuste na versão ${Number(quote?.versao) || 1}`, texto: `${ajustes[0]?.texto ? `"${ajustes[0].texto}" ` : ""}O orçamento voltou a ser editável. O vídeo anterior fica guardado até você gravar outro.` }
    : estado === "aprovado" ? { bg: t.successSoft, fg: t.successInk, icone: "check_circle", titulo: "Este orçamento virou pedido", texto: "Peças, arte, modelo e condições foram para a Produção. Aqui nada mais muda." }
    : estado === "enviado" ? { bg: t.infoSoft, fg: t.infoInk, icone: "info", titulo: "Em aberto: quando o cliente topar pelo WhatsApp, toque em Aprovar.", texto: "Se pedir mudança, \"Cliente pediu ajuste\". Se não seguir, \"Fechar sem venda\"." }
    : quote?.status === "closed" ? { bg: t.bgSoft, fg: t.ink2, icone: "x_circle", titulo: "Orçamento fechado sem venda", texto: "" }
    : null;

  return (
    <View style={{ position: (Platform.OS === "web" ? "fixed" : "absolute") as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100, alignItems: "center", justifyContent: "center", padding: estreito ? 0 : 20 }} testID="orcamento-modal">
      <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? "rgba(2,6,23,0.7)" : "rgba(2,6,23,0.55)" }} onPress={pedirFechar} accessibilityLabel="Fechar" focusable={false} />
      <View
        accessibilityRole={"dialog" as any}
        aria-modal
        accessibilityLabel={titulo}
        style={{
          width: "100%", maxWidth: estreito ? undefined : 1160, height: estreito ? "100%" : undefined, maxHeight: estreito ? "100%" : "92%",
          backgroundColor: t.paperCardElev, borderRadius: estreito ? 0 : 18, borderWidth: estreito ? 0 : 1, borderColor: t.ink5,
          overflow: "hidden", flexDirection: "column",
          ...(Platform.OS === "web" && !estreito ? ({ boxShadow: isDark ? "0 24px 60px -18px rgba(0,0,0,0.8)" : "0 24px 60px -18px rgba(2,6,23,0.45)" } as any) : {}),
        }}
      >
        {/* Cabeçalho */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: estreito ? 14 : 20, paddingVertical: estreito ? 10 : 14, borderBottomWidth: 1, borderBottomColor: t.ink5 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="file_text" size={18} color={isDark ? t.primary2 : t.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }} numberOfLines={1} testID="titulo">{titulo}</Text>
              {cid ? (
                <View style={{ backgroundColor: selo.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }} testID="selo-status">
                  <Text style={{ fontSize: 11, fontWeight: "700", color: selo.fg }}>{selo.txt}</Text>
                </View>
              ) : null}
              {consolidado && loja ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }} testID="chip-loja">
                  <Icon name="store" size={11} color={t.ink2} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink2 }}>{loja.name}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 12.5, color: t.ink3, marginTop: 1 }} numberOfLines={2}>{subtitulo}</Text>
          </View>
          <Pressable
            onPress={pedirFechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            testID="fechar-modal"
            style={{ width: estreito ? 44 : 36, height: estreito ? 44 : 36, borderRadius: 10, borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCard, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="x" size={18} color={t.ink3} />
          </Pressable>
        </View>

        {aviso ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: estreito ? 14 : 20, paddingVertical: 10, backgroundColor: aviso.bg, borderBottomWidth: 1, borderBottomColor: t.ink5 }} testID="aviso" accessibilityRole={"status" as any}>
            <Icon name={aviso.icone as any} size={18} color={aviso.fg} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: aviso.fg }}>{aviso.titulo}</Text>
              {aviso.texto ? <Text style={{ fontSize: 12.5, color: aviso.fg, opacity: 0.9 }}>{aviso.texto}</Text> : null}
            </View>
          </View>
        ) : null}

        <ScrollView style={{ flexGrow: estreito ? 1 : 0, flexShrink: 1 }} contentContainerStyle={{ padding: estreito ? 12 : 16, paddingHorizontal: estreito ? 14 : 20, paddingBottom: estreito ? 20 : 16 }} keyboardShouldPersistTaps="handled">
          {corpo}
        </ScrollView>

        {/* Rodapé: um primário por estado */}
        <View
          style={{
            flexDirection: estreito ? "column" : "row", alignItems: estreito ? "stretch" : "center", gap: estreito ? 8 : 12,
            paddingHorizontal: estreito ? 14 : 20, paddingVertical: estreito ? 10 : 12, borderTopWidth: 1, borderTopColor: t.ink5, backgroundColor: t.paperCard,
          }}
          testID="rodape"
        >
          <View style={{ flex: estreito ? undefined : 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12.5, color: t.ink2, fontWeight: "600" }} numberOfLines={1} testID="rodape-info">{info}</Text>
            {infoMenor ? <Text style={{ fontSize: 12, color: erroCond && editavel && infoMenor === erroCond ? t.dangerInk : t.ink3 }} numberOfLines={1}>{infoMenor}</Text> : null}
          </View>
          {!cid ? (
            <Botao tema={tema} tipo="ter" rotulo="Cancelar" onPress={onClose} />
          ) : estreito ? (
            <View style={{ gap: 8 }} testID="rodape-acoes">
              {primaria ? botaoDaAcao(primaria) : null}
              {outras.length ? <View style={{ flexDirection: "row", gap: 8 }}>{outras.map((a) => botaoDaAcao(a, true))}</View> : null}
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }} testID="rodape-acoes">
              {outras.map((a) => botaoDaAcao(a))}
              {primaria ? botaoDaAcao(primaria) : null}
            </View>
          )}
        </View>

        {querSair || confirmacao ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(2,6,23,0.55)", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 20 }}>
            <View style={{ backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, borderRadius: 16, padding: 18, maxWidth: 380, width: "100%", gap: 8 }} accessibilityRole={"alertdialog" as any} testID={querSair ? "confirmar-saida" : "confirmacao"}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink }}>{querSair ? "Sair sem salvar?" : confirmacao!.titulo}</Text>
              <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19 }}>
                {querSair ? "Você mudou o orçamento. Se sair sem salvar, ele fica como estava." : confirmacao!.texto}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {querSair ? (
                  <>
                    <Botao tema={tema} tipo="perigo" rotulo="Descartar" onPress={() => { setQuerSair(false); onClose(); }} testID="descartar" />
                    <Botao
                      tema={tema}
                      tipo="pri"
                      rotulo="Salvar e sair"
                      ocupado={ocupado === "salvar"}
                      onPress={() => comOcupado("salvar", async () => { const q = await persistir(); setQuerSair(false); if (q) onClose(); })}
                      testID="salvar-e-sair"
                    />
                  </>
                ) : (
                  <>
                    <Botao tema={tema} tipo="ter" rotulo="Voltar" onPress={() => setConfirmacao(null)} />
                    <Botao
                      tema={tema}
                      tipo={confirmacao!.perigo ? "perigo" : "ok"}
                      rotulo={confirmacao!.rotulo}
                      ocupado={ocupado === "confirmar"}
                      onPress={() => comOcupado("confirmar", async () => {
                        try { await confirmacao!.acao(); setConfirmacao(null); } catch (e: any) { toast.error(erroDaApi(e, "Não deu certo. Tente de novo.")); }
                      })}
                      testID="confirmar"
                    />
                  </>
                )}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {quote && cid && videoAberto ? (
        <OrcamentoVideoModal
          visible={videoAberto}
          companyId={cid}
          quote={quote}
          items={pecas.map((p, i) => ({
            product_id: p.product_id, description: p.description, quantity: p.quantity, unit_price: p.unit_price,
            unit_cost: p.unit_cost, pricing_meta: p.pricing_meta, customization: p.customization,
            visual_template_key: p.visual_template_key, sort_order: i,
          }))}
          nomeDaLoja={loja?.name || ""}
          logoUrl={logoDaLoja ?? loja?.logo_url ?? null}
          onClose={() => setVideoAberto(false)}
          onAtualizou={(q, novos) => {
            setQuote((antes) => ({ ...(antes || {}), ...q } as StudioQuote));
            onMudou?.(q);
            if (novos) setPecas((antes) => antes.map((p, i) => ({ ...p, customization: novos[i]?.customization ?? p.customization })));
          }}
        />
      ) : null}

      {quote ? (
        <PedidoDeAjusteModal
          visible={ajusteAberto}
          t={t}
          versao={Number(quote.versao) || 1}
          onClose={() => setAjusteAberto(false)}
          onConfirmar={registrarAjuste}
        />
      ) : null}
    </View>
  );
}

function LinhaDoTempo({ t, ok, rotulo, valor, mudo }: { t: any; ok: boolean; rotulo: string; valor: string; mudo?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ok ? t.success : t.ink5 }} />
      <Text style={{ width: 104, fontSize: 12.5, color: t.ink2, fontWeight: "700" }}>{rotulo}</Text>
      <Text style={{ flex: 1, fontSize: 12.5, color: mudo ? t.ink3 : t.ink, fontStyle: mudo ? "italic" : "normal" }}>{valor}</Text>
    </View>
  );
}

function LinhaDoResumo({ t, rotulo, valor }: { t: any; rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <Text style={{ fontSize: 13.5, color: t.ink2, flexShrink: 1 }}>{rotulo}</Text>
      <Text style={{ fontSize: 13.5, color: t.ink2 }}>{valor}</Text>
    </View>
  );
}

function Nota({ t, rotulo, texto, cor }: { t: any; rotulo: string; texto: string; cor?: string }) {
  return (
    <View style={{ backgroundColor: t.bgSoft, borderLeftWidth: 3, borderLeftColor: cor || t.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
      <Text style={{ fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, color: t.ink3 }}>{rotulo}</Text>
      <Text style={{ fontSize: 13, color: t.ink }}>{texto}</Text>
    </View>
  );
}

function CartaoDoVideo({ tema, quote, guardado, onBaixar, onManter, onRegravar }: {
  tema: Tema; quote: StudioQuote; guardado: boolean; onBaixar: () => void; onManter: () => void; onRegravar?: () => void;
}) {
  const { t } = tema;
  if (!guardado) {
    return quote.canal_envio ? <Text style={{ fontSize: 12.5, color: t.ink3, fontStyle: "italic" }}>O vídeo não está mais guardado.</Text> : null;
  }
  const versao = rotuloDaVersao(quote.versao);
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: t.ink5, borderRadius: 12, padding: 10, backgroundColor: t.paperCardElev, flexWrap: "wrap" }} testID="cartao-video">
      <View style={{ width: 64, height: 80, borderRadius: 8, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" }}>
        <Icon name="camera" size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 140, gap: 2 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: t.ink }}>
          {quote.sent_at ? `Vídeo enviado${versao ? " · " + versao.toLowerCase() : ""}` : "Vídeo gravado"}
        </Text>
        <Text style={{ fontSize: 12, color: t.ink3 }}>Guardado até {dia(quote.video_expira_em)}</Text>
        {!quote.sent_at ? <Text style={{ fontSize: 12, color: t.ink3 }}>Ainda não foi enviado</Text> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Botao tema={tema} tipo="sec" pequeno icone="download" rotulo="Baixar" onPress={onBaixar} />
        <Botao tema={tema} tipo="sec" pequeno icone="clock" rotulo="Manter +30 dias" accessibilityLabel="Manter por mais 30 dias" onPress={onManter} testID="manter-video" />
        {onRegravar ? <Botao tema={tema} tipo="sec" pequeno icone="refresh" rotulo="Gravar de novo" onPress={onRegravar} /> : null}
      </View>
    </View>
  );
}

export default OrcamentoModal;
