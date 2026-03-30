import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Dimensions, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors } from "@/constants/colors";

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
  return new Date().toLocaleString("pt-BR", { month: "long" }).replace(/^\w/, c => c.toUpperCase());
}

const MOCK = {
  revenue: 18420, expenses: 7840, net: 10580,
  salesToday: 47, avgTicket: 391.91, newCustomers: 12,
  revenueDelta: 12, expensesDelta: 3, netDelta: 18,
  dasAlert: { days: 14, amount: 76.90 },
  recentSales: [
    { id: "1", customer: "Maria Silva", amount: 156.80, time: "14:32", method: "Pix" },
    { id: "2", customer: "Pedro Costa", amount: 89.90, time: "13:15", method: "Cartao" },
    { id: "3", customer: "Ana Oliveira", amount: 234.50, time: "11:47", method: "Dinheiro" },
    { id: "4", customer: "Joao Santos", amount: 67.00, time: "10:20", method: "Pix" },
  ],
  obligations: [
    { id: "1", name: "DAS-MEI", due: "20/04/2026", amount: 76.90, status: "pending", category: "aura_resolve" },
    { id: "2", name: "DASN-SIMEI", due: "31/05/2026", amount: null, status: "future", category: "aura_facilita" },
    { id: "3", name: "FGTS", due: "07/04/2026", amount: 320.00, status: "pending", category: "aura_resolve" },
    { id: "4", name: "eSocial", due: "15/04/2026", amount: null, status: "future", category: "aura_facilita" },
  ],
};

function Avatar({ name }: { name: string }) {
  const initial = (name || "A").charAt(0).toUpperCase();
  return (<View style={av.circle}><Text style={av.letter}>{initial}</Text></View>);
}
const av = StyleSheet.create({
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  letter: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string,string> = { expansao: "Expansao", negocio: "Negocio", essencial: "Essencial" };
  return (<View style={pb.badge}><View style={pb.dot} /><Text style={pb.text}>{map[plan] || plan}</Text></View>);
}
const pb = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  text: { fontSize: 11, color: Colors.violet3, fontWeight: "600", letterSpacing: 0.3 },
});

function HoverCard({ children, style, highlight, onPress }: { children: React.ReactNode; style?: any; highlight?: boolean; onPress?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        style,
        hovered && {
          transform: [{ translateY: -3 }, { scale: 1.015 }],
          borderColor: highlight ? Colors.violet2 : Colors.border2,
          shadowColor: Colors.violet, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
        },
        isWeb && { transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)" } as any,
      ]}
    >{children}</Pressable>
  );
}

function KpiCard({ icon, label, value, delta, deltaUp, accent, highlight, onPress }: {
  icon: string; label: string; value: string; delta?: string; deltaUp?: boolean; accent?: string; highlight?: boolean; onPress?: () => void;
}) {
  return (
    <HoverCard style={[kpi.card, highlight && kpi.highlight]} highlight={highlight} onPress={onPress}>
      <View style={kpi.header}>
        <View style={[kpi.iconCircle, accent ? { backgroundColor: accent + "18" } : {}]}>
          <Text style={kpi.icon}>{icon}</Text>
        </View>
        {highlight && <View style={kpi.starBadge}><Text style={kpi.starText}>Destaque</Text></View>}
      </View>
      <Text style={[kpi.value, highlight && { fontSize: 26 }]}>{value}</Text>
      <Text style={kpi.label}>{label}</Text>
      {delta && (
        <View style={[kpi.deltaBox, { backgroundColor: deltaUp ? Colors.greenD : Colors.redD }]}>
          <Text style={[kpi.deltaText, { color: deltaUp ? Colors.green : Colors.red }]}>
            {deltaUp ? "+" : "-"} {delta}
          </Text>
        </View>
      )}
    </HoverCard>
  );
}
const kpi = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 180 : "45%", margin: 5 },
  highlight: { borderColor: Colors.border2, backgroundColor: Colors.bg4, borderWidth: 1.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  iconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 16 },
  starBadge: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  starText: { fontSize: 9, color: Colors.violet3, fontWeight: "600", letterSpacing: 0.3 },
  value: { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5, marginBottom: 4 },
  label: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  deltaBox: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deltaText: { fontSize: 10, fontWeight: "600" },
});

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      style={[qa.btn, isWeb && { transition: "all 0.2s ease" } as any]}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      onPress={onPress}
    >
      <View style={[
        qa.iconWrap,
        hovered && { backgroundColor: Colors.violetD, borderColor: Colors.border2, transform: [{ scale: 1.08 }] },
        isWeb && { transition: "all 0.2s ease" } as any,
      ]}><Text style={qa.icon}>{icon}</Text></View>
      <Text style={[qa.label, hovered && { color: Colors.ink }]}>{label}</Text>
    </Pressable>
  );
}
const qa = StyleSheet.create({
  btn: { alignItems: "center", gap: 8, minWidth: 72 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 20 },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: "500", textAlign: "center" },
});

