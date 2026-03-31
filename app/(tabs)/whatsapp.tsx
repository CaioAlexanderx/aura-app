import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Switch, TextInput, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { DemoBanner } from "@/components/DemoBanner";

const TABS = ["Conversas", "Automações", "Campanhas", "Configurações"];

// ── Mock data ────────────────────────────────────
const MOCK_CONVERSATIONS = [
  { id: "1", name: "Maria Silva", phone: "(12) 99887-1234", lastMsg: "Obrigada! Vou passar aí na quinta.", time: "14:32", unread: 0, avatar: "M", status: "resolved" },
  { id: "2", name: "Pedro Costa", phone: "(12) 99776-5678", lastMsg: "Qual o valor do combo corte+barba?", time: "13:15", unread: 2, avatar: "P", status: "open" },
  { id: "3", name: "Ana Oliveira", phone: "(12) 99665-9012", lastMsg: "Confirma meu horário de amanhã?", time: "11:47", unread: 1, avatar: "A", status: "open" },
  { id: "4", name: "João Santos", phone: "(12) 99554-3456", lastMsg: "[Cobrança automática enviada]", time: "10:20", unread: 0, avatar: "J", status: "auto" },
  { id: "5", name: "Carlos Lima", phone: "(12) 99443-7890", lastMsg: "Tem pomada modeladora em estoque?", time: "Ontem", unread: 0, avatar: "C", status: "resolved" },
  { id: "6", name: "Lucia Ferreira", phone: "(12) 99332-1122", lastMsg: "[Pós-venda automática enviada]", time: "Ontem", unread: 0, avatar: "L", status: "auto" },
];

const MOCK_MESSAGES = [
  { id: "1", from: "client", text: "Oi! Qual o valor do combo corte+barba?", time: "13:10" },
  { id: "2", from: "aura", text: "Olá, Pedro! O combo corte+barba está por R$ 70,00. Deseja agendar um horário?", time: "13:12", auto: true },
  { id: "3", from: "client", text: "Tem horário hoje à tarde?", time: "13:14" },
  { id: "4", from: "user", text: "Temos às 15h e 16h30. Qual prefere?", time: "13:15" },
];

const MOCK_AUTOMATIONS = [
  { id: "1", name: "Boas-vindas", desc: "Mensagem automática para novos clientes após primeira compra", trigger: "Primeira compra", enabled: true, sent: 47, icon: "star" },
  { id: "2", name: "Cobrança gentil", desc: "Lembrete de pagamento 3 dias após vencimento", trigger: "Fatura vencida +3d", enabled: true, sent: 12, icon: "wallet" },
  { id: "3", name: "Aniversário", desc: "Mensagem de parabéns + cupom de desconto no aniversário", trigger: "Data de aniversário", enabled: true, sent: 8, icon: "users" },
  { id: "4", name: "Pós-venda", desc: "Pesquisa de satisfação 24h após atendimento", trigger: "Venda confirmada +24h", enabled: false, sent: 0, icon: "check" },
  { id: "5", name: "Reativação", desc: "Convite para voltar após 30 dias sem visita", trigger: "Inativo 30+ dias", enabled: true, sent: 5, icon: "trending_up" },
  { id: "6", name: "Lembrete agendamento", desc: "Confirmação automática 2h antes do horário agendado", trigger: "Agendamento -2h", enabled: false, sent: 0, icon: "alert" },
];

const MOCK_CAMPAIGNS = [
  { id: "1", name: "Promoção de verão", status: "sent", recipients: 156, delivered: 148, read: 89, date: "25/03/2026" },
  { id: "2", name: "Lançamento combo", status: "sent", recipients: 203, delivered: 195, read: 134, date: "20/03/2026" },
  { id: "3", name: "Reativação março", status: "draft", recipients: 42, delivered: 0, read: 0, date: null },
];

