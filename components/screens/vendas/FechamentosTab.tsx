import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Modal, Platform } from "react-native";
import { useQueries } from "@tanstack/react-query";

import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/stores/auth";
import { caixaApi, type CaixaSessaoHistorico } from "@/services/caixaApi";

// ============================================================
// AURA. — FechamentosTab (Vendas › Fechamentos de Caixa)
//
// 09/05/2026: Aba dedicada ao acompanhamento dos fechamentos de
// caixa. Hero KPIs (mes corrente) + chips de filtro (multi-CNPJ
// + status) + tabela cronológica + drawer com detalhe.
//
// Multi-CNPJ: em consolidated, dispara 1 fetch /caixa/historico
// por empresa do user e merge dos resultados. Em single-company,
// 1 fetch só.
//
// Endpoint: GET /companies/:id/caixa/historico — já existente, sem
// novas rotas no backend. KPIs computados client-side a partir das
// sessões retornadas.
// ============================================================

type Row = CaixaSessaoHistorico & {
  company_id: string;
  company_name: string;
};

type StatusFilter = "all" | "ok" | "sobra" | "falta";

function fmt(v: number | null | undefined): string {
  const n = typeof v === "number" ? v : parseFloat((v as any) || "0");
  if (!isFinite(n)) return "R$ 0,00";
  return "R$ " + n.toFixed(2).replace(".", ",");
}

