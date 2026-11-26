// ============================================================
// Hub Social — thread de uma conversa.
// Bolhas (cliente à esquerda, loja à direita) com o autor de cada fala
// (rotuloDoAutor: cliente, equipe ou Aurinha — o eco do celular é equipe),
// cards de sugestão pendente (Aprovar/Editar/Rejeitar — modo aprovação
// do piloto), correção de triagem, transições de estado e composer com
// indicador da janela de 24h da Meta.
// Toque, não hover: toda ação é botão visível (regra do app p/ touch).
// ============================================================
import { useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Image, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { hubApi, type HubCategory } from "@/services/hubApi";
import { CHANNEL_META, STATUS_META, CATEGORY_META, CATEGORIES, windowHoursLeft, conversaAbertaAte, shortTime, displayName, rotuloDoAutor } from "./types";
import { EnvioRapido } from "./EnvioRapido";
import { useMidiaConversa } from "./MidiaConversa";
import { BolhaDeMidia, textoDaBolha } from "./BolhaDeMidia";
import { EtiquetasConversa } from "./EtiquetasConversa";
import { ClienteConversa } from "./ClienteConversa";

export function ThreadView({ companyId, convId, onBack, aurinhaLigada = true }: {
  companyId: string; convId: string; onBack?: () => void;
  /** Aurinha desligada: a equipe atende sozinha — sem "IA atendendo" nem "Devolver à Aurinha". */
  aurinhaLigada?: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hub-thread", companyId, convId],
    queryFn: () => hubApi.messages(companyId, convId),
    refetchInterval: 10000,
  });
  const conv = data?.conversation;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hub-thread", companyId, convId] });
    qc.invalidateQueries({ queryKey: ["hub-conversations", companyId] });
  };

  const mAction = useMutation({
    mutationFn: async (action: () => Promise<any>) => action(),
    onSuccess: invalidate,
    onError: (e: any) => setFeedback(e?.message || "Não foi possível concluir a ação."),
  });

  const mReply = useMutation({
    mutationFn: async (text: string) => {
      // Responder assume a conversa: a Aurinha para de sugerir enquanto
      // você estiver no comando (backend descarta sugestões antigas no envio).
      if (conv && (conv.status === "ia" || conv.status === "precisa_humano")) {
        await hubApi.assume(companyId, convId);
      }
      return hubApi.reply(companyId, convId, text);
    },
    onSuccess: () => { setDraft(""); setFeedback(null); invalidate(); },
    onError: (e: any) => {
      const code = e?.data?.code;
      setFeedback(code === "JANELA_FECHADA"
        ? "Janela de 24h fechada — a Meta só aceita resposta até 24h após a última mensagem do cliente."
        : (e?.message || "Não foi possível enviar."));
    },
  });

  // URL da mídia estável por mensagem: o servidor reassina de tempos em tempos e a
  // thread relê a cada 10 s; trocar o src no meio faria o áudio parar e a foto piscar.
  // Mantém a primeira URL vista por até 25 min (a assinatura vale pelo menos 30).
  const urlsDeMidia = useRef(new Map<string, { url: string; em: number }>());
  const urlEstavel = (id: string, url: string) => {
    const guardada = urlsDeMidia.current.get(id);
    if (guardada && Date.now() - guardada.em < 25 * 60 * 1000) return guardada.url;
    urlsDeMidia.current.set(id, { url, em: Date.now() });
    return url;
  };

  // Foto e áudio (hook antes do return antecipado: a ordem dos hooks não muda).
  const midia = useMidiaConversa({ companyId, convId, onSent: invalidate, onError: (m) => setFeedback(m) });

  if (isLoading || !data || !conv) {
    return <View style={s.center}><ActivityIndicator color={Colors.violet3} /></View>;
  }

  const ch = CHANNEL_META[conv.channel];
  const st = STATUS_META[conv.status];
  const hoursLeft = windowHoursLeft(conv.last_inbound_at);
  // WhatsApp com a conversa aberta: tudo que sai é grátis (mensagem de sessão).
  const abertaAte = conv.channel === "whatsapp" ? conversaAbertaAte(conv.last_inbound_at) : null;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        {onBack && (
          <Pressable onPress={onBack} style={s.backBtn} accessibilityLabel="Voltar para a lista">
            <Text style={s.backText}>‹</Text>
          </Pressable>
        )}
        <View style={[s.avatar, { backgroundColor: ch.color + "33" }]}>
          <Text style={[s.avatarText, { color: ch.color }]}>{displayName(conv.customer_name, conv.external_id).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{displayName(conv.customer_name, conv.external_id)}</Text>
          <Text style={s.sub} numberOfLines={1}>{ch.label}{conv.handoff_reason ? ` · ${conv.handoff_reason}` : ""}</Text>
        </View>
        {(aurinhaLigada || conv.status !== "ia") && (
          <View testID="hub-thread-status" style={[s.statusPill, { backgroundColor: st.color + "22" }]}>
            <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
          </View>
        )}
      </View>

      {abertaAte && (
        <View testID="hub-janela-aberta" style={s.abertaBar}>
          <View style={s.abertaDot} />
          <Text style={s.abertaText}>
            <Text style={s.abertaBold}>Conversa aberta</Text> até {abertaAte} · responder não gasta mensagens
          </Text>
        </View>
      )}

      {/* WhatsApp: cadastro de Clientes ("É ela") e etiquetas */}
      {conv.channel === "whatsapp" && (
        <>
          <ClienteConversa companyId={companyId} convId={convId} onChanged={invalidate} onError={(m) => setFeedback(m)} />
          <EtiquetasConversa companyId={companyId} convId={convId} aplicadas={conv.labels || []}
            onChanged={invalidate} onError={(m) => setFeedback(m)} />
        </>
      )}

      {/* Ações de estado + triagem */}
      <View style={s.actionsRow}>
        {(conv.status === "ia" || conv.status === "precisa_humano") && (
          <Pressable style={s.primaryBtn} onPress={() => mAction.mutate(() => hubApi.assume(companyId, convId))}>
            <Text style={s.primaryBtnText}>Assumir conversa</Text>
          </Pressable>
        )}
        {conv.status === "humano" && aurinhaLigada && (
          <Pressable testID="hub-devolver-aurinha" style={s.ghostBtn} onPress={() => mAction.mutate(() => hubApi.returnToAi(companyId, convId))}>
            <Text style={s.ghostBtnText}>Devolver à Aurinha</Text>
          </Pressable>
        )}
        {conv.status !== "resolvida" && (
          <Pressable style={s.ghostBtn} onPress={() => mAction.mutate(() => hubApi.resolve(companyId, convId))}>
            <Text style={s.ghostBtnText}>Resolver</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const on = conv.category === cat;
          return (
            <Pressable key={cat} onPress={() => mAction.mutate(() => hubApi.setCategory(companyId, convId, on ? null : cat))}
              style={[s.catChip, { borderColor: meta.color + "66" }, on && { backgroundColor: meta.color + "22" }]}>
              <Text style={[s.catChipText, { color: meta.color }]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Mensagens */}
      <ScrollView style={s.msgs} contentContainerStyle={s.msgsContent}>
        {data.messages.map((m) => {
          const mine = m.direction === "outbound";
          const author = rotuloDoAutor(m, conv);
          return (
            <View key={m.id} testID={`hub-msg-${m.id}`} style={[s.bubble, mine ? s.bubbleOut : s.bubbleIn]}>
              {author && <Text testID={`hub-msg-autor-${m.id}`} style={[s.bubbleAuthor, !mine && s.bubbleAuthorIn]}>{author}</Text>}
              {m.tipo === "produto" && m.image_url && (
                <Image testID={`hub-msg-foto-${m.id}`} source={{ uri: m.image_url }} style={s.bubbleFoto} resizeMode="cover" />
              )}
              {m.media?.url ? <BolhaDeMidia testID={`hub-msg-midia-${m.id}`} media={{ ...m.media, url: urlEstavel(m.id, m.media.url) }} /> : null}
              {textoDaBolha(m) != null && <Text style={s.bubbleText}>{textoDaBolha(m)}</Text>}
              <Text style={s.bubbleTime}>{shortTime(m.created_at)}{mine && m.status ? ` · ${m.status}` : ""}</Text>
            </View>
          );
        })}

        {/* Sugestões aguardando aprovação */}
        {data.pending_approvals.map((p) => (
          <View key={p.id} style={s.approvalCard}>
            <Text style={s.approvalTitle}>✦ Resposta sugerida pela Aurinha — aguardando aprovação</Text>
            {editingId === p.id ? (
              <TextInput style={s.approvalInput} value={editText} onChangeText={setEditText}
                multiline placeholderTextColor={Colors.ink3} />
            ) : (
              <Text style={s.approvalText}>{p.edited_body || p.text_body}</Text>
            )}
            <View style={s.approvalActions}>
              {editingId === p.id ? (
                <>
                  <Pressable style={s.primaryBtn}
                    onPress={() => { mAction.mutate(() => hubApi.approve(companyId, p.id, editText.trim())); setEditingId(null); }}>
                    <Text style={s.primaryBtnText}>Enviar editada</Text>
                  </Pressable>
                  <Pressable style={s.ghostBtn} onPress={() => setEditingId(null)}>
                    <Text style={s.ghostBtnText}>Cancelar</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={s.primaryBtn} onPress={() => mAction.mutate(() => hubApi.approve(companyId, p.id))}>
                    <Text style={s.primaryBtnText}>Aprovar e enviar</Text>
                  </Pressable>
                  <Pressable style={s.ghostBtn} onPress={() => { setEditingId(p.id); setEditText(p.text_body); }}>
                    <Text style={s.ghostBtnText}>Editar</Text>
                  </Pressable>
                  <Pressable style={s.ghostBtn} onPress={() => mAction.mutate(() => hubApi.reject(companyId, p.id))}>
                    <Text style={[s.ghostBtnText, { color: Colors.red }]}>Rejeitar</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Feedback + composer */}
      {feedback && (
        <View style={s.feedback}>
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.feedbackText}>{feedback}</Text>
        </View>
      )}
      {abertaAte && (
        <EnvioRapido companyId={companyId} convId={convId} onSent={invalidate}
          onError={(msg) => setFeedback(msg)} extras={midia.botoes} painelExtra={midia.painel} />
      )}
      <View style={s.composer}>
        <TextInput
          style={s.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={conv.status === "ia" ? "Digitar aqui assume a conversa…" : "Escreva sua resposta…"}
          placeholderTextColor={Colors.ink3}
          onSubmitEditing={() => draft.trim() && mReply.mutate(draft.trim())}
        />
        <Pressable
          style={[s.primaryBtn, (!draft.trim() || mReply.isPending) && { opacity: 0.5 }]}
          disabled={!draft.trim() || mReply.isPending}
          onPress={() => mReply.mutate(draft.trim())}>
          <Text style={s.primaryBtnText}>{mReply.isPending ? "..." : "Enviar"}</Text>
        </Pressable>
      </View>
      {!abertaAte && (
        <Text style={s.windowText}>
          {hoursLeft != null
            ? `Janela de resposta: ${Math.floor(hoursLeft)} h restantes`
            : "Janela de 24h fechada — aguarde o cliente escrever de novo"}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, minHeight: 480 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  backText: { fontSize: 26, color: Colors.ink2, lineHeight: 28 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", paddingVertical: 10 },
  primaryBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7 },
  primaryBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  ghostBtnText: { color: Colors.ink2, fontSize: 12.5, fontWeight: "600" },
  catChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  catChipText: { fontSize: 10.5, fontWeight: "700" },
  msgs: { flex: 1 },
  msgsContent: { paddingVertical: 12, gap: 8 },
  bubble: { maxWidth: "78%", borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleIn: { alignSelf: "flex-start", backgroundColor: Colors.bg4, borderBottomLeftRadius: 4 },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: Colors.violet + "2e", borderWidth: 1, borderColor: Colors.violet + "44", borderBottomRightRadius: 4 },
  bubbleAuthor: { fontSize: 9.5, fontWeight: "800", color: Colors.violet3, letterSpacing: 0.5, marginBottom: 3 },
  bubbleAuthorIn: { color: Colors.ink2, letterSpacing: 0 },
  bubbleText: { fontSize: 13.5, color: Colors.ink, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: Colors.ink3, marginTop: 4, alignSelf: "flex-end" },
  approvalCard: { alignSelf: "flex-end", maxWidth: "84%", borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.violet3 + "88", borderRadius: 13, padding: 12, backgroundColor: Colors.violet + "14", gap: 8 },
  approvalTitle: { fontSize: 11, fontWeight: "800", color: Colors.violet3 },
  approvalText: { fontSize: 13.5, color: Colors.ink, lineHeight: 19 },
  approvalInput: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, padding: 10, fontSize: 13.5, color: Colors.ink, minHeight: 70, textAlignVertical: "top" },
  approvalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  feedback: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  feedbackText: { fontSize: 12, color: Colors.amber, flex: 1 },
  composer: { flexDirection: "row", gap: 8, alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  composerInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg3 },
  abertaBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10, marginTop: 8, borderRadius: 9, backgroundColor: Colors.green + "14" },
  abertaDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  abertaText: { fontSize: 12, color: Colors.ink2, flex: 1 },
  abertaBold: { fontWeight: "800", color: Colors.green },
  bubbleFoto: { width: 200, height: 200, maxWidth: "100%", borderRadius: 9, marginBottom: 6, backgroundColor: Colors.bg3 },
  windowText: { fontSize: 10.5, color: Colors.ink3, marginTop: 6 },
});
