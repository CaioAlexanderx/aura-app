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

const TABS = ["Dashboard", "Clientes", "Financeiro"];

type Client = {
  id: string; name: string; cnpj: string; plan: "essencial" | "negocio" | "expansao";
  status: "active" | "overdue" | "cancelled"; mrr: number; users: number;
  vertical?: string; createdAt: string; lastLogin: string;
};

const CLIENTS: Client[] = [
  { id: "1", name: "Barbearia do Marcos", cnpj: "12.345.678/0001-01", plan: "negocio", status: "active", mrr: 199, users: 2, vertical: "barbearia_salao", createdAt: "15/01/2026", lastLogin: "Hoje" },
  { id: "2", name: "Clínica Sorriso", cnpj: "23.456.789/0001-02", plan: "expansao", status: "active", mrr: 368, users: 4, vertical: "odontologia", createdAt: "01/02/2026", lastLogin: "Ontem" },
  { id: "3", name: "Pet Love Jacareí", cnpj: "34.567.890/0001-03", plan: "negocio", status: "active", mrr: 268, users: 2, vertical: "pet_shop", createdAt: "10/02/2026", lastLogin: "Hoje" },
  { id: "4", name: "Loja Moda Bella", cnpj: "45.678.901/0001-04", plan: "essencial", status: "active", mrr: 89, users: 1, createdAt: "20/02/2026", lastLogin: "3 dias atrás" },
  { id: "5", name: "Restaurante Sabor", cnpj: "56.789.012/0001-05", plan: "negocio", status: "overdue", mrr: 199, users: 3, vertical: "food_service", createdAt: "05/03/2026", lastLogin: "1 semana" },
  { id: "6", name: "Studio Bella Estética", cnpj: "67.890.123/0001-06", plan: "negocio", status: "active", mrr: 268, users: 2, vertical: "estetica", createdAt: "12/03/2026", lastLogin: "Hoje" },
  { id: "7", name: "Oficina do Zé", cnpj: "78.901.234/0001-07", plan: "essencial", status: "cancelled", mrr: 0, users: 1, createdAt: "01/01/2026", lastLogin: "30 dias" },
];

const PLAN_C: Record<string, { color: string; label: string }> = {
  essencial: { color: Colors.ink3, label: "Essencial" },
  negocio: { color: Colors.violet3, label: "Negócio" },
  expansao: { color: Colors.green, label: "Expansão" },
};

const STATUS_C: Record<string, { color: string; label: string }> = {
  active: { color: Colors.green, label: "Ativo" },
  overdue: { color: Colors.amber, label: "Inadimplente" },
  cancelled: { color: Colors.red, label: "Cancelado" },
};

