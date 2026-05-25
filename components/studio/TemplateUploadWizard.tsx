// ============================================================
// AURA STUDIO · Wizard: Subir template à galeria (Fase 2)
//
// Usa <StudioWorkflow> canônico — auto-save de draft.
// 4 passos:
//   1. Imagem (upload OU URL externa)
//   2. Nome + descrição + categoria
//   3. Tags
//   4. Salvar
//
// 25/05 — item #10: upload integrado via /studio/upload-mockup (R2).
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Image, Platform, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, type TemplateCategory } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { pickFileWeb, fileToBase64Web, uploadStudioMockup } from "@/services/studioUploadApi";

type Props = {
  categories: TemplateCategory[];
  onClose: () => void;
  onSaved: () => void;
};

type Draft = {
  image_url: string;
  name: string;
  description: string;
  category_id: string | null;
  tags: string[];
  newTag: string;
};

const DEFAULT_DRAFT: Draft = {
  image_url: "",
  name: "",
  description: "",
  category_id: null,
  tags: [],
  newTag: "",
};

export function TemplateUploadWizard({ categories, onClose, onSaved }: Props) {
  const { company } = useAuthStore();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [uploading, setUploading] = useState(false);
  const upd = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const canAdvance =
    step === 1 ? /^https?:\/\//.test(draft.image_url.trim()) :
    step === 2 ? draft.name.trim().length > 1 :
    true;

  async function pickAndUpload() {
    if (!company?.id) return;
    if (Platform.OS !== "web") {
      toast.error("Upload do dispositivo disponível na versão web. Use URL pública por enquanto no app.");
      return;
    }
    const file = await pickFileWeb("image/*");
    if (!file) return;
    setUploading(true);
    try {
      const { base64, content_type } = await fileToBase64Web(file);
      const r = await uploadStudioMockup(company.id, {
        content_base64: base64,
        content_type,
        kind: "template",
      });
      upd({ image_url: r.url });
      toast.success("Template enviado!");
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleConcluir() {
    if (!company?.id) return;
    try {
      await studioApi.createTemplate(company.id, {
        image_url: draft.image_url.trim(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category_id: draft.category_id,
        tags: draft.tags,
      });
      toast.success("✨ Template salvo na galeria!");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar template");
    }
  }

  function addTag() {
    const t = draft.newTag.trim().toLowerCase();
    if (!t || draft.tags.includes(t) || draft.tags.length >= 10) return;
    upd({ tags: [...draft.tags, t], newTag: "" });
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.closeRow}>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Icon name="x" size={18} color={StudioColors.ink2} />
        </Pressable>
      </View>

      <StudioWorkflow
        title="Subir template à galeria"
        steps={["Imagem", "Nome e categoria", "Tags", "Salvar"]}
        current={step}
        onBack={step > 1 ? () => setStep((x) => x - 1) : undefined}
        onNext={step < 4 ? () => setStep((x) => x + 1) : undefined}
        onConcluir={step === 4 ? handleConcluir : undefined}
        primaryDisabled={!canAdvance}
        draftKey="template-upload"
        draft={draft}
        onDraftRestored={(d: any) => setDraft({ ...DEFAULT_DRAFT, ...d })}
      >
        {step === 1 && (
          <View style={s.block}>
            <Text style={s.q}>Qual a imagem desse template?</Text>
            <Text style={s.help}>
              Suba do seu dispositivo ou cole uma URL pública (PNG/JPG/WebP até 15 MB).
            </Text>

            <Pressable onPress={pickAndUpload} disabled={uploading} style={[s.uploadBtn, uploading && { opacity: 0.6 }]}>
              {uploading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Icon name="upload" size={16} color="#fff" />
                  <Text style={s.uploadBtnTxt}>Subir do dispositivo</Text>
                </>
              )}
            </Pressable>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerTxt}>ou cole uma URL</Text>
              <View style={s.dividerLine} />
            </View>

            <TextInput
              style={s.input}
              placeholder="https://..."
              value={draft.image_url}
              onChangeText={(v) => upd({ image_url: v })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {/^https?:\/\//.test(draft.image_url.trim()) && (
              <View style={s.preview}>
                <Image source={{ uri: draft.image_url.trim() }} style={s.previewImg} />
                <Text style={s.previewCap}>Prévia</Text>
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View style={s.block}>
            <Text style={s.q}>Como esse template se chama?</Text>
            <Text style={s.help}>Nome curto e descritivo — o cliente vai ver.</Text>
            <Text style={s.label}>Nome</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Mãe coruja"
              value={draft.name}
              onChangeText={(v) => upd({ name: v })}
              maxLength={60}
            />
            <Text style={[s.label, { marginTop: 14 }]}>Descrição (opcional)</Text>
            <TextInput
              style={[s.input, { minHeight: 72 }]}
              placeholder="Detalhes pro lojista lembrar da arte"
              value={draft.description}
              onChangeText={(v) => upd({ description: v })}
              multiline
              maxLength={200}
            />

            <Text style={[s.label, { marginTop: 16 }]}>Categoria</Text>
            <View style={s.catList}>
              <Pressable
                style={[s.catItem, draft.category_id === null && s.catItemSel]}
                onPress={() => upd({ category_id: null })}
              >
                <Text style={[s.catItemTxt, draft.category_id === null && s.catItemTxtSel]}>Sem categoria</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.catItem, draft.category_id === c.id && s.catItemSel]}
                  onPress={() => upd({ category_id: c.id })}
                >
                  {c.icon && <Icon name={c.icon as any} size={12} color={draft.category_id === c.id ? "#fff" : StudioColors.ink3} />}
                  <Text style={[s.catItemTxt, draft.category_id === c.id && s.catItemTxtSel]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.block}>
            <Text style={s.q}>Adicione tags pra ajudar na busca</Text>
            <Text style={s.help}>
              Tags facilitam encontrar o template depois (ex: rosa, vintage, infantil). Até 10 tags.
            </Text>
            <View style={s.tagInputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Ex: rosa"
                value={draft.newTag}
                onChangeText={(v) => upd({ newTag: v })}
                onSubmitEditing={addTag}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <Pressable style={s.tagAddBtn} onPress={addTag}>
                <Icon name="plus" size={14} color="#fff" />
              </Pressable>
            </View>
            {draft.tags.length > 0 && (
              <View style={s.tagsList}>
                {draft.tags.map((t) => (
                  <Pressable
                    key={t}
                    style={s.tagChip}
                    onPress={() => upd({ tags: draft.tags.filter((x) => x !== t) })}
                  >
                    <Text style={s.tagChipTxt}>#{t}</Text>
                    <Icon name="x" size={10} color={StudioColors.ink3} />
                  </Pressable>
                ))}
              </View>
            )}
            {draft.tags.length === 0 && (
              <Text style={s.subHelp}>Pode pular este passo se quiser — tags são opcionais.</Text>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={s.block}>
            <Text style={s.q}>Confira antes de salvar</Text>
            <View style={s.summary}>
              {draft.image_url && <Image source={{ uri: draft.image_url }} style={s.summaryImg} />}
              <View style={{ flex: 1 }}>
                <Text style={s.summaryName}>{draft.name}</Text>
                {draft.description && <Text style={s.summaryDesc}>{draft.description}</Text>}
                {draft.category_id && (
                  <Text style={s.summaryMeta}>
                    Categoria: {categories.find((c) => c.id === draft.category_id)?.name}
                  </Text>
                )}
                <Text style={s.summaryMeta}>
                  {draft.tags.length} tag{draft.tags.length === 1 ? "" : "s"}
                  {draft.tags.length > 0 && ": " + draft.tags.map((t) => "#" + t).join(" ")}
                </Text>
              </View>
            </View>
            <Text style={[s.help, { marginTop: 16 }]}>
              Depois de salvar, vincule a produtos específicos em Estúdio › Produtos, ou deixe global pra
              aparecer em todos os personalizáveis.
            </Text>
          </View>
        )}
      </StudioWorkflow>
    </View>
  );
}

const s = StyleSheet.create({
  closeRow: { flexDirection: "row", justifyContent: "flex-end", padding: 12, backgroundColor: StudioColors.bg },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  block: { maxWidth: 540 },
  q: { fontSize: 17, fontWeight: "800", color: StudioColors.ink, letterSpacing: -0.3 },
  help: { fontSize: 13, color: StudioColors.ink3, marginTop: 4, marginBottom: 16, lineHeight: 19 },
  subHelp: { fontSize: 12, color: StudioColors.ink3, marginTop: 10 },
  label: { fontSize: 11, color: StudioColors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: StudioColors.ink5,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: StudioColors.ink,
  },

  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: StudioColors.primary,
    paddingVertical: 12, borderRadius: 12, marginBottom: 10,
  },
  uploadBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: StudioColors.ink5 },
  dividerTxt: { fontSize: 11, color: StudioColors.ink3, fontWeight: "600" },

  preview: { marginTop: 14, alignItems: "center" },
  previewImg: { width: 180, height: 180, borderRadius: 14, backgroundColor: "#fff" },
  previewCap: { fontSize: 11, color: StudioColors.ink3, marginTop: 6 },

  catList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catItem: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: StudioColors.ink5, backgroundColor: "#fff",
  },
  catItemSel: { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary },
  catItemTxt: { fontSize: 12.5, color: StudioColors.ink2, fontWeight: "600" },
  catItemTxtSel: { color: "#fff" },

  tagInputRow: { flexDirection: "row", gap: 8 },
  tagAddBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: StudioColors.accent, alignItems: "center", justifyContent: "center" },
  tagsList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: StudioColors.accentSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  tagChipTxt: { fontSize: 12, color: "#9D174D", fontWeight: "700" },

  summary: { flexDirection: "row", gap: 14, padding: 14, backgroundColor: StudioColors.paperCard, borderRadius: 14, borderWidth: 1, borderColor: StudioColors.ink5 },
  summaryImg: { width: 100, height: 100, borderRadius: 10 },
  summaryName: { fontSize: 16, fontWeight: "800", color: StudioColors.ink },
  summaryDesc: { fontSize: 12.5, color: StudioColors.ink3, marginTop: 4 },
  summaryMeta: { fontSize: 11.5, color: StudioColors.ink3, marginTop: 4 },
});

export default TemplateUploadWizard;
