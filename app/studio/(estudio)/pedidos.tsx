// ============================================================
// AURA STUDIO · Hub de Pedidos (Fase 7) — visão unificada multi-canal
//
// Hub centralizado para TODOS os pedidos do Studio, independente
// do canal de origem: Loja Digital, PDV ou marketplaces integrados.
// Mostra KPIs + alertas de produção + feed unificado
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
// SEVERITY_TONE virou severityTone(t) theme-aware (Fase 1b).
//
// Agente E (02/06/2026): copy do header reforça posição de hub
// multi-canal. Lógica, rotas e tabs inalterados.
//
// Integração (03/06/2026): eyebrow explícito removido — deriva
// automaticamente via eyebrowForRoute(usePathname()) em
// StudioPageHeader → resultado: "VENDAS · PEDIDOS".
// ============================================================
import { useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { request } from "@/services/api";
import {
  studioBulkHubApi,
  type HubStats, type HubFeedItem, type HubAlert,
} from "@/services/studioBulkHubApi";
import { studioApi } from "@/services/studioApi";
import { useCobrarSaldo } from "@/components/studio/useCobrarSaldo";
import { useRegistrarPagamento } from "@/components/studio/useRegistrarPagamento";
import { RegistrarPagamentoSheet } from "@/components/studio/RegistrarPagamentoSheet";
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

// 17/08/2026 — a aba "A receber" carrega de studioApi.listOrders, e não do
// hubFeed: o feed do hub lê só digital_orders + bulk_events, e a venda com
// sinal é uma venda de PDV. A view studio_orders cobre os três canais.
type FeedRow = HubFeedItem & {
  balance_amount?: number | null;
  balance_due_date?: string | null;
  balance_status?: "pending" | "overdue" | null;
  balance_installment_id?: string | null;
  customer_phone?: string | null;
};

const TAB_LABEL: Record<string, string> = {
  all: "Tudo", orders: "Pedidos", bulk: "Eventos", receivable: "A receber",
};

function fmtDueDate(iso?: string | null) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : String(iso);
}

function severityTone(t: StudioPalette) {
  return {
    info:    { bg: t.infoSoft,    color: t.infoInk,    icon: "info" },
    warning: { bg: t.warningSoft, color: t.warningInk, icon: "alert-triangle" },
    danger:  { bg: t.dangerSoft,  color: t.dangerInk,  icon: "alert-circle" },
  } as const;
}

