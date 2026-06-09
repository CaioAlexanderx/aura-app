import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, useWindowDimensions,
  Platform,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi, valorAPagarParcela } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import type { AgingRow } from "@/services/creditApi";
import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";
import { ClienteCrediarioModal } from "@/components/crediario/ClienteCrediarioModal";
import { CobrancaPreviewModal } from "@/components/crediario/CobrancaPreviewModal";

var fmt = function(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

var fmtDate = function(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }); }
  catch { return ""; }
};

const SCORE_COLORS: Record<string, string> = {
  premium: Colors.green, bom: "#34d399", regular: Colors.amber,
  restrito: "#f97316", bloqueado: Colors.red,
};

const AGING_LABELS: Record<string, string> = {
  a_vencer: "A vencer", "1_30_dias": "1-30 dias",
  "31_60_dias": "31-60 dias", "61_90_dias": "61-90 dias", acima_90: "90+ dias",
};

const AGING_COLORS: Record<string, string> = {
  a_vencer: Colors.violet3, "1_30_dias": Colors.amber,
  "31_60_dias": "#f97316", "61_90_dias": Colors.red, acima_90: "#7f1d1d",
};

const AGING_ORDER = ["a_vencer", "1_30_dias", "31_60_dias", "61_90_dias", "acima_90"];

type CobrancaPreviewState = {
  recipientName: string;
  phone: string;
  valorLabel?: string;
  valorDesc?: string;
  message: string;
};