function Dashboard() {
  // CONN-25: Fetch real admin dashboard data
  const { token, isStaff } = useAuthStore();
  const { data: apiDashboard } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });
  // TODO: replace CLIENTS mock with apiDashboard when backend returns real data

  const activeClients = CLIENTS.filter(c => c.status === "active");
  const totalMRR = CLIENTS.filter(c => c.status !== "cancelled").reduce((s, c) => s + c.mrr, 0);
  const avgTicket = totalMRR / activeClients.length;
  const churnRate = (CLIENTS.filter(c => c.status === "cancelled").length / CLIENTS.length * 100);
  const overdueCount = CLIENTS.filter(c => c.status === "overdue").length;
  const planDist = { essencial: CLIENTS.filter(c => c.plan === "essencial" && c.status !== "cancelled").length, negocio: CLIENTS.filter(c => c.plan === "negocio" && c.status !== "cancelled").length, expansao: CLIENTS.filter(c => c.plan === "expansao" && c.status !== "cancelled").length };

  return (
    <View>
      <View style={d.kpis}>
        <HoverCard style={d.kpi}><Icon name="dollar" size={20} color={Colors.green} /><Text style={[d.kv, { color: Colors.green }]}>{fmt(totalMRR)}</Text><Text style={d.kl}>MRR</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="users" size={20} color={Colors.violet3} /><Text style={d.kv}>{activeClients.length}</Text><Text style={d.kl}>Clientes ativos</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="trending_up" size={20} color={Colors.amber} /><Text style={d.kv}>{fmt(avgTicket)}</Text><Text style={d.kl}>Ticket médio</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="trending_down" size={20} color={Colors.red} /><Text style={d.kv}>{churnRate.toFixed(1)}%</Text><Text style={d.kl}>Churn rate</Text></HoverCard>
      </View>

      <View style={d.row}>
        <HoverCard style={d.card}>
          <Text style={d.ct}>Distribuição por plano</Text>
          <View style={d.bars}>
            {Object.entries(planDist).map(([plan, count]) => {
              const pct = Math.round(count / activeClients.length * 100);
              const pc = PLAN_C[plan];
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
          <Text style={d.ct}>Alertas</Text>
          <View style={d.alerts}>
            {overdueCount > 0 && <View style={[d.alert, { borderLeftColor: Colors.amber }]}><Icon name="alert" size={14} color={Colors.amber} /><Text style={d.alertText}>{overdueCount} cliente(s) inadimplente(s)</Text></View>}
            <View style={[d.alert, { borderLeftColor: Colors.green }]}><Icon name="trending_up" size={14} color={Colors.green} /><Text style={d.alertText}>MRR cresceu 12% este mês</Text></View>
            <View style={[d.alert, { borderLeftColor: Colors.violet }]}><Icon name="users" size={14} color={Colors.violet3} /><Text style={d.alertText}>2 novos clientes esta semana</Text></View>
          </View>
        </HoverCard>
      </View>

      <HoverCard style={d.projCard}>
        <Text style={d.ct}>Projeção de receita</Text>
        <View style={d.projRow}>
          <View style={d.projItem}><Text style={d.projLabel}>Este mês</Text><Text style={[d.projValue, { color: Colors.green }]}>{fmt(totalMRR)}</Text></View>
          <View style={d.projItem}><Text style={d.projLabel}>Próximo mês</Text><Text style={d.projValue}>{fmt(totalMRR * 1.08)}</Text></View>
          <View style={d.projItem}><Text style={d.projLabel}>Anualizado</Text><Text style={[d.projValue, { color: Colors.violet3 }]}>{fmt(totalMRR * 12)}</Text></View>
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
  alerts: { gap: 8 },
  alert: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  alertText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  projCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  projRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  projItem: { flex: 1, minWidth: 100, gap: 4 },
  projLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  projValue: { fontSize: 20, fontWeight: "700", color: Colors.ink },
});

function ClientsTable() {
  // CONN-25: Fetch real admin clients
  const { token, isStaff } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: apiClients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => adminApi.clients(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });

  // CONN-25: Toggle module mutation
  const toggleMutation = useMutation({
    mutationFn: ({ companyId, module, enabled }: { companyId: string; module: string; enabled: boolean }) =>
      adminApi.toggleModule(companyId, module, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
  });
  // TODO: replace CLIENTS mock with apiClients?.clients when backend returns real data

  const [selected, setSelected] = useState<Client | null>(null);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? CLIENTS : CLIENTS.filter(c => c.status === filter);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {[{ k: "all", l: "Todos" }, { k: "active", l: "Ativos" }, { k: "overdue", l: "Inadimplentes" }, { k: "cancelled", l: "Cancelados" }].map(f => (
          <Pressable key={f.k} onPress={() => setFilter(f.k)} style={[ct.chip, filter === f.k && ct.chipActive]}>
            <Text style={[ct.chipText, filter === f.k && ct.chipTextActive]}>{f.l} ({f.k === "all" ? CLIENTS.length : CLIENTS.filter(c => c.status === f.k).length})</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.map(client => {
        const pc = PLAN_C[client.plan];
        const sc = STATUS_C[client.status];
        return (
          <Pressable key={client.id} onPress={() => setSelected(selected?.id === client.id ? null : client)}>
            <HoverRow style={ct.row}>
              <View style={ct.info}>
                <Text style={ct.name}>{client.name}</Text>
                <Text style={ct.cnpj}>{client.cnpj}</Text>
              </View>
              <View style={[ct.badge, { backgroundColor: pc.color + "18" }]}><Text style={[ct.badgeText, { color: pc.color }]}>{pc.label}</Text></View>
              <View style={[ct.badge, { backgroundColor: sc.color + "18" }]}><Text style={[ct.badgeText, { color: sc.color }]}>{sc.label}</Text></View>
              <Text style={ct.mrr}>{fmt(client.mrr)}</Text>
            </HoverRow>

            {selected?.id === client.id && (
              <View style={ct.detail}>
                <View style={ct.detailGrid}>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Usuários</Text><Text style={ct.detailValue}>{client.users}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Vertical</Text><Text style={ct.detailValue}>{client.vertical || "Nenhum"}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Desde</Text><Text style={ct.detailValue}>{client.createdAt}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Último login</Text><Text style={ct.detailValue}>{client.lastLogin}</Text></View>
                </View>
                <View style={ct.toggles}>
                  <Text style={ct.toggleTitle}>Módulos ativos</Text>
                  {["Financeiro", "PDV", "Estoque", "CRM", "WhatsApp", "Canal Digital", "Folha", "Agentes IA"].map(mod => {
                    const isOn = client.plan !== "essencial" || ["Financeiro", "PDV", "Estoque"].includes(mod);
                    return (
                      <View key={mod} style={ct.toggleRow}>
                        <Text style={[ct.toggleLabel, !isOn && { color: Colors.ink3 + "66" }]}>{mod}</Text>
                        <Switch value={isOn} trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }} thumbColor={isOn ? Colors.violet : Colors.ink3} onValueChange={() => (() => {
                        if (isStaff && token) {
                          toggleMutation.mutate({ companyId: client.id, module: mod.toLowerCase().replace(/ /g, "_"), enabled: !isOn });
                        }
                        toast.success(mod + " atualizado para " + client.name);
                      })()} />
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
const ct = StyleSheet.create({
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
  mrr: { fontSize: 14, fontWeight: "700", color: Colors.green, minWidth: 70, textAlign: "right" },
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

function FinanceAdmin() {
  const activeMRR = CLIENTS.filter(c => c.status !== "cancelled").reduce((s, c) => s + c.mrr, 0);
  const overdueMRR = CLIENTS.filter(c => c.status === "overdue").reduce((s, c) => s + c.mrr, 0);
  const months = [
    { m: "Jan/26", mrr: 890, clients: 4 }, { m: "Fev/26", mrr: 1357, clients: 6 },
    { m: "Mar/26", mrr: 1591, clients: 7 }, { m: "Abr/26", mrr: activeMRR, clients: CLIENTS.filter(c => c.status !== "cancelled").length },
  ];
  return (
    <View>
      <HoverCard style={fa.card}>
        <Text style={fa.ct}>Receita recorrente mensal</Text>
        <View style={fa.table}>
          <View style={fa.thr}><Text style={[fa.th, { flex: 1 }]}>Mês</Text><Text style={fa.th}>Clientes</Text><Text style={[fa.th, { textAlign: "right" }]}>MRR</Text></View>
          {months.map(m => (
            <View key={m.m} style={fa.tr}>
              <Text style={[fa.td, { flex: 1, fontWeight: "600" }]}>{m.m}</Text>
              <Text style={fa.td}>{m.clients}</Text>
              <Text style={[fa.td, { textAlign: "right", color: Colors.green, fontWeight: "600" }]}>{fmt(m.mrr)}</Text>
            </View>
          ))}
        </View>
      </HoverCard>
      <View style={{ flexDirection: IS_WIDE ? "row" : "column", gap: 12 }}>
        <HoverCard style={[fa.card, { flex: 1 }]}>
          <Text style={fa.ct}>Inadimplência</Text>
          <Text style={[fa.big, { color: Colors.amber }]}>{fmt(overdueMRR)}</Text>
          <Text style={fa.hint}>{CLIENTS.filter(c => c.status === "overdue").length} cliente(s) com pagamento pendente</Text>
        </HoverCard>
        <HoverCard style={[fa.card, { flex: 1 }]}>
          <Text style={fa.ct}>Projeção anual</Text>
          <Text style={[fa.big, { color: Colors.violet3 }]}>{fmt(activeMRR * 12)}</Text>
          <Text style={fa.hint}>Baseado no MRR atual de {fmt(activeMRR)}</Text>
        </HoverCard>
      </View>
    </View>
  );
}
const fa = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  ct: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 14 },
  table: { gap: 0 },
  thr: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 16 },
  th: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, minWidth: 60 },
  tr: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 16 },
  td: { fontSize: 13, color: Colors.ink, minWidth: 60 },
  big: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  hint: { fontSize: 12, color: Colors.ink3 },
});

export default function GestaoAuraScreen() {
  const router = useRouter();
  const { isStaff, isDemo } = useAuthStore();

  // Staff-only guard: redirect non-staff users
  if (!isStaff && !isDemo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Icon name="alert" size={32} color={Colors.red} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" }}>Acesso restrito</Text>
        <Text style={{ fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center" }}>Esta área é exclusiva para a equipe Aura.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  // Demo mode: show message that this is admin-only
  if (isDemo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Icon name="bar_chart" size={32} color={Colors.amber} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" }}>Gestão Aura</Text>
        <Text style={{ fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center", lineHeight: 20 }}>Este painel é exclusivo para a equipe Aura e não está disponível no modo demonstrativo.</Text>
        <Pressable onPress={() => router.replace("/")} style={{ backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  } // TODO: check useAuthStore().user?.role === "admin"
  const [tab, setTab] = useState(0);
  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Gestão Aura" />
      <View style={z.adminBadge}><Icon name="star" size={12} color={Colors.amber} /><Text style={z.adminText}>Painel administrativo — somente Caio</Text></View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {tab === 0 && <Dashboard />}
      {tab === 1 && <ClientsTable />}
      {tab === 2 && <FinanceAdmin />}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.amberD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.amber + "33" },
  adminText: { fontSize: 12, color: Colors.amber, fontWeight: "600" },
});