function fmtSigned(v: number): string {
  if (!isFinite(v)) v = 0;
  const abs = Math.abs(v).toFixed(2).replace(".", ",");
  if (v > 0) return "+R$ " + abs;
  if (v < 0) return "−R$ " + abs;
  return "R$ 0,00";
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function isCurrentMonth(iso: string): boolean {
  try {
    const d = new Date(iso);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  } catch { return false; }
}

function statusOf(diferenca: number | null | undefined): StatusFilter {
  const n = typeof diferenca === "number" ? diferenca : parseFloat((diferenca as any) || "0");
  if (!isFinite(n) || Math.abs(n) < 0.01) return "ok";
  return n > 0 ? "sobra" : "falta";
}

export function FechamentosTab() {
  const { company, consolidatedView, availableCompanies } = useAuthStore();

  // Lista de empresas a consultar: em consolidated, todas; em single, só a ativa.
  const companiesToFetch = useMemo(function() {
    if (consolidatedView) {
      return (availableCompanies || []).map(function(c: any) {
        return { id: c.id, name: c.trade_name || c.legal_name || c.name || "Empresa" };
      });
    }
    if (company?.id) return [{ id: company.id, name: (company as any).trade_name || company.name || "Empresa" }];
    return [];
  }, [consolidatedView, availableCompanies, company]);

  // 1 query por empresa — useQueries roda em paralelo
  const queries = useQueries({
    queries: companiesToFetch.map(function(c) {
      return {
        queryKey: ["fechamentos-historico", c.id],
        queryFn: function() { return caixaApi.historico(c.id, { limit: 50 }); },
        staleTime: 60_000,
        retry: 1,
      };
    }),
  });

  const isLoading = queries.some(function(q) { return q.isLoading; });
  const isError = queries.some(function(q) { return q.isError; });

  // Merge: tagueia cada sessão com company_id + company_name e ordena desc por data
  const allRows: Row[] = useMemo(function() {
    const rows: Row[] = [];
    queries.forEach(function(q, idx) {
      const c = companiesToFetch[idx];
      if (!c || !q.data) return;
      (q.data.sessoes || []).forEach(function(s: CaixaSessaoHistorico) {
        rows.push({ ...s, company_id: c.id, company_name: c.name });
      });
    });
    rows.sort(function(a, b) {
      return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
    });
    return rows;
  }, [queries.map(function(q) { return q.data; }).join("|"), companiesToFetch]);

  // Filtros
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(function() {
    return allRows.filter(function(r) {
      if (companyFilter !== "all" && r.company_id !== companyFilter) return false;
      if (statusFilter === "all") return true;
      return statusOf(r.diferenca) === statusFilter;
    });
  }, [allRows, companyFilter, statusFilter]);

  // KPIs do mês corrente (independem dos filtros — sempre o agregado total)
  const kpis = useMemo(function() {
    const inMonth = allRows.filter(function(r) { return isCurrentMonth(r.opened_at); });
    const count = inMonth.length;
    const total = inMonth.reduce(function(acc, r) {
      return acc + (typeof r.total_geral === "number" ? r.total_geral : parseFloat((r.total_geral as any) || "0"));
    }, 0);
    let comSobra = 0, comFalta = 0, somaDif = 0;
    let durMin = 0, durCount = 0;
    inMonth.forEach(function(r) {
      const dif = typeof r.diferenca === "number" ? r.diferenca : parseFloat((r.diferenca as any) || "0");
      if (Math.abs(dif) >= 0.01) {
        if (dif > 0) comSobra++; else comFalta++;
        somaDif += Math.abs(dif);
      }
      if (r.opened_at && r.closed_at) {
        const d = (new Date(r.closed_at).getTime() - new Date(r.opened_at).getTime()) / 60000;
        if (isFinite(d) && d > 0) { durMin += d; durCount++; }
      }
    });
    const divCount = comSobra + comFalta;
    const divMedia = divCount > 0 ? somaDif / divCount : 0;
    const ticketMed = count > 0 ? total / count : 0;
    const durMed = durCount > 0 ? durMin / durCount : 0;
    return { count, total, divCount, divMedia, comSobra, comFalta, ticketMed, durMed };
  }, [allRows]);

  // Drawer
  const [selected, setSelected] = useState<Row | null>(null);

  return (
    <View style={s.wrap}>
      <Hero kpis={kpis} consolidated={consolidatedView} />

      <View style={s.filterBar}>
        {companiesToFetch.length > 1 && (
          <>
            <FilterChip label="Todas as empresas" count={allRows.length} active={companyFilter === "all"}
              onPress={function() { setCompanyFilter("all"); }} />
            {companiesToFetch.map(function(c) {
              const cnt = allRows.filter(function(r) { return r.company_id === c.id; }).length;
              return (
                <FilterChip key={c.id} label={c.name} count={cnt} active={companyFilter === c.id}
                  onPress={function() { setCompanyFilter(c.id); }} />
              );
            })}
            <View style={s.filterDivider} />
          </>
        )}
        <FilterChip label="Todos" count={allRows.length} active={statusFilter === "all"}
          onPress={function() { setStatusFilter("all"); }} />
        <FilterChip label="Sem divergência" count={allRows.filter(function(r) { return statusOf(r.diferenca) === "ok"; }).length}
          active={statusFilter === "ok"} onPress={function() { setStatusFilter("ok"); }} />
        <FilterChip label="Com sobra" count={allRows.filter(function(r) { return statusOf(r.diferenca) === "sobra"; }).length}
          active={statusFilter === "sobra"} onPress={function() { setStatusFilter("sobra"); }} />
        <FilterChip label="Com falta" count={allRows.filter(function(r) { return statusOf(r.diferenca) === "falta"; }).length}
          active={statusFilter === "falta"} onPress={function() { setStatusFilter("falta"); }} />
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.violet3} />
          <Text style={{ marginTop: 12, color: Colors.ink3, fontSize: 13 }}>Carregando fechamentos…</Text>
        </View>
      ) : isError ? (
        <EmptyState
          icon="alert"
          iconColor={Colors.red}
          title="Erro ao carregar fechamentos"
          subtitle="Tente atualizar a página. Se persistir, contate o suporte."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Nenhum fechamento encontrado"
          subtitle={
            companyFilter !== "all" || statusFilter !== "all"
              ? "Ajuste os filtros pra ver outras sessões"
              : "Nenhum caixa fechado ainda. Os fechamentos aparecem aqui depois que você fecha uma sessão."
          }
        />
      ) : (
        <FechamentosTable
          rows={filtered}
          showCompanyCol={companiesToFetch.length > 1}
          onRowClick={setSelected}
        />
      )}

      <DrawerModal row={selected} onClose={function() { setSelected(null); }} />
    </View>
  );
}

