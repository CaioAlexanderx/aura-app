import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-01: Odontograma SVG Interativo
// 32 dentes (FDI), 5 estados, 5 faces por dente
// ============================================================

export type ToothStatus = "higido" | "carie" | "restaurado" | "planejado" | "ausente";
export type ToothFace = "M" | "D" | "O" | "V" | "L";

export interface ToothData {
  number: number;
  status: ToothStatus;
  faces: Record<ToothFace, ToothStatus | null>;
  notes?: string;
  procedure_name?: string;
}

interface OdontogramaProps {
  teeth: ToothData[];
  onToothSelect?: (tooth: ToothData) => void;
  onStatusChange?: (toothNumber: number, status: ToothStatus) => void;
  onFaceChange?: (toothNumber: number, face: ToothFace, status: ToothStatus) => void;
  selectedTooth?: number | null;
  editable?: boolean;
}

const STATUS_COLORS: Record<ToothStatus, { bg: string; border: string; text: string }> = {
  higido:     { bg: "rgba(16,185,129,0.12)",  border: "#10B981", text: "#065F46" },
  carie:      { bg: "rgba(239,68,68,0.12)",   border: "#EF4444", text: "#991B1B" },
  restaurado: { bg: "rgba(6,182,212,0.12)",    border: "#06B6D4", text: "#0E7490" },
  planejado:  { bg: "rgba(245,158,11,0.12)",   border: "#F59E0B", text: "#92400E" },
  ausente:    { bg: "rgba(156,163,175,0.08)",  border: "#9CA3AF", text: "#6B7280" },
};

const UPPER_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_TEETH = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const FACES: ToothFace[] = ["M","D","O","V","L"];

function buildDefaultTeeth(): ToothData[] {
  return [...UPPER_TEETH, ...LOWER_TEETH].map(n => ({
    number: n,
    status: "higido" as ToothStatus,
    faces: { M: null, D: null, O: null, V: null, L: null },
  }));
}

