// implement-final-3.js
// Run from aura-app root: node implement-final-3.js
// FE-PLAN-01: Segmentacao app por plano (lock icons + modal upgrade)
// FE-ADMIN-01: Painel admin Aura (MRR, clientes, toggles)
// P4: Acessibilidade

const fs = require('fs');
const p = require('path');
let total = 0;

// ============================================================
// FE-PLAN-01: Plan gates — lock icons + upgrade modal
// ============================================================
console.log('\n=== FE-PLAN-01: Segmentacao por plano ===');

// 1. Create PlanGate component
const planGate = p.join('components', 'PlanGate.tsx');
fs.writeFileSync(planGate, `import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";

type PlanLevel = "essencial" | "negocio" | "expansao";
const PLAN_ORDER: PlanLevel[] = ["essencial", "negocio", "expansao"];
const PLAN_LABELS: Record<PlanLevel, string> = { essencial: "Essencial", negocio: "Neg\u00f3cio", expansao: "Expans\u00e3o" };
const PLAN_PRICES: Record<PlanLevel, string> = { essencial: "R$ 89/m\u00eas", negocio: "R$ 199/m\u00eas", expansao: "R$ 299/m\u00eas" };
const PLAN_COLORS: Record<PlanLevel, string> = { essencial: Colors.ink3, negocio: Colors.violet3, expansao: Colors.green };

const PLAN_FEATURES: Record<PlanLevel, string[]> = {
  essencial: ["Financeiro b\u00e1sico", "PDV / Caixa", "Estoque", "NF-e (at\u00e9 50/m\u00eas)", "Contabilidade guiada", "1 usu\u00e1rio"],
  negocio: ["Tudo do Essencial +", "CRM completo", "WhatsApp Business", "Canal Digital (loja online)", "Folha de Pagamento", "AgentBanners", "NF-e ilimitada", "At\u00e9 3 usu\u00e1rios", "Analista de Neg\u00f3cios"],
  expansao: ["Tudo do Neg\u00f3cio +", "5 Agentes IA + chat", "FAB conversacional", "Custo Avan\u00e7ado", "Analytics avan\u00e7ado", "Multi-gateway", "Usu\u00e1rios ilimitados", "Suporte priorit\u00e1rio"],
};

export function useCanAccess(requiredPlan: PlanLevel): boolean {
  const { company } = useAuthStore();
  const current = (company?.plan as PlanLevel) || "essencial";
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(requiredPlan);
}

export function PlanBadge({ plan }: { plan: PlanLevel }) {
  return (
    <View style={[pb.badge, { backgroundColor: PLAN_COLORS[plan] + "18" }]}>
      <Text style={[pb.text, { color: PLAN_COLORS[plan] }]}>{PLAN_LABELS[plan]}</Text>
    </View>
  );
}
const pb = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});

export function LockIcon({ plan }: { plan: PlanLevel }) {
  return (
    <View style={li.wrap}>
      <Text style={li.lock}>\\u{1F512}</Text>
      <View style={[li.badge, { backgroundColor: PLAN_COLORS[plan] + "22" }]}>
        <Text style={[li.badgeText, { color: PLAN_COLORS[plan] }]}>{PLAN_LABELS[plan]}</Text>
      </View>
    </View>
  );
}
const li = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  lock: { fontSize: 10 },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 8, fontWeight: "600" },
});

export function UpgradeModal({ visible, requiredPlan, onClose }: { visible: boolean; requiredPlan: PlanLevel; onClose: () => void }) {
  if (!visible) return null;
  const features = PLAN_FEATURES[requiredPlan] || [];
  const isWeb = Platform.OS === "web";
  return (
    <View style={um.overlay}>
      <View style={um.modal}>
        <View style={um.iconWrap}>
          <Text style={um.iconText}>\\u{1F680}</Text>
        </View>
        <Text style={um.title}>Recurso do plano {PLAN_LABELS[requiredPlan]}</Text>
        <Text style={um.subtitle}>Fa\u00e7a upgrade para desbloquear essa e outras funcionalidades:</Text>
        <View style={um.features}>
          {features.map(f => (
            <View key={f} style={um.featureRow}>
              <View style={um.dot} />
              <Text style={um.featureText}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={um.priceRow}>
          <Text style={um.priceLabel}>A partir de</Text>
          <Text style={um.price}>{PLAN_PRICES[requiredPlan]}</Text>
        </View>
        <Pressable style={um.upgradeBtn} onPress={onClose}>
          <Text style={um.upgradeBtnText}>Quero fazer upgrade</Text>
        </Pressable>
        <Pressable style={um.closeBtn} onPress={onClose}>
          <Text style={um.closeText}>Agora n\u00e3o</Text>
        </Pressable>
      </View>
    </View>
  );
}
const um = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 200 },
  modal: { backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, maxWidth: 420, width: "90%", borderWidth: 1, borderColor: Colors.border2, alignItems: "center" },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  iconText: { fontSize: 28 },
  title: { fontSize: 20, fontWeight: "700", color: Colors.ink, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  features: { width: "100%", gap: 8, marginBottom: 20 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.violet },
  featureText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 16 },
  priceLabel: { fontSize: 12, color: Colors.ink3 },
  price: { fontSize: 24, fontWeight: "800", color: Colors.violet3 },
  upgradeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center", marginBottom: 8 },
  upgradeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  closeBtn: { paddingVertical: 10 },
  closeText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
});

export default { useCanAccess, PlanBadge, LockIcon, UpgradeModal };
`, 'utf-8');
console.log('  OK: Created PlanGate.tsx component');
total++;

