import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { aiApi } from "@/services/api";
import { fmt } from "./types";

var isWeb = Platform.OS === "web";

type Summary = { income: number; expenses: number; balance: number };
type Props = { summary: Summary; txCount: number };

export function AIFinancialInsights({ summary, txCount }: Props) {
  var { company } = useAuthStore();
  var plan = company?.plan || "";
  var isNegocio = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  var [insights, setInsights] = useState<string | null>(null);
  var [loading, setLoading] = useState(false);
  var [requested, setRequested] = useState(false);

  if (!isNegocio || !company?.id) return null;

  async function fetchInsights() {
    if (!company?.id || loading) return;
    setLoading(true); setRequested(true);
    try {
      var margin = summary.income > 0 ? Math.round((summary.balance / summary.income) * 100) : 0;
      var prompt = "Analise rapida do financeiro deste mes (responda em portugues, maximo 4 frases curtas e diretas, sem formatacao markdown):\n" +
        "Receita: " + fmt(summary.income) + "\n" +
        "Despesas: " + fmt(summary.expenses) + "\n" +
        "Resultado: " + fmt(summary.balance) + "\n" +
        "Margem: " + margin + "%\n" +
        "Lancamentos: " + txCount + "\n" +
        "De sugestoes praticas e especificas pra este negocio.";
      var res = await aiApi.chat(company.id, prompt, "financeiro");
      var text = res?.response || res?.message || res?.content?.[0]?.text || "Sem resposta";
      setInsights(text);
    } catch (err: any) {
      setInsights("Nao foi possivel gerar insights agora. Tente novamente.");
    } finally { setLoading(false); }
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.aiIcon}><Text style={s.aiIconText}>IA</Text></View>
          <Text style={s.title}>Analise inteligente</Text>
        </View>
        {requested && !loading && (
          <Pressable onPress={fetchInsights} style={s.refreshBtn}>
            <Icon name="refresh" size={12} color={Colors.violet3} />
          </Pressable>
        )}
      </View>

      {!requested ? (
        <Pressable onPress={fetchInsights} style={s.generateBtn}>
          <Icon name="sparkle" size={14} color="#fff" />
          <Text style={s.generateText}>Gerar analise do periodo</Text>
        </Pressable>
      ) : loading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={Colors.violet3} />
          <Text style={s.loadingText}>Analisando seus dados...</Text>
        </View>
      ) : insights ? (
        <Text style={s.insightText}>{insights}</Text>
      ) : null}
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.violet + "33", marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  aiIconText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  title: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  refreshBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12 },
  generateText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: Colors.violet3 },
  insightText: { fontSize: 13, color: Colors.ink2, lineHeight: 20 },
});

export default AIFinancialInsights;
