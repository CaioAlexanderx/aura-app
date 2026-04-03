import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// B-06: CorteHistorico — Cut history timeline with photos
// Shows chronological history of cuts for a customer
// ============================================================

export interface CutEntry {
  id: string;
  customer_name?: string;
  professional_name?: string;
  machine_number?: string;
  technique?: string;
  photo_url?: string;
  notes?: string;
  recorded_at: string;
}

interface Props {
  history: CutEntry[];
  customerName?: string;
  onAddEntry?: () => void;
  onPhotoPress?: (entry: CutEntry) => void;
}

export function CorteHistorico({ history, customerName, onAddEntry, onPhotoPress }: Props) {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Historico de cortes{customerName ? ` \u2014 ${customerName}` : ""}</Text>
        {onAddEntry && (
          <Pressable onPress={onAddEntry} style={s.addBtn}>
            <Text style={s.addBtnText}>+ Registrar</Text>
          </Pressable>
        )}
      </View>

      {history.map((entry, i) => (
        <Pressable
          key={entry.id}
          onPress={() => entry.photo_url && onPhotoPress?.(entry)}
          style={s.entry}
        >
          {/* Photo thumbnail */}
          {entry.photo_url ? (
            <Image source={{ uri: entry.photo_url }} style={s.photo} resizeMode="cover" />
          ) : (
            <View style={[s.photo, s.noPhoto]}>
              <Text style={s.noPhotoIcon}>\u2702\uFE0F</Text>
            </View>
          )}

          {/* Details */}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.date}>{new Date(entry.recorded_at).toLocaleDateString("pt-BR")}</Text>
            <Text style={s.pro}>{entry.professional_name || "Profissional"}</Text>
            <View style={s.tagsRow}>
              {entry.machine_number && (
                <View style={s.tag}><Text style={s.tagText}>Maquina {entry.machine_number}</Text></View>
              )}
              {entry.technique && (
                <View style={s.tag}><Text style={s.tagText}>{entry.technique}</Text></View>
              )}
            </View>
            {entry.notes && <Text style={s.notes} numberOfLines={2}>{entry.notes}</Text>}
          </View>
        </Pressable>
      ))}

      {history.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>\u2702\uFE0F</Text>
          <Text style={s.emptyTitle}>Nenhum corte registrado</Text>
          <Text style={s.emptyText}>O historico de cortes aparecera aqui apos o primeiro atendimento.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  entry: {
    flexDirection: "row", gap: 12, padding: 10,
    borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border || "#333",
    backgroundColor: Colors.bg3 || "#1a1a2e",
  },
  photo: { width: 64, height: 64, borderRadius: 8, backgroundColor: Colors.bg4 || "#222" },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  noPhotoIcon: { fontSize: 24 },
  date: { fontSize: 11, color: Colors.ink3 || "#888" },
  pro: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  tagsRow: { flexDirection: "row", gap: 6 },
  tag: { backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: "600", color: "#F59E0B" },
  notes: { fontSize: 11, color: Colors.ink2 || "#aaa", fontStyle: "italic" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink || "#fff" },
  emptyText: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", maxWidth: 260 },
});

export default CorteHistorico;
