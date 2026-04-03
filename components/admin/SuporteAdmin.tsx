import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { HoverCard } from "@/components/HoverCard";

// VER-03c: Support inbox (chat with clients)

const MOCK_TICKETS = [
  { id: "1", client: "Barbearia do Marcos", subject: "Duvida sobre comissoes", status: "aberto", priority: "normal", createdAt: "Hoje 09:30", lastMessage: "Como configuro comissao diferente por servico?", unread: true },
  { id: "2", client: "Clinica Sorriso", subject: "Modulo odonto nao aparece", status: "aberto", priority: "alta", createdAt: "Hoje 08:15", lastMessage: "Ativei o modulo mas nao aparece na sidebar", unread: true },
  { id: "3", client: "Pet Love Jacarei", subject: "Emissao NF-e", status: "respondido", priority: "normal", createdAt: "Ontem 16:00", lastMessage: "Obrigado, funcionou!", unread: false },
  { id: "4", client: "Loja Moda Bella", subject: "Upgrade para Negocio", status: "respondido", priority: "baixa", createdAt: "02/04 14:20", lastMessage: "Vou pensar e volto a falar", unread: false },
  { id: "5", client: "Restaurante Sabor", subject: "Pagamento atrasado", status: "aberto", priority: "alta", createdAt: "01/04 11:00", lastMessage: "Boleto nao chegou", unread: false },
];

const PRIORITY: Record<string, { bg: string; color: string }> = {
  alta:   { bg: "rgba(239,68,68,0.12)",  color: "#EF4444" },
  normal: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  baixa:  { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF" },
};

export function SuporteAdmin() {
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const open = MOCK_TICKETS.filter(t => t.status === "aberto").length;
  const unread = MOCK_TICKETS.filter(t => t.unread).length;

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{open}</Text><Text style={s.kpiLbl}>Abertos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{unread}</Text><Text style={s.kpiLbl}>Nao lidos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{MOCK_TICKETS.length - open}</Text><Text style={s.kpiLbl}>Respondidos</Text></View>
      </View>

      {MOCK_TICKETS.map(t => {
        const pri = PRIORITY[t.priority] || PRIORITY.normal;
        const isOpen = selected === t.id;
        return (
          <Pressable key={t.id} onPress={() => setSelected(isOpen ? null : t.id)}>
            <View style={[s.ticket, t.unread && s.ticketUnread]}>
              <View style={s.ticketHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ticketClient}>{t.client}</Text>
                  <Text style={s.ticketSubject}>{t.subject}</Text>
                </View>
                <View style={[s.priBadge, { backgroundColor: pri.bg }]}>
                  <Text style={[s.priBadgeT, { color: pri.color }]}>{t.priority}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: t.status === "aberto" ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)" }]}>
                  <Text style={[s.statusBadgeT, { color: t.status === "aberto" ? "#F59E0B" : "#10B981" }]}>{t.status === "aberto" ? "Aberto" : "Respondido"}</Text>
                </View>
              </View>
              <Text style={s.ticketPreview}>{t.lastMessage}</Text>
              <Text style={s.ticketTime}>{t.createdAt}</Text>

              {isOpen && (
                <View style={s.replyBox}>
                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    placeholder="Escreva uma resposta..."
                    placeholderTextColor={Colors.ink3}
                    multiline
                    style={s.replyInput}
                  />
                  <View style={s.replyActions}>
                    <Pressable style={s.replyBtn}><Text style={s.replyBtnText}>Enviar resposta</Text></Pressable>
                    <Pressable style={s.closeBtn}><Text style={s.closeBtnText}>Fechar ticket</Text></Pressable>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  kpiVal: { fontSize: 22, fontWeight: "800" },
  kpiLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },
  ticket: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  ticketUnread: { borderLeftWidth: 3, borderLeftColor: "#F59E0B" },
  ticketHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketClient: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  ticketSubject: { fontSize: 12, color: Colors.ink2, marginTop: 2 },
  priBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priBadgeT: { fontSize: 9, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeT: { fontSize: 9, fontWeight: "600" },
  ticketPreview: { fontSize: 13, color: Colors.ink2, fontStyle: "italic" },
  ticketTime: { fontSize: 10, color: Colors.ink3 },
  replyBox: { marginTop: 8, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border, gap: 8 },
  replyInput: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, fontSize: 13, color: Colors.ink, minHeight: 60, textAlignVertical: "top" },
  replyActions: { flexDirection: "row", gap: 8 },
  replyBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  replyBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  closeBtn: { borderWidth: 0.5, borderColor: Colors.green, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  closeBtnText: { color: Colors.green, fontSize: 12, fontWeight: "500" },
});
