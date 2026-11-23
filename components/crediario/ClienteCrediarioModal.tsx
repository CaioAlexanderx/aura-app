// ============================================================
// AURA. — Crediário · Modal de detalhe do cliente
//
// (decomposto em ficha/* em 11/06; este é o shell que mantém estado/queries
//  e compõe TabParcelas/TabHistorico/TabConta.)
//
// F3 do redesign (08/07/2026 — spec docs/crediario-redesign-spec.md §2.3):
//  - 5 abas → 3: Termos e Bloqueio viraram "Ajustes deste cliente"
//    (colapsado) dentro da aba Conta; some a 2ª linha de tabs.
//  - Header: EM ABERTO vira o HERÓI (22/800 colorido); Score e
//    Disponível viram suporte compacto ao lado.
//  - Entrada do sheet via ModalPop (scale 0.96→1 + fade).
//  - "Receber valor livre" saiu da TabParcelas: agora é o sheet
//    "Receber pagamento", aberto pelo CTA fixo no rodapé da ficha ou
//    por qualquer botão "Receber" (prefill). Gate 2-step âmbar migrou
//    para <ConfirmGate> (padrão único).
// Histórico anterior: C-2 (12/06) header fixo; A2-FE paid_at no preview;
// B3 valor livre + Pix EMV; Item 2 (16/06) renegociação; Item 4 ícone WhatsApp.
// ============================================================
import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import { isInstallmentOverdue, needsReview } from "@/utils/creditOverdue";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, ActivityIndicator, Clipboard, useWindowDimensions, Modal, Platform, KeyboardAvoidingView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import {
  creditApi,
  printReceipt,
  printCarne,
  MAX_INSTALLMENTS_CEILING,
  type CreditAccount, type CreditInstallment, type CustomerTermsOverrides,
  type CreditHistoryEvent, type PaymentPlan, type CreditPix,
} from "@/services/creditApi";
import { rescheduleApi } from "@/services/creditReschedule";
import { installmentLabel } from "@/utils/creditInstallmentLabel";
import QRCode from "react-native-qrcode-svg";
import { toast } from "@/components/Toast";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { ModalPop } from "@/components/anim";
import { ConfirmGate } from "@/components/ConfirmGate";
import {
  recebimentoRecente, mensagemDeRepeticao, novaChaveDeRecebimento, type UltimoRecebimento,
  pagamentoRepetidoDoErro, mensagemPagamentoRepetido, confirmarRepetidoNoEnvio, type PagamentoRepetido,
} from "@/utils/crediarioRecebimento";
import {
  fmt, fmtDate, todayBrSp, parseAmount, scoreColor,
  PAYMENT_METHODS, type Tab,
} from "./ficha/fichaHelpers";
import { m } from "./ficha/fichaStyles";
import { TabParcelas } from "./ficha/TabParcelas";
import { TabHistorico } from "./ficha/TabHistorico";
import { TabConta } from "./ficha/TabConta";
import { GrupoEmAberto } from "./ficha/GrupoEmAberto";
import { TelefoneDaFicha } from "./ficha/TelefoneDaFicha";
import { EditarClienteDaFicha } from "./ficha/EditarClienteDaFicha";
import { ImprimirCarnePanel } from "./ficha/ImprimirCarnePanel";
import { JuntarCarnesPanel } from "./ficha/JuntarCarnesPanel";
import { carregarVendaParaDevolucao } from "./ficha/vendaParaDevolucao";
import { DevolucaoModal, type DevolucaoSale } from "./DevolucaoModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  textoConfirmarExclusao, lerErroDaExclusao, mensagemDosRecebimentos, MENSAGEM_CARNE_DE_VENDA,
} from "@/utils/crediarioExcluirCarne";
import {
  organizarCarnes, carnesParaJuntar, CHAVE_SEM_CARNE, type ContaDoCarne, type EscopoCarne,
} from "@/utils/crediarioCarne";
import type { MergePlan } from "@/services/creditMerge";
import { lojasComSaldo, mensagemErroRecebimento } from "@/utils/creditoOutraLoja";
import { avisoDaFicha } from "@/utils/crediarioAvisoDaFicha";
import { corpoDasRegras, erroAoSalvarRegras } from "@/utils/crediarioRegrasDaCliente";
import { avisoPassaDoCarne, contaParaOValor, valorDeQuitar } from "@/utils/crediarioReceberCarne";
import { useTeclasDaFicha } from "./ficha/useTeclasDaFicha";
import { BotaoMais, ListaDoMenu, type ItemDoMenu } from "./ficha/MenuMais";
import { fatoFaltaPagar, fatoOQueVemAgora, fatoPodeComprarMais } from "@/utils/crediarioTresFatos";
import { diaEmSaoPaulo } from "@/utils/crediarioMovimentacao";

function translateStatus(status: string | null | undefined): string {
  if (!status) return "";
  if (status === "paid") return "Quitada";
  if (status === "partial") return "Parcial";
  if (status === "overdue") return "Em atraso";
  if (status === "pending") return "Em aberto";
  if (status === "cancelled") return "Cancelada";
  return status;
}

/** Toque no fundo escurecido enquanto um painel interno está aberto: nada. */
const ignorarToqueNoFundo = () => {};

type Props = {
  visible: boolean;
  companyId: string;
  customerId: string | null;
  customerName?: string | null;
  /** Chave Pix que o QR do carnê usa (canal digital — NÃO a da régua de
   *  cobrança). undefined = carregando ou leitura falhou (não acusa falta). */
  pixKey?: string | null;
  storeName?: string | null;
  onClose: () => void;
  /** Leva aonde a chave Pix do QR é cadastrada (Canal Digital → Meu Site). */
  onOpenSettings?: () => void;
  onCobrar?: (customerId: string, customerName: string, phone: string | null, carne?: { id: string | null }) => void;
  onChanged?: () => void;
  /** Lojas do grupo que este usuário pode abrir (faixa "também deve na..."). */
  accessibleCompanyIds?: string[];
  /** Troca para outra loja do grupo e reabre esta ficha lá. */
  onOpenInCompany?: (companyId: string, customerId: string) => void;
  switchingCompany?: boolean;
  /** F3 (23/11/2026): "tela" = a ficha ocupa a área de conteúdo, como o
   *  Caixa (tela larga e média); "janela" = o modal de sempre (celular). */
  casca?: "janela" | "tela" | "pagina";
  /** F3: "larga" põe a lista das clientes à esquerda; "media" troca a lista
   *  pela barra "‹ Crediário · ‹ 3 de 38 › · Trocar cliente". */
  layout?: "media" | "larga";
  /** F3: a carteira estreita (ListaDaFicha), montada pela página. */
  listaLateral?: ReactNode;
  /** F3: posição da cliente na lista e a troca (↑ ↓ e ‹ ›). */
  navegacao?: { posicao: number; total: number; onAnterior?: () => void; onProxima?: () => void };
  /** F3 (revisão): a ficha veio do ?cliente= do endereço (recarga, troca de
   *  loja). Cliente de outra loja sem nada nesta fecha a ficha. */
  abertaPeloEndereco?: boolean;
};

