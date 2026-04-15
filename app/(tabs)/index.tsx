import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { DemoTour } from "@/components/DemoTour";
import { TrialBanner } from "@/components/TrialBanner";
import { SkeletonDashboard, SkeletonStyle } from "@/components/Skeleton";
import { toast } from "@/components/Toast";
import { ProfileBanner } from "@/components/ProfileBanner";
import { BrandBanner } from "@/components/BrandBanner";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useVisibleModules } from "@/hooks/useVisibleModules";

import { IS_WIDE, MOCK_DASHBOARD, EMPTY_DATA, greeting, fmt } from "@/components/screens/dashboard/types";
import { Avatar } from "@/components/screens/dashboard/Avatar";
import { PlanBadge } from "@/components/screens/dashboard/PlanBadge";
import { HeroCard } from "@/components/screens/dashboard/HeroCard";
import { KPIGrid } from "@/components/screens/dashboard/KPIGrid";
import { QuickAction } from "@/components/screens/dashboard/QuickAction";
import { SaleRow } from "@/components/screens/dashboard/SaleRow";
import { ObligationRow } from "@/components/screens/dashboard/ObligationRow";
import { SalesAnalyticsCard } from "@/components/screens/dashboard/SalesAnalyticsCard";
import { EmptyDashboard } from "@/components/screens/dashboard/EmptyDashboard";

var FALLBACK_ROUTES: { mod: string; route: string }[] = [
  { mod: "pdv", route: "/pdv" },
  { mod: "estoque", route: "/estoque" },
  { mod: "financeiro", route: "/financeiro" },
  { mod: "clientes", route: "/clientes" },
  { mod: "nfe", route: "/nfe" },
  { mod: "contabilidade", route: "/contabilidade" },
  { mod: "folha", route: "/folha" },
  { mod: "agendamento", route: "/agendamento" },
  { mod: "canal", route: "/canal" },
  { mod: "agentes", route: "/agentes" },
  { mod: "configuracoes", route: "/configuracoes" },
];

