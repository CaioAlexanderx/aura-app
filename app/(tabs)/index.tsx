import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors } from "@/constants/colors";

// ── Helpers ──────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtK = (n: number) => n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : fmt(n);

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getMonthName(): string {
  const months = ["Janeiro","Fevereiro","Mar\u00e7o","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return months[new Date().getMonth()];
}

// ── Mock Data (demo mode) ────────────────────────────────────
const MOCK = {
  revenue: 18420, expenses: 7840, net: 10580,
  salesToday: 47, avgTicket: 391.91, newCustomers: 12,
  revenueDelta: 12, expensesDelta: 3, netDelta: 18,
  dasAlert: { days: 14, amount: 76.90 },
  recentSales: [
    { id: "1", customer: "Maria Silva", amount: 156.80, time: "14:32" },
    { id: "2", customer: "Pedro Costa", amount: 89.90, time: "13:15" },
    { id: "3", customer: "Ana Oliveira", amount: 234.50, time: "11:47" },
  ],
};

// ── Components ───────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initial = (name || "A").charAt(0).toUpperCase();
  return (
    <View style={av.circle}>
      <Text style={av.letter}>{initial}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  letter: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

function PlanBadge({ plan }: { plan: string }) {
  const label = plan === "expansao" ? "Expans\u00e3o" : plan === "negocio" ? "Neg\u00f3cio" : "Essencial";
  return (
    <View style={pb.badge}>
      <View style={pb.dot} />
      <Text style={pb.text}>{label}</Text>
    </View>
  );
}
const pb = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  text:  { fontSize: 11, color: Colors.violet3, fontWeight: "600", letterSpacing: 0.3 },
});

function KpiCard({ icon, label, value, delta, deltaUp, accent }: {
  icon: string; label: string; value: string; delta?: string; deltaUp?: boolean; accent?: string;
}) {
  return (
    <View style={kpi.card}>
      <View style={kpi.header}>
        <View style={[kpi.iconCircle, accent ? { backgroundColor: accent + "18" } : {}]}>
          <Text style={kpi.icon}>{icon}</Text>
        </View>
      </View>
      <Text style={kpi.value}>{value}</Text>
      <Text style={kpi.label}>{label}</Text>
      {delta && (
        <View style={[kpi.deltaBox, { backgroundColor: deltaUp ? Colors.greenD : Colors.redD }]}>
          <Text style={[kpi.deltaText, { color: deltaUp ? Colors.green : Colors.red }]}>
            {deltaUp ? "\u25B2" : "\u25BC"} {delta}
          </Text>
        </View>
      )}
    </View>
  );
}
const kpi = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
    flex: 1, minWidth: IS_WIDE ? 180 : "45%", margin: 5,
  },
  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  iconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  icon:       { fontSize: 16 },
  value:      { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5, marginBottom: 4 },
  label:      { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  deltaBox:   { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deltaText:  { fontSize: 10, fontWeight: "600" },
});

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={qa.btn} onPress={onPress} activeOpacity={0.7}>
      <View style={qa.iconWrap}><Text style={qa.icon}>{icon}</Text></View>
      <Text style={qa.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  btn:      { alignItems: "center", gap: 8, minWidth: 72 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  icon:     { fontSize: 20 },
  label:    { fontSize: 10, color: Colors.ink3, fontWeight: "500", textAlign: "center" },
});

