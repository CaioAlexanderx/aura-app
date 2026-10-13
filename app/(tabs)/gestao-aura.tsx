import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { PageHeader } from "@/components/PageHeader";
import { IS_WIDE } from "@/constants/helpers";
import {
  FERRAMENTAS, ferramentaRoute, loadFerramentasAberto, saveFerramentasAberto,
} from "@/components/admin/ferramentas";

var isWeb = Platform.OS === "web";

type Overview = {
  clients: { total: number; paying: number; trial: number; overdue: number; new_this_month: number };
  mrr: { total: number; growth_pct: number };
  churn: { rate_pct: number };
  margin: { pct: number };
};

type LeadStats = {
  total: number; contacted_total: number; converted_total: number;
  overdue: number; with_phone: number;
};

function fmtK(n: number) {
  if (n >= 1000) return "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k";
  return "R$ " + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ── Secoes do hub ─────────────────────────────────────────────

type Section = {
  key: string;
  icon: string;
  title: string;
  description: string;
  route: string;
  color: string;
  badge?: string;
  highlight?: boolean;
};

var SECTIONS: Section[] = [
  {
    key: "hoje",
    icon: "activity",
    title: "Hoje",
    description: "Blocos que se calculam sozinhos — trials, receita, acesso, uso e alertas com o nome de cada loja.",
    route: "/gestao-aura-hoje",
    color: Colors.violet,
    highlight: true,
  },
  {
    key: "prospeccao",
    icon: "target",
    title: "Prospecção",
    description: "CRM comercial — leads, pipeline, follow-ups e template de abordagem.",
    route: "/gestao-aura-crm",
    color: Colors.violet,
    highlight: true,
  },
  {
    key: "clientes",
    icon: "users",
    title: "Clientes ativos",
    description: "Health score, planos, módulos, notas internas e gestão de trial.",
    route: "/gestao-aura-clientes",
    color: "#06b6d4",
  },
  {
    key: "painel",
    icon: "dashboard",
    title: "Painel",
    description: "MRR, churn, ARPU, margem bruta e alertas operacionais.",
    route: "/gestao-aura-painel",
    color: Colors.green,
  },
  {
    key: "receita",
    icon: "trending_up",
    title: "Receita",
    description: "Waterfall de MRR, unit economics, custos e projeções.",
    route: "/gestao-aura-receita",
    color: Colors.amber,
  },
  {
    key: "operacoes",
    icon: "settings",
    title: "Operações",
    description: "Equipe Aura — quem tem acesso à gestão e com qual papel.",
    route: "/gestao-aura-operacoes",
    color: "#f472b6",
  },
  {
    key: "crescimento",
    icon: "bar_chart",
    title: "Crescimento",
    description: "Funil de aquisição, adoção de features e distribuição geográfica.",
    route: "/gestao-aura-crescimento",
    color: "#10b981",
  },
  {
    key: "endomarketing",
    icon: "sparkles",
    title: "Endomarketing",
    description: "Banners de notificação no app — publicar, segmentar por plano e acompanhar leitura.",
    route: "/gestao-aura-endomarketing",
    color: "#8b5cf6",
  },
  {
    key: "aura_notas",
    icon: "file_text",
    title: "Aura Notas",
    description: "Gestão fiscal das empresas — engine própria, CSC, certificado A1 e status SEFAZ.",
    route: "/gestao-aura-notas",
    color: Colors.violet,
  },
];

// ── Componente ────────────────────────────────────────────────

export default function GestaoAuraScreen() {
  var router = useRouter();
  var { isStaff, isDemo } = useAuthStore();

  var { data: overview } = useQuery<Overview>({
    queryKey: ["admin-overview"],
    queryFn: function() { return request("/admin/metrics/overview"); },
    enabled: !!isStaff,
    staleTime: 120_000,
  });

  var { data: leadStats } = useQuery<LeadStats>({
    queryKey: ["admin-leads-stats"],
    queryFn: function() { return request("/admin/leads/stats"); },
    enabled: !!isStaff,
    staleTime: 60_000,
  });

  // Ferramentas: grupo recolhido por padrão; o estado fica no dispositivo.
  var [ferramentasAberto, setFerramentasAberto] = useState<boolean>(function() { return loadFerramentasAberto(); });
  function toggleFerramentas() {
    var next = !ferramentasAberto;
    setFerramentasAberto(next);
    saveFerramentasAberto(next);
  }

  if (!isStaff && !isDemo) {
    return (
      <View style={s.guard}>
        <Icon name="alert" size={32} color={Colors.red} />
        <Text style={s.guardTitle}>Acesso restrito</Text>
        <Text style={s.guardDesc}>Esta area e exclusiva para a equipe Aura.</Text>
        <Pressable onPress={function() { router.replace("/"); }} style={s.guardBtn}>
          <Text style={s.guardBtnText}>Voltar ao painel</Text>
        </Pressable>
      </View>
    );
  }

  // Stats rapidas para os cards
  function statFor(key: string): { label: string; value: string; color?: string } | null {
    if (!overview && !leadStats) return null;
    switch (key) {
      case "prospeccao":
        if (!leadStats) return null;
        return {
          label: "leads ativos",
          value: String(leadStats.total),
          color: leadStats.overdue > 0 ? Colors.red : Colors.violet3,
        };
      case "clientes":
        if (!overview) return null;
        return {
          label: "clientes pagantes",
          value: String(overview.clients.paying),
          color: Colors.green,
        };
      case "painel":
        if (!overview) return null;
        return {
          label: "MRR",
          value: fmtK(overview.mrr.total),
          color: overview.mrr.growth_pct > 0 ? Colors.green : Colors.amber,
        };
      case "receita":
        if (!overview) return null;
        return {
          label: "margem bruta",
          value: overview.margin.pct + "%",
          color: overview.margin.pct >= 60 ? Colors.green : Colors.amber,
        };
      default:
        return null;
    }
  }

  // Alertas rapidos acima dos cards
  var followupOverdue = leadStats?.overdue || 0;
  var trialsExpiring = overview?.clients.trial || 0;
  var hasAlerts = followupOverdue > 0 || trialsExpiring > 0;

  return (
    <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
      <PageHeader title="Central de Comando" />

      <View style={s.adminBadge}>
        <Icon name="star" size={12} color={Colors.amber} />
        <Text style={s.adminBadgeText}>Gestão interna — equipe Aura</Text>
      </View>

      {/* Alertas de acao imediata */}
      {hasAlerts && (
        <View style={s.alertsRow}>
          {followupOverdue > 0 && (
            <Pressable onPress={function() { router.push("/gestao-aura-crm" as any); }} style={s.alertCard}>
              <Icon name="clock" size={14} color={Colors.red} />
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>{followupOverdue} follow-up{followupOverdue > 1 ? "s" : ""} vencido{followupOverdue > 1 ? "s" : ""}</Text>
                <Text style={s.alertSub}>Toque para abrir o CRM</Text>
              </View>
              <Icon name="chevron_right" size={12} color={Colors.red} />
            </Pressable>
          )}
          {trialsExpiring > 0 && (
            <Pressable onPress={function() { router.push("/gestao-aura-clientes" as any); }} style={[s.alertCard, { borderColor: Colors.amber + "44" }]}>
              <Icon name="clock" size={14} color={Colors.amber} />
              <View style={{ flex: 1 }}>
                <Text style={[s.alertTitle, { color: Colors.amber }]}>{trialsExpiring} em trial</Text>
                <Text style={s.alertSub}>Ver clientes em trial</Text>
              </View>
              <Icon name="chevron_right" size={12} color={Colors.amber} />
            </Pressable>
          )}
        </View>
      )}

      {/* Grid de secoes */}
      <View style={s.grid}>
        {SECTIONS.map(function(sec) {
          var stat = statFor(sec.key);
          return (
            <Pressable
              key={sec.key}
              onPress={function() { router.push(sec.route as any); }}
              style={[
                s.card,
                sec.highlight && s.cardHighlight,
                isWeb && { cursor: "pointer" } as any,
              ]}
            >
              {/* Accent line no topo */}
              <View style={[s.cardAccent, { backgroundColor: sec.color }]} />

              <View style={s.cardTop}>
                <View style={[s.cardIcon, { backgroundColor: sec.color + "18", borderColor: sec.color + "33" }]}>
                  <Icon name={sec.icon as any} size={20} color={sec.color} />
                </View>
                {stat && (
                  <View style={s.cardStat}>
                    <Text style={[s.cardStatVal, { color: stat.color || Colors.ink }]}>{stat.value}</Text>
                    <Text style={s.cardStatLabel}>{stat.label}</Text>
                  </View>
                )}
              </View>

              <Text style={[s.cardTitle, sec.highlight && { color: Colors.violet3 }]}>{sec.title}</Text>
              <Text style={s.cardDesc}>{sec.description}</Text>

              <View style={s.cardFooter}>
                <Text style={[s.cardLink, { color: sec.color }]}>Abrir</Text>
                <Icon name="chevron_right" size={12} color={sec.color} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Ferramentas: telas que existem mas o processo ainda não alimenta */}
      <View style={s.tools} testID="ferramentas">
        <Pressable
          testID="ferramentas-toggle"
          onPress={toggleFerramentas}
          accessibilityRole="button"
          accessibilityState={{ expanded: ferramentasAberto }}
          style={[s.toolsHead, isWeb && { cursor: "pointer" } as any]}
        >
          <Icon name="tool" size={16} color={Colors.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={s.toolsTitle}>Ferramentas</Text>
            <Text style={s.toolsSub}>
              {FERRAMENTAS.length + " telas escondidas porque o processo por trás delas ainda não roda. Nada foi apagado."}
            </Text>
          </View>
          <Icon name={ferramentasAberto ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
        </Pressable>

        {ferramentasAberto && (
          <View style={s.grid} testID="ferramentas-lista">
            {FERRAMENTAS.map(function(f) {
              return (
                <Pressable
                  key={f.key}
                  testID={"ferramenta-card-" + f.key}
                  onPress={function() { router.push(ferramentaRoute(f.key) as any); }}
                  style={[s.card, isWeb && { cursor: "pointer" } as any]}
                >
                  <View style={[s.cardAccent, { backgroundColor: f.color }]} />
                  <View style={s.cardTop}>
                    <View style={[s.cardIcon, { backgroundColor: f.color + "18", borderColor: f.color + "33" }]}>
                      <Icon name={f.icon as any} size={20} color={f.color} />
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{f.title}</Text>
                  <Text style={s.cardDesc}>{f.description}</Text>
                  <View style={s.toolWhy}>
                    <Text style={s.toolWhyText}>{f.why}</Text>
                  </View>
                  <View style={s.cardFooter}>
                    <Text style={[s.cardLink, { color: f.color }]}>Abrir</Text>
                    <Icon name="chevron_right" size={12} color={f.color} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

var s = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.amberD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.amber + "33", alignSelf: "flex-start" },
  adminBadgeText: { fontSize: 12, color: Colors.amber, fontWeight: "600" },
  // Alertas
  alertsRow: { gap: 8, marginBottom: 20 },
  alertCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.redD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.red + "33" },
  alertTitle: { fontSize: 13, fontWeight: "700", color: Colors.red },
  alertSub: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: IS_WIDE ? "calc(33.33% - 8px)" as any : "100%",
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    position: "relative",
  },
  cardHighlight: {
    borderColor: Colors.violet + "44",
    backgroundColor: Colors.violetD,
  },
  cardAccent: { height: 3, width: "100%" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, paddingBottom: 10 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardStat: { alignItems: "flex-end" },
  cardStatVal: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  cardStatLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, paddingHorizontal: 16, marginBottom: 6 },
  cardDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, paddingHorizontal: 16, marginBottom: 14 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingBottom: 16 },
  cardLink: { fontSize: 12, fontWeight: "700" },
  // Ferramentas
  tools: { marginTop: 28, gap: 12 },
  toolsHead: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, paddingHorizontal: 14 },
  toolsTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  toolsSub: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  toolWhy: { marginHorizontal: 16, marginBottom: 14, backgroundColor: Colors.amberD, borderRadius: 8, borderWidth: 1, borderColor: Colors.amber + "33", paddingVertical: 8, paddingHorizontal: 10 },
  toolWhyText: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  // Guard
  guard: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  guardTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginTop: 16, textAlign: "center" },
  guardDesc: { fontSize: 13, color: Colors.ink3, marginTop: 8, textAlign: "center", lineHeight: 20 },
  guardBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 },
  guardBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