export default function DashboardScreen() {
  // ALL hooks MUST be called before any conditional return (React rules of hooks)
  var { user, company, token, isDemo, logout } = useAuthStore();
  var router = useRouter();
  var [emailVerified, setEmailVerified] = useState((user as any)?.email_verified ?? false);
  var visibleMods = useVisibleModules();
  var { tradeName } = useCompanyProfile();
  var [redirecting, setRedirecting] = useState(false);

  var { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", company?.id],
    queryFn: function() { return dashboardApi.aggregate(company!.id); },
    enabled: !!company?.id && !!token && !isDemo && !redirecting,
    retry: 1, staleTime: 60000,
  });

  // Redirect to first available module if dashboard is not accessible
  useEffect(function() {
    if (visibleMods.size === 0) return;
    if (visibleMods.has("painel")) return;

    setRedirecting(true);
    for (var i = 0; i < FALLBACK_ROUTES.length; i++) {
      if (visibleMods.has(FALLBACK_ROUTES[i].mod)) {
        router.replace(FALLBACK_ROUTES[i].route as any);
        return;
      }
    }
  }, [visibleMods]);

  useEffect(function() { if (isError && !isDemo) toast.error("Erro ao carregar dashboard."); }, [isError]);
  useEffect(function() { if ((user as any)?.email_verified !== undefined) setEmailVerified((user as any).email_verified); }, [(user as any)?.email_verified]);

  // Show blank while redirecting (no hooks after this point)
  if (redirecting || (visibleMods.size > 0 && !visibleMods.has("painel"))) {
    return <View style={{ flex: 1, backgroundColor: "transparent" }} />;
  }

  var d = isDemo ? MOCK_DASHBOARD : (data || EMPTY_DATA);
  var isEmpty = !isDemo && !isLoading && !isError && d.revenue === 0 && d.expenses === 0 && d.salesToday === 0;
  var go = function(p: string) { router.push(p as any); };

  return (
    <View style={{ flex: 1 }}>
      <DemoTour visible={isDemo} />
      <TrialBanner />
      <SkeletonStyle />
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
            <Avatar name={user?.name ?? "A"} />
            <View style={{ flexShrink: 1 }}>
              <Text style={s.gr}>{greeting()}, {user?.name?.split(" ")[0] ?? "usuario"}</Text>
              <Text style={s.cn} numberOfLines={1}>{tradeName || company?.name || "---"}</Text>
            </View>
          </View>
          <BrandBanner mode="header" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <PlanBadge plan={company?.plan ?? "essencial"} />
            <TouchableOpacity onPress={logout} style={s.lo}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icon name="logout" size={14} color={Colors.ink3} />
                <Text style={s.lt}>Sair</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <ProfileBanner />
        {!isDemo && <VerifyEmailBanner emailVerified={emailVerified} onVerified={function() { setEmailVerified(true); }} />}

        {isLoading && !isDemo && <SkeletonDashboard />}
        {isEmpty && <EmptyDashboard name={user?.name?.split(" ")[0] ?? "usuario"} onPress={go} />}

        {!isLoading && !isEmpty && (
          <>
            <HeroCard net={d.net} sparkNet={d.sparkNet} />

            <Text style={s.sec}>Visao geral</Text>
            <KPIGrid d={d} onNavigate={go} />

            {!isDemo && <SalesAnalyticsCard onPress={function() { go("/pdv"); }} />}

            <Text style={s.sec}>Acesso rapido</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.actsScroll} contentContainerStyle={s.acts}>
              <QuickAction ic="cart" iconColor={Colors.green} label="PDV" onPress={function() { go("/pdv"); }} />
              <QuickAction ic="wallet" iconColor={Colors.violet3} label="Financeiro" onPress={function() { go("/financeiro"); }} />
              <QuickAction ic="package" iconColor={Colors.amber} label="Estoque" onPress={function() { go("/estoque"); }} />
              <QuickAction ic="file_text" iconColor={Colors.red} label="NF-e" onPress={function() { go("/nfe"); }} />
              <QuickAction ic="calculator" iconColor="#8b5cf6" label="Contabil" onPress={function() { go("/contabilidade"); }} />
              <QuickAction ic="users" iconColor={Colors.violet3} label="Clientes" onPress={function() { go("/clientes"); }} />
            </ScrollView>

            {d.obligations && d.obligations.length > 0 && (
              <>
                <View style={s.sh}>
                  <Text style={s.sec}>Obrigacoes contabeis</Text>
                  <View style={s.db2}><Text style={s.dt2}>Estimativa</Text></View>
                </View>
                <View style={s.lc}>
                  {d.obligations.map(function(o: any) {
                    return <ObligationRow key={o.id} name={o.name} due={o.due} amount={o.amount} status={o.status} category={o.category} />;
                  })}
                  <View style={s.lf}><Text style={s.lft}>Apoio contabil informativo</Text></View>
                </View>
              </>
            )}

            {d.recentSales && d.recentSales.length > 0 && (
              <>
                <View style={s.sh}>
                  <Text style={s.sec}>Ultimas transacoes</Text>
                  <TouchableOpacity onPress={function() { go("/financeiro"); }}><Text style={s.sa}>Ver todas</Text></TouchableOpacity>
                </View>
                <View style={s.lc}>
                  {d.recentSales.map(function(sl: any) {
                    return <SaleRow key={sl.id} customer={sl.customer} amount={sl.amount} time={sl.time} method={sl.method} type={sl.type} />;
                  })}
                </View>
              </>
            )}
          </>
        )}

        {isDemo && (
          <View style={s.dm}><Text style={s.dmt}>Modo demonstrativo - dados ilustrativos</Text></View>
        )}
      </ScrollView>
    </View>
  );
}

var s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  gr: { fontSize: 16, color: Colors.ink, fontWeight: "600" },
  cn: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  lo: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  lt: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  sec: { fontSize: 15, color: Colors.ink, fontWeight: "600", marginBottom: 14 },
  sh: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  actsScroll: { flexGrow: 0, marginBottom: 28 },
  acts: { flexDirection: "row", gap: 16, paddingVertical: 4, paddingRight: 20 },
  sa: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  db2: { backgroundColor: Colors.amberD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dt2: { fontSize: 9, color: Colors.amber, fontWeight: "600", letterSpacing: 0.3 },
  lc: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
  lf: { paddingTop: 10, alignItems: "center" },
  lft: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  dm: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  dmt: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
