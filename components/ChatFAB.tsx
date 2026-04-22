import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { usePathname } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { aiApi } from "@/services/api";

var isWeb = Platform.OS === "web";

// Determina contexto da IA pela rota atual.
// ODT-12: fix bug pre-existente (antes usava path.includes("") que e sempre true,
// o que fazia TODO pathname cair em "geral"). Agora usa startsWith explicito
// na ordem correta, com odonto para /vertical.
function getContext(path: string): string {
  if (path === "/" || path === "") return "geral";
  if (path.startsWith("/vertical")) return "odonto";
  if (path.startsWith("/financeiro")) return "financeiro";
  if (path.startsWith("/pdv")) return "estoque";
  if (path.startsWith("/estoque")) return "estoque";
  if (path.startsWith("/clientes")) return "crm";
  if (path.startsWith("/contabilidade")) return "contabil";
  if (path.startsWith("/nfe")) return "contabil";
  if (path.startsWith("/folha")) return "financeiro";
  if (path.startsWith("/canal")) return "marketing";
  if (path.startsWith("/agentes")) return "geral";
  return "geral";
}

var CONTEXT_LABELS: Record<string, string> = {
  geral: "Geral",
  financeiro: "Financeiro",
  estoque: "Estoque",
  crm: "Clientes",
  contabil: "Contabil",
  marketing: "Marketing",
  odonto: "Odontologia",
};

type Message = { role: "user" | "assistant"; content: string };

export function ChatFAB() {
  var { company, isDemo } = useAuthStore();
  var plan = (company as any)?.plan || "essencial";
  var planLevel = ({ essencial: 0, negocio: 1, expansao: 2 } as any)[plan] ?? 0;
  var pathname = usePathname();

  var [open, setOpen] = useState(false);
  var [msg, setMsg] = useState("");
  var [history, setHistory] = useState<Message[]>([]);
  var [loading, setLoading] = useState(false);

  var context = getContext(pathname);
  var contextLabel = CONTEXT_LABELS[context] || "Geral";

  var chatMut = useMutation({
    mutationFn: function() {
      return aiApi.chat(company!.id, msg, context, history);
    },
    onSuccess: function(data: any) {
      setHistory(function(prev) {
        return [...prev, { role: "user", content: msg }, { role: "assistant", content: data.response }];
      });
      setMsg("");
      setLoading(false);
    },
    onError: function(err: any) {
      setHistory(function(prev) {
        return [...prev, { role: "user", content: msg }, { role: "assistant", content: err?.message || "Erro ao processar. Tente novamente." }];
      });
      setMsg("");
      setLoading(false);
    },
  });

  function handleSend() {
    if (!msg.trim() || loading || !company?.id) return;
    setLoading(true);
    chatMut.mutate();
  }

  function handleClear() {
    setHistory([]);
    setMsg("");
  }

  // Gate: only show for Expansao (IA plan)
  if (planLevel < 2 || isDemo || !company?.id) return null;
  // Don't show on agentes page (already has chat)
  if (pathname.includes("agentes")) return null;

  if (!open) {
    return (
      <Pressable onPress={function() { setOpen(true); }} style={s.fab}>
        <Icon name="chat" size={22} color="#fff" />
      </Pressable>
    );
  }

  return (
    <View style={s.panel}>
      <View style={s.panelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.panelTitle}>Agente IA</Text>
          <Text style={s.panelContext}>{contextLabel}</Text>
        </View>
        {history.length > 0 && (
          <Pressable onPress={handleClear} style={s.clearBtn}>
            <Text style={s.clearText}>Limpar</Text>
          </Pressable>
        )}
        <Pressable onPress={function() { setOpen(false); }} style={s.closeBtn}>
          <Text style={s.closeText}>x</Text>
        </Pressable>
      </View>

      <ScrollView style={s.chatScroll} contentContainerStyle={s.chatContent}>
        {history.length === 0 && (
          <View style={s.welcome}>
            <Icon name="star" size={24} color={Colors.violet3} />
            <Text style={s.welcomeText}>Pergunte qualquer coisa sobre {contextLabel.toLowerCase()}. O agente tem acesso aos seus dados reais.</Text>
          </View>
        )}
        {history.map(function(m, i) {
          var isUser = m.role === "user";
          return (
            <View key={i} style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
              <Text style={[s.bubbleText, isUser && { color: "#fff" }]}>{m.content}</Text>
            </View>
          );
        })}
        {loading && (
          <View style={s.bubbleAI}>
            <ActivityIndicator size="small" color={Colors.violet3} />
          </View>
        )}
      </ScrollView>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={msg}
          onChangeText={setMsg}
          placeholder="Pergunte ao agente..."
          placeholderTextColor={Colors.ink3}
          onSubmitEditing={handleSend}
          editable={!loading}
          multiline={false}
        />
        <Pressable onPress={handleSend} disabled={loading || !msg.trim()} style={[s.sendBtn, (loading || !msg.trim()) && { opacity: 0.5 }]}>
          <Icon name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  fab: {
    position: "fixed" as any,
    bottom: isWeb ? 24 : 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
    ...(isWeb ? { boxShadow: "0 4px 20px rgba(124,58,237,0.4)" } : { elevation: 6 }),
  } as any,
  panel: {
    position: "fixed" as any,
    bottom: isWeb ? 24 : 80,
    right: 20,
    width: 360,
    maxWidth: "90%",
    height: 480,
    maxHeight: "70vh",
    backgroundColor: Colors.bg2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    zIndex: 90,
    overflow: "hidden",
    ...(isWeb ? { boxShadow: "0 8px 40px rgba(0,0,0,0.3)" } : { elevation: 10 }),
  } as any,
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg3,
    gap: 8,
  },
  panelTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  panelContext: { fontSize: 10, color: Colors.violet3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.bg4 },
  clearText: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  chatScroll: { flex: 1 },
  chatContent: { padding: 12, gap: 8 },
  welcome: { alignItems: "center", paddingVertical: 32, gap: 10 },
  welcomeText: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 260 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: "85%" },
  bubbleUser: { backgroundColor: Colors.violet, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: Colors.bg3, alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 13, color: Colors.ink, lineHeight: 20 },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg3 },
  input: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
});

export default ChatFAB;
