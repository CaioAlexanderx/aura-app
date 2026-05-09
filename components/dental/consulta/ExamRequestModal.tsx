// ============================================================
// ExamRequestModal — Selecao de exames a solicitar.
//
// PR34 (2026-04-28): backdrop centrado + sheet com maxWidth.
//
// #3  (2026-05-09): CBCT exibido como "Cone Beam" em toda UI
//     (displayExamName normaliza a string vinda do backend).
// #5  (2026-05-09): personalizacao por exame (indicacao +
//     observacoes individuais, expandiveis por linha) +
//     campo de exame personalizado (texto livre).
// ============================================================

import { useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";

// #3: normaliza nomes que chegam do backend com a sigla CBCT
function displayExamName(name: string): string {
  return name.replace(/\bCBCT\b/gi, "Cone Beam");
}

interface Template {
  id: string;
  company_id: string | null;
  doc_type: string;
  name: string;
  content: string;
  variables?: string[];
}

interface ExamDetail {
  indication: string;
  observations: string;
}

interface CustomExam {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  patientId: string | null;
  appointmentId: string | null;
  practitionerId?: string | null;
  patientName?: string;
  onClose: () => void;
  onEmitted?: (count: number) => void;
}

export function ExamRequestModal({ open, patientId, appointmentId, practitionerId, patientName, onClose, onEmitted }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Campos globais (padrao para todos os exames)
  const [indication, setIndication] = useState("");
  const [observations, setObservations] = useState("");
  // #5: personalizacao por exame
  const [examDetails, setExamDetails] = useState<Record<string, ExamDetail>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // #5: exame personalizado
  const [customExams, setCustomExams] = useState<CustomExam[]>([]);
  const [newCustomName, setNewCustomName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dental-doc-templates", cid, "pedido_exame"],
    queryFn: () =>
      request<{ templates: Template[] }>(`/companies/${cid}/dental/documents/templates?doc_type=pedido_exame`),
    enabled: !!cid && open,
    staleTime: 60000,
  });

  const templates = data?.templates || [];

  // Todos os exames da lista (templates + personalizados)
  const allExamIds = [
    ...templates.map((t) => t.id),
    ...customExams.map((e) => e.id),
  ];

  function toggle(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
        setExpandedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // #5: expandir linha de exame para mostrar campos individuais
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Prefill com valores globais se ainda nao foi personalizado
        if (!examDetails[id]) {
          setExamDetails((d) => ({ ...d, [id]: { indication, observations } }));
        }
      }
      return next;
    });
  }

  function getDetail(id: string): ExamDetail {
    return examDetails[id] ?? { indication, observations };
  }

  function setDetailField(id: string, field: keyof ExamDetail, value: string) {
    setExamDetails((prev) => ({
      ...prev,
      [id]: { ...getDetail(id), [field]: value },
    }));
  }

  const hasCustomDetail = (id: string) => !!examDetails[id];

  // #5: adicionar exame personalizado
  function addCustomExam() {
    const name = newCustomName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    setCustomExams((prev) => [...prev, { id, name }]);
    setSelectedIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    setNewCustomName("");
  }

  function removeCustomExam(id: string) {
    setCustomExams((prev) => prev.filter((e) => e.id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  const emitMut = useMutation({
    mutationFn: async () => {
      const today = new Date().toLocaleDateString("pt-BR");
      const results = [];

      // Templates selecionados
      for (const tpl of templates.filter((t) => selectedIds.has(t.id))) {
        const detail = getDetail(tpl.id);
        const r = await request(`/companies/${cid}/dental/documents`, {
          method: "POST",
          body: {
            doc_type: "pedido_exame",
            template_id: tpl.id,
            customer_id: patientId,
            appointment_id: appointmentId || null,
            practitioner_id: practitionerId || null,
            content_data: {
              paciente: patientName || "",
              data: today,
              indicacao_clinica: detail.indication || "",
              observacoes: detail.observations || "",
            },
          },
        });
        results.push(r);
      }

      // #5: exames personalizados
      for (const exam of customExams.filter((e) => selectedIds.has(e.id))) {
        const detail = getDetail(exam.id);
        const r = await request(`/companies/${cid}/dental/documents`, {
          method: "POST",
          body: {
            doc_type: "pedido_exame",
            template_id: null,
            customer_id: patientId,
            appointment_id: appointmentId || null,
            practitioner_id: practitionerId || null,
            content_data: {
              paciente: patientName || "",
              data: today,
              exame_nome: exam.name,
              indicacao_clinica: detail.indication || "",
              observacoes: detail.observations || "",
            },
          },
        });
        results.push(r);
      }

      return results;
    },
    onSuccess: (results: any[]) => {
      toast.success((results.length || 0) + " pedido(s) emitido(s)");
      qc.invalidateQueries({ queryKey: ["dental-documents", cid] });
      onEmitted?.(results.length || 0);
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao emitir pedidos"),
  });

  function reset() {
    setSelectedIds(new Set());
    setExamDetails({});
    setExpandedIds(new Set());
    setCustomExams([]);
    setNewCustomName("");
    setIndication("");
    setObservations("");
  }
  function close() { reset(); onClose(); }

  const totalSelected = selectedIds.size;

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border,
          maxHeight: "92%", padding: 18,
          width: "100%", maxWidth: 560,
        }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink }}>
              🔬 Pedido de exames
            </Text>
            <Pressable onPress={close} style={xBtn}>
              <Text style={{ color: DentalColors.ink3, fontSize: 16 }}>×</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 14 }}>
            Marque os exames. Cada um gera um documento separado. Personalize indicacao por exame se necessario.
          </Text>

          <ScrollView style={{ maxHeight: 400 }}>
            {isLoading ? <ActivityIndicator color={DentalColors.cyan} style={{ marginVertical: 20 }} /> : null}

            {/* Lista de templates */}
            {templates.map((t) => {
              const active = selectedIds.has(t.id);
              const expanded = expandedIds.has(t.id);
              const customized = hasCustomDetail(t.id);
              const detail = getDetail(t.id);
              return (
                <View key={t.id} style={{
                  marginBottom: 6, borderRadius: 8,
                  backgroundColor: active ? DentalColors.cyanGhost : DentalColors.bg,
                  borderWidth: 1, borderColor: active ? DentalColors.cyanBorder : DentalColors.border,
                  overflow: "hidden",
                }}>
                  {/* Linha principal: checkbox + nome */}
                  <Pressable onPress={() => toggle(t.id)} style={{
                    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
                  }}>
                    <View style={{
                      width: 18, height: 18, borderRadius: 4,
                      backgroundColor: active ? DentalColors.cyan : "transparent",
                      borderWidth: 1.5, borderColor: active ? DentalColors.cyan : DentalColors.ink3,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {active ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
                    </View>
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: DentalColors.ink }}>
                      {/* #3: CBCT -> Cone Beam */}
                      {displayExamName(t.name)}
                    </Text>
                    {t.company_id ? (
                      <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700" }}>MEU</Text>
                    ) : null}
                    {/* #5: botao personalizar */}
                    {active ? (
                      <Pressable
                        onPress={(e: any) => { e.stopPropagation?.(); toggleExpand(t.id); }}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: customized ? "rgba(245,158,11,0.12)" : DentalColors.bg2, borderWidth: 1, borderColor: customized ? "rgba(245,158,11,0.30)" : DentalColors.border }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "700", color: customized ? DentalColors.amber : DentalColors.ink3 }}>
                          {expanded ? "▲ FECHAR" : (customized ? "▼ EDITADO" : "▼ PERSONALIZAR")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </Pressable>

                  {/* #5: campos individuais */}
                  {active && expanded ? (
                    <View style={{ padding: 10, paddingTop: 0, gap: 6 }}>
                      <View style={{ height: 1, backgroundColor: DentalColors.border, marginBottom: 6 }} />
                      <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700" }}>INDICAÇÃO CLÍNICA</Text>
                      <TextInput
                        value={detail.indication}
                        onChangeText={(v) => setDetailField(t.id, "indication", v)}
                        placeholder="Indicacao para este exame..."
                        placeholderTextColor={DentalColors.ink3}
                        style={inputStyle}
                      />
                      <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "700" }}>OBSERVAÇÕES</Text>
                      <TextInput
                        value={detail.observations}
                        onChangeText={(v) => setDetailField(t.id, "observations", v)}
                        placeholder="Notas adicionais..."
                        placeholderTextColor={DentalColors.ink3}
                        multiline
                        style={[inputStyle, { minHeight: 54, textAlignVertical: "top" as const }]}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* #5: exames personalizados */}
            {customExams.map((exam) => {
              const active = selectedIds.has(exam.id);
              const expanded = expandedIds.has(exam.id);
              const detail = getDetail(exam.id);
              return (
                <View key={exam.id} style={{
                  marginBottom: 6, borderRadius: 8,
                  backgroundColor: active ? "rgba(167,139,250,0.10)" : DentalColors.bg,
                  borderWidth: 1, borderColor: active ? "rgba(167,139,250,0.30)" : DentalColors.border,
                  overflow: "hidden",
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
                    <Pressable
                      onPress={() => toggle(exam.id)}
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        backgroundColor: active ? DentalColors.violet : "transparent",
                        borderWidth: 1.5, borderColor: active ? DentalColors.violet : DentalColors.ink3,
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {active ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
                    </Pressable>
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: DentalColors.ink }}>{exam.name}</Text>
                    <Text style={{ fontSize: 9, color: DentalColors.violet, fontWeight: "700" }}>CUSTOM</Text>
                    {active ? (
                      <Pressable
                        onPress={() => toggleExpand(exam.id)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "700", color: DentalColors.ink3 }}>
                          {expanded ? "▲" : "▼"}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => removeCustomExam(exam.id)}
                      style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                    >
                      <Text style={{ fontSize: 12, color: DentalColors.red }}>×</Text>
                    </Pressable>
                  </View>
                  {active && expanded ? (
                    <View style={{ padding: 10, paddingTop: 0, gap: 6 }}>
                      <View style={{ height: 1, backgroundColor: DentalColors.border, marginBottom: 6 }} />
                      <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700" }}>INDICAÇÃO CLÍNICA</Text>
                      <TextInput
                        value={detail.indication}
                        onChangeText={(v) => setDetailField(exam.id, "indication", v)}
                        placeholder="Indicacao para este exame..."
                        placeholderTextColor={DentalColors.ink3}
                        style={inputStyle}
                      />
                      <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "700" }}>OBSERVAÇÕES</Text>
                      <TextInput
                        value={detail.observations}
                        onChangeText={(v) => setDetailField(exam.id, "observations", v)}
                        placeholder="Notas adicionais..."
                        placeholderTextColor={DentalColors.ink3}
                        multiline
                        style={[inputStyle, { minHeight: 54, textAlignVertical: "top" as const }]}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* #5: adicionar exame personalizado */}
            <View style={{ marginTop: 6, padding: 10, backgroundColor: DentalColors.bg, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border, borderStyle: "dashed" as const }}>
              <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "700", marginBottom: 6 }}>+ EXAME NÃO LISTADO</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TextInput
                  value={newCustomName}
                  onChangeText={setNewCustomName}
                  placeholder="Ex: Tomografia cone beam parcial, RX oclusal..."
                  placeholderTextColor={DentalColors.ink3}
                  style={[inputStyle, { flex: 1 }]}
                  onSubmitEditing={addCustomExam}
                />
                <Pressable
                  onPress={addCustomExam}
                  disabled={!newCustomName.trim()}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
                    backgroundColor: newCustomName.trim() ? DentalColors.cyan : DentalColors.bg2,
                    borderWidth: 1, borderColor: newCustomName.trim() ? DentalColors.cyan : DentalColors.border,
                  }}
                >
                  <Text style={{ color: newCustomName.trim() ? "#fff" : DentalColors.ink3, fontSize: 11, fontWeight: "700" }}>Adicionar</Text>
                </Pressable>
              </View>
            </View>

            {!isLoading && templates.length === 0 && customExams.length === 0 ? (
              <Text style={{ color: DentalColors.ink3, fontSize: 11, textAlign: "center", padding: 20 }}>
                Nenhum template encontrado. Use o campo acima para adicionar manualmente.
              </Text>
            ) : null}

            {/* Campos padrao (aplicados quando nao ha personalizacao individual) */}
            {totalSelected > 0 ? (
              <View style={{ marginTop: 10, padding: 12, backgroundColor: DentalColors.bg, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border }}>
                <Text style={{ fontSize: 10, color: DentalColors.cyan, fontWeight: "700", marginBottom: 2 }}>INDICACAO PADRAO</Text>
                <Text style={{ fontSize: 9, color: DentalColors.ink3, marginBottom: 6 }}>Aplicada a exames sem personalizacao individual</Text>
                <TextInput
                  value={indication} onChangeText={setIndication}
                  placeholder="Ex: Avaliacao pre-cirurgia em 36"
                  placeholderTextColor={DentalColors.ink3}
                  style={inputStyle}
                />
                <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>OBSERVACOES PADRAO</Text>
                <TextInput
                  value={observations} onChangeText={setObservations}
                  placeholder="Notas adicionais..."
                  placeholderTextColor={DentalColors.ink3}
                  multiline
                  style={[inputStyle, { minHeight: 54, textAlignVertical: "top" as const }]}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <Text style={{ fontSize: 11, color: DentalColors.ink3 }}>
              {totalSelected} selecionado(s)
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={close} style={btnGhostStyle}>
                <Text style={{ color: DentalColors.ink2, fontSize: 11, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => emitMut.mutate()}
                disabled={totalSelected === 0 || !patientId || emitMut.isPending}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: DentalColors.cyan,
                  opacity: totalSelected === 0 || !patientId ? 0.5 : 1,
                }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {emitMut.isPending ? "Emitindo..." : "Solicitar exames"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  backgroundColor: DentalColors.surface, borderRadius: 6,
  borderWidth: 1, borderColor: DentalColors.border,
  padding: 8, fontSize: 11, color: DentalColors.ink,
};
const btnGhostStyle = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  backgroundColor: "transparent",
  borderWidth: 1, borderColor: DentalColors.border,
};
const xBtn = {
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: "rgba(255,255,255,0.06)",
  alignItems: "center" as const, justifyContent: "center" as const,
};
