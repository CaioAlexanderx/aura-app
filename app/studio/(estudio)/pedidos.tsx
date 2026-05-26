// ============================================================
// AURA STUDIO · Hub Studio (Fase 7) — visão unificada
//
// Substitui placeholder. Mostra KPIs + alertas + feed unificado
// (digital_orders + bulk_events). Botão "Novo pedido pra evento"
// abre BulkOrderWizard (Fase 6).
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { request } from "@/services/api";
import {
  studioBulkHubApi,
  type HubStats, type HubFeedItem, type HubAlert,
} from "@/services/studioBulkHubApi";
import { BulkOrderWizard } from "@/components/studio/BulkOrderWizard";

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
      const [s, f, a] = await Promise.all([
        studioBulkHubApi.hubStats(company.id),
        studioBulkHubApi.hubFeed(company.id, tab, 100),
        studioBulkHubApi.hubAlerts(company.id),
      ]);
      setStats(s); setFeed(f.items || []); setAlerts(a.alerts || []);
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
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>FASE 7 · HUB DO ESTÚDIO</Text>
          <Text style={s.title}>Tudo que tá rolando</Text>
          <Text style={s.sub}>
            Pedidos da loja digital, eventos manuais, alertas críticos — uma visão só.
          </Text>
        </View>
        <Pressable style={s.ctaPri} onPress={openBulkWizard}>
          <Icon name="users" size={16} color="#fff" />
          <Text style={s.ctaPriTxt}>Novo pedido pra evento</Text>
        </Pressable>
      </View>

      {/* KPIs */}
      {loading && !stats ? (
        <View style={{ paddingVertical: 30 }}>
          <ActivityIndicator size="small" color={StudioColors.primary} />
        </View>
      ) : stats && (
        <View style={s.kpis}>
          <Kpi label="Pedidos hoje"    value={String(stats.orders.orders_today)} icon="shopping-bag" color={StudioColors.primary} />
          <Kpi label="Em produção"     value={String(stats.orders.in_production)} icon="clock" color={StudioColors.accent} />
          <Kpi label="Aguardando arte" value={String(stats.orders.pending_art)} icon="alert-circle" color={StudioColors.warning} />
          <Kpi label="Prontos"         value={String(stats.orders.ready)} icon="package" color={StudioColors.mint} />
          <Kpi label="Atrasados"       value={String(stats.orders.overdue)} icon="alert-triangle" color={StudioColors.danger} highlight={stats.orders.overdue > 0} />
          <Kpi label="Receita 7d"      value={fmtBRL(stats.revenue.last_7d)} icon="trending-up" color={StudioColors.primary} />
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
        {(["all", "orders", "bulk"] as const).map((t) => (
          <Pressable
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === "all" ? "Tudo" : t === "orders" ? "Pedidos" : "Eventos"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Feed */}
      {feed.length === 0 && !loading ? (
        <View style={s.empty}>
          <Icon name="inbox" size={28} color={StudioColors.ink4} />
          <Text style={s.emptyTxt}>Nada por aqui ainda</Text>
        </View>
      ) : (
        <View style={s.feedList}>
          {feed.map((item) => (
            <Pressable
              key={item.kind + "-" + item.id}
              style={s.feedRow}
              onPress={() => router.push(item.kind === "bulk" ? "/studio/pedidos" as any : "/studio/producao" as any)}
            >
              <View style={[s.feedDot, item.kind === "bulk" ? { backgroundColor: StudioColors.accent } : { backgroundColor: StudioColors.primary }]}>
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

function Kpi({ label, value, icon, color, highlight }: { label: string; value: string; icon: string; color: string; highlight?: boolean }) {
  return (
    <View style={[s.kpi, highlight && { borderColor: color, borderWidth: 2 }]}>
      <View style={[s.kpiIco, { backgroundColor: color }]}>
        <Icon name={icon as any} size={14} color="#fff" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.kpiLabel} numberOfLines={1}>{label}</Text>
        <Text style={[s.kpiValue, highlight && { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: StudioColors.bg },
  container: { padding: 28, paddingBottom: 60, maxWidth: 1100, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: StudioColors.ink3, marginTop: 4 },
  // Convenção do app: primary CTAs são navy (primary), accent fica reservado pra status/highlights.
  ctaPri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: StudioColors.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  kpi: { flex: 1, minWidth: 150, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: StudioColors.paperCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: StudioColors.ink5 },
  kpiIco: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  kpiLabel: { fontSize: 11, color: StudioColors.ink3, fontWeight: "600" },
  kpiValue: { fontSize: 17, fontWeight: "800", color: StudioColors.ink, marginTop: 1 },
  sectionLabel: { fontSize: 11, color: StudioColors.ink3, fontWeight: "800", letterSpacing: 0.6, marginBottom: 8 },
  alertsBlock: { marginBottom: 22, gap: 8 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12 },
  alertTitle: { fontSize: 13, fontWeight: "700" },
  alertSub: { fontSize: 11.5, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: StudioColors.bgSoft, borderWidth: 1, borderColor: StudioColors.ink5 },
  tabActive: { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary },
  tabTxt: { fontSize: 12.5, color: StudioColors.ink2, fontWeight: "600" },
  tabTxtActive: { color: "#fff" },
  feedList: { gap: 6 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: StudioColors.paperCard, borderRadius: 12, borderWidth: 1, borderColor: StudioColors.ink5 },
  feedDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  feedName: { fontSize: 13.5, fontWeight: "700", color: StudioColors.ink },
  feedMeta: { fontSize: 11.5, color: StudioColors.ink3, marginTop: 2 },
  feedAmount: { fontSize: 13.5, fontWeight: "800", color: StudioColors.ink },
  feedStatus: { backgroundColor: StudioColors.bgSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3 },
  feedStatusTxt: { fontSize: 10, color: StudioColors.ink3, fontWeight: "700", textTransform: "uppercase" },
  empty: { alignItems: "center", padding: 40, gap: 8, backgroundColor: StudioColors.paperCard, borderRadius: 14 },
  emptyTxt: { fontSize: 13, color: StudioColors.ink3, marginTop: 6 },
});
