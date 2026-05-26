// ============================================================
// AURA STUDIO · Hub Studio (Fase 7) — visão unificada
//
// Substitui placeholder. Mostra KPIs + alertas + feed unificado
// (digital_orders + bulk_events). Botão "Novo pedido pra evento"
// abre BulkOrderWizard (Fase 6).
//
// Fase 3 (refactor): header/loading/empty migrados pros
// componentes globais Studio (StudioPageHeader, StudioLoading,
// StudioEmpty).
//
// Fase 6 residual (26/05): KPIs animados via AnimatedKpiCounter
// (tween + pulse + badge +N quando incrementa).
//
// Residual (26/05): migrado pra useStudioTokens() — StyleSheet
// vira factory memoizado por tokens, suporta light/dark theme.
// SEVERITY_TONE mantido com StudioColors (tokens semânticos
// estáticos, não dependem de modo).
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors, type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { request } from "@/services/api";
import {
  studioBulkHubApi,
  type HubStats, type HubFeedItem, type HubAlert,
} from "@/services/studioBulkHubApi";
import { BulkOrderWizard } from "@/components/studio/BulkOrderWizard";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";

function fmtBRL(v: number) {
  return "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return iso; }
}

const SEVERITY_TONE = {
  info:    { bg: StudioColors.infoSoft,    color: StudioColors.infoInk,    icon: "info" },
  warning: { bg: StudioColors.warningSoft, color: StudioColors.warningInk, icon: "alert-triangle" },
  danger:  { bg: StudioColors.dangerSoft,  color: StudioColors.dangerInk,  icon: "alert-circle" },
} as const;