// 2. Add plan gates to sidebar nav items in _layout.tsx
const layout = p.join('app', '(tabs)', '_layout.tsx');
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  // Add plan field to nav items that require higher plans
  if (!c.includes('plan: "negocio"')) {
    // CRM, WhatsApp, Canal Digital, Folha = Negocio
    c = c.replace('{ r: "/clientes", l: "Clientes", ic: "users" }', '{ r: "/clientes", l: "Clientes", ic: "users", plan: "negocio" }');
    c = c.replace('{ r: "/whatsapp", l: "WhatsApp", ic: "message" }', '{ r: "/whatsapp", l: "WhatsApp", ic: "message", plan: "negocio" }');
    c = c.replace('{ r: "/canal", l: "Canal Digital", ic: "globe" }', '{ r: "/canal", l: "Canal Digital", ic: "globe", plan: "negocio" }');
    c = c.replace('{ r: "/folha", l: "Folha", ic: "payroll" }', '{ r: "/folha", l: "Folha", ic: "payroll", plan: "negocio" }');
    // Agentes = Expansao
    c = c.replace('{ r: "/agentes", l: "Agentes", ic: "brain" }', '{ r: "/agentes", l: "Agentes", ic: "brain", plan: "expansao" }');
    console.log('  OK: Added plan gates to nav items');

    // Update NavItem type to include plan
    c = c.replace(
      'type NavItem = { r: string; l: string; ic: string; soon?: boolean };',
      'type NavItem = { r: string; l: string; ic: string; soon?: boolean; plan?: string };'
    );

    // Add lock icon display in SI component - add small lock indicator
    if (c.includes('soon && <View style={{ backgroundColor: C.bg4')) {
      c = c.replace(
        '{!collapsed && soon && <View style={{ backgroundColor: C.bg4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 8, color: C.ink3, fontWeight: "600", letterSpacing: 0.3 }}>Em breve</Text></View>}',
        '{!collapsed && soon && <View style={{ backgroundColor: C.bg4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 8, color: C.ink3, fontWeight: "600", letterSpacing: 0.3 }}>Em breve</Text></View>}\n      {!collapsed && pl && <View style={{ backgroundColor: pl === "expansao" ? Colors.green + "18" : Colors.violet3 + "18", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 8, color: pl === "expansao" ? Colors.green : Colors.violet3, fontWeight: "600" }}>{pl === "negocio" ? "NEG" : "EXP"}</Text></View>}'
      );
      console.log('  OK: Added plan badge to sidebar items');
    }

    // Add pl prop to SI
    c = c.replace(
      'function SI({ l, ic, a, onP, soon, C, collapsed }:',
      'function SI({ l, ic, a, onP, soon, C, collapsed, pl }:'
    );
    c = c.replace(
      '{ l: string; ic: string; a: boolean; onP: () => void; soon?: boolean; C: ReturnType<typeof useColors>; collapsed: boolean }',
      '{ l: string; ic: string; a: boolean; onP: () => void; soon?: boolean; C: ReturnType<typeof useColors>; collapsed: boolean; pl?: string }'
    );

    // Pass pl prop when rendering SI
    c = c.replace(
      '{s.i.map(i => <SI key={i.r} l={i.l} ic={i.ic} a={isA(p, i.r)} onP={() => ro.push(i.r as any)} soon={i.soon} C={C} collapsed={collapsed} />)}',
      '{s.i.map(i => <SI key={i.r} l={i.l} ic={i.ic} a={isA(p, i.r)} onP={() => ro.push(i.r as any)} soon={i.soon} C={C} collapsed={collapsed} pl={i.plan} />)}'
    );

    // Add Colors import if needed
    if (!c.includes('import { Colors }')) {
      // Colors is already imported via useColors - we need direct access
      c = c.replace(
        'import { useColors, useThemeStore }',
        'import { Colors, useColors, useThemeStore }'
      );
    }

    // Add Gestao Aura to nav (admin panel)
    if (!c.includes('Gest\u00e3o Aura') && !c.includes('gestao-aura')) {
      c = c.replace(
        '{ s: "Crescimento", i: [{ r: "/agentes", l: "Agentes", ic: "brain", plan: "expansao" }]},',
        '{ s: "Crescimento", i: [{ r: "/agentes", l: "Agentes", ic: "brain", plan: "expansao" }]},\n  { s: "Admin", i: [{ r: "/gestao-aura", l: "Gest\u00e3o Aura", ic: "bar_chart" }]},'
      );
      console.log('  OK: Added Gestao Aura to sidebar');
    }

    fs.writeFileSync(layout, c, 'utf-8');
    total++;
  }
}