export default function StudioPedidosHub() {
  const router = useRouter();
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const sev = severityTone(t);
  const s = useMemo(() => makeStyles(t), [t]);
  const [loading, setLoading] = useState(true);
  // FIX (bug #13 QA): erro engolido virava "Nenhum pedido no período" —
  // estado dedicado com retry, distinto do vazio de verdade.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [alerts, setAlerts] = useState<HubAlert[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [tab, setTab] = useState<"all" | "orders" | "bulk" | "receivable">("all");
  const { cobrar, cobrandoId } = useCobrarSaldo(company?.id);

  const load = useCallback(async () => {
    // FIX (bug #14 QA): return antes do setLoading(false) deixava o
    // skeleton girando pra sempre quando company ainda não tinha carregado.
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      // "A receber" tem fonte própria — ver comentário do type FeedRow.
      // Janela maior (180d): encomenda com saldo em aberto envelhece mais
      // que pedido em produção, e sumir da lista seria perder a cobrança.
      const feedPromise = tab === "receivable"
        ? studioApi.listOrders(company.id, { withBalance: true, days: 180, limit: 100 })
            .then((r) => ({
              items: (r.orders || []).map((o) => ({
                id: o.id,
                kind: "order" as const,
                created_at: o.created_at,
                amount: Number(o.total_amount) || 0,
                status: o.studio_production_status || "",
                name: o.customer_name || o.display_name || null,
                qty: o.item_count || 0,
                balance_amount: o.balance_amount != null ? Number(o.balance_amount) : null,
                balance_due_date: o.balance_due_date ?? null,
                balance_status: o.balance_status ?? null,
                balance_installment_id: o.balance_installment_id ?? null,
                customer_phone: o.customer_phone ?? null,
              })),
            }))
        : studioBulkHubApi.hubFeed(company.id, tab, 100);

      const [st, f, a] = await Promise.all([
        studioBulkHubApi.hubStats(company.id),
        feedPromise,
        studioBulkHubApi.hubAlerts(company.id),
      ]);
      setStats(st); setFeed(f.items || []); setAlerts(a.alerts || []);
      setLoadError(null);
    } catch (e: any) {
      const msg = e?.message || "Erro ao carregar Hub";
      toast.error(msg);
      setLoadError(msg);
    } finally { setLoading(false); }
  }, [company?.id, tab]);

  // FIX (bug #15 QA): dados não recarregavam ao voltar pra essa tela.
  // useFocusEffect cobre mount inicial + toda vez que a tela ganha foco.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 27/08/2026 — baixa do saldo. Declarado DEPOIS do `load` de propósito:
  // ele é a dependência (diferente do cobrar, este recarrega — a encomenda
  // quitada tem que sumir da aba "A receber" na hora).
  const baixa = useRegistrarPagamento(company?.id, { onSucesso: load });

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
      setProducts([]);
      setBulkOpen(true);
      console.warn("[studio/pedidos] Falha ao carregar produtos:", e?.message);
    }
  }

  return (
    <StudioScreen variant="reading">
      {/* Header — hub multi-canal; eyebrow deriva automaticamente via nav.ts */}
      <StudioPageHeader
        title="Hub de Pedidos"
        subtitle="Visão unificada de todos os canais: Loja Digital, PDV e marketplaces. Acompanhe status de produção e converta eventos em vendas."
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
            const tone = sev[a.severity] || sev.info;
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

      {/* Tabs — FIX (bug #8 QA): "Marketplace" era rota órfã (nenhum
          router.push levava lá). Chip de atalho junto das tabs existentes,
          visualmente distinto (navega pra outra tela, não filtra o feed). */}
      <View style={s.tabsRow}>
        <View style={s.tabs}>
          {(["all", "orders", "bulk", "receivable"] as const).map((tk) => (
            <Pressable
              key={tk}
              style={[s.tab, tab === tk && s.tabActive]}
              onPress={() => setTab(tk)}
            >
              <Text style={[s.tabTxt, tab === tk && s.tabTxtActive]}>
                {TAB_LABEL[tk]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={s.marketplaceChip}
          onPress={() => router.push("/studio/pedidos/marketplace" as any)}
        >
          <Icon name="shopping-bag" size={13} color={t.accent} />
          <Text style={s.marketplaceChipTxt}>Marketplace</Text>
          <Icon name="chevron-right" size={12} color={t.accent} />
        </Pressable>
      </View>

      {/* Feed */}
      {loadError && feed.length === 0 && !loading ? (
        // FIX (bug #13 QA): erro de carregamento é distinto de "sem pedidos".
        <StudioEmpty
          tone="warning"
          icon="alert-circle"
          title="Não deu pra carregar o Hub"
          desc={loadError}
          primaryCta={{ label: "Tentar de novo", onPress: load }}
        />
      ) : feed.length === 0 && !loading ? (
        tab === "receivable" ? (
          <StudioEmpty
            icon="check-circle"
            title="Nada a receber"
            desc="Encomendas fechadas com sinal aparecem aqui até o saldo entrar. No momento não há saldo em aberto."
          />
        ) : (
        <StudioEmpty
          icon="shopping-bag"
          title="Nenhum pedido no período"
          desc="Quando entrar um pedido, ele aparece aqui automaticamente — Loja Digital, PDV e marketplaces."
          primaryCta={{ label: "Configurar Loja Digital", onPress: () => router.push("/studio/vendas/loja-digital" as any) }}
        />
        )
      ) : (
        <View style={s.feedList}>
          {feed.map((item) => (
            <Pressable
              key={item.kind + "-" + item.id}
              style={s.feedRow}
              // FIX (bug #5 QA): pedido jogava em /studio/producao (genérico) e
              // evento navegava pra ESSA MESMA tela (no-op). Deep-link direto
              // pro detalhe de cada um.
              onPress={() => router.push(
                (item.kind === "bulk" ? `/studio/pedidos/eventos/${item.id}` : `/studio/pedidos/${item.id}`) as any
              )}
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
                {/* Na aba "A receber" o número que importa é o saldo, não o
                    total da encomenda — é o que ela vai cobrar agora. */}
                {item.balance_amount != null ? (
                  <>
                    <Text style={[s.feedAmount, item.balance_status === "overdue" && { color: t.dangerInk }]}>
                      {fmtBRL(item.balance_amount)}
                    </Text>
                    <Text style={s.feedBalanceMeta}>
                      {item.balance_status === "overdue" ? "venceu " : "vence "}
                      {fmtDueDate(item.balance_due_date)} · de {fmtBRL(item.amount)}
                    </Text>
                    {/* 27/08/2026 — os dois lados do saldo: mandar a cobrança
                        e registrar que entrou. Sem o segundo, quem recebia o
                        Pix não tinha onde dar baixa e a linha ficava aqui pra
                        sempre. */}
                    {item.balance_installment_id ? (
                      <View style={s.saldoAcoes}>
                        <Pressable
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            cobrar({
                              orderId: item.id,
                              installmentId: item.balance_installment_id as string,
                              phone: item.customer_phone,
                              customerName: item.name,
                              dueDate: item.balance_due_date,
                              status: item.balance_status,
                            });
                          }}
                          disabled={cobrandoId === item.balance_installment_id}
                          style={s.cobrarBtn}
                          // Alvo de ~26px numa linha que navega ao toque: sem
                          // hitSlop, o mis-tap abre o detalhe do pedido.
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Cobrar saldo de ${item.name || "cliente"} pelo WhatsApp`}
                        >
                          <Icon name="message-circle" size={12} color={t.primary} />
                          <Text style={s.cobrarBtnTxt}>
                            {cobrandoId === item.balance_installment_id ? "Abrindo..." : "Cobrar"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            baixa.abrir({
                              orderId: item.id,
                              installmentId: item.balance_installment_id as string,
                              customerName: item.name,
                              amount: Number(item.balance_amount) || 0,
                              dueDate: item.balance_due_date,
                              status: item.balance_status,
                            });
                          }}
                          disabled={baixa.registrandoId === item.balance_installment_id}
                          style={s.recebiBtn}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Registrar recebimento de ${item.name || "cliente"}`}
                        >
                          <Icon name="check-circle" size={12} color={t.successInk} />
                          <Text style={s.recebiBtnTxt}>Recebi</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text style={s.feedAmount}>{fmtBRL(item.amount)}</Text>
                    <View style={s.feedStatus}>
                      <Text style={s.feedStatusTxt}>{item.status || "—"}</Text>
                    </View>
                  </>
                )}
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

      {/* Baixa do saldo — o sheet cuida do próprio visible via controller. */}
      <RegistrarPagamentoSheet controller={baixa} />
    </StudioScreen>
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
    tabsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" },
    tabs: { flexDirection: "row", gap: 6 },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5 },
    tabActive: { backgroundColor: t.primary, borderColor: t.primary },
    tabTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },
    tabTxtActive: { color: "#fff" },
    marketplaceChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent,
    },
    marketplaceChipTxt: { fontSize: 12.5, color: t.accent, fontWeight: "700" },
    feedList: { gap: 6 },
    feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: t.paperCard, borderRadius: 12, borderWidth: 1, borderColor: t.ink5 },
    feedDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    feedName: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    feedMeta: { fontSize: 11.5, color: t.ink3, marginTop: 2 },
    feedAmount: { fontSize: 13.5, fontWeight: "800", color: t.ink },
    feedStatus: { backgroundColor: t.bgSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3 },
    feedStatusTxt: { fontSize: 10, color: t.ink3, fontWeight: "700", textTransform: "uppercase" },
    // 17/08/2026 — aba "A receber"
    feedBalanceMeta: { fontSize: 10, color: t.ink3, marginTop: 1 },
    // 27/08/2026 — a dupla cobrar/recebi. O marginTop mudou do botão pro
    // container: nos dois filhos de um row ele desalinharia.
    saldoAcoes: { flexDirection: "row", gap: 6, marginTop: 6 },
    cobrarBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 999, borderWidth: 1, borderColor: t.primary,
    },
    cobrarBtnTxt: { fontSize: 11, color: t.primary, fontWeight: "700" },
    recebiBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 999, borderWidth: 1, borderColor: t.success,
      backgroundColor: t.successSoft,
    },
    recebiBtnTxt: { fontSize: 11, color: t.successInk, fontWeight: "700" },
  });
}
