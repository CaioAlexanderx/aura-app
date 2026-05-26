// ============================================================
// AURA STUDIO · Home (Fase 0) — overhaul 25/05
//
// Estrutura:
//   1. Greeting personalizado
//   2. KPIs em cards orgânicos — vindos de /studio/metrics (Nivel 1 C2)
//   3. Checklist colapsável (#4) — fecha sozinho quando 100%
//      Vira card celebratório (#3) com CTA "Cadastrar produto" + dica
//   4. Hint Fase 4
// ============================================================
import { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { useAuthStore } from "@/stores/auth";
import { studioApi, type StudioMetrics } from "@/services/studioApi";

type ChecklistItem = {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  sub: string;
  href: string;
};

const CHECKLIST: ChecklistItem[] = [
  {
    id: "product",
    icon: "shopping-bag",
    iconBg: StudioColors.primary,
    title: "Cadastre seu primeiro produto personalizável",
    sub: "Defina área de impressão, texto/upload e cores que o cliente pode escolher",
    href: "/studio/produtos",
  },
  {
    id: "gallery",
    icon: "image",
    iconBg: StudioColors.accent,
    title: "Suba 3 templates pra galeria",
    sub: "Artes prontas (Dia das Mães, Pais, Profissões) facilitam pro cliente comprar sem mandar arte",
    href: "/studio/galeria",
  },
  {
    id: "sla",
    icon: "clock",
    iconBg: StudioColors.warning,
    title: "Configure prazos de produção",
    sub: "Quantos dias úteis cada produto leva pra ficar pronto",
    href: "/studio/configuracoes",
  },
  {
    id: "test-sale",
    icon: "credit-card",
    iconBg: StudioColors.accent,
    title: "Faça uma venda teste",
    sub: "Lance uma venda manual de R$1 pra simular o fluxo completo",
    href: "/studio/vendas/caixa",
  },
  {
    id: "wa",
    icon: "message-circle",
    iconBg: StudioColors.success,
    title: "Vincule WhatsApp pra aprovação de arte",
    sub: "Cliente recebe o mockup no zap e aprova antes da produção começar",
    href: "/studio/configuracoes",
  },
];

function formatBRL(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } catch {
    return "R$ " + Math.round(v);
  }
}

