import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";

const TABS = ["Contábil", "Financeiro", "Estoque", "CRM", "Marketing"];

type Insight = { id: string; icon: string; title: string; desc: string; action: string; priority: "high" | "medium" | "low" };

const INSIGHTS: Record<string, Insight[]> = {
  "Contábil": [
    { id: "c1", icon: "alert", title: "DAS vence em 14 dias", desc: "O DAS-MEI de abril vence em 20/04. Valor estimado: R$ 76,90. Gere o QR Code Pix para pagar sem atraso.", action: "Ver obrigação", priority: "high" },
    { id: "c2", icon: "trending_up", title: "Faturamento próximo do limite MEI", desc: "Você está em 68% do limite anual de R$ 81.000. No ritmo atual, pode ultrapassar em setembro.", action: "Ver projeção", priority: "medium" },
    { id: "c3", icon: "check", title: "FGTS em dia", desc: "Todas as guias de FGTS estão pagas e em dia. Próximo vencimento: 07/04.", action: "Ver calendário", priority: "low" },
  ],
  "Financeiro": [
    { id: "f1", icon: "wallet", title: "Fluxo de caixa positivo", desc: "Seu caixa está saudável com margem de 46,6% este mês. Receitas superam despesas em R$ 8.580.", action: "Ver resumo", priority: "low" },
    { id: "f2", icon: "alert", title: "2 cobranças em atraso", desc: "Clientes João Santos (R$ 1.240) e Carlos Lima (R$ 430) estão com pagamento atrasado.", action: "Enviar cobrança", priority: "high" },
    { id: "f3", icon: "trending_up", title: "Oportunidade: renegociar fornecedor", desc: "Seus gastos com Distribuidora ABC aumentaram 12% nos últimos 3 meses. Considere renegociar.", action: "Ver detalhes", priority: "medium" },
  ],
  "Estoque": [
    { id: "e1", icon: "package", title: "3 produtos com estoque baixo", desc: "Pomada modeladora (2 un.), Shampoo premium (5 un.) e Kit barba (1 un.) estão abaixo do mínimo.", action: "Ver estoque", priority: "high" },
    { id: "e2", icon: "trending_up", title: "Produto mais vendido: Corte masculino", desc: "47 vendas este mês. Considere criar um combo com barba para aumentar o ticket médio.", action: "Criar combo", priority: "medium" },
    { id: "e3", icon: "star", title: "Curva ABC atualizada", desc: "80% da receita vem de 3 produtos. Foque o marketing nesses itens para maximizar retorno.", action: "Ver curva ABC", priority: "low" },
  ],
  "CRM": [
    { id: "r1", icon: "users", title: "12 clientes novos este mês", desc: "Crescimento de 15% em relação ao mês anterior. Taxa de retenção: 73%.", action: "Ver clientes", priority: "low" },
    { id: "r2", icon: "star", title: "5 aniversários esta semana", desc: "Maria Silva (02/04), Pedro Costa (03/04), Ana Oliveira (05/04) e mais 2. Envie uma mensagem!", action: "Enviar parabéns", priority: "medium" },
    { id: "r3", icon: "alert", title: "8 clientes inativos há 30+ dias", desc: "Esses clientes não voltaram no último mês. Uma campanha de reativação pode recuperá-los.", action: "Ver inativos", priority: "high" },
  ],
  "Marketing": [
    { id: "m1", icon: "bar_chart", title: "Seu site teve 234 visitas", desc: "Conversão de 7,7%. Os 3 produtos mais vistos são: Corte masculino, Combo corte+barba, Shampoo.", action: "Ver analytics", priority: "low" },
    { id: "m2", icon: "star", title: "Sugestão: post para Instagram", desc: "Que tal postar uma foto do combo corte+barba? É seu produto com maior taxa de conversão.", action: "Gerar post", priority: "medium" },
    { id: "m3", icon: "trending_up", title: "Horário ideal para postar", desc: "Seus clientes acessam mais entre 18h-20h. Programe posts para esse horário.", action: "Ver horários", priority: "low" },
  ],
};

function InsightCard({ insight }: { insight: Insight }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const pc = insight.priority === "high" ? Colors.red : insight.priority === "medium" ? Colors.amber : Colors.green;
  const pBg = insight.priority === "high" ? Colors.redD : insight.priority === "medium" ? Colors.amberD : Colors.greenD;
  const pLabel = insight.priority === "high" ? "Urgente" : insight.priority === "medium" ? "Atenção" : "Info";

  return (
    <Pressable
      onHoverIn={w ? () => sH(true) : undefined}
      onHoverOut={w ? () => sH(false) : undefined}
      style={[s.insightCard, h && { borderColor: Colors.border2, transform: [{ translateY: -2 }] }, w && { transition: "all 0.2s ease" }]}
    >
      <View style={s.insightHeader}>
        <View style={[s.insightIcon, { backgroundColor: pc + "18" }]}>
          <Icon name={insight.icon} size={18} color={pc} />
        </View>
        <View style={[s.insightBadge, { backgroundColor: pBg }]}>
          <Text style={[s.insightBadgeText, { color: pc }]}>{pLabel}</Text>
        </View>
      </View>
      <Text style={s.insightTitle}>{insight.title}</Text>
      <Text style={s.insightDesc}>{insight.desc}</Text>
      <Pressable style={s.insightAction}>
        <Text style={s.insightActionText}>{insight.action}</Text>
        <Icon name="chevron_right" size={14} color={Colors.violet3} />
      </Pressable>
    </Pressable>
  );
}

export default function AgentesScreen() {
  const [tab, setTab] = useState(0);
  const { isDemo } = useAuthStore();
  const currentTab = TABS[tab];
  const insights = INSIGHTS[currentTab] || [];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PageHeader title="Agentes" />
      <Text style={s.subtitle}>Insights e sugestões contextuais para cada área do seu negócio</Text>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => setTab(i)} style={[s.tab, tab === i && s.tabActive]}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Agent header */}
      <View style={s.agentCard}>
        <View style={s.agentIcon}>
          <Icon name="star" size={24} color={Colors.violet3} />
        </View>
        <View style={s.agentInfo}>
          <Text style={s.agentName}>Agente {currentTab}</Text>
          <Text style={s.agentDesc}>
            {currentTab === "Contábil" && "Monitora prazos, obrigações e limites fiscais do seu negócio."}
            {currentTab === "Financeiro" && "Analisa fluxo de caixa, cobranças e oportunidades financeiras."}
            {currentTab === "Estoque" && "Acompanha níveis, tendencias de venda e sugestões de compra."}
            {currentTab === "CRM" && "Identifica oportunidades de retenção, aniversários e reativação."}
            {currentTab === "Marketing" && "Sugere conteúdos, horários e estratégias para seu Canal Digital."}
          </Text>
        </View>
      </View>

      {/* Insights */}
      <Text style={s.sectionTitle}>{insights.length} insights para você</Text>
      {insights.map(i => <InsightCard key={i.id} insight={i} />)}

      <DemoBanner />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 20, marginTop: -8 },
  // Tabs
  tabScroll: { flexGrow: 0, marginBottom: 20 },
  tabRow: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  // Agent header
  agentCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.violetD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  agentIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  agentInfo: { flex: 1, gap: 4 },
  agentName: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  agentDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  // Section
  sectionTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  // Insight cards
  insightCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  insightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  insightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  insightBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  insightBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  insightTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  insightDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 12 },
  insightAction: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  insightActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