// ── Hero KPIs ──────────────────────────────────────────────────────────────

type KpiData = {
  count: number; total: number;
  divCount: number; divMedia: number;
  comSobra: number; comFalta: number;
  ticketMed: number; durMed: number;
};

function Hero(props: { kpis: KpiData; consolidated: boolean }) {
  const { kpis, consolidated } = props;
  const monthLabel = new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });
  return (
    <View style={s.hero}>
      <View style={s.heroHead}>
        <Text style={s.heroEyebrow}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          {consolidated ? " · Multi-CNPJ" : ""}
        </Text>
        <Text style={s.heroTitle}>Fechamentos de Caixa</Text>
      </View>
      <View style={s.kpiStrip}>
        <Kpi label="Fechamentos no mês" value={String(kpis.count)} hint={kpis.count === 1 ? "1 sessão" : kpis.count + " sessões"} />
        <Kpi label="Total fechado" value={fmt(kpis.total)} tone="good" hint={kpis.count > 0 ? "ticket médio " + fmt(kpis.ticketMed) : "—"} />
        <Kpi
          label="Divergência média"
          value={kpis.divCount > 0 ? fmt(kpis.divMedia) : "R$ 0,00"}
          tone={kpis.divCount > 0 ? "alert" : "neutral"}
          hint={kpis.divCount > 0
            ? kpis.comSobra + " com sobra · " + kpis.comFalta + " com falta"
            : "todos os caixas bateram"}
        />
        <Kpi
          label="Tempo médio aberto"
          value={kpis.durMed > 0 ? formatDuration(kpis.durMed) : "—"}
          hint={kpis.count > 0 ? kpis.count + " sessões medidas" : "sem dados"}
        />
      </View>
    </View>
  );
}