export function ClienteCrediarioModal({
  visible, companyId, customerId, customerName, pixKey, storeName,
  onClose, onCobrar, onChanged, onOpenSettings,
  accessibleCompanyIds, onOpenInCompany, switchingCompany,
  casca = "janela", layout = "larga", listaLateral, navegacao, abertaPeloEndereco = false,
}: Props) {
  const qc = useQueryClient();
  // QA 23/11 (P1-5): depois de receber, remover ou corrigir pagamento,
  // juntar, mudar as parcelas ou a data, TUDO o que mostra dinheiro desta
  // cliente recarrega — a ficha, o perfil, a carteira (a lista ao lado, que
  // fica escondida atrás da ficha: refetchType "all") e os indicadores.
  // Antes cada ação invalidava uma parte, e "Falta pagar", o carnê e a lista
  // ficavam com os números antigos.
  function atualizarFicha(cliente: string | null | undefined = customerId) {
    const todas = { refetchType: "all" as const };
    if (cliente) {
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, cliente], ...todas });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, cliente], ...todas });
    }
    qc.invalidateQueries({ queryKey: ["credit-balances", companyId], ...todas });
    qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId], ...todas });
    qc.invalidateQueries({ queryKey: ["credit-aging", companyId], ...todas });
    onChanged?.();
  }
  // F3 (23/11/2026): na tela cheia o Histórico vira a coluna da direita
  // (sempre à vista) e os painéis abrem nela; o centro fica com as parcelas.
  const emTela = casca === "tela";
  // F5 (23/11/2026): no celular a ficha é página inteira (era folha de 94%).
  const emPagina = casca === "pagina";
  // Rótulo da 1ª aba: "Compras e parcelas" não cabe em três abas de celular.
  const { width: larguraDaTela } = useWindowDimensions();

  const [tab, setTab] = useState<Tab>("parcelas");

  const [expandedAccountId, setExpandedAccountId] = useState<string | null | undefined>(undefined);

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [blockReason, setBlockReason] = useState("");
  const [blockingAction, setBlockingAction] = useState<"block" | "unblock" | null>(null);

  const [termsMaxInst, setTermsMaxInst] = useState("");
  const [termsInterest, setTermsInterest] = useState("");
  const [termsDirty, setTermsDirty] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  // QA 23/11: o erro ao salvar as regras fica na tela (o toast sumia).
  const [erroTermos, setErroTermos] = useState<string | null>(null);

  const [editingDueDateInst, setEditingDueDateInst] = useState<CreditInstallment | null>(null);
  const [editDueDateInput, setEditDueDateInput] = useState("");
  const [editDueDateError, setEditDueDateError] = useState("");

  // ── Item 2 (16/06): renegociacao de parcelas ─────────────────────────
  const [renegScope, setRenegScope] = useState<{ accountId: string | null | undefined; label: string; openRemaining: number } | null>(null);
  const [renegTotal, setRenegTotal] = useState("");
  const [renegCount, setRenegCount] = useState(1);
  const [renegPerParcel, setRenegPerParcel] = useState("");
  const [renegFirstDue, setRenegFirstDue] = useState("");

  const [renegSubmitting, setRenegSubmitting] = useState(false);

  // ── 10/10/2026: escolha do formato ao imprimir (A4 ou bobina) ─────────
  // accountId: string = aquele carnê; null = grupo sem carnê; undefined = todos.
  const [printScope, setPrintScope] = useState<{ accountId: EscopoCarne; label: string; parcelas: number } | null>(null);

  // ── 10/10/2026: juntar carnês. null = fechado; array = chaves já marcadas
  // ao abrir (vazio pelo link do cabeçalho; o carnê de origem pelo Renegociar).
  const [juntarPre, setJuntarPre] = useState<string[] | null>(null);

  // ── 09/11/2026: excluir carnê. alvo = diálogo de confirmação aberto;
  // recusa = o backend disse não (recebimento ou venda) e a tela explica.
  const [excluirAlvo, setExcluirAlvo] = useState<{ id: string; nome: string; falta: number } | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [recusaExclusao, setRecusaExclusao] = useState<
    | { tipo: "recebimentos"; mensagem: string }
    | { tipo: "venda"; saleId: string }
    | null
  >(null);
  const [abrindoDevolucao, setAbrindoDevolucao] = useState(false);
  const [devolucaoVenda, setDevolucaoVenda] = useState<DevolucaoSale | null>(null);

  // 23/11/2026 (F2): "Editar cliente" por cima da ficha. foco = abrir no telefone.
  const [editarCliente, setEditarCliente] = useState<{ foco: boolean } | null>(null);
  // F3: "Limite e regras" (a aba Conta) abre como painel na coluna da direita
  // da tela cheia; "Trocar cliente" abre a lista por cima na tela média.
  const [limiteAberto, setLimiteAberto] = useState(false);
  const [trocarAberto, setTrocarAberto] = useState(false);
  // F4: o "⋯" do alto da ficha.
  const [menuFicha, setMenuFicha] = useState(false);
  // QA 23/11 (P1-7): o menu do telefone (celular) entra na pilha do Esc.
  const [menuTelefone, setMenuTelefone] = useState(false);
  // Resposta do Histórico que chega depois de trocar de cliente (setas) não
  // pode pintar a ficha da cliente nova.
  const clienteAtualRef = useRef<string | null>(customerId);
  clienteAtualRef.current = customerId;

  const [histEvents, setHistEvents] = useState<CreditHistoryEvent[]>([]);
  const [histCursor, setHistCursor] = useState<string | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histLoaded, setHistLoaded] = useState(false);

  // ── B3 → F3: sheet "Receber pagamento" (antes card fixo na TabParcelas) ──
  const [receberOpen, setReceberOpen] = useState(false);
  const [receberGate, setReceberGate] = useState(false);
  const [freeAmt, setFreeAmt] = useState("");
  const [freeMethod, setFreeMethod] = useState("dinheiro");
  const [freeDateBr, setFreeDateBr] = useState(todayBrSp());
  const [freeAccountId, setFreeAccountId] = useState<string | null | undefined>(undefined);
  const [freePreview, setFreePreview] = useState<PaymentPlan | null>(null);
  const [freePreviewLoading, setFreePreviewLoading] = useState(false);
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  // 15/09/2026: depois de receber, o painel mostra o que foi pago e oferece o
  // recibo na hora. Antes fechava com um toast e o recibo só existia no Histórico.
  const [receiptResult, setReceiptResult] = useState<{
    transactionId: string | null;
    amount: number;
    method: string;
    applied: PaymentPlan["applied"];
  } | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 07/10/2026 (recebimentos em dobro): o último recebimento feito NESTA ficha
  // sobrevive ao "Concluir" — a ficha leva alguns segundos para recarregar o
  // razão, e é nesse intervalo que o segundo Confirmar acontecia. Alimenta o
  // aviso do gate (utils/crediarioRecebimento).
  const [ultimoRecebimento, setUltimoRecebimento] = useState<UltimoRecebimento | null>(null);
  // Chave de idempotência do recebimento: uma por pedido, descartada só no
  // sucesso ou quando valor/forma/data mudam. Antes era gerada a cada chamada.
  const freeKeyRef = useRef<string | null>(null);
  // 23/11/2026 (Looks Da Jenny): o backend achou pagamento igual (mesmo valor,
  // mesma data de pagamento) e não gravou. A pergunta fica no rodapé até a
  // lojista decidir; "Lançar mesmo assim" reenvia com confirmar_repetido.
  const [repetidoServidor, setRepetidoServidor] = useState<PagamentoRepetido | null>(null);
  // Chave de idempotência da renegociação: gerada uma vez por sessão de
  // submissão e SÓ descartada no sucesso (ou ao fechar o painel). É isso que
  // permite o backend deduplicar o retry em vez de cancelar e recriar o carnê
  // outra vez — antes a chave era gerada a cada chamada e não valia nada.
  const renegKeyRef = useRef<string | null>(null);
  // Qualquer edição no plano começa uma sessão nova: a chave antiga replicaria
  // o cronograma ANTERIOR (o backend devolveria o recibo daquele pedido).
  // Retry do mesmo formulário, sem mexer em nada, mantém a chave — que é
  // exatamente o caso que precisa deduplicar.
  useEffect(() => {
    renegKeyRef.current = null;
  }, [renegScope?.accountId, renegTotal, renegCount, renegFirstDue]);

  // Qualquer mudança em valor/método/data reseta o gate (mesma regra do 2-step antigo)
  // e descarta a chave de idempotência: é outro pedido.
  useEffect(() => { setReceberGate(false); freeKeyRef.current = null; }, [freeAmt, freeMethod, freeDateBr, freeAccountId]);
  useEffect(() => { setRepetidoServidor(null); }, [freeAmt, freeMethod, freeDateBr, freeAccountId]);
  useEffect(() => { setUltimoRecebimento(null); setRepetidoServidor(null); freeKeyRef.current = null; }, [visible, customerId]);
  useEffect(() => { if (!receberOpen) { setReceiptResult(null); setRepetidoServidor(null); } }, [receberOpen]);
  useEffect(() => { setReceiptResult(null); }, [customerId]);

  // ── B2: Pix overlay — compartilhado entre parcela e valor livre ────────
  const [pixInstId, setPixInstId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<CreditPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const pixOverlayTitle = pixInstId === "free" ? "Pix · Valor Livre" : "Pix da Parcela";

  const profileQ = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCustomerProfile(companyId, customerId!),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 15_000,
  });

  // QA 23/11: o "(regra da loja)" mostra o valor da LOJA (plan-config), não
  // o que vale para a cliente. Mesma chave da tela de configurações.
  const regraDaLojaQ = useQuery({
    queryKey: ["credit-plan-config", companyId],
    queryFn: () => creditApi.getPlanConfig(companyId),
    enabled: visible && !!companyId,
    staleTime: 5 * 60_000,
  });

  const detailQ = useQuery({
    queryKey: ["credit-customer", companyId, customerId],
    queryFn: () => creditApi.getCustomerHistory(companyId, customerId!),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (visible) {
      setShowNewAccount(false);
      setNewAccountName("");
      setTab("parcelas");
      setBlockReason("");
      setBlockingAction(null);
      setTermsMaxInst("");
      setTermsInterest("");
      setTermsDirty(false);
      setExpandedAccountId(undefined);
      setEditingDueDateInst(null);
      setEditDueDateInput("");
      setEditDueDateError("");
      setRenegScope(null);
      setRenegSubmitting(false);
      setPrintScope(null);
      setJuntarPre(null);
      setHistEvents([]);
      setHistCursor(null);
      setHistLoaded(false);
      setReceberOpen(false);
      setReceberGate(false);
      setFreeAmt("");
      setFreeMethod("dinheiro");
      setFreeDateBr(todayBrSp());
      setFreeAccountId(undefined);
      setFreePreview(null);
      setPixInstId(null);
      setPixData(null);
      setEditarCliente(null);
      setLimiteAberto(false);
      setTrocarAberto(false);
      setMenuFicha(false);
      setMenuTelefone(false);
      // F3 (revisão): diálogo de excluir, envio e recibo são da cliente
      // anterior — confirmar depois da troca excluiria o carnê dela na ficha
      // da cliente nova.
      setExcluirAlvo(null);
      setRecusaExclusao(null);
      setFreeSubmitting(false);
      setRenegSubmitting(false);
      setReceiptResult(null);
      setHistLoading(false);
    }
  }, [visible, customerId]);

  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    const ov = p.terms?.overrides;
    if (ov) {
      setTermsMaxInst(ov.max_installments != null ? String(ov.max_installments) : "");
      setTermsInterest(ov.interest_rate != null ? String(+(ov.interest_rate * 100).toFixed(4)).replace(".", ",") : "");
    }
  }, [profileQ.data]);

  const detail = detailQ.data;
  const profile = profileQ.data;
  const accounts: CreditAccount[] = detail?.accounts || [];
  const hasAccounts = accounts.length > 0;
  const balance = detail?.balance ?? 0;

  const totalBalance = hasAccounts
    ? accounts.reduce((s, a) => s + (a.balance || 0), 0)
    : balance;
  const overdueAccounts = accounts.filter(a => a.overdue);

  const openInst = useMemo(
    () => (detail?.open_installments || profile?.open_installments || []).slice()
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [detail, profile],
  );

  const instByAccount = useMemo(() => {
    const map = new Map<string | null, typeof openInst>();
    for (const inst of openInst) {
      const key = inst.account_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inst);
    }
    return map;
  }, [openInst]);

  // Regra ÚNICA de atraso. ANTES: `i.status === "overdue"` — status persistido,
  // só sincronizado quando alguém abre o dashboard/lista de parcelas. Resultado:
  // ficha da livia aline (Valen, 18/08/2026) com pill vermelha "Em atraso" e os
  // DOIS carnês verdes "Em dia" — 23 parcelas vencendo em 2027 ainda estavam
  // marcadas overdue. Agora usa is_overdue (data + carência + resíduo, sem
  // parcela retroativa), com fallback local para backend antigo.
  const hasOverdue = overdueAccounts.length > 0 || openInst.some(i => isInstallmentOverdue(i));
  // 08/10/2026 (Valen): parcela aberta sem dívida no razão (débito apagado).
  // O backend já não classifica como atraso; aqui o topo diz "Conferir" em
  // vez de "Em dia" e mostra as duas contas que não batem.
  const semSaldoNoRazao = !hasOverdue && detail?.ledger_mismatch === true && balance <= 0.009;
  const corStatus = hasOverdue ? Colors.red : semSaldoNoRazao ? Colors.amber : Colors.green;
  /** Parcelas retroativas: carnê histórico a conferir — não é inadimplência. */
  const toReviewCount = openInst.filter(i => needsReview(i)).length;

  const realCarnes = accounts.filter(a => a && a.id != null);
  const useCarneLayout = realCarnes.length > 0;
  // Chips de carnê do "Receber pagamento": quitados ficam de fora.
  const carnesParaReceber = realCarnes.filter(a => (a.remaining ?? a.balance) > 0.009 || a.id === freeAccountId);
  // QA 23/11 (P1-4): o que falta em cada carnê, para o "Quitar" e para o
  // valor que passa do carnê (utils/crediarioReceberCarne).
  const faltaDoCarneRef = useRef<(id: string | null | undefined) => number | null>(() => null);
  faltaDoCarneRef.current = (id) => {
    if (!id) return null;
    const a = accounts.find(x => x.id === id);
    return a ? Number(a.remaining ?? a.balance ?? 0) : null;
  };

  const nextDueDate = openInst.length > 0
    ? openInst.reduce((best, i) => {
        const d = new Date(i.due_date).getTime();
        return (!best || d < new Date(best).getTime()) ? i.due_date : best;
      }, "" as string)
    : "";

  // Carnês que podem entrar numa junção (em aberto, com saldo). Com menos de
  // dois não há o que juntar: as entradas somem.
  const carnesJuntaveis = useMemo(
    () => carnesParaJuntar(organizarCarnes<CreditInstallment>(accounts as ContaDoCarne[], openInst, isInstallmentOverdue).abertos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail?.accounts, openInst],
  );
  const podeJuntar = carnesJuntaveis.length >= 2;
  // F4: "N compras em aberto" no primeiro fato.
  const carnesAbertos = useMemo(
    () => organizarCarnes<CreditInstallment>(accounts as ContaDoCarne[], openInst, isInstallmentOverdue).abertos,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail?.accounts, openInst],
  );

  const isBlocked = profile?.status === "blocked";

  const blockMut = useMutation({
    mutationFn: ({ action, reason }: { action: "block" | "unblock"; reason?: string }) =>
      creditApi.blockCustomer(companyId, customerId!, action, reason),
    onSuccess: () => {
      toast.success(isBlocked ? "Cliente desbloqueado" : "Cliente bloqueado");
      setBlockReason("");
      setBlockingAction(null);
      atualizarFicha();
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao alterar bloqueio"),
  });

  function handleBlockToggle() {
    if (isBlocked) {
      blockMut.mutate({ action: "unblock" });
    } else {
      setBlockingAction("block");
    }
  }

  function confirmBlock() {
    blockMut.mutate({ action: "block", reason: blockReason.trim() || undefined });
  }

  async function saveTerms() {
    setSavingTerms(true);
    setErroTermos(null);
    try {
      // QA 23/11: os dois campos vão sempre; em branco = null = regra da
      // loja (utils/crediarioRegrasDaCliente). Antes, em branco mandava o
      // corpo null (400) e um campo só deixava o outro preso.
      const body: Partial<CustomerTermsOverrides> = corpoDasRegras(termsMaxInst, termsInterest);
      await creditApi.updateCustomerTerms(companyId, customerId!, body);
      toast.success("Regras salvas.");
      setTermsDirty(false);
      atualizarFicha();
    } catch (err: any) {
      setErroTermos(erroAoSalvarRegras(err));
    } finally {
      setSavingTerms(false);
    }
  }

  // prefill: abre o sheet "Receber pagamento" com o valor e dispara preview (F3)
  function prefill(v: number) {
    const str = v.toFixed(2).replace(".", ",");
    setFreeAmt(str);
    setReceberOpen(true);
    triggerPreview(str, freeAccountId);
  }

  // 10/10/2026 (carnês por compra): "Receber" que vem da aba de carnês.
  // Com accountId o recebimento mira AQUELE carnê — "Receber R$ 140,00" do
  // cartão não pode cair na parcela mais antiga de outro. Sem accountId
  // (parcela avulsa, grupo sem carnê) volta para "Todos", a regra de sempre.
  // Separado do prefill porque os atalhos de valor do painel (R$ 50/100/200)
  // usam o prefill e não podem desfazer o carnê escolhido nos chips.
  function receberDaAba(v: number, accountId?: string) {
    fecharAoAbrirPainel();
    const str = v.toFixed(2).replace(".", ",");
    setFreeAccountId(accountId);
    setFreeAmt(str);
    setReceberOpen(true);
    triggerPreview(str, accountId);
  }

  async function handleCreateAccount() {
    if (!newAccountName.trim()) { toast.error("Nome do carnê é obrigatório"); return; }
    setCreatingAccount(true);
    try {
      await creditApi.createAccount(companyId, customerId!, { name: newAccountName.trim() });
      toast.success("Carnê criado!");
      setShowNewAccount(false);
      setNewAccountName("");
      atualizarFicha();
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao criar carnê");
    } finally {
      setCreatingAccount(false);
    }
  }

  const editDueDateMut = useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string; cliente: string | null }) =>
      creditApi.editInstallmentDueDate(companyId, id, dueDate),
    onSuccess: (_res, vars) => {
      // A cliente mudou durante o envio: atualiza a ficha dela e não mexe na tela.
      if (vars.cliente !== clienteAtualRef.current) {
        atualizarFicha(vars.cliente);
        toast.success("Vencimento atualizado!");
        return;
      }
      setEditingDueDateInst(null);
      setEditDueDateInput("");
      setEditDueDateError("");
      toast.success("Vencimento atualizado!");
      atualizarFicha();
      // Movimentações recarrega ao abrir a aba (o "Atualizar" saiu na F1).
      setHistLoaded(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao alterar vencimento"),
  });

  function handleEditDueDateOpen(inst: CreditInstallment) {
    fecharAoAbrirPainel();
    setEditingDueDateInst(inst);
    setEditDueDateInput(formatIsoToBr(inst.due_date));
    setEditDueDateError("");
  }

  function handleEditDueDateConfirm() {
    const iso = parseBrDate(editDueDateInput);
    if (!iso) { setEditDueDateError("Data inválida"); return; }
    if (!editingDueDateInst) return;
    editDueDateMut.mutate({ id: editingDueDateInst.id, dueDate: iso, cliente: customerId });
  }

  // ── Item 2 (16/06): renegociacao de parcelas ─────────────────────────
  function openRenegociar(accountId: string | null | undefined, label: string, openRemaining: number) {
    fecharAoAbrirPainel();
    const scopeInst = (accountId === null || accountId === undefined)
      ? (useCarneLayout ? (instByAccount.get(null) || []) : openInst)
      : (instByAccount.get(accountId) || []);
    const count = Math.max(1, Math.min(MAX_INSTALLMENTS_CEILING, scopeInst.length || 1));
    setRenegScope({ accountId, label, openRemaining });
    setRenegTotal(openRemaining > 0 ? openRemaining.toFixed(2).replace(".", ",") : "");
    setRenegCount(count);
    setRenegPerParcel((openRemaining / count).toFixed(2).replace(".", ","));
    const firstIso = scopeInst.length
      ? scopeInst.reduce((best, i) => (!best || new Date(i.due_date) < new Date(best) ? i.due_date : best), "" as string)
      : "";
    setRenegFirstDue(firstIso ? formatIsoToBr(firstIso) : todayBrSp());
  }

  function setRenegCountSafe(n: number) {
    const c = Math.max(1, Math.min(MAX_INSTALLMENTS_CEILING, n));
    setRenegCount(c);
    const total = parseAmount(renegTotal);
    setRenegPerParcel((total / c).toFixed(2).replace(".", ","));
  }
  function onRenegTotalChange(v: string) {
    const clean = v.replace(/[^\d,.]/g, "");
    setRenegTotal(clean);
    const total = parseAmount(clean);
    setRenegPerParcel((total / Math.max(1, renegCount)).toFixed(2).replace(".", ","));
  }
  function onRenegPerParcelChange(v: string) {
    const clean = v.replace(/[^\d,.]/g, "");
    setRenegPerParcel(clean);
    const per = parseAmount(clean);
    const total = parseAmount(renegTotal);
    if (per > 0 && total > 0) {
      setRenegCount(Math.max(1, Math.min(MAX_INSTALLMENTS_CEILING, Math.round(total / per))));
    }
  }

  async function confirmRenegociar() {
    if (!renegScope || !customerId) return;
    const total = parseAmount(renegTotal);
    if (total <= 0) { toast.error("Informe um total maior que zero"); return; }
    if (renegCount < 1) { toast.error("Número de parcelas inválido"); return; }
    const iso = parseBrDate(renegFirstDue);
    if (!iso) { toast.error("Data da 1ª parcela inválida"); return; }
    if (!renegKeyRef.current) {
      renegKeyRef.current = "resched-" + companyId + "-" + customerId + "-"
        + (renegScope.accountId || "general") + "-" + Date.now()
        + "-" + Math.random().toString(36).slice(2, 8);
    }
    setRenegSubmitting(true);
    const pedidoDe = customerId;
    try {
      const res = await rescheduleApi.apply(companyId, customerId, renegScope.accountId, {
        total,
        installments: renegCount,
        first_due_date: iso,
      }, renegKeyRef.current);
      if (clienteAtualRef.current !== pedidoDe) { atualizarDaCliente(pedidoDe); toast.success("Parcelas mudadas."); return; }
      const adj = res.adjustment;
      toast.success(
        res.replayed
          ? `Esta renegociação já tinha sido aplicada — ${res.installments_count}x.`
          : adj?.type === "discount"
            ? `Renegociado! Desconto de ${fmt(adj.amount)} no saldo.`
            : adj?.type === "surcharge"
              ? `Renegociado! Acréscimo de ${fmt(adj.amount)} no saldo.`
              : `Parcelas renegociadas em ${res.installments_count}x.`
      );
      renegKeyRef.current = null;
      setRenegScope(null);
      atualizarFicha();
      // Movimentações recarrega ao abrir a aba (o "Atualizar" saiu na F1).
      setHistLoaded(false);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não foi possível renegociar. Tente novamente.");
    } finally {
      if (clienteAtualRef.current === pedidoDe) setRenegSubmitting(false);
    }
  }

  async function loadHistory(cursor?: string | null) {
    if (!companyId || !customerId) return;
    setHistLoading(true);
    const pedidoDe = customerId;
    try {
      const res = await creditApi.getHistoryTimeline(companyId, customerId, {
        limit: 20,
        cursor: cursor ?? undefined,
      });
      if (clienteAtualRef.current !== pedidoDe) return;
      if (cursor) {
        setHistEvents(prev => [...prev, ...res.events]);
      } else {
        setHistEvents(res.events);
      }
      setHistCursor(res.next_cursor ?? null);
      setHistLoaded(true);
    } catch {
    } finally {
      // O pedido de outra cliente não mexe no "carregando" da cliente nova.
      if (clienteAtualRef.current === pedidoDe) setHistLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "historico" && !histLoaded && visible && !!customerId) {
      loadHistory();
    } else if (emTela && !histLoaded && visible && !!customerId) {
      // Tela cheia: as Movimentações estão sempre à vista na direita.
      loadHistory();
    }
  }, [tab, histLoaded, visible, customerId, emTela]);

  const triggerPreview = useCallback((amtStr: string, accountId?: string | null) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const amt = parseAmount(amtStr);
    if (amt <= 0) { setFreePreview(null); return; }
    previewTimerRef.current = setTimeout(async () => {
      setFreePreviewLoading(true);
      try {
        const plan = await creditApi.previewPayment(companyId, customerId!, {
          amount: amt,
          // Acima do que falta no carnê, a prévia é de "todas as compras" —
          // a mesma conta que o envio faz (P1-4).
          account_id: contaParaOValor(accountId, amt, faltaDoCarneRef.current(accountId)),
          paid_at: parseBrDate(freeDateBr) || undefined,
        });
        setFreePreview(plan);
      } catch {
        setFreePreview(null);
      } finally {
        setFreePreviewLoading(false);
      }
    }, 500);
  }, [companyId, customerId, freeDateBr]);

  useEffect(() => {
    if (parseAmount(freeAmt) > 0) triggerPreview(freeAmt, freeAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeDateBr]);

  async function confirmFreePayment(confirmarRepetido = false) {
    const amt = parseAmount(freeAmt);
    if (amt <= 0) { toast.error("Informe um valor maior que zero"); return; }
    const paidAt = parseBrDate(freeDateBr) || undefined;
    setFreeSubmitting(true);
    const pedidoDe = customerId;
    // A chave sobrevive a um erro: o retry do MESMO pedido é replay no backend.
    if (!freeKeyRef.current) freeKeyRef.current = novaChaveDeRecebimento(companyId, customerId!);
    try {
      const res = await creditApi.receiveFreePayment(companyId, customerId!, {
        amount: amt,
        account_id: contaParaOValor(freeAccountId, amt, faltaDoCarneRef.current(freeAccountId)),
        method: freeMethod,
        paid_at: paidAt,
        ...(confirmarRepetido ? { confirmar_repetido: true } : {}),
      }, freeKeyRef.current);
      // F3 (revisão): a cliente mudou durante o envio (troca é travada, mas
      // por garantia) — o recebimento entrou na ficha DELA; a tela não muda.
      if (clienteAtualRef.current !== pedidoDe) { atualizarDaCliente(pedidoDe); toast.success("Recebido!"); return; }
      freeKeyRef.current = null;
      setUltimoRecebimento({ amount: amt, method: freeMethod, at: new Date().toISOString() });
      setRepetidoServidor(null);
      toast.success(
        res.credit_generated > 0
          ? `Recebido! Crédito gerado: ${fmt(res.credit_generated)}`
          : `Recebido! Novo saldo: ${fmt(res.new_balance)}`
      );
      setReceiptResult({
        transactionId: res.transaction_id ?? null,
        amount: amt,
        method: methodLabel,
        applied: res.applied || [],
      });
      setFreeAmt("");
      setFreePreview(null);
      setFreeDateBr(todayBrSp());
      setReceberGate(false);
      atualizarFicha();
      // Movimentações recarrega ao abrir a aba (o "Atualizar" saiu na F1):
      // antes o recebimento só aparecia reabrindo a ficha.
      setHistLoaded(false);
    } catch (err: any) {
      // Pagamento igual já gravado: nada entrou; a chave segue a mesma para o
      // "Lançar mesmo assim" (é o mesmo pedido).
      if (clienteAtualRef.current !== pedidoDe) { toast.error(mensagemErroRecebimento(err)); return; }
      const rep = pagamentoRepetidoDoErro(err);
      if (rep) { setRepetidoServidor(rep); return; }
      console.error("[crediário] confirmFreePayment error:", err);
      // 16/09/2026: a mensagem genérica "Confira os dados" não dizia o que
      // conferir (Davi / Mary Lucy). Cada causa conhecida diz o que fazer.
      toast.error(mensagemErroRecebimento(err));
    } finally {
      if (clienteAtualRef.current === pedidoDe) setFreeSubmitting(false);
    }
  }

  async function handlePrintReceiptNow() {
    if (!receiptResult?.transactionId) return;
    setPrintingReceipt(true);
    try {
      await printReceipt(companyId, receiptResult.transactionId);
    } catch (err) {
      console.error("[crediário] printReceipt error:", err);
      toast.error("Não foi possível abrir o recibo. Tente novamente.");
    } finally {
      setPrintingReceipt(false);
    }
  }

  // ── Helper: detecta chave Pix ausente (422 PIX_KEY_MISSING) ───────────
  function isPixKeyMissing(err: any): boolean {
    return (
      err?.status === 422 ||
      err?.data?.code === "PIX_KEY_MISSING" ||
      String(err?.data?.error || "").includes("PIX_KEY_MISSING")
    );
  }

  async function openInstallmentPix(installmentId: string) {
    fecharAoAbrirPainel();
    setPixInstId(installmentId);
    setPixData(null);
    setPixLoading(true);
    try {
      const res = await creditApi.getInstallmentPix(companyId, installmentId);
      setPixData(res);
    } catch (err: any) {
      setPixInstId(null);
      if (isPixKeyMissing(err)) {
        toast.error("Cadastre sua chave Pix em Configurações → PDV para gerar cobranças por Pix.");
      } else {
        console.error("[crediário] openInstallmentPix error:", err);
        toast.error("Não foi possível gerar o Pix. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setPixLoading(false);
    }
  }

  // ── B3: Pix para recebimento de valor livre ───────────────────────────
  async function openFreePix(amount: number) {
    if (!customerId) return;
    setPixInstId("free");
    setPixData(null);
    setPixLoading(true);
    try {
      const res = await creditApi.getFreePix(companyId, customerId, amount);
      setPixData(res);
    } catch (err: any) {
      setPixInstId(null);
      if (isPixKeyMissing(err)) {
        toast.error("Cadastre sua chave Pix em Configurações → PDV para gerar cobranças por Pix.");
      } else {
        console.error("[crediário] openFreePix error:", err);
        toast.error("Não foi possível gerar o Pix. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setPixLoading(false);
    }
  }

  // ── 10/10/2026: carnês juntados — avisa, recarrega e abre o carnê novo ──
  function handleJuntou(res: MergePlan) {
    if (clienteAtualRef.current !== customerId) { atualizarDaCliente(customerId); toast.success("Carnês juntados."); return; }
    const adj = res.adjustment;
    const n = res.installments_count;
    toast.success(
      res.replayed
        ? "Estes carnês já tinham sido juntados."
        : adj?.type === "discount"
          ? `Carnês juntados em ${n}x, com desconto de ${fmt(adj.amount)}.`
          : adj?.type === "surcharge"
            ? `Carnês juntados em ${n}x, com acréscimo de ${fmt(adj.amount)}.`
            : `Carnês juntados em ${n}x.`
    );
    setJuntarPre(null);
    // O carnê novo já aparece aberto quando a ficha recarregar.
    if (res.account?.id) setExpandedAccountId(res.account.id);
    setHistLoaded(false);
    handleHistoricRefresh();
  }

  // ── 09/11/2026: excluir carnê ─────────────────────────────────────────
  // Sem recebimento: exclui e recarrega a ficha. Com recebimento ou de venda
  // do Caixa o backend recusa (409) e o diálogo diz o caminho.
  async function confirmarExclusaoDoCarne() {
    const alvo = excluirAlvo;
    if (!alvo || excluindo || !customerId) return;
    setExcluindo(true);
    const pedidoDe = customerId;
    try {
      await creditApi.deleteCarne(companyId, customerId, alvo.id);
      if (clienteAtualRef.current !== pedidoDe) { atualizarDaCliente(pedidoDe); toast.success("Carnê excluído."); return; }
      setExcluirAlvo(null);
      if (expandedAccountId === alvo.id) setExpandedAccountId(undefined);
      toast.success("Carnê excluído.");
      setHistLoaded(false);
      handleHistoricRefresh();
    } catch (err: any) {
      if (clienteAtualRef.current !== pedidoDe) { toast.error(lerErroDaExclusao(err).tipo === "erro" ? "Não foi possível excluir o carnê." : "O carnê não foi excluído."); return; }
      setExcluirAlvo(null);
      const r = lerErroDaExclusao(err);
      if (r.tipo === "recebimentos") {
        setRecusaExclusao({ tipo: "recebimentos", mensagem: mensagemDosRecebimentos(r.recebimentos, fmt) });
      } else if (r.tipo === "venda") {
        setRecusaExclusao({ tipo: "venda", saleId: r.saleId });
      } else if (r.tipo === "sumiu") {
        toast.error(r.mensagem);
        handleHistoricRefresh();
      } else {
        console.error("[crediário] deleteCarne error:", err);
        toast.error(r.mensagem);
      }
    } finally {
      setExcluindo(false);
    }
  }

  // Carnê de venda: a mesma devolução da Linha do tempo (tira a dívida e
  // devolve o estoque).
  async function abrirDevolucaoDoCarne(saleId: string) {
    if (abrindoDevolucao) return;
    setAbrindoDevolucao(true);
    try {
      const venda = await carregarVendaParaDevolucao(companyId, saleId);
      setRecusaExclusao(null);
      if (!venda) {
        toast.error("Todos os itens desta venda já foram devolvidos.");
        return;
      }
      setDevolucaoVenda(venda);
    } catch (err) {
      console.error("[crediário] abrir devolução do carnê:", err);
      toast.error("Não foi possível carregar a venda. Tente novamente.");
    } finally {
      setAbrindoDevolucao(false);
    }
  }

  // F3 (revisão): resposta que chegou depois de trocar de cliente — atualiza
  // os dados DELA (e a carteira) sem tocar na tela da cliente nova.
  function atualizarDaCliente(cliente: string | null) {
    atualizarFicha(cliente);
  }

  // ── Callback de refresh compartilhado com a TabHistorico (pós-devolução) ──
  function handleHistoricRefresh() {
    atualizarFicha(customerId);
  }

  // F3 (revisão): o ?cliente= sobrevive à troca de loja (reloadAfterSwitch).
  // Cliente que esta loja não acha (404) ou que é de outra loja do grupo sem
  // nada nesta: fecha a ficha e limpa o endereço (onClose da página).
  const statusDoErro = (detailQ.error as any)?.status;
  const clienteForaDaLoja = !!visible && (
    (detailQ.isError && statusDoErro === 404) ||
    (abertaPeloEndereco && !!detail?.customer?.company_id && detail.customer.company_id !== companyId
      && Math.abs(balance) < 0.01 && accounts.length === 0 && openInst.length === 0)
  );
  useEffect(() => {
    if (!clienteForaDaLoja) return;
    toast.info("Esta cliente não tem ficha nesta loja.");
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteForaDaLoja]);

  const name = detail?.customer?.name || customerName || "Cliente";
  const outrasLojas = useMemo(
    () => lojasComSaldo(detail?.group_open, companyId),
    [detail?.group_open, companyId],
  );
  const lojasAcessiveis = useMemo(() => new Set(accessibleCompanyIds || []), [accessibleCompanyIds]);
  const phone = detail?.customer?.phone || null;
  const initial = (name.trim()[0] || "?").toUpperCase();

  const scoreWarning = profile?.score_warning ?? null;
  const availableLimit = profile?.available_limit ?? (profile ? (profile.credit_limit - profile.credit_used) : undefined);
  // 23/11/2026 (F1): limite 0 é "sem limite" no backend (ledger: limit > 0 &&
  // ...), mas o topo mostrava "DISPONÍVEL R$ 0,00" — ou negativo e vermelho
  // em backend antigo. Agora diz o que é.
  const limiteDefinido = !!profile && Number(profile.credit_limit) > 0;
  const passouDoLimite = limiteDefinido
    ? Math.max(0, +((Number(profile!.credit_used) || 0) - Number(profile!.credit_limit)).toFixed(2))
    : 0;
  const scoreLabel = profile?.score_label ?? profile?.label ?? null;
  const aviso = avisoDaFicha({
    divergencia: detail?.ledger_mismatch === true,
    somaDasParcelas: detail?.open_installments_total || 0,
    saldoDaConta: balance,
    aConferir: hasOverdue ? 0 : toReviewCount,
    costumaAtrasar: !!scoreWarning,
    fmt,
  });

  const hasTermsOverride = !!(
    profile?.terms?.overrides?.max_installments != null ||
    profile?.terms?.overrides?.interest_rate != null
  );

  // Derivados do sheet de renegociacao (distribuicao identica ao backend).
  const renegTotalVal = parseAmount(renegTotal);
  const renegBase = renegCount > 0 ? Math.floor((renegTotalVal / renegCount) * 100) / 100 : 0;
  const renegLast = +(renegTotalVal - renegBase * (renegCount - 1)).toFixed(2);
  const renegDelta = +(renegTotalVal - (renegScope?.openRemaining || 0)).toFixed(2);

  const freeAmtValue = parseAmount(freeAmt);
  const anyOverlayOpen = !!pixInstId || !!renegScope || !!editingDueDateInst || receberOpen || !!printScope || !!juntarPre
    || !!excluirAlvo || !!recusaExclusao;
  const methodLabelOf = (key: string | null) => PAYMENT_METHODS.find(p => p.key === key)?.label || key || "";
  const methodLabel = methodLabelOf(freeMethod);
  // Recebimento igual há pouco (razão + último desta ficha): o gate avisa,
  // não bloqueia — receber parcela a parcela de mesmo valor é uso legítimo.
  const repetido = receberGate ? recebimentoRecente(detail?.transactions, ultimoRecebimento, freeAmtValue) : null;
  const gateMessage = repetido
    ? mensagemDeRepeticao(repetido, fmt, methodLabelOf)
    : `Confirmar recebimento de ${fmt(freeAmtValue)} em ${methodLabel.toLowerCase()}?`;

  // F3 (23/11/2026): na tela cheia o X de dentro de um painel fecha só o
  // painel (a ficha é a página); na janela fecha a ficha, como sempre.
  function fecharPaineis() {
    setReceberOpen(false);
    setReceberGate(false);
    setPixInstId(null);
    setPixData(null);
    setRenegScope(null);
    setJuntarPre(null);
    setPrintScope(null);
    setEditingDueDateInst(null);
    setEditDueDateError("");
    setLimiteAberto(false);
    setTrocarAberto(false);
    setMenuFicha(false);
    setMenuTelefone(false);
  }
  const fecharDoPainel = emTela || emPagina ? fecharPaineis : onClose;
  // Abrir um painel fecha o que estava aberto (tela cheia e página: os
  // painéis ficam lado a lado com a ficha) e, em qualquer casca, o "⋯".
  function fecharAoAbrirPainel() {
    if (emTela || emPagina) fecharPaineis();
    else { setMenuFicha(false); setMenuTelefone(false); }
  }
  // Diálogos de excluir carnê (View fixa, não Modal: o detector de janela
  // não os vê) também contam como painel: Esc fecha o diálogo e as setas param.
  const painelAberto = !!pixInstId || !!renegScope || !!editingDueDateInst || receberOpen || !!printScope || !!juntarPre
    || limiteAberto || trocarAberto || menuFicha || menuTelefone || !!excluirAlvo || !!recusaExclusao;
  // F3 (revisão): com um envio em andamento a ficha não troca de cliente
  // (lista, setas e teclado) — a resposta cairia na ficha de outra.
  const ocupado = freeSubmitting || renegSubmitting || excluindo || editDueDateMut.isPending || abrindoDevolucao
    || creatingAccount || savingTerms || blockMut.isPending;

  // F3: Esc fecha o painel (o Pix primeiro, que fica por cima do Receber) e
  // depois a ficha; ↑ ↓ trocam de cliente. Só na tela cheia do web.
  useTeclasDaFicha({
    ativo: emTela && visible,
    painelAberto,
    onAcao: (acao) => {
      if (ocupado) return;
      if (acao === "fechar-painel") {
        // O de cima primeiro: diálogo, pergunta do Receber, Pix, painel.
        if (recusaExclusao) setRecusaExclusao(null);
        else if (excluirAlvo) setExcluirAlvo(null);
        else if (repetidoServidor) setRepetidoServidor(null);
        else if (receberGate) setReceberGate(false);
        else if (pixInstId) { setPixInstId(null); setPixData(null); }
        else if (menuTelefone) setMenuTelefone(false);
        else if (menuFicha) setMenuFicha(false);
        else fecharPaineis();
      } else if (acao === "fechar-ficha") onClose();
      else if (acao === "anterior") navegacao?.onAnterior?.();
      else if (acao === "proxima") navegacao?.onProxima?.();
    },
  });

  const carregandoFicha = detailQ.isLoading || profileQ.isLoading;

  // 23/11/2026 (F2): o Cobrar não some sem telefone — fica apagado e
  // explica, abrindo a edição no campo do telefone.
  const botaoCobrar = !!onCobrar && !detailQ.isLoading && (
    phone ? (
      <Pressable style={[m.waBtn, (emTela || emPagina) && t.cobrarTela]} onPress={() => onCobrar(customerId!, name, phone)} accessibilityRole="button" testID="ficha-cobrar">
        <Icon name="whatsapp" size={16} color={Colors.green} />
        <Text style={m.waTxt}>Cobrar</Text>
      </Pressable>
    ) : (
      <Pressable
        style={[m.waBtn, f.cobrarApagado, (emTela || emPagina) && t.cobrarTela]}
        onPress={() => {
          toast.info("Adicione o telefone para cobrar pelo WhatsApp");
          if (customerId) setEditarCliente({ foco: true });
        }}
        accessibilityRole="button"
        accessibilityLabel="Cobrar. Adicione o telefone para cobrar pelo WhatsApp"
        testID="ficha-cobrar-sem-telefone"
      >
        <Icon name="whatsapp" size={16} color={Colors.ink3} />
        <Text style={[m.waTxt, { color: Colors.ink3 }]}>Cobrar</Text>
      </Pressable>
    )
  );

  // F4 (23/11/2026): "Limite e regras" (a antiga aba Conta) é um painel —
  // na coluna da direita da tela cheia, por cima da ficha na janela.
  function abrirLimite() {
    fecharPaineis();
    setLimiteAberto(true);
  }

  // F4: cartões de carnê (mesma regra da TabParcelas): só neles existe o
  // "Criar carnê vazio".
  const comCartoes = useCarneLayout || accounts.some(a => (a as any).remaining !== undefined || (a as any).purchases !== undefined);

  // F4: o "⋯" do alto da ficha — o raro mora aqui (mockup aprovado).
  const itensDaFicha: ItemDoMenu[] = [
    ...(customerId ? [{ rotulo: "Editar cadastro da cliente", onPress: () => setEditarCliente({ foco: false }), testID: "ficha-menu-editar" }] : []),
    { rotulo: "Limite e regras desta cliente", onPress: abrirLimite, testID: "ficha-abrir-limite" },
    ...(openInst.length > 0 || realCarnes.length > 0
      ? [{ rotulo: "Imprimir todos os carnês", onPress: () => { fecharAoAbrirPainel(); setPrintScope({ accountId: undefined, label: name, parcelas: openInst.length }); }, testID: "carnes-imprimir-todos" }]
      : []),
    ...(podeJuntar ? [{ rotulo: "Juntar carnês", onPress: () => { fecharAoAbrirPainel(); setJuntarPre([]); }, testID: "carnes-juntar" }] : []),
    ...(comCartoes
      ? [{ rotulo: "Criar carnê vazio", onPress: () => { setTab("parcelas"); setShowNewAccount(v => !v); setNewAccountName(""); }, testID: "carnes-novo-carne" }]
      : []),
  ];

  // A lista do "⋯": na tela cheia logo abaixo do nome; na janela, no alto da
  // área que rola (o cabeçalho fixo da janela cortaria a lista).
  const listaDoMenuDaFicha = menuFicha && (
    <View style={{ marginTop: 8, marginBottom: emTela ? 0 : 12 }}>
      <ListaDoMenu itens={itensDaFicha} onEscolher={() => setMenuFicha(false)} testID="ficha-menu" />
    </View>
  );

  const identidade = (
    <View style={{ marginBottom: 12 }}>
      <View style={[m.cust, { marginBottom: 0 }]}>
        <View style={[m.custL, { flex: 1, minWidth: 0 }]}>
          <View style={m.avatar}><Text style={m.avatarTxt}>{initial}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={m.custSub}>
              <Text style={[m.custName, f.nome, { fontFamily: Fonts.heading, flexShrink: 1 }]} numberOfLines={2}>{name}</Text>
              {isBlocked && (
                <View style={[m.pill, { backgroundColor: Colors.red + "22" }]}>
                  <Text style={[m.pillTxt, { color: Colors.red }]}>Bloqueado</Text>
                </View>
              )}
            </View>
            {/* 23/11/2026 (F2): telefone do cadastro à vista e Editar cliente. */}
            {!detailQ.isLoading && (
              <TelefoneDaFicha phone={phone} onEditar={customerId ? (foco) => setEditarCliente({ foco }) : undefined} opcoesAbertas={menuTelefone} onOpcoesAbertas={setMenuTelefone} />
            )}
          </View>
        </View>
        <View style={f.topoAcoes}>
          {!emTela && botaoCobrar}
          <BotaoMais aberto={menuFicha} onPress={() => setMenuFicha(v => !v)} rotulo="Mais ações da ficha" testID="ficha-mais" />
        </View>
      </View>
      {emTela && listaDoMenuDaFicha}
    </View>
  );

  // F4 (23/11/2026): três fatos em frase inteira no lugar de EM ABERTO,
  // SCORE e DISPONÍVEL (utils/crediarioTresFatos, testada sozinha). O
  // "O que vem agora" substitui o selo Em dia / Em atraso; a nota do score
  // só aparece em "Limite e regras".
  const hojeSP = diaEmSaoPaulo(new Date().toISOString());
  const parcelasAtrasadas = openInst.filter(i => isInstallmentOverdue(i));
  const proximaParcela = openInst.find(i => !isInstallmentOverdue(i) && !needsReview(i)
    && (i.remaining ?? (i.amount_due - (i.covered_amount || 0))) > 0.009) || null;
  // Carnê vazio (criado à mão, sem nada lançado) não é compra em aberto.
  const fatoFalta = fatoFaltaPagar({ saldo: totalBalance, comprasEmAberto: carnesAbertos.filter(c => !c.vazio).length, fmt });
  const fatoAgora = semSaldoNoRazao
    ? { titulo: "O que vem agora", valor: "Conferir as contas", detalhe: "veja o aviso abaixo", atrasado: false }
    : fatoOQueVemAgora({
        atrasadas: parcelasAtrasadas, proxima: proximaParcela, aConferir: hasOverdue ? 0 : toReviewCount,
        saldo: totalBalance, hoje: hojeSP, fmt,
      });
  const fatoLimite = fatoPodeComprarMais({
    limite: profile?.credit_limit, usado: profile?.credit_used, disponivel: profile?.available_limit, scoreLabel, fmt,
  });
  const numeros = !detailQ.isLoading && (
    <View style={f.fatos} testID="ficha-tres-fatos">
      <View style={[f.fato, { flexGrow: 1.1 }]} testID="ficha-fato-falta">
        <Text style={f.fatoK}>{fatoFalta.titulo}</Text>
        <Text style={[f.fatoBig, fatoFalta.tom === "credito" && { color: Colors.green }]} numberOfLines={1}>{fatoFalta.valor}</Text>
        <Text style={f.fatoSub} numberOfLines={2}>{fatoFalta.detalhe}</Text>
      </View>
      <View style={[f.fato, { flexGrow: 1.2 }, fatoAgora.atrasado && f.fatoLate]} testID="crediario-ficha-status">
        <Text style={f.fatoK}>{fatoAgora.titulo}</Text>
        <Text style={[f.fatoMid, fatoAgora.atrasado && { color: Colors.red }]} numberOfLines={1}>{fatoAgora.valor}</Text>
        <Text style={f.fatoSub} numberOfLines={2}>{fatoAgora.detalhe}</Text>
      </View>
      {!!profile && (
        <View style={f.fato} testID="crediario-ficha-limite">
          <Text style={f.fatoK}>{fatoLimite.titulo}</Text>
          <Text
            style={[f.fatoMid, { color: fatoLimite.tom === "ok" ? Colors.green : fatoLimite.tom === "passou" ? Colors.red : Colors.ink2 }]}
            numberOfLines={1}
          >
            {fatoLimite.valor}
          </Text>
          <View style={f.fatoSubLinha}>
            {!!fatoLimite.detalhe && <Text style={[f.fatoSub, { flexShrink: 1 }]} numberOfLines={2}>{`${fatoLimite.detalhe} ·`}</Text>}
            {/* Área de toque de 44 px sem crescer o cartão (margem negativa). */}
            <Pressable onPress={abrirLimite} style={f.fatoVerArea} accessibilityRole="button" accessibilityLabel="Ver limite e regras" testID="ficha-fato-ver-limite">
              <Text style={f.fatoVer}>ver</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  // 23/11/2026 (F1): um aviso por vez, em frase inteira, o mais grave
  // primeiro (utils/crediarioAvisoDaFicha). Saíram dos selos ao lado do nome
  // ("parcelas R$ X · saldo R$ Y", "N a conferir"), que não diziam o que era
  // nem o que fazer.
  const avisoEl = !!aviso && (
    <View
      style={m.scoreBanner}
      testID={aviso.tipo === "divergencia" ? "crediario-ficha-divergencia" : `crediario-ficha-aviso-${aviso.tipo}`}
    >
      <Icon name="alert_triangle" size={15} color={Colors.amber} />
      <Text style={[m.scoreBannerTxt, { fontFamily: Fonts.body }]}>{aviso.texto}</Text>
    </View>
  );

  const carregandoEl = (
    <View style={{ paddingVertical: 36, alignItems: "center" }}>
      <ActivityIndicator color={Colors.violet3} />
    </View>
  );

  const parcelasEl = (
    <>
      <GrupoEmAberto
        name={name}
        lojas={outrasLojas}
        storeName={storeName}
        acessiveis={lojasAcessiveis}
        abrindo={switchingCompany}
        onAbrirNaLoja={onOpenInCompany && customerId
          ? (cid) => onOpenInCompany(cid, customerId)
          : undefined}
      />
      <TabParcelas
        accounts={accounts} openInst={openInst}
        instByAccount={instByAccount} useCarneLayout={useCarneLayout}
        handleCreateAccount={handleCreateAccount} showNewAccount={showNewAccount}
        setShowNewAccount={setShowNewAccount} newAccountName={newAccountName}
        setNewAccountName={setNewAccountName} creatingAccount={creatingAccount}
        expandedAccountId={expandedAccountId} setExpandedAccountId={setExpandedAccountId}
        handleEditDueDateOpen={handleEditDueDateOpen} onRenegociar={openRenegociar}
        onImprimir={(accountId, label, parcelas) => { fecharAoAbrirPainel(); setPrintScope({ accountId, label, parcelas }); }}
        onJuntar={podeJuntar ? () => { fecharAoAbrirPainel(); setJuntarPre([]); } : undefined}
        onExcluirCarne={(carne) => { fecharAoAbrirPainel(); setExcluirAlvo(carne); }}
        openInstallmentPix={openInstallmentPix}
        prefill={receberDaAba}
        openBalance={totalBalance}
        companyId={companyId} customerId={customerId!} phone={phone} onCobrar={onCobrar} name={name}
      />
    </>
  );

  const historicoEl = (
    <TabHistorico
      histEvents={histEvents} histCursor={histCursor} histLoading={histLoading}
      histLoaded={histLoaded} loadHistory={loadHistory} setHistLoaded={setHistLoaded}
      companyId={companyId}
      customerId={customerId!}
      customerName={name}
      openInst={openInst}
      onRefresh={handleHistoricRefresh}
    />
  );

  const contaEl = (
    <TabConta
      profile={profile} isBlocked={isBlocked} scoreLabel={scoreLabel}
      availableLimit={availableLimit} totalBalance={totalBalance} openInst={openInst}
      nextDueDate={nextDueDate} hasTermsOverride={hasTermsOverride} realCarnes={realCarnes}
      regraDaLoja={regraDaLojaQ.data ? { max_installments: regraDaLojaQ.data.max_installments, interest_rate: regraDaLojaQ.data.interest_rate } : null}
      ajustes={{
        termsMaxInst, setTermsMaxInst, termsInterest, setTermsInterest,
        termsDirty, setTermsDirty, savingTerms, saveTerms, erroTermos,
        blockReason, setBlockReason, blockingAction, setBlockingAction,
        handleBlockToggle, confirmBlock, blockPending: blockMut.isPending,
      }}
    />
  );

  // Abre o "Receber pagamento" livre. Volta para "Todos": o Receber de um
  // cartão mira o carnê dele, e este é o recebimento livre (parcela mais
  // antiga primeiro).
  function abrirReceberLivre() {
    fecharAoAbrirPainel();
    setFreeAccountId(undefined);
    setReceberOpen(true);
  }

  const paineis = (
    <>
          {/* ── Painel "Receber pagamento" (task 03/08): desliza POR CIMA da
               ficha ocupando o sheet inteiro — não comprime mais o body.
               Gate e CTA vivem no rodapé FIXO, sempre visíveis. ── */}
          {receberOpen && (
            <View style={m.panel}>
             <ModalPop visible style={{ flex: 1 }}>
              <View style={m.panelHead}>
                <Pressable onPress={() => { setReceberOpen(false); setReceberGate(false); }} style={m.panelBack} accessibilityRole="button">
                  <View style={{ transform: [{ rotate: "180deg" }] }}>
                    <Icon name="chevron_right" size={15} color={Colors.violet3} />
                  </View>
                  <Text style={m.panelBackTxt}>Voltar</Text>
                </Pressable>
                <Text style={m.panelTitle}>{receiptResult ? "Pagamento registrado" : "Receber pagamento"}</Text>
                <Pressable onPress={fecharDoPainel} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>

              {receiptResult ? (
              <>
              <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 10 }} showsVerticalScrollIndicator={true}>
                <View style={m.previewBox} testID="crediario-recebido">
                  <Text style={m.previewTitle}>Recebido</Text>
                  <View style={m.previewRow}>
                    <Text style={m.previewLbl}>Valor</Text>
                    <Text style={m.previewVal}>{fmt(receiptResult.amount)}</Text>
                  </View>
                  <View style={m.previewRow}>
                    <Text style={m.previewLbl}>Forma</Text>
                    <Text style={m.previewVal}>{receiptResult.method}</Text>
                  </View>
                </View>
                {receiptResult.applied.length > 0 && (
                  <View style={m.previewBox}>
                    <Text style={m.previewTitle}>Parcelas pagas</Text>
                    {receiptResult.applied.map((line, i) => (
                      <View key={line.installment_id + i} style={m.previewRow}>
                        <Text style={m.previewLbl}>{installmentLabel(line)}</Text>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={m.previewVal}>{fmt((line.principal_paid || 0) + (line.charges_paid || 0))}</Text>
                          <Text style={[m.previewVal, { fontSize: 10, color: Colors.ink3 }]}>
                            {translateStatus(line.status_after)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View style={m.panelFoot}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {!!receiptResult.transactionId && (
                    <Pressable
                      style={[
                        m.pixBtn,
                        { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 12 },
                        printingReceipt && { opacity: 0.5 },
                      ]}
                      disabled={printingReceipt}
                      onPress={handlePrintReceiptNow}
                      accessibilityRole="button"
                    >
                      <Text style={m.pixBtnTxt}>{printingReceipt ? "Abrindo..." : "Imprimir recibo"}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[m.cta, { flex: 2 }]}
                    onPress={() => { setReceiptResult(null); setReceberOpen(false); }}
                    accessibilityRole="button"
                  >
                    <Text style={m.ctaTxt}>Concluir</Text>
                  </Pressable>
                </View>
              </View>
              </>
              ) : (
              <>
              <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 10 }} showsVerticalScrollIndicator={true}>
              <Text style={m.editDueDateSub}>
                Digite um valor e veja como ele é aplicado nas parcelas antes de confirmar.
              </Text>
                {/* 10/10/2026: com carnê por compra a lista cresce — só entram os
                    que ainda têm o que receber (e o que estiver escolhido). E
                    aparece também com um carnê só quando o Receber veio do
                    cartão dele: a lojista precisa VER para onde vai o dinheiro. */}
                {(carnesParaReceber.length > 1 || freeAccountId !== undefined) && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={m.fieldLabel}>Carnê</Text>
                    <View style={m.chipRow}>
                      <Pressable
                        style={[m.chip, freeAccountId === undefined && m.chipOn]}
                        onPress={() => { setFreeAccountId(undefined); triggerPreview(freeAmt, undefined); }}
                      >
                        <Text style={[m.chipTxt, freeAccountId === undefined && m.chipTxtOn]}>Todos</Text>
                      </Pressable>
                      {carnesParaReceber.map(acc => (
                        <Pressable
                          key={acc.id!}
                          style={[m.chip, freeAccountId === acc.id && m.chipOn]}
                          onPress={() => { setFreeAccountId(acc.id); triggerPreview(freeAmt, acc.id); }}
                        >
                          <Text style={[m.chipTxt, freeAccountId === acc.id && m.chipTxtOn]}>{acc.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={m.fieldLabel}>Valor recebido</Text>
                <View style={m.amountIn}>
                  <Text style={m.amountPrefix}>R$</Text>
                  <TextInput
                    style={m.amountInput}
                    value={freeAmt}
                    onChangeText={(v) => {
                      const clean = v.replace(/[^\d,.]/g, "");
                      setFreeAmt(clean);
                      triggerPreview(clean, freeAccountId);
                    }}
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={m.quickRow}>
                  {[50, 100, 200].map(v => (
                    <Pressable key={v} style={m.qChip} onPress={() => prefill(v)}>
                      <Text style={m.qChipTxt}>{fmt(v)}</Text>
                    </Pressable>
                  ))}
                  {totalBalance > 0 && (
                    <Pressable style={m.qChip} onPress={() => prefill(valorDeQuitar(totalBalance, faltaDoCarneRef.current(freeAccountId)))}>
                      <Text style={m.qChipTxt}>Quitar ({fmt(valorDeQuitar(totalBalance, faltaDoCarneRef.current(freeAccountId)))})</Text>
                    </Pressable>
                  )}
                </View>

                {(() => {
                  const falta = faltaDoCarneRef.current(freeAccountId);
                  const nome = accounts.find(a => a.id === freeAccountId)?.name || "este carnê";
                  return falta != null && freeAmtValue > falta + 0.009 ? (
                    <Text style={[m.dateHint, { color: Colors.amber }]} testID="receber-passa-do-carne">
                      {avisoPassaDoCarne(nome, falta, fmt)}
                    </Text>
                  ) : null;
                })()}

                <Text style={[m.fieldLabel, { marginTop: 12, fontFamily: Fonts.body }]}>Dia do pagamento</Text>
                <DateInput
                  value={freeDateBr}
                  onChangeText={setFreeDateBr}
                  placeholder="dd/mm/aaaa"
                  style={m.dateInput}
                />
                <Text style={m.dateHint}>Use uma data anterior para registrar um recebimento retroativo.</Text>

                <Text style={[m.fieldLabel, { marginTop: 12 }]}>Forma</Text>
                <View style={m.methods}>
                  {PAYMENT_METHODS.map(pm => (
                    <Pressable
                      key={pm.key}
                      style={[m.method, freeMethod === pm.key && m.methodActive]}
                      onPress={() => setFreeMethod(pm.key)}
                    >
                      <Text style={[m.methodTxt, freeMethod === pm.key && { color: "#fff" }]}>{pm.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {freePreviewLoading && (
                  <View style={{ alignItems: "center", marginTop: 14 }}>
                    <ActivityIndicator size="small" color={Colors.violet3} />
                    <Text style={[m.termsHint, { textAlign: "center", marginTop: 4 }]}>Calculando distribuição...</Text>
                  </View>
                )}
                {!freePreviewLoading && freePreview && (
                  <View style={m.previewBox}>
                    <Text style={[m.previewTitle, { fontFamily: Fonts.body }]}>Para onde vai o dinheiro</Text>
                    {freePreview.applied.map((line, i) => (
                      <View key={line.installment_id + i} style={m.previewRow}>
                        <Text style={m.previewLbl}>{installmentLabel(line)}</Text>
                        <View style={{ alignItems: "flex-end" }}>
                          {line.charges_paid > 0 && (
                            <Text style={[m.previewVal, { fontSize: 10, color: Colors.amber }]}>
                              Encargos: {fmt(line.charges_paid)}
                            </Text>
                          )}
                          <Text style={m.previewVal}>Principal: {fmt(line.principal_paid)}</Text>
                          <Text style={[m.previewVal, { fontSize: 10, color: Colors.ink3 }]}>
                            {translateStatus(line.status_after)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <View style={[m.previewRow, { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 8, marginTop: 4 }]}>
                      <Text style={[m.previewLbl, { fontWeight: "700", color: Colors.ink }]}>Novo saldo em aberto</Text>
                      <Text style={[m.previewVal, { color: freePreview.new_balance > 0 ? Colors.red : Colors.green, fontSize: 16 }]}>
                        {fmt(freePreview.new_balance)}
                      </Text>
                    </View>
                    {freePreview.credit_generated > 0 && (
                      <View style={m.previewRow}>
                        <Text style={m.previewLbl}>Crédito gerado</Text>
                        <Text style={[m.previewVal, { color: Colors.green }]}>{fmt(freePreview.credit_generated)}</Text>
                      </View>
                    )}
                  </View>
                )}

              </ScrollView>

              {/* Rodapé FIXO: gate + ações fora do scroll — sempre visíveis,
                  mesmo em 650px úteis de notebook 720p ou com teclado aberto. */}
              <View style={m.panelFoot}>
                <ConfirmGate
                  visible={receberGate}
                  message={gateMessage}
                  confirmLabel={repetido ? "Sim, é outro" : undefined}
                  // "Sim, é outro" já respondeu à repetição: vai confirmado, sem
                  // a segunda pergunta do servidor (23/11/2026).
                  onConfirm={() => { setReceberGate(false); confirmFreePayment(confirmarRepetidoNoEnvio(repetido)); }}
                  onCancel={() => setReceberGate(false)}
                  loading={freeSubmitting}
                />
                <ConfirmGate
                  visible={!!repetidoServidor}
                  message={mensagemPagamentoRepetido(repetidoServidor?.data_pagamento ?? "")}
                  confirmLabel="Lançar mesmo assim"
                  cancelLabel="Cancelar"
                  onConfirm={() => confirmFreePayment(true)}
                  onCancel={() => setRepetidoServidor(null)}
                  loading={freeSubmitting}
                />
                {!receberGate && !repetidoServidor && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      style={[
                        m.pixBtn,
                        { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 12 },
                        freeAmtValue <= 0 && { opacity: 0.4 },
                      ]}
                      disabled={freeAmtValue <= 0}
                      onPress={() => openFreePix(freeAmtValue)}
                    >
                      <Text style={m.pixBtnTxt}>Gerar Pix</Text>
                    </Pressable>
                    <Pressable
                      style={[m.cta, { flex: 2 }, freeAmtValue <= 0 && { opacity: 0.45 }]}
                      disabled={freeAmtValue <= 0}
                      onPress={() => setReceberGate(true)}
                    >
                      <Text style={m.ctaTxt} numberOfLines={1} adjustsFontSizeToFit>
                        {freeAmtValue > 0 ? `Confirmar ${fmt(freeAmtValue)}` : "Confirmar recebimento"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
              </>
              )}
             </ModalPop>
            </View>
          )}

          {/* Painel Pix: renderizado DEPOIS do Receber → empilha por cima;
              ‹ Voltar devolve ao Receber (se aberto) com os valores intactos. */}
          {!!pixInstId && (
            <View style={m.panel}>
             <ModalPop visible style={{ flex: 1 }}>
              <View style={m.panelHead}>
                <Pressable onPress={() => { setPixInstId(null); setPixData(null); }} style={m.panelBack} accessibilityRole="button">
                  <View style={{ transform: [{ rotate: "180deg" }] }}>
                    <Icon name="chevron_right" size={15} color={Colors.violet3} />
                  </View>
                  <Text style={m.panelBackTxt}>Voltar</Text>
                </Pressable>
                <Text style={m.panelTitle}>{pixOverlayTitle}</Text>
                <Pressable onPress={fecharDoPainel} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 10 }} showsVerticalScrollIndicator={true}>
              {pixLoading && (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <ActivityIndicator color={Colors.violet3} />
                  <Text style={[m.termsHint, { marginTop: 6, textAlign: "center" }]}>Gerando código Pix...</Text>
                </View>
              )}
              {!pixLoading && pixData && (
                <>
                  <View style={{ alignItems: "center", marginVertical: 14 }}>
                    <QRCode value={pixData.emv} size={180} color="#000" backgroundColor="#fff" />
                  </View>
                  <Text style={m.pixAmtLabel}>{fmt(pixData.amount)}</Text>
                  {!!pixData.installment && (
                    <Text style={m.pixInstLabel}>
                      Parcela {pixData.installment.number} · venc. {fmtDate(pixData.installment.due_date)}
                    </Text>
                  )}
                  <Text style={m.fieldLabel}>Código copia e cola</Text>
                  <View style={m.pixEmvBox}>
                    <Text style={m.pixEmvTxt} selectable numberOfLines={3}>{pixData.emv}</Text>
                  </View>
                </>
              )}
              </ScrollView>
              {!pixLoading && !!pixData && (
                <View style={m.panelFoot}>
                  <Pressable
                    style={m.cta}
                    onPress={() => {
                      Clipboard.setString(pixData.emv);
                      toast.success("Código Pix copiado!");
                    }}
                  >
                    <Text style={m.ctaTxt}>Copiar código</Text>
                  </Pressable>
                </View>
              )}
             </ModalPop>
            </View>
          )}

          {renegScope && (
            <View style={m.panel}>
             <ModalPop visible style={{ flex: 1 }}>
              <View style={m.panelHead}>
                <Pressable onPress={() => setRenegScope(null)} style={m.panelBack} accessibilityRole="button">
                  <View style={{ transform: [{ rotate: "180deg" }] }}>
                    <Icon name="chevron_right" size={15} color={Colors.violet3} />
                  </View>
                  <Text style={m.panelBackTxt}>Voltar</Text>
                </Pressable>
                <Text style={[m.panelTitle, { fontFamily: Fonts.body }]}>Mudar as parcelas</Text>
                <Pressable onPress={fecharDoPainel} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 10 }} showsVerticalScrollIndicator={true}>
              <Text style={m.editDueDateSub}>
                {renegScope.label} · saldo em aberto {fmt(renegScope.openRemaining)}. As parcelas abertas serão substituídas por este novo cronograma.
              </Text>

              <Text style={[m.fieldLabel, { marginTop: 4 }]}>Novo total</Text>
              <View style={m.amountIn}>
                <Text style={m.amountPrefix}>R$</Text>
                <TextInput
                  style={m.amountInput}
                  value={renegTotal}
                  onChangeText={onRenegTotalChange}
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* flexWrap: em <380px as duas colunas quebram em vez de espremer */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={m.fieldLabel}>Nº de parcelas</Text>
                  <View style={m.renegStepRow}>
                    <Pressable
                      style={[m.renegStepBtn, renegCount <= 1 && m.renegStepBtnDisabled]}
                      disabled={renegCount <= 1}
                      onPress={() => setRenegCountSafe(renegCount - 1)}
                    >
                      <Icon name="minus" size={16} color={Colors.violet3} />
                    </Pressable>
                    <Text style={m.renegStepVal}>{renegCount}</Text>
                    <Pressable
                      style={[m.renegStepBtn, renegCount >= 100 && m.renegStepBtnDisabled]}
                      disabled={renegCount >= 100}
                      onPress={() => setRenegCountSafe(renegCount + 1)}
                    >
                      <Icon name="plus" size={16} color={Colors.violet3} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={m.fieldLabel}>Valor por parcela</Text>
                  <View style={m.amountIn}>
                    <Text style={m.amountPrefix}>R$</Text>
                    <TextInput
                      style={[m.amountInput, { fontSize: 16 }]}
                      value={renegPerParcel}
                      onChangeText={onRenegPerParcelChange}
                      placeholder="0,00"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
              <Text style={m.renegHint}>
                Mexa no número de parcelas ou no valor — o outro se ajusta sozinho.{" "}
                {renegCount}× de {fmt(renegBase)}{Math.abs(renegLast - renegBase) > 0.005 ? ` (última ${fmt(renegLast)})` : ""}.
              </Text>

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>1ª parcela vence em</Text>
              <DateInput
                value={renegFirstDue}
                onChangeText={setRenegFirstDue}
                placeholder="dd/mm/aaaa"
                style={m.dateInput}
              />

              {/* 10/10/2026: a renegociação mexe num carnê só. Quem quer uma
                  parcela única para tudo sai daqui para o Juntar, já com este
                  carnê marcado. */}
              {podeJuntar && carnesJuntaveis.some(cj => cj.key === (renegScope.accountId ?? CHAVE_SEM_CARNE)) && (
                <Pressable
                  onPress={() => { const k = renegScope.accountId ?? CHAVE_SEM_CARNE; setRenegScope(null); setJuntarPre([k]); }}
                  style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: 6 }}
                  accessibilityRole="button"
                  testID="reneg-juntar-com-outros"
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: Colors.violet3 }}>Juntar com outros carnês</Text>
                </Pressable>
              )}

              {Math.abs(renegDelta) > 0.005 && (
                <View style={m.renegDeltaRow}>
                  <Text style={m.renegDeltaLbl}>{renegDelta < 0 ? "Desconto no saldo" : "Acréscimo no saldo"}</Text>
                  <Text style={[m.renegDeltaVal, { color: renegDelta < 0 ? Colors.green : Colors.red }]}>
                    {renegDelta < 0 ? "−" : "+"}{fmt(Math.abs(renegDelta))}
                  </Text>
                </View>
              )}

              </ScrollView>
              <View style={m.panelFoot}>
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Pressable
                    style={[m.cta, { flex: 1, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                    onPress={() => setRenegScope(null)}
                  >
                    <Text style={[m.ctaTxt, { color: Colors.ink3 }]}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[m.cta, { flex: 2 }, (renegTotalVal <= 0 || renegSubmitting) && { opacity: 0.5 }]}
                    onPress={confirmRenegociar}
                    disabled={renegTotalVal <= 0 || renegSubmitting}
                  >
                    {renegSubmitting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={m.ctaTxt} numberOfLines={1} adjustsFontSizeToFit>Confirmar renegociação</Text>}
                  </Pressable>
                </View>
              </View>
             </ModalPop>
            </View>
          )}

          {juntarPre && (
            <JuntarCarnesPanel
              companyId={companyId}
              customerId={customerId!}
              customerName={name}
              carnes={carnesJuntaveis}
              preselecionados={juntarPre}
              onBack={() => setJuntarPre(null)}
              onClose={fecharDoPainel}
              onDone={handleJuntou}
            />
          )}

          {printScope && (
            <ImprimirCarnePanel
              titulo={printScope.label}
              parcelas={printScope.parcelas}
              pixKey={pixKey}
              onBack={() => setPrintScope(null)}
              onClose={fecharDoPainel}
              onCadastrarPix={onOpenSettings}
              onPrint={(formato) => {
                // Síncrono, dentro do clique: a janela de impressão abre antes
                // de qualquer await (services/printWindow).
                printCarne(companyId, customerId!, { format: formato, accountId: printScope.accountId });
                setPrintScope(null);
              }}
            />
          )}

          {editingDueDateInst && (
            <View style={m.panel}>
             <ModalPop visible style={{ flex: 1 }}>
              <View style={m.panelHead}>
                <Pressable onPress={() => { setEditingDueDateInst(null); setEditDueDateError(""); }} style={m.panelBack} accessibilityRole="button">
                  <View style={{ transform: [{ rotate: "180deg" }] }}>
                    <Icon name="chevron_right" size={15} color={Colors.violet3} />
                  </View>
                  <Text style={m.panelBackTxt}>Voltar</Text>
                </Pressable>
                <Text style={m.panelTitle}>Alterar vencimento</Text>
                <Pressable onPress={fecharDoPainel} style={m.xBtn}>
                  <Icon name="x" size={13} color={Colors.ink3} />
                </Pressable>
              </View>
              <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 10 }} showsVerticalScrollIndicator={true}>
              <Text style={m.editDueDateSub}>
                Parcela {editingDueDateInst.installment_number}/{editingDueDateInst.total_installments} · parcelas seguintes serão recalculadas.
              </Text>
              <Text style={[m.fieldLabel, { marginBottom: 6, marginTop: 4 }]}>NOVA DATA (DD/MM/AAAA)</Text>
              <DateInput
                value={editDueDateInput}
                onChangeText={v => { setEditDueDateInput(v); setEditDueDateError(""); }}
                placeholder="15/07/2026"
                forceShowError={!!editDueDateError}
              />
              {!!editDueDateError && (
                <Text style={{ color: Colors.red, fontSize: 12, marginTop: 4 }}>{editDueDateError}</Text>
              )}
              </ScrollView>
              <View style={m.panelFoot}>
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <Pressable
                    style={[m.cta, { flex: 1, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
                    onPress={() => { setEditingDueDateInst(null); setEditDueDateError(""); }}
                  >
                    <Text style={[m.ctaTxt, { color: Colors.ink3 }]}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[m.cta, { flex: 2 }, editDueDateMut.isPending && { opacity: 0.5 }]}
                    onPress={handleEditDueDateConfirm}
                    disabled={editDueDateMut.isPending}
                  >
                    {editDueDateMut.isPending
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={m.ctaTxt}>Confirmar nova data</Text>}
                  </Pressable>
                </View>
              </View>
             </ModalPop>
            </View>
          )}
    </>
  );

  const dialogos = (
    <>
          {/* 09/11/2026: excluir carnê — confirmação e recusas (sem window.confirm:
              o viewer não tem). Por último, por cima da ficha. */}
          <ConfirmDialog
            visible={!!excluirAlvo}
            title={excluindo ? "Excluindo…" : "Excluir carnê"}
            message={excluirAlvo ? textoConfirmarExclusao(excluirAlvo.falta, fmt) : ""}
            confirmLabel={excluindo ? "Excluindo…" : "Sim, excluir"}
            cancelLabel="Cancelar"
            destructive
            onConfirm={confirmarExclusaoDoCarne}
            onCancel={() => { if (!excluindo) setExcluirAlvo(null); }}
          />
          <ConfirmDialog
            visible={recusaExclusao?.tipo === "recebimentos"}
            title="Este carnê já tem recebimentos"
            message={recusaExclusao?.tipo === "recebimentos" ? recusaExclusao.mensagem : ""}
            confirmLabel="Abrir Movimentações"
            cancelLabel="Agora não"
            destructive={false}
            onConfirm={() => { setRecusaExclusao(null); setTab("historico"); }}
            onCancel={() => setRecusaExclusao(null)}
          />
          <ConfirmDialog
            visible={recusaExclusao?.tipo === "venda"}
            title="Este carnê veio de uma venda"
            message={MENSAGEM_CARNE_DE_VENDA}
            confirmLabel={abrindoDevolucao ? "Abrindo…" : "Abrir a devolução"}
            cancelLabel="Agora não"
            destructive={false}
            onConfirm={() => { if (recusaExclusao?.tipo === "venda") abrirDevolucaoDoCarne(recusaExclusao.saleId); }}
            onCancel={() => { if (!abrindoDevolucao) setRecusaExclusao(null); }}
          />
          {devolucaoVenda && (
            <DevolucaoModal
              visible={!!devolucaoVenda}
              companyId={companyId}
              sale={devolucaoVenda}
              onClose={() => setDevolucaoVenda(null)}
              onDone={() => {
                setDevolucaoVenda(null);
                setHistLoaded(false);
                handleHistoricRefresh();
              }}
            />
          )}

          <EditarClienteDaFicha
            visible={!!editarCliente}
            companyId={companyId}
            customerId={customerId}
            focoNoTelefone={!!editarCliente?.foco}
            onClose={() => setEditarCliente(null)}
            onSaved={() => onChanged?.()}
          />
    </>
  );

  const painelLimite = (
    <View style={m.panel} testID="ficha-painel-limite">
      <ModalPop visible style={{ flex: 1 }}>
        <View style={m.panelHead}>
          <Pressable onPress={() => setLimiteAberto(false)} style={m.panelBack} accessibilityRole="button">
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="chevron_right" size={15} color={Colors.violet3} />
            </View>
            <Text style={m.panelBackTxt}>Voltar</Text>
          </Pressable>
          <Text style={m.panelTitle}>Limite e regras</Text>
        </View>
        <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 12 }} showsVerticalScrollIndicator={true}>
          {carregandoFicha ? carregandoEl : contaEl}
        </ScrollView>
      </ModalPop>
    </View>
  );

  // ── F5 (23/11/2026): a ficha no celular, página inteira ──────────────
  // Mockup aprovado (seção e): cabeçalho de uma linha ("‹ Crediário", nome,
  // "⋯"), "Falta pagar" com a frase do que vem agora, telefone, duas abas
  // (Parcelas, Movimentações) e rodapé fixo com Cobrar e Receber pagamento.
  // É um Modal de tela cheia: as janelas que abrem por cima (Editar
  // cliente, Cobrar, Devolução) continuam empilhando como hoje.
  if (emPagina) {
    const pedirFechar = () => {
      if (ocupado) return;
      // A mesma ordem da tela larga: diálogo, pergunta do Receber, Pix,
      // "⋯", painel; só depois a ficha.
      if (recusaExclusao) setRecusaExclusao(null);
      else if (excluirAlvo) setExcluirAlvo(null);
      else if (repetidoServidor) setRepetidoServidor(null);
      else if (receberGate) setReceberGate(false);
      else if (pixInstId) { setPixInstId(null); setPixData(null); }
      else if (menuTelefone) setMenuTelefone(false);
      else if (menuFicha) setMenuFicha(false);
      else if (painelAberto) fecharPaineis();
      else onClose();
    };
    const fraseScore = fatoLimite.tom === "sem"
      ? fatoLimite.valor + (fatoLimite.detalhe ? ` · ${fatoLimite.detalhe.toLowerCase()}` : "")
      : `${fatoLimite.titulo} ${fatoLimite.valor}${fatoLimite.detalhe.includes(" · ") ? ` · ${fatoLimite.detalhe.split(" · ").slice(1).join(" · ")}` : ""}`;
    return (
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={pedirFechar}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={pg.raiz} testID="ficha-pagina">
          <View style={pg.topo}>
            <Pressable onPress={onClose} style={pg.voltar} accessibilityRole="button" accessibilityLabel="Voltar para a lista do crediário" testID="ficha-voltar">
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <Icon name="chevron_right" size={15} color={Colors.violet3} />
              </View>
              <Text style={m.crumbTxt}>Crediário</Text>
            </Pressable>
            <Text style={pg.nome} numberOfLines={1}>{name}</Text>
            <BotaoMais aberto={menuFicha} onPress={() => setMenuFicha(v => !v)} rotulo="Mais ações da ficha" testID="ficha-mais" />
          </View>
          <ScrollView style={pg.rolagem} contentContainerStyle={pg.rolagemConteudo} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
            {/* A lista do "⋯" rola com a página (fixa no topo, cortaria). */}
            {listaDoMenuDaFicha}
            {tab === "historico" ? (
              <View style={pg.heroCurto}>
                <Text style={pg.heroK}>{fatoFalta.titulo}</Text>
                <Text style={[pg.heroCurtoV, fatoFalta.tom === "credito" && { color: Colors.green }]}>{fatoFalta.valor}</Text>
              </View>
            ) : (
              <View style={pg.hero} testID="ficha-pagina-hero">
                <Text style={pg.heroK}>{fatoFalta.titulo}</Text>
                <Text style={[pg.heroV, fatoFalta.tom === "credito" && { color: Colors.green }]} testID="ficha-pagina-falta">{fatoFalta.valor}</Text>
                {!detailQ.isLoading && (
                  <Text style={[pg.agora, fatoAgora.atrasado && { color: Colors.red }]} testID="crediario-ficha-status">
                    {`${fatoAgora.titulo} ${fatoAgora.valor}${fatoAgora.detalhe ? ` · ${fatoAgora.detalhe}` : ""}`}
                  </Text>
                )}
                {!!profile && (
                  <View style={f.fatoSubLinha} testID="crediario-ficha-limite">
                    <Text style={[pg.limite, { flexShrink: 1, marginTop: 0 }]}>{`${fraseScore} ·`}</Text>
                    <Pressable onPress={abrirLimite} style={f.fatoVerArea} accessibilityRole="button" accessibilityLabel="Ver limite e regras" testID="ficha-fato-ver-limite">
                      <Text style={[f.fatoVer, { fontSize: 12 }]}>ver</Text>
                    </Pressable>
                  </View>
                )}
                {isBlocked && (
                  <View style={[m.pill, { backgroundColor: Colors.red + "22", alignSelf: "flex-start", marginTop: 6 }]}>
                    <Text style={[m.pillTxt, { color: Colors.red }]}>Bloqueado</Text>
                  </View>
                )}
                {!detailQ.isLoading && (
                  <TelefoneDaFicha phone={phone} onEditar={customerId ? (foco) => setEditarCliente({ foco }) : undefined} opcoesAbertas={menuTelefone} onOpcoesAbertas={setMenuTelefone} />
                )}
              </View>
            )}
            {tab !== "historico" && avisoEl}

            <View style={pg.seg} accessibilityRole="tablist">
              {(["parcelas", "historico"] as Tab[]).map(k => (
                <Pressable
                  key={k}
                  onPress={() => setTab(k)}
                  style={[pg.segItem, tab === k && pg.segOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === k }}
                  testID={`ficha-aba-${k}`}
                >
                  <Text style={[pg.segTxt, tab === k && { color: "#fff" }]}>{k === "parcelas" ? "Parcelas" : "Movimentações"}</Text>
                </Pressable>
              ))}
            </View>

            {carregandoFicha ? carregandoEl : tab === "historico" ? historicoEl : parcelasEl}
          </ScrollView>

          {!detailQ.isLoading && (
            <View style={pg.rodape} testID="ficha-rodape">
              {botaoCobrar}
              <Pressable style={[m.cta, pg.receber]} onPress={abrirReceberLivre} accessibilityRole="button" testID="ficha-receber">
                <Text style={m.ctaTxt}>Receber pagamento</Text>
              </Pressable>
            </View>
          )}

          {limiteAberto && painelLimite}
          {paineis}
          {dialogos}
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (!emTela) return (
    // 12/10/2026: com painel interno aberto (Receber, Renegociar, Juntar, Alterar
    // data, Imprimir) o clique no fundo é ignorado — fechava a ficha e levava
    // o que a lojista estava digitando. O painel tem o próprio voltar; Esc e
    // voltar do Android seguem fechando como antes.
    <ResponsiveSheet visible={visible} onClose={onClose} onBackdropPress={anyOverlayOpen ? ignorarToqueNoFundo : onClose} maxWidth={700}>
          <View style={m.head}>
            <Pressable onPress={onClose} style={m.crumb}>
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <Icon name="chevron_right" size={15} color={Colors.violet3} />
              </View>
              <Text style={m.crumbTxt}>Crediário</Text>
            </Pressable>
            <Pressable onPress={onClose} style={m.xBtn}>
              <Icon name="x" size={15} color={Colors.ink3} />
            </Pressable>
          </View>

          <View style={m.fixedHeader}>
            {identidade}
            {numeros}
            {avisoEl}

            {/* F4 (23/11/2026): duas abas. "Limite e regras" saiu das abas e
                virou painel (pelo "⋯" ou pelo "ver" do terceiro fato). */}
            <View style={[m.tabs, { marginBottom: 12 }]}>
              {(["parcelas", "historico"] as Tab[]).map(t => (
                <Pressable key={t} style={[m.tab, tab === t && m.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[m.tabTxt, { fontFamily: Fonts.body }, tab === t && m.tabTxtOn]} numberOfLines={1}>
                    {/* 23/11/2026 (F1): nomes do redesenho da ficha. No celular
                        (< 480 px) a 1ª aba vira "Parcelas" e a 3ª "Limite": três
                        abas em 375 px têm ~105 px cada. */}
                    {t === "parcelas"
                      ? (larguraDaTela < 480 ? "Parcelas" : "Compras e parcelas")
                      : t === "historico" ? "Movimentações"
                        : `${larguraDaTela < 480 ? "Limite" : "Limite e regras"}${(hasTermsOverride || isBlocked) ? " •" : ""}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ScrollView style={m.body} contentContainerStyle={{ padding: 18, paddingTop: 6 }} showsVerticalScrollIndicator={true}>
            {listaDoMenuDaFicha}
            {carregandoFicha ? carregandoEl : (
              <>
                {tab === "parcelas" && parcelasEl}
                {tab === "historico" && historicoEl}
              </>
            )}
          </ScrollView>

          {/* F3: CTA fixo — abre o sheet "Receber pagamento" */}
          {!anyOverlayOpen && tab === "parcelas" && !detailQ.isLoading && (
            <View style={m.footer}>
              <Pressable style={m.cta} onPress={abrirReceberLivre}>
                <Text style={m.ctaTxt}>Receber pagamento</Text>
              </Pressable>
            </View>
          )}

          {limiteAberto && painelLimite}
          {paineis}
          {dialogos}
    </ResponsiveSheet>
  );

  // ── F3 (23/11/2026): a ficha em tela cheia ──────────────────────────
  // Mockup aprovado (seção a): lista das clientes à esquerda (tela larga),
  // o que ela deve no centro, dinheiro e Movimentações à direita. Os painéis
  // (Receber, Pix, Mudar as parcelas, Juntar, Imprimir, Mudar a data, Limite
  // e regras) são os mesmos da janela e abrem por cima da coluna da direita
  // (m.panel é absoluto no pai), com os carnês visíveis ao lado.
  const larga = layout === "larga";
  const nav = navegacao && ocupado ? { ...navegacao, onAnterior: undefined, onProxima: undefined } : navegacao;
  const barraDeTroca = (
    <View style={t.barra} testID="ficha-barra-troca">
      <Pressable onPress={onClose} style={t.barraBtn} accessibilityRole="button" accessibilityLabel="Voltar para a lista do crediário" testID="ficha-voltar">
        <View style={{ transform: [{ rotate: "180deg" }] }}>
          <Icon name="chevron_right" size={15} color={Colors.violet3} />
        </View>
        <Text style={m.crumbTxt}>Crediário</Text>
      </Pressable>
      {!!nav && nav.total > 0 && (
        <View style={t.setas}>
          <Pressable
            onPress={nav.onAnterior}
            disabled={!nav.onAnterior}
            style={[t.seta, !nav.onAnterior && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Cliente anterior"
            testID="ficha-anterior"
          >
            <Text style={t.setaTxt}>‹</Text>
          </Pressable>
          <Text style={t.posicao} testID="ficha-posicao">
            {nav.posicao > 0 ? `${nav.posicao} de ${nav.total}` : `${nav.total} na lista`}
          </Text>
          <Pressable
            onPress={nav.onProxima}
            disabled={!nav.onProxima}
            style={[t.seta, !nav.onProxima && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Próxima cliente"
            testID="ficha-proxima"
          >
            <Text style={t.setaTxt}>›</Text>
          </Pressable>
        </View>
      )}
      {!!listaLateral && (
        <Pressable
          onPress={() => setTrocarAberto(v => !v)}
          style={[t.barraBtn, trocarAberto && { backgroundColor: Colors.violetD }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: trocarAberto }}
          testID="ficha-trocar-cliente"
        >
          <Text style={t.trocarTxt}>Trocar cliente ⌄</Text>
        </Pressable>
      )}
    </View>
  );

  if (!visible) return null;
  return (
    <View style={t.raiz} testID="ficha-tela">
      {larga && !!listaLateral && (
        <View style={t.lista}>
          {listaLateral}
          {ocupado && <TravaDaLista />}
        </View>
      )}

      <View style={t.centro} testID="ficha-centro">
        {!larga && barraDeTroca}
        <View style={t.cabecalho}>
          {identidade}
          {numeros}
          {avisoEl}
        </View>
        <ScrollView style={t.rolagem} contentContainerStyle={t.rolagemConteudo} showsVerticalScrollIndicator={true}>
          <Text style={t.secao}>Compras e parcelas</Text>
          {carregandoFicha ? carregandoEl : parcelasEl}
        </ScrollView>
      </View>

      <View style={[t.direita, { width: larga ? 340 : 320 }]} testID="ficha-direita">
        <View style={t.acoes}>
          <Pressable style={[m.cta, t.receber]} onPress={abrirReceberLivre} accessibilityRole="button" testID="ficha-receber">
            <Text style={m.ctaTxt}>Receber pagamento</Text>
          </Pressable>
          {botaoCobrar}
        </View>
        <ScrollView style={t.rolagem} contentContainerStyle={t.movConteudo} showsVerticalScrollIndicator={true}>
          {historicoEl}
        </ScrollView>
        {limiteAberto && painelLimite}
        {paineis}
      </View>

      {!larga && trocarAberto && !!listaLateral && (
        <>
          <Pressable style={t.trocarFundo} onPress={() => setTrocarAberto(false)} accessibilityLabel="Fechar a lista das clientes" />
          <View style={t.trocarLista} testID="ficha-trocar-lista">
            {listaLateral}
            {ocupado && <TravaDaLista />}
          </View>
        </>
      )}

      {dialogos}
    </View>
  );
}

/** Por cima da lista das clientes enquanto um envio não termina. */
function TravaDaLista() {
  return (
    <Pressable
      style={t.trava}
      onPress={() => toast.info("Espere terminar de salvar para trocar de cliente.")}
      accessibilityLabel="Salvando. Espere para trocar de cliente."
      testID="ficha-lista-travada"
    />
  );
}

// F5 (23/11/2026): casca do celular, página inteira. Alvos de 44 px ou
// mais; nada em largura fixa (320 px sem rolagem para o lado).
const pg = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.bg },
  topo: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 56,
    paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg2,
  },
  voltar: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, minWidth: 44, paddingHorizontal: 6, borderRadius: 10 },
  nome: { fontFamily: Fonts.heading, flex: 1, minWidth: 0, fontSize: 19, color: Colors.ink },
  rolagem: { flex: 1, minHeight: 0 },
  rolagemConteudo: { paddingHorizontal: 12, paddingBottom: 24 },
  hero: { paddingHorizontal: 4, paddingTop: 14, paddingBottom: 10 },
  heroK: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  heroV: { fontFamily: Fonts.mono, fontSize: 28, fontWeight: "500", letterSpacing: -0.5, color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  agora: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink2, marginTop: 2 },
  limite: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, marginTop: 2 },
  heroCurto: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingHorizontal: 4, paddingTop: 14, paddingBottom: 10 },
  heroCurtoV: { fontFamily: Fonts.mono, fontSize: 18, fontWeight: "500", color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  seg: {
    flexDirection: "row", padding: 3, marginBottom: 12, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  segItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  segOn: { backgroundColor: Colors.violet },
  segTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  rodape: {
    flexDirection: "row", alignItems: "stretch", gap: 8,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2,
  },
  receber: { flex: 1, minHeight: 46, justifyContent: "center", paddingVertical: 10 },
});

// F3 (23/11/2026): casca da tela cheia.
const t = StyleSheet.create({
  trava: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, backgroundColor: "rgba(3,5,14,0.25)" },
  raiz: { flex: 1, flexDirection: "row", minHeight: 0, minWidth: 0, borderTopWidth: 1, borderTopColor: Colors.border },
  lista: { width: 224, minHeight: 0, borderRightWidth: 1, borderRightColor: Colors.border },
  centro: { flex: 1, minWidth: 0, minHeight: 0 },
  cabecalho: { paddingHorizontal: 20, paddingTop: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rolagem: { flex: 1, minHeight: 0 },
  rolagemConteudo: { padding: 20, paddingTop: 14, paddingBottom: 32 },
  movConteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  secao: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 10 },
  direita: {
    minHeight: 0, backgroundColor: Colors.bg2, overflow: "hidden",
    borderLeftWidth: 1, borderLeftColor: Colors.border,
  },
  acoes: {
    flexDirection: "row", alignItems: "stretch", gap: 8,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  receber: { flex: 1, minHeight: 44, justifyContent: "center", paddingVertical: 10 },
  cobrarTela: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
  limiteBtn: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.border2,
  },
  limiteTxt: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  barra: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 20, paddingTop: 12,
  },
  barraBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
  },
  setas: { flexDirection: "row", alignItems: "center", gap: 6 },
  seta: {
    width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  setaTxt: { fontFamily: Fonts.body, fontSize: 18, fontWeight: "700", color: Colors.ink },
  posicao: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.ink3, minWidth: 64, textAlign: "center" },
  trocarTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink },
  trocarFundo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 19, backgroundColor: "rgba(3,5,14,0.35)" },
  trocarLista: {
    position: "absolute", top: 0, left: 0, bottom: 0, width: 300, zIndex: 20,
    borderRightWidth: 1, borderRightColor: Colors.border2, backgroundColor: Colors.bg2,
    boxShadow: "6px 0 24px rgba(0,0,0,0.35)",
  },
});

// Estilos locais da F3 (herói do header)
const f = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "flex-end", gap: 16, marginBottom: 12 },
  metaHero: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginTop: 2 },
  metaSm: { alignItems: "flex-end" },
  metaSmVal: { fontSize: 13, fontWeight: "700", marginTop: 3 },
  // 23/11/2026 (F2): nome da cliente é o título da ficha (Instrument Serif).
  nome: { fontSize: 22, fontWeight: "400", lineHeight: 26 },
  cobrarApagado: { opacity: 0.6, borderStyle: "dashed", borderColor: Colors.border2, backgroundColor: "transparent" },
  // F4: três fatos
  topoAcoes: { flexDirection: "row", alignItems: "center", gap: 8 },
  fatos: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  fato: {
    flexGrow: 1, flexBasis: 150, minWidth: 0,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 13,
    paddingHorizontal: 13, paddingVertical: 11,
  },
  fatoLate: { borderColor: Colors.red + "66", backgroundColor: Colors.redD },
  fatoK: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  fatoBig: { fontFamily: Fonts.mono, fontSize: 21, fontWeight: "500", letterSpacing: -0.5, color: Colors.ink, marginTop: 1, fontVariant: ["tabular-nums"] as any },
  fatoMid: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: "500", color: Colors.ink, marginTop: 3, fontVariant: ["tabular-nums"] as any },
  fatoSub: { fontFamily: Fonts.body, fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  fatoVer: { fontFamily: Fonts.body, fontSize: 11.5, fontWeight: "700", color: Colors.violet3 },
  fatoSubLinha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 2, marginTop: 2 },
  fatoVerArea: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 6, marginVertical: -14 },
});

export default ClienteCrediarioModal;