export default function CrediarioScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [showCriar, setShowCriar] = useState(false);
  const [modalCust, setModalCust] = useState<{ id: string; name: string } | null>(null);
  const [cobrancaPreview, setCobrancaPreview] = useState<CobrancaPreviewState | null>(null);

  // F3-3B (29/05/2026): IS_WIDE/IS_NARROW calculados em tempo de execucao via
  // useWindowDimensions, nao mais como constante de modulo (que nao recalculava em resize).
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

  // F3-3B (29/05/2026): Carteira completa -- todos os clientes com saldo > 0,
  // adimplentes inclusos (gestao de carteira, nao so inadimplencia).
  const carteiraQ = useQuery({
    queryKey: ["credit-balances", company?.id],
    queryFn: () => creditApi.listBalances(company!.id, { onlyOpen: true }),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  // Configurações (chave Pix p/ a mensagem de cobrança)
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
      qc.invalidateQueries({ queryKey: ["credit-balances", company?.id] }),
    ]);
    setRefreshing(false);
  }, [company?.id]);

  // Cobrança via preview modal: monta mensagem, abre preview.
  // O envio real (wa.me) acontece apenas no botão do CobrancaPreviewModal.
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
        // Entrega 2: usa valorAPagarParcela — nunca amount_due cheio
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

      // Entrega 3: abre preview em vez de Linking.openURL direto
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
  const topDefaulters = dashQ.data?.top_defaulters || [];
  const aging: AgingRow[] = agingQ.data || [];
  const agingMap = Object.fromEntries(aging.map(r => [r.faixa, r]));
  const agingTotal = aging.reduce((s, r) => s + Number(r.amount), 0) || 1;

  // Carteira: clientes com saldo, ordenados por valor (backend ja ordena desc).
  // Set de quem esta em atraso, para marcar visualmente sem separar em blocos.
  const carteira = carteiraQ.data?.customers || [];
  const overdueIds = new Set(topDefaulters.map(d => d.customer_id));

  const isLoading = dashQ.isLoading || agingQ.isLoading;

  // Skeleton de loading (substitui ActivityIndicator simples)
  if (isLoading) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { padding: isWide ? 32 : 16 }]}>
        <View style={[s.headerRow, !isWide && s.headerRowMobile]}>
          <View style={s.headerTitleGroup}>
            <View style={s.headerIconBox}><Icon name="percent" size={18} color={Colors.violet3} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.pageTitle}>Crediário</Text>
              <Text style={s.pageSubtitle} numberOfLines={1}>Controle de inadimplência e cobranças</Text>
            </View>
          </View>
        </View>
        <View style={s.kpiGrid}>
          {[0,1,2].map(i => (
            <View key={i} style={[s.kpiCard, { opacity: 0.4, minWidth: isWide ? 180 : "45%" as any }]}>
              <View style={{ width: 60, height: 9, borderRadius: 4, backgroundColor: Colors.border, marginBottom: 8 }} />
              <View style={{ width: 100, height: 22, borderRadius: 6, backgroundColor: Colors.border }} />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { padding: isWide ? 32 : 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.violet3} />}
    >
      {/* Header */}
      <View style={[s.headerRow, !isWide && s.headerRowMobile]}>
        <View style={s.headerTitleGroup}>
          <View style={s.headerIconBox}><Icon name="percent" size={18} color={Colors.violet3} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.pageTitle}>Crediário</Text>
            <Text style={s.pageSubtitle} numberOfLines={1}>Controle de inadimplência e cobranças</Text>
          </View>
        </View>
        <View style={[{ flexDirection: "row", gap: 8 }, !isWide && { width: "100%" }]}>
          <Pressable onPress={() => setShowCriar(true)} style={[s.settingsBtn, !isWide && s.headerBtnMobile]}>
            <Icon name="plus" size={15} color={Colors.violet3} />
            <Text style={s.settingsBtnText}>Lançamento</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/crediario/settings" as any)} style={[s.settingsBtn, !isWide && s.headerBtnMobile]}>
            <Icon name="settings" size={15} color={Colors.violet3} />
            <Text style={s.settingsBtnText}>Configurações</Text>
          </Pressable>
        </View>
      </View>

      {kpis && (
        <>
          {/* KPI Hero */}
          <View style={s.kpiGrid}>
            <View style={[s.kpiCard, s.kpiCardAccent, { minWidth: isWide ? 180 : "45%" as any }]}>
              <Text style={s.kpiLabel}>A RECEBER</Text>
              <Text style={[s.kpiValue, { color: Colors.violet3, fontSize: isNarrow ? 16 : 22 }]}>{fmt(kpis.total_open_amount)}</Text>
              <Text style={s.kpiMeta}>{kpis.total_open_count} parcelas abertas</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: Colors.red + "44", minWidth: isWide ? 180 : "45%" as any }]}>
              <Text style={s.kpiLabel}>EM ATRASO</Text>
              <Text style={[s.kpiValue, { color: Colors.red, fontSize: isNarrow ? 16 : 22 }]}>{fmt(kpis.overdue_amount)}</Text>
              <Text style={s.kpiMeta}>{kpis.overdue_count} parcelas · {kpis.defaulting_customers} clientes</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: Colors.green + "44", minWidth: isWide ? 180 : "45%" as any }]}>
              <Text style={s.kpiLabel}>RECEBIDO NO MÊS</Text>
              <Text style={[s.kpiValue, { color: Colors.green, fontSize: isNarrow ? 16 : 22 }]}>{fmt(kpis.paid_this_month_amount)}</Text>
              <Text style={s.kpiMeta}>{kpis.paid_this_month_count} pagamentos</Text>
            </View>
            {kpis.critical_amount > 0 && (
              <View style={[s.kpiCard, { borderColor: "#7f1d1d", minWidth: isWide ? 180 : "45%" as any }]}>
                <Text style={s.kpiLabel}>CRÍTICO (90+ dias)</Text>
                <Text style={[s.kpiValue, { color: "#ef4444", fontSize: isNarrow ? 16 : 22 }]}>{fmt(kpis.critical_amount)}</Text>
                <Text style={s.kpiMeta}>{kpis.critical_count} parcelas em risco</Text>
              </View>
            )}
          </View>

          {/* Carteira -- primeira secao: todos os clientes com saldo */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Carteira</Text>
              {carteira.length > 0 && (
                <Text style={s.sectionHeaderMeta}>
                  {carteira.length} cliente{carteira.length !== 1 ? "s" : ""} · {fmt(carteiraQ.data?.total_open || 0)}
                </Text>
              )}
            </View>

            {carteiraQ.isLoading ? (
              <View style={{ paddingVertical: 16 }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{ height: 14, borderRadius: 6, backgroundColor: Colors.border, opacity: 0.4, marginBottom: 10 }} />
                ))}
              </View>
            ) : carteira.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={s.emptyText}>Nenhum cliente com saldo em aberto.</Text>
              </View>
            ) : (
              carteira.map((cust) => {
                const isOverdue = overdueIds.has(cust.id);
                return (
                  <Pressable
                    key={cust.id}
                    style={s.debtorRow}
                    onPress={() => setModalCust({ id: cust.id, name: cust.name })}
                  >
                    <View style={s.debtorLeft}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <View style={[s.statusDot, { backgroundColor: isOverdue ? Colors.red : Colors.green }]} />
                        <Text style={s.debtorName} numberOfLines={1}>{cust.name}</Text>
                      </View>
                      <Text style={s.debtorMetaText}>
                        {isOverdue ? "Em atraso" : "Em dia"}
                        {cust.last_activity_at ? ` · ult. mov. ${fmtDate(cust.last_activity_at)}` : ""}
                      </Text>
                    </View>
                    <View style={s.carteiraRight}>
                      <Pressable
                        style={[s.waBtn, triggeringId === cust.id && { opacity: 0.4 }]}
                        disabled={triggeringId === cust.id}
                        onPress={() => handleCobrar(cust.id, cust.name, cust.phone)}
                      >
                        {triggeringId === cust.id
                          ? <ActivityIndicator size="small" color={Colors.green} />
                          : <Icon name="message_circle" size={14} color={Colors.green} />}
                      </Pressable>
                      <Text style={[s.debtorAmount, { color: isOverdue ? Colors.red : Colors.ink }]}>
                        {fmt(cust.balance)}
                      </Text>
                      <Icon name="chevron_right" size={14} color={Colors.ink3} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Aging */}
          {aging.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Distribuição por vencimento</Text>
              {AGING_ORDER.map(faixa => {
                const row = agingMap[faixa];
                if (!row) return null;
                const pct = Math.round((Number(row.amount) / agingTotal) * 100);
                const color = AGING_COLORS[faixa];
                return (
                  <View key={faixa} style={s.agingRow}>
                    <Text style={s.agingLabel}>{AGING_LABELS[faixa]}</Text>
                    <View style={s.agingBarWrap}>
                      <View style={[s.agingBar, { width: `${Math.max(pct, 2)}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={[s.agingAmount, { color }]}>{fmt(row.amount)}</Text>
                    <Text style={s.agingCount}>{row.count}x</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Top devedores */}
          {topDefaulters.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Maiores inadimplências</Text>
              {topDefaulters.map((d) => {
                const isTrig = triggeringId === d.customer_id;
                const daysLate = d.oldest_due_date
                  ? Math.max(0, Math.floor((Date.now() - new Date(d.oldest_due_date).getTime()) / 86400000))
                  : 0;
                return (
                  <Pressable
                    key={d.customer_id}
                    style={s.debtorRow}
                    onPress={() => setModalCust({ id: d.customer_id, name: d.customer_name })}
                  >
                    <View style={s.debtorLeft}>
                      <Text style={s.debtorName} numberOfLines={1}>{d.customer_name}</Text>
                      <View style={s.debtorMeta}>
                        <Text style={s.debtorMetaText}>
                          {d.overdue_count} parcela{d.overdue_count !== 1 ? "s" : ""} · {daysLate}d de atraso
                        </Text>
                        {d.credit_score !== undefined && (
                          <View style={[s.scorePill, { backgroundColor: (SCORE_COLORS[d.credit_status] || Colors.amber) + "22" }]}>
                            <Text style={[s.scorePillText, { color: SCORE_COLORS[d.credit_status] || Colors.amber }]}>
                              {d.credit_score}pts
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={s.debtorRight}>
                      <Text style={s.debtorAmount}>{fmt(d.total_overdue)}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {/* Cobrança WhatsApp unificada (mensagem rica + chave Pix) */}
                        <Pressable
                          style={[s.triggerBtn, isTrig && { opacity: 0.4 }]}
                          disabled={isTrig}
                          onPress={() => handleCobrar(d.customer_id, d.customer_name, d.phone)}
                        >
                          {isTrig
                            ? <ActivityIndicator size="small" color={Colors.violet3} />
                            : <Icon name="message_circle" size={13} color={Colors.violet3} />
                          }
                        </Pressable>
                        <Icon name="chevron_right" size={14} color={Colors.ink3} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {topDefaulters.length === 0 && kpis.overdue_count === 0 && (
            <View style={s.emptyState}>
              <Icon name="check" size={32} color={Colors.green} />
              <Text style={s.emptyTitle}>Tudo em dia!</Text>
              <Text style={s.emptyText}>Nenhuma parcela em atraso. Continue assim.</Text>
            </View>
          )}
        </>
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

      {/* Entrega 3: preview de cobrança antes de abrir WA */}
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
  content: { paddingBottom: 48, maxWidth: 900, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  headerRowMobile: { flexDirection: "column", alignItems: "stretch", gap: 14 },
  headerBtnMobile: { flex: 1, justifyContent: "center" },
  headerIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  settingsBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.violetD, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  settingsBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  kpiCardAccent: { borderColor: Colors.violet + "55" },
  kpiLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 8 },
  kpiValue: { fontWeight: "800", letterSpacing: -0.5 },
  kpiMeta: { fontSize: 10, color: Colors.ink3, marginTop: 4 },

  sectionCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 14 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionHeaderMeta: { fontSize: 10.5, color: Colors.ink3, fontWeight: "600", marginBottom: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  agingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  agingLabel: { fontSize: 11, color: Colors.ink3, width: 72 },
  agingBarWrap: { flex: 1, height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  agingBar: { height: "100%" as any, borderRadius: 3 },
  agingAmount: { fontSize: 11, fontWeight: "700", width: 90, textAlign: "right" },
  agingCount: { fontSize: 10, color: Colors.ink3, width: 28, textAlign: "right" },

  debtorRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  debtorLeft: { flex: 1, gap: 4 },
  debtorName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  debtorMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  debtorMetaText: { fontSize: 10.5, color: Colors.ink3 },
  scorePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  scorePillText: { fontSize: 9.5, fontWeight: "700" },
  debtorRight: { alignItems: "flex-end", gap: 6 },
  carteiraRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  waBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.35)", alignItems: "center", justifyContent: "center" },
  debtorAmount: { fontSize: 14, fontWeight: "800", color: Colors.red },
  triggerBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  emptyText: { fontSize: 13, color: Colors.ink3 },
});
