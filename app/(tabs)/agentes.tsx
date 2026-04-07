import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { aiApi } from "@/services/api";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";

// Mock activity log - in production, this comes from backend
const ACTIVITY_LOG = [
  { id: "1", agent: "Financeiro", action: "Cobrança enviada", detail: "Lembrete WhatsApp para João Santos - R$ 1.240,00", time: "Hoje, 14:32", icon: "wallet", status: "done" },
  { id: "2", agent: "Estoque", action: "Alerta de reposição", detail: "Pomada modeladora atingiu estoque mínimo (2 un.)", time: "Hoje, 11:15", icon: "package", status: "pending" },
  { id: "3", agent: "CRM", action: "Parabéns enviado", detail: "Mensagem de aniversário para Maria Silva", time: "Hoje, 08:00", icon: "users", status: "done" },
  { id: "4", agent: "Contábil", action: "Lembrete DAS", detail: "DAS-MEI de abril vence em 14 dias - R$ 76,90", time: "Ontem, 20:00", icon: "calculator", status: "pending" },
  { id: "5", agent: "Marketing", action: "Post sugerido", detail: "Rascunho de post para Instagram: combo corte+barba", time: "Ontem, 18:30", icon: "bar_chart", status: "done" },
  { id: "6", agent: "Financeiro", action: "Fluxo de caixa", detail: "Projeção 30 dias: caixa saudável (margem 46,6%)", time: "Ontem, 09:00", icon: "wallet", status: "info" },
  { id: "7", agent: "CRM", action: "Reativação", detail: "8 clientes inativos há 30+ dias identificados", time: "28/03, 20:00", icon: "users", status: "pending" },
  { id: "8", agent: "Estoque", action: "Curva ABC", detail: "Relatório atualizado: 80% receita de 3 produtos", time: "28/03, 10:00", icon: "package", status: "info" },
];

const AGENTS_SUMMARY = [
  { name: "Financeiro", icon: "wallet", actions: 12, saved: "3.2h", color: Colors.green },
  { name: "Estoque", icon: "package", actions: 8, saved: "1.8h", color: Colors.amber },
  { name: "CRM", icon: "users", actions: 15, saved: "2.5h", color: Colors.violet3 },
  { name: "Contábil", icon: "calculator", actions: 6, saved: "4.1h", color: Colors.red },
  { name: "Marketing", icon: "bar_chart", actions: 4, saved: "1.0h", color: "#db2777" },
];

function ActivityRow({ item }: { item: typeof ACTIVITY_LOG[0] }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const sc = item.status === "done" ? Colors.green : item.status === "pending" ? Colors.amber : Colors.violet3;
  const sl = item.status === "done" ? "Concluído" : item.status === "pending" ? "Pendente" : "Info";
  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[z.actRow, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <View style={[z.actIcon, { backgroundColor: sc + "18" }]}>
        <Icon name={item.icon as any} size={18} color={sc} />
      </View>
      <View style={z.actInfo}>
        <View style={z.actTop}>
          <Text style={z.actAgent}>{item.agent}</Text>
          <View style={[z.actBadge, { backgroundColor: sc + "18" }]}><Text style={[z.actBadgeText, { color: sc }]}>{sl}</Text></View>
        </View>
        <Text style={z.actAction}>{item.action}</Text>
        <Text style={z.actDetail}>{item.detail}</Text>
      </View>
      <Text style={z.actTime}>{item.time}</Text>
    </Pressable>
  );
}

