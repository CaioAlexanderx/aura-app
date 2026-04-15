import { useState } from "react";
import { View, Text, ScrollView, TextInput, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { ScreenHeader } from "@/components/ScreenHeader";
import { HoverCard } from "@/components/HoverCard";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";

var API = "https://aura-backend-production-f805.up.railway.app/api/v1";
var AURA_WA = "5512991234567"; // WhatsApp Aura
var AURA_EMAIL = "suporte@getaura.com.br";

var CATEGORIES = [
  { key: "suporte", label: "Duvida ou ajuda", icon: "help", desc: "Tire duvidas sobre o uso da plataforma" },
  { key: "dominio", label: "Solicitar dominio", icon: "link", desc: "Solicite um dominio personalizado para seu Canal Digital" },
  { key: "consultoria", label: "Agendar consultoria", icon: "calendar", desc: "Agende uma consultoria com nosso analista" },
  { key: "bug", label: "Reportar problema", icon: "alert", desc: "Encontrou um erro? Nos avise" },
];

var STATUS_LABELS: Record<string, { color: string; label: string }> = {
  aberto: { color: "#F59E0B", label: "Aberto" },
  em_andamento: { color: "#7C3AED", label: "Em andamento" },
  respondido: { color: "#10B981", label: "Respondido" },
  fechado: { color: "#6B7280", label: "Fechado" },
};

export default function SuporteScreen() {
  var { company, token, user } = useAuthStore();
  var cid = company?.id;
  var qc = useQueryClient();
  var [view, setView] = useState<'home' | 'new' | 'chat'>('home');
  var [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  var [newCategory, setNewCategory] = useState('suporte');
  var [newSubject, setNewSubject] = useState('');
  var [newMessage, setNewMessage] = useState('');
  var [chatReply, setChatReply] = useState('');

  // Fetch tickets
  var { data, isLoading } = useQuery({
    queryKey: ["support-tickets", cid],
    queryFn: async function() {
      var res = await fetch(API + "/companies/" + cid + "/support/tickets", { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!cid && !!token,
    staleTime: 15000,
  });

  // Fetch conversation
  var { data: convo, isLoading: convoLoading } = useQuery({
    queryKey: ["support-ticket", selectedTicket],
    queryFn: async function() {
      var res = await fetch(API + "/companies/" + cid + "/support/tickets/" + selectedTicket, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!selectedTicket && !!cid && !!token,
    staleTime: 10000,
  });

  // Create ticket
  var createMut = useMutation({
    mutationFn: async function() {
      var metadata: any = {};
      if (newCategory === 'dominio') { metadata.domain_type = 'custom'; metadata.plan_price = 'R$80/ano'; }
      var res = await fetch(API + "/companies/" + cid + "/support/tickets", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ subject: newSubject, message: newMessage, category: newCategory, metadata: metadata }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: function(data: any) {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Solicitacao enviada!");
      setNewSubject(''); setNewMessage(''); setSelectedTicket(data.ticket.id); setView('chat');
    },
    onError: function() { toast.error("Erro ao enviar"); },
  });

  // Send message
  var replyMut = useMutation({
    mutationFn: async function() {
      var res = await fetch(API + "/companies/" + cid + "/support/tickets/" + selectedTicket + "/messages", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ message: chatReply }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: function() { setChatReply(''); qc.invalidateQueries({ queryKey: ["support-ticket", selectedTicket] }); },
    onError: function() { toast.error("Erro ao enviar"); },
  });

  var tickets = data?.tickets || [];
  var messages = convo?.messages || [];
  var ticket = convo?.ticket;
  var plan = company?.plan || 'essencial';
  var isNegocio = plan === 'negocio' || plan === 'expansao';

  function openChat(tid: string) { setSelectedTicket(tid); setView('chat'); }

  // HOME view
  if (view === 'home') {
    return (
      <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
        <ScreenHeader title="Seu Analista de Negocios" />

        {/* Welcome card */}
        <HoverCard style={s.welcomeCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.analystAvatar}><Text style={s.analystAvatarT}>A</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.welcomeTitle}>Ola, {user?.full_name?.split(' ')[0] || 'voce'}!</Text>
              <Text style={s.welcomeDesc}>{isNegocio ? 'Seu analista de negocios esta disponivel para ajudar com configuracao, leitura de dados, duvidas e suporte.' : 'Precisa de ajuda? Nossa equipe de suporte esta pronta para atender.'}</Text>
            </View>
          </View>
          <View style={s.contactRow}>
            <Pressable style={s.contactBtn} onPress={function() { Linking.openURL('mailto:' + AURA_EMAIL); }}><Icon name="mail" size={14} color={Colors.violet3} /><Text style={s.contactBtnT}>Email</Text></Pressable>
            <Pressable style={s.contactBtn} onPress={function() { Linking.openURL('https://wa.me/' + AURA_WA); }}><Icon name="phone" size={14} color="#10B981" /><Text style={s.contactBtnT}>WhatsApp</Text></Pressable>
            <Pressable style={[s.contactBtn, { backgroundColor: Colors.violet }]} onPress={function() { setView('new'); }}><Icon name="chat" size={14} color="#fff" /><Text style={[s.contactBtnT, { color: '#fff' }]}>Nova solicitacao</Text></Pressable>
          </View>
        </HoverCard>

        {/* Quick actions */}
        <Text style={s.sectionTitle}>Como posso ajudar?</Text>
        <View style={s.catGrid}>
          {CATEGORIES.map(function(c) {
            return (
              <Pressable key={c.key} style={s.catCard} onPress={function() { setNewCategory(c.key); setView('new'); }}>
                <Icon name={c.icon as any} size={20} color={Colors.violet3} />
                <Text style={s.catLabel}>{c.label}</Text>
                <Text style={s.catDesc}>{c.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ticket history */}
        {tickets.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Minhas solicitacoes</Text>
            {tickets.map(function(t: any) {
              var st = STATUS_LABELS[t.status] || STATUS_LABELS.aberto;
              return (
                <Pressable key={t.id} onPress={function() { openChat(t.id); }}>
                  <View style={s.ticketRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.ticketSubject}>{t.subject}</Text>
                      <Text style={s.ticketPreview} numberOfLines={1}>{t.last_message}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[s.statusBadge, { backgroundColor: st.color + '18' }]}><Text style={[s.statusBadgeT, { color: st.color }]}>{st.label}</Text></View>
                      {(t.new_replies || 0) > 0 && <View style={s.unreadBadge}><Text style={s.unreadBadgeT}>{t.new_replies}</Text></View>}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  // NEW ticket view
  if (view === 'new') {
    var catInfo = CATEGORIES.find(function(c) { return c.key === newCategory; });
    return (
      <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Pressable onPress={function() { setView('home'); }}><Icon name="arrow_left" size={20} color={Colors.ink} /></Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.ink }}>Nova solicitacao</Text>
        </View>

        <HoverCard style={s.formCard}>
          <Text style={s.formLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map(function(c) {
              var active = newCategory === c.key;
              return <Pressable key={c.key} onPress={function() { setNewCategory(c.key); if (c.key === 'dominio') setNewSubject('Solicitar dominio personalizado'); }} style={[s.catChip, active && s.catChipActive]}><Text style={[s.catChipT, active && s.catChipTActive]}>{c.label}</Text></Pressable>;
            })}
          </ScrollView>

          <Text style={s.formLabel}>Assunto</Text>
          <TextInput value={newSubject} onChangeText={setNewSubject} placeholder={newCategory === 'dominio' ? 'Ex: meudominio.com.br' : 'Descreva brevemente'} placeholderTextColor={Colors.ink3} style={s.formInput} />

          <Text style={s.formLabel}>Mensagem</Text>
          <TextInput value={newMessage} onChangeText={setNewMessage} placeholder={newCategory === 'dominio' ? 'Qual dominio deseja? Ja possui registro?' : 'Descreva sua duvida ou solicitacao...'} placeholderTextColor={Colors.ink3} multiline style={[s.formInput, { minHeight: 100, textAlignVertical: 'top' }]} />

          {newCategory === 'dominio' && (
            <View style={s.domainInfo}>
              <Icon name="info" size={14} color="#06B6D4" />
              <Text style={s.domainInfoT}>Dominio personalizado: R$ 80/ano ou R$ 152/2 anos. Voce pode trazer um dominio existente ou registraremos um novo.</Text>
            </View>
          )}

          <Pressable style={[s.submitBtn, (!newSubject.trim() || !newMessage.trim()) && { opacity: 0.5 }]} onPress={function() { if (newSubject.trim() && newMessage.trim()) createMut.mutate(); }} disabled={!newSubject.trim() || !newMessage.trim() || createMut.isPending}>
            <Text style={s.submitBtnT}>{createMut.isPending ? 'Enviando...' : 'Enviar solicitacao'}</Text>
          </Pressable>
        </HoverCard>
      </ScrollView>
    );
  }

  // CHAT view
  return (
    <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Pressable onPress={function() { setView('home'); setSelectedTicket(null); }}><Icon name="arrow_left" size={20} color={Colors.ink} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ink }}>{ticket?.subject || 'Conversa'}</Text>
          {ticket && <Text style={{ fontSize: 11, color: Colors.ink3 }}>{(STATUS_LABELS[ticket.status] || STATUS_LABELS.aberto).label}</Text>}
        </View>
      </View>

      {convoLoading ? <ListSkeleton rows={3} /> : (
        <View style={s.chatContainer}>
          {messages.map(function(m: any) {
            var isMe = m.sender_role === 'client';
            return (
              <View key={m.id} style={[s.chatRow, isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <View style={[s.chatBubble, isMe ? s.chatBubbleMe : s.chatBubbleThem]}>
                  {!isMe && <Text style={s.chatSender}>Analista Aura</Text>}
                  <Text style={s.chatText}>{m.message}</Text>
                  <Text style={s.chatTime}>{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            );
          })}

          {messages.length === 0 && <Text style={{ color: Colors.ink3, textAlign: 'center', paddingVertical: 20 }}>Aguardando resposta do analista...</Text>}

          {ticket?.status !== 'fechado' && (
            <View style={s.chatInputRow}>
              <TextInput value={chatReply} onChangeText={setChatReply} placeholder="Digite sua mensagem..." placeholderTextColor={Colors.ink3} style={s.chatInput} multiline />
              <Pressable style={[s.chatSendBtn, !chatReply.trim() && { opacity: 0.5 }]} onPress={function() { if (chatReply.trim()) replyMut.mutate(); }} disabled={!chatReply.trim() || replyMut.isPending}>
                <Icon name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
          {ticket?.status === 'fechado' && <View style={s.closedBanner}><Text style={s.closedBannerT}>Esta solicitacao foi encerrada.</Text></View>}
        </View>
      )}
    </ScrollView>
  );
}

var s = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 700, alignSelf: "center", width: "100%" },
  welcomeCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  analystAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.violet, alignItems: 'center', justifyContent: 'center' },
  analystAvatarT: { color: '#fff', fontSize: 20, fontWeight: '800' },
  welcomeTitle: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  welcomeDesc: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginTop: 4 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 10 },
  contactBtnT: { fontSize: 12, fontWeight: '600', color: Colors.ink },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.ink, marginBottom: 12, marginTop: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  catCard: { width: IS_WIDE ? '48%' : '47%', backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6 } as any,
  catLabel: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  catDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, gap: 12 },
  ticketSubject: { fontSize: 14, fontWeight: '600', color: Colors.ink },
  ticketPreview: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeT: { fontSize: 10, fontWeight: '600' },
  unreadBadge: { backgroundColor: Colors.violet, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeT: { color: '#fff', fontSize: 10, fontWeight: '700' },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  formLabel: { fontSize: 13, fontWeight: '600', color: Colors.ink, marginBottom: 6, marginTop: 8 },
  formInput: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 12, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  catChipT: { fontSize: 12, color: Colors.ink3, fontWeight: '500' },
  catChipTActive: { color: '#fff', fontWeight: '600' },
  domainInfo: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 10, padding: 12, marginTop: 8, alignItems: 'flex-start' },
  domainInfoT: { fontSize: 12, color: '#06B6D4', flex: 1, lineHeight: 18 },
  submitBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitBtnT: { color: '#fff', fontSize: 15, fontWeight: '700' },
  chatContainer: { gap: 8 },
  chatRow: { marginBottom: 4 },
  chatBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 } as any,
  chatBubbleMe: { backgroundColor: Colors.violetD, borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  chatBubbleThem: { backgroundColor: Colors.bg3, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  chatSender: { fontSize: 11, fontWeight: '600', color: Colors.violet3 },
  chatText: { fontSize: 14, color: Colors.ink, lineHeight: 22 },
  chatTime: { fontSize: 9, color: Colors.ink3, alignSelf: 'flex-end' },
  chatInputRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'flex-end' },
  chatInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 12, fontSize: 14, color: Colors.ink, borderWidth: 1, borderColor: Colors.border, maxHeight: 100 },
  chatSendBtn: { backgroundColor: Colors.violet, borderRadius: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closedBanner: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: Colors.border },
  closedBannerT: { fontSize: 13, color: Colors.ink3 },
});
