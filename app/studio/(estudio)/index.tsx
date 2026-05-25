// ============================================================
// AURA STUDIO · Home (Fase 0)
//
// Estrutura:
//   1. Greeting personalizado (Inter 900, gradient brand)
//   2. Quick stats — 5 KPIs em cards orgânicos com bolhas-ícone
//   3. Checklist "Próximos passos" — 5 itens guiados, sem wizard
//   4. Card de produção (preview do que vem na Fase 4)
//
// Mockup: Projects/Aura/mockup_studio_dashboard.html
// Diretriz: workflow só nas features novas; home permanece playful.
// ============================================================
import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { useAuthStore } from "@/stores/auth";
import { studioApi } from "@/services/studioApi";

type ChecklistItem = {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  sub: string;
  href: string;
  done?: boolean; // futuramente vem do backend (settings.studio_onboarding.*)
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
    iconBg: "#F59E0B",
    title: "Configure prazos de produção",
    sub: "Quantos dias úteis cada produto leva pra ficar pronto",
    href: "/studio/configuracoes",
  },
  {
    id: "test-sale",
    icon: "credit-card",
    iconBg: "#7C3AED",
    title: "Faça uma venda teste",
    sub: "Lance uma venda manual de R$1 pra simular o fluxo completo",
    href: "/studio/vendas/caixa",
  },
  {
    id: "wa",
    icon: "message-circle",
    iconBg: "#10B981",
    title: "Vincule WhatsApp pra aprovação de arte",
    sub: "Cliente recebe o mockup no zap e aprova antes da produção começar",
    href: "/studio/configuracoes",
  },
];

const KPIS = [
  { label: "Em produção",     value: "—", icon: "clock",         color: "#F59E0B" },
  { label: "Aguardando arte", value: "—", icon: "alert-circle",  color: StudioColors.accent },
  { label: "Prontos hoje",    value: "—", icon: "check",         color: "#10B981" },
  { label: "Vendas 7d",       value: "—", icon: "trending-up",   color: StudioColors.primary },
];

export default function StudioHome() {
  const router = useRouter();
  const { company, user } = useAuthStore();
  const [healthLoading, setHealthLoading] = useState(true);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  // Sentinel do vertical — confirma que o backend está pareado com o frontend
  useEffect(() => {
    if (!company?.id) return;
    studioApi.health(company.id)
      .then((h) => {
        // futuramente: h.settings.onboarding_done pode ditar quais checks já estão prontos
        const onboard = (h.settings || {}).onboarding || {};
        setCompleted(onboard);
      })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, [company?.id]);

  const firstName = (user as any)?.name?.split(" ")[0] || "lojista";
  const totalDone = CHECKLIST.filter((i) => completed[i.id]).length;
  const pct = Math.round((totalDone / CHECKLIST.length) * 100);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* ───── Greeting ───── */}
      <View style={s.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>
            Bom dia, <Text style={s.h1Accent}>{firstName}!</Text> ✨
          </Text>
          <Text style={s.h1Sub}>
            Bora deixar a loja redonda pros próximos pedidos
          </Text>
        </View>
        <View style={s.liveBadge}>
          <View style={s.livePulse} />
          <Text style={s.liveTxt}>Studio aberto</Text>
        </View>
      </View>

      {/* ───── KPIs ───── */}
      <View style={s.kpisRow}>
        {KPIS.map((k) => (
          <View key={k.label} style={s.kpiCard}>
            <View style={[s.kpiBubble, { backgroundColor: k.color }]}>
              <Icon name={k.icon as any} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={s.kpiValue}>{k.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ───── Checklist ───── */}
      <View style={s.checklistCard}>
        <View style={s.checklistHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.checklistEyebrow}>PRÓXIMOS PASSOS</Text>
            <Text style={s.checklistTitle}>Vamos deixar tudo pronto</Text>
          </View>
          <View style={s.progressPill}>
            <Text style={s.progressPillTxt}>{totalDone}/{CHECKLIST.length}</Text>
          </View>
        </View>

        {healthLoading && (
          <View style={{ paddingVertical: 14 }}>
            <ActivityIndicator size="small" color={StudioColors.primary} />
          </View>
        )}

        {!healthLoading && CHECKLIST.map((item) => {
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
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={s.progressSub}>
          {pct === 100
            ? "🎉 Tudo pronto! Bora vender."
            : `${pct}% concluído — falta pouco`}
        </Text>
      </View>

      {/* ───── Hint Fase 4 ───── */}
      <View style={s.hintCard}>
        <Icon name="info" size={16} color={StudioColors.primary} />
        <Text style={s.hintTxt}>
          <Text style={s.hintBold}>Linha de produção e KDS</Text> chegam na próxima atualização. Por enquanto acompanhe os pedidos em Estúdio › Produção.
        </Text>
      </View>
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
  liveTxt: { fontSize: 12, fontWeight: "700", color: "#065F46" },

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

  hintCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: StudioColors.primarySoft,
  },
  hintTxt: { fontSize: 12.5, color: StudioColors.ink2, flex: 1, lineHeight: 18 },
  hintBold: { fontWeight: "700", color: StudioColors.primary },
});
