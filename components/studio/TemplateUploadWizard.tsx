// ============================================================
// AURA STUDIO · TemplateUploadWizard — subir template à galeria
//
// 19/08/2026 (QA item 7) — Enxugamento: era um wizard de 4 passos
// (Imagem → Nome/categoria → Tags → Salvar) pra subir UMA imagem. O
// passo Tags era declaradamente opcional ("pode pular") e o passo 4 era
// só um resumo estático. Colapsado pra 1 tela só: imagem + nome +
// categoria + tags inline, com a prévia da imagem servindo de resumo.
// Mesma classe de corte do StudioNewProductWizard (catálogo, já
// enxugado de 4→1 nesta mesma sessão de QA).
//
// Renderizado dentro do <Modal> que o caller (app/studio/galeria.tsx)
// já controla — este componente não abre o próprio Modal, só preenche
// o conteúdo (props: categories, onClose, onSaved — mantidas iguais
// pra não quebrar o caller).
//
// Rascunho: auto-save em localStorage (mesma chave que o antigo
// StudioWorkflow usava, "studio_workflow_draft__template-upload", pra
// não deixar rascunhos pré-existentes órfãos). QA item 22: fechar no X
// agora LIMPA o rascunho — antes ficava fantasma e o próximo template
// abria preenchido com a arte abandonada.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Image, Platform, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
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

const MAX_TAGS = 10;

// ─── Rascunho (localStorage, web-only) ─────────────────────────
// Mesma chave que o StudioWorkflow (removido) usava — evita órfãos.
const DRAFT_KEY = "studio_workflow_draft__template-upload";

function loadDraft(): Partial<Draft> | null {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch { /* quota / privacy mode → ignora */ }
  return null;
}
function persistDraft(d: Draft): void {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    }
  } catch { /* ignora */ }
}
function clearDraft(): void {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  } catch { /* ignora */ }
}

/**
 * Descarta o rascunho de fora do wizard.
 *
 * O X interno passa por handleClose(), mas quem fecha o Modal por outro
 * caminho (voltar físico do Android → onRequestClose no componente pai)
 * não passava, e o rascunho abandonado reaparecia no próximo template.
 */
export function clearTemplateUploadDraft(): void {
  clearDraft();
}

