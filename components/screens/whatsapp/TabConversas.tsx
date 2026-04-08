import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { Conversation, Message } from "./types";
import { toast } from "@/components/Toast";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

type Props = { conversations: Conversation[]; messages: Message[]; onSend: (id: string, text: string) => void };

export function TabConversas({ conversations, messages, onSend }: Props) {
  const [selectedId, setSelectedId] = useState(conversations[1]?.id || conversations[0]?.id);
  const [filter, setFilter] = useState("all");
  const [replyText, setReplyText] = useState("");
  const selected = conversations.find(c => c.id === selectedId);
  const filters = ["all", "open", "auto", "resolved"] as const;
  const filterLabels = { all: "Todas", open: "Abertas", auto: "Automaticas", resolved: "Resolvidas" };
  const filtered = filter === "all" ? conversations : conversations.filter(c => c.status === filter);

  return (
    <View style={IS_WIDE ? s.layout : { gap: 16 }}>
      <View style={s.list}>
        <View style={s.filterRow}>{filters.map(f => <Pressable key={f} onPress={() => setFilter(f)} style={[s.filterBtn, filter === f && s.filterBtnActive]}><Text style={[s.filterText, filter === f && s.filterTextActive]}>{filterLabels[f]}</Text></Pressable>)}</View>
        <View style={s.card}>
          {filtered.map(conv => (
            <Pressable key={conv.id} onPress={() => setSelectedId(conv.id)} style={[s.convRow, selectedId === conv.id && s.convRowActive]}>
              <View style={[s.avatar, conv.unread > 0 && { borderColor: Colors.green, borderWidth: 2 }]}><Text style={s.avatarText}>{conv.avatar}</Text></View>
              <View style={s.convInfo}>
                <View style={s.convTop}><Text style={s.convName} numberOfLines={1}>{conv.name}</Text><Text style={s.convTime}>{conv.time}</Text></View>
                <View style={s.convBottom}>
                  <Text style={s.convMsg} numberOfLines={1}>{conv.lastMsg}</Text>
                  {conv.unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{conv.unread}</Text></View>}
                  {conv.status === "auto" && <View style={s.autoBadge}><Text style={s.autoText}>Auto</Text></View>}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {selected && (
        <View style={s.chatView}>
          <View style={s.chatHeader}>
            <View style={s.chatHeaderLeft}><View style={s.chatAvatar}><Text style={s.chatAvatarText}>{selected.avatar}</Text></View><View><Text style={s.chatName}>{selected.name}</Text><Text style={s.chatPhone}>{selected.phone}</Text></View></View>
            <Pressable onPress={() => toast.info("Abrir ficha do cliente")} style={s.chatAction}><Text style={s.chatActionText}>Ver ficha</Text></Pressable>
          </View>
          <View style={s.messagesArea}>
            {messages.map(msg => (
              <View key={msg.id} style={[s.msgBubble, msg.from === "client" ? s.msgClient : s.msgUser, msg.auto && s.msgAuto]}>
                {msg.auto && <Text style={s.msgAutoLabel}>Resposta automatica</Text>}
                <Text style={s.msgText}>{msg.text}</Text>
                <Text style={s.msgTime}>{msg.time}</Text>
              </View>
            ))}
          </View>
          <View style={s.replyBar}>
            <TextInput style={s.replyInput} value={replyText} onChangeText={setReplyText} placeholder="Digitar mensagem..." placeholderTextColor={Colors.ink3} />
            <Pressable onPress={() => { if (replyText.trim()) { onSend(selected.id, replyText); setReplyText(""); } }} style={s.sendBtn}><Text style={s.sendBtnText}>{'>'}</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  layout: { flexDirection: "row", gap: 16 },
  list: { width: IS_WIDE ? 320 : "100%" },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  filterTextActive: { color: Colors.violet3, fontWeight: "600" },
  convRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  convRowActive: { backgroundColor: Colors.violetD, borderRadius: 10, marginHorizontal: -8, paddingHorizontal: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  convInfo: { flex: 1, gap: 4 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 14, fontWeight: "600", color: Colors.ink, flex: 1 },
  convTime: { fontSize: 10, color: Colors.ink3 },
  convBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  convMsg: { fontSize: 12, color: Colors.ink3, flex: 1 },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  autoBadge: { backgroundColor: Colors.violetD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  autoText: { fontSize: 8, fontWeight: "600", color: Colors.violet3 },
  chatView: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  chatAvatarText: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  chatName: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  chatPhone: { fontSize: 11, color: Colors.ink3 },
  chatAction: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  chatActionText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  messagesArea: { padding: 16, gap: 10, minHeight: 240 },
  msgBubble: { maxWidth: "75%", borderRadius: 14, padding: 12, gap: 4 },
  msgClient: { alignSelf: "flex-start", backgroundColor: Colors.bg4 },
  msgUser: { alignSelf: "flex-end", backgroundColor: Colors.violet },
  msgAuto: { alignSelf: "flex-end", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  msgAutoLabel: { fontSize: 9, fontWeight: "600", color: Colors.violet3, marginBottom: 2 },
  msgText: { fontSize: 13, color: Colors.ink, lineHeight: 18 },
  msgTime: { fontSize: 9, color: Colors.ink3, alignSelf: "flex-end" },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  replyInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  sendBtnText: { fontSize: 18, fontWeight: "700", color: "#fff" },
});

export default TabConversas;
