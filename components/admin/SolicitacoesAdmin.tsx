import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";

var API = "https://aura-backend-production-f805.up.railway.app/api/v1";

var CAT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  suporte: { label: "Suporte", icon: "help", color: Colors.violet3 },
  dominio: { label: "Dominio", icon: "link", color: "#06B6D4" },
  modulo: { label: "Modulo", icon: "grid", color: "#F59E0B" },
  consultoria: { label: "Consultoria", icon: "calendar", color: "#10B981" },
  bug: { label: "Bug", icon: "alert", color: "#EF4444" },
  outro: { label: "Outro", icon: "dots", color: Colors.ink3 },
};

var STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  aberto: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Aberto" },
  em_andamento: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED", label: "Em andamento" },
  respondido: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Respondido" },
  fechado: { bg: "rgba(107,114,128,0.12)", color: "#6B7280", label: "Fechado" },
};

var PRI_COLORS: Record<string, string> = { urgente: "#EF4444", alta: "#F59E0B", normal: "#6B7280", baixa: "#9CA3AF" };

export function SolicitacoesAdmin() {
  var { token, isStaff } = useAuthStore();
  var qc = useQueryClient();
  var [selected, setSelected] = useState<string | null>(null);
  var [reply, setReply] = useState("");
  var [filterStatus, setFilterStatus] = useState<string>("");
  var [filterCat, setFilterCat] = useState<string>("");

  // Fetch all tickets
  var { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-tickets", filterStatus, filterCat],
    queryFn: async function() {
      var params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCat) params.set("category", filterCat);
      var res = await fetch(API + "/admin/tickets?" + params.toString(), { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!token && isStaff,
    staleTime: 15000,
  });

  // Fetch selected ticket conversation
  var { data: convoData, isLoading: convoLoading } = useQuery({
    queryKey: ["admin-ticket-detail", selected],
    queryFn: async function() {
      var res = await fetch(API + "/admin/tickets/" + selected, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!selected && !!token,
    staleTime: 10000,
  });

  // Reply mutation
  var replyMut = useMutation({
    mutationFn: async function(vars: { tid: string; message: string }) {
      var res = await fetch(API + "/admin/tickets/" + vars.tid + "/messages", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ message: vars.message }),
      });
      if (!res.ok) throw new Error("Erro ao enviar");
      return res.json();
    },
    onSuccess: function() { setReply(""); qc.invalidateQueries({ queryKey: ["admin-ticket-detail", selected] }); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); toast.success("Resposta enviada"); },
    onError: function() { toast.error("Erro ao enviar resposta"); },
  });

  // Status change mutation
  var statusMut = useMutation({
    mutationFn: async function(vars: { tid: string; status: string }) {
      var res = await fetch(API + "/admin/tickets/" + vars.tid, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: vars.status }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["admin-tickets"] }); qc.invalidateQueries({ queryKey: ["admin-ticket-detail"] }); toast.success("Status atualizado"); },
  });

  if (isLoading) return <ListSkeleton rows={3} showCards />;

  var tickets = data?.tickets || [];
  var summary = data?.summary || { aberto: 0, em_andamento: 0, respondido: 0, fechado: 0 };
  var domainPending = data?.domain_requests_pending || 0;
  var messages = convoData?.messages || [];
  var ticketDetail = convoData?.ticket;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <Pressable style={s.kpi} onPress={function() { setFilterStatus(filterStatus === 'aberto' ? '' : 'aberto'); }}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{summary.aberto}</Text><Text style={s.kpiLbl}>Abertos</Text></Pressable>
        <Pressable style={s.kpi} onPress={function() { setFilterStatus(filterStatus === 'em_andamento' ? '' : 'em_andamento'); }}><Text style={[s.kpiVal, { color: "#7C3AED" }]}>{summary.em_andamento}</Text><Text style={s.kpiLbl}>Em andamento</Text></Pressable>
        <Pressable style={s.kpi} onPress={function() { setFilterStatus(filterStatus === 'respondido' ? '' : 'respondido'); }}><Text style={[s.kpiVal, { color: "#10B981" }]}>{summary.respondido}</Text><Text style={s.kpiLbl}>Respondidos</Text></Pressable>
        {domainPending > 0 && <View style={[s.kpi, { borderColor: '#06B6D4' }]}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{domainPending}</Text><Text style={s.kpiLbl}>Dominios</Text></View>}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
        {['', 'suporte', 'dominio', 'modulo', 'bug', 'consultoria'].map(function(c) {
          var active = filterCat === c;
          return <Pressable key={c} onPress={function() { setFilterCat(c); }} style={[s.filterChip, active && s.filterChipActive]}><Text style={[s.filterChipText, active && s.filterChipTextActive]}>{c ? (CAT_LABELS[c]?.label || c) : 'Todas'}</Text></Pressable>;
        })}
      </ScrollView>

      {/* Split view: ticket list + conversation */}
      <View style={{ flexDirection: IS_WIDE ? "row" : "column", gap: 12 }}>
        {/* Ticket list */}
        <View style={{ flex: 1, minWidth: IS_WIDE ? 350 : undefined }}>
          {tickets.length === 0 && <HoverCard style={s.card}><Text style={{ color: Colors.ink3, textAlign: 'center', paddingVertical: 20 }}>Nenhuma solicitacao{filterStatus ? ' com status "' + filterStatus + '"' : ''}</Text></HoverCard>}
          {tickets.map(function(t: any) {
            var st = STATUS_COLORS[t.status] || STATUS_COLORS.aberto;
            var cat = CAT_LABELS[t.category] || CAT_LABELS.outro;
            var isSelected = selected === t.id;
            var dateStr = new Date(t.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <Pressable key={t.id} onPress={function() { setSelected(isSelected ? null : t.id); }}>
                <View style={[s.ticket, isSelected && { borderColor: Colors.violet }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.catDot, { backgroundColor: cat.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.ticketCompany}>{t.company_name || 'Empresa'}</Text>
                      <Text style={s.ticketSubject}>{t.subject}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeT, { color: st.color }]}>{st.label}</Text></View>
                  </View>
                  <Text style={s.ticketPreview} numberOfLines={1}>{t.last_message || 'Sem mensagens'}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={s.ticketTime}>{dateStr} - {t.user_name || t.user_email}</Text>
                    {t.last_sender === 'client' && t.status !== 'fechado' && <View style={s.needsReply}><Text style={s.needsReplyT}>Aguardando</Text></View>}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Conversation panel */}
        {selected && (
          <View style={{ flex: IS_WIDE ? 1.2 : 1 }}>
            <HoverCard style={s.convoCard}>
              {convoLoading ? <ActivityIndicator color={Colors.violet} /> : (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={s.convoTitle}>{ticketDetail?.subject}</Text>
                      <Text style={s.convoMeta}>{ticketDetail?.company_name} - {ticketDetail?.user_name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {ticketDetail?.status !== 'fechado' && <Pressable style={s.statusBtn} onPress={function() { statusMut.mutate({ tid: selected, status: 'em_andamento' }); }}><Text style={s.statusBtnT}>Em andamento</Text></Pressable>}
                      {ticketDetail?.status !== 'fechado' && <Pressable style={[s.statusBtn, { borderColor: Colors.green }]} onPress={function() { statusMut.mutate({ tid: selected, status: 'fechado' }); }}><Text style={[s.statusBtnT, { color: Colors.green }]}>Fechar</Text></Pressable>}
                    </View>
                  </View>

                  {/* Messages */}
                  <ScrollView style={{ maxHeight: 400 }}>
                    {messages.map(function(m: any) {
                      var isAdmin = m.sender_role === 'admin';
                      return (
                        <View key={m.id} style={[s.msgRow, isAdmin && s.msgRowAdmin]}>
                          <View style={[s.msgBubble, isAdmin ? s.msgBubbleAdmin : s.msgBubbleClient]}>
                            <Text style={[s.msgSender, { color: isAdmin ? Colors.violet3 : Colors.ink2 }]}>{isAdmin ? 'Aura' : m.sender_name}</Text>
                            <Text style={s.msgText}>{m.message}</Text>
                            <Text style={s.msgTime}>{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Reply box */}
                  {ticketDetail?.status !== 'fechado' && (
                    <View style={s.replyBox}>
                      <TextInput value={reply} onChangeText={setReply} placeholder="Responder como Analista Aura..." placeholderTextColor={Colors.ink3} multiline style={s.replyInput} />
                      <Pressable style={[s.replyBtn, !reply.trim() && { opacity: 0.5 }]} onPress={function() { if (reply.trim()) replyMut.mutate({ tid: selected, message: reply.trim() }); }} disabled={!reply.trim() || replyMut.isPending}>
                        <Text style={s.replyBtnText}>{replyMut.isPending ? 'Enviando...' : 'Enviar'}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </HoverCard>
          </View>
        )}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  kpiVal: { fontSize: 22, fontWeight: "800" },
  kpiLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  filterChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterChipTextActive: { color: "#fff", fontWeight: "600" },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  ticket: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6, marginBottom: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  ticketCompany: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  ticketSubject: { fontSize: 12, color: Colors.ink2, marginTop: 2 },
  ticketPreview: { fontSize: 12, color: Colors.ink3, fontStyle: "italic" },
  ticketTime: { fontSize: 10, color: Colors.ink3 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeT: { fontSize: 10, fontWeight: "600" },
  needsReply: { backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  needsReplyT: { fontSize: 9, color: "#F59E0B", fontWeight: "600" },
  convoCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  convoTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  convoMeta: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  statusBtn: { borderWidth: 1, borderColor: Colors.violet, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  statusBtnT: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  msgRow: { marginBottom: 8, alignItems: 'flex-start' },
  msgRowAdmin: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: "80%", borderRadius: 14, padding: 12, gap: 4 },
  msgBubbleClient: { backgroundColor: Colors.bg4, borderBottomLeftRadius: 4 },
  msgBubbleAdmin: { backgroundColor: Colors.violetD, borderBottomRightRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: "600" },
  msgText: { fontSize: 13, color: Colors.ink, lineHeight: 20 },
  msgTime: { fontSize: 9, color: Colors.ink3, alignSelf: 'flex-end' },
  replyBox: { marginTop: 12, gap: 8, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 12 },
  replyInput: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, fontSize: 13, color: Colors.ink, minHeight: 60, textAlignVertical: "top" },
  replyBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  replyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
