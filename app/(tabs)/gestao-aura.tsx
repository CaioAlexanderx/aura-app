import { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ContabilidadeAdmin } from "@/components/admin/ContabilidadeAdmin";
import { EquipeAdmin } from "@/components/admin/EquipeAdmin";
import { SuporteAdmin } from "@/components/admin/SuporteAdmin";
import { ConfigAdmin } from "@/components/admin/ConfigAdmin";
import { LogsAdmin } from "@/components/admin/LogsAdmin";

const TABS = ["Dashboard", "Clientes", "Financeiro", "Contabilidade", "Equipe", "Suporte", "Config", "Logs"];

const PLAN_C: Record<string, { color: string; label: string }> = {
  essencial: { color: Colors.ink3, label: "Essencial" },
  negocio: { color: Colors.violet3, label: "Negocio" },
  expansao: { color: Colors.green, label: "Expansao" },
};

const STATUS_C: Record<string, { color: string; label: string }> = {
  active: { color: Colors.green, label: "Ativo" },
  overdue: { color: Colors.amber, label: "Inadimplente" },
  cancelled: { color: Colors.red, label: "Cancelado" },
  true: { color: Colors.green, label: "Ativo" },
  false: { color: Colors.red, label: "Inativo" },
};

type AdminClient = {
  id: string;
  trade_name: string;
  legal_name: string;
  plan: string;
  is_active: boolean;
  module_overrides: Record<string, boolean> | null;
  created_at: string;
  owner_email: string;
  owner_name: string;
  visible_modules: string[];
};

