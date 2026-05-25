// ============================================================
// AURA STUDIO · Wizard: Configurar personalização do produto
// (Fase 1 skeleton — 24/05/2026)
//
// Primeira aplicação do <StudioWorkflow> canônico.
// 4 passos: Área de impressão → Campos permitidos → Preview → Salvar.
// Auto-save de draft em AsyncStorage por draftKey.
// Submete via studioApi.saveCustomizationConfig() → PUT backend.
//
// Skeleton MVP: cada passo tem um form básico funcional, mas a
// experiência rica (drag-drop de fields, preview SVG ao vivo,
// galeria de fontes) entra em iterações da Fase 1.
// ============================================================
import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, type CustomizationConfig, type CustomizationField } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const FONTS_PRESET   = ["Pacifico", "Caveat", "Playfair Display", "Bebas Neue", "Inter"];
const COLORS_PRESET  = ["#0F172A", "#BE185D", "#7C3AED", "#1D4ED8", "#D97706", "#059669", "#EC4899", "#FFFFFF"];
const FORMATS_PRESET = ["png", "jpg", "jpeg", "pdf"];

type DraftState = {
  print_area_w: string;
  print_area_h: string;
  print_area_pos: "center" | "left" | "right";
  allow_text: boolean;
  allow_image: boolean;
  allow_template: boolean;
  text_max_chars: string;
};

const DEFAULT_DRAFT: DraftState = {
  print_area_w: "20",
  print_area_h: "8",
  print_area_pos: "center",
  allow_text: true,
  allow_image: true,
  allow_template: true,
  text_max_chars: "20",
};

