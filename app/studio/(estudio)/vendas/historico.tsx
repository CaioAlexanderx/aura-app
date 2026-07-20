// ============================================================
// AURA STUDIO · Vendas — histórico de vendas (lista + filtros + KPIs).
//
// 20/07/2026 — paridade com a tela "Vendas" do Negócio, no tema Studio.
// Lista TODAS as vendas da empresa (mesma base do Negócio: salesApi.list),
// com filtros de período/status/busca e KPIs. Cada linha abre o modal de
// detalhe com edição completa (itens/qtd/preços/desconto) e cancelamento.
// Rota: /studio/vendas/historico (registrada em StudioShell/nav.ts).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, Platform, ActivityIndicator } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { salesApi, type SalesListItem, type SalesStats } from "@/services/salesApi";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { KpiCard, money } from "@/components/studio/pdv/ui";
import { Ic } from "@/components/studio/pdv/icons";
import { StudioSaleDetailModal } from "@/components/studio/vendas/StudioSaleDetailModal";

const webPointer = () => (Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {});
const webNoOutline = () => (Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {});

type PeriodKey = "today" | "week" | "month" | "all";
type StatusKey = "all" | "active" | "cancelled";

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "7 dias" },
  { id: "month", label: "30 dias" },
  { id: "all", label: "Tudo" },
];
const STATUSES: { id: StatusKey; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Ativas" },
  { id: "cancelled", label: "Canceladas" },
];

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", credito: "Crédito", debito: "Débito", crediario: "Crediário",
};
const payLabel = (k?: string | null) => (k ? PAYMENT_LABELS[k] || k : "—");