export function TemplateUploadWizard({ categories, onClose, onSaved }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const upd = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // Restaura rascunho no mount
  useEffect(() => {
    const restored = loadDraft();
    if (restored) setDraft((d) => ({ ...d, ...restored }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save a cada mudança
  useEffect(() => {
    persistDraft(draft);
  }, [draft]);

  const hasValidImage = /^https?:\/\//.test(draft.image_url.trim());
  const canSave = hasValidImage && draft.name.trim().length > 1 && !saving;

  function handleClose() {
    // QA item 22: antes o X não limpava o draft — próximo template abria
    // preenchido com a arte abandonada.
    clearDraft();
    onClose();
  }

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

  async function handleSave() {
    if (!company?.id || !canSave) return;
    setSaving(true);
    try {
      await studioApi.createTemplate(company.id, {
        image_url: draft.image_url.trim(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category_id: draft.category_id,
        tags: draft.tags,
      });
      toast.success("✨ Template salvo na galeria!");
      clearDraft();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar template");
    } finally {
      setSaving(false);
    }
  }

  // QA item 21: colar "rosa, vintage, infantil" no Enter virava UMA tag só.
  // Agora faz split por vírgula/espaço, e tag duplicada ou além do limite
  // de 10 avisa por toast em vez de sumir silenciosamente.
  function addTagsFromText(raw: string) {
    const candidates = raw
      .split(/[,\n]+/)
      .flatMap((chunk) => chunk.split(/\s+/))
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    if (candidates.length === 0) {
      upd({ newTag: "" });
      return;
    }

    const next = [...draft.tags];
    let dupCount = 0;
    let limitHit = false;

    for (const c of candidates) {
      if (next.length >= MAX_TAGS) { limitHit = true; break; }
      if (next.includes(c)) { dupCount++; continue; }
      next.push(c);
    }

    upd({ tags: next, newTag: "" });

    if (limitHit) {
      toast.warning(`Máximo de ${MAX_TAGS} tags por template — o restante não foi adicionado.`);
    } else if (dupCount > 0) {
      toast.warning(dupCount === 1 ? "Essa tag já tinha sido adicionada." : `${dupCount} tags já estavam na lista.`);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>GALERIA · NOVO TEMPLATE</Text>
          <Text style={s.title}>Subir template</Text>
        </View>
        <Pressable onPress={handleClose} style={s.closeBtn}>
          <Icon name="x" size={18} color={t.ink2} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* Imagem — upload OU URL, prévia serve de resumo */}
        <Text style={s.label}>Imagem</Text>
        <Text style={s.help}>
          Suba do seu dispositivo ou cole uma URL pública (PNG/JPG/WebP até 15 MB).
        </Text>

        <View style={s.imageRow}>
          {hasValidImage ? (
            <Image source={{ uri: draft.image_url.trim() }} style={s.previewImg} />
          ) : (
            <View style={s.previewPlaceholder}>
              <Icon name="image" size={22} color={t.ink4} />
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable onPress={pickAndUpload} disabled={uploading} style={[s.uploadBtn, uploading && { opacity: 0.6 }]}>
              {uploading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Icon name="upload" size={16} color="#fff" />
                  <Text style={s.uploadBtnTxt}>Subir do dispositivo</Text>
                </>
              )}
            </Pressable>
            <TextInput
              style={s.input}
              placeholder="ou cole uma URL https://..."
              placeholderTextColor={t.ink4}
              value={draft.image_url}
              onChangeText={(v) => upd({ image_url: v })}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Nome */}
        <Text style={[s.label, { marginTop: 18 }]}>Nome</Text>
        <TextInput
          style={s.input}
          placeholder="Ex: Mãe coruja"
          placeholderTextColor={t.ink4}
          value={draft.name}
          onChangeText={(v) => upd({ name: v })}
          maxLength={60}
        />

        {/* Descrição */}
        <Text style={[s.label, { marginTop: 14 }]}>Descrição (opcional)</Text>
        <TextInput
          style={[s.input, { minHeight: 60 }]}
          placeholder="Detalhes pro lojista lembrar da arte"
          placeholderTextColor={t.ink4}
          value={draft.description}
          onChangeText={(v) => upd({ description: v })}
          multiline
          maxLength={200}
        />

        {/* Categoria */}
        <Text style={[s.label, { marginTop: 14 }]}>Categoria</Text>
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
              {c.icon && <Icon name={c.icon as any} size={12} color={draft.category_id === c.id ? "#fff" : t.ink3} />}
              <Text style={[s.catItemTxt, draft.category_id === c.id && s.catItemTxtSel]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tags — inline, opcional */}
        <Text style={[s.label, { marginTop: 14 }]}>
          Tags <Text style={s.labelHint}>(opcional, até {MAX_TAGS} — ajuda na busca depois)</Text>
        </Text>
        <View style={s.tagInputRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Ex: rosa, vintage, infantil"
            placeholderTextColor={t.ink4}
            value={draft.newTag}
            onChangeText={(v) => upd({ newTag: v })}
            onSubmitEditing={() => addTagsFromText(draft.newTag)}
            returnKeyType="done"
            autoCapitalize="none"
          />
          <Pressable style={s.tagAddBtn} onPress={() => addTagsFromText(draft.newTag)}>
            <Icon name="plus" size={14} color="#fff" />
          </Pressable>
        </View>
        {draft.tags.length > 0 && (
          <View style={s.tagsList}>
            {draft.tags.map((tag) => (
              <Pressable
                key={tag}
                style={s.tagChip}
                onPress={() => upd({ tags: draft.tags.filter((x) => x !== tag) })}
              >
                <Text style={s.tagChipTxt}>#{tag}</Text>
                <Icon name="x" size={10} color={t.ink3} />
              </Pressable>
            ))}
          </View>
        )}

        {/* QA item 25: antes mandava pra "Estúdio › Produtos" (rota morta,
            só redirect) e era texto sem CTA. Aponta pro catálogo de verdade
            e é clicável. */}
        <Pressable onPress={() => router.push("/studio/estoque" as any)} style={s.hintLink}>
          <Text style={s.hintLinkTxt}>
            Depois de salvar, vincule a produtos específicos em{" "}
            <Text style={s.hintLinkStrong}>Estúdio › Catálogo</Text>, ou deixe global pra aparecer em todos os
            personalizáveis.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={s.footer}>
        <Pressable onPress={handleClose} style={s.btnSec}>
          <Text style={s.btnSecTxt}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={!canSave} style={[s.btnPri, !canSave && { opacity: 0.45 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Icon name="check" size={14} color="#fff" />
              <Text style={s.btnPriTxt}>Salvar template</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: t.ink5,
    gap: 12,
  },
  eyebrow: { fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: t.paperCardElev,
  },

  body: { padding: 24, paddingBottom: 40, maxWidth: 560, width: "100%", alignSelf: "center" },
  label: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  labelHint: { fontWeight: "500", textTransform: "none", letterSpacing: 0, color: t.ink3, fontSize: 11 },
  help: { fontSize: 13, color: t.ink3, marginBottom: 12, lineHeight: 18 },
  input: {
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5, borderColor: t.ink5,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: t.ink,
  },

  imageRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  previewImg: { width: 88, height: 88, borderRadius: 14, backgroundColor: t.paperCardElev },
  previewPlaceholder: {
    width: 88, height: 88, borderRadius: 14, backgroundColor: t.paperCardElev,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.ink5,
  },

  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 11, borderRadius: 10,
  },
  uploadBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13.5 },

  catList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catItem: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev,
  },
  catItemSel: { backgroundColor: t.primary, borderColor: t.primary },
  catItemTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },
  catItemTxtSel: { color: "#fff" },

  tagInputRow: { flexDirection: "row", gap: 8 },
  tagAddBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
  tagsList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: t.accentSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  tagChipTxt: { fontSize: 12, color: t.accentInk ?? t.accent, fontWeight: "700" },

  hintLink: {
    marginTop: 20, padding: 12, borderRadius: 10,
    backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5,
  },
  hintLinkTxt: { fontSize: 12, color: t.ink3, lineHeight: 17 },
  hintLinkStrong: { color: t.primary, fontWeight: "700" },

  footer: {
    flexDirection: "row", justifyContent: "flex-end", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: t.ink5,
    backgroundColor: t.paperCardElev,
    gap: 12,
  },
  btnPri: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
    minWidth: 160, justifyContent: "center",
  },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSec: {
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12,
    borderWidth: 1.5, borderColor: t.ink5,
    backgroundColor: t.paperCardElev,
  },
  btnSecTxt: { color: t.ink2, fontSize: 13, fontWeight: "600" },
});

export default TemplateUploadWizard;