export default function PersonalizacaoWizard() {
  const router = useRouter();
  const { id: productId } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT);

  const draftKey = `personalizacao-${productId}`;

  // helpers
  const updateDraft = (patch: Partial<DraftState>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const canAdvance =
    step === 1
      ? Number(draft.print_area_w) > 0 && Number(draft.print_area_h) > 0
      : step === 2
      ? draft.allow_text || draft.allow_image || draft.allow_template
      : true;

  // Monta o config final pra mandar pro backend
  function buildConfig(): CustomizationConfig {
    const fields: CustomizationField[] = [];
    if (draft.allow_text) {
      fields.push({
        id: "text",
        type: "text",
        label: "Texto personalizado",
        required: false,
        config: {
          max_chars: Number(draft.text_max_chars) || 20,
          fonts: FONTS_PRESET,
          colors: COLORS_PRESET,
        },
      });
    }
    if (draft.allow_image) {
      fields.push({
        id: "image",
        type: "image",
        label: "Sua arte",
        required: false,
        config: { formats: FORMATS_PRESET, max_mb: 10, min_dpi: 150 },
      });
    }
    if (draft.allow_template) {
      fields.push({
        id: "template",
        type: "template",
        label: "Escolher da galeria",
        required: false,
        config: { category_ids: [] },
      });
    }
    return {
      print_area: {
        width_cm: Number(draft.print_area_w),
        height_cm: Number(draft.print_area_h),
        position: draft.print_area_pos,
      },
      fields,
    };
  }

  async function handleConcluir() {
    if (!company?.id || !productId) {
      toast.error("Empresa ou produto não encontrado");
      return;
    }
    try {
      await studioApi.saveCustomizationConfig(company.id, productId, buildConfig());
      toast.success("✨ Personalização configurada!");
      router.back();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configuração");
    }
  }

  return (
    <StudioWorkflow
      title="Configurar personalização do produto"
      steps={["Área de impressão", "Campos permitidos", "Pré-visualização", "Salvar"]}
      current={step}
      onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
      onNext={step < 4 ? () => setStep((s) => s + 1) : undefined}
      onConcluir={step === 4 ? handleConcluir : undefined}
      primaryDisabled={!canAdvance}
      draftKey={draftKey}
      draft={draft}
      onDraftRestored={(d: any) => setDraft({ ...DEFAULT_DRAFT, ...d })}
    >
      {step === 1 && (
        <View style={s.stepBlock}>
          <Text style={s.q}>Qual a área de impressão da personalização?</Text>
          <Text style={s.help}>Em centímetros. Para canecas padrão use 20×8 cm.</Text>

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Largura (cm)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                value={draft.print_area_w}
                onChangeText={(v) => updateDraft({ print_area_w: v.replace(",", ".") })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Altura (cm)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                value={draft.print_area_h}
                onChangeText={(v) => updateDraft({ print_area_h: v.replace(",", ".") })}
              />
            </View>
          </View>

          <Text style={[s.label, { marginTop: 16 }]}>Posição da arte</Text>
          <View style={s.chipsRow}>
            {(["center", "left", "right"] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => updateDraft({ print_area_pos: p })}
                style={[s.chip, draft.print_area_pos === p && s.chipSel]}
              >
                <Text style={[s.chipTxt, draft.print_area_pos === p && s.chipTxtSel]}>
                  {p === "center" ? "Centralizada" : p === "left" ? "À esquerda" : "À direita"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={s.stepBlock}>
          <Text style={s.q}>O que o cliente vai poder personalizar?</Text>
          <Text style={s.help}>Marque pelo menos uma opção. Pode mudar depois.</Text>

          <Toggle
            label="Texto / Nome"
            sub="Cliente digita uma frase ou nome (ex: 'Marília 💜')"
            checked={draft.allow_text}
            onToggle={() => updateDraft({ allow_text: !draft.allow_text })}
            tone="navy"
          />
          {draft.allow_text && (
            <View style={s.subBlock}>
              <Text style={s.label}>Máximo de caracteres</Text>
              <TextInput
                style={[s.input, { width: 120 }]}
                keyboardType="number-pad"
                value={draft.text_max_chars}
                onChangeText={(v) => updateDraft({ text_max_chars: v })}
              />
              <Text style={s.subHelp}>Padrão: 20 — frases curtas funcionam melhor visualmente.</Text>
            </View>
          )}

          <Toggle
            label="Minha arte (upload)"
            sub="Cliente envia foto ou arquivo PNG/JPG/PDF (até 10 MB)"
            checked={draft.allow_image}
            onToggle={() => updateDraft({ allow_image: !draft.allow_image })}
            tone="pink"
          />

          <Toggle
            label="Galeria pronta"
            sub="Cliente escolhe de templates pré-aprovados (configurados na Galeria)"
            checked={draft.allow_template}
            onToggle={() => updateDraft({ allow_template: !draft.allow_template })}
            tone="warm"
          />
        </View>
      )}

      {step === 3 && (
        <View style={s.stepBlock}>
          <Text style={s.q}>Confira como vai ficar</Text>
          <Text style={s.help}>
            O cliente verá um preview ao vivo da arte aplicada. O renderer SVG completo vem na próxima iteração da Fase 1.
          </Text>

          <View style={s.previewCard}>
            <Text style={s.previewEyebrow}>PRÉVIA — configuração resumida</Text>
            <View style={s.previewRow}>
              <Icon name="square" size={14} color={StudioColors.primary} />
              <Text style={s.previewTxt}>
                Área de impressão: <Text style={s.previewBold}>{draft.print_area_w}×{draft.print_area_h} cm</Text>, {draft.print_area_pos === "center" ? "centralizada" : draft.print_area_pos === "left" ? "à esquerda" : "à direita"}
              </Text>
            </View>
            {draft.allow_text && (
              <View style={s.previewRow}>
                <Icon name="type" size={14} color={StudioColors.primary} />
                <Text style={s.previewTxt}>
                  Texto até <Text style={s.previewBold}>{draft.text_max_chars} caracteres</Text> com {FONTS_PRESET.length} fontes e {COLORS_PRESET.length} cores
                </Text>
              </View>
            )}
            {draft.allow_image && (
              <View style={s.previewRow}>
                <Icon name="image" size={14} color={StudioColors.primary} />
                <Text style={s.previewTxt}>
                  Upload PNG/JPG/PDF até <Text style={s.previewBold}>10 MB</Text>
                </Text>
              </View>
            )}
            {draft.allow_template && (
              <View style={s.previewRow}>
                <Icon name="grid" size={14} color={StudioColors.primary} />
                <Text style={s.previewTxt}>
                  Galeria pronta — vincule categorias em Estúdio › Galeria
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={s.stepBlock}>
          <Text style={s.q}>Tudo pronto pra salvar</Text>
          <Text style={s.help}>
            Ao salvar, este produto fica disponível como personalizável no Canal Digital.
            Você pode editar essa configuração quando quiser.
          </Text>

          <View style={[s.previewCard, { backgroundColor: StudioColors.mintSoft, borderColor: "#A7F3D0" }]}>
            <Icon name="check" size={22} color={StudioColors.mint} />
            <Text style={[s.previewEyebrow, { color: "#065F46", marginTop: 8 }]}>QUASE LÁ</Text>
            <Text style={[s.previewTxt, { fontSize: 14, marginTop: 4 }]}>
              Clique em <Text style={s.previewBold}>Concluir</Text> pra ativar a personalização e ver o produto na loja digital.
            </Text>
          </View>
        </View>
      )}
    </StudioWorkflow>
  );
}

// ─── Toggle helper ───
function Toggle({
  label, sub, checked, onToggle, tone,
}: { label: string; sub: string; checked: boolean; onToggle: () => void; tone: "navy" | "pink" | "warm" }) {
  const bg =
    tone === "navy" ? StudioColors.primary :
    tone === "pink" ? StudioColors.accent :
                      "#F59E0B";
  return (
    <Pressable onPress={onToggle} style={[s.toggleCard, checked && { borderColor: bg }]}>
      <View style={[s.toggleIco, { backgroundColor: checked ? bg : StudioColors.ink5 }]}>
        {checked && <Icon name="check" size={14} color="#fff" />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  stepBlock: { maxWidth: 620 },
  q: { fontSize: 18, fontWeight: "800", color: StudioColors.ink, letterSpacing: -0.3 },
  help: { fontSize: 13, color: StudioColors.ink3, marginTop: 4, marginBottom: 18, lineHeight: 19 },
  label: { fontSize: 12, color: StudioColors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: StudioColors.ink5,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: StudioColors.ink,
  },
  row2: { flexDirection: "row", gap: 12 },

  chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  chipSel: { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary },
  chipTxt: { fontSize: 13, fontWeight: "600", color: StudioColors.ink2 },
  chipTxtSel: { color: "#fff" },

  toggleCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: StudioColors.ink5,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  toggleIco: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  toggleLabel: { fontSize: 14.5, fontWeight: "700", color: StudioColors.ink },
  toggleSub: { fontSize: 12, color: StudioColors.ink3, marginTop: 2 },

  subBlock: {
    marginLeft: 42, marginBottom: 10, padding: 12,
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 10,
  },
  subHelp: { fontSize: 11.5, color: StudioColors.ink3, marginTop: 6 },

  previewCard: {
    backgroundColor: StudioColors.paperCard,
    borderWidth: 1, borderColor: StudioColors.ink5,
    borderRadius: 14, padding: 16,
    gap: 8,
  },
  previewEyebrow: {
    fontSize: 11, color: StudioColors.accent, fontWeight: "800",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6,
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewTxt: { fontSize: 13, color: StudioColors.ink2, flex: 1 },
  previewBold: { fontWeight: "700", color: StudioColors.ink },
});
