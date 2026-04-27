// ============================================================
// ConsultaEndModal — Encerramento da consulta com edicao livre.
//
// Fluxo:
//   1. Mostra resumo (procedimento, mudancas no odontograma,
//      transcricao breve) editavel via TextInput multiline.
//   2. Botao "Salvar evolucao" persiste:
//      - PATCH /dental/appointments/:aid { status: "concluido", clinical_notes }
//      - chart entries ja foram persistidos via popover; aqui so
//        confirma o appointment.
//   3. Sucesso → toast + chama onDone (que faz router.back()).
//
// PR19: Botao "Gerar resumo com IA" (intent=summarize) preenche
// o campo de procedimento com texto clinico estruturado.
// ============================================================

import { useState } from "react";
import { View, Text, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";
import { useAiAccess } from "@/hooks/useAiAccess";
import { useDentalAiConsulta } from "@/hooks/useDentalAiConsulta";
import type { ToothChange, VoiceSegment } from "@/lib/dentalConsultaTypes";

interface Props {
  open: boolean;
  appointmentId: string | null;
  patientId: string | null;
  toothChanges: ToothChange[];
  transcript: VoiceSegment[];
  procedureSeed: string;
  patientName?: string;
  onClose: () => void;
  onDone: () => void;
}

function buildToothChangesText(changes: ToothChange[]): string {
  if (changes.length === 0) return "Sem alteracoes no odontograma nesta sessao.";
  return changes
    .map((c) => `• Dente ${c.tooth_number}: ${c.prev_status || "—"} → ${c.status}${c.notes ? " (" + c.notes + ")" : ""}`)
    .join("\n");
}

function buildTranscriptSummary(segments: VoiceSegment[]): string {
  if (segments.length === 0) return "Sem transcricao por voz nesta sessao.";
  const recent = segments.slice(-10).map((s) => s.text).join(" ");
  return recent.slice(0, 600) + (recent.length > 600 ? "..." : "");
}

export function ConsultaEndModal({
  open, appointmentId, patientId, toothChanges, transcript,
  procedureSeed, patientName, onClose, onDone,
}: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const access = useAiAccess();
  const summarizeMut = useDentalAiConsulta();

  const [evolution, setEvolution] = useState(
    procedureSeed ? `Procedimento: ${procedureSeed}.\n\nSem intercorrencias. Paciente respondeu bem.` : "Procedimento realizado conforme planejado. Sem intercorrencias.",
  );
  const [toothNotes, setToothNotes] = useState(buildToothChangesText(toothChanges));
  const [transcriptSummary, setTranscriptSummary] = useState(buildTranscriptSummary(transcript));
  const [whatsappDraft, setWhatsappDraft] = useState(
    `Ola${patientName ? " " + patientName.split(/\s+/)[0] : ""}! Sua consulta foi concluida. Qualquer duvida ou desconforto, entre em contato. Bom dia!`,
  );

  function handleSummarize() {
    if (!appointmentId || !patientId || !access.canUseAi) return;
    summarizeMut.mutate(
      {
        intent: "summarize",
        appointmentId,
        patientId,
        context: {
          transcripts: transcript.map((s) => s.text),
          toothChanges: toothChanges.map((c) => ({
            tooth_number: c.tooth_number,
            prev_status: c.prev_status || null,
            status: c.status,
            notes: c.notes || null,
          })),
        },
      },
      {
        onSuccess: (res) => {
          setEvolution(res.text);
          toast.success("Resumo gerado pela IA · " + res.tokens_in + "+" + res.tokens_out + " tokens");
        },
        onError: (e: any) => toast.error(e?.data?.error || "Erro ao gerar resumo"),
      }
    );
  }

  const saveMut = useMutation({
    mutationFn: () => {
      if (!appointmentId) throw new Error("Sem appointmentId");
      const fullNotes =
        evolution +
        "\n\n— Mudancas no odontograma —\n" + toothNotes +
        "\n\n— Resumo da consulta —\n" + transcriptSummary;
      return request(`/companies/${cid}/dental/appointments/${appointmentId}`, {
        method: "PATCH",
        body: { status: "concluido", clinical_notes: fullNotes },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-hoje-appointments"] });
      qc.invalidateQueries({ queryKey: ["dental-agenda-window"] });
      qc.invalidateQueries({ queryKey: ["dental-chart"] });
      toast.success("Evolucao salva, consulta concluida");
      onDone();
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao salvar evolucao"),
  });

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 16 }}>
        <View style={{
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border,
          maxHeight: "92%", padding: 18,
        }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink, marginBottom: 4 }}>
            Encerrar consulta
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 14 }}>
            Tudo aqui e editavel. Revise antes de salvar — depois, vai pro prontuario.
          </Text>

          <ScrollView style={{ maxHeight: 460 }}>
            <SummaryCard title="📋 Procedimento realizado">
              {access.canUseAi ? (
                <Pressable
                  onPress={handleSummarize}
                  disabled={summarizeMut.isPending}
                  style={{
                    alignSelf: "flex-start", marginBottom: 8,
                    backgroundColor: "rgba(124,58,237,0.12)",
                    borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
                    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
                    flexDirection: "row", alignItems: "center", gap: 6,
                  }}>
                  {summarizeMut.isPending ? (
                    <ActivityIndicator size="small" color={DentalColors.violet} />
                  ) : (
                    <Text style={{ fontSize: 11 }}>✨</Text>
                  )}
                  <Text style={{ color: DentalColors.violet, fontSize: 10, fontWeight: "700" }}>
                    {summarizeMut.isPending ? "Gerando..." : "Gerar resumo com IA"}
                  </Text>
                </Pressable>
              ) : null}
              <TextInput
                value={evolution} onChangeText={setEvolution}
                multiline placeholderTextColor={DentalColors.ink3}
                style={editableStyle}
              />
            </SummaryCard>

            <SummaryCard title="🦷 Mudancas no odontograma">
              <TextInput
                value={toothNotes} onChangeText={setToothNotes}
                multiline placeholderTextColor={DentalColors.ink3}
                style={editableStyle}
              />
            </SummaryCard>

            <SummaryCard title="📝 Transcricao (resumo)">
              <TextInput
                value={transcriptSummary} onChangeText={setTranscriptSummary}
                multiline placeholderTextColor={DentalColors.ink3}
                style={editableStyle}
              />
            </SummaryCard>

            <SummaryCard title="📲 WhatsApp pos-procedimento (rascunho)">
              <TextInput
                value={whatsappDraft} onChangeText={setWhatsappDraft}
                multiline placeholderTextColor={DentalColors.ink3}
                style={editableStyle}
              />
              <Text style={{ fontSize: 9, color: DentalColors.ink3, marginTop: 4 }}>
                * envio automatico chega em PR futura. Por ora, copie e cole no WhatsApp Web.
              </Text>
            </SummaryCard>
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <Pressable onPress={onClose} style={btnGhostStyle}>
              <Text style={{ color: DentalColors.ink2, fontSize: 11, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              style={{
                paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8,
                backgroundColor: DentalColors.cyan,
                opacity: saveMut.isPending ? 0.7 : 1,
                flexDirection: "row", alignItems: "center", gap: 6,
              }}>
              {saveMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                {saveMut.isPending ? "Salvando..." : "Salvar evolucao · Encerrar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: DentalColors.surface,
      borderWidth: 1, borderColor: DentalColors.border,
      borderRadius: 10, padding: 12, marginBottom: 10,
    }}>
      <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const editableStyle = {
  backgroundColor: DentalColors.bg, padding: 8, borderRadius: 6,
  fontSize: 12, lineHeight: 18, color: DentalColors.ink,
  borderWidth: 1, borderColor: "transparent",
  minHeight: 70, textAlignVertical: "top" as const,
};
const btnGhostStyle = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  backgroundColor: "transparent",
  borderWidth: 1, borderColor: DentalColors.border,
};
