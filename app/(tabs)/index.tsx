import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, RefreshControl } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { dashboardApi } from "@/services/api";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TrialBanner } from "@/components/TrialBanner";
import { SkeletonDashboard, SkeletonStyle } from "@/components/Skeleton";
import { toast } from "@/components/Toast";
import { ProfileBanner } from "@/components/ProfileBanner";
import { BrandBanner } from "@/components/BrandBanner";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useVisibleModules } from "@/hooks/useVisibleModules";

import { IS_WIDE, IS_WEB, MOCK_DASHBOARD, EMPTY_DATA, greeting, currentMonth, webOnly, fmt } from "@/components/screens/dashboard/types";
import { Avatar } from "@/components/screens/dashboard/Avatar";
import { PlanBadge } from "@/components/screens/dashboard/PlanBadge";
import { HeroCard } from "@/components/screens/dashboard/HeroCard";
import { KPIGrid } from "@/components/screens/dashboard/KPIGrid";
import { QuickAction } from "@/components/screens/dashboard/QuickAction";
import { SaleRow } from "@/components/screens/dashboard/SaleRow";
import { ObligationRow } from "@/components/screens/dashboard/ObligationRow";
import { SalesAnalyticsCard } from "@/components/screens/dashboard/SalesAnalyticsCard";
import { TopSellersCard } from "@/components/screens/dashboard/TopSellersCard";
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