// ── Dashboard (real data from /admin/dashboard) ──────────────
function Dashboard() {
  const { token, isStaff } = useAuthStore();
  const { data: apiDash, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });

  if (isLoading) return <ListSkeleton rows={3} showCards />;

  const clients = apiDash?.clients || { total: 0, essencial: 0, negocio: 0, expansao: 0 };
  const mrrEstimated = apiDash?.mrr?.estimated || 0;
  const totalCosts = apiDash?.costs?.current_month || 0;
  const grossMargin = apiDash?.gross_margin?.estimated || 0;
  const marginPct = apiDash?.gross_margin?.margin_pct || 0;
  const avgTicket = clients.total > 0 ? mrrEstimated / clients.total : 0;
  const activeClients = clients.total;

  const planDist = { essencial: clients.essencial, negocio: clients.negocio, expansao: clients.expansao };

  return (
    <View>
      <View style={d.kpis}>
        <HoverCard style={d.kpi}><Icon name="dollar" size={20} color={Colors.green} /><Text style={[d.kv, { color: Colors.green }]}>{fmt(mrrEstimated)}</Text><Text style={d.kl}>MRR</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="users" size={20} color={Colors.violet3} /><Text style={d.kv}>{activeClients}</Text><Text style={d.kl}>Clientes ativos</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="trending_up" size={20} color={Colors.amber} /><Text style={d.kv}>{fmt(avgTicket)}</Text><Text style={d.kl}>Ticket medio</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="trending_down" size={20} color={Colors.red} /><Text style={d.kv}>{fmt(totalCosts)}</Text><Text style={d.kl}>Custos mes</Text></HoverCard>
      </View>

      <View style={d.row}>
        <HoverCard style={d.card}>
          <Text style={d.ct}>Distribuicao por plano</Text>
          <View style={d.bars}>
            {Object.entries(planDist).map(([plan, count]) => {
              const pct = activeClients > 0 ? Math.round((count as number) / activeClients * 100) : 0;
              const pc = PLAN_C[plan] || { color: Colors.ink3, label: plan };
              return (
                <View key={plan} style={d.barRow}>
                  <Text style={[d.barLabel, { color: pc.color }]}>{pc.label}</Text>
                  <View style={d.barBg}><View style={[d.barFill, { width: pct + "%", backgroundColor: pc.color }]} /></View>
                  <Text style={d.barPct}>{count} ({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </HoverCard>

        <HoverCard style={d.card}>
          <Text style={d.ct}>Margem bruta</Text>
          <Text style={[d.bigNum, { color: grossMargin >= 0 ? Colors.green : Colors.red }]}>{fmt(grossMargin)}</Text>
          <Text style={d.hint}>Margem: {marginPct}%</Text>
          <View style={{ marginTop: 12 }}>
            <Text style={d.hint}>Receita: {fmt(mrrEstimated)}</Text>
            <Text style={d.hint}>Custos: {fmt(totalCosts)}</Text>
          </View>
        </HoverCard>
      </View>

      <HoverCard style={d.projCard}>
        <Text style={d.ct}>Projecao de receita</Text>
        <View style={d.projRow}>
          <View style={d.projItem}><Text style={d.projLabel}>Este mes</Text><Text style={[d.projValue, { color: Colors.green }]}>{fmt(mrrEstimated)}</Text></View>
          <View style={d.projItem}><Text style={d.projLabel}>Proximo mes</Text><Text style={d.projValue}>{fmt(mrrEstimated * 1.08)}</Text></View>
          <View style={d.projItem}><Text style={d.projLabel}>Anualizado</Text><Text style={[d.projValue, { color: Colors.violet3 }]}>{fmt(mrrEstimated * 12)}</Text></View>
        </View>
      </HoverCard>
    </View>
  );
}
const d = StyleSheet.create({
  kpis: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: IS_WIDE ? 140 : "45%", backgroundColor: Colors.bg3, borderRadius: 16, padding: IS_WIDE ? 20 : 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kv: { fontSize: IS_WIDE ? 22 : 18, fontWeight: "800", color: Colors.ink },
  kl: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: IS_WIDE ? "row" : "column", gap: 12, marginBottom: 16 },
  card: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  ct: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  bars: { gap: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 11, fontWeight: "600", width: 70 },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.bg4 },
  barFill: { height: 8, borderRadius: 4 },
  barPct: { fontSize: 11, color: Colors.ink3, width: 55, textAlign: "right" },
  bigNum: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.ink3 },
  projCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  projRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  projItem: { flex: 1, minWidth: 100, gap: 4 },
  projLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  projValue: { fontSize: 20, fontWeight: "700", color: Colors.ink },
});

// ── Clients Table (real data from /admin/clients) ────────────
function ClientsTable() {
  const { token, isStaff } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: apiClients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => adminApi.clients(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ companyId, overrides }: { companyId: string; overrides: Record<string, boolean> }) =>
      adminApi.updateModules(companyId, overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Modulos atualizados");
    },
    onError: () => toast.error("Erro ao atualizar modulos"),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const clients: AdminClient[] = apiClients?.clients || [];
  const filtered = filter === "all" ? clients : clients.filter(c =>
    filter === "active" ? c.is_active : filter === "inactive" ? !c.is_active : true
  );

  if (isLoading) return <ListSkeleton rows={4} showCards />;

  const MODULE_LABELS = [
    { key: "financeiro", label: "Financeiro" },
    { key: "pdv", label: "PDV" },
    { key: "estoque", label: "Estoque" },
    { key: "crm", label: "CRM" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "canal_digital", label: "Canal Digital" },
    { key: "folha", label: "Folha" },
    { key: "agentes_ia", label: "Agentes IA" },
  ];

  function handleToggle(client: AdminClient, moduleKey: string, enabled: boolean) {
    const currentOverrides = client.module_overrides || {};
    const newOverrides = { ...currentOverrides, [moduleKey]: enabled };
    toggleMutation.mutate({ companyId: client.id, overrides: newOverrides });
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {[{ k: "all", l: "Todos" }, { k: "active", l: "Ativos" }, { k: "inactive", l: "Inativos" }].map(f => (
          <Pressable key={f.k} onPress={() => setFilter(f.k)} style={[sty.chip, filter === f.k && sty.chipActive]}>
            <Text style={[sty.chipText, filter === f.k && sty.chipTextActive]}>
              {f.l} ({f.k === "all" ? clients.length : clients.filter(c => f.k === "active" ? c.is_active : !c.is_active).length})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 && <Text style={{ fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 40 }}>Nenhum cliente encontrado</Text>}

      {filtered.map(client => {
        const pc = PLAN_C[client.plan] || { color: Colors.ink3, label: client.plan || "?" };
        const sc = client.is_active ? STATUS_C.active : STATUS_C.false;
        const isOpen = selected === client.id;
        const displayName = client.trade_name || client.legal_name || "Sem nome";
        return (
          <Pressable key={client.id} onPress={() => setSelected(isOpen ? null : client.id)}>
            <HoverRow style={sty.row}>
              <View style={sty.info}>
                <Text style={sty.name}>{displayName}</Text>
                <Text style={sty.cnpj}>{client.owner_email}</Text>
              </View>
              <View style={[sty.badge, { backgroundColor: pc.color + "18" }]}><Text style={[sty.badgeText, { color: pc.color }]}>{pc.label}</Text></View>
              <View style={[sty.badge, { backgroundColor: sc.color + "18" }]}><Text style={[sty.badgeText, { color: sc.color }]}>{sc.label}</Text></View>
            </HoverRow>

            {isOpen && (
              <View style={sty.detail}>
                <View style={sty.detailGrid}>
                  <View style={sty.detailItem}><Text style={sty.detailLabel}>Owner</Text><Text style={sty.detailValue}>{client.owner_name || "-"}</Text></View>
                  <View style={sty.detailItem}><Text style={sty.detailLabel}>Email</Text><Text style={sty.detailValue}>{client.owner_email}</Text></View>
                  <View style={sty.detailItem}><Text style={sty.detailLabel}>Desde</Text><Text style={sty.detailValue}>{client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}</Text></View>
                  <View style={sty.detailItem}><Text style={sty.detailLabel}>Plano</Text><Text style={[sty.detailValue, { color: pc.color }]}>{pc.label}</Text></View>
                </View>

                <View style={sty.detailGrid}>
                  <View style={sty.detailItem}>
                    <Text style={sty.detailLabel}>Modulos visiveis</Text>
                    <Text style={sty.detailValue}>{(client.visible_modules || []).length}</Text>
                  </View>
                  <View style={sty.detailItem}>
                    <Text style={sty.detailLabel}>Overrides</Text>
                    <Text style={sty.detailValue}>{Object.keys(client.module_overrides || {}).length}</Text>
                  </View>
                </View>

                <View style={sty.toggles}>
                  <Text style={sty.toggleTitle}>Modulos</Text>
                  {MODULE_LABELS.map(mod => {
                    const isVisible = (client.visible_modules || []).includes(mod.key);
                    const hasOverride = client.module_overrides && mod.key in client.module_overrides;
                    return (
                      <View key={mod.key} style={sty.toggleRow}>
                        <Text style={[sty.toggleLabel, !isVisible && { opacity: 0.4 }]}>
                          {mod.label} {hasOverride ? "(override)" : ""}
                        </Text>
                        <Switch
                          value={isVisible}
                          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                          thumbColor={isVisible ? Colors.violet : Colors.ink3}
                          onValueChange={(val) => handleToggle(client, mod.key, val)}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
const sty = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, gap: 8, flexWrap: "wrap" },
  info: { flex: 1, minWidth: 150, gap: 2 },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  cnpj: { fontSize: 11, color: Colors.ink3 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginBottom: 8, marginTop: -2, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  detailItem: { minWidth: 100, gap: 2 },
  detailLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  toggles: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  toggleTitle: { fontSize: 12, fontWeight: "600", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  toggleLabel: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
});

// ── Finance Admin (placeholder — uses backend /admin/revenue) ──
function FinanceAdmin() {
  const { token, isStaff } = useAuthStore();
  const { data: apiDash } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: !!token && isStaff,
    staleTime: 30000,
  });

  const mrrEstimated = apiDash?.mrr?.estimated || 0;
  const totalCosts = apiDash?.costs?.current_month || 0;
  const grossMargin = apiDash?.gross_margin?.estimated || 0;

  return (
    <View>
      <View style={{ flexDirection: IS_WIDE ? "row" : "column", gap: 12 }}>
        <HoverCard style={[fa.card, { flex: 1 }]}>
          <Text style={fa.ct}>Receita recorrente</Text>
          <Text style={[fa.big, { color: Colors.green }]}>{fmt(mrrEstimated)}</Text>
          <Text style={fa.hint}>MRR estimado baseado nos planos ativos</Text>
        </HoverCard>
        <HoverCard style={[fa.card, { flex: 1 }]}>
          <Text style={fa.ct}>Custos operacionais</Text>
          <Text style={[fa.big, { color: Colors.amber }]}>{fmt(totalCosts)}</Text>
          <Text style={fa.hint}>Total de custos no mes atual</Text>
        </HoverCard>
        <HoverCard style={[fa.card, { flex: 1 }]}>
          <Text style={fa.ct}>Margem bruta</Text>
          <Text style={[fa.big, { color: grossMargin >= 0 ? Colors.green : Colors.red }]}>{fmt(grossMargin)}</Text>
          <Text style={fa.hint}>Receita - custos</Text>
        </HoverCard>
      </View>
      <HoverCard style={fa.card}>
        <Text style={fa.ct}>Projecao anual</Text>
        <Text style={[fa.big, { color: Colors.violet3 }]}>{fmt(mrrEstimated * 12)}</Text>
        <Text style={fa.hint}>Baseado no MRR atual de {fmt(mrrEstimated)}</Text>
      </HoverCard>
    </View>
  );
}
const fa = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  ct: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  big: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.ink3 },
});

// ── Main Screen ──────────────────────────────────────────────
export default function GestaoAuraScreen() {
  const router = useRouter();
  const { isStaff, isDemo } = useAuthStore();

  if (!isStaff && !isDemo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Icon name="alert" size={32} color={Colors.red} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" }}>Acesso restrito</Text>
        <Text style={{ fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center" }}>Esta area e exclusiva para a equipe Aura.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  if (isDemo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Icon name="bar_chart" size={32} color={Colors.amber} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" }}>Gestao Aura</Text>
        <Text style={{ fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center", lineHeight: 20 }}>Este painel e exclusivo para a equipe Aura e nao esta disponivel no modo demonstrativo.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  const [tab, setTab] = useState(0);
  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Gestao Aura" />
      <View style={z.adminBadge}><Icon name="star" size={12} color={Colors.amber} /><Text style={z.adminText}>Painel administrativo</Text></View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {tab === 0 && <Dashboard />}
      {tab === 1 && <ClientsTable />}
      {tab === 2 && <FinanceAdmin />}
      {tab === 3 && <ContabilidadeAdmin />}
      {tab === 4 && <EquipeAdmin />}
      {tab === 5 && <SuporteAdmin />}
      {tab === 6 && <ConfigAdmin />}
      {tab === 7 && <LogsAdmin />}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.amberD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.amber + "33" },
  adminText: { fontSize: 12, color: Colors.amber, fontWeight: "600" },
});