function periodRange(p: PeriodKey): { date_from?: string; date_to?: string } {
  if (p === "all") return {};
  const now = new Date();
  const start = new Date(now);
  if (p === "today") start.setHours(0, 0, 0, 0);
  else if (p === "week") start.setDate(start.getDate() - 7);
  else if (p === "month") start.setDate(start.getDate() - 30);
  return { date_from: start.toISOString(), date_to: now.toISOString() };
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function StudioVendasScreen() {
  const t = useStudioTokens();
  const { company } = useAuthStore();
  const cid = (company as any)?.id as string | undefined;

  const [period, setPeriod] = useState<PeriodKey>("month");
  const [status, setStatus] = useState<StatusKey>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SalesListItem[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const { date_from, date_to } = periodRange(period);
      const res = await salesApi.list(cid, { date_from, date_to, status, q: q.trim() || undefined, limit: 100 });
      setSales(res.sales || []);
      setStats(res.stats || null);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar vendas");
    } finally {
      setLoading(false);
    }
  }, [cid, period, status, q]);

  // Recarrega ao trocar período/status (busca é disparada no submit).
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cid, period, status]);

  const kpis = useMemo(() => ([
    { icon: "cart", label: "Vendas ativas", value: String(stats?.active_sales ?? 0), tone: "primary" as const },
    { icon: "dollar", label: "Faturamento", value: "R$ " + money(stats?.revenue ?? 0), tone: "success" as const },
    { icon: "receipt", label: "Ticket médio", value: "R$ " + money(stats?.avg_ticket ?? 0), tone: "accent" as const },
    { icon: "x", label: "Canceladas", value: String(stats?.cancelled_sales ?? 0), tone: "warn" as const },
  ]), [stats]);

  return (
    <StudioScreen variant="reading" onRefresh={load} refreshing={loading}>
      <StudioPageHeader
        title="Vendas"
        subtitle="Histórico completo de vendas — abra qualquer venda para editar itens, valores e descontos ou cancelar."
      />

      {/* KPIs */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} t={t} icon={k.icon} label={k.label} value={k.value} tone={k.tone} />
        ))}
      </View>

      {/* Filtros */}
      <View style={{ gap: 10, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {PERIODS.map((p) => {
            const on = period === p.id;
            return (
              <Pressable key={p.id} onPress={() => setPeriod(p.id)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? t.primarySoft : t.paperCard, borderWidth: 1, borderColor: on ? t.primary : t.ink5, ...webPointer() }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: on ? t.primary : t.ink2 }}>{p.label}</Text>
              </Pressable>
            );
          })}
          <View style={{ width: 1, backgroundColor: t.ink5, marginHorizontal: 2 }} />
          {STATUSES.map((sfilter) => {
            const on = status === sfilter.id;
            return (
              <Pressable key={sfilter.id} onPress={() => setStatus(sfilter.id)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? t.accentSoft : t.paperCard, borderWidth: 1, borderColor: on ? t.accentInk : t.ink5, ...webPointer() }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: on ? t.accentInk : t.ink2 }}>{sfilter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, height: 44 }}>
          <Ic name="search" size={16} color={t.ink3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            placeholder="Buscar cliente ou vendedor…"
            placeholderTextColor={t.ink3}
            style={{ flex: 1, color: t.ink, fontSize: 14, ...webNoOutline() }}
          />
          {q ? (
            <Pressable onPress={() => { setQ(""); setTimeout(load, 0); }} style={webPointer()}>
              <Ic name="x" size={15} color={t.ink3} />
            </Pressable>
          ) : null}
          <Pressable onPress={load} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: t.primary, ...webPointer() }}>
            <Text style={{ fontSize: 12.5, color: "#fff", fontWeight: "800" }}>Buscar</Text>
          </Pressable>
        </View>
      </View>

      {/* Lista */}
      {loading ? (
        <View style={{ padding: 48, alignItems: "center" }}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : error ? (
        <View style={{ padding: 20, borderRadius: 12, backgroundColor: t.dangerSoft, borderWidth: 1, borderColor: t.danger }}>
          <Text style={{ color: t.dangerInk, fontSize: 13, fontWeight: "700" }}>{error}</Text>
        </View>
      ) : sales.length === 0 ? (
        <View style={{ padding: 48, alignItems: "center", gap: 8 }}>
          <Ic name="cart" size={34} color={t.ink4} />
          <Text style={{ color: t.ink3, fontSize: 14, fontWeight: "600" }}>Nenhuma venda encontrada</Text>
        </View>
      ) : (
        <View style={{ borderWidth: 1, borderColor: t.ink5, borderRadius: 14, overflow: "hidden" }}>
          {sales.map((s, idx) => {
            const cancelled = s.status === "cancelled";
            const isTroca = s.type === "troca";
            const amount = isTroca && s.net_amount != null ? s.net_amount : s.total_amount;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSelected(s.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: t.paperCard, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: t.ink5, opacity: cancelled ? 0.6 : 1, ...webPointer() }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: t.bgSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ic name="receipt" size={18} color={t.ink3} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "700" }} numberOfLines={1}>{s.customer?.name || "Consumidor"}</Text>
                    {isTroca && (
                      <View style={{ backgroundColor: t.warningSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9.5, color: t.warningInk, fontWeight: "800" }}>TROCA</Text>
                      </View>
                    )}
                    {cancelled && (
                      <View style={{ backgroundColor: t.dangerSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9.5, color: t.dangerInk, fontWeight: "800" }}>CANCELADA</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }} numberOfLines={1}>
                    {fmtDateTime(s.created_at)} · {payLabel(s.payment_method)} · {s.items_count} {s.items_count === 1 ? "item" : "itens"}{s.seller?.name ? ` · ${s.seller.name}` : ""}
                  </Text>
                </View>
                <Text style={{ fontSize: 14.5, color: cancelled ? t.ink3 : t.success, fontWeight: "800", textDecorationLine: cancelled ? "line-through" : "none" }}>
                  R$ {money(amount)}
                </Text>
              </Pressable>
            );
          })}
          {total > sales.length && (
            <View style={{ padding: 12, alignItems: "center", backgroundColor: t.paperCard, borderTopWidth: 1, borderTopColor: t.ink5 }}>
              <Text style={{ fontSize: 11.5, color: t.ink3 }}>Mostrando {sales.length} de {total} — refine os filtros para ver mais.</Text>
            </View>
          )}
        </View>
      )}

      <StudioSaleDetailModal
        visible={!!selected}
        saleId={selected}
        companyId={cid}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </StudioScreen>
  );
}
