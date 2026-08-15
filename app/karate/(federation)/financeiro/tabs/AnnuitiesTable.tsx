// ============================================================
// AnnuitiesTable — Fase F2 · Shoji
//
// Tabela de cobranças (Dojôs | Praticantes) do hub de Anuidades.
// FlatList VIRTUALIZADA (troca o antigo `.map()` num ScrollView das
// DojoAnnuitiesTab/CpfAnnuitiesTab) — a FlatList é o ÚNICO scroller da
// página: o header (season/KPIs/chips, vindo do hub) + busca + chips de
// status + thead rolam junto com as linhas, mesmo padrão de
// Praticantes/Dojôs (fix de scroll de página inteira, 11/07/2026).
//
// Paginação REAL (page/pageSize/total do backend — GET /financial/
// annuities/dojos|cpf, Fase F2), nunca fatiada em memória.
//
// Regras de produto respeitadas:
//   - Ausência de cobrança (no_charge) É NEUTRA — nunca vermelha/alerta.
//   - em_dia = nenhuma parcela VENCIDA em aberto (parcela futura não conta).
//   - Nada aqui inativa por falta de pagamento — só "Remover cobrança"
//     (retirada do lançamento, NÃO estorno financeiro — a transaction
//     cancelada preserva a trilha), que é uma correção de lançamento, não
//     uma penalidade. Fase F4 estende essa mesma ação pro lote (barra de
//     seleção → VoidBatchModal, POST .../void-batch).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl, useWindowDimensions, ViewStyle, TextStyle, Platform, Clipboard,
} from "react-native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateShadows as SH,
} from "@/constants/karateTheme";
import { SearchField, Chip, Body } from "@/components/karate/shoji";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { PixPaymentModal } from "@/components/karate/PixPaymentModal";
import { LancarAnuidadeDojoModal } from "@/components/karate/LancarAnuidadeDojoModal";
import { LancarAnuidadeModal } from "@/components/karate/praticante-detalhe/LancarAnuidadeModal";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import {
  karateApi, DojoAnnuity, AnnuityStatusFilter, AnnuityStatus,
  AnnuityPaymentMethod, AnnuityReceiveResult, AnnuityDojoStatusFilter, AnnuityPractitionerStatusFilter,
} from "@/services/karateApi";
import { BatchLaunchModal } from "@/components/karate/BatchLaunchModal";
import { SendEmailBatchModal, EmailBatchTarget } from "@/components/karate/SendEmailBatchModal";
import { VoidBatchModal, VoidBatchTarget } from "@/components/karate/VoidBatchModal";
import { WhatsAppChargeModal, WhatsAppChargeTarget } from "@/components/karate/WhatsAppChargeModal";
import { BulkPayConfirmModal, BulkPayTarget } from "@/components/karate/BulkPayConfirmModal";
// Fase F4 — anuidade como recebível: folha de baixa livre (prévia FIFO ao
// vivo, contra o backend) e extrato do ledger de uma anuidade.
import { AnnuityReceiveModal } from "@/components/karate/AnnuityReceiveModal";
import { AnnuityStatementModal } from "@/components/karate/AnnuityStatementModal";
// Render de linha compartilhado (F5/F6) — mesma linha de recebível
// (barra devido/recebido, badge, trilha, painel expandido) usada aqui e
// na seção de Anuidades da página do dojô — fonte única, nunca duas
// implementações paralelas do mesmo recebível.
import {
  AnnuityReceivableRow, AnnuityRowVM, toRowVM, classifyInstallments, fmtMoney, PLAN_LABEL,
} from "@/components/karate/AnnuityReceivableRow";
import type { SegKey } from "./AnnuitiesHub";

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 350;

