// ============================================================
// AURA. — Novo lançamento do crediário: o estado do formulário (12/10/2026)
//
// Redesenho aprovado (docs/mockups/crediario-lancamento-manual.html). O modal
// antigo guardava o formulário em ~25 useState soltos e um reset() que tinha
// de lembrar de cada um. Aqui é um useReducer só: o reset é "volta ao estado
// inicial" e as regras que ligam um campo a outro moram num lugar
// (normalizar): sair de "Carnê existente" desliga a unificação; mudar a
// unificação, a prévia ou o carnê fecha a confirmação vermelha (não se
// confirma um resumo desatualizado).
//
// O que mudou de comportamento, de propósito:
//   - os carnês do cliente só são buscados quando a lojista abre "alterar"
//     no carnê (antes: sempre, ao escolher o cliente, mesmo sem ninguém usar
//     "Carnê existente");
//   - a prévia da unificação espera 400 ms parada antes de ir ao servidor;
//   - salvar com sucesso não fecha mais: vai para a tela Pronto (imprimir,
//     WhatsApp, lançar outro). As invalidações de cache continuam no sucesso.
//
// O que NÃO mudou: o payload do lançamento (ManualEntryPayload, com
// new_account: true como padrão), a Idempotency-Key reaproveitada no retry
// (incidente Valen, 13/08), o fluxo de unificação (createManualEntry com
// installments=1 + applyUnify) e a conta do "preenchido" para a pergunta de
// descarte (utils/crediarioLancamento.ts).
// ============================================================
import { useReducer, useRef, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import {
  creditApi, MAX_INSTALLMENTS_CEILING,
  type ManualEntryPayload, type CreditAccount, type UnifyPlan, type ManualEntryResult,
} from "@/services/creditApi";
import { toast } from "@/components/Toast";
import { parseBrDate } from "@/components/inputs/DateInput";
import { lancamentoPreenchido, type PadroesDoLancamento } from "@/utils/crediarioLancamento";
import {
  parseCurrencyInput, defaultDueDate, todayBrSp, periodToPayload, cronograma, rotuloDoPeriodo,
  type PeriodKind, type AccountMode, type CustomerOption,
} from "./calculos";

export type Step = "customer" | "details" | "pronto";
export type Mode = "search" | "create";

/** Opções do carnê, na ordem dos cartões ("alterar"). */
export const OPCOES_DE_CARNE: Array<[AccountMode, string]> = [
  ["new", "Carnê novo"],
  ["existing", "Carnê existente"],
  ["general", "Conta geral"],
];

/** O que a tela Pronto mostra: foto do formulário no momento do sucesso. */
export type ResumoDoLancamento = {
  customerId: string | null;
  customerName: string;
  phone: string | null;
  accountMode: AccountMode;
  /** account_id devolvido pelo backend (null = conta geral; undefined = backend antigo). */
  accountId: string | null | undefined;
  carneNome: string | null;
  valor: number;
  total: number;
  comJuros: boolean;
  parcelas: number;
  valorParcela: number;
  periodo: string;
  /** Vencimentos, YYYY-MM-DD. */
  datas: string[];
  comprado: string;
  novoSaldo: number | null;
  unificado: boolean;
};

export type EstadoDoForm = {
  step: Step;
  mode: Mode;
  loading: boolean;
  confirmarDescarte: boolean;
  /** Padrões com que o formulário nasceu (os que dependem do dia). O
   *  "preenchido" compara contra eles, não contra um "hoje" recalculado. */
  padroes: PadroesDoLancamento;

  searchQ: string;
  searching: boolean;
  searchResults: CustomerOption[];
  selectedCustomer: CustomerOption | null;
  newName: string;
  newPhone: string;

  amountRaw: string;
  installments: string;
  /** "outro" nas parcelas: mostra o campo numérico livre. */
  parcelasLivre: boolean;
  interestRate: string;
  firstDueDate: string;
  entryDate: string;
  periodKind: PeriodKind;
  periodDays: string;
  intervaloOpen: boolean;
  description: string;

  accountMode: AccountMode;
  selectedAccountId: string | null;
  newAccountName: string;
  /** Carnês buscados (sob demanda) e de qual cliente são. */
  carnes: { customerId: string; accounts: CreditAccount[] } | null;
  loadingAccounts: boolean;
  carneOpen: boolean;
  advOpen: boolean;

  unifyEnabled: boolean;
  unifyInstallments: string;
  unifyFirstDue: string;
  unifyPreview: UnifyPlan | null;
  unifyPreviewLoading: boolean;
  unifyPreviewError: string | null;
  /** feat(unify-confirm-gate): a unificação CANCELA as parcelas em aberto do
   *  carnê — nunca dispara no 1º toque (Valen, 04/08). */
  unifyGateOpen: boolean;

  resultado: ResumoDoLancamento | null;
};

export function estadoInicial(): EstadoDoForm {
  const padroes: PadroesDoLancamento = { vencimento: defaultDueDate(), hoje: todayBrSp() };
  return {
    step: "customer",
    mode: "search",
    loading: false,
    confirmarDescarte: false,
    padroes,
    searchQ: "",
    searching: false,
    searchResults: [],
    selectedCustomer: null,
    newName: "",
    newPhone: "",
    amountRaw: "",
    installments: "1",
    parcelasLivre: false,
    interestRate: "",
    firstDueDate: padroes.vencimento,
    entryDate: padroes.hoje,
    periodKind: "mensal",
    periodDays: "20",
    intervaloOpen: false,
    description: "",
    accountMode: "new",
    selectedAccountId: null,
    newAccountName: "",
    carnes: null,
    loadingAccounts: false,
    carneOpen: false,
    advOpen: false,
    unifyEnabled: false,
    unifyInstallments: "2",
    unifyFirstDue: padroes.vencimento,
    unifyPreview: null,
    unifyPreviewLoading: false,
    unifyPreviewError: null,
    unifyGateOpen: false,
    resultado: null,
  };
}

type Acao =
  | { type: "set"; patch: Partial<EstadoDoForm> }
  | { type: "reset" }
  | { type: "escolherCliente"; cliente: CustomerOption | null };

/** Regras que amarram um campo a outro (antes eram useEffects). */
function normalizar(prev: EstadoDoForm, next: EstadoDoForm): EstadoDoForm {
  let out = next;
  // Desliga unify se sair de "Carnê existente".
  if (out.accountMode !== "existing" && out.unifyEnabled) out = { ...out, unifyEnabled: false };
  // Fecha o gate se a unificação, a prévia ou o carnê mudarem.
  if (out.unifyGateOpen && (
    out.unifyEnabled !== prev.unifyEnabled ||
    out.unifyPreview !== prev.unifyPreview ||
    out.selectedAccountId !== prev.selectedAccountId
  )) out = { ...out, unifyGateOpen: false };
  return out;
}

function reducer(st: EstadoDoForm, a: Acao): EstadoDoForm {
  if (a.type === "reset") return estadoInicial();
  if (a.type === "escolherCliente") {
    const mesmo = (st.selectedCustomer?.id ?? null) === (a.cliente?.id ?? null);
    // Outro cliente: os carnês e a escolha de carnê eram do anterior.
    const limpaCarne: Partial<EstadoDoForm> = mesmo ? {} : {
      carnes: null,
      loadingAccounts: false,
      selectedAccountId: null,
      unifyEnabled: false,
      carneOpen: false,
      accountMode: st.accountMode === "existing" ? "new" : st.accountMode,
    };
    return normalizar(st, { ...st, ...limpaCarne, selectedCustomer: a.cliente, step: "details" });
  }
  return normalizar(st, { ...st, ...a.patch });
}

/** Valor, parcelas e datas — o que o passo 2, o rodapé e a tela Pronto mostram. */
export function calcularValores(st: Pick<EstadoDoForm,
  "amountRaw" | "installments" | "interestRate" | "firstDueDate" | "periodKind" | "periodDays">) {
  const amountNum = parseCurrencyInput(st.amountRaw);
  const nParcelas = Math.max(1, parseInt(st.installments, 10) || 1);
  const rateNum = st.interestRate.trim()
    ? parseFloat(st.interestRate.replace(",", ".")) / 100
    : 0;
  // 13/08/2026 (feedback Caio): juros total FLAT sobre o valor do lançamento,
  // independente do número de parcelas. Preview precisa bater com o cálculo
  // do backend (credit.js / ledger.js).
  const totalComJuros = rateNum > 0
    ? parseFloat((amountNum * (1 + rateNum)).toFixed(2))
    : amountNum;
  const valorParcela = amountNum > 0 ? totalComJuros / nParcelas : 0;
  const period = periodToPayload(st.periodKind, st.periodDays);
  const firstDueIso = parseBrDate(st.firstDueDate);
  const datas = cronograma(firstDueIso, nParcelas, period.period_unit, period.period_count);
  return { amountNum, nParcelas, rateNum: isNaN(rateNum) ? 0 : rateNum, totalComJuros, valorParcela, period, firstDueIso, datas };
}

export function useLancamentoForm() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [st, dispatch] = useReducer(reducer, undefined, estadoInicial);

  // Os callbacks assíncronos leem o estado de agora, não o do render em que
  // foram criados (a resposta da busca de carnês pode chegar depois de trocar
  // de cliente).
  const stRef = useRef(st);
  stRef.current = st;

  const set = useCallback((patch: Partial<EstadoDoForm>) => dispatch({ type: "set", patch }), []);

  // Incidente Valen (13/08/2026): timeout de rede não cancela a tx no
  // servidor — ela pode ter comitado mesmo assim. Se o usuário tentar de
  // novo após o erro, o enviar() reenvia com a MESMA Idempotency-Key (só é
  // gerada uma vez por "sessão" de submissão e só é limpa no reset()). O
  // backend deduplica por essa key e devolve o lançamento já criado.
  const idempKeyRef = useRef<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const reset = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    idempKeyRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  // ── Seletores memoizados ─────────────────────────────────────────────────
  const valores = useMemo(
    () => calcularValores(st),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st.amountRaw, st.installments, st.interestRate, st.firstDueDate, st.periodKind, st.periodDays],
  );

  const carnesDerivados = useMemo(() => {
    const doCliente = st.carnes && st.carnes.customerId === st.selectedCustomer?.id ? st.carnes.accounts : [];
    const selectableAccounts = doCliente.filter((a) => a.id !== null && a.status === "open");
    const selectedAccount = selectableAccounts.find((a) => a.id === st.selectedAccountId) || null;
    const canUnify = st.accountMode === "existing" && !!selectedAccount && (selectedAccount.open_count || 0) > 0;
    return { selectableAccounts, selectedAccount, canUnify };
  }, [st.carnes, st.selectedCustomer?.id, st.selectedAccountId, st.accountMode]);

  const unifyFirstDueIso = parseBrDate(st.unifyFirstDue);

  const preenchido = lancamentoPreenchido(
    {
      selectedCustomer: st.selectedCustomer, newName: st.newName, newPhone: st.newPhone,
      amountRaw: st.amountRaw, installments: st.installments, interestRate: st.interestRate,
      firstDueDate: st.firstDueDate, entryDate: st.entryDate, periodKind: st.periodKind,
      description: st.description, accountMode: st.accountMode,
      selectedAccountId: st.selectedAccountId, newAccountName: st.newAccountName,
      unifyEnabled: st.unifyEnabled,
    },
    st.padroes,
  );

  // ── Passo 1: cliente ─────────────────────────────────────────────────────
  const buscar = useCallback((q: string) => {
    set({ searchQ: q });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { set({ searchResults: [], searching: false }); return; }
    searchTimer.current = setTimeout(async () => {
      set({ searching: true });
      try {
        const data = await creditApi.searchCustomers(company!.id, q);
        if (stRef.current.searchQ === q) set({ searchResults: data.customers || [] });
      } catch {
        /* silent */
      } finally {
        set({ searching: false });
      }
    }, 350);
  }, [company, set]);

  const escolherCliente = useCallback((c: CustomerOption) => {
    dispatch({ type: "escolherCliente", cliente: { id: c.id, name: c.name, phone: c.phone ?? null } });
  }, []);

  const confirmarNovoCliente = useCallback(() => {
    const s = stRef.current;
    if (!s.newName.trim())  { toast.error("Nome obrigatório"); return; }
    if (!s.newPhone.trim()) { toast.error("Telefone obrigatório"); return; }
    dispatch({ type: "escolherCliente", cliente: null });
  }, []);

  // "trocar" no cabeçalho: volta ao passo 1 sem perder o que foi digitado.
  const trocarCliente = useCallback(() => {
    if (stRef.current.loading) return;
    set({ step: "customer" });
  }, [set]);

  // ── Carnê: busca sob demanda ─────────────────────────────────────────────
  const carregarCarnes = useCallback(async () => {
    const s = stRef.current;
    const customerId = s.selectedCustomer?.id;
    if (!company?.id || !customerId) return;
    if (s.loadingAccounts || s.carnes?.customerId === customerId) return;
    set({ loadingAccounts: true });
    let accounts: CreditAccount[] = [];
    try {
      const data = await creditApi.getCustomerHistory(company.id, customerId);
      accounts = data.accounts || [];
    } catch {
      accounts = [];
    }
    // Trocou de cliente no meio: a resposta é do anterior, descarta.
    if (stRef.current.selectedCustomer?.id !== customerId) return;
    set({ carnes: { customerId, accounts }, loadingAccounts: false });
  }, [company, set]);

  const alternarCarne = useCallback(() => {
    const abrir = !stRef.current.carneOpen;
    set({ carneOpen: abrir });
    if (abrir) carregarCarnes();
  }, [set, carregarCarnes]);

  // ── Prévia da unificação (400 ms parada) ─────────────────────────────────
  const { canUnify } = carnesDerivados;
  useEffect(() => {
    const s = stRef.current;
    if (!s.unifyEnabled || !canUnify || !s.selectedAccountId || !unifyFirstDueIso) {
      if (s.unifyPreview || s.unifyPreviewLoading || s.unifyPreviewError) {
        set({ unifyPreview: null, unifyPreviewLoading: false, unifyPreviewError: null });
      }
      return;
    }
    const amountNum = parseCurrencyInput(s.amountRaw);
    const n = parseInt(s.unifyInstallments, 10) || 1;
    if (amountNum <= 0 || n < 1) { set({ unifyPreview: null, unifyPreviewLoading: false }); return; }
    if (!company?.id || !s.selectedCustomer?.id) return;

    // Parâmetro mudou: a prévia antiga não vale mais (e o CTA espera a nova).
    set({ unifyPreview: null, unifyPreviewLoading: true, unifyPreviewError: null });
    const companyId = company.id;
    const customerId = s.selectedCustomer.id;
    const accountId = s.selectedAccountId;
    let cancelled = false;
    const timer = setTimeout(() => {
      creditApi.previewUnify(companyId, customerId, accountId, {
        amount: amountNum,
        installments: n,
        first_due_date: unifyFirstDueIso,
      }).then((plan) => {
        if (!cancelled) set({ unifyPreview: plan, unifyPreviewLoading: false });
      }).catch((err: any) => {
        if (!cancelled) set({
          unifyPreviewError: err?.message || "Erro ao calcular unificação",
          unifyPreview: null,
          unifyPreviewLoading: false,
        });
      });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.unifyEnabled, st.selectedAccountId, st.unifyInstallments, unifyFirstDueIso, st.amountRaw, company?.id, st.selectedCustomer?.id, canUnify]);

  // ── Envio ────────────────────────────────────────────────────────────────
  const enviar = useCallback(async () => {
    const s = stRef.current;
    const {
      selectedCustomer, newName, newPhone, amountRaw, installments, interestRate,
      firstDueDate, entryDate, periodKind, periodDays, description,
      accountMode, selectedAccountId, newAccountName,
      unifyEnabled, unifyInstallments, unifyPreview,
    } = s;
    const unifyFirstDueIsoAtual = parseBrDate(s.unifyFirstDue);

    const amountNum = parseCurrencyInput(amountRaw);
    if (!amountNum || amountNum <= 0) { toast.error("Valor inválido"); return; }

    const period = periodToPayload(periodKind, periodDays);
    const firstDue = parseBrDate(firstDueDate) || undefined;
    if (firstDueDate && !firstDue) { toast.error("Data inválida — use dd/mm/aaaa"); return; }

    const entryIso = parseBrDate(entryDate) || undefined;
    if (entryDate && entryDate.length === 10 && !entryIso) {
      toast.error("Data do lançamento inválida — use dd/mm/aaaa");
      return;
    }

    if (accountMode === "existing" && !selectedAccountId) {
      toast.error("Selecione um carnê");
      return;
    }

    // Valida unify
    if (unifyEnabled) {
      if (!unifyFirstDueIsoAtual) { toast.error("Informe a data da 1ª parcela unificada"); return; }
      const uN = parseInt(unifyInstallments, 10) || 0;
      if (uN < 1) { toast.error("Número de parcelas inválido"); return; }
      if (!unifyPreview) { toast.error("Aguarde o cálculo do preview"); return; }
    }

    let rate: number | undefined;
    if (interestRate.trim()) {
      rate = parseFloat(interestRate.replace(",", ".")) / 100;
      if (isNaN(rate) || rate < 0) { toast.error("Taxa de juros inválida"); return; }
    }

    // Quando unify ativo: lança com installments=1 (débito puro)
    const nInstallments = unifyEnabled ? 1 : (parseInt(installments, 10) || 1);
    if (!unifyEnabled && (nInstallments < 1 || nInstallments > MAX_INSTALLMENTS_CEILING)) {
      toast.error(`Parcelas: 1 a ${MAX_INSTALLMENTS_CEILING}`); return;
    }

    const payload: ManualEntryPayload = {
      customer_id:   selectedCustomer?.id,
      new_customer:  !selectedCustomer
        ? { name: newName.trim(), phone: newPhone.replace(/\D/g, "") }
        : undefined,
      amount:        amountNum,
      installments:  nInstallments,
      interest_rate: rate,
      first_due_date: firstDue,
      entry_date:    entryIso,
      period_unit:   period.period_unit,
      period_count:  period.period_count,
      description:   description.trim() || undefined,
      account_id:       accountMode === "existing" ? selectedAccountId : undefined,
      // Nome vazio não vai: o backend nomeia sozinho ("Lançamento de DD/MM").
      new_account:      accountMode === "new" ? true : undefined,
      new_account_name: accountMode === "new" ? (newAccountName.trim() || undefined) : undefined,
    };

    // Gerada uma única vez por sessão de submissão: se enviar() for chamado
    // de novo (retry manual após timeout), reenvia a MESMA key.
    if (!idempKeyRef.current) {
      idempKeyRef.current = "me-" + company!.id + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    }

    set({ loading: true });
    try {
      const result: ManualEntryResult | undefined = await creditApi.createManualEntry(company!.id, payload, idempKeyRef.current);

      // feat(unify): se unify ativo, aplicar o cronograma unificado
      let unificou = false;
      if (unifyEnabled && selectedAccountId && unifyFirstDueIsoAtual && selectedCustomer?.id) {
        const uN = parseInt(unifyInstallments, 10) || 1;
        try {
          await creditApi.applyUnify(company!.id, selectedCustomer.id, selectedAccountId, {
            amount: amountNum,
            installments: uN,
            first_due_date: unifyFirstDueIsoAtual,
            // sale_id não disponível no lançamento manual (ManualEntryResult não expõe sale_id)
          });
          unificou = true;
          toast.success("Lançamento criado e carnê unificado!");
        } catch (unifyErr: any) {
          // O débito já foi criado — informamos o erro do unify separadamente.
          toast.error(
            "Lançamento criado, mas a unificação falhou: " +
            (unifyErr?.message || "erro desconhecido") +
            ". Unifique manualmente na ficha do cliente."
          );
        }
      }

      qc.invalidateQueries({ queryKey: ["credit-balances",   company!.id] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard",  company!.id] });
      qc.invalidateQueries({ queryKey: ["credit-aging",      company!.id] });
      const customerIdFinal = result?.customer?.id ?? selectedCustomer?.id ?? null;
      if (customerIdFinal) {
        qc.invalidateQueries({ queryKey: ["credit-customer", company!.id, customerIdFinal] });
      }

      // Foto do que foi lançado, para a tela Pronto. Unificado: o cronograma
      // da prévia (é o que o applyUnify gravou). Senão: as parcelas que o
      // backend devolveu; backend sem elas → a conta local do rodapé.
      const v = calcularValores(s);
      const conta = (s.carnes?.accounts || []).find((a) => a.id === selectedAccountId) || null;
      const usarUnificado = unificou && !!unifyPreview;
      const doBackend = (result?.installments || []).filter((p) => p && p.due_date);
      if (!usarUnificado && doBackend.length > 0) {
        v.nParcelas = doBackend.length;
        v.valorParcela = Number(doBackend[0].amount_due) || v.valorParcela;
        v.datas = doBackend.map((p) => String(p.due_date).slice(0, 10));
      } else if (unifyEnabled && !usarUnificado) {
        // Unificação falhou: ficou só o débito (installments=1).
        v.nParcelas = 1;
        v.valorParcela = v.totalComJuros;
        v.datas = v.firstDueIso ? [v.firstDueIso] : [];
      }
      const resumo: ResumoDoLancamento = {
        customerId: customerIdFinal,
        customerName: selectedCustomer?.name || result?.customer?.name || newName.trim(),
        phone: selectedCustomer ? selectedCustomer.phone : newPhone,
        accountMode,
        accountId: result?.account_id,
        carneNome: accountMode === "new"
          ? (newAccountName.trim() || `Lançamento de ${entryDate.slice(0, 5)}`)
          : accountMode === "existing" ? (conta?.name || null) : null,
        valor: amountNum,
        total: usarUnificado ? unifyPreview!.total : v.totalComJuros,
        comJuros: !usarUnificado && v.rateNum > 0,
        parcelas: usarUnificado ? unifyPreview!.schedule.length : v.nParcelas,
        valorParcela: usarUnificado ? (unifyPreview!.schedule[0]?.amount_due ?? 0) : v.valorParcela,
        periodo: usarUnificado ? "" : rotuloDoPeriodo(periodKind, periodDays).toLowerCase(),
        datas: usarUnificado
          ? unifyPreview!.schedule.map((p) => String(p.due_date).slice(0, 10))
          : v.datas,
        comprado: description.trim(),
        novoSaldo: typeof result?.new_balance === "number" ? result.new_balance : null,
        unificado: usarUnificado,
      };
      set({ loading: false, unifyGateOpen: false, confirmarDescarte: false, step: "pronto", resultado: resumo });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar lançamento");
      set({ loading: false });
    }
  }, [company, qc, set]);

  // CTA do rodapé. feat(unify-confirm-gate): unificar cancela parcelas
  // existentes — nunca dispara direto no 1º toque.
  const pedirCriar = useCallback(() => {
    const s = stRef.current;
    if (s.loading) return;
    if (s.unifyEnabled) {
      if (!s.unifyPreview) return;
      set({ unifyGateOpen: true });
      return;
    }
    enviar();
  }, [enviar, set]);

  return {
    st,
    set,
    reset,
    valores,
    ...carnesDerivados,
    unifyFirstDueIso,
    preenchido,
    buscar,
    escolherCliente,
    confirmarNovoCliente,
    trocarCliente,
    alternarCarne,
    enviar,
    pedirCriar,
  };
}

export type LancamentoForm = ReturnType<typeof useLancamentoForm>;