// Injects the Claude Design keyframes (spin, drawLine, pulse, heroShift, orbFloat, fadeUp)
// and custom scrollbar styling into the web document. No-op on native.
function AuraDesignStyle() {
  if (!IS_WEB) return null;
  const css = `
    @keyframes auraSpin { to { transform: rotate(360deg); } }
    @keyframes auraDrawLine { from { stroke-dashoffset: 1200; } to { stroke-dashoffset: 0; } }
    @keyframes auraPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
    @keyframes auraHeroShift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-80px, 40px); } }
    @keyframes auraOrbFloat {
      0%,100% { transform: translate(0,0) scale(1); }
      33%      { transform: translate(60px,-40px) scale(1.10); }
      66%      { transform: translate(-40px,60px) scale(0.95); }
    }
    @keyframes auraFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes auraRingExpand { 0% { r: 6; opacity: 0.8; } 100% { r: 18; opacity: 0; } }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// Claude Design floating orbs backdrop (web only). Positioned behind the
// scroll area via position:fixed on the dashboard root.
function AuraBackdrop() {
  if (!IS_WEB) return null;
  const style = {
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
  } as any;
  const orb = {
    position: "absolute", borderRadius: "50%", filter: "blur(80px)",
    opacity: 0.40, animation: "auraOrbFloat 18s ease-in-out infinite",
  } as any;
  const grid = {
    position: "absolute", inset: 0,
    backgroundImage:
      "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)",
    backgroundSize: "56px 56px",
    maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 75%)",
    WebkitMaskImage: "radial-gradient(ellipse at center, #000 0%, transparent 75%)",
  } as any;
  return (
    <div style={style}>
      <div style={grid} />
      <div style={{ ...orb, width: 520, height: 520, top: -120, left: -80, background: "radial-gradient(circle, #6d28d9, transparent 70%)" }} />
      <div style={{ ...orb, width: 460, height: 460, bottom: -80, right: -60, background: "radial-gradient(circle, #4f5bd5, transparent 70%)", animationDelay: "-6s", animationDuration: "22s" }} />
      <div style={{ ...orb, width: 380, height: 380, top: "40%", left: "50%", background: "radial-gradient(circle, #8b5cf6, transparent 70%)", opacity: 0.28, animationDelay: "-12s", animationDuration: "26s" }} />
    </div>
  );
}

export default function DashboardScreen() {
  var { user, company, token, isDemo, logout } = useAuthStore();
  var router = useRouter();
  var queryClient = useQueryClient();
  var [emailVerified, setEmailVerified] = useState((user as any)?.email_verified ?? false);
  var visibleMods = useVisibleModules();
  var { tradeName } = useCompanyProfile();
  var [redirecting, setRedirecting] = useState(false);
  var [refreshing, setRefreshing] = useState(false);

  var { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["dashboard", company?.id],
    queryFn: function() { return dashboardApi.aggregate(company!.id); },
    enabled: !!company?.id && !!token && !isDemo && !redirecting,
    retry: 1, staleTime: 60000,
  });

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

  function onRefresh() {
    setRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ["dashboard", company?.id] });
    queryClient.invalidateQueries({ queryKey: ["sales-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["products-ranking"] });
    queryClient.invalidateQueries({ queryKey: ["employees-ranking"] });
    setTimeout(function() { setRefreshing(false); }, 600);
  }

  if (redirecting || (visibleMods.size > 0 && !visibleMods.has("painel"))) {
    return <View style={{ flex: 1, backgroundColor: "transparent" }} />;
  }

  var d = isDemo ? MOCK_DASHBOARD : (data || EMPTY_DATA);
  var isEmpty = !isDemo && !isLoading && !isError && d.revenue === 0 && d.expenses === 0 && d.salesToday === 0;
  var go = function(p: string) { router.push(p as any); };

  // Projection fim-do-mes — simple extrapolation when backend didn't provide it:
  // (revenue - expenses) scaled to monthly cadence based on day-of-month.
  var projection = (d as any).projection;
  if (!projection && d.revenue) {
    var today = new Date();
    var dom = today.getDate();
    var daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    projection = Math.round(d.net * (daysInMonth / Math.max(dom, 1)));
  }

  var firstName = user?.name?.split(" ")[0] ?? "usuario";
  var companyLabel = tradeName || company?.name || "---";

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <AuraDesignStyle />
      <AuraBackdrop />
      <TrialBanner />
      <SkeletonStyle />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (isFetching && !isLoading)}
            onRefresh={onRefresh}
            tintColor={Colors.violet3}
            colors={[Colors.violet3]}
          />
        }
      >

        {/* ---- HEADER ---- */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1, minWidth: 0 }}>
            <Avatar name={user?.name ?? "A"} size={IS_WIDE ? 48 : 42} />
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <View style={s.liveDot} />
                <Text style={s.gh}>{greeting()}, {firstName}</Text>
              </View>
              <Text style={s.cn} numberOfLines={1}>{companyLabel}  -  ao vivo</Text>
            </View>
          </View>
          <BrandBanner mode="header" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <PlanBadge plan={company?.plan ?? "essencial"} />
            <TouchableOpacity onPress={logout} style={s.lo}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="logout" size={14} color={Colors.ink3} />
                <Text style={s.lt}>Sair</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <ProfileBanner />
        {!isDemo && <VerifyEmailBanner emailVerified={emailVerified} onVerified={function() { setEmailVerified(true); }} />}

        {isLoading && !isDemo && <SkeletonDashboard />}
        {isEmpty && <EmptyDashboard name={firstName} onPress={go} />}

        {!isLoading && !isEmpty && (
          <>
            <HeroCard
              net={d.net}
              sparkNet={d.sparkNet}
              revenue={d.revenue}
              expenses={d.expenses}
              projection={projection}
              netDelta={d.netDelta}
            />

            {/* ---- VISAO GERAL (KPI grid) ---- */}
            <View style={s.secTitleRow}>
              <View style={s.secBar} />
              <Text style={s.secTitle}>Visao geral</Text>
              <View style={s.secCount}><Text style={s.secCountText}>{currentMonth().slice(0, 3).toLowerCase()} {String(new Date().getFullYear()).slice(-2)}</Text></View>
            </View>
            <KPIGrid d={d} onNavigate={go} />

            {/* ---- VENDAS (wired analytics card) ---- */}
            {!isDemo && <SalesAnalyticsCard onPress={function() { go("/financeiro"); }} />}
            {!isDemo && <TopSellersCard onSeeAll={function() { go("/folha"); }} />}

            {/* ---- QUICK ACTIONS ---- */}
            <View style={s.secTitleRow}>
              <View style={s.secBar} />
              <Text style={s.secTitle}>Acesso rapido</Text>
            </View>
            <ScrollView
              horizontal={!IS_WIDE}
              showsHorizontalScrollIndicator={false}
              style={IS_WIDE ? s.qaScrollWide : s.qaScroll}
              contentContainerStyle={IS_WIDE ? s.qaGridWide : s.qaGrid}
            >
              <QuickAction ic="cart" iconColor={Colors.green} label="Caixa" onPress={function() { go("/pdv"); }} />
              <QuickAction ic="wallet" iconColor={Colors.violet3} label="Financeiro" onPress={function() { go("/financeiro"); }} />
              <QuickAction ic="package" iconColor={Colors.amber} label="Estoque" onPress={function() { go("/estoque"); }} />
              <QuickAction ic="file_text" iconColor={Colors.red} label="NF-e" onPress={function() { go("/nfe"); }} />
              <QuickAction ic="calculator" iconColor={"#8b5cf6"} label="Contabil" onPress={function() { go("/contabilidade"); }} />
              <QuickAction ic="users" iconColor={Colors.violet3} label="Clientes" onPress={function() { go("/clientes"); }} />
            </ScrollView>

            {/* ---- OBRIGACOES ---- */}
            {d.obligations && d.obligations.length > 0 && (
              <>
                <View style={s.secTitleRow}>
                  <View style={s.secBar} />
                  <Text style={s.secTitle}>Obrigacoes contabeis</Text>
                  <View style={[s.secCount, { backgroundColor: "rgba(251,191,36,0.14)", borderColor: "rgba(251,191,36,0.28)", borderWidth: 1 }]}>
                    <Text style={[s.secCountText, { color: Colors.amber, fontWeight: "700" }]}>{d.obligations.length} aberta{d.obligations.length > 1 ? "s" : ""}</Text>
                  </View>
                </View>
                <View style={s.panel}>
                  {d.obligations.map(function(o: any) {
                    return <ObligationRow key={o.id} name={o.name} due={o.due} amount={o.amount} status={o.status} category={o.category} />;
                  })}
                  <View style={s.panelFoot}><Text style={s.panelFootText}>Apoio contabil informativo  -  estimativa</Text></View>
                </View>
              </>
            )}

            {/* ---- ULTIMAS TRANSACOES ---- */}
            {d.recentSales && d.recentSales.length > 0 && (
              <>
                <View style={s.secTitleRow}>
                  <View style={s.secBar} />
                  <Text style={s.secTitle}>Ultimas transacoes</Text>
                  <TouchableOpacity onPress={function() { go("/financeiro"); }} style={{ marginLeft: "auto" }}>
                    <Text style={s.secCta}>Ver todas  -  </Text>
                  </TouchableOpacity>
                </View>
                <View style={s.panel}>
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
  scroll: { flex: 1, position: "relative", zIndex: 1 },
  content: {
    padding: IS_WIDE ? 32 : 20,
    paddingBottom: 64,
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 24, flexWrap: "wrap", gap: 12,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green,
    shadowColor: Colors.green, shadowOpacity: 1 as any, shadowRadius: 6,
    ...(Platform.OS === "web" ? (webOnly({ animation: "auraPulse 1.8s ease-in-out infinite" }) as any) : null),
  },
  gh: { fontSize: 20, color: Colors.ink, fontWeight: "600", letterSpacing: -0.3 },
  cn: { fontSize: 11, color: Colors.ink3, fontWeight: "500", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  lo: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    backgroundColor: Glass.lineWhisper,
  },
  lt: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },

  secTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 14 },
  secBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: Colors.violet },
  secTitle: { fontSize: 17, color: Colors.ink, fontWeight: "600", letterSpacing: -0.2 },
  secCount: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    backgroundColor: Glass.lineFaint,
  },
  secCountText: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.5, fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined) },
  secCta: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  qaScroll: { flexGrow: 0, marginBottom: 28 },
  qaGrid: { flexDirection: "row", gap: 10, paddingVertical: 4, paddingRight: 20 },
  qaScrollWide: { marginBottom: 28 },
  qaGridWide: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  panel: {
    backgroundColor: Colors.bg3, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    marginBottom: 24,
    ...(Platform.OS === "web" ? (webOnly({ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: Glass.card }) as any) : null),
  },
  panelFoot: { paddingTop: 12, alignItems: "center" },
  panelFootText: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.3 },

  dm: {
    alignSelf: "center",
    backgroundColor: "rgba(124,58,237,0.14)",
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8,
    marginTop: 12, borderWidth: 1, borderColor: "rgba(124,58,237,0.28)",
  },
  dmt: { fontSize: 11, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
});
