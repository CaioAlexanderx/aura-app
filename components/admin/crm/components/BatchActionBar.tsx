// ─── BatchActionBar ──────────────────────────────────────────────────────────
// Barra flutuante fixa no rodape quando ha leads selecionados.
// Suporta: mudar status, set plano esperado, aplicar cadencia, mark/unmark rotten,
// set followup, deletar (com confirmacao).
// ============================================================================

import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { STATUSES, PLANS } from "../shared/constants";
import { todayIso } from "../shared/helpers";
import type { LeadStatus, Cadence, ExpectedPlan } from "@/services/crmApi";

type BatchAction = "update_status" | "set_expected_plan" | "assign_cadence" | "mark_rotten" | "unmark_rotten" | "set_followup" | "delete";

type Props = {
  selectedCount: number;
  onClear: () => void;
  onBatch: (action: BatchAction, payload?: Record<string, any>) => void;
  isPending?: boolean;
  cadences?: Cadence[];
};

export function BatchActionBar({ selectedCount, onClear, onBatch, isPending, cadences = [] }: Props) {
  const [open, setOpen] = useState<null | "status" | "plan" | "cadence" | "followup" | "delete">(null);
  const [followupDate, setFollowupDate] = useState("");

  if (selectedCount === 0) return null;

  function close() { setOpen(null); }
  function doAction(action: BatchAction, payload?: Record<string, any>) {
    onBatch(action, payload);
    close();
  }

  return (
    <>
      <View style={s.bar}>
        <View style={s.count}>
          <Text style={s.countNum}>{selectedCount}</Text>
          <Text style={s.countLabel}>{selectedCount === 1 ? "lead" : "leads"} selecionados</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <BarBtn icon="edit"  label="Status"   onPress={() => setOpen("status")} />
            <BarBtn icon="tag"   label="Plano"    onPress={() => setOpen("plan")} />
            <BarBtn icon="users" label="Cadencia" onPress={() => setOpen("cadence")} disabled={!cadences.length} />
            <BarBtn icon="clock" label="Follow-up" onPress={() => setOpen("followup")} />
            <BarBtn icon="alert" label="Rotten" onPress={() => doAction("mark_rotten")} />
            <BarBtn icon="check" label="Despertar"  onPress={() => doAction("unmark_rotten")} />
            <BarBtn icon="trash" label="Deletar" onPress={() => setOpen("delete")} danger />
          </View>
        </ScrollView>

        <Pressable onPress={onClear} style={s.clearBtn}>
          <Icon name="close" size={14} color={Colors.ink3} />
        </Pressable>

        {isPending && <ActivityIndicator size="small" color={Colors.violet3} style={{ marginLeft: 8 }} />}
      </View>

      {/* ── Modais de payload ─────────────────────────────────────────────── */}
      <Modal transparent visible={!!open} animationType="fade" onRequestClose={close}>
        <Pressable style={cs.modalOverlay} onPress={close}>
          <Pressable style={cs.modalBox} onPress={(e) => e.stopPropagation?.()}>
            {open === "status" && (
              <>
                <Text style={cs.modalTitle}>Mudar status de {selectedCount} lead(s)</Text>
                <View style={{ gap: 8 }}>
                  {STATUSES.map((st) => (
                    <Pressable
                      key={st.key}
                      onPress={() => doAction("update_status", { status: st.key })}
                      style={[cs.actionBtn, { borderColor: st.color + "44" }]}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.color }} />
                      <Text style={[cs.actionBtnText, { color: st.color }]}>{st.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {open === "plan" && (
              <>
                <Text style={cs.modalTitle}>Plano esperado para {selectedCount} lead(s)</Text>
                <View style={{ gap: 8 }}>
                  <Pressable onPress={() => doAction("set_expected_plan", { expected_plan: null, expected_mrr: null })} style={cs.actionBtn}>
                    <Text style={cs.actionBtnText}>Limpar (nenhum)</Text>
                  </Pressable>
                  {PLANS.map((p) => (
                    <Pressable
                      key={p.key}
                      onPress={() => doAction("set_expected_plan", { expected_plan: p.key, expected_mrr: p.price })}
                      style={[cs.actionBtn, { borderColor: Colors.violet3 }]}
                    >
                      <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>
                        {p.label} · R$ {p.price.toFixed(2)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {open === "cadence" && (
              <>
                <Text style={cs.modalTitle}>Aplicar cadencia em {selectedCount} lead(s)</Text>
                {cadences.length === 0 ? (
                  <Text style={cs.hintText}>Nenhuma cadencia ativa. Crie uma em "Metas".</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 320 }}>
                    <View style={{ gap: 8 }}>
                      {cadences.filter((c) => c.is_active).map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => doAction("assign_cadence", { cadence_name: c.name })}
                          style={[cs.actionBtn, { flexDirection: "column", alignItems: "flex-start", gap: 4 }]}
                        >
                          <Text style={[cs.actionBtnText, { fontSize: 13, color: Colors.ink }]}>{c.name}</Text>
                          <Text style={{ fontSize: 10, color: Colors.ink3 }}>
                            {c.steps.length} passos
                            {c.description ? " · " + c.description : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </>
            )}

            {open === "followup" && (
              <>
                <Text style={cs.modalTitle}>Definir follow-up para {selectedCount} lead(s)</Text>
                <Text style={cs.fieldLabel}>Data (YYYY-MM-DD)</Text>
                <TextInput
                  value={followupDate}
                  onChangeText={setFollowupDate}
                  placeholder={todayIso()}
                  placeholderTextColor={Colors.ink3}
                  style={[cs.noteInput, { minHeight: 40 }]}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={close} style={[cs.actionBtn, { flex: 1 }]}>
                    <Text style={cs.actionBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => doAction("set_followup", { next_followup_at: followupDate || todayIso() })}
                    style={[cs.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}
                  >
                    <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>Aplicar</Text>
                  </Pressable>
                </View>
              </>
            )}

            {open === "delete" && (
              <>
                <Text style={cs.modalTitle}>Deletar {selectedCount} lead(s)?</Text>
                <Text style={cs.hintText}>
                  Esta acao e permanente. O historico de interacoes tambem sera removido.
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={close} style={[cs.actionBtn, { flex: 1 }]}>
                    <Text style={cs.actionBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => doAction("delete")}
                    style={[cs.actionBtn, { flex: 1, backgroundColor: Colors.red + "22", borderColor: Colors.red }]}
                  >
                    <Text style={[cs.actionBtnText, { color: Colors.red }]}>Deletar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function BarBtn({ icon, label, onPress, disabled, danger }: { icon: string; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        danger && { borderColor: Colors.red + "44", backgroundColor: Colors.red + "10" },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon name={icon as any} size={14} color={danger ? Colors.red : Colors.ink3} />
      <Text style={[s.btnText, danger && { color: Colors.red }]}>{label}</Text>
    </Pressable>
  );
}

import { StyleSheet } from "react-native";

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12, right: 12, bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.bg2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.violet3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    zIndex: 100,
  },
  count: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  countNum: { fontSize: 18, fontWeight: "800", color: Colors.violet3 },
  countLabel: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: { fontSize: 11, fontWeight: "700", color: Colors.ink3 },
  clearBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.bg4,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
});