function SaleRow({ customer, amount, time }: { customer: string; amount: number; time: string }) {
  return (
    <View style={sr.row}>
      <View style={sr.left}>
        <View style={sr.avatar}><Text style={sr.avatarText}>{customer.charAt(0)}</Text></View>
        <View>
          <Text style={sr.name}>{customer}</Text>
          <Text style={sr.time}>{time}</Text>
        </View>
      </View>
      <Text style={sr.amount}>+{fmt(amount)}</Text>
    </View>
  );
}
const sr = StyleSheet.create({
  row:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left:       { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  name:       { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  time:       { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  amount:     { fontSize: 13, color: Colors.green, fontWeight: "600" },
});

// ── Main Screen ──────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, company, token, isDemo, logout } = useAuthStore();

  const { data } = useQuery({
    queryKey: ["dashboard", company?.id],
    queryFn:  () => dashboardApi.summary(company!.id, token!),
    enabled:  !!company?.id && !!token && !isDemo,
    retry: 1,
  });

  // Use mock data in demo mode, real data when available
  const d = isDemo ? MOCK : (data ?? MOCK);
  const greeting = getGreeting();
  const month = getMonthName();
  const year = new Date().getFullYear();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>

      {/* ── Header ──────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Avatar name={user?.name ?? "A"} />
          <View>
            <Text style={s.greeting}>{greeting}, {user?.name?.split(" ")[0] ?? "usu\u00e1rio"}</Text>
            <Text style={s.companyName}>{company?.name ?? "\u2014"}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <PlanBadge plan={company?.plan ?? "essencial"} />
          <TouchableOpacity onPress={logout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hero Card ───────────────────────────────────── */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <Text style={s.heroEye}>{month} \u00B7 {year}</Text>
          <View style={s.healthBadge}>
            <View style={s.healthDot} />
            <Text style={s.healthText}>Saud\u00e1vel</Text>
          </View>
        </View>
        <Text style={s.heroValue}>{fmt(d.net)}</Text>
        <Text style={s.heroLabel}>Lucro l\u00edquido do m\u00eas</Text>
        {d.dasAlert && (
          <View style={s.dasAlert}>
            <Text style={s.dasIcon}>{"\u26A0\uFE0F"}</Text>
            <Text style={s.dasText}>
              DAS vence em {d.dasAlert.days} dias \u2014 estimativa {fmt(d.dasAlert.amount)}
            </Text>
          </View>
        )}
      </View>

      {/* ── KPI Grid ────────────────────────────────────── */}
      <Text style={s.section}>Vis\u00e3o geral</Text>
      <View style={s.grid}>
        <KpiCard icon={"\u{1F4C8}"} label="Receita do m\u00eas" value={fmtK(d.revenue)} delta={`${d.revenueDelta}% vs anterior`} deltaUp accent={Colors.green} />
        <KpiCard icon={"\u{1F4C9}"} label="Despesas" value={fmtK(d.expenses)} delta={`${d.expensesDelta}% vs anterior`} deltaUp={false} accent={Colors.red} />
        <KpiCard icon={"\u{1F4B0}"} label="Lucro l\u00edquido" value={fmtK(d.net)} delta={`${d.netDelta}% vs anterior`} deltaUp accent={Colors.green} />
        <KpiCard icon={"\u{1F6D2}"} label="Vendas hoje" value={String(d.salesToday)} accent={Colors.violet} />
        <KpiCard icon={"\u{1F3AF}"} label="Ticket m\u00e9dio" value={fmt(d.avgTicket)} accent={Colors.amber} />
        <KpiCard icon={"\u{1F465}"} label="Clientes novos" value={String(d.newCustomers)} delta="este m\u00eas" deltaUp accent={Colors.violet} />
      </View>

      {/* ── Quick Actions ───────────────────────────────── */}
      <Text style={s.section}>Acesso r\u00e1pido</Text>
      <View style={s.actions}>
        <QuickAction icon={"\u{1F4B3}"} label="PDV" />
        <QuickAction icon={"\u{1F4CA}"} label="Financeiro" />
        <QuickAction icon={"\u{1F4E6}"} label="Estoque" />
        <QuickAction icon={"\u{1F9FE}"} label="NF-e" />
        <QuickAction icon={"\u{1F4C5}"} label="Cont\u00e1bil" />
      </View>

      {/* ── Recent Sales ────────────────────────────────── */}
      <View style={s.recentHeader}>
        <Text style={s.section}>\u00DAltimas vendas</Text>
        <TouchableOpacity><Text style={s.seeAll}>Ver todas</Text></TouchableOpacity>
      </View>
      <View style={s.recentCard}>
        {(d.recentSales ?? MOCK.recentSales).map((sale: any) => (
          <SaleRow key={sale.id} customer={sale.customer} amount={sale.amount} time={sale.time} />
        ))}
      </View>

      {/* ── Demo Badge ──────────────────────────────────── */}
      {isDemo && (
        <View style={s.demoBanner}>
          <Text style={s.demoText}>Modo demonstrativo \u2014 dados ilustrativos</Text>
        </View>
      )}

    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },

  // Header
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  greeting:    { fontSize: 16, color: Colors.ink, fontWeight: "600" },
  companyName: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  logoutBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  logoutText:  { fontSize: 11, color: Colors.ink3, fontWeight: "500" },

  // Hero
  hero: {
    backgroundColor: Colors.bg3,
    borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border2,
    marginBottom: 28,
  },
  heroTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heroEye:     { fontSize: 11, color: Colors.violet3, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600" },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.greenD, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  healthDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  healthText:  { fontSize: 11, color: Colors.green, fontWeight: "600" },
  heroValue:   { fontSize: 36, fontWeight: "800", color: Colors.ink, letterSpacing: -1, marginBottom: 4 },
  heroLabel:   { fontSize: 13, color: Colors.ink3, marginBottom: 16 },
  dasAlert:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12 },
  dasIcon:     { fontSize: 14 },
  dasText:     { fontSize: 12, color: Colors.amber, fontWeight: "500", flex: 1 },

  // KPIs
  section:  { fontSize: 15, color: Colors.ink, fontWeight: "600", marginBottom: 14 },
  grid:     { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 28 },

  // Quick Actions
  actions:  { flexDirection: "row", gap: 16, marginBottom: 28, paddingVertical: 4 },

  // Recent Sales
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  seeAll:       { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  recentCard:   { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },

  // Demo
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText:   { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