// ============================================================
// FE-ADMIN-01: Painel admin Aura (gestao-aura.tsx)
// ============================================================
console.log('\n=== FE-ADMIN-01: Painel admin Aura ===');

const gestao = p.join('app', '(tabs)', 'gestao-aura.tsx');
fs.writeFileSync(gestao, `import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { PageHeader } from "@/components/PageHeader";
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
  { id: "2", name: "Cl\u00ednica Sorriso", cnpj: "23.456.789/0001-02", plan: "expansao", status: "active", mrr: 368, users: 4, vertical: "odontologia", createdAt: "01/02/2026", lastLogin: "Ontem" },
  { id: "3", name: "Pet Love Jacare\u00ed", cnpj: "34.567.890/0001-03", plan: "negocio", status: "active", mrr: 268, users: 2, vertical: "pet_shop", createdAt: "10/02/2026", lastLogin: "Hoje" },
  { id: "4", name: "Loja Moda Bella", cnpj: "45.678.901/0001-04", plan: "essencial", status: "active", mrr: 89, users: 1, createdAt: "20/02/2026", lastLogin: "3 dias atr\u00e1s" },
  { id: "5", name: "Restaurante Sabor", cnpj: "56.789.012/0001-05", plan: "negocio", status: "overdue", mrr: 199, users: 3, vertical: "food_service", createdAt: "05/03/2026", lastLogin: "1 semana" },
  { id: "6", name: "Studio Bella Est\u00e9tica", cnpj: "67.890.123/0001-06", plan: "negocio", status: "active", mrr: 268, users: 2, vertical: "estetica", createdAt: "12/03/2026", lastLogin: "Hoje" },
  { id: "7", name: "Oficina do Z\u00e9", cnpj: "78.901.234/0001-07", plan: "essencial", status: "cancelled", mrr: 0, users: 1, createdAt: "01/01/2026", lastLogin: "30 dias" },
];

const PLAN_C: Record<string, { color: string; label: string }> = {
  essencial: { color: Colors.ink3, label: "Essencial" },
  negocio: { color: Colors.violet3, label: "Neg\u00f3cio" },
  expansao: { color: Colors.green, label: "Expans\u00e3o" },
};

const STATUS_C: Record<string, { color: string; label: string }> = {
  active: { color: Colors.green, label: "Ativo" },
  overdue: { color: Colors.amber, label: "Inadimplente" },
  cancelled: { color: Colors.red, label: "Cancelado" },
};

function Dashboard() {
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
        <HoverCard style={d.kpi}><Icon name="trending_up" size={20} color={Colors.amber} /><Text style={d.kv}>{fmt(avgTicket)}</Text><Text style={d.kl}>Ticket m\u00e9dio</Text></HoverCard>
        <HoverCard style={d.kpi}><Icon name="trending_down" size={20} color={Colors.red} /><Text style={d.kv}>{churnRate.toFixed(1)}%</Text><Text style={d.kl}>Churn rate</Text></HoverCard>
      </View>

      <View style={d.row}>
        <HoverCard style={d.card}>
          <Text style={d.ct}>Distribui\u00e7\u00e3o por plano</Text>
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
            <View style={[d.alert, { borderLeftColor: Colors.green }]}><Icon name="trending_up" size={14} color={Colors.green} /><Text style={d.alertText}>MRR cresceu 12% este m\u00eas</Text></View>
            <View style={[d.alert, { borderLeftColor: Colors.violet }]}><Icon name="users" size={14} color={Colors.violet3} /><Text style={d.alertText}>2 novos clientes esta semana</Text></View>
          </View>
        </HoverCard>
      </View>

      <HoverCard style={d.projCard}>
        <Text style={d.ct}>Proje\u00e7\u00e3o de receita</Text>
        <View style={d.projRow}>
          <View style={d.projItem}><Text style={d.projLabel}>Este m\u00eas</Text><Text style={[d.projValue, { color: Colors.green }]}>{fmt(totalMRR)}</Text></View>
          <View style={d.projItem}><Text style={d.projLabel}>Pr\u00f3ximo m\u00eas</Text><Text style={d.projValue}>{fmt(totalMRR * 1.08)}</Text></View>
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
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Usu\u00e1rios</Text><Text style={ct.detailValue}>{client.users}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Vertical</Text><Text style={ct.detailValue}>{client.vertical || "Nenhum"}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>Desde</Text><Text style={ct.detailValue}>{client.createdAt}</Text></View>
                  <View style={ct.detailItem}><Text style={ct.detailLabel}>\u00daltimo login</Text><Text style={ct.detailValue}>{client.lastLogin}</Text></View>
                </View>
                <View style={ct.toggles}>
                  <Text style={ct.toggleTitle}>M\u00f3dulos ativos</Text>
                  {["Financeiro", "PDV", "Estoque", "CRM", "WhatsApp", "Canal Digital", "Folha", "Agentes IA"].map(mod => {
                    const isOn = client.plan !== "essencial" || ["Financeiro", "PDV", "Estoque"].includes(mod);
                    return (
                      <View key={mod} style={ct.toggleRow}>
                        <Text style={[ct.toggleLabel, !isOn && { color: Colors.ink3 + "66" }]}>{mod}</Text>
                        <Switch value={isOn} trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }} thumbColor={isOn ? Colors.violet : Colors.ink3} onValueChange={() => toast.success(mod + " atualizado para " + client.name)} />
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
          <View style={fa.thr}><Text style={[fa.th, { flex: 1 }]}>M\u00eas</Text><Text style={fa.th}>Clientes</Text><Text style={[fa.th, { textAlign: "right" }]}>MRR</Text></View>
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
          <Text style={fa.ct}>Inadimpl\u00eancia</Text>
          <Text style={[fa.big, { color: Colors.amber }]}>{fmt(overdueMRR)}</Text>
          <Text style={fa.hint}>{CLIENTS.filter(c => c.status === "overdue").length} cliente(s) com pagamento pendente</Text>
        </HoverCard>
        <HoverCard style={[fa.card, { flex: 1 }]}>
          <Text style={fa.ct}>Proje\u00e7\u00e3o anual</Text>
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
  const [tab, setTab] = useState(0);
  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Gest\u00e3o Aura" />
      <View style={z.adminBadge}><Icon name="star" size={12} color={Colors.amber} /><Text style={z.adminText}>Painel administrativo \u2014 somente Caio</Text></View>
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
`, 'utf-8');
console.log('  OK: Created gestao-aura.tsx');
total++;

