import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";
import { toast } from "@/components/Toast";

const AURA_EMAIL = "suporte@getaura.com.br";
const AURA_WHATSAPP = "5512999990000";

const MOCK_MESSAGES = [
  { id: "1", from: "analyst", name: "Equipe Aura", text: "Olá! Sou seu Analista de Negócios na Aura. Estou aqui para ajudar com configurações, dúvidas, leitura de dados e acompanhamento de prazos. Como posso te ajudar hoje?", time: "09:00" },
  { id: "2", from: "user", text: "Oi! Preciso de ajuda para entender meu DRE deste mês.", time: "09:15" },
  { id: "3", from: "analyst", name: "Equipe Aura", text: "Claro! Analisando seus dados de março: sua margem líquida está em 46,6%, que é excelente para o segmento. As despesas fixas representam 17% do faturamento. Quer que eu detalhe alguma categoria específica?", time: "09:18" },
  { id: "4", from: "user", text: "Sim, quero entender melhor as despesas operacionais.", time: "09:20" },
  { id: "5", from: "analyst", name: "Equipe Aura", text: "Suas despesas operacionais somam R$ 894,80 este mês. Os principais itens são: material de limpeza (R$ 45,90), insumos (R$ 320,00) e manutenção (R$ 528,90). Comparando com fevereiro, houve aumento de 8% - principalmente pela manutenção. Posso ajudar a identificar oportunidades de redução?", time: "09:22" },
];

const QUICK_ACTIONS = [
  { label: "Ajuda com configuração", icon: "settings" },
  { label: "Entender meus dados", icon: "bar_chart" },
  { label: "Dúvida sobre obrigações", icon: "calculator" },
  { label: "Suporte técnico", icon: "alert" },
];

function ChatBubble({ msg }: { msg: typeof MOCK_MESSAGES[0] }) {
  const isAnalyst = msg.from === "analyst";
  return (
    <View style={[z.bubble, isAnalyst ? z.bubbleAnalyst : z.bubbleUser]}>
      {isAnalyst && (
        <View style={z.analystHeader}>
          <View style={z.analystAvatar}><Icon name="star" size={12} color={Colors.violet3} /></View>
          <Text style={z.analystName}>{msg.name}</Text>
        </View>
      )}
      <Text style={z.bubbleText}>{msg.text}</Text>
      <Text style={z.bubbleTime}>{msg.time}</Text>
    </View>
  );
}

export default function SuporteScreen() {
  const { user, isDemo } = useAuthStore();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);

  function sendMessage() {
    if (!message.trim()) return;
    const newMsg = { id: Date.now().toString(), from: "user", text: message.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, newMsg]);
    setMessage("");
    // Simulate analyst response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), from: "analyst", name: "Equipe Aura",
        text: "Recebi sua mensagem! Um analista vai responder em breve. Tempo médio de resposta: 2h úteis.",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      }]);
    }, 1500);
  }

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Seu Analista de Negócios" />

      {/* Hero card */}
      <View style={z.heroCard}>
        <View style={z.heroIcon}>
          <Icon name="star" size={28} color={Colors.violet3} />
        </View>
        <Text style={z.heroTitle}>Um membro extra na sua equipe</Text>
        <Text style={z.heroDesc}>Seu Analista de Negócios está disponível para configuração, leitura de dados, acompanhamento de prazos, dúvidas e suporte técnico.</Text>
        <View style={z.heroStats}>
          <View style={z.heroStat}>
            <Text style={z.heroStatValue}>2h</Text>
            <Text style={z.heroStatLabel}>Tempo resposta</Text>
          </View>
          <View style={z.heroStatDivider} />
          <View style={z.heroStat}>
            <Text style={z.heroStatValue}>Seg-Sáb</Text>
            <Text style={z.heroStatLabel}>8h às 18h</Text>
          </View>
          <View style={z.heroStatDivider} />
          <View style={z.heroStat}>
            <Text style={[z.heroStatValue, { color: Colors.green }]}>Incluso</Text>
            <Text style={z.heroStatLabel}>No seu plano</Text>
          </View>
        </View>
      </View>

      {/* Contact buttons */}
      <View style={z.contactRow}>
        <Pressable onPress={() => { Linking.openURL("https://wa.me/" + AURA_WHATSAPP); toast.success("Abrindo WhatsApp..."); }} style={[z.contactBtn, { backgroundColor: "#25D366" }]}>
          <Icon name="star" size={18} color="#fff" />
          <Text style={z.contactBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable onPress={() => { Linking.openURL("mailto:" + AURA_EMAIL); toast.success("Abrindo e-mail..."); }} style={[z.contactBtn, { backgroundColor: Colors.violet }]}>
          <Icon name="file_text" size={18} color="#fff" />
          <Text style={z.contactBtnText}>E-mail</Text>
        </Pressable>
      </View>

      {/* Chat section */}
      <Text style={z.sectionTitle}>Chat com seu analista</Text>

      {/* Quick actions */}
      <View style={z.quickRow}>
        {QUICK_ACTIONS.map(qa => (
          <Pressable key={qa.label} onPress={() => setMessage(qa.label)} style={z.quickBtn}>
            <Icon name={qa.icon as any} size={14} color={Colors.violet3} />
            <Text style={z.quickText}>{qa.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Messages */}
      <View style={z.chatCard}>
        {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
      </View>

      {/* Reply bar */}
      <View style={z.replyBar}>
        <TextInput style={z.replyInput} value={message} onChangeText={setMessage} placeholder="Digite sua mensagem..." placeholderTextColor={Colors.ink3} onSubmitEditing={sendMessage} />
        <Pressable onPress={sendMessage} style={z.sendBtn}>
          <Icon name="chevron_right" size={18} color="#fff" />
        </Pressable>
      </View>

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%", overflow: "hidden" as any },
  // Hero
  heroCard: { backgroundColor: Colors.violetD, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginBottom: 20, gap: 10 },
  heroIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  heroTitle: { fontSize: 20, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  heroDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 400 },
  heroStats: { flexDirection: IS_WIDE ? "row" : "column", alignItems: "center", marginTop: 8, gap: IS_WIDE ? 0 : 12 },
  heroStat: { alignItems: "center", paddingHorizontal: 20, gap: 4 },
  heroStatValue: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  heroStatLabel: { fontSize: 10, color: Colors.ink3 },
  heroStatDivider: { width: IS_WIDE ? 1 : "60%", height: IS_WIDE ? 32 : 1, backgroundColor: Colors.border },
  // Contact
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  contactBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  // Section
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  // Quick actions
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  quickText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  // Chat
  chatCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, gap: 12 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 14, gap: 4 },
  bubbleAnalyst: { alignSelf: "flex-start", backgroundColor: Colors.bg4 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Colors.violet },
  analystHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  analystAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  analystName: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  bubbleText: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  bubbleTime: { fontSize: 9, color: Colors.ink3, alignSelf: "flex-end" },
  // Reply
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  replyInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
});