export default function StudioPedidosHub() {
  const router = useRouter();
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const s = useMemo(() => makeStyles(t), [t]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [feed, setFeed] = useState<HubFeedItem[]>([]);
  const [alerts, setAlerts] = useState<HubAlert[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [tab, setTab] = useState<"all" | "orders" | "bulk">("all");

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [st, f, a] = await Promise.all([
        studioBulkHubApi.hubStats(company.id),
        studioBulkHubApi.hubFeed(company.id, tab, 100),
        studioBulkHubApi.hubAlerts(company.id),
      ]);
      setStats(st); setFeed(f.items || []); setAlerts(a.alerts || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar Hub");
    } finally { setLoading(false); }
  }, [company?.id, tab]);

  useEffect(() => { load(); }, [load]);

  // Carrega produtos personalizáveis pra wizard de evento.
  // FIX (25/05): usa request() do projeto em vez de fetch direto —
  // pega token via interceptor padrão, retry e error handling consistentes.
  async function openBulkWizard() {
    if (!company?.id) return;
    try {
      const r = await request<any>(
        "/companies/" + company.id + "/products?limit=500",
        { method: "GET", retry: 1, timeout: 10000 }
      );
      const raw: any[] = Array.isArray(r) ? r : (r?.products || []);
      const list = raw
        .filter((p: any) => p.is_personalizable)
        .map((p: any) => ({ id: p.id, name: p.name, price: parseFloat(p.price) || 0 }));
      setProducts(list);
      setBulkOpen(true);
    } catch (e: any) {
      // Mesmo se falhar, abre o wizard — usuário pode cadastrar produto manualmente depois.
      // (Próxima iteração: bloqueia abertura se produtos vazios e mostra CTA "Cadastrar produto")
      setProducts([]);
      setBulkOpen(true);
      console.warn("[studio/pedidos] Falha ao carregar produtos:", e?.message);
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header (Fase 3 — global StudioPageHeader) */}
      <StudioPageHeader
        eyebrow="HUB · PEDIDOS"
        title="Todos os pedidos Studio"
        subtitle="Unifica pedidos da Loja Digital, PDV e marketplaces. Acompanhe status de produção, conversão de eventos em vendas."
        rightSlot={
          <Pressable style={s.ctaPri} onPress={openBulkWizard}>
            <Icon name="users" size={16} color="#fff" />
            <Text style={s.ctaPriTxt}>+ Novo pedido</Text>
          </Pressable>
        }
      />

      {/* KPIs */}
      {loading && !stats ? (
        <StudioLoading variant="skeleton-list" rows={5} />
      ) : stats && (
        <View style={s.kpis}>
          <Kpi t={t} label="Pedidos hoje"    value={stats.orders.orders_today} icon="shopping-bag" color={t.primary} />
          <Kpi t={t} label="Em produção"     value={stats.orders.in_production} icon="clock" color={t.accent} />
          <Kpi t={t} label="Aguardando arte" value={stats.orders.pending_art} icon="alert-circle" color={t.warning} />
          <Kpi t={t} label="Prontos"         value={stats.orders.ready} icon="package" color={t.mint} />
          <Kpi t={t} label="Atrasados"       value={stats.orders.overdue} icon="alert-triangle" color={t.danger} highlight={stats.orders.overdue > 0} />
          <Kpi t={t} label="Receita 7d"      value={stats.revenue.last_7d} icon="trending-up" color={t.primary} kind="currency" />
        </View>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <View style={s.alertsBlock}>
          <Text style={s.sectionLabel}>{alerts.length} ALERTAS PENDENTES</Text>
          {alerts.slice(0, 8).map((a, i) => {
            const tone = SEVERITY_TONE[a.severity] || SEVERITY_TONE.info;
            return (
              <Pressable
                key={i}
                style={[s.alertRow, { backgroundColor: tone.bg }]}
                onPress={() => router.push(a.href as any)}
              >
                <Icon name={tone.icon as any} size={16} color={tone.color} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: tone.color }]}>{a.title}</Text>
                  <Text style={[s.alertSub, { color: tone.color, opacity: 0.85 }]}>{a.sub}</Text>
                </View>
                <Icon name="chevron-right" size={14} color={tone.color} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {(["all", "orders", "bulk"] as const).map((tk) => (
          <Pressable
            key={tk}
            style={[s.tab, tab === tk && s.tabActive]}
            onPress={() => setTab(tk)}
          >
            <Text style={[s.tabTxt, tab === tk && s.tabTxtActive]}>
              {tk === "all" ? "Tudo" : tk === "orders" ? "Pedidos" : "Eventos"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Feed */}
      {feed.length === 0 && !loading ? (
        <StudioEmpty
          icon="shopping-bag"
          title="Nenhum pedido no período"
          desc="Quando entrar um pedido, ele aparece aqui automaticamente — Loja Digital, PDV e marketplaces."
          primaryCta={{ label: "Configurar Loja Digital", onPress: () => router.push("/studio/vendas/loja-digital" as any) }}
        />
      ) : (
        <View style={s.feedList}>
          {feed.map((item) => (
            <Pressable
              key={item.kind + "-" + item.id}
              style={s.feedRow}
              onPress={() => router.push(item.kind === "bulk" ? "/studio/pedidos" as any : "/studio/producao" as any)}
            >
              <View style={[s.feedDot, item.kind === "bulk" ? { backgroundColor: t.accent } : { backgroundColor: t.primary }]}>
                <Icon name={item.kind === "bulk" ? "users" : "shopping-bag"} size={14} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.feedName} numberOfLines={1}>
                  {item.name || (item.kind === "bulk" ? "Evento" : "Pedido")}
                </Text>
                <Text style={s.feedMeta}>
                  {item.kind === "bulk" ? "Evento" : "Pedido"} · {item.qty} item{item.qty === 1 ? "" : "s"} · {fmtDate(item.created_at)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.feedAmount}>{fmtBRL(item.amount)}</Text>
                <View style={s.feedStatus}>
                  <Text style={s.feedStatusTxt}>{item.status || "—"}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Modal Bulk Wizard */}
      <Modal visible={bulkOpen} animationType="slide" onRequestClose={() => setBulkOpen(false)}>
        <BulkOrderWizard
          products={products}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); load(); }}
        />
      </Modal>
    </ScrollView>
  );
}

// Fase 6 residual (26/05): valor numérico passa pro AnimatedKpiCounter
// — tween + pulse + badge +N quando incrementa. `kind="currency"` usa
// fmtBRL como formatter; default = inteiro pt-BR.
function Kpi({
  t, label, value, icon, color, highlight, kind = "number",
}: {
  t: StudioPalette;
  label: string;
  value: number;
  icon: string;
  color: string;
  highlight?: boolean;
  kind?: "number" | "currency";
}) {
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={[s.kpi, highlight && { borderColor: color, borderWidth: 2 }]}>
      <View style={[s.kpiIco, { backgroundColor: color }]}>
        <Icon name={icon as any} size={14} color="#fff" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.kpiLabel} numberOfLines={1}>{label}</Text>
        <View style={s.kpiCounterWrap}>
          <AnimatedKpiCounter
            value={Number(value) || 0}
            fontSize={17}
            color={highlight ? color : t.ink}
            format={kind === "currency" ? fmtBRL : undefined}
          />
        </View>
      </View>
    </View>
  );
}

function makeStyles(t: StudioPalette) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    container: { padding: 28, paddingBottom: 60, maxWidth: 1100, alignSelf: "center", width: "100%" },
    // Convenção do app: primary CTAs são navy (primary), accent fica reservado pra status/highlights.
    ctaPri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
    ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
    kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
    kpi: { flex: 1, minWidth: 150, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.paperCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.ink5 },
    kpiIco: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    kpiLabel: { fontSize: 11, color: t.ink3, fontWeight: "600" },
    // Wrap pro counter alinhar à esquerda (component default = center).
    kpiCounterWrap: { alignItems: "flex-start", marginTop: 1 },
    sectionLabel: { fontSize: 11, color: t.ink3, fontWeight: "800", letterSpacing: 0.6, marginBottom: 8 },
    alertsBlock: { marginBottom: 22, gap: 8 },
    alertRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12 },
    alertTitle: { fontSize: 13, fontWeight: "700" },
    alertSub: { fontSize: 11.5, marginTop: 2 },
    tabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5 },
    tabActive: { backgroundColor: t.primary, borderColor: t.primary },
    tabTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },
    tabTxtActive: { color: "#fff" },
    feedList: { gap: 6 },
    feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: t.paperCard, borderRadius: 12, borderWidth: 1, borderColor: t.ink5 },
    feedDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    feedName: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    feedMeta: { fontSize: 11.5, color: t.ink3, marginTop: 2 },
    feedAmount: { fontSize: 13.5, fontWeight: "800", color: t.ink },
    feedStatus: { backgroundColor: t.bgSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3 },
    feedStatusTxt: { fontSize: 10, color: t.ink3, fontWeight: "700", textTransform: "uppercase" },
  });
}