export default function AgentesScreen() {
  const { isDemo, company, token } = useAuthStore();

  // CONN-26: Fetch real activity from API
  const { data: apiActivity } = useQuery({
    queryKey: ["ai-activity", company?.id],
    queryFn: () => aiApi.activity(company!.id, 20),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });

  // Chat state
  const [chatMsg, setChatMsg] = useState("");
  const [chatCtx, setChatCtx] = useState("geral");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatResponse, setChatResponse] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chatMutation = useMutation({
    mutationFn: () => aiApi.chat(company!.id, chatMsg, chatCtx, chatHistory),
    onSuccess: (data) => {
      setChatHistory(prev => [...prev, { role: "user", content: chatMsg }, { role: "assistant", content: data.response }]);
      setChatResponse(data.response);
      setChatMsg("");
      setChatLoading(false);
    },
    onError: (err: any) => {
      setChatResponse(err?.message || "Erro ao processar mensagem.");
      setChatLoading(false);
    },
  });

  function handleSendChat() {
    if (!chatMsg.trim() || chatLoading) return;
    setChatLoading(true);
    setChatResponse("");
    chatMutation.mutate();
  }

  // Use API data if available
  const activityData = apiActivity?.activity?.length ? apiActivity.activity.map((a: any) => ({
    id: a.id, agent: a.agent || "Geral",
    action: a.action || "Acao", detail: a.detail || "",
    time: a.time ? new Date(a.time).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "---",
    icon: { Financeiro: "wallet", Estoque: "package", CRM: "users", Contabil: "calculator", Marketing: "bar_chart" }[a.agent] || "star",
    status: a.status || "done",
  })) : ACTIVITY_LOG;

  const summaryData = apiActivity?.summary?.length ? apiActivity.summary.map((s: any) => ({
    name: s.name, icon: { Financeiro: "wallet", Estoque: "package", CRM: "users", Contabil: "calculator", Marketing: "bar_chart" }[s.name] || "star",
    actions: s.actions, saved: (s.actions * 0.25).toFixed(1) + "h",
    color: { Financeiro: Colors.green, Estoque: Colors.amber, CRM: Colors.violet3, Contabil: Colors.red, Marketing: "#db2777" }[s.name] || Colors.violet3,
  })) : AGENTS_SUMMARY;
  const totalActions = summaryData.reduce((s: number, a: any) => s + (a.actions || 0), 0);
  const totalSaved = summaryData.reduce((s: number, a: any) => s + parseFloat(a.saved || "0"), 0).toFixed(1);

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Agentes" />
      <Text style={z.subtitle}>Painel de atividade dos seus agentes de IA</Text>

      {/* Summary KPIs */}
      <View style={z.kpiRow}>
        <View style={z.kpi}>
          <Text style={z.kpiValue}>{totalActions}</Text>
          <Text style={z.kpiLabel}>Ações este mês</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.green }]}>{totalSaved}h</Text>
          <Text style={z.kpiLabel}>Tempo economizado</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.violet3 }]}>5</Text>
          <Text style={z.kpiLabel}>Agentes ativos</Text>
        </View>
      </View>

      {/* Agents grid */}
      <Text style={z.sectionTitle}>Seus agentes</Text>
      <View style={z.agentsGrid}>
        {summaryData.map((ag: any) => (
          <View key={ag.name} style={z.agentCard}>
            <View style={[z.agentIcon, { backgroundColor: ag.color + "18" }]}>
              <Icon name={ag.icon as any} size={20} color={ag.color} />
            </View>
            <Text style={z.agentName}>{ag.name}</Text>
            <View style={z.agentStats}>
              <Text style={z.agentStat}>{ag.actions} ações</Text>
              <Text style={[z.agentStat, { color: Colors.green }]}>{ag.saved} salvas</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Activity log */}
      <Text style={z.sectionTitle}>Atividade recente</Text>
      <View style={z.card}>
        {activityData.map((item: any) => <ActivityRow key={item.id} item={item} />)}
      </View>

      {/* Chat with AI */}
      <Text style={z.sectionTitle}>Conversar com agente</Text>
      <View style={z.chatCard}>
        <View style={z.chatCtxRow}>
          {["geral", "financeiro", "estoque", "crm", "contabil", "marketing"].map(ctx => (
            <Pressable key={ctx} onPress={() => setChatCtx(ctx)}
              style={[z.chatCtxChip, chatCtx === ctx && z.chatCtxChipActive]}>
              <Text style={[z.chatCtxText, chatCtx === ctx && z.chatCtxTextActive]}>
                {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        {chatHistory.length > 0 && (
          <View style={z.chatHistory}>
            {chatHistory.slice(-6).map((h, i) => (
              <View key={i} style={[z.chatBubble, h.role === "user" ? z.chatUser : z.chatAssistant]}>
                <Text style={[z.chatBubbleText, h.role === "user" && { color: "#fff" }]}>{h.content}</Text>
              </View>
            ))}
          </View>
        )}
        {chatResponse && chatHistory.length === 0 && (
          <View style={z.chatResponseBox}>
            <Text style={z.chatResponseText}>{chatResponse}</Text>
          </View>
        )}
        <View style={z.chatInputRow}>
          <TextInput style={z.chatInput} value={chatMsg} onChangeText={setChatMsg}
            placeholder="Pergunte algo ao agente..." placeholderTextColor={Colors.ink3}
            onSubmitEditing={handleSendChat} editable={!chatLoading} />
          <Pressable onPress={handleSendChat} style={[z.chatSendBtn, chatLoading && { opacity: 0.5 }]}>
            <Text style={z.chatSendText}>{chatLoading ? "..." : "Enviar"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={z.infoCard}>
        <Icon name="star" size={14} color={Colors.violet3} />
        <Text style={z.infoText}>Os agentes analisam seus dados em tempo real e executam ações automaticamente. Insights proativos aparecem no topo de cada aba.</Text>
      </View>

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%", overflow: "hidden" as any },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 20, marginTop: -8 },
  // KPIs
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  // Agents grid
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  agentsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  agentCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, minWidth: IS_WIDE ? 160 : "47%", flex: 1, gap: 8, alignItems: "center" },
  agentIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  agentName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  agentStats: { flexDirection: "row", gap: 10 },
  agentStat: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  // Activity log
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  actRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 8 },
  actIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  actInfo: { flex: 1, gap: 2 },
  actTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  actAgent: { fontSize: 10, fontWeight: "700", color: Colors.violet3, textTransform: "uppercase", letterSpacing: 0.5 },
  actBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  actBadgeText: { fontSize: 8, fontWeight: "700" },
  actAction: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  actDetail: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  actTime: { fontSize: 10, color: Colors.ink3, minWidth: IS_WIDE ? 80 : 60, textAlign: "right" },
  // Info
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  infoText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },
});
