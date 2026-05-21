// ─── CadenceSelector ─────────────────────────────────────────────────────────
// Picker compacto pra aplicar/trocar cadencia em UM lead.
// Usado dentro do LeadDetailView.
// ============================================================================

import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { useCadences } from "../hooks/useCadences";

type Props = {
  currentCadence: string | null;
  currentDay: number;
  onApply: (cadenceName: string, startDay?: number) => void;
  onClear?: () => void;          // se quiser remover do lead
  isPending?: boolean;
};

export function CadenceSelector({ currentCadence, currentDay, onApply, onClear, isPending }: Props) {
  const [open, setOpen] = useState(false);
  const { cadences, isLoading } = useCadences(true);

  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={[cs.actionBtn, currentCadence && { borderColor: Colors.amber + "66", backgroundColor: Colors.amber + "14" }]}>
        <Icon name="users" size={14} color={currentCadence ? Colors.amber : Colors.ink3} />
        <Text style={[cs.actionBtnText, currentCadence && { color: Colors.amber }]}>
          {currentCadence ? `Cadencia: ${currentCadence} (dia ${currentDay})` : "Aplicar cadencia"}
        </Text>
        {isPending && <ActivityIndicator size="small" color={Colors.amber} />}
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={cs.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={cs.modalBox} onPress={(e: any) => e.stopPropagation?.()}>
            <Text style={cs.modalTitle}>Selecionar cadencia</Text>

            {isLoading ? (
              <ActivityIndicator color={Colors.violet3} style={{ padding: 20 }} />
            ) : cadences.filter((c) => c.is_active).length === 0 ? (
              <Text style={cs.hintText}>Nenhuma cadencia ativa. Crie uma na tab "Metas".</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                <View style={{ gap: 8 }}>
                  {cadences.filter((c) => c.is_active).map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => { onApply(c.name, 0); setOpen(false); }}
                      style={[
                        cs.actionBtn,
                        { flexDirection: "column", alignItems: "flex-start", gap: 6, padding: 12 },
                        currentCadence === c.name && { borderColor: Colors.amber, backgroundColor: Colors.amber + "14" },
                      ]}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", width: "100%" }}>
                        <Text style={[cs.actionBtnText, { fontSize: 14, color: Colors.ink, fontWeight: "700" }]}>{c.name}</Text>
                        <Text style={{ fontSize: 10, color: Colors.ink3 }}>{c.steps.length} passos</Text>
                      </View>
                      {c.description && (
                        <Text style={{ fontSize: 11, color: Colors.ink3, lineHeight: 14 }}>{c.description}</Text>
                      )}
                      {c.steps.length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {c.steps.slice(0, 5).map((step, i) => (
                            <View key={i} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border }}>
                              <Text style={{ fontSize: 9, color: Colors.ink3, fontWeight: "600" }}>
                                D{step.day} · {step.channel}
                              </Text>
                            </View>
                          ))}
                          {c.steps.length > 5 && (
                            <Text style={{ fontSize: 9, color: Colors.ink3 }}>+{c.steps.length - 5}</Text>
                          )}
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {currentCadence && onClear && (
              <Pressable
                onPress={() => { onClear(); setOpen(false); }}
                style={[cs.actionBtn, { marginTop: 12, borderColor: Colors.red + "44", backgroundColor: Colors.red + "10" }]}
              >
                <Text style={[cs.actionBtnText, { color: Colors.red }]}>Remover cadencia deste lead</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
