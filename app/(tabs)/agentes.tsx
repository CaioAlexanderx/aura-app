import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { aiApi } from "@/services/api";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";

const AGENT_META: Record<string, { icon: string; color: string }> = {
  Financeiro:   { icon: "wallet", color: Colors.green },
  Estoque:      { icon: "package", color: Colors.amber },
  CRM:          { icon: "users", color: Colors.violet3 },
  Contabil:     { icon: "calculator", color: Colors.red },
  Marketing:    { icon: "bar_chart", color: "#db2777" },
  Odontologico: { icon: "tooth", color: "#06B6D4" },
  Geral:        { icon: "star", color: Colors.violet3 },
};

function getAgentMeta(name: string) { return AGENT_META[name] || AGENT_META.Geral; }

function ActivityRow({ item }: { item: any }) {
  const [h, sH] = useState(false); const w = Platform.OS === "web";
  const sc = item.status === "done" ? Colors.green : item.status === "pending" ? Colors.amber : Colors.violet3;
  const sl = item.status === "done" ? "Concluido" : item.status === "pending" ? "Pendente" : "Info";
  const meta = getAgentMeta(item.agent);
  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[z.actRow, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <View style={[z.actIcon, { backgroundColor: meta.color + "18" }]}>
        <Icon name={meta.icon as any} size={18} color={meta.color} />
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

  // Fetch real activity from API
  const { data: apiActivity, isLoading } = useQuery({
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

  // Map API data to display format
  const activityData = (apiActivity?.activity || []).map((a: any) => ({
    id: a.id, agent: a.agent || "Geral",
    action: a.action || "Acao", detail: a.detail || "",
    time: a.created_at ? new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "---",
    status: a.status || "done",
  }));

  // Build summary from real data
  const agentCounts: Record<string, number> = {};
  for (const a of activityData) {
    agentCounts[a.agent] = (agentCounts[a.agent] || 0) + 1;
  }
  const summaryData = Object.entries(agentCounts).map(([name, actions]) => ({
    name, actions, saved: (actions * 0.25).toFixed(1) + "h", ...getAgentMeta(name),
  }));
  const totalActions = activityData.length;
  const totalSaved = (totalActions * 0.25).toFixed(1);
  const hasData = activityData.length > 0;

  // Contextos disponiveis. Backend mapeia cada um para system prompt especifico.
  const CONTEXTS = ["geral", "financeiro", "estoque", "crm", "contabil", "marketing", "odonto"];
  const CTX_LABEL: Record<string, string> = {
    geral: "Geral", financeiro: "Financeiro", estoque: "Estoque",
    crm: "CRM", contabil: "Contabil", marketing: "Marketing", odonto: "Odontologia",
  };

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Agentes" />
      <Text style={z.subtitle}>Painel de atividade dos seus agentes de IA</Text>

      {/* Summary KPIs */}
      <View style={z.kpiRow}>
        <View style={z.kpi}>
          <Text style={z.kpiValue}>{totalActions}</Text>
          <Text style={z.kpiLabel}>Acoes este mes</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.green }]}>{totalSaved}h</Text>
          <Text style={z.kpiLabel}>Tempo economizado</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.violet3 }]}>{summaryData.length || 5}</Text>
          <Text style={z.kpiLabel}>Agentes ativos</Text>
        </View>
      </View>

      {/* Agents grid */}
      {summaryData.length > 0 && (
        <>
          <Text style={z.sectionTitle}>Seus agentes</Text>
          <View style={z.agentsGrid}>
            {summaryData.map((ag: any) => (
              <View key={ag.name} style={z.agentCard}>
                <View style={[z.agentIcon, { backgroundColor: ag.color + "18" }]}>
                  <Icon name={ag.icon as any} size={20} color={ag.color} />
                </View>
                <Text style={z.agentName}>{ag.name}</Text>
                <View style={z.agentStats}>
                  <Text style={z.agentStat}>{ag.actions} acoes</Text>
                  <Text style={[z.agentStat, { color: Colors.green }]}>{ag.saved} salvas</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Activity log */}
      <Text style={z.sectionTitle}>Atividade recente</Text>
      {isLoading && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={{ fontSize: 12, color: Colors.ink3, marginTop: 8 }}>Carregando atividade...</Text>
        </View>
      )}
      {!isLoading && hasData && (
        <View style={z.card}>
          {activityData.map((item: any) => <ActivityRow key={item.id} item={item} />)}
        </View>
      )}
      {!isLoading && !hasData && !isDemo && (
        <EmptyState
          icon="star"
          iconColor={Colors.violet3}
          title="Nenhuma atividade ainda"
          subtitle="Os agentes vao registrar acoes aqui conforme analisam seus dados. Comece conversando com um agente abaixo."
        />
      )}

      {/* Chat with AI */}
      <Text style={z.sectionTitle}>Conversar com agente</Text>
      <View style={z.chatCard}>
        <View style={z.chatCtxRow}>
          {CONTEXTS.map(ctx => (
            <Pressable key={ctx} onPress={() => setChatCtx(ctx)}
              style={[z.chatCtxChip, chatCtx === ctx && z.chatCtxChipActive]}>
              <Text style={[z.chatCtxText, chatCtx === ctx && z.chatCtxTextActive]}>
                {CTX_LABEL[ctx]}
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
        <Text style={z.infoText}>Os agentes analisam seus dados em tempo real e executam acoes automaticamente. Insights proativos aparecem no topo de cada aba.</Text>
      </View>
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%", overflow: "hidden" as any },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 20, marginTop: -8 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  agentsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  agentCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, minWidth: IS_WIDE ? 160 : "47%", flex: 1, gap: 8, alignItems: "center" },
  agentIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  agentName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  agentStats: { flexDirection: "row", gap: 10 },
  agentStat: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
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
  chatCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  chatCtxRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chatCtxChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chatCtxChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chatCtxText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chatCtxTextActive: { color: Colors.violet3, fontWeight: "600" },
  chatHistory: { gap: 8, marginBottom: 12 },
  chatBubble: { borderRadius: 12, padding: 12, maxWidth: "80%" },
  chatUser: { backgroundColor: Colors.violet, alignSelf: "flex-end" },
  chatAssistant: { backgroundColor: Colors.bg4, alignSelf: "flex-start" },
  chatBubbleText: { fontSize: 13, color: Colors.ink, lineHeight: 20 },
  chatResponseBox: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginBottom: 12 },
  chatResponseText: { fontSize: 13, color: Colors.ink, lineHeight: 20 },
  chatInputRow: { flexDirection: "row", gap: 8 },
  chatInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  chatSendBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  chatSendText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  infoText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 16 },
});
