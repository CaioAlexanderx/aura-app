// ============================================================
// ToothPopover — Modal-as-popover de anotacao rapida.
//
// FIX-22 (2026-05-09): Seletor de faces do dente (M, D, O, V, L).
// Permite indicar em quais faces a condicao foi detectada.
// As faces selecionadas sao incluidas nas notes como [Faces: M,D].
// onSave expoe faces[] para uso futuro no chart por face.
// ============================================================

import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, TextInput } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import type { ToothData, ToothStatus } from "@/components/verticals/odonto/OdontogramaSVG";
import type { ToothFace } from "@/components/verticals/odonto/Odontograma2D";

interface Props {
  tooth: ToothData | null;
  onClose: () => void;
  onSave: (updated: { status: ToothStatus; notes: string | null; faces?: ToothFace[] }) => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ToothStatus; label: string; color: string }> = [
  { value: "higido",     label: "Higido",     color: DentalColors.green },
  { value: "carie",      label: "Carie",      color: DentalColors.red },
  { value: "restaurado", label: "Restaurado", color: DentalColors.cyan },
  { value: "planejado",  label: "Planejado",  color: DentalColors.amber },
  { value: "ausente",    label: "Ausente",    color: DentalColors.ink3 },
];

// Faces anatomicas do dente
const FACE_OPTIONS: ReadonlyArray<{ value: ToothFace; label: string; desc: string }> = [
  { value: "M", label: "M", desc: "Mesial"      },
  { value: "D", label: "D", desc: "Distal"      },
  { value: "O", label: "O", desc: "Oclusal"     },
  { value: "V", label: "V", desc: "Vestibular"  },
  { value: "L", label: "L", desc: "Lingual"     },
];

export function ToothPopover({ tooth, onClose, onSave }: Props) {
  const [status, setStatus] = useState<ToothStatus>("higido");
  const [notes, setNotes] = useState("");
  const [selectedFaces, setSelectedFaces] = useState<ToothFace[]>([]);

  useEffect(() => {
    if (tooth) {
      setStatus(tooth.status || "higido");
      setNotes(tooth.notes || "");
      setSelectedFaces([]);
    }
  }, [tooth?.number]);

  if (!tooth) return null;

  function toggleFace(face: ToothFace) {
    setSelectedFaces((prev) =>
      prev.includes(face) ? prev.filter((f) => f !== face) : [...prev, face]
    );
  }

  function save() {
    // Prepend selected faces to notes as [Faces: M, D]
    const facePrefix = selectedFaces.length > 0
      ? `[Faces: ${selectedFaces.join(", ")}] `
      : "";
    const finalNotes = (facePrefix + notes.trim()).trim() || null;
    onSave({ status, notes: finalNotes, faces: selectedFaces });
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <View style={{
          width: "100%", maxWidth: 380,
          backgroundColor: DentalColors.bg2,
          borderWidth: 1, borderColor: DentalColors.cyanBorder,
          borderRadius: 16, padding: 16,
        }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: "800", color: DentalColors.cyan, marginBottom: 2 }}>
                Dente {tooth.number}
              </Text>
              <Text style={{ fontSize: 10, color: DentalColors.ink3 }}>
                Selecione o status e as faces afetadas
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ fontSize: 14, color: DentalColors.ink3 }}>✕</Text>
            </Pressable>
          </View>

          {/* Status chips */}
          <Text style={labelStyle}>STATUS</Text>
          <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setStatus(opt.value)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7,
                    backgroundColor: active ? opt.color : DentalColors.surface,
                    borderWidth: 1, borderColor: active ? opt.color : DentalColors.border,
                  }}>
                  <Text style={{
                    fontSize: 11, fontWeight: "700",
                    color: active ? "#fff" : DentalColors.ink2,
                  }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Face selector — FIX-22 */}
          <Text style={labelStyle}>FACES AFETADAS (opcional)</Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
            {FACE_OPTIONS.map((face) => {
              const active = selectedFaces.includes(face.value);
              return (
                <Pressable
                  key={face.value}
                  onPress={() => toggleFace(face.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor: active ? DentalColors.cyan : DentalColors.surface,
                    borderWidth: 1.5,
                    borderColor: active ? DentalColors.cyan : DentalColors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: active ? "#fff" : DentalColors.ink2 }}>
                    {face.label}
                  </Text>
                  <Text style={{ fontSize: 8, color: active ? "rgba(255,255,255,0.8)" : DentalColors.ink3, marginTop: 2 }}>
                    {face.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Notes */}
          <Text style={labelStyle}>OBSERVAÇÃO</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Observacao livre (opcional)..."
            placeholderTextColor={DentalColors.ink3}
            multiline
            style={{
              backgroundColor: DentalColors.surface, borderRadius: 7,
              borderWidth: 1, borderColor: DentalColors.border,
              padding: 8, fontSize: 12, color: DentalColors.ink,
              minHeight: 52, textAlignVertical: "top" as const,
              marginBottom: 14,
            }}
          />

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
            <Pressable onPress={onClose} style={btnGhost}>
              <Text style={{ color: DentalColors.ink2, fontSize: 11, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={save} style={btnPrimary}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Salvar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const labelStyle = {
  fontSize: 8,
  color: DentalColors.ink3,
  fontWeight: "700" as const,
  letterSpacing: 1.2,
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const btnGhost = {
  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
  backgroundColor: "transparent",
  borderWidth: 1, borderColor: DentalColors.border,
};
const btnPrimary = {
  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
  backgroundColor: DentalColors.cyan,
};