export default function StudioHome() {
  const router = useRouter();
  const { company, user } = useAuthStore();
  const [healthLoading, setHealthLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [metrics, setMetrics] = useState<StudioMetrics | null>(null);

  const [expanded, setExpanded] = useState(true);

  // 1. Health (checklist + onboarding)
  useEffect(() => {
    if (!company?.id) return;
    studioApi.health(company.id)
      .then((h) => {
        const onboard = (h.settings || {}).onboarding || {};
        setCompleted(onboard);
      })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, [company?.id]);

  // 2. Metrics (KPIs reais — Nivel 1 C2)
  useEffect(() => {
    if (!company?.id) return;
    studioApi.getMetrics(company.id, 7)
      .then((m) => setMetrics(m))
      .catch(() => setMetrics(null))
      .finally(() => setMetricsLoading(false));
  }, [company?.id]);

  const firstName = (user as any)?.name?.split(" ")[0] || "lojista";
  const totalDone = CHECKLIST.filter((i) => completed[i.id]).length;
  const pct = Math.round((totalDone / CHECKLIST.length) * 100);
  const allDone = pct === 100;

  useEffect(() => { if (allDone) setExpanded(false); }, [allDone]);

  const remainingTitle = useMemo(() => {
    if (allDone) return "Tudo pronto pra vender";
    if (totalDone === 0) return "Vamos deixar tudo pronto";
    return `Faltam ${CHECKLIST.length - totalDone} ${CHECKLIST.length - totalDone === 1 ? "passo" : "passos"}`;
  }, [allDone, totalDone]);

  // KPIs dinâmicos
  const kpis = useMemo(() => [
    {
      label: "Em produção",
      value: metrics ? String(metrics.em_producao) : "—",
      icon: "clock",
      color: StudioColors.warning,
    },
    {
      label: "Aguardando arte",
      value: metrics ? String(metrics.aguardando_arte) : "—",
      icon: "alert-circle",
      color: StudioColors.accent,
    },
    {
      label: "Prontos hoje",
      value: metrics ? String(metrics.prontos_hoje) : "—",
      icon: "check",
      color: StudioColors.success,
    },
    {
      label: "Vendas 7d",
      value: metrics ? formatBRL(metrics.revenue_7d) : "—",
      icon: "trending-up",
      color: StudioColors.primary,
    },
  ], [metrics]);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* ───── Greeting ───── */}
      <View style={s.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>
            Bom dia, <Text style={s.h1Accent}>{firstName}!</Text> ✨
          </Text>
          <Text style={s.h1Sub}>
            {allDone
              ? "Loja redonda. Hora de mostrar produto pro mundo."
              : "Bora deixar a loja redonda pros próximos pedidos"}
          </Text>
        </View>
        <View style={s.liveBadge}>
          <View style={s.livePulse} />
          <Text style={s.liveTxt}>Studio aberto</Text>
        </View>
      </View>

      {/* ───── KPIs ───── */}
      <View style={s.kpisRow}>
        {kpis.map((k) => (
          <View key={k.label} style={s.kpiCard}>
            <View style={[s.kpiBubble, { backgroundColor: k.color }]}>
              <Icon name={k.icon as any} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              {metricsLoading ? (
                <ActivityIndicator size="small" color={StudioColors.ink4} style={{ alignSelf: "flex-start", marginTop: 4 }} />
              ) : (
                <Text style={s.kpiValue}>{k.value}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* ───── Checklist colapsável ───── */}
      <View style={s.checklistCard}>
        <Pressable onPress={() => setExpanded((v) => !v)} style={s.checklistHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.checklistEyebrow}>
              {allDone ? "PRONTO" : "PRÓXIMOS PASSOS"}
            </Text>
            <Text style={s.checklistTitle}>{remainingTitle}</Text>
          </View>
          <View style={s.progressPill}>
            <Text style={s.progressPillTxt}>{totalDone}/{CHECKLIST.length}</Text>
          </View>
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={StudioColors.ink3} />
        </Pressable>

        {healthLoading && (
          <View style={{ paddingVertical: 14 }}>
            <ActivityIndicator size="small" color={StudioColors.primary} />
          </View>
        )}

        {!healthLoading && expanded && CHECKLIST.map((item) => {
          const done = !!completed[item.id];
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.href as any)}
              style={[s.checkRow, done && s.checkRowDone]}
            >
              <View style={[
                s.checkBox,
                done && { backgroundColor: StudioColors.mint, borderColor: StudioColors.mint },
              ]}>
                {done && <Icon name="check" size={12} color="#fff" />}
              </View>
              <View style={[s.checkIcon, { backgroundColor: item.iconBg }]}>
                <Icon name={item.icon as any} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.checkTitle, done && s.checkTitleDone]}>{item.title}</Text>
                <Text style={s.checkSub} numberOfLines={2}>{item.sub}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={StudioColors.ink4} />
            </Pressable>
          );
        })}

        {/* Progresso linear */}
        {!allDone && (
          <>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.progressSub}>{pct}% concluído — falta pouco</Text>
          </>
        )}

        {/* Empty state celebratório quando 100% concluído */}
        {allDone && !expanded && (
          <View style={s.celebrate}>
            <View style={s.celebrateEmoji}>
              <Text style={{ fontSize: 30 }}>🎉</Text>
            </View>
            <Text style={s.celebrateTitle}>Setup completo!</Text>
            <Text style={s.celebrateBody}>
              Configurações prontas, agora é cadastrar produto e divulgar. Quando o
              primeiro pedido cair, o KDS começa a se preencher automaticamente.
            </Text>
            <View style={s.celebrateRow}>
              <Pressable
                onPress={() => router.push("/studio/produtos" as any)}
                style={[s.celebrateBtn, { backgroundColor: StudioColors.primary }]}
              >
                <Icon name="shopping-bag" size={16} color="#fff" />
                <Text style={s.celebrateBtnTxt}>Cadastrar produto</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/studio/galeria" as any)}
                style={[s.celebrateBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: StudioColors.ink4 }]}
              >
                <Icon name="image" size={16} color={StudioColors.ink2} />
                <Text style={[s.celebrateBtnTxt, { color: StudioColors.ink2 }]}>Ver galeria</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ───── Hint Fase 4 ───── */}
      {!allDone && (
        <View style={s.hintCard}>
          <Icon name="info" size={16} color={StudioColors.primary} />
          <Text style={s.hintTxt}>
            <Text style={s.hintBold}>Dica:</Text> assim que cadastrar produto e
            subir templates, a aba Produção começa a popular o KDS automaticamente.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: StudioColors.bg },
  container: { padding: 28, paddingBottom: 60, maxWidth: 1100, alignSelf: "center", width: "100%" },

  // greeting
  greetingRow: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    marginBottom: 22, gap: 16, flexWrap: "wrap",
  },
  h1: { fontSize: 28, fontWeight: "800", color: StudioColors.ink, letterSpacing: -0.5 },
  h1Accent: { color: StudioColors.accent, fontWeight: "900" },
  h1Sub: { fontSize: 13.5, color: StudioColors.ink3, marginTop: 6 },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: StudioColors.mintSoft,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
  },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: StudioColors.mint },
  liveTxt: { fontSize: 12, fontWeight: "700", color: StudioColors.successInk },

  // KPIs
  kpisRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    marginBottom: 22,
  },
  kpiCard: {
    flex: 1, minWidth: 180,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: StudioColors.paperCard,
    borderRadius: 22, padding: 14,
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  kpiBubble: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  kpiLabel: { fontSize: 11.5, color: StudioColors.ink3, fontWeight: "600" },
  kpiValue: { fontSize: 18, fontWeight: "800", color: StudioColors.ink, marginTop: 1 },

  // Checklist
  checklistCard: {
    backgroundColor: StudioColors.paperCard,
    borderRadius: 24, padding: 22,
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  checklistHead: {
    flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10,
  },
  checklistEyebrow: {
    fontSize: 11, color: StudioColors.accent, fontWeight: "800",
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  checklistTitle: { fontSize: 18, fontWeight: "800", color: StudioColors.ink, marginTop: 3 },
  progressPill: {
    backgroundColor: StudioColors.primarySoft,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  progressPillTxt: { fontSize: 12, fontWeight: "800", color: StudioColors.primary },

  checkRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: StudioColors.ink5,
  },
  checkRowDone: { opacity: 0.55 },
  checkBox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: StudioColors.ink4,
    alignItems: "center", justifyContent: "center",
  },
  checkIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  checkTitle: { fontSize: 13.5, fontWeight: "700", color: StudioColors.ink },
  checkTitleDone: { textDecorationLine: "line-through", color: StudioColors.ink3 },
  checkSub: { fontSize: 12, color: StudioColors.ink3, marginTop: 2 },

  progressBar: {
    height: 6, backgroundColor: StudioColors.ink5,
    borderRadius: 3, overflow: "hidden", marginTop: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: StudioColors.mint,
    borderRadius: 3,
  },
  progressSub: {
    fontSize: 11.5, color: StudioColors.ink3, marginTop: 6,
    textAlign: "center", fontWeight: "600",
  },

  // Celebrate
  celebrate: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  celebrateEmoji: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: StudioColors.mintSoft,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  celebrateTitle: { fontSize: 18, fontWeight: "800", color: StudioColors.ink },
  celebrateBody: {
    fontSize: 13, color: StudioColors.ink3, textAlign: "center",
    maxWidth: 480, lineHeight: 19,
  },
  celebrateRow: {
    flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap",
    justifyContent: "center",
  },
  celebrateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12,
  },
  celebrateBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  hintCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: StudioColors.primarySoft,
  },
  hintTxt: { fontSize: 12.5, color: StudioColors.ink2, flex: 1, lineHeight: 18 },
  hintBold: { fontWeight: "700", color: StudioColors.primary },
});