// Single tooth component
function Tooth({
  data, isSelected, onPress, size = 32,
}: {
  data: ToothData; isSelected: boolean; onPress: () => void; size?: number;
}) {
  const colors = STATUS_COLORS[data.status];
  const isAbsent = data.status === "ausente";

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.tooth,
        {
          width: size,
          height: size + 6,
          backgroundColor: colors.bg,
          borderColor: isSelected ? "#06B6D4" : colors.border,
          borderWidth: isSelected ? 2 : 1,
          opacity: isAbsent ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[s.toothNum, { color: colors.text, fontSize: size < 30 ? 8 : 10 }]}>
        {data.number}
      </Text>
      {/* Face indicators */}
      <View style={s.faceRow}>
        {FACES.map(f => {
          const faceStatus = data.faces[f];
          const fc = faceStatus ? STATUS_COLORS[faceStatus] : null;
          return (
            <View
              key={f}
              style={[
                s.faceDot,
                fc
                  ? { backgroundColor: fc.border }
                  : { backgroundColor: "transparent", borderWidth: 0.5, borderColor: colors.border },
              ]}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

export function OdontogramaSVG({
  teeth: externalTeeth,
  onToothSelect,
  onStatusChange,
  onFaceChange,
  selectedTooth,
  editable = true,
}: OdontogramaProps) {
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const selected = selectedTooth !== undefined ? selectedTooth : localSelected;

  const teeth = externalTeeth?.length ? externalTeeth : buildDefaultTeeth();
  const teethMap = new Map(teeth.map(t => [t.number, t]));

  const getTooth = (n: number): ToothData =>
    teethMap.get(n) || { number: n, status: "higido", faces: { M: null, D: null, O: null, V: null, L: null } };

  const handleSelect = useCallback((n: number) => {
    const tooth = getTooth(n);
    if (selectedTooth === undefined) setLocalSelected(prev => prev === n ? null : n);
    onToothSelect?.(tooth);
  }, [teeth, onToothSelect, selectedTooth]);

  const selectedData = selected ? getTooth(selected) : null;
  const toothSize = Platform.OS === "web" ? 34 : 28;

  return (
    <View style={s.container}>
      {/* Upper arch */}
      <Text style={s.archLabel}>Arcada superior</Text>
      <View style={s.archRow}>
        {UPPER_TEETH.map(n => (
          <Tooth
            key={n}
            data={getTooth(n)}
            isSelected={selected === n}
            onPress={() => handleSelect(n)}
            size={toothSize}
          />
        ))}
      </View>

      {/* Midline */}
      <View style={s.midline} />

      {/* Lower arch */}
      <View style={s.archRow}>
        {LOWER_TEETH.map(n => (
          <Tooth
            key={n}
            data={getTooth(n)}
            isSelected={selected === n}
            onPress={() => handleSelect(n)}
            size={toothSize}
          />
        ))}
      </View>
      <Text style={s.archLabel}>Arcada inferior</Text>

      {/* Legend */}
      <View style={s.legend}>
        {(Object.entries(STATUS_COLORS) as [ToothStatus, typeof STATUS_COLORS.higido][]).map(([key, val]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: val.bg, borderColor: val.border, borderWidth: 1 }]} />
            <Text style={s.legendText}>
              {key === "higido" ? "Higido" : key === "carie" ? "Carie" : key === "restaurado" ? "Restaurado" : key === "planejado" ? "Planejado" : "Ausente"}
            </Text>
          </View>
        ))}
      </View>

      {/* Detail panel */}
      {selectedData && editable && (
        <View style={s.detailPanel}>
          <Text style={s.detailTitle}>Dente {selectedData.number}</Text>

          {/* Status buttons */}
          <Text style={s.detailLabel}>Status</Text>
          <View style={s.statusRow}>
            {(["higido","carie","restaurado","planejado","ausente"] as ToothStatus[]).map(st => {
              const c = STATUS_COLORS[st];
              const isActive = selectedData.status === st;
              return (
                <Pressable
                  key={st}
                  onPress={() => onStatusChange?.(selectedData.number, st)}
                  style={[
                    s.statusBtn,
                    { backgroundColor: isActive ? c.bg : "transparent", borderColor: c.border },
                  ]}
                >
                  <Text style={[s.statusBtnText, { color: c.text }]}>
                    {st === "higido" ? "Higido" : st === "carie" ? "Carie" : st === "restaurado" ? "Rest." : st === "planejado" ? "Plan." : "Ausente"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Face selectors */}
          <Text style={s.detailLabel}>Faces</Text>
          <View style={s.faceGrid}>
            {FACES.map(f => {
              const faceStatus = selectedData.faces[f];
              const fc = faceStatus ? STATUS_COLORS[faceStatus] : null;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    // Cycle: null -> carie -> restaurado -> planejado -> null
                    const cycle: (ToothStatus | null)[] = [null, "carie", "restaurado", "planejado"];
                    const idx = cycle.indexOf(faceStatus);
                    const next = cycle[(idx + 1) % cycle.length];
                    if (next) onFaceChange?.(selectedData.number, f, next);
                  }}
                  style={[
                    s.faceBtn,
                    fc
                      ? { backgroundColor: fc.bg, borderColor: fc.border }
                      : { backgroundColor: "transparent", borderColor: Colors.border || "#333" },
                  ]}
                >
                  <Text style={[s.faceBtnText, fc ? { color: fc.text } : { color: Colors.ink3 || "#888" }]}>
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: "center", gap: 8, paddingVertical: 8 },
  archLabel: {
    fontSize: 10, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 1, color: Colors.ink3 || "#888", marginVertical: 4,
  },
  archRow: {
    flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "center",
  },
  midline: {
    width: "80%", height: 1, backgroundColor: Colors.border || "#333",
    marginVertical: 6, opacity: 0.3,
  },
  tooth: {
    borderRadius: 4, alignItems: "center", justifyContent: "center",
    gap: 2, borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
  },
  toothNum: { fontWeight: "600" },
  faceRow: { flexDirection: "row", gap: 1.5 },
  faceDot: { width: 4, height: 4, borderRadius: 2 },
  legend: {
    flexDirection: "row", gap: 12, justifyContent: "center",
    flexWrap: "wrap", marginTop: 8, paddingHorizontal: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, color: Colors.ink2 || "#aaa" },
  detailPanel: {
    width: "100%", marginTop: 12, padding: 14,
    borderRadius: 12, borderWidth: 0.5,
    borderColor: Colors.border || "#333",
    backgroundColor: Colors.bg3 || "#1a1a2e",
    gap: 8,
  },
  detailTitle: {
    fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff",
  },
  detailLabel: {
    fontSize: 11, fontWeight: "600", color: Colors.ink3 || "#888",
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4,
  },
  statusRow: {
    flexDirection: "row", gap: 6, flexWrap: "wrap",
  },
  statusBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 0.5,
  },
  statusBtnText: { fontSize: 11, fontWeight: "600" },
  faceGrid: { flexDirection: "row", gap: 6 },
  faceBtn: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  faceBtnText: { fontSize: 13, fontWeight: "700" },
});

export default OdontogramaSVG;