function SaleRow({ customer, amount, time, method, onPress }: { customer: string; amount: number; time: string; method?: string; onPress?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      style={[sr.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
    >
      <View style={sr.left}>
        <View style={sr.avatar}><Text style={sr.avatarText}>{customer.charAt(0)}</Text></View>
        <View>
          <Text style={sr.name}>{customer}</Text>
          <Text style={sr.time}>{time}{method ? (" / " + method) : ""}</Text>
        </View>
      </View>
      <Text style={sr.amount}>+{fmt(amount)}</Text>
    </Pressable>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  time: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  amount: { fontSize: 13, color: Colors.green, fontWeight: "600" },
});

function ObligationRow({ name, due, amount, status, category, onPress }: {
  name: string; due: string; amount: number | null; status: string; category: string; onPress?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const statusColor = status === "pending" ? Colors.amber : Colors.ink3;
  const catLabel = category === "aura_resolve" ? "Aura resolve" : "Aura facilita, voce resolve";
  const catColor = category === "aura_resolve" ? Colors.green : Colors.amber;
  return (
    <Pressable
      onPress={onPress}
      style={[ob.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
    >
      <View style={ob.left}>
        <View style={[ob.statusDot, { backgroundColor: statusColor }]} />
        <View>
          <Text style={ob.name}>{name}</Text>
          <Text style={ob.due}>Vencimento: {due}</Text>
        </View>
      </View>
      <View style={ob.right}>
        {amount != null && <Text style={ob.amount}>{fmt(amount)}</Text>}
        <View style={[ob.catBadge, { backgroundColor: catColor + "18" }]}>
          <Text style={[ob.catText, { color: catColor }]}>{catLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}
const ob = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  due: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  catText: { fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },
});

export default function DashboardScreen() {
  const { user, company, token, isDemo, logout } = useAuthStore();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["dashboard", company?.id],
    queryFn: () => dashboardApi.summary(company!.id, token!),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
  });
  const d = isDemo ? MOCK : (data ?? MOCK);
  const greeting = getGreeting();
  const month = getMonthName();
  const year = new Date().getFullYear();

  const go = (path: string) => router.push(path as any);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Avatar name={user?.name ?? "A"} />
          <View>
            <Text style={s.greeting}>{greeting}, {user?.name?.split(" ")[0] ?? "usuario"}</Text>
            <Text style={s.companyName}>{company?.name ?? "---"}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <PlanBadge plan={company?.plan ?? "essencial"} />
          <TouchableOpacity onPress={logout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <HoverCard style={s.hero} onPress={() => go("/financeiro")}>
        <View style={s.heroTop}>
          <Text style={s.heroEye}>{month} {year}</Text>
          <View style={s.healthBadge}>
            <View style={s.healthDot} />
            <Text style={s.healthText}>Saudavel</Text>
          </View>
        </View>
        <Text style={s.heroValue}>{fmt(d.net)}</Text>
        <Text style={s.heroLabel}>Lucro liquido do mes</Text>
        {d.dasAlert && (
          <Pressable onPress={() => go("/contabilidade")} style={s.dasAlert}>
            <Text style={s.dasIcon}>!</Text>
            <Text style={s.dasText}>
              DAS vence em {d.dasAlert.days} dias - estimativa {fmt(d.dasAlert.amount)}
            </Text>
            <Text style={s.dasLink}>Ver</Text>
          </Pressable>
        )}
      </HoverCard>

      <Text style={s.section}>Visao geral</Text>
      <View style={s.grid}>
        <KpiCard icon="$" label="RECEITA DO MES" value={fmtK(d.revenue)} delta={`${d.revenueDelta}% vs anterior`} deltaUp accent={Colors.green} highlight onPress={() => go("/financeiro")} />
        <KpiCard icon="-" label="DESPESAS" value={fmtK(d.expenses)} delta={`${d.expensesDelta}% vs anterior`} deltaUp={false} accent={Colors.red} onPress={() => go("/financeiro")} />
        <KpiCard icon="=" label="LUCRO LIQUIDO" value={fmtK(d.net)} delta={`${d.netDelta}% vs anterior`} deltaUp accent={Colors.green} highlight onPress={() => go("/financeiro")} />
        <KpiCard icon="#" label="VENDAS HOJE" value={String(d.salesToday)} accent={Colors.violet} onPress={() => go("/pdv")} />
        <KpiCard icon="~" label="TICKET MEDIO" value={fmt(d.avgTicket)} accent={Colors.amber} onPress={() => go("/financeiro")} />
        <KpiCard icon="+" label="CLIENTES NOVOS" value={String(d.newCustomers)} delta="este mes" deltaUp accent={Colors.violet} onPress={() => go("/clientes")} />
      </View>

      <Text style={s.section}>Acesso rapido</Text>
      <View style={s.actions}>
        <QuickAction icon="$" label="PDV" onPress={() => go("/pdv")} />
        <QuickAction icon="%" label="Financeiro" onPress={() => go("/financeiro")} />
        <QuickAction icon="#" label="Estoque" onPress={() => go("/estoque")} />
        <QuickAction icon="N" label="NF-e" onPress={() => go("/nfe")} />
        <QuickAction icon="C" label="Contabil" onPress={() => go("/contabilidade")} />
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.section}>Obrigacoes contabeis</Text>
        <View style={s.disclaimerBadge}><Text style={s.disclaimerText}>Estimativa</Text></View>
      </View>
      <HoverCard style={s.listCard} onPress={() => go("/contabilidade")}>
        {(d.obligations ?? MOCK.obligations).map((obl: any) => (
          <ObligationRow key={obl.id} name={obl.name} due={obl.due} amount={obl.amount} status={obl.status} category={obl.category} onPress={() => go("/contabilidade")} />
        ))}
        <View style={s.listFooter}>
          <Text style={s.listFooterText}>Apoio contabil informativo</Text>
        </View>
      </HoverCard>

      <View style={s.sectionHeader}>
        <Text style={s.section}>Ultimas vendas</Text>
        <TouchableOpacity onPress={() => go("/financeiro")}><Text style={s.seeAll}>Ver todas</Text></TouchableOpacity>
      </View>
      <HoverCard style={s.listCard}>
        {(d.recentSales ?? MOCK.recentSales).map((sale: any) => (
          <SaleRow key={sale.id} customer={sale.customer} amount={sale.amount} time={sale.time} method={sale.method} onPress={() => go("/clientes")} />
        ))}
      </HoverCard>

      {isDemo && (
        <View style={s.demoBanner}>
          <Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  greeting: { fontSize: 16, color: Colors.ink, fontWeight: "600" },
  companyName: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  logoutText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  hero: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 28 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heroEye: { fontSize: 11, color: Colors.violet3, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600" },
  healthBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.greenD, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  healthDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  healthText: { fontSize: 11, color: Colors.green, fontWeight: "600" },
  heroValue: { fontSize: 36, fontWeight: "800", color: Colors.ink, letterSpacing: -1, marginBottom: 4 },
  heroLabel: { fontSize: 13, color: Colors.ink3, marginBottom: 16 },
  dasAlert: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12 },
  dasIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  dasText: { fontSize: 12, color: Colors.amber, fontWeight: "500", flex: 1 },
  dasLink: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  section: { fontSize: 15, color: Colors.ink, fontWeight: "600", marginBottom: 14 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginBottom: 28 },
  actions: { flexDirection: "row", gap: 16, marginBottom: 28, paddingVertical: 4 },
  seeAll: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  disclaimerBadge: { backgroundColor: Colors.amberD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  disclaimerText: { fontSize: 9, color: Colors.amber, fontWeight: "600", letterSpacing: 0.3 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
  listFooter: { paddingTop: 10, alignItems: "center" },
  listFooterText: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