// ── Barra de multi-seleção ────────────────────────────────────────
// Fase F3: a mesma seleção agora alimenta DUAS ações, cada uma só olhando
// pro subconjunto que faz sentido pra ela — "Registrar pagamento" ignora
// linhas sem cobrança, "Lançar cobrança" (POST .../batch) ignora linhas
// que já têm cobrança (o backend as devolveria em `skipped[]` de qualquer
// forma, mas filtrar aqui deixa a intenção clara pro operador).
function BulkBar({
  count, payableCount, noChargeCount, emailCount, onClear, onOpenBulkPay, onCopyMessage, onBulkLaunch, onBulkEmail, onBulkVoid,
}: {
  count: number; payableCount: number; noChargeCount: number; emailCount: number;
  onClear: () => void; onOpenBulkPay: () => void; onCopyMessage: () => void;
  onBulkLaunch: () => void; onBulkEmail: () => void; onBulkVoid: () => void;
}) {
  if (count === 0) return null;
  // Mockup (.floatbar): pílula ESCURA (ink) flutuante, sombra, cantos
  // arredondados — nunca uma barra clara edge-to-edge. Ordem dos botões
  // segue o mockup (Registrar pagamento → Enviar por e-mail → Copiar
  // mensagem), com "Lançar cobrança em lote" (aditivo da F3, sem
  // equivalente no mockup) por último. "Limpar seleção" é texto no canto
  // direito (mockup .clear), não um ícone X à esquerda.
  //
  // BUGFIX P0 (11/07/2026): "Registrar pagamento" NUNCA muta no clique
  // direto — onOpenBulkPay só abre o BulkPayConfirmModal (contagem + valor
  // total + confirmar/cancelar separados). Era o único botão da barra sem
  // esse passo (todos os outros já abriam modal) e já causou baixa
  // acidental de 3 anuidades reais em produção. A baixa em si (e o
  // spinner) agora vivem dentro do modal, não aqui.
  return (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkCount}>{count} selecionado{count === 1 ? "" : "s"}</Text>
      {payableCount > 0 && (
        <TouchableOpacity style={styles.bulkBtn} onPress={onOpenBulkPay} accessibilityRole="button" accessibilityLabel="Registrar pagamento em lote">
          <Icon name="checkmark" size={13} color={P.paperWarm} />
          <Text style={styles.bulkBtnLabel}>Registrar pagamento</Text>
        </TouchableOpacity>
      )}
      {/* Envio de e-mail em lote (Fase F4) — POST .../send-email-batch, via
          SendEmailBatchModal (prévia + contagem antes de enviar, resultado
          sent/skipped/errors — alvo sem e-mail cadastrado é pulado, nunca
          erro). Só aparece quando ao menos 1 selecionado tem parcela
          pendente pra cobrar (mesmo critério de "Registrar pagamento"). */}
      {emailCount > 0 && (
        <TouchableOpacity style={styles.bulkBtn} onPress={onBulkEmail} accessibilityRole="button" accessibilityLabel="Enviar cobrança por e-mail em lote">
          <Icon name="mail" size={13} color={P.paperWarm} />
          <Text style={styles.bulkBtnLabel}>Enviar por e-mail</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.bulkBtn} onPress={onCopyMessage} accessibilityRole="button" accessibilityLabel="Copiar mensagem de cobrança">
        <Icon name="copy-outline" size={13} color={P.paperWarm} />
        <Text style={styles.bulkBtnLabel}>Copiar mensagem</Text>
      </TouchableOpacity>
      {/* Retirada de cobrança em lote (Fase F4) — POST .../void-batch, via
          VoidBatchModal (confirmação destrutiva + contagem). É retirada do
          lançamento, NÃO estorno financeiro — o backend já pula (não erra)
          parcela paga ou NFS-e emitida, com motivo claro no resultado. */}
      {payableCount > 0 && (
        <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnWarn]} onPress={onBulkVoid} accessibilityRole="button" accessibilityLabel="Retirar cobrança em lote">
          <Icon name="trash-outline" size={13} color="#fff" />
          <Text style={[styles.bulkBtnLabel, { color: "#fff" }]}>Retirar cobrança</Text>
        </TouchableOpacity>
      )}
      {noChargeCount > 0 && (
        <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnWarn]} onPress={onBulkLaunch} accessibilityRole="button" accessibilityLabel="Lançar cobrança em lote">
          <Icon name="add" size={13} color="#fff" />
          <Text style={[styles.bulkBtnLabel, { color: "#fff" }]}>Lançar cobrança{noChargeCount > 1 ? ` (${noChargeCount})` : ""}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onClear} accessibilityRole="button" accessibilityLabel="Limpar seleção" style={styles.bulkClear}>
        <Text style={styles.bulkClearLabel}>Limpar seleção</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Header estável da FlatList (season header do hub + busca + chips + thead) ──
type TableHeaderProps = {
  headerElement: React.ReactNode;
  q: string; onChangeQ: (t: string) => void;
  statusFilter: AnnuityStatusFilter; onStatusFilter: (s: AnnuityStatusFilter) => void;
  total: number; seg: SegKey; showThead: boolean;
};
const TableHeader = React.memo(function TableHeader(p: TableHeaderProps) {
  return (
    <View>
      {p.headerElement}
      <View style={[styles.pocoCap, SH.sunken]}>
        <SearchField
          value={p.q}
          onChangeText={p.onChangeQ}
          placeholder={p.seg === "dojo" ? "Buscar por nome do dojô ou código FPKT..." : "Buscar por nome ou matrícula..."}
          style={{ marginBottom: 14 }}
        />
        {/* Chips de status (mockup .chips) — seleção única (rádio), mesmo
            statusFilter que os KPIs do hub também dirigem (clicar aqui
            reflete lá e vice-versa, uma fonte única de verdade). "Todos"
            volta ao estado sem filtro.
            BUGFIX P2 — taxonomia unificada (11/07/2026): existiam TRÊS
            nomes pra "atrasado" no hub — o KPI dizia "Atrasado" (alias
            overdue ∪ defaulting ∪ suspended, mesma regra de
            karateAnnuitySummary.js), e esta linha de chips tinha "Vencido"
            (só overdue, 0-90d) E "Inadimplente" (só defaulting, 91-180d) —
            sem chip nenhum pra 'suspended' (>180d). Resultado: 3 rótulos
            pro que o gestor lê como o mesmo conceito, com 3 números
            diferentes. Agora o chip usa o MESMO alias 'atrasado' que o
            KPI — mesmo nome, mesmo número, sempre (ver STATUS_ALIASES em
            karateAnnuities.js, backend). O badge por LINHA continua
            mostrando o estágio granular (Vencido/Inadimplente, ver
            annuityStatusView em karateTheme.ts) — isso é detalhe
            informativo por registro, não um filtro agregado, então não
            reabre a confusão. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Chip label="Todos" active={p.statusFilter === "all"} onPress={() => p.onStatusFilter("all")} />
          <Chip label="Pago" active={p.statusFilter === "paid"} onPress={() => p.onStatusFilter("paid")} />
          <Chip label="A vencer" active={p.statusFilter === "due"} onPress={() => p.onStatusFilter("due")} />
          <Chip label="Atrasado" active={p.statusFilter === "atrasado"} onPress={() => p.onStatusFilter("atrasado")} />
          <Chip label="Sem cobrança" active={p.statusFilter === "no_charge"} onPress={() => p.onStatusFilter("no_charge")} />
        </View>
        <Body muted style={{ fontSize: 11.5, marginBottom: 6 }}>{p.total} {p.total === 1 ? "registro" : "registros"} na temporada</Body>
        {/* Fase F5 (mockup v2) — thead reduzido a 2 colunas reais (Dojô/
            Praticante + Saldo): "Plano" virou pílula inline no nome,
            "Parcelas" e "Total" viraram a barra + legenda sob o nome —
            nenhuma informação sumiu, só o cabeçalho de tabela parou de
            listar como colunas o que agora é lido dentro da própria
            célula (razão do "ainda parece tabela" apontado pelo Caio). */}
        {p.showThead && (
          <View style={styles.thead}>
            <View style={{ width: 22 }} />
            <Text style={[styles.th, { flex: 2 }]}>{p.seg === "dojo" ? "Dojô" : "Praticante"}</Text>
            <Text style={[styles.th, { width: 150, textAlign: "right" }]}>Saldo</Text>
            <View style={{ width: 96 }} />
          </View>
        )}
      </View>
    </View>
  );
});