// ── Tab: Conversas ───────────────────────────────
function TabConversas() {
  const [selectedId, setSelectedId] = useState("2");
  const [filter, setFilter] = useState("all");
  const selected = MOCK_CONVERSATIONS.find(c => c.id === selectedId);
  const [replyText, setReplyText] = useState("");
  const filters = ["all", "open", "auto", "resolved"];
  const filterLabels = { all: "Todas", open: "Abertas", auto: "Automáticas", resolved: "Resolvidas" };
  const filtered = filter === "all" ? MOCK_CONVERSATIONS : MOCK_CONVERSATIONS.filter(c => c.status === filter);

  return (
    <View style={IS_WIDE ? z.chatLayout : { gap: 16 }}>
      {/* Conversation list */}
      <View style={z.chatList}>
        <View style={z.filterRow}>
          {filters.map(f => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[z.filterBtn, filter === f && z.filterBtnActive]}>
              <Text style={[z.filterText, filter === f && z.filterTextActive]}>{filterLabels[f]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={z.card}>
          {filtered.map(conv => (
            <HoverRow key={conv.id} onPress={() => setSelectedId(conv.id)} style={[z.convRow, selectedId === conv.id && z.convRowActive]}>
              <View style={[z.convAvatar, conv.unread > 0 && { borderColor: Colors.green, borderWidth: 2 }]}>
                <Text style={z.convAvatarText}>{conv.avatar}</Text>
              </View>
              <View style={z.convInfo}>
                <View style={z.convTop}>
                  <Text style={z.convName} numberOfLines={1}>{conv.name}</Text>
                  <Text style={z.convTime}>{conv.time}</Text>
                </View>
                <View style={z.convBottom}>
                  <Text style={z.convMsg} numberOfLines={1}>{conv.lastMsg}</Text>
                  {conv.unread > 0 && <View style={z.convBadge}><Text style={z.convBadgeText}>{conv.unread}</Text></View>}
                  {conv.status === "auto" && <View style={z.convAutoBadge}><Text style={z.convAutoText}>Auto</Text></View>}
                </View>
              </View>
            </HoverRow>
          ))}
        </View>
      </View>

      {/* Chat view */}
      {selected && (
        <View style={z.chatView}>
          <View style={z.chatHeader}>
            <View style={z.chatHeaderLeft}>
              <View style={z.chatAvatar}><Text style={z.chatAvatarText}>{selected.avatar}</Text></View>
              <View>
                <Text style={z.chatName}>{selected.name}</Text>
                <Text style={z.chatPhone}>{selected.phone}</Text>
              </View>
            </View>
            <Pressable onPress={() => toast.info("Abrir ficha do cliente")} style={z.chatAction}>
              <Icon name="users" size={16} color={Colors.violet3} />
              <Text style={z.chatActionText}>Ver ficha</Text>
            </Pressable>
          </View>
          <View style={z.messagesArea}>
            {MOCK_MESSAGES.map(msg => (
              <View key={msg.id} style={[z.msgBubble, msg.from === "client" ? z.msgClient : z.msgUser, msg.auto && z.msgAuto]}>
                {msg.auto && <Text style={z.msgAutoLabel}>Resposta automática</Text>}
                <Text style={z.msgText}>{msg.text}</Text>
                <Text style={z.msgTime}>{msg.time}</Text>
              </View>
            ))}
          </View>
          <View style={z.replyBar}>
            <TextInput style={z.replyInput} value={replyText} onChangeText={setReplyText} placeholder="Digitar mensagem..." placeholderTextColor={Colors.ink3} />
            <Pressable onPress={() => { if (replyText.trim()) { toast.success("Mensagem enviada"); setReplyText(""); } }} style={z.sendBtn}>
              <Icon name="chevron_right" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Tab: Automações ──────────────────────────────
function TabAutomacoes() {
  const [autos, setAutos] = useState(MOCK_AUTOMATIONS);
  const activeCount = autos.filter(a => a.enabled).length;
  const totalSent = autos.reduce((s, a) => s + a.sent, 0);

  function toggle(id) {
    setAutos(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    toast.success("Automação atualizada");
  }

  return (
    <View>
      <View style={g.row}>
        <SummaryKPI label="ATIVAS" value={String(activeCount)} color={Colors.green} />
        <SummaryKPI label="TOTAL ENVIADAS" value={String(totalSent)} />
        <SummaryKPI label="TEMPLATES" value={String(autos.length)} />
      </View>

      <View style={z.card}>
        {autos.map(auto => (
          <HoverRow key={auto.id} style={z.autoRow}>
            <View style={z.autoLeft}>
              <View style={[z.autoIcon, { backgroundColor: auto.enabled ? Colors.violetD : Colors.bg4 }]}>
                <Icon name={auto.icon} size={20} color={auto.enabled ? Colors.violet3 : Colors.ink3} />
              </View>
              <View style={z.autoInfo}>
                <Text style={z.autoName}>{auto.name}</Text>
                <Text style={z.autoDesc}>{auto.desc}</Text>
                <View style={z.autoMeta}>
                  <View style={z.autoTrigger}><Text style={z.autoTriggerText}>{auto.trigger}</Text></View>
                  {auto.sent > 0 && <Text style={z.autoSent}>{auto.sent} enviadas</Text>}
                </View>
              </View>
            </View>
            <Switch value={auto.enabled} onValueChange={() => toggle(auto.id)} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </HoverRow>
        ))}
      </View>

      <Pressable onPress={() => toast.info("Criar nova automação")} style={z.createBtn}>
        <Icon name="star" size={16} color={Colors.violet3} />
        <Text style={z.createBtnText}>Criar automação</Text>
      </Pressable>
    </View>
  );
}

// ── Tab: Campanhas ───────────────────────────────
function TabCampanhas() {
  return (
    <View>
      <View style={g.row}>
        <SummaryKPI label="CAMPANHAS" value={String(MOCK_CAMPAIGNS.length)} />
        <SummaryKPI label="ENTREGUES" value="343" color={Colors.green} />
        <SummaryKPI label="TAXA LEITURA" value="65%" color={Colors.violet3} />
      </View>

      <View style={z.card}>
        {MOCK_CAMPAIGNS.map(camp => {
          const readRate = camp.delivered > 0 ? Math.round((camp.read / camp.delivered) * 100) : 0;
          return (
            <HoverRow key={camp.id} style={z.campRow}>
              <View style={z.campLeft}>
                <Text style={z.campName}>{camp.name}</Text>
                <View style={z.campMeta}>
                  <View style={[z.campBadge, { backgroundColor: camp.status === "sent" ? Colors.greenD : Colors.amberD }]}>
                    <Text style={[z.campBadgeText, { color: camp.status === "sent" ? Colors.green : Colors.amber }]}>{camp.status === "sent" ? "Enviada" : "Rascunho"}</Text>
                  </View>
                  {camp.date && <Text style={z.campDate}>{camp.date}</Text>}
                </View>
              </View>
              {camp.status === "sent" && (
                <View style={z.campStats}>
                  <View style={z.campStat}><Text style={z.campStatValue}>{camp.recipients}</Text><Text style={z.campStatLabel}>Enviadas</Text></View>
                  <View style={z.campStat}><Text style={z.campStatValue}>{camp.delivered}</Text><Text style={z.campStatLabel}>Entregues</Text></View>
                  <View style={z.campStat}><Text style={[z.campStatValue, { color: Colors.green }]}>{readRate}%</Text><Text style={z.campStatLabel}>Lidas</Text></View>
                </View>
              )}
            </HoverRow>
          );
        })}
      </View>

      <Pressable onPress={() => toast.info("Criar nova campanha")} style={z.createBtn}>
        <Icon name="star" size={16} color={Colors.violet3} />
        <Text style={z.createBtnText}>Nova campanha</Text>
      </Pressable>
    </View>
  );
}

// ── Tab: Configurações ──────────────────────────
function TabConfig() {
  const [connected, setConnected] = useState(true);

  return (
    <View>
      {/* Connection status */}
      <View style={[z.statusCard, { borderColor: connected ? Colors.green + "33" : Colors.red + "33" }]}>
        <View style={[z.statusDot, { backgroundColor: connected ? Colors.green : Colors.red }]} />
        <View style={z.statusInfo}>
          <Text style={z.statusTitle}>{connected ? "WhatsApp Business conectado" : "WhatsApp desconectado"}</Text>
          <Text style={z.statusDesc}>{connected ? "Número: (12) 99999-0000 · Aura Demo" : "Conecte para habilitar mensagens automáticas"}</Text>
        </View>
        <Pressable onPress={() => { setConnected(!connected); toast.success(connected ? "Desconectado" : "Conectado"); }} style={[z.statusBtn, { borderColor: connected ? Colors.red + "44" : Colors.green + "44" }]}>
          <Text style={[z.statusBtnText, { color: connected ? Colors.red : Colors.green }]}>{connected ? "Desconectar" : "Conectar"}</Text>
        </Pressable>
      </View>

      {/* Settings sections */}
      <View style={z.section}>
        <Text style={z.sectionTitle}>Horário de atendimento</Text>
        <View style={z.card}>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Respostas automáticas fora do horário</Text>
              <Text style={z.settingHint}>Envia mensagem informando horário de funcionamento</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Horário</Text>
              <Text style={z.settingHint}>Segunda a sábado, 8h às 18h</Text>
            </View>
            <Pressable onPress={() => toast.info("Editar horário")} style={z.editBtn}><Text style={z.editBtnText}>Editar</Text></Pressable>
          </View>
        </View>
      </View>

      <View style={z.section}>
        <Text style={z.sectionTitle}>Notificações</Text>
        <View style={z.card}>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Resumo diário</Text>
              <Text style={z.settingHint}>Receba um resumo das conversas às 20h</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
          <View style={z.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.settingLabel}>Alerta de mensagem não respondida</Text>
              <Text style={z.settingHint}>Notifica após 30 min sem resposta</Text>
            </View>
            <Switch value={true} trackColor={{ true: Colors.green, false: Colors.bg4 }} />
          </View>
        </View>
      </View>

      <View style={z.infoCard}>
        <Icon name="alert" size={14} color={Colors.amber} />
        <Text style={z.infoText}>A integração com WhatsApp Business API requer configuração no Meta Business Manager. A Aura cuida da conexão no setup do seu plano.</Text>
      </View>
    </View>
  );
}

// ── Shared ────────────────────────────────────────
function SummaryKPI({ label, value, color }) {
  return (
    <View style={g.kpi}>
      <Text style={g.kpiLabel}>{label}</Text>
      <Text style={[g.kpiValue, color && { color }]}>{value}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────
export default function WhatsAppScreen() {
  const [tab, setTab] = useState(0);
  const { isDemo } = useAuthStore();

  return (
    <ScrollView style={g.screen} contentContainerStyle={g.content}>
      <PageHeader title="WhatsApp" />
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {tab === 0 && <TabConversas />}
      {tab === 1 && <TabAutomacoes />}
      {tab === 2 && <TabCampanhas />}
      {tab === 3 && <TabConfig />}
      <DemoBanner />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────
const g = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "30%", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { fontSize: 20, fontWeight: "800", color: Colors.ink },
});

const z = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  // Chat layout
  chatLayout: { flexDirection: "row", gap: 16 },
  chatList: { width: IS_WIDE ? 320 : "100%" },
  chatView: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  // Filters
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  filterTextActive: { color: Colors.violet3, fontWeight: "600" },
  // Conversation list
  convRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  convRowActive: { backgroundColor: Colors.violetD, borderRadius: 10, marginHorizontal: -8, paddingHorizontal: 8 },
  convAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  convAvatarText: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  convInfo: { flex: 1, gap: 4 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 14, fontWeight: "600", color: Colors.ink, flex: 1 },
  convTime: { fontSize: 10, color: Colors.ink3 },
  convBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  convMsg: { fontSize: 12, color: Colors.ink3, flex: 1 },
  convBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  convBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  convAutoBadge: { backgroundColor: Colors.violetD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  convAutoText: { fontSize: 8, fontWeight: "600", color: Colors.violet3 },
  // Chat view
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  chatAvatarText: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  chatName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  chatPhone: { fontSize: 11, color: Colors.ink3 },
  chatAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  chatActionText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  // Messages
  messagesArea: { padding: 16, gap: 10, minHeight: 240 },
  msgBubble: { maxWidth: "75%", borderRadius: 14, padding: 12, gap: 4 },
  msgClient: { alignSelf: "flex-start", backgroundColor: Colors.bg4 },
  msgUser: { alignSelf: "flex-end", backgroundColor: Colors.violet },
  msgAuto: { alignSelf: "flex-end", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  msgAutoLabel: { fontSize: 9, fontWeight: "600", color: Colors.violet3, marginBottom: 2 },
  msgText: { fontSize: 13, color: Colors.ink, lineHeight: 18 },
  msgTime: { fontSize: 9, color: Colors.ink3, alignSelf: "flex-end" },
  // Reply bar
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  replyInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  // Automations
  autoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  autoLeft: { flexDirection: "row", gap: 12, flex: 1 },
  autoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  autoInfo: { flex: 1, gap: 4 },
  autoName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  autoDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  autoMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  autoTrigger: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  autoTriggerText: { fontSize: 9, fontWeight: "600", color: Colors.ink3 },
  autoSent: { fontSize: 10, color: Colors.violet3, fontWeight: "500" },
  // Campaigns
  campRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  campLeft: { gap: 6, flex: 1 },
  campName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  campMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  campBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  campBadgeText: { fontSize: 9, fontWeight: "600" },
  campDate: { fontSize: 10, color: Colors.ink3 },
  campStats: { flexDirection: "row", gap: 16 },
  campStat: { alignItems: "center", gap: 2 },
  campStatValue: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  campStatLabel: { fontSize: 9, color: Colors.ink3 },
  // Create button
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border2 },
  createBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  // Settings
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 20 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusInfo: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  statusDesc: { fontSize: 11, color: Colors.ink3 },
  statusBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  statusBtnText: { fontSize: 12, fontWeight: "600" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingLabel: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  settingHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  editBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.violetD },
  editBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  // Info
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginTop: 16 },
  infoText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});