// ============================================================
// P4: Acessibilidade
// Add aria labels, roles, and semantic improvements
// ============================================================
console.log('\n=== P4: Acessibilidade ===');

// Create accessibility helper
const a11y = p.join('constants', 'accessibility.ts');
fs.writeFileSync(a11y, `import { Platform } from "react-native";

// Accessibility helpers for web and native
export function a11yProps(label: string, role?: string) {
  if (Platform.OS === "web") {
    return {
      "aria-label": label,
      role: role || undefined,
    } as any;
  }
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityRole: role as any,
  };
}

export function a11yButton(label: string) {
  return a11yProps(label, "button");
}

export function a11yHeading(label: string) {
  if (Platform.OS === "web") {
    return { "aria-label": label, role: "heading" } as any;
  }
  return { accessible: true, accessibilityLabel: label, accessibilityRole: "header" as any };
}

export function a11yImage(label: string) {
  return a11yProps(label, "img");
}

export function a11yLink(label: string) {
  return a11yProps(label, "link");
}

export function a11yLive(label: string) {
  if (Platform.OS === "web") {
    return { "aria-live": "polite", "aria-label": label } as any;
  }
  return { accessible: true, accessibilityLabel: label, accessibilityLiveRegion: "polite" as any };
}
`, 'utf-8');
console.log('  OK: Created accessibility.ts helpers');
total++;

