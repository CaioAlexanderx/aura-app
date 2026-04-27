// ============================================================
// RxTemplateModal — Receituario express com pre-cadastro.
//
// Usa endpoints existentes:
//   GET  /companies/:cid/dental/documents/templates?doc_type=receituario_simples
//   POST /companies/:cid/dental/documents/templates  (cadastrar novo)
//   POST /companies/:cid/dental/documents            (emite documento)
//
// Templates seedados em migration 062 (receituario_simples,
// receituario_controlado). Empresa pode criar customizados
// (company_id != NULL).
// ============================================================

import { useMemo, useState } from "react";
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
  onEmitted?: (docId: string) => void;
}

type Tab = "library" | "new";

export function RxTemplateModal({ open, patientId, appointmentId, practitionerId, patientName, onClose, onEmitted }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("library");
  const [selected, setSelected] = useState<Template | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Form de novo template
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDocType, setNewDocType] = useState<"receituario_simples" | "receituario_controlado">("receituario_simples");

  const { data, isLoading } = useQuery({
    queryKey: ["dental-doc-templates", cid, "receituario"],
    queryFn: async () => {
      const r1 = await request<{ templates: Template[] }>(
        `/companies/${cid}/dental/documents/templates?doc_type=receituario_simples`
      );
      const r2 = await request<{ templates: Template[] }>(
        `/companies/${cid}/dental/documents/templates?doc_type=receituario_controlado`
      );
      return [...(r1?.templates || []), ...(r2?.templates || [])];
    },
    enabled: !!cid && open,
    staleTime: 60000,
  });

  const templates = useMemo(() => data || [], [data]);

  const saveTemplateMut = useMutation({
    mutationFn: () =>
      request<{ template: Template }>(`/companies/${cid}/dental/documents/templates`, {
        method: "POST",
        body: { doc_type: newDocType, name: newName, content: newContent },
      }),
    onSuccess: () => {
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["dental-doc-templates", cid, "receituario"] });
      setNewName(""); setNewContent("");
      setTab("library");
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao salvar template"),
  });

  const emitMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Selecione um template");
      return request<{ document: any }>(`/companies/${cid}/dental/documents`, {
        method: "POST",
        body: {
          doc_type: selected.doc_type,
          template_id: selected.id,
          customer_id: patientId,
          appointment_id: appointmentId || null,
          practitioner_id: practitionerId || null,
          content_data: {
            paciente: patientName || "",
            data: new Date().toLocaleDateString("pt-BR"),
            ...overrides,
          },
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success("Receituario emitido");
      qc.invalidateQueries({ queryKey: ["dental-documents", cid] });
      onEmitted?.(res?.document?.id);
      onClose();
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao emitir"),
  });

  function reset() {
    setSelected(null); setOverrides({}); setTab("library");
    setNewName(""); setNewContent("");
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
            💊 Receituario express
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 14 }}>
            Templates pre-prontos. Selecione um, complete os campos e emita.
          </Text>

          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
            <Pressable onPress={() => setTab("library")} style={tab === "library" ? tabBtnActive : tabBtn}>
              <Text style={{ color: tab === "library" ? "#fff" : DentalColors.ink2, fontSize: 11, fontWeight: "700" }}>📚 Biblioteca</Text>
            </Pressable>
            <Pressable onPress={() => setTab("new")} style={tab === "new" ? tabBtnActive : tabBtn}>
              <Text style={{ color: tab === "new" ? "#fff" : DentalColors.ink2, fontSize: 11, fontWeight: "700" }}>+ Cadastrar novo</Text>
            </Pressable>
          </View>

          {tab === "library" ? (
            <ScrollView style={{ maxHeight: 400 }}>
              {isLoading ? <ActivityIndicator color={DentalColors.cyan} /> : null}
              {templates.length === 0 && !isLoading ? (
                <Text style={{ color: DentalColors.ink3, fontSize: 11, textAlign: "center", padding: 20 }}>
                  Nenhum template encontrado. Cadastre o primeiro!
                </Text>
              ) : null}
              {templates.map((t) => {
                const active = selected?.id === t.id;
                return (
                  <Pressable key={t.id} onPress={() => setSelected(t)} style={{
                    padding: 12, borderRadius: 8, marginBottom: 6,
                    backgroundColor: active ? DentalColors.cyanGhost : DentalColors.bg,
                    borderWidth: 1, borderColor: active ? DentalColors.cyanBorder : DentalColors.border,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: DentalColors.ink, flex: 1 }}>
                        {t.name}
                      </Text>
                      <Text style={{
                        fontSize: 9, color: DentalColors.ink3,
                        backgroundColor: t.company_id ? DentalColors.cyanDim : DentalColors.surface,
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                      }}>
                        {t.company_id ? "Meu" : "Padrao"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 4 }} numberOfLines={2}>
                      {t.content.split("\n").slice(0, 2).join(" · ")}
                    </Text>
                  </Pressable>
                );
              })}

              {selected && selected.variables && selected.variables.length > 0 ? (
                <View style={{ marginTop: 8, padding: 12, backgroundColor: DentalColors.bg, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border }}>
                  <Text style={{ fontSize: 10, color: DentalColors.cyan, fontWeight: "700", marginBottom: 8, letterSpacing: 1 }}>
                    PREENCHIMENTO
                  </Text>
                  {selected.variables.map((v) => {
                    if (v === "paciente" || v === "data") return null;
                    return (
                      <View key={v} style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 10, color: DentalColors.ink3, marginBottom: 4 }}>{v}</Text>
                        <TextInput
                          value={overrides[v] || ""}
                          onChangeText={(t) => setOverrides((o) => ({ ...o, [v]: t }))}
                          placeholder={"{{" + v + "}}"}
                          placeholderTextColor={DentalColors.ink3}
                          style={{
                            backgroundColor: DentalColors.surface, borderRadius: 6,
                            borderWidth: 1, borderColor: DentalColors.border,
                            padding: 8, fontSize: 11, color: DentalColors.ink,
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                <Pressable onPress={() => setNewDocType("receituario_simples")} style={newDocType === "receituario_simples" ? typeBtnActive : typeBtn}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: newDocType === "receituario_simples" ? "#fff" : DentalColors.ink2 }}>Simples</Text>
                </Pressable>
                <Pressable onPress={() => setNewDocType("receituario_controlado")} style={newDocType === "receituario_controlado" ? typeBtnActive : typeBtn}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: newDocType === "receituario_controlado" ? "#fff" : DentalColors.ink2 }}>Controlado</Text>
                </Pressable>
              </View>
              <TextInput
                value={newName} onChangeText={setNewName}
                placeholder='Nome (ex: "Pos-extracao padrao")'
                placeholderTextColor={DentalColors.ink3}
                style={inputStyle}
              />
              <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 6, marginBottom: 4 }}>
                Conteudo (use variaveis como {"{{paciente}}, {{data}}, {{posologia}}, {{medicamentos}}"}):
              </Text>
              <TextInput
                value={newContent} onChangeText={setNewContent}
                placeholder={"RECEITUARIO\n\nPaciente: {{paciente}}\nData: {{data}}\n\n{{medicamentos}}\nUso: {{posologia}}"}
                placeholderTextColor={DentalColors.ink3}
                multiline
                style={[inputStyle, { minHeight: 200, textAlignVertical: "top" as const }]}
              />
              <Pressable
                onPress={() => saveTemplateMut.mutate()}
                disabled={!newName || !newContent || saveTemplateMut.isPending}
                style={{
                  marginTop: 12, padding: 12, borderRadius: 8,
                  backgroundColor: DentalColors.violet,
                  opacity: !newName || !newContent ? 0.5 : 1,
                  alignItems: "center",
                }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                  {saveTemplateMut.isPending ? "Salvando..." : "Salvar template"}
                </Text>
              </Pressable>
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <Pressable onPress={close} style={btnGhostStyle}>
              <Text style={{ color: DentalColors.ink2, fontSize: 11, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
            {tab === "library" ? (
              <Pressable
                onPress={() => emitMut.mutate()}
                disabled={!selected || !patientId || emitMut.isPending}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: DentalColors.cyan,
                  opacity: !selected || !patientId ? 0.5 : 1,
                }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {emitMut.isPending ? "Emitindo..." : "Emitir receita"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const tabBtn = {
  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
  backgroundColor: DentalColors.surface,
  borderWidth: 1, borderColor: DentalColors.border,
};
const tabBtnActive = {
  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
  backgroundColor: DentalColors.cyan,
  borderWidth: 1, borderColor: DentalColors.cyan,
};
const typeBtn = {
  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  backgroundColor: DentalColors.surface,
  borderWidth: 1, borderColor: DentalColors.border,
};
const typeBtnActive = {
  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  backgroundColor: DentalColors.violet,
  borderWidth: 1, borderColor: DentalColors.violet,
};
const inputStyle = {
  backgroundColor: DentalColors.surface, borderRadius: 6,
  borderWidth: 1, borderColor: DentalColors.border,
  padding: 8, fontSize: 11, color: DentalColors.ink,
  marginBottom: 6,
};
const btnGhostStyle = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  backgroundColor: "transparent",
  borderWidth: 1, borderColor: DentalColors.border,
};
