// ─── GoalsView ───────────────────────────────────────────────────────────────
// Tab "Metas": GoalsCard (mes atual) + lista anual + CRUD de cadencias.
// ============================================================================

import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { crmStyles as cs } from "../shared/styles";
import { CHANNELS } from "../shared/constants";
import { fmtMoney } from "../shared/helpers";
import { GoalsCard } from "../components/GoalsCard";
import { useGoals } from "../hooks/useGoals";
import { useCadences } from "../hooks/useCadences";
import type { LeadGoal, Cadence, CadenceStep, LeadChannel } from "@/services/crmApi";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function GoalsView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const { goals, current, isLoading, isLoadingCurrent, upsert, update, remove } = useGoals(year);
  const cad = useCadences();

  const [editingGoal, setEditingGoal] = useState<{ month: number; goal?: LeadGoal } | null>(null);
  const [editingCadence, setEditingCadence] = useState<{ existing?: Cadence } | null>(null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View>
      {/* Meta do mes atual */}
      <GoalsCard
        data={current}
        isLoading={isLoadingCurrent}
        onEdit={() => {
          const monthGoal = goals.find((g) => {
            const d = new Date(g.reference_month);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          });
          setEditingGoal({ month: now.getMonth(), goal: monthGoal });
        }}
      />

      {/* Lista anual de metas */}
      <View style={cs.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={cs.sectionTitle}>Metas {year}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable onPress={() => setYear(year - 1)} style={[cs.actionBtn, { paddingHorizontal: 10 }]}>
              <Text style={cs.actionBtnText}>{"<"}</Text>
            </Pressable>
            <Pressable onPress={() => setYear(year + 1)} style={[cs.actionBtn, { paddingHorizontal: 10 }]}>
              <Text style={cs.actionBtnText}>{">"}</Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.violet3} style={{ padding: 20 }} />
        ) : (
          <View style={{ gap: 6 }}>
            {Array.from({ length: 12 }, (_, m) => {
              const g = goals.find((goal) => {
                const d = new Date(goal.reference_month);
                return d.getFullYear() === year && d.getMonth() === m;
              });
              const isCurrent = year === now.getFullYear() && m === now.getMonth();
              return (
                <Pressable
                  key={m}
                  onPress={() => setEditingGoal({ month: m, goal: g })}
                  style={[
                    s.monthRow,
                    isCurrent && { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
                  ]}
                >
                  <Text style={[s.monthName, isCurrent && { color: Colors.violet3 }]}>
                    {MONTH_NAMES[m]}
                  </Text>
                  {g ? (
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Text style={s.monthVal}>{g.target_contacts || 0} contatos</Text>
                      <Text style={s.monthVal}>{g.target_converted || 0} conv.</Text>
                      {g.target_mrr ? (
                        <Text style={[s.monthVal, { color: Colors.green }]}>{fmtMoney(g.target_mrr)}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={s.monthEmpty}>sem meta</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Cadencias */}
      <View style={cs.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={cs.sectionTitle}>Cadencias</Text>
          <Pressable onPress={() => setEditingCadence({})} style={[cs.actionBtn, { paddingHorizontal: 10, paddingVertical: 6 }]}>
            <Icon name="plus" size={12} color={Colors.violet3} />
            <Text style={[cs.actionBtnText, { color: Colors.violet3, fontSize: 11 }]}>Nova</Text>
          </Pressable>
        </View>

        {cad.isLoading ? (
          <ActivityIndicator color={Colors.violet3} style={{ padding: 20 }} />
        ) : cad.cadences.length === 0 ? (
          <Text style={cs.hintText}>Nenhuma cadencia ainda. Crie uma pra automatizar follow-ups.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {cad.cadences.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setEditingCadence({ existing: c })}
                style={[
                  s.cadenceRow,
                  !c.is_active && { opacity: 0.5 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.cadenceName}>{c.name}</Text>
                    {!c.is_active && (
                      <Text style={{ fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" }}>
                        Inativa
                      </Text>
                    )}
                  </View>
                  {c.description ? <Text style={s.cadenceDesc}>{c.description}</Text> : null}
                  <Text style={s.cadenceSteps}>{c.steps.length} passos</Text>
                </View>
                <Icon name="chevron-right" size={14} color={Colors.ink3} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Modal: editar meta */}
      {editingGoal && (
        <GoalEditModal
          month={editingGoal.month}
          year={year}
          goal={editingGoal.goal}
          onClose={() => setEditingGoal(null)}
          onSave={(body) => {
            upsert.mutate({ reference_month: { year, month: editingGoal.month + 1 }, ...body });
            setEditingGoal(null);
          }}
          onDelete={editingGoal.goal ? () => {
            remove.mutate(editingGoal.goal!.id);
            setEditingGoal(null);
          } : undefined}
        />
      )}

      {/* Modal: editar cadencia */}
      {editingCadence && (
        <CadenceEditModal
          existing={editingCadence.existing}
          onClose={() => setEditingCadence(null)}
          onSave={(body) => {
            if (editingCadence.existing) {
              cad.update.mutate({ id: editingCadence.existing.id, body });
            } else {
              cad.create.mutate(body as any);
            }
            setEditingCadence(null);
          }}
          onDelete={editingCadence.existing ? () => {
            cad.remove.mutate(editingCadence.existing!.id);
            setEditingCadence(null);
          } : undefined}
        />
      )}
    </View>
  );
}

// ── GoalEditModal ────────────────────────────────────────────────────────────

function GoalEditModal({ month, year, goal, onClose, onSave, onDelete }: {
  month: number;
  year: number;
  goal?: LeadGoal;
  onClose: () => void;
  onSave: (b: { target_contacts: number; target_converted: number; target_mrr?: number; notes?: string }) => void;
  onDelete?: () => void;
}) {
  const [contacts, setContacts]   = useState(String(goal?.target_contacts || ""));
  const [converted, setConverted] = useState(String(goal?.target_converted || ""));
  const [mrr, setMrr]             = useState(String(goal?.target_mrr || ""));
  const [notes, setNotes]         = useState(goal?.notes || "");

  function save() {
    onSave({
      target_contacts:  parseInt(contacts) || 0,
      target_converted: parseInt(converted) || 0,
      target_mrr:       parseFloat(mrr) || 0,
      notes:            notes.trim() || undefined,
    });
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={cs.modalOverlay} onPress={onClose}>
        <Pressable style={cs.modalBox} onPress={(e: any) => e.stopPropagation?.()}>
          <Text style={cs.modalTitle}>Meta de {MONTH_NAMES[month]}/{year}</Text>

          <Text style={cs.fieldLabel}>Contatos esperados</Text>
          <TextInput value={contacts} onChangeText={setContacts} keyboardType="number-pad" placeholder="100" placeholderTextColor={Colors.ink3} style={[cs.noteInput, { minHeight: 40 }]} />

          <Text style={cs.fieldLabel}>Conversoes esperadas</Text>
          <TextInput value={converted} onChangeText={setConverted} keyboardType="number-pad" placeholder="10" placeholderTextColor={Colors.ink3} style={[cs.noteInput, { minHeight: 40 }]} />

          <Text style={cs.fieldLabel}>MRR esperado (R$)</Text>
          <TextInput value={mrr} onChangeText={setMrr} keyboardType="decimal-pad" placeholder="2000.00" placeholderTextColor={Colors.ink3} style={[cs.noteInput, { minHeight: 40 }]} />

          <Text style={cs.fieldLabel}>Observacoes</Text>
          <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Foco em quem nesse mes?" placeholderTextColor={Colors.ink3} style={cs.noteInput} />

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={onClose} style={[cs.actionBtn, { flex: 1 }]}>
              <Text style={cs.actionBtnText}>Cancelar</Text>
            </Pressable>
            {onDelete && (
              <Pressable onPress={onDelete} style={[cs.actionBtn, { borderColor: Colors.red + "44" }]}>
                <Text style={[cs.actionBtnText, { color: Colors.red }]}>Deletar</Text>
              </Pressable>
            )}
            <Pressable onPress={save} style={[cs.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
              <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>Salvar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── CadenceEditModal ─────────────────────────────────────────────────────────

function CadenceEditModal({ existing, onClose, onSave, onDelete }: {
  existing?: Cadence;
  onClose: () => void;
  onSave: (b: { name: string; description?: string; steps: CadenceStep[]; is_active?: boolean }) => void;
  onDelete?: () => void;
}) {
  const [name, setName]               = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [steps, setSteps]             = useState<CadenceStep[]>(existing?.steps || [{ day: 0, channel: "whatsapp", template: "" }]);
  const [isActive, setIsActive]       = useState(existing?.is_active ?? true);

  function addStep() {
    const lastDay = steps.length ? steps[steps.length - 1].day : 0;
    setSteps([...steps, { day: lastDay + 3, channel: "whatsapp", template: "" }]);
  }

  function updateStep(i: number, patch: Partial<CadenceStep>) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      steps: steps.filter((s) => s.template.trim()),
      is_active: isActive,
    });
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={cs.modalOverlay} onPress={onClose}>
        <Pressable style={[cs.modalBox, { maxWidth: 580, maxHeight: "90%" }]} onPress={(e: any) => e.stopPropagation?.()}>
          <Text style={cs.modalTitle}>
            {existing ? "Editar cadencia" : "Nova cadencia"}
          </Text>

          <ScrollView style={{ maxHeight: 460 }}>
            <Text style={cs.fieldLabel}>Nome</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ex: Padrao 7 dias" placeholderTextColor={Colors.ink3} style={[cs.noteInput, { minHeight: 40 }]} />

            <Text style={cs.fieldLabel}>Descricao</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Quando usar?" placeholderTextColor={Colors.ink3} style={[cs.noteInput, { minHeight: 40 }]} />

            <Text style={cs.fieldLabel}>Passos (D0 = hoje)</Text>
            <View style={{ gap: 8 }}>
              {steps.map((step, i) => (
                <View key={i} style={s.stepBox}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 10, color: Colors.ink3, fontWeight: "700" }}>DIA</Text>
                    <TextInput
                      value={String(step.day)}
                      onChangeText={(v) => updateStep(i, { day: parseInt(v) || 0 })}
                      keyboardType="number-pad"
                      style={[cs.noteInput, { minHeight: 32, width: 60, marginBottom: 0 }]}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {CHANNELS.map((ch) => (
                          <Pressable
                            key={ch}
                            onPress={() => updateStep(i, { channel: ch })}
                            style={[cs.chip, step.channel === ch && cs.chipActive, { paddingVertical: 5, paddingHorizontal: 8 }]}
                          >
                            <Text style={[cs.chipText, step.channel === ch && cs.chipTextActive, { fontSize: 10 }]}>{ch}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                    <Pressable onPress={() => removeStep(i)}>
                      <Icon name="trash" size={14} color={Colors.red} />
                    </Pressable>
                  </View>
                  <TextInput
                    value={step.template}
                    onChangeText={(v) => updateStep(i, { template: v })}
                    placeholder="Mensagem deste passo... use {nome}"
                    placeholderTextColor={Colors.ink3}
                    multiline
                    style={[cs.noteInput, { minHeight: 60, marginBottom: 0 }]}
                  />
                </View>
              ))}
            </View>

            <Pressable onPress={addStep} style={[cs.actionBtn, { marginTop: 10, alignSelf: "flex-start" }]}>
              <Icon name="plus" size={12} color={Colors.violet3} />
              <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>Adicionar passo</Text>
            </Pressable>

            <Pressable onPress={() => setIsActive(!isActive)} style={[cs.actionBtn, { marginTop: 12, alignSelf: "flex-start" }]}>
              <Icon name={isActive ? "check" : "close"} size={12} color={isActive ? Colors.green : Colors.ink3} />
              <Text style={[cs.actionBtnText, { color: isActive ? Colors.green : Colors.ink3 }]}>
                {isActive ? "Ativa" : "Inativa"}
              </Text>
            </Pressable>
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable onPress={onClose} style={[cs.actionBtn, { flex: 1 }]}>
              <Text style={cs.actionBtnText}>Cancelar</Text>
            </Pressable>
            {onDelete && (
              <Pressable onPress={onDelete} style={[cs.actionBtn, { borderColor: Colors.red + "44" }]}>
                <Text style={[cs.actionBtnText, { color: Colors.red }]}>Deletar</Text>
              </Pressable>
            )}
            <Pressable onPress={save} disabled={!name.trim()} style={[cs.actionBtn, { flex: 1, backgroundColor: Colors.violetD, borderColor: Colors.border2 }, !name.trim() && { opacity: 0.5 }]}>
              <Text style={[cs.actionBtnText, { color: Colors.violet3 }]}>Salvar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { StyleSheet } from "react-native";

const s = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
  },
  monthName: { fontSize: 12, fontWeight: "700", color: Colors.ink, width: 50 },
  monthVal: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  monthEmpty: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  cadenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
  },
  cadenceName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  cadenceDesc: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  cadenceSteps: { fontSize: 10, color: Colors.amber, fontWeight: "600", marginTop: 4 },
  stepBox: {
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
});
