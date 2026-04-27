// ============================================================
// ExamRequestModal — Selecao de exames a solicitar.
//
// Le templates `pedido_exame` (seedados em migration 063):
// RX Periapical, RX Panoramico, Tomografia CBCT, Bite-Wing,
// Hemograma, Glicemia, Pre-op completo. Multi-select; cada
// exame selecionado vira um documento via POST /dental/documents.
// ============================================================

import { useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";

interface Template {
  id: string;
  company_id: string | null;
  doc_type: string;
  name: string;
  content: string;
  variables?: string[];
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
  const [indication, setIndication] = useState("");
  const [observations, setObservations] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dental-doc-templates", cid, "pedido_exame"],
    queryFn: () =>
      request<{ templates: Template[] }>(`/companies/${cid}/dental/documents/templates?doc_type=pedido_exame`),
    enabled: !!cid && open,
    staleTime: 60000,
  });

  const templates = data?.templates || [];

  function toggle(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const emitMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const today = new Date().toLocaleDateString("pt-BR");
      const baseData = {
        paciente: patientName || "",
        data: today,
        indicacao_clinica: indication || "",
        observacoes: observations || "",
      };
      const results = [];
      for (const id of ids) {
        const tpl = templates.find((t) => t.id === id);
        if (!tpl) continue;
        const r = await request(`/companies/${cid}/dental/documents`, {
          method: "POST",
          body: {
            doc_type: "pedido_exame",
            template_id: tpl.id,
            customer_id: patientId,
            appointment_id: appointmentId || null,
            practitioner_id: practitionerId || null,
            content_data: baseData,
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
    setIndication("");
    setObservations("");
  }
  function close() { reset(); onClose(); }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 }}>
        <View style={{
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border,
          maxHeight: "90%", padding: 18,
        }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink, marginBottom: 4 }}>
            🔬 Pedido de exames
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 14 }}>
            Marque os exames a solicitar. Cada um gera um documento separado.
          </Text>

          <ScrollView style={{ maxHeight: 360 }}>
            {isLoading ? <ActivityIndicator color={DentalColors.cyan} /> : null}
            {templates.map((t) => {
              const active = selectedIds.has(t.id);
              return (
                <Pressable key={t.id} onPress={() => toggle(t.id)} style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  padding: 12, marginBottom: 6, borderRadius: 8,
                  backgroundColor: active ? DentalColors.cyanGhost : DentalColors.bg,
                  borderWidth: 1, borderColor: active ? DentalColors.cyanBorder : DentalColors.border,
                }}>
                  <View style={{
                    width: 18, height: 18, borderRadius: 4,
                    backgroundColor: active ? DentalColors.cyan : "transparent",
                    borderWidth: 1.5, borderColor: active ? DentalColors.cyan : DentalColors.ink3,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {active ? <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: DentalColors.ink }}>{t.name}</Text>
                  {t.company_id ? (
                    <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700" }}>MEU</Text>
                  ) : null}
                </Pressable>
              );
            })}
            {!isLoading && templates.length === 0 ? (
              <Text style={{ color: DentalColors.ink3, fontSize: 11, textAlign: "center", padding: 20 }}>
                Nenhum template de pedido de exame encontrado.
              </Text>
            ) : null}

            {selectedIds.size > 0 ? (
              <View style={{ marginTop: 10, padding: 12, backgroundColor: DentalColors.bg, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border }}>
                <Text style={{ fontSize: 10, color: DentalColors.cyan, fontWeight: "700", marginBottom: 6 }}>INDICACAO CLINICA (aplicada a todos)</Text>
                <TextInput
                  value={indication} onChangeText={setIndication}
                  placeholder="Ex: Avaliacao pre-cirurgia em 36"
                  placeholderTextColor={DentalColors.ink3}
                  style={inputStyle}
                />
                <Text style={{ fontSize: 10, color: DentalColors.ink3, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>OBSERVACOES (opcional)</Text>
                <TextInput
                  value={observations} onChangeText={setObservations}
                  placeholder="Notas adicionais..."
                  placeholderTextColor={DentalColors.ink3}
                  multiline
                  style={[inputStyle, { minHeight: 60, textAlignVertical: "top" as const }]}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <Text style={{ fontSize: 11, color: DentalColors.ink3 }}>
              {selectedIds.size} selecionado(s)
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={close} style={btnGhostStyle}>
                <Text style={{ color: DentalColors.ink2, fontSize: 11, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => emitMut.mutate()}
                disabled={selectedIds.size === 0 || !patientId || emitMut.isPending}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: DentalColors.cyan,
                  opacity: selectedIds.size === 0 || !patientId ? 0.5 : 1,
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