// ── Componente principal ──────────────────────────────────────────
interface Props {
  federationId: string;
  seg: SegKey;
  year: string;
  statusFilter: AnnuityStatusFilter;
  onStatusFilterChange: (s: AnnuityStatusFilter) => void;
  /** Filtro ativo/inativo do segmento Dojô (PR #413, backend) — vem do hub
   *  (AnnuitiesHub), fonte única compartilhada com o summary/KPIs. Só é
   *  usado quando seg==="dojo" (listCpfAnnuities não tem esse parâmetro). */
  dojoStatus: AnnuityDojoStatusFilter;
  /** Filtro ativo/inativo do segmento Praticante — F6.5 (13/08/2026,
   *  backend). Mesmo espírito de dojoStatus, vem do hub como fonte única
   *  compartilhada com o summary/KPIs. Só é usado quando seg==="cpf". */
  cpfStatus: AnnuityPractitionerStatusFilter;
  onMutated: () => void;
  headerElement: React.ReactNode;
}

export function AnnuitiesTable({ federationId, seg, year, statusFilter, onStatusFilterChange, dojoStatus, cpfStatus, onMutated, headerElement }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [items, setItems] = useState<AnnuityRowVM[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS); return () => clearTimeout(t); }, [q]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [voidTargetKey, setVoidTargetKey] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [chargeTargetKey, setChargeTargetKey] = useState<string | null>(null);
  // F4.5 (23/07/2026, PR #432 aura-backend) — "Editar" da anuidade de
  // dojô, independente do status (antes só existia pra não-paga). Mesmo
  // padrão non-null-é-sinal-de-aberto de chargeTargetKey acima; abre o
  // MESMO LancarAnuidadeDojoModal (mode="edit"), que já tem plano +
  // parcelas carregados a partir da própria linha da tabela (sem fetch
  // extra — a listagem já traz installments/plan, ver toRowVM).
  // F6.5 (13/08/2026) — mesmo estado (editTargetKey) agora abre também
  // LancarAnuidadeModal (mode="edit") para seg==="cpf", ver bloco de
  // modais mais abaixo.
  const [editTargetKey, setEditTargetKey] = useState<string | null>(null);
  const [pixTarget, setPixTarget] = useState<{ installmentId: string; amount: number; label: string } | null>(null);
  // BUGFIX P0 (11/07/2026) — "Registrar pagamento" em lote agora exige
  // confirmação (BulkPayConfirmModal), mesmo padrão de
  // emailModalTargets/voidModalTargets abaixo: não-nulo (mesmo array
  // vazio) é o sinal de "modal aberto", nunca reaproveita um array antigo
  // depois de fechado.
  const [bulkPayTargets, setBulkPayTargets] = useState<BulkPayTarget[] | null>(null);
  const [bulkPayNoPending, setBulkPayNoPending] = useState(0);
  // Fase F3 — lançar cobrança em lote (POST .../batch) pras linhas
  // selecionadas que ainda não têm cobrança nesta temporada.
  const [batchLaunchOpen, setBatchLaunchOpen] = useState(false);
  // Fase F4 — envio manual de e-mail (single via botão da parcela, lote via
  // barra de seleção) e retirada de cobrança em lote. `emailModalTargets`
  // não-nulo (mesmo vazio) é o sinal de "modal aberto" (mesmo padrão de
  // batchLaunchOpen/voidModalTargets abaixo) — nunca reaproveitamos um
  // array antigo depois de fechado (sempre null on close).
  const [emailModalTargets, setEmailModalTargets] = useState<EmailBatchTarget[] | null>(null);
  const [emailModalNoPending, setEmailModalNoPending] = useState(0);
  const [voidModalTargets, setVoidModalTargets] = useState<VoidBatchTarget[] | null>(null);
  // Alvo do WhatsApp aberto a partir de um "pulado" do SendEmailBatchModal
  // (sem e-mail cadastrado) — nunca aberto com o SendEmailBatchModal ainda
  // visível (armadilha Modal-dentro-de-Modal); ver onOpenWhatsApp abaixo.
  const [waTarget, setWaTarget] = useState<WhatsAppChargeTarget | null>(null);
  // Fase F4 — anuidade como recebível: folha de baixa livre (por rowId/
  // annuity_id) e extrato. `receiveTargetKey`/`statementTargetKey` não-nulo
  // é o sinal de "modal aberto" (mesmo padrão de emailModalTargets/
  // voidModalTargets acima) — nunca os dois abertos ao mesmo tempo
  // (armadilha Modal-dentro-de-Modal: cada open* fecha qualquer outro modal
  // transiente primeiro, ver openReceive/openStatement abaixo).
  const [receiveTargetKey, setReceiveTargetKey] = useState<string | null>(null);
  const [statementTargetKey, setStatementTargetKey] = useState<string | null>(null);

  // Volta pra página 1 sempre que o filtro/busca/segmento/ano/dojo_status/
  // practitioner_status muda; limpa seleção (evita agir sobre linhas que
  // já não estão na tela). BUGFIX real já visto no roster: trocar de
  // filtro sem resetar a página deixa a lista vazia (ex.: página 3 de
  // "Ativos" pode não existir em "Inativos") sem explicar o motivo pro
  // operador.
  useEffect(() => { setPage(1); setSelected(new Set()); setExpandedKey(null); }, [seg, year, statusFilter, dojoStatus, cpfStatus, debouncedQ]);

  // Condição de corrida: cada fetch carrega um id incremental; só a
  // resposta MAIS RECENTE pode escrever no estado (mesmo padrão de
  // DojosListTab/CadastralTab). Trocar o filtro dojo_status/practitioner_status
  // rápido demais (ou junto de outro filtro) antes disparava duas
  // requisições concorrentes e a mais lenta podia sobrescrever a lista
  // com dados do recorte errado.
  const reqIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      // dojo_status só existe na rota de dojô (PR #413) e practitioner_status
      // só na rota de CPF (F6.5) — cada um só entra no payload quando o seg
      // correspondente está ativo. Mesmo valor que o hub manda pro summary
      // (getAnnuitySummary) nesse mesmo recorte — garante que lista e KPIs
      // nunca divergem.
      const params = seg === "dojo"
        ? { status: statusFilter, year, q: debouncedQ || undefined, page, pageSize: PAGE_SIZE, dojo_status: dojoStatus }
        : { status: statusFilter, year, q: debouncedQ || undefined, page, pageSize: PAGE_SIZE, practitioner_status: cpfStatus };
      const res = seg === "dojo"
        ? await karateApi.listDojoAnnuities(federationId, params)
        : await karateApi.listCpfAnnuities(federationId, params);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta
      setItems(res.data.map((it) => toRowVM(seg, it)));
      setTotal(res.total);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setError(true);
    } finally {
      if (myReq === reqIdRef.current) {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    }
  }, [federationId, seg, year, statusFilter, dojoStatus, cpfStatus, debouncedQ, page]);
  useEffect(() => { load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Ações de parcela ────────────────────────────────────────────
  const handlePayInstallment = useCallback(async (instId: string, method: AnnuityPaymentMethod) => {
    try {
      await karateApi.payInstallment(federationId, instId, { payment_method: method });
      toast.success("Pagamento registrado");
      load(true);
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar o pagamento.");
      throw e;
    }
  }, [federationId, load, onMutated]);

  const handleEditInstallment = useCallback(async (instId: string, body: { amount?: number; due_date?: string }) => {
    try {
      await karateApi.updateInstallment(federationId, instId, body);
      toast.success("Parcela atualizada");
      load(true);
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível editar a parcela.");
      throw e;
    }
  }, [federationId, load, onMutated]);

  const handleVoid = useCallback(async () => {
    if (!voidTargetKey) return;
    const vm = items.find((i) => i.key === voidTargetKey);
    if (!vm || !vm.rowId) { setVoidTargetKey(null); return; }
    setVoiding(true);
    try {
      await karateApi.voidAnnuityGeneric(federationId, vm.rowId);
      toast.success("Cobrança removida");
      setVoidTargetKey(null);
      load(true);
      onMutated();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover a cobrança.");
    } finally {
      setVoiding(false);
    }
  }, [voidTargetKey, items, federationId, load, onMutated]);

  // ── Fase F4 — folha de baixa livre / extrato do recebível ───────────
  // Cada open* fecha qualquer OUTRO modal transiente antes de abrir o seu
  // (mesma disciplina do resto do arquivo — nunca dois <Modal> montados ao
  // mesmo tempo, armadilha Modal-dentro-de-Modal no RN Web).
  const openReceive = useCallback((key: string) => {
    setStatementTargetKey(null);
    setPixTarget(null);
    setChargeTargetKey(null);
    setVoidTargetKey(null);
    setEditTargetKey(null);
    setReceiveTargetKey(key);
  }, []);
  const closeReceive = useCallback(() => setReceiveTargetKey(null), []);

  const openStatement = useCallback((key: string) => {
    setReceiveTargetKey(null);
    setPixTarget(null);
    setChargeTargetKey(null);
    setVoidTargetKey(null);
    setEditTargetKey(null);
    setStatementTargetKey(key);
  }, []);
  const closeStatement = useCallback(() => setStatementTargetKey(null), []);

  // F4.5 — "Editar" da anuidade (header): fecha qualquer outro modal
  // transiente antes (mesma disciplina de openReceive/openStatement acima
  // — nunca dois <Modal> montados ao mesmo tempo).
  const openEdit = useCallback((key: string) => {
    setReceiveTargetKey(null);
    setStatementTargetKey(null);
    setPixTarget(null);
    setChargeTargetKey(null);
    setVoidTargetKey(null);
    setEditTargetKey(key);
  }, []);
  const closeEdit = useCallback(() => setEditTargetKey(null), []);

  // Sucesso da baixa — a lista e os KPIs (via onMutated, que recarrega o
  // summary no hub) leem a MESMA fonte pós-baixa: um refetch real do
  // backend (load(true)), nunca um patch otimista da linha em memória.
  // Isso é deliberado (evita a família de bug "estado duplicado" — mutação
  // escreve numa lista, UI lê outra — já documentada nas armadilhas desta
  // tela) mesmo custando um round-trip extra.
  const handleReceiveSuccess = useCallback((_result: AnnuityReceiveResult) => {
    setReceiveTargetKey(null);
    load(true);
    onMutated();
  }, [load, onMutated]);

  const receiveTargetVm = items.find((i) => i.key === receiveTargetKey) || null;
  const statementTargetVm = items.find((i) => i.key === statementTargetKey) || null;
  const editTargetVm = items.find((i) => i.key === editTargetKey) || null;
  // Shape DojoAnnuity mínimo pra alimentar LancarAnuidadeDojoModal
  // (mode="edit") a partir da própria linha da tabela — já tem
  // plan/installments carregados (GET /financial/annuities/dojos, Fase F2),
  // sem round-trip extra. due_date aqui é só preenchimento defensivo (o
  // modal em modo edição usa installments[].due_date, não este campo).
  const editAnnuityVm: DojoAnnuity | null = editTargetVm ? {
    dojo_id: editTargetVm.key,
    dojo_name: editTargetVm.name,
    reference_period: editTargetVm.referencePeriod,
    amount: editTargetVm.amount,
    due_date: editTargetVm.dueDate || "",
    paid_at: null,
    status: editTargetVm.status as AnnuityStatus,
    plan: editTargetVm.plan,
    installments: editTargetVm.installments,
    paid_total: editTargetVm.paidTotal,
    total: editTargetVm.total,
  } : null;
  // F6.5 — shape mínimo pra alimentar LancarAnuidadeModal (mode="edit")
  // quando seg==="cpf": só amount/due_date/reference_period (CPF é sempre
  // 1x/ano, sem plano/parcelas configuráveis — ver AnnuityCpfUpdateInput).
  const editCpfAnnuityVm: { amount: number; due_date: string; reference_period: string } | null = editTargetVm ? {
    amount: editTargetVm.amount,
    due_date: editTargetVm.dueDate || "",
    reference_period: editTargetVm.referencePeriod,
  } : null;

  // ── Multi-seleção — pagamento em lote (nunca all-or-nothing silencioso) ──
  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const selectedRows = useMemo(() => items.filter((i) => selected.has(i.key) && i.rowId), [items, selected]);
  // Fase F3 — subconjunto sem cobrança da MESMA seleção: alimenta o
  // "Lançar cobrança em lote" (BatchLaunchModal → POST .../batch). Linhas
  // que já têm cobrança ficam de fora daqui (essas são o alvo de
  // handleOpenBulkPay acima) — cada ação olha só pro que faz sentido pra ela.
  const noChargeSelectedRows = useMemo(() => items.filter((i) => selected.has(i.key) && !i.rowId), [items, selected]);

  // Fase F4 — mesmo critério de "achar a parcela acionável" que
  // handleOpenBulkPay já usa (vencida ou a_vencer): é a parcela que faz
  // sentido cobrar agora. Conta quantos dos selecionados TÊM essa parcela
  // (emailPayableCount, alimenta o botão da barra) sem precisar abrir o
  // modal — o modal em si recalcula na hora de montar os targets.
  //
  // Decisão consciente (trilha adaptável a split payments, ver
  // classifyInstallments acima): NÃO inclui "parcial" aqui de propósito.
  // Esses fluxos legados de LOTE (e-mail/"Registrar pagamento") mostram
  // `inst.amount` (valor cheio) ao operador antes de confirmar —
  // BulkPayConfirmModal em particular é um componente com histórico de bug
  // P0 de dinheiro (ver comentário no próprio arquivo), então trocar esse
  // valor pro saldo em aberto (amount - amount_paid) merece revisão própria,
  // fora do escopo desta mudança (só a trilha). Uma parcela parcial
  // permanece acionável pelo fluxo "Receber" por linha (split-aware, F4) —
  // ela só não entra automaticamente nesses atalhos em lote por enquanto.
  const emailPayableCount = useMemo(() => selectedRows.filter(
    (vm) => classifyInstallments(vm.installments).some((c) => c.state === "vencida" || c.state === "a_vencer")
  ).length, [selectedRows]);

  // Envio manual — linha (parcela específica, já sabida pelo caller) ──
  const handleOpenRowEmail = useCallback((vm: AnnuityRowVM, instId: string) => {
    const inst = vm.installments.find((i) => i.id === instId);
    if (!inst) return;
    setEmailModalNoPending(0);
    setEmailModalTargets([{
      key: `${vm.key}-${inst.id}`,
      instId: inst.id,
      name: vm.name,
      whatsapp: vm.whatsapp,
      amount: inst.amount,
      referencePeriod: vm.referencePeriod,
      dueDate: inst.due_date,
      status: vm.status as AnnuityStatus,
    }]);
  }, []);

  // Envio manual — lote (barra de seleção) — mesma seleção de
  // handleOpenBulkPay, cada linha contribui com sua parcela vencida/a_vencer
  // (uma por linha; se não tiver nenhuma pendente, entra em noPendingCount
  // — informativo, não é erro, mostrado no modal antes de confirmar).
  // "parcial" fica de fora aqui pelo mesmo motivo documentado em
  // emailPayableCount acima.
  const handleOpenBulkEmail = useCallback(() => {
    const targets: EmailBatchTarget[] = [];
    let noPending = 0;
    selectedRows.forEach((vm) => {
      const c = classifyInstallments(vm.installments).find((x) => x.state === "vencida" || x.state === "a_vencer");
      if (!c) { noPending += 1; return; }
      targets.push({
        key: `${vm.key}-${c.inst.id}`,
        instId: c.inst.id,
        name: vm.name,
        whatsapp: vm.whatsapp,
        amount: c.inst.amount,
        referencePeriod: vm.referencePeriod,
        dueDate: c.inst.due_date,
        status: vm.status as AnnuityStatus,
      });
    });
    setEmailModalNoPending(noPending);
    setEmailModalTargets(targets);
  }, [selectedRows]);

  // Retirada de cobrança em lote — annuity_id de cada linha selecionada
  // que tem cobrança (mesmo subconjunto de handleOpenBulkPay). Não filtramos
  // paga/NFS-e aqui: o backend já pula (não erra) esses casos com motivo
  // claro (has_paid_installment / has_nfse) — filtrar client-side só
  // duplicaria essa regra e poderia ficar desatualizado.
  const handleOpenVoidBatch = useCallback(() => {
    const targets: VoidBatchTarget[] = selectedRows
      .filter((vm) => !!vm.rowId)
      .map((vm) => ({ annuityId: vm.rowId as string, name: vm.name, referencePeriod: vm.referencePeriod }));
    setVoidModalTargets(targets);
  }, [selectedRows]);

  // BUGFIX P0 (11/07/2026) — antes disparava a baixa DIRETO no clique do
  // botão da barra (handleBulkPay chamado por onBulkPay sem passo
  // intermediário nenhum); um clique exploratório no QA marcou 3
  // anuidades reais como pagas. Agora só MONTA os alvos (mesmo critério de
  // handleOpenBulkEmail: parcela vencida ou a_vencer) e abre o
  // BulkPayConfirmModal — a baixa em si só acontece depois do operador
  // confirmar explicitamente lá dentro (contagem + valor total visíveis
  // antes de mutar).
  // "parcial" fica de fora aqui pelo mesmo motivo documentado em
  // emailPayableCount acima (BulkPayConfirmModal exibe inst.amount cheio,
  // não o saldo em aberto — trocar isso é fora do escopo desta mudança).
  const handleOpenBulkPay = useCallback(() => {
    const targets: BulkPayTarget[] = [];
    let noPending = 0;
    selectedRows.forEach((vm) => {
      const c = classifyInstallments(vm.installments).find((x) => x.state === "vencida" || x.state === "a_vencer");
      if (!c) { noPending += 1; return; }
      targets.push({
        key: `${vm.key}-${c.inst.id}`,
        instId: c.inst.id,
        name: vm.name,
        amount: c.inst.amount,
        referencePeriod: vm.referencePeriod,
      });
    });
    setBulkPayNoPending(noPending);
    setBulkPayTargets(targets);
  }, [selectedRows]);

  const handleCopyMessage = useCallback(() => {
    const rows = items.filter((i) => selected.has(i.key));
    if (rows.length === 0) return;
    const lines = rows.map((r, idx) => {
      const owed = Math.max(0, r.total - r.paidTotal);
      return `${idx + 1}. ${r.name}${r.code ? ` (${r.code})` : ""} — ${fmtMoney(owed)} em aberto${r.dueDate ? ` — vencimento ${formatIsoToBr(r.dueDate)}` : ""}`;
    });
    const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.total - r.paidTotal), 0);
    const msg = `Cobranças em aberto — Anuidades ${seg === "dojo" ? "Dojô" : "Praticantes"} · temporada ${year}\n\n${lines.join("\n")}\n\nTotal em aberto: ${fmtMoney(totalOwed)}`;
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(msg).catch(() => {});
    } else {
      Clipboard.setString(msg);
    }
    toast.success("Mensagem copiada");
  }, [items, selected, seg, year]);

  const chargeTargetVm = items.find((i) => i.key === chargeTargetKey) || null;

  if (error) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={<View>{headerElement}</View>}
        ListEmptyComponent={<KarateErrorState onRetry={() => load()} style={{ paddingVertical: 60 }} />}
        contentContainerStyle={styles.pageScroll}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        ListHeaderComponent={
          <TableHeader
            headerElement={headerElement}
            q={q} onChangeQ={setQ}
            statusFilter={statusFilter} onStatusFilter={onStatusFilterChange}
            total={total} seg={seg} showThead={wide && items.length > 0}
          />
        }
        ListFooterComponent={
          <View style={styles.pocoFoot}>
            {pageCount > 1 && (
              <View style={styles.pagerRow}>
                <Text style={styles.pagerInfo}>Página {page} de {pageCount} · {total} registros</Text>
                <View style={styles.pagerBtns}>
                  <TouchableOpacity
                    style={[styles.pagerBtn, page <= 1 && styles.pagerBtnOff]}
                    disabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Página anterior"
                  >
                    <Icon name="chevron-back" size={13} color={C.ink} />
                    <Text style={styles.pagerBtnTxt}>Anterior</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pagerBtn, page >= pageCount && styles.pagerBtnOff]}
                    disabled={page >= pageCount}
                    onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Próxima página"
                  >
                    <Text style={styles.pagerBtnTxt}>Próxima</Text>
                    <Icon name="chevron-forward" size={13} color={C.ink} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.pocoItem}>
            {loading ? (
              <View style={{ paddingTop: 8 }}>
                {[1, 2, 3, 4].map((k) => <View key={k} style={styles.skeletonRow} />)}
              </View>
            ) : (
              <KarateEmptyState
                icon="document-text-outline"
                title={q.trim() ? "Nenhum registro encontrado" : "Sem cobranças neste filtro"}
                subtitle={q.trim() ? "Ajuste a busca ou o filtro de status." : "Ausência de cobrança não é inadimplência — é um convite a cobrar."}
                style={{ paddingVertical: 40 }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.pocoItem}>
            <AnnuityReceivableRow
              vm={item}
              seg={seg}
              wide={wide}
              federationId={federationId}
              selected={selected.has(item.key)}
              // Fase F3: seleção agora cobre TAMBÉM linhas sem cobrança
              // (no_charge) — são o alvo real de "Lançar cobrança em lote"
              // (POST .../batch). Linhas com cobrança seguem usáveis pra
              // "Registrar pagamento em lote" (ambas as ações filtram a
              // seleção pelo que fizer sentido pra cada uma — ver
              // selectedRows / noChargeSelectedRows abaixo).
              selectable
              expanded={expandedKey === item.key}
              onToggleSelect={() => toggleSelect(item.key)}
              onToggleExpand={() => setExpandedKey((k) => (k === item.key ? null : item.key))}
              onPay={handlePayInstallment}
              onPix={(instId, amount, label) => setPixTarget({ installmentId: instId, amount, label: `${item.name} — ${label}` })}
              onEdit={handleEditInstallment}
              onSendEmail={(instId) => handleOpenRowEmail(item, instId)}
              onVoid={() => setVoidTargetKey(item.key)}
              onLaunch={() => setChargeTargetKey(item.key)}
              voidConfirming={voidTargetKey === item.key}
              onVoidConfirm={handleVoid}
              onVoidCancel={() => setVoidTargetKey(null)}
              voiding={voiding}
              onReceive={() => openReceive(item.key)}
              onStatement={() => openStatement(item.key)}
              onEditAnnuity={() => openEdit(item.key)}
            />
          </View>
        )}
        contentContainerStyle={styles.pageScroll}
        style={{ flex: 1, width: "100%" }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      />

      <BulkBar
        count={selected.size}
        payableCount={selectedRows.length}
        noChargeCount={noChargeSelectedRows.length}
        emailCount={emailPayableCount}
        onClear={() => setSelected(new Set())}
        onOpenBulkPay={handleOpenBulkPay}
        onCopyMessage={handleCopyMessage}
        onBulkLaunch={() => setBatchLaunchOpen(true)}
        onBulkEmail={handleOpenBulkEmail}
        onBulkVoid={handleOpenVoidBatch}
      />

      {batchLaunchOpen && (
        <BatchLaunchModal
          visible={batchLaunchOpen}
          federationId={federationId}
          year={year}
          seg={seg}
          targets={noChargeSelectedRows.map((r) => ({ id: r.key, name: r.name }))}
          onClose={() => setBatchLaunchOpen(false)}
          onDone={() => {
            setBatchLaunchOpen(false);
            setSelected(new Set());
            load(true);
            onMutated();
          }}
        />
      )}

      {/* BUGFIX P0 (11/07/2026) — confirmação antes de "Registrar
          pagamento" em lote (contagem + valor total + confirmar/cancelar
          separados). Ver comentário de handleOpenBulkPay acima. */}
      {bulkPayTargets && (
        <BulkPayConfirmModal
          visible={!!bulkPayTargets}
          federationId={federationId}
          targets={bulkPayTargets}
          noPendingCount={bulkPayNoPending}
          onClose={() => setBulkPayTargets(null)}
          onDone={() => { setBulkPayTargets(null); setSelected(new Set()); load(true); onMutated(); }}
        />
      )}

      {pixTarget && (
        <PixPaymentModal
          visible={!!pixTarget}
          federationId={federationId}
          target={{ installmentId: pixTarget.installmentId }}
          amount={pixTarget.amount}
          description={`Anuidade — ${pixTarget.label}`}
          isAdmin
          onSuccess={() => { setPixTarget(null); load(true); onMutated(); }}
          onClose={() => setPixTarget(null)}
        />
      )}

      {chargeTargetVm && seg === "dojo" && (
        <LancarAnuidadeDojoModal
          visible={!!chargeTargetVm}
          mode="charge"
          federationId={federationId}
          dojoId={chargeTargetVm.key}
          dojoName={chargeTargetVm.name}
          onClose={() => setChargeTargetKey(null)}
          onDone={() => { setChargeTargetKey(null); load(true); onMutated(); }}
        />
      )}
      {chargeTargetVm && seg === "cpf" && (
        <LancarAnuidadeModal
          visible={!!chargeTargetVm}
          federationId={federationId}
          practitionerId={chargeTargetVm.key}
          practitionerName={chargeTargetVm.name}
          onClose={() => setChargeTargetKey(null)}
          onDone={() => { setChargeTargetKey(null); load(true); onMutated(); }}
        />
      )}

      {/* Fase F4 — envio manual de e-mail (linha OU lote, mesmo modal —
          reaproveita a confirmação com prévia + contagem e o resultado
          sent/skipped/errors pros dois casos). "Concluir" recarrega a
          lista (parcela pode ter mudado de estado no log da régua) e
          limpa a seleção (relevante só no caso de lote). */}
      {emailModalTargets && (
        <SendEmailBatchModal
          visible={!!emailModalTargets}
          federationId={federationId}
          targets={emailModalTargets}
          noPendingCount={emailModalNoPending}
          onClose={() => setEmailModalTargets(null)}
          onDone={() => { setEmailModalTargets(null); setSelected(new Set()); load(true); onMutated(); }}
          onOpenWhatsApp={(t) => { setEmailModalTargets(null); setWaTarget(t); }}
        />
      )}

      {/* Fase F4 — retirada de cobrança em lote (destrutivo, com
          confirmação + contagem antes de agir). */}
      {voidModalTargets && (
        <VoidBatchModal
          visible={!!voidModalTargets}
          federationId={federationId}
          targets={voidModalTargets}
          onClose={() => setVoidModalTargets(null)}
          onDone={() => { setVoidModalTargets(null); setSelected(new Set()); load(true); onMutated(); }}
        />
      )}

      {/* WhatsApp — só abre depois que o SendEmailBatchModal já fechou
          (onOpenWhatsApp acima), nunca com os dois <Modal> montados ao
          mesmo tempo (armadilha Modal-dentro-de-Modal no RN Web). */}
      {waTarget && (
        <WhatsAppChargeModal
          visible={!!waTarget}
          federationId={federationId}
          target={waTarget}
          onClose={() => setWaTarget(null)}
        />
      )}

      {/* Fase F4 — folha de baixa livre (prévia FIFO ao vivo contra
          /receive/preview, confirmação via /receive). Só abre quando a
          linha tem cobrança (rowId) — mesma guarda que o botão "Receber"
          já aplica antes de chamar onReceive. */}
      {receiveTargetVm && receiveTargetVm.rowId && (
        <AnnuityReceiveModal
          visible={!!receiveTargetVm}
          federationId={federationId}
          annuityId={receiveTargetVm.rowId}
          name={receiveTargetVm.name}
          code={receiveTargetVm.code}
          planLabel={receiveTargetVm.plan ? PLAN_LABEL[receiveTargetVm.plan] : null}
          referencePeriod={receiveTargetVm.referencePeriod}
          dueTotal={receiveTargetVm.total}
          paidTotal={receiveTargetVm.paidTotal}
          installments={receiveTargetVm.installments}
          onClose={closeReceive}
          onSuccess={handleReceiveSuccess}
        />
      )}

      {/* Fase F4 — extrato do recebível (GET .../payments). F4.5 — cada
          baixa listada ganha editar/remover (dentro do próprio modal,
          inline — ver AnnuityStatementModal); onMutated recarrega a MESMA
          lista/KPIs que qualquer outra mutação desta tela recarrega
          (load(true) + onMutated), fonte única, sem patch otimista. */}
      {statementTargetVm && statementTargetVm.rowId && (
        <AnnuityStatementModal
          visible={!!statementTargetVm}
          federationId={federationId}
          annuityId={statementTargetVm.rowId}
          name={statementTargetVm.name}
          onClose={closeStatement}
          onMutated={() => { load(true); onMutated(); }}
        />
      )}

      {/* F4.5 — editar a anuidade de DOJÔ (valor/plano/parcelas),
          independente do status. `editAnnuityVm` já vem com
          plan/installments da própria linha da tabela (sem fetch extra).
          onDone recarrega lista/KPIs pela mesma via de sempre
          (load(true) + onMutated). */}
      {editTargetVm && editTargetVm.rowId && seg === "dojo" && (
        <LancarAnuidadeDojoModal
          visible={!!editTargetVm}
          mode="edit"
          federationId={federationId}
          dojoId={editTargetVm.key}
          dojoName={editTargetVm.name}
          annuityId={editTargetVm.rowId}
          annuity={editAnnuityVm}
          onClose={closeEdit}
          onDone={() => { closeEdit(); load(true); onMutated(); }}
        />
      )}

      {/* F6.5 (13/08/2026) — editar a anuidade CPF (valor/vencimento/
          período), independente do status. Mesmo padrão do bloco de
          dojô acima: `editCpfAnnuityVm` já vem da própria linha da
          tabela (sem fetch extra); onDone recarrega lista/KPIs pela
          mesma via de sempre. */}
      {editTargetVm && editTargetVm.rowId && seg === "cpf" && (
        <LancarAnuidadeModal
          visible={!!editTargetVm}
          mode="edit"
          federationId={federationId}
          practitionerId={editTargetVm.key}
          practitionerName={editTargetVm.name}
          annuityId={editTargetVm.rowId}
          annuity={editCpfAnnuityVm}
          onClose={closeEdit}
          onDone={() => { closeEdit(); load(true); onMutated(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageScroll: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 96 } as ViewStyle,

  // marginTop propositalmente ausente: o espaçamento até o header vem do
  // próprio RaisedHeader (marginBottom: 28, ver AnnuitiesHub) — mesma fonte
  // única de verdade usada em Praticantes/Dojôs (pocoCap não duplica a margem).
  pocoCap: { backgroundColor: P.paper2, borderTopWidth: 1.5, borderTopColor: C.line2, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 20 } as ViewStyle,
  pocoItem: { backgroundColor: P.paper2, paddingHorizontal: 24 } as ViewStyle,
  pocoFoot: { backgroundColor: P.paper2, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 } as ViewStyle,

  thead: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,

  skeletonRow: { height: 56, borderRadius: R.md, backgroundColor: C.line, opacity: 0.4, marginBottom: 8 } as ViewStyle,
  pagerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingTop: 12 } as ViewStyle,
  pagerInfo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  pagerBtns: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass } as ViewStyle,
  pagerBtnOff: { opacity: 0.4 } as ViewStyle,
  pagerBtnTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,

  // Mockup .floatbar: pílula ink flutuante (não uma barra clara
  // edge-to-edge) — cantos arredondados, sombra projetada, margem lateral
  // (não cola nas bordas da tela) e sticky no rodapé da viewport.
  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 9,
    position: Platform.OS === "web" ? ("sticky" as any) : "relative", bottom: 16,
    marginHorizontal: 24, marginTop: 18,
    backgroundColor: P.ink, borderRadius: R.lg,
    paddingVertical: 11, paddingHorizontal: 18, flexWrap: "wrap",
    ...(Platform.OS === "web" ? ({ boxShadow: "0 8px 28px rgba(43,38,32,0.30)" } as any) : {}),
  } as ViewStyle,
  bulkCount: { fontSize: 12.5, fontWeight: "700", color: P.paperWarm, marginRight: 2 } as TextStyle,
  bulkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1, borderColor: "rgba(255,253,248,0.22)", backgroundColor: "rgba(255,253,248,0.10)" } as ViewStyle,
  bulkBtnWarn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  bulkBtnLabel: { fontSize: 12, fontWeight: "700", color: P.paperWarm } as TextStyle,
  bulkClear: { marginLeft: "auto" } as ViewStyle,
  bulkClearLabel: { fontSize: 12.5, color: P.paperWarm, opacity: 0.65 } as TextStyle,
});
