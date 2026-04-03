import { useState } from "react";
import { View, Text, Pressable, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-07: ClinicalImages — Upload and display clinical photos
// Linked to patient + optional tooth
// ============================================================

export interface ClinicalImage {
  id: string;
  url: string;
  thumbnail_url?: string;
  tooth_number?: number;
  image_type?: "intraoral" | "extraoral" | "radiografia" | "modelo" | "outro";
  description?: string;
  taken_at?: string;
  uploaded_at: string;
}

interface Props {
  images: ClinicalImage[];
  patientName?: string;
  onUpload?: () => void;
  onImagePress?: (image: ClinicalImage) => void;
  onDelete?: (imageId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  intraoral: "Intraoral",
  extraoral: "Extraoral",
  radiografia: "Radiografia",
  modelo: "Modelo",
  outro: "Outro",
};

export function ClinicalImages({ images, patientName, onUpload, onImagePress, onDelete }: Props) {
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = filter ? images.filter(img => img.image_type === filter) : images;
  const types = [...new Set(images.map(i => i.image_type || "outro"))];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>
          Imagens clinicas{patientName ? ` \u2014 ${patientName}` : ""}
        </Text>
        {onUpload && (
          <Pressable onPress={onUpload} style={s.uploadBtn}>
            <Text style={s.uploadBtnText}>+ Upload</Text>
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      {types.length > 1 && (
        <View style={s.filterRow}>
          <Pressable
            onPress={() => setFilter(null)}
            style={[s.filterChip, !filter && s.filterChipActive]}
          >
            <Text style={[s.filterText, !filter && s.filterTextActive]}>
              Todas ({images.length})
            </Text>
          </Pressable>
          {types.map(t => (
            <Pressable
              key={t}
              onPress={() => setFilter(t === filter ? null : t)}
              style={[s.filterChip, filter === t && s.filterChipActive]}
            >
              <Text style={[s.filterText, filter === t && s.filterTextActive]}>
                {TYPE_LABELS[t] || t} ({images.filter(i => (i.image_type || "outro") === t).length})
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Image grid */}
      <View style={s.grid}>
        {filtered.map(img => (
          <Pressable
            key={img.id}
            onPress={() => onImagePress?.(img)}
            style={s.imageCard}
          >
            <Image
              source={{ uri: img.thumbnail_url || img.url }}
              style={s.thumbnail}
              resizeMode="cover"
            />
            <View style={s.imageMeta}>
              {img.tooth_number && (
                <Text style={s.toothBadge}>#{img.tooth_number}</Text>
              )}
              {img.image_type && (
                <Text style={s.typeBadge}>{TYPE_LABELS[img.image_type] || img.image_type}</Text>
              )}
            </View>
            {img.description && (
              <Text style={s.imgDesc} numberOfLines={2}>{img.description}</Text>
            )}
            <Text style={s.imgDate}>
              {new Date(img.uploaded_at).toLocaleDateString("pt-BR")}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>\uD83D\uDCF7</Text>
          <Text style={s.emptyTitle}>Nenhuma imagem</Text>
          <Text style={s.emptyText}>
            {onUpload ? "Faca upload de fotos intraorais, radiografias ou modelos." : "Nenhuma imagem registrada."}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  uploadBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  uploadBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 0.5, borderColor: Colors.border || "#333",
  },
  filterChipActive: { backgroundColor: "rgba(6,182,212,0.12)", borderColor: "#06B6D4" },
  filterText: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  filterTextActive: { color: "#06B6D4", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageCard: {
    width: "48%", borderRadius: 10, overflow: "hidden",
    borderWidth: 0.5, borderColor: Colors.border || "#333",
    backgroundColor: Colors.bg2 || "#1a1a2e",
  },
  thumbnail: { width: "100%", height: 120, backgroundColor: Colors.bg4 || "#222" },
  imageMeta: { flexDirection: "row", gap: 4, padding: 8, paddingBottom: 4 },
  toothBadge: {
    fontSize: 10, fontWeight: "600", color: "#06B6D4",
    backgroundColor: "rgba(6,182,212,0.12)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  typeBadge: {
    fontSize: 10, color: Colors.ink3 || "#888",
    backgroundColor: Colors.bg4 || "#222", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  imgDesc: { fontSize: 11, color: Colors.ink2 || "#aaa", paddingHorizontal: 8 },
  imgDate: { fontSize: 10, color: Colors.ink3 || "#666", paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink || "#fff" },
  emptyText: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", maxWidth: 260 },
});

export default ClinicalImages;