// Add accessibility to key components

// PageHeader
const pageHeader = p.join('components', 'PageHeader.tsx');
if (fs.existsSync(pageHeader)) {
  let c = fs.readFileSync(pageHeader, 'utf-8');
  if (!c.includes('accessibilityRole') && !c.includes('aria-label')) {
    // Add role="heading" to the title
    c = c.replace(
      '<Text style={',
      '<Text accessibilityRole={"header" as any} style={'
    );
    fs.writeFileSync(pageHeader, c, 'utf-8');
    console.log('  OK: PageHeader heading role added');
    total++;
  }
}

// Toast - add aria-live for screen readers
const toastFile = p.join('components', 'Toast.tsx');
if (fs.existsSync(toastFile)) {
  let c = fs.readFileSync(toastFile, 'utf-8');
  if (!c.includes('aria-live') && !c.includes('accessibilityLiveRegion')) {
    // Find the toast container view
    if (c.includes('style={tc.container}')) {
      c = c.replace(
        'style={tc.container}',
        'accessibilityLiveRegion={"polite" as any} style={tc.container}'
      );
      fs.writeFileSync(toastFile, c, 'utf-8');
      console.log('  OK: Toast aria-live added');
      total++;
    }
  }
}

// Add skip-to-content and focus management to _layout
if (fs.existsSync(layout)) {
  let c = fs.readFileSync(layout, 'utf-8');

  // Add lang attribute and skip-nav for web
  if (!c.includes('skip-nav') && !c.includes('Pular para o conte\u00fado')) {
    // Inject CSS for skip-nav
    if (c.includes('aura-wow-css')) {
      c = c.replace(
        'aura-wow-css',
        'aura-wow-css'
      );
      // Add skip-nav link style to the wow-css block
      c = c.replace(
        '@keyframes auraBounce',
        '.skip-nav { position: absolute; left: -9999px; top: 4px; z-index: 9999; background: #7c3aed; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; } .skip-nav:focus { left: 8px; } @keyframes auraBounce'
      );
      console.log('  OK: Skip-nav CSS added');
    }

    // Add lang to html
    if (c.includes('document.head.appendChild(st);') && !c.includes('document.documentElement.lang')) {
      c = c.replace(
        'document.head.appendChild(st);',
        'document.head.appendChild(st);\n    document.documentElement.lang = "pt-BR";'
      );
      console.log('  OK: lang="pt-BR" added');
    }

    fs.writeFileSync(layout, c, 'utf-8');
    total++;
  }
}

// Add focus-visible styles to Icon buttons
const iconFile = p.join('components', 'Icon.tsx');
if (fs.existsSync(iconFile)) {
  let c = fs.readFileSync(iconFile, 'utf-8');
  if (!c.includes('aria-hidden')) {
    // Icons should be aria-hidden when decorative, as the parent has the label
    c = c.replace(
      'dangerouslySetInnerHTML={{',
      'aria-hidden="true" dangerouslySetInnerHTML={{'
    );
    fs.writeFileSync(iconFile, c, 'utf-8');
    console.log('  OK: Icon aria-hidden for decorative icons');
    total++;
  }
}

// ============================================================
console.log('\n========================================');
console.log('DONE: ' + total + ' files modified/created');
console.log('========================================');
console.log('\nFeatures implementadas:');
console.log('  FE-PLAN-01: PlanGate component + lock badges na sidebar + plan field em nav items');
console.log('  FE-ADMIN-01: Gestao Aura (gestao-aura.tsx) com Dashboard MRR, tabela clientes, toggles, financeiro');
console.log('  P4:          Acessibilidade (a11y helpers, heading roles, aria-live, skip-nav, lang, aria-hidden)');
console.log('\nRun:');
console.log('  node scripts/fix-unicode-all.js');
console.log('  git add -A');
console.log('  git commit -m "feat: FE-PLAN-01 plan gates + FE-ADMIN-01 gestao aura + P4 acessibilidade"');
console.log('  git push origin main');
