// ─── LeadTimeline ────────────────────────────────────────────────────────────
// Timeline visual de interactions, com icone por canal e relative time.
// ============================================================================

import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { LeadInteraction } from "@/services/crmApi";
import { fmtDateTime, fmtRelative } from "../shared/helpers";

type Props = {
  interactions: LeadInteraction[];
};

const CHANNEL_ICONS: Record<string, { name: string; color: string }> = {
  whatsapp:     { name: "message",  color: Colors.green },
  ligacao:      { name: "phone",    color: "#06b6d4" },
  email:        { name: "mail",     color: Colors.violet3 },
  visita:       { name: "users",    color: Colors.amber },
  sem_resposta: { name: "alert",    color: Colors.ink3 },
  outro:        { name: "edit",     color: Colors.ink3 },
};

export function LeadTimeline({ interactions }: Props) {
  if (!interactions.length) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Nenhum contato registrado ainda.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {interactions.map((it, idx) => {
        const ch = CHANNEL_ICONS[it.channel || "outro"];
        const isLast = idx === interactions.length - 1;
        return (
          <View key={it.id} style={s.row}>
            {/* Timeline rail (vertical) */}
            <View style={s.rail}>
              <View style={[s.dot, { backgroundColor: ch.color + "22", borderColor: ch.color }]}>
                <Icon name={ch.name as any} size={10} color={ch.color} />
              </View>
              {!isLast && <View style={s.line} />}
            </View>

            {/* Conteudo */}
            <View style={s.content}>
              <View style={s.head}>
                <Text style={[s.author, { color: ch.color }]}>
                  {it.author_name || "Staff"}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "baseline" }}>
                  <Text style={s.relative}>{fmtRelative(it.created_at)}</Text>
                  <Text style={s.dateTime}>{fmtDateTime(it.created_at)}</Text>
                </View>
              </View>
              {it.channel && (
                <View style={[s.channelBadge, { backgroundColor: ch.color + "18", borderColor: ch.color + "44" }]}>
                  <Text style={[s.channelText, { color: ch.color }]}>{it.channel}</Text>
                </View>
              )}
              <Text style={s.body}>{it.body}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 4 },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: Colors.ink3 },
  row: { flexDirection: "row", gap: 10 },
  rail: { width: 20, alignItems: "center" },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  line: { flex: 1, width: 1, backgroundColor: Colors.border, minHeight: 12 },
  content: {
    flex: 1,
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: 10,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 6 },
  author: { fontSize: 11, fontWeight: "700" },
  relative: { fontSize: 10, color: Colors.ink, fontWeight: "600" },
  dateTime: { fontSize: 9, color: Colors.ink3 },
  channelBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, marginBottom: 4 },
  channelText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  body: { fontSize: 12, color: Colors.ink, lineHeight: 18 },
});
