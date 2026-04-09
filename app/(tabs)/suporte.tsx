import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";
import { toast } from "@/components/Toast";

const AURA_EMAIL = "suporte@getaura.com.br";
const AURA_WHATSAPP = "5511956305269";

const QUICK_ACTIONS = [
  { label: "Configuracao", icon: "settings" },
  { label: "Entender dados", icon: "bar_chart" },
  { label: "Obrigacoes", icon: "calculator" },
  { label: "Suporte tecnico", icon: "alert" },
];

export default function SuporteScreen() {
  const { user, isDemo } = useAuthStore();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ id: string; from: string; name?: string; text: string; time: string }[]>([]);

  function sendMessage() {
    if (!message.trim()) return;
    const newMsg = { id: Date.now().toString(), from: "user", text: message.trim(), time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, newMsg]);
    setMessage("");
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), from: "analyst", name: "Equipe Aura",
        text: "Recebi sua mensagem! Um analista vai responder em breve. Tempo medio de resposta: 2h uteis.",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      }]);
    }, 1500);
  }

  function openWhatsApp() {
    const text = encodeURIComponent("Ola, preciso de ajuda com minha conta na Aura.");
    Linking.openURL(`https://wa.me/${AURA_WHATSAPP}?text=${text}`);
  }

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Seu Analista de Negocios" />

      {/* Hero card */}
      <View style={z.heroCard}>
        <View style={z.heroIcon}>
          <Icon name="star" size={28} color={Colors.violet3} />
        </View>
        <Text style={z.heroTitle}>Um membro extra na sua equipe</Text>
        <Text style={z.heroDesc}>Seu Analista de Negocios esta disponivel para configuracao, leitura de dados, acompanhamento de prazos, duvidas e suporte tecnico.</Text>
        <View style={z.heroStats}>
          <View style={z.heroStat}>
            <Text style={z.heroStatValue}>2h</Text>
            <Text style={z.heroStatLabel}>Tempo resposta</Text>
          </View>
          <View style={z.heroStatDivider} />
          <View style={z.heroStat}>
            <Text style={z.heroStatValue}>Seg-Sab</Text>
            <Text style={z.heroStatLabel}>8h as 18h</Text>
          </View>
          <View style={z.heroStatDivider} />
          <View style={z.heroStat}>
            <Text style={[z.heroStatValue, { color: Colors.green }]}>Incluso</Text>
            <Text style={z.heroStatLabel}>No plano</Text>
          </View>
        </View>
      </View>

      {/* Contact buttons */}
      <View style={z.contactRow}>
        <Pressable onPress={openWhatsApp} style={[z.contactBtn, { backgroundColor: "#25D366" }]}>
          <Icon name="message" size={18} color="#fff" />
          <Text style={z.contactBtnText}>Falar com Analista</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL("mailto:" + AURA_EMAIL)} style={[z.contactBtn, { backgroundColor: Colors.violet }]}>
          <Icon name="globe" size={18} color="#fff" />
          <Text style={z.contactBtnText}>Enviar e-mail</Text>
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

      {/* Messages — starts empty */}
      <View style={z.chatCard}>
        {messages.length === 0 && (
          <View style={z.chatEmpty}>
            <Icon name="message" size={24} color={Colors.ink3 + "44"} />
            <Text style={z.chatEmptyText}>Nenhuma mensagem ainda.</Text>
            <Text style={z.chatEmptyHint}>Envie uma mensagem ou use os atalhos acima para iniciar uma conversa com seu analista.</Text>
          </View>
        )}
        {messages.map(msg => {
          const isAnalyst = msg.from === "analyst";
          return (
            <View key={msg.id} style={[z.bubble, isAnalyst ? z.bubbleAnalyst : z.bubbleUser]}>
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
        })}
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
  content: { padding: IS_WIDE ? 32 : 16, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%", overflow: "hidden" as any },
  heroCard: { backgroundColor: Colors.violetD, borderRadius: 20, padding: IS_WIDE ? 28 : 20, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginBottom: 20, gap: 10, overflow: "hidden" as any },
  heroIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  heroTitle: { fontSize: IS_WIDE ? 20 : 18, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  heroDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 400 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 8, gap: IS_WIDE ? 0 : 8 },
  heroStat: { alignItems: "center", paddingHorizontal: IS_WIDE ? 20 : 12, paddingVertical: IS_WIDE ? 0 : 6, gap: 2 },
  heroStatValue: { fontSize: IS_WIDE ? 16 : 14, fontWeight: "800", color: Colors.ink },
  heroStatLabel: { fontSize: 10, color: Colors.ink3 },
  heroStatDivider: { width: IS_WIDE ? 1 : 0, height: IS_WIDE ? 32 : 0, backgroundColor: Colors.border },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  contactBtn: { flex: 1, minWidth: 140, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  contactBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink, marginBottom: 12 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  quickBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  quickText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chatCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: IS_WIDE ? 16 : 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, gap: 12, minHeight: 120 },
  chatEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 6 },
  chatEmptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  chatEmptyHint: { fontSize: 11, color: Colors.ink3 + "88", textAlign: "center", maxWidth: 280 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 14, gap: 4 },
  bubbleAnalyst: { alignSelf: "flex-start", backgroundColor: Colors.bg4 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Colors.violet },
  analystHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  analystAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  analystName: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  bubbleText: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  bubbleTime: { fontSize: 9, color: Colors.ink3, alignSelf: "flex-end" },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  replyInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
});
