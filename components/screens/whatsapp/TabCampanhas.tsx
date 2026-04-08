import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import type { Campaign } from "./types";
import { toast } from "@/components/Toast";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

type Props = { campaigns: Campaign[] };

export function TabCampanhas({ campaigns }: Props) {
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);
  const totalRead = campaigns.reduce((s, c) => s + c.read, 0);
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={s.kpiLabel}>CAMPANHAS</Text><Text style={s.kpiValue}>{campaigns.length}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>ENTREGUES</Text><Text style={[s.kpiValue, { color: Colors.green }]}>{totalDelivered}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>TAXA LEITURA</Text><Text style={[s.kpiValue, { color: Colors.violet3 }]}>{readRate}%</Text></View>
      </View>

      <View style={s.card}>
        {campaigns.map(camp => {
          const rate = camp.delivered > 0 ? Math.round((camp.read / camp.delivered) * 100) : 0;
          return (
            <View key={camp.id} style={s.campRow}>
              <View style={s.campLeft}>
                <Text style={s.campName}>{camp.name}</Text>
                <View style={s.campMeta}>
                  <View style={[s.campBadge, { backgroundColor: camp.status === "sent" ? Colors.greenD : Colors.amberD }]}><Text style={[s.campBadgeText, { color: camp.status === "sent" ? Colors.green : Colors.amber }]}>{camp.status === "sent" ? "Enviada" : "Rascunho"}</Text></View>
                  {camp.date && <Text style={s.campDate}>{camp.date}</Text>}
                </View>
              </View>
              {camp.status === "sent" && (
                <View style={s.campStats}>
                  <View style={s.campStat}><Text style={s.campStatValue}>{camp.recipients}</Text><Text style={s.campStatLabel}>Enviadas</Text></View>
                  <View style={s.campStat}><Text style={s.campStatValue}>{camp.delivered}</Text><Text style={s.campStatLabel}>Entregues</Text></View>
                  <View style={s.campStat}><Text style={[s.campStatValue, { color: Colors.green }]}>{rate}%</Text><Text style={s.campStatLabel}>Lidas</Text></View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={s.newCard}>
        <Text style={s.newTitle}>Criar nova campanha</Text>
        <Text style={s.newDesc}>Envie mensagens personalizadas para grupos de clientes.</Text>
        <View style={s.templates}>
          {[{ label: "Promocao", color: Colors.green }, { label: "Novidade", color: Colors.amber }, { label: "Reativacao", color: Colors.violet3 }, { label: "Evento", color: Colors.red }].map(t => (
            <Pressable key={t.label} onPress={() => toast.info(`Template: ${t.label}`)} style={s.template}><View style={[s.templateDot, { backgroundColor: t.color }]} /><Text style={s.templateText}>{t.label}</Text></Pressable>
          ))}
        </View>
        <Pressable onPress={() => toast.info("Iniciando nova campanha...")} style={s.newBtn}><Text style={s.newBtnText}>Criar campanha em branco</Text></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "30%", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  campRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  campLeft: { gap: 6, flex: 1 },
  campName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  campMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  campBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  campBadgeText: { fontSize: 9, fontWeight: "600" },
  campDate: { fontSize: 10, color: Colors.ink3 },
  campStats: { flexDirection: "row", gap: IS_WIDE ? 16 : 8, flexWrap: "wrap" },
  campStat: { alignItems: "center", gap: 2 },
  campStatValue: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  campStatLabel: { fontSize: 9, color: Colors.ink3 },
  newCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, marginTop: 16, gap: 12 },
  newTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  newDesc: { fontSize: 12, color: Colors.ink3 },
  templates: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  template: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  templateDot: { width: 8, height: 8, borderRadius: 4 },
  templateText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  newBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border2 },
  newBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});

export default TabCampanhas;
