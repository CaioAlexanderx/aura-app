import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, useWindowDimensions,
  TextInput, Platform,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi, valorAPagarParcela } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import type { AgingRow, CreditBalanceItem } from "@/services/creditApi";
import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";
import { ClienteCrediarioModal } from "@/components/crediario/ClienteCrediarioModal";
import { CobrancaPreviewModal } from "@/components/crediario/CobrancaPreviewModal";

// ============================================================
// AURA. — Crediário (DESIGN-38 / Onda C — shell visual do mockup)
// C-1: hero + trio KPI + mapa de risco + chips + linha com avatar.
// C-3: mapa de risco CLICÁVEL — clicar numa faixa filtra a carteira.
// Lógica preservada: busca debounce, A–Z, atraso-por-data, cobrança, modais.
// Follow-up backend: pílulas Risco/Bloqueado + chip "Bloqueados"
// dependem de score/status por cliente no /balances (ainda não vem).
// ============================================================

var fmt = function(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

var fmtDate = function(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }); }
  catch { return ""; }
};

/** Hoje em America/Sao_Paulo no formato YYYY-MM-DD (tz-safe). */
function todaySP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Dias de atraso a partir de next_due_date (0 se em dia / sem data). */
function daysLate(nextDue?: string | null): number {
  if (!nextDue) return 0;
  const due = nextDue.slice(0, 10);
  const today = todaySP();
  if (due >= today) return 0;
  const a = new Date(due + "T00:00:00Z").getTime();
  const b = new Date(today + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Faixa de aging do cliente a partir dos dias de atraso (casa com AGING_ORDER). */
function agingBucket(dl: number): string {
  if (dl <= 0) return "a_vencer";
  if (dl <= 30) return "1_30_dias";
  if (dl <= 60) return "31_60_dias";
  if (dl <= 90) return "61_90_dias";
  return "acima_90";
}

/** Iniciais do cliente para o avatar. */
function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Atraso por DATA (fonte: backend /balances → overdue/next_due_date).
 * (1) campo overdue explícito; (2) next_due_date < hoje (tz-safe); (3) false.
 */
function isCustomerOverdue(cust: CreditBalanceItem & { overdue?: boolean; next_due_date?: string | null }): boolean {
  if (typeof cust.overdue === "boolean") return cust.overdue;
  if (cust.next_due_date) {
    const dueDateStr = cust.next_due_date.slice(0, 10);
    return dueDateStr < todaySP();
  }
  return false;
}

const AGING_LABELS: Record<string, string> = {
  a_vencer: "Em dia", "1_30_dias": "1–30 dias",
  "31_60_dias": "31–60 dias", "61_90_dias": "61–90 dias", acima_90: "60+ dias",
};

const AGING_COLORS: Record<string, string> = {
  a_vencer: Colors.green, "1_30_dias": Colors.amber,
  "31_60_dias": "#f97316", "61_90_dias": Colors.red, acima_90: "#ef4444",
};

const AGING_ORDER = ["a_vencer", "1_30_dias", "31_60_dias", "61_90_dias", "acima_90"];

type CobrancaPreviewState = {
  recipientName: string;
  phone: string;
  valorLabel?: string;
  valorDesc?: string;
  message: string;
};

type SortOrder = "balance" | "az";
type Filter = "saldo" | "atraso" | "dia";

export default function CrediarioScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [showCriar, setShowCriar] = useState(false);
  const [modalCust, setModalCust] = useState<{ id: string; name: string } | null>(null);
  const [cobrancaPreview, setCobrancaPreview] = useState<CobrancaPreviewState | null>(null);

  // ── Busca (DESIGN-38) ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearchQ(searchInput.trim()); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const [sortOrder, setSortOrder] = useState<SortOrder>("balance");
  const [filter, setFilter] = useState<Filter>("saldo");
  // C-3: faixa do mapa de risco selecionada (clique no aging filtra a carteira).
  const [agingFilter, setAgingFilter] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const isWide   = width > 720;
  const isNarrow = width < 500;

  const dashQ = useQuery({
    queryKey: ["credit-dashboard", company?.id],
    queryFn: () => creditApi.getDashboard(company!.id),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const agingQ = useQuery({
    queryKey: ["credit-aging", company?.id],
    queryFn: () => creditApi.getAging(company!.id),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const carteiraQ = useQuery({
    queryKey: ["credit-balances", company?.id, searchQ],
    queryFn: () => creditApi.listBalances(company!.id, { onlyOpen: true, q: searchQ || undefined }),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const rulesQ = useQuery({
    queryKey: ["credit-rules", company?.id],
    queryFn: () => creditApi.getCollectionRules(company!.id),
    enabled: !!company?.id,
    staleTime: 5 * 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["credit-dashboard", company?.id] }),
      qc.invalidateQueries({ queryKey: ["credit-aging", company?.id] }),
      qc.invalidateQueries({ queryKey: ["credit-balances", company?.id, searchQ] }),
    ]);
    setRefreshing(false);
  }, [company?.id, searchQ]);

  const handleCobrar = useCallback(async (customerId: string, customerName: string, phone: string | null) => {
    if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
    setTriggeringId(customerId);
    try {
      const detail = await creditApi.getCustomerHistory(company!.id, customerId);
      const store  = company?.name || "nossa loja";
      const pixKey = String((rulesQ.data as any)?.pix_key || "").trim();
      const debit  = (detail.transactions || []).find(t => t.type === "debit");
      const prodMatch = debit?.notes ? debit.notes.match(/\(([^)]+)\)/) : null;
      const products  = prodMatch ? prodMatch[1] : "";
      const buyDate   = debit ? fmtDate(debit.created_at) : "";
      const open = (detail.open_installments || []).slice()
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      const nextDue = open[0];

      const lines: string[] = [
        `Olá, ${customerName}! Tudo bem? Passando pra lembrar do seu crediário aqui na ${store}.`,
      ];
      if (debit) lines.push(`Referente à compra do dia ${buyDate}${products ? ` (${products})` : ""}.`);

      let valorLabel: string | undefined;
      let valorDesc: string | undefined;

      if (nextDue) {
        const valor = valorAPagarParcela(nextDue);
        valorLabel = fmt(valor);
        valorDesc = `Parcela ${nextDue.installment_number}/${nextDue.total_installments} · vence ${fmtDate(nextDue.due_date)}`;
        lines.push(`A parcela ${nextDue.installment_number}/${nextDue.total_installments} de ${fmt(valor)} vence em ${fmtDate(nextDue.due_date)}.`);
      } else {
        valorLabel = fmt(detail.balance);
        lines.push(`Seu saldo em aberto é de ${fmt(detail.balance)}.`);
      }
      if (pixKey) lines.push(`Chave Pix para pagamento: ${pixKey}`);
      lines.push(`— ${store}`);

      setCobrancaPreview({
        recipientName: customerName,
        phone,
        valorLabel,
        valorDesc,
        message: lines.join("\n\n"),
      });
    } catch {
      toast.error("Erro ao montar a cobrança");
    } finally {
      setTriggeringId(null);
    }
  }, [company?.id, company?.name, rulesQ.data]);

  const kpis = dashQ.data?.kpis;
  const aging: AgingRow[] = agingQ.data || [];
  const agingMap = Object.fromEntries(aging.map(r => [r.faixa, r]));
  const agingTotal = aging.reduce((s, r) => s + Number(r.amount), 0) || 1;

  const totalOpen = carteiraQ.data?.total_open || kpis?.total_open_amount || 0;
  const overdueAmount = kpis?.overdue_amount || 0;
  const inadPct = totalOpen > 0 ? Math.round((overdueAmount / totalOpen) * 100) : 0;

  // Carteira: filtros (chips/faixa) + ordenação.
  const carteiraRaw = carteiraQ.data?.customers || [];
  const carteira = [...carteiraRaw]
    .filter((c) => {
      // C-3: faixa de aging tem prioridade (vinda do clique no mapa de risco).
      if (agingFilter) return agingBucket(daysLate((c as any).next_due_date)) === agingFilter;
      if (filter === "atraso") return isCustomerOverdue(c as any);
      if (filter === "dia") return !isCustomerOverdue(c as any);
      return true; // saldo (todos com saldo aberto)
    })
    .sort((a, b) => {
      if (sortOrder === "az") return a.name.localeCompare(b.name, "pt-BR");
      // padrão: maior atraso primeiro, depois saldo desc
      const la = daysLate((a as any).next_due_date);
      const lb = daysLate((b as any).next_due_date);
      if (la !== lb) return lb - la;
      return Number(b.balance) - Number(a.balance);
    });

  const isLoading = dashQ.isLoading || agingQ.isLoading;

  const pad = isWide ? 32 : 16;

  if (isLoading) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { padding: pad }]}>
        <View style={{ marginBottom: 20 }}>
          <Text style={s.eyebrow}>Relacionamento · fiado</Text>
          <Text style={s.pageTitle}>Crediário</Text>
        </View>
        <View style={[s.heroRow, !isWide && { flexDirection: "column" }]}>
          <View style={[s.heroCard, { opacity: 0.5 }]}>
            <View style={{ width: 90, height: 10, borderRadius: 5, backgroundColor: Colors.border, marginBottom: 12 }} />
            <View style={{ width: 160, height: 36, borderRadius: 8, backgroundColor: Colors.border }} />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { padding: pad }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.violet3} />}
    >
      {/* ── Header: eyebrow + título + ação ── */}
      <View style={[s.headerRow, !isWide && s.headerRowMobile]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>Relacionamento · fiado</Text>
          <Text style={s.pageTitle}>Crediário</Text>
          <Text style={s.pageSubtitle} numberOfLines={2}>
            Ficha completa de cada cliente fiado — conta, parcelas e histórico num só lugar.
          </Text>
        </View>
        <View style={[{ flexDirection: "row", gap: 8 }, !isWide && { width: "100%" }]}>
          <Pressable onPress={() => setShowCriar(true)} style={[s.headerBtn, !isWide && s.headerBtnMobile]}>
            <Icon name="plus" size={15} color={Colors.violet3} />
            <Text style={s.headerBtnText}>Novo lançamento</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/crediario/settings" as any)} style={[s.headerBtnIcon, !isWide && { paddingHorizontal: 14 }]}>
            <Icon name="settings" size={15} color={Colors.violet3} />
          </Pressable>
        </View>
      </View>

      {/* ── Hero: EM ABERTO · TOTAL + trio KPI ── */}
      <View style={[s.heroRow, !isWide && { flexDirection: "column" }]}>
        <View style={[s.heroCard, isWide && { flex: 1.4 }]}>
          <Text style={s.heroLabel}>Em aberto · total</Text>
          <Text style={[s.heroValue, { fontSize: isNarrow ? 30 : 42 }]}>{fmt(totalOpen)}</Text>
          <Text style={s.heroMeta}>
            {(carteiraQ.data?.customers_open ?? carteiraRaw.length)} cliente(s) com saldo · visão consolidada multi-CNPJ
          </Text>
        </View>

        <View style={[s.kpiCol, isWide ? { flex: 2 } : { width: "100%" }]}>
          <View style={s.kpiGrid}>
            <View style={[s.kpiCard, { borderColor: Colors.red + "44" }]}>
              <View style={s.kpiHead}>
                <Text style={s.kpiLabel}>Vencido</Text>
                <View style={[s.kpiIcon, { backgroundColor: Colors.redD, borderColor: Colors.red + "44" }]}>
                  <Icon name="alert" size={13} color={Colors.red} />
                </View>
              </View>
              <Text style={[s.kpiValue, { color: Colors.red, fontSize: isNarrow ? 17 : 22 }]}>{fmt(overdueAmount)}</Text>
              <Text style={s.kpiMeta}>{kpis?.overdue_count || 0} parcelas em atraso</Text>
            </View>

            <View style={[s.kpiCard, { borderColor: Colors.green + "44" }]}>
              <View style={s.kpiHead}>
                <Text style={s.kpiLabel}>Recebido no mês</Text>
                <View style={[s.kpiIcon, { backgroundColor: Colors.greenD, borderColor: Colors.green + "44" }]}>
                  <Icon name="check" size={13} color={Colors.green} />
                </View>
              </View>
              <Text style={[s.kpiValue, { color: Colors.green, fontSize: isNarrow ? 17 : 22 }]}>{fmt(kpis?.paid_this_month_amount || 0)}</Text>
              <Text style={s.kpiMeta}>{kpis?.paid_this_month_count || 0} recebimentos</Text>
            </View>

            <View style={[s.kpiCard, { borderColor: Colors.amber + "44" }]}>
              <View style={s.kpiHead}>
                <Text style={s.kpiLabel}>Inadimplência</Text>
                <View style={[s.kpiIcon, { backgroundColor: "rgba(251,191,36,0.12)", borderColor: Colors.amber + "44" }]}>
                  <Icon name="percent" size={13} color={Colors.amber} />
                </View>
              </View>
              <Text style={[s.kpiValue, { color: Colors.amber, fontSize: isNarrow ? 17 : 22 }]}>{inadPct}%</Text>
              <Text style={s.kpiMeta}>do saldo em aberto</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Mapa de risco · aging do saldo (barra empilhada CLICÁVEL) ── */}
      {aging.length > 0 && (
        <View style={s.riskCard}>
          <View style={s.riskHead}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={s.riskTick} />
              <Text style={s.riskTitle}>Mapa de risco · aging do saldo</Text>
            </View>
            <Text style={s.riskMeta}>{agingFilter ? "toque p/ limpar" : "toque numa faixa p/ filtrar"}</Text>
          </View>

          <View style={s.stackBar}>
            {AGING_ORDER.map((faixa) => {
              const row = agingMap[faixa];
              const amt = row ? Number(row.amount) : 0;
              if (amt <= 0) return null;
              const pct = Math.max(2, Math.round((amt / agingTotal) * 100));
              return (
                <Pressable
                  key={faixa}
                  onPress={() => { setAgingFilter(prev => prev === faixa ? null : faixa); setFilter("saldo"); }}
                  style={{ width: (`${pct}%` as any), backgroundColor: AGING_COLORS[faixa], opacity: agingFilter && agingFilter !== faixa ? 0.35 : 1 }}
                />
              );
            })}
          </View>

          <View style={s.legendGrid}>
            {AGING_ORDER.map((faixa) => {
              const row = agingMap[faixa];
              if (!row) return null;
              return (
                <Pressable
                  key={faixa}
                  onPress={() => { setAgingFilter(prev => prev === faixa ? null : faixa); setFilter("saldo"); }}
                  style={[s.legendItem, agingFilter === faixa && s.legendItemActive]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <View style={[s.legendDot, { backgroundColor: AGING_COLORS[faixa] }]} />
                    <Text style={[s.legendLabel, agingFilter === faixa && { color: Colors.violet3 }]}>{AGING_LABELS[faixa]}</Text>
                  </View>
                  <Text style={s.legendAmount}>{fmt(row.amount)}</Text>
                  <Text style={s.legendCount}>{row.count} cliente(s)</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Busca + chips + A–Z ── */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar cliente…"
            placeholderTextColor={Colors.ink3}
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchInput.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setSearchInput("")} hitSlop={8}>
              <Icon name="x" size={13} color={Colors.ink3} />
            </Pressable>
          )}
        </View>

        <View style={s.chipRow}>
          <Pressable style={[s.chip, !agingFilter && filter === "saldo" && s.chipActive]} onPress={() => { setFilter("saldo"); setAgingFilter(null); }}>
            <Text style={[s.chipText, !agingFilter && filter === "saldo" && s.chipTextActive]}>Com saldo</Text>
          </Pressable>
          <Pressable style={[s.chip, !agingFilter && filter === "atraso" && s.chipActive]} onPress={() => { setFilter("atraso"); setAgingFilter(null); }}>
            <Text style={[s.chipText, !agingFilter && filter === "atraso" && s.chipTextActive]}>Em atraso</Text>
          </Pressable>
          <Pressable style={[s.chip, !agingFilter && filter === "dia" && s.chipActive]} onPress={() => { setFilter("dia"); setAgingFilter(null); }}>
            <Text style={[s.chipText, !agingFilter && filter === "dia" && s.chipTextActive]}>Em dia</Text>
          </Pressable>
          <Pressable style={[s.chip, sortOrder === "az" && s.chipActive]} onPress={() => setSortOrder(p => p === "az" ? "balance" : "az")}>
            <Text style={[s.chipText, sortOrder === "az" && s.chipTextActive]}>A–Z</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Carteira ── */}
      <View style={s.tableCard}>
        <View style={s.tableHeadRow}>
          <Text style={[s.th, { flex: 1 }]}>Cliente</Text>
          <Text style={[s.th, s.thRight, { width: 110 }]}>Saldo</Text>
          {isWide && <Text style={[s.th, { width: 92 }]}>Maior atraso</Text>}
          <Text style={[s.th, s.thRight, { width: isWide ? 96 : 64 }]}>Ações</Text>
        </View>

        {carteiraQ.isLoading ? (
          <View style={{ padding: 16 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ height: 16, borderRadius: 6, backgroundColor: Colors.border, opacity: 0.4, marginBottom: 12 }} />
            ))}
          </View>
        ) : carteira.length === 0 ? (
          <View style={{ paddingVertical: 28, alignItems: "center" }}>
            <Text style={s.emptyText}>
              {searchQ ? `Nenhum cliente encontrado para "${searchQ}".`
                : agingFilter ? `Nenhum cliente na faixa ${AGING_LABELS[agingFilter]}.`
                : filter === "atraso" ? "Nenhum cliente em atraso. 🎉"
                : "Nenhum cliente com saldo em aberto."}
            </Text>
          </View>
        ) : (
          carteira.map((cust) => {
            const overdue = isCustomerOverdue(cust as any);
            const dl = daysLate((cust as any).next_due_date);
            return (
              <Pressable key={cust.id} style={s.row} onPress={() => setModalCust({ id: cust.id, name: cust.name })}>
                {/* Cliente: avatar + nome + status */}
                <View style={s.rowClient}>
                  <View style={[s.avatar, { backgroundColor: overdue ? Colors.red : Colors.violet3 }]}>
                    <Text style={s.avatarText}>{initials(cust.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowName} numberOfLines={1}>{cust.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <View style={[s.statusDot, { backgroundColor: overdue ? Colors.red : Colors.green }]} />
                      <Text style={s.rowMeta} numberOfLines={1}>
                        {overdue ? "Em atraso" : "Em dia"}
                        {!isWide && dl > 0 ? ` · ${dl}d` : ""}
                        {cust.phone ? ` · ${cust.phone}` : ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Saldo */}
                <Text style={[s.rowBalance, { width: 110, color: overdue ? Colors.red : Colors.ink }]} numberOfLines={1}>
                  {fmt(cust.balance)}
                </Text>

                {/* Maior atraso (desktop) */}
                {isWide && (
                  <View style={{ width: 92 }}>
                    {dl > 0 ? (
                      <Text style={[s.lateText, { color: dl > 60 ? Colors.red : dl > 30 ? "#f97316" : Colors.amber }]}>● {dl} dias</Text>
                    ) : (
                      <Text style={s.lateTextOk}>—</Text>
                    )}
                  </View>
                )}

                {/* Ações */}
                <View style={[s.rowActions, { width: isWide ? 96 : 64 }]}>
                  <Pressable
                    style={[s.actBtn, triggeringId === cust.id && { opacity: 0.4 }]}
                    disabled={triggeringId === cust.id}
                    onPress={() => handleCobrar(cust.id, cust.name, cust.phone)}
                    hitSlop={6}
                  >
                    {triggeringId === cust.id
                      ? <ActivityIndicator size="small" color={Colors.green} />
                      : <Icon name="message_circle" size={15} color={Colors.green} />}
                  </Pressable>
                  <Icon name="chevron_right" size={15} color={Colors.ink3} />
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {carteira.length > 0 && (
        <Text style={s.footerCount}>
          {carteira.length} cliente{carteira.length !== 1 ? "s" : ""} · {agingFilter ? `faixa ${AGING_LABELS[agingFilter]} (toque na faixa p/ limpar)` : sortOrder === "az" ? "ordem alfabética" : "maior atraso primeiro"}
        </Text>
      )}

      <CriarLancamentoModal visible={showCriar} onClose={() => setShowCriar(false)} />

      <ClienteCrediarioModal
        visible={!!modalCust}
        companyId={company?.id || ""}
        customerId={modalCust?.id || null}
        customerName={modalCust?.name || null}
        pixKey={(rulesQ.data as any)?.pix_key || null}
        storeName={company?.name || null}
        onCobrar={handleCobrar}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["credit-balances", company?.id] });
          qc.invalidateQueries({ queryKey: ["credit-dashboard", company?.id] });
          qc.invalidateQueries({ queryKey: ["credit-aging", company?.id] });
        }}
        onClose={() => setModalCust(null)}
      />

      {cobrancaPreview && (
        <CobrancaPreviewModal
          visible={!!cobrancaPreview}
          recipientName={cobrancaPreview.recipientName}
          phone={cobrancaPreview.phone}
          valorLabel={cobrancaPreview.valorLabel}
          valorDesc={cobrancaPreview.valorDesc}
          initialMessage={cobrancaPreview.message}
          onClose={() => setCobrancaPreview(null)}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 48, maxWidth: 1040, alignSelf: "center", width: "100%" },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginBottom: 22 },
  headerRowMobile: { flexDirection: "column", alignItems: "stretch", gap: 14 },
  eyebrow: { fontSize: 10, fontWeight: "800", color: Colors.ink3, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 },
  pageTitle: { fontSize: 30, fontWeight: "800", color: Colors.ink, letterSpacing: -0.6, lineHeight: 32 },
  pageSubtitle: { fontSize: 12.5, color: Colors.ink3, marginTop: 8, maxWidth: 460 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: Colors.violetD, borderRadius: 11, borderWidth: 1, borderColor: Colors.border2 },
  headerBtnMobile: { flex: 1, justifyContent: "center" },
  headerBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  headerBtnIcon: { alignItems: "center", justifyContent: "center", paddingHorizontal: 12, backgroundColor: Colors.violetD, borderRadius: 11, borderWidth: 1, borderColor: Colors.border2 },

  // Hero
  heroRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  heroCard: {
    padding: 22, borderRadius: 20, borderWidth: 1, borderColor: Colors.violet + "55",
    backgroundColor: Colors.violetD, justifyContent: "center",
  },
  heroLabel: { fontSize: 10, fontWeight: "800", color: Colors.violet3, letterSpacing: 1.4, textTransform: "uppercase" },
  heroValue: { fontWeight: "800", color: Colors.ink, letterSpacing: -1, marginTop: 12, marginBottom: 10 },
  heroMeta: { fontSize: 12, color: Colors.ink3 },

  kpiCol: { justifyContent: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { flex: 1, minWidth: 150, backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  kpiHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  kpiLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  kpiIcon: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontWeight: "800", letterSpacing: -0.5 },
  kpiMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 6 },

  // Risk map
  riskCard: { backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  riskHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  riskTick: { width: 4, height: 14, borderRadius: 2, backgroundColor: Colors.violet3 },
  riskTitle: { fontSize: 11.5, fontWeight: "800", color: Colors.ink2, letterSpacing: 0.3 },
  riskMeta: { fontSize: 11, color: Colors.ink3 },
  stackBar: { flexDirection: "row", height: 14, borderRadius: 999, overflow: "hidden", backgroundColor: Colors.bg4, gap: 2 },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 14 },
  legendItem: { flex: 1, minWidth: 120, gap: 5, paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderLeftWidth: 1, borderLeftColor: Colors.border, borderRadius: 8 },
  legendItemActive: { backgroundColor: Colors.violetD, borderLeftColor: Colors.violet3 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: "600", color: Colors.ink2 },
  legendAmount: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  legendCount: { fontSize: 11, color: Colors.ink3 },

  // Toolbar
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, flex: 1, minWidth: 220, maxWidth: 360 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink, outlineStyle: "none" as any },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipActive: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  chipTextActive: { color: Colors.violet3 },

  // Table
  tableCard: { borderRadius: 18, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  tableHeadRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  th: { fontSize: 10, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.8, textTransform: "uppercase" },
  thRight: { textAlign: "right" },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  rowClient: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  rowName: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  rowMeta: { fontSize: 11, color: Colors.ink3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  rowBalance: { fontSize: 14, fontWeight: "800", textAlign: "right" },
  lateText: { fontSize: 12, fontWeight: "700" },
  lateTextOk: { fontSize: 12, color: Colors.ink3 },
  rowActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
  actBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.35)", alignItems: "center", justifyContent: "center" },

  footerCount: { fontSize: 11, color: Colors.ink3, textAlign: "right", marginTop: 10 },
  emptyText: { fontSize: 13, color: Colors.ink3 },
});