function formatDuration(min: number): string {
  if (!isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return m + "min";
  if (m === 0) return h + "h";
  return h + "h " + m + "min";
}

function Kpi(props: { label: string; value: string; hint?: string; tone?: "good" | "alert" | "neutral" }) {
  const { label, value, hint, tone } = props;
  const valueColor =
    tone === "good"  ? Colors.green
    : tone === "alert" ? Colors.amber
    : Colors.ink;
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={s.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

// ── Filter Chip ─────────────────────────────────────────────────────────────

function FilterChip(props: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const { label, count, active, onPress } = props;
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      {typeof count === "number" && (
        <Text style={[s.chipCount, active && s.chipCountActive]}>{count}</Text>
      )}
    </Pressable>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

function FechamentosTable(props: { rows: Row[]; showCompanyCol: boolean; onRowClick: (r: Row) => void }) {
  const { rows, showCompanyCol, onRowClick } = props;
  return (
    <View style={s.table}>
      <View style={[s.thead, IS_WEB && ({ display: "grid", gridTemplateColumns: showCompanyCol ? "1fr 1.4fr 1.2fr 1fr 1fr 1fr 1fr" : "1.2fr 1.4fr 1fr 1fr 1fr 1fr", gap: 12 } as any)]}>
        <Th>Abertura</Th>
        {showCompanyCol && <Th>Empresa</Th>}
        <Th>Operador</Th>
        <Th align="right">Total</Th>
        <Th align="right">Esperado</Th>
        <Th align="right">Contado</Th>
        <Th>Status</Th>
      </View>
      {rows.map(function(r, i) {
        const st = statusOf(r.diferenca);
        return (
          <Pressable
            key={r.id}
            onPress={function() { onRowClick(r); }}
            style={[
              s.row,
              IS_WEB && ({ display: "grid", gridTemplateColumns: showCompanyCol ? "1fr 1.4fr 1.2fr 1fr 1fr 1fr 1fr" : "1.2fr 1.4fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "center" } as any),
              i % 2 === 1 && s.rowAlt,
            ]}
          >
            <Td>{fmtDateTime(r.opened_at)}</Td>
            {showCompanyCol && (
              <Td><CompanyPill name={r.company_name} /></Td>
            )}
            <Td truncate>{r.opened_by_name || "—"}</Td>
            <Td align="right" mono>{fmt(r.total_geral)}</Td>
            <Td align="right" mono>{fmt(r.dinheiro_esperado)}</Td>
            <Td align="right" mono>{fmt(r.dinheiro_contado)}</Td>
            <Td>
              {st === "ok" ? (
                <StatusPill kind="ok">OK</StatusPill>
              ) : (
                <StatusPill kind={st}>{fmtSigned(typeof r.diferenca === "number" ? r.diferenca : parseFloat((r.diferenca as any) || "0"))}</StatusPill>
              )}
            </Td>
          </Pressable>
        );
      })}
    </View>
  );
}

const IS_WEB = Platform.OS === "web";

function Th(props: { children: any; align?: "right" }) {
  return (
    <Text style={[s.th, props.align === "right" && { textAlign: "right" }]}>
      {props.children}
    </Text>
  );
}

function Td(props: { children: any; align?: "right"; mono?: boolean; truncate?: boolean }) {
  return (
    <Text
      style={[
        s.td,
        props.align === "right" && { textAlign: "right" },
        props.mono && { fontVariant: ["tabular-nums"] as any },
      ]}
      numberOfLines={props.truncate ? 1 : undefined}
    >
      {props.children}
    </Text>
  );
}

function CompanyPill(props: { name: string }) {
  return (
    <View style={s.companyPill}>
      <Text style={s.companyPillText} numberOfLines={1}>{props.name}</Text>
    </View>
  );
}

function StatusPill(props: { kind: "ok" | "sobra" | "falta"; children: any }) {
  const bg =
    props.kind === "ok" ? Colors.greenD
    : props.kind === "sobra" ? Colors.amberD
    : Colors.redD;
  const fg =
    props.kind === "ok" ? Colors.green
    : props.kind === "sobra" ? Colors.amber
    : Colors.red;
  return (
    <View style={[s.statusPill, { backgroundColor: bg }]}>
      <Text style={[s.statusPillText, { color: fg }]}>{props.children}</Text>
    </View>
  );
}

// ── Drawer (modal centralizado em mobile, lateral em web wide) ─────────────

function DrawerModal(props: { row: Row | null; onClose: () => void }) {
  const { row, onClose } = props;
  if (!row) {
    return <Modal visible={false} transparent />;
  }
  const dif = typeof row.diferenca === "number" ? row.diferenca : parseFloat((row.diferenca as any) || "0");
  const st = statusOf(row.diferenca);
  const sessLabel = "#" + (row.id || "").replace(/-/g, "").slice(0, 5).toUpperCase();
  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.drawerBackdrop}>
        <View style={s.drawer}>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={s.drawerHead}>
              <Text style={s.drawerEyebrow}>Detalhe · {row.company_name} · {fmtDateTime(row.opened_at).split(",")[0] || fmtDateTime(row.opened_at)}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Icon name="x" size={18} color={Colors.ink3} />
              </Pressable>
            </View>
            <Text style={s.drawerTitle}>Fechamento {sessLabel}</Text>

            <DrawerRow k="Operador" v={row.opened_by_name || "—"} />
            <DrawerRow k="Abertura" v={fmtTime(row.opened_at)} />
            <DrawerRow k="Fechamento" v={fmtTime(row.closed_at)} />
            <DrawerRow k="Fechado por" v={row.closed_by_name || "—"} />
            <DrawerRow k="Troco inicial" v={fmt(row.troco_inicial)} mono />

            <View style={s.drawerSep} />
            <DrawerRow k="PIX" v={fmt(row.total_pix)} mono />
            <DrawerRow k="Cartão crédito" v={fmt(row.total_cartao_credito)} mono />
            <DrawerRow k="Cartão débito" v={fmt(row.total_cartao_debito)} mono />
            <DrawerRow k="Dinheiro" v={fmt(row.total_dinheiro)} mono />
            <DrawerRow k="Fiado" v={fmt(row.total_fiado)} mono />
            <DrawerRow k="Outros (income manual)" v={fmt(row.total_outros)} mono />

            <View style={s.drawerSep} />
            <DrawerRow k="Total geral" v={fmt(row.total_geral)} mono bold />

            <View style={s.drawerSep} />
            <DrawerRow k="Esperado em dinheiro" v={fmt(row.dinheiro_esperado)} mono />
            <DrawerRow k="Contado" v={fmt(row.dinheiro_contado)} mono />
            <View style={s.drawerDifBox}>
              <Text style={s.drawerDifLabel}>Diferença</Text>
              <View style={[s.statusPill, {
                backgroundColor: st === "ok" ? Colors.greenD : st === "sobra" ? Colors.amberD : Colors.redD,
              }]}>
                <Text style={[s.statusPillText, {
                  color: st === "ok" ? Colors.green : st === "sobra" ? Colors.amber : Colors.red,
                }]}>
                  {st === "ok" ? "Bateu" : fmtSigned(dif)}
                </Text>
              </View>
            </View>

            {row.obs_sessao ? (
              <>
                <View style={s.drawerSep} />
                <Text style={s.drawerObsLabel}>Observação da sessão</Text>
                <Text style={s.drawerObs}>{row.obs_sessao}</Text>
              </>
            ) : null}
            {row.obs_fechamento ? (
              <>
                <View style={s.drawerSep} />
                <Text style={s.drawerObsLabel}>Observação do fechamento</Text>
                <Text style={s.drawerObs}>{row.obs_fechamento}</Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DrawerRow(props: { k: string; v: string; mono?: boolean; bold?: boolean }) {
  return (
    <View style={s.drawerRow}>
      <Text style={[s.drawerRowK, props.bold && { color: Colors.ink, fontWeight: "700" }]}>{props.k}</Text>
      <Text
        style={[
          s.drawerRowV,
          props.mono && { fontVariant: ["tabular-nums"] as any },
          props.bold && { color: Colors.ink, fontSize: 16, fontWeight: "700" },
        ]}
      >
        {props.v}
      </Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: { gap: 16 },

  hero: {
    backgroundColor: Colors.violetD,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  heroHead: { marginBottom: 18 },
  heroEyebrow: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600", marginBottom: 4 },
  heroTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },

  kpiStrip: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  kpi: {
    flex: 1, minWidth: 160,
    backgroundColor: Colors.bg2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: "700", color: Colors.ink },
  kpiHint: { fontSize: 11, color: Colors.ink3, marginTop: 4 },

  filterBar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  filterDivider: { width: 1, height: 18, backgroundColor: Colors.border2, marginHorizontal: 6 },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "700" },
  chipCount: { fontSize: 10, color: Colors.ink3, fontWeight: "500", opacity: 0.7 },
  chipCountActive: { color: Colors.violet3, opacity: 0.85 },

  table: { backgroundColor: Colors.bg2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  thead: {
    flexDirection: "row", paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  th: { flex: 1, fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  row: {
    flexDirection: "row", paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  rowAlt: { backgroundColor: Colors.bg },
  td: { flex: 1, fontSize: 13, color: Colors.ink },

  companyPill: {
    alignSelf: "flex-start",
    backgroundColor: Colors.violetD,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border2,
  },
  companyPillText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },

  statusPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "flex-end",
    justifyContent: "stretch",
  },
  drawer: {
    width: "100%", maxWidth: 460, height: "100%",
    backgroundColor: Colors.bg2, borderLeftWidth: 1, borderLeftColor: Colors.border2,
  },
  drawerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  drawerEyebrow: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", flex: 1 },
  drawerTitle: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 16 },
  drawerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 9,
  },
  drawerRowK: { fontSize: 13, color: Colors.ink3 },
  drawerRowV: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  drawerSep: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  drawerDifBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10,
  },
  drawerDifLabel: { fontSize: 13, color: Colors.ink3 },
  drawerObsLabel: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", marginTop: 4, marginBottom: 4 },
  drawerObs: { fontSize: 13, color: Colors.ink, lineHeight: 18 },
});

export default FechamentosTab;
