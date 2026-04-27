// ============================================================
// ToothPopover — Modal-as-popover de anotacao rapida.
//
// Aberto pelo Shell quando o dentista clica num dente do
// ConsultaOdontogramaPanel. Permite: trocar status, adicionar
// nota livre, salvar/descartar. Salvar manda chart entry +
// adiciona ToothChange no estado do shell (entra na evolucao
// editavel do EndModal).
//
// Modal nativo padrao animationType="fade" (alinhado com
// MarkPaymentPaidModal) — popover real pediria positioning
// absoluto que nao funciona bem com React Native cross-platform.
// ============================================================

import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, TextInput } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import type { ToothData, ToothStatus } from "@/components/verticals/odonto/OdontogramaSVG";

interface Props {
  tooth: ToothData | null;
  onClose: () => void;
  onSave: (updated: { status: ToothStatus; notes: string | null }) => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ToothStatus; label: string; color: string }> = [
  { value: "higido",     label: "Higido",     color: DentalColors.green },
  { value: "carie",      label: "Carie",      color: DentalColors.red },
  { value: "restaurado", label: "Restaurado", color: DentalColors.cyan },
  { value: "planejado",  label: "Planejado",  color: DentalColors.amber },
  { value: "ausente",    label: "Ausente",    color: DentalColors.ink3 },
];

export function ToothPopover({ tooth, onClose, onSave }: Props) {
  const [status, setStatus] = useState<ToothStatus>("higido");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (tooth) {
      setStatus(tooth.status || "higido");
      setNotes(tooth.notes || "");
    }
  }, [tooth?.number]);

  if (!tooth) return null;

  function save() {
    onSave({ status, notes: notes.trim() || null });
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <View style={{
          width: "100%", maxWidth: 360,
          backgroundColor: DentalColors.bg2,
          borderWidth: 1, borderColor: DentalColors.cyanBorder,
          borderRadius: 16, padding: 16,
        }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: DentalColors.ink, marginBottom: 4 }}>
            Dente {tooth.number}
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 10 }}>
            Selecione o status e adicione uma observacao se quiser.
          </Text>

          <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setStatus(opt.value)}
                  style={{
                    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6,
                    backgroundColor: active ? opt.color : DentalColors.surface,
                    borderWidth: 1, borderColor: active ? opt.color : DentalColors.border,
                  }}>
                  <Text style={{
                    fontSize: 10, fontWeight: "700",
                    color: active ? "#fff" : DentalColors.ink2,
                  }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Observacao opcional..."
            placeholderTextColor={DentalColors.ink3}
            multiline
            style={{
              backgroundColor: DentalColors.surface, borderRadius: 6,
              borderWidth: 1, borderColor: DentalColors.border,
              padding: 8, fontSize: 12, color: DentalColors.ink,
              minHeight: 60, textAlignVertical: "top",
            }}
          />

          <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginTop: 12 }}>
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

const btnGhost = {
  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
  backgroundColor: "transparent",
  borderWidth: 1, borderColor: DentalColors.border,
};
const btnPrimary = {
  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
  backgroundColor: DentalColors.cyan,
};
