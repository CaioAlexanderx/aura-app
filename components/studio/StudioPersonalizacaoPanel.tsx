// ============================================================
// AURA STUDIO · StudioPersonalizacaoPanel
//
// Sprint 1 — Unificação estoque (26/05/2026)
// Update 26/05/2026 — Verso (has_back + back_print_area + side em fields + cobrança)
//
// Painel standalone de configuração de personalização de produto.
// Vai ser usado como aba no drawer do estoque (Studio products list)
// — substituindo o fluxo separado de personalização que existia em
// /studio/(estudio)/produtos/[pid]/personalizar.
//
// Comportamento:
//   1. Carrega via studioApi.getCustomizationConfig(cid, pid)
//   2. Estado is_personalizable + config sanitizado
//   3. Toggle "Este produto aceita personalização" — chama
//      studioApi.togglePersonalizable
//   4. Se !is_personalizable → StudioEmpty com CTA
//   5. Se is_personalizable → split desktop / stack mobile:
//      - PersonalizationPreview SVG (320 desktop / 280 mobile)
//      - Form: print area + verso opcional + lista de fields + "+ Adicionar" +
//        Sugestões IA (suggestTemplates) + Preview WhatsApp + Salvar
//
// Editor CANÔNICO de personalização (19/08/2026)
//   Este painel é o único editor da coluna `customization_config`. O
//   wizard `produtos/[id]/personalizacao.tsx`, que gravava a mesma
//   coluna em outro formato, virou redirect para cá.
//
//   A forma do que se grava não mora mais aqui: mora em
//   components/studio/customizationConfig.ts. Este arquivo tem a UI e
//   nada mais. Ver docs/studio/PERSONALIZACAO_CANONICA.md para o
//   porquê — em resumo, `f_${Date.now()}` como id nunca alimentou o
//   motor visual, que lê `values.text` / `values.image` por id.
//
// Convenções (não negociar):
//   - useStudioTokens() de @/contexts/StudioThemeMode
//   - toast de @/components/Toast
//   - useMemo(() => buildStyles(t), [t])
//   - a forma do config vem de customizationConfig.ts, nunca inline
//   - Toast erro: [status] data.error || message
//   - console.log + console.error com {status, code, message, data}
//   - NUNCA logar payload completo (PII) — só counts/sizes
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  StyleSheet, ScrollView, Modal, Platform, useWindowDimensions, Switch,
} from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import {
  studioApi,
  type CustomizationConfig,
  type CustomizationField,
  type CustomizationFieldType,
  type Template,
} from "@/services/studioApi";
import { EnginePreview, invalidateProductTemplate } from "@/components/studio/visualEngine/EnginePreview";
import VisualTemplateThumb from "@/components/studio/visualEngine/VisualTemplateThumb";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { PreviewWhatsAppModal } from "@/components/studio/PreviewWhatsAppModal";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { request } from "@/services/api";
import {
  normalizeCustomizationConfig, canonicalizeIds, makeField, makeArtServiceFields,
  artSourceRequired, isArtSourceType, isArtServiceField, isArtBriefField,
  ART_SERVICE_FIELD_ID, ART_SERVICE_BRIEF_ID,
} from "@/components/studio/customizationConfig";
import {
  ART_ADJUST, ART_DESIGNER, parseArtPrice, buildArtServiceChoices,
} from "@/components/studio/artService";

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────
type Props = {
  productId: string;
  companyId: string;
  productName: string;
  productPrice: number;
  slug?: string | null;
  onSaved?: (cfg: CustomizationConfig) => void;
};

// Field side helper — backend espera "front" | "back"
type FieldSide = "front" | "back";

const FIELD_TYPE_META: Record<CustomizationFieldType, { label: string; icon: string; desc: string }> = {
  text:     { label: "Texto",     icon: "type",       desc: "Cliente digita um texto (nome, frase)" },
  color:    { label: "Cor",       icon: "droplet",    desc: "Cliente escolhe entre paleta de cores" },
  option:   { label: "Opção",     icon: "list",       desc: "Lista de escolhas (P/M/G, sabor, etc)" },
  template: { label: "Template",  icon: "image",      desc: "Cliente escolhe arte da galeria" },
  image:    { label: "Imagem",    icon: "upload",     desc: "Cliente faz upload de imagem" },
};

const POSITIONS: Array<{ value: "left" | "center" | "right"; label: string }> = [
  { value: "left",   label: "Esquerda" },
  { value: "center", label: "Centro"   },
  { value: "right",  label: "Direita"  },
];

// Presets de cor de 1 toque no editor visual de paleta (19/08/2026)
const COLOR_PRESETS = [
  "#FFFFFF", "#000000", "#EF4444", "#F97316", "#FACC15",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#94A3B8",
];

// Gera value a partir do label da opção ("Azul Marinho" → azul-marinho)
function slugifyOption(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

// ────────────────────────────────────────────────────────────
// Sanitizer
//
// Toda a forma vem de customizationConfig.ts. O que sobra aqui é a
// única decisão de UI: produto sem nenhum campo abre com um campo de
// texto, para a tela não nascer vazia.
// ────────────────────────────────────────────────────────────
function sanitizeConfig(cfg: CustomizationConfig | null | undefined): CustomizationConfig {
  const base = normalizeCustomizationConfig(cfg);
  if (base.fields.length > 0) return base;
  return normalizeCustomizationConfig({
    ...base,
    fields: [{ ...makeField("text"), label: "Nome a estampar" }],
  });
}

/**
 * Reaplica os ids canônicos depois de qualquer mudança estrutural.
 *
 * Adicionar, remover, reordenar ou trocar de lado muda quem é o
 * primeiro campo de cada tipo — e o id acompanha, porque é derivado do
 * tipo e da ordem. Chamar isto em todo mutator é o que impede o painel
 * de voltar a gravar id que não bate com o motor visual.
 */
function comIdsCanonicos(cfg: CustomizationConfig): CustomizationConfig {
  return { ...cfg, fields: canonicalizeIds(cfg.fields).fields };
}

// ── Guia de medidas ─────────────────────────────────────────
// Herdado do wizard, junto com a única tela que o oferecia. O
// storefront lê `customization_config.size_guide` e mostra o link "Ver
// guia de medidas" (SizeGuideModal); sem esta seção aqui, apagar o
// wizard apagaria a única forma de alimentar aquele link.
export type SizeGuideShape = { file_url: string; content_type: string };

const GUIA_TIPOS_ACEITOS = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf",
];
const GUIA_MAX_MB = 15;

async function uploadSizeGuide(
  companyId: string,
  file: File
): Promise<{ url: string; content_type: string }> {
  const reader = new FileReader();
  const dataUrl: string = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
  const data = await request<{ url: string }>(
    "/companies/" + companyId + "/studio/upload-mockup",
    {
      method: "POST",
      body: {
        content_base64: dataUrl.split(",")[1],
        content_type: file.type,
        filename: file.name,
      },
    }
  );
  return { url: data.url, content_type: file.type };
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export function StudioPersonalizacaoPanel({
  productId, companyId, productName, productPrice, slug, onSaved,
}: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { width: vw } = useWindowDimensions();
  const isWide = vw > 768;

  const [loading, setLoading] = useState(true);
  const [isPersonalizable, setIsPersonalizable] = useState(false);
  const [config, setConfig] = useState<CustomizationConfig>(() => sanitizeConfig(null));
  const [saving, setSaving] = useState(false);
  const [togglePending, setTogglePending] = useState(false);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showWaPreview, setShowWaPreview] = useState(false);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ template_id: string; reason: string; score: number }>>([]);
  const [suggestChecked, setSuggestChecked] = useState<Record<string, boolean>>({});

  // ── Mockup do produto (motor visual 2D/3D — 19/08/2026) ──
  // visualKey: template vinculado (null = sem mockup, preview cai no
  // SVG). visualTemplates: catálogo publicado da Aura. visualEpoch
  // força remount do EnginePreview após trocar (cache já invalidado).
  const [visualKey, setVisualKey] = useState<string | null>(null);
  const [visualTemplates, setVisualTemplates] = useState<VisualTemplate[]>([]);
  const [savingVisual, setSavingVisual] = useState(false);
  const [visualEpoch, setVisualEpoch] = useState(0);

  // ── Guia de medidas ────────────────────────────────────
  const [guideUploading, setGuideUploading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const guideInputRef = useRef<any>(null);

  // ── Verso — derive flags do config ───────────────────
  const cfgAny: any = config;
  const hasBack: boolean = !!cfgAny.has_back;
  const backChargeEnabled: boolean = !!cfgAny.back_charge_enabled;
  const backPriceDelta: number | undefined = typeof cfgAny.back_price_delta === "number" ? cfgAny.back_price_delta : undefined;
  const backPrintArea: { width_cm: number; height_cm: number; position: "left" | "center" | "right" } | undefined =
    cfgAny.back_print_area && typeof cfgAny.back_print_area === "object" ? cfgAny.back_print_area : undefined;

  // ── Serviço de arte — derive do campo art_service ────
  // O campo é `type:'option'` com `is_art_service:true`; as choices
  // carregam o price_delta de cada caminho. A UI mostra dois preços e
  // o resto é buildArtServiceChoices (compartilhado com a vitrine).
  const artField = useMemo(
    () => config.fields.find((f) => isArtServiceField(f)),
    [config.fields]
  );
  const artEnabled = !!artField;
  const artChoices = (artField?.config?.choices || []) as Array<{ value: string; price_delta?: number }>;
  const artAdjustPrice = artChoices.find((c) => c.value === ART_ADJUST)?.price_delta ?? 0;
  const artDesignPrice = artChoices.find((c) => c.value === ART_DESIGNER)?.price_delta ?? 0;

  // ── Guia de medidas — chave de raiz do config ────────
  const sizeGuide: SizeGuideShape | null =
    cfgAny.size_guide && typeof cfgAny.size_guide === "object" && cfgAny.size_guide.file_url
      ? cfgAny.size_guide
      : null;

  // Os dois campos do serviço de arte não entram na lista editável: o
  // par é ligado pelo card "Serviço premium", e deixar a lojista
  // renomear ou apagar `art_service` solto quebraria FieldArtService.
  const camposEditaveis = useMemo(
    () => config.fields.filter((f) => !isArtServiceField(f) && !isArtBriefField(f)),
    [config.fields]
  );

  // ── Origem da arte — obrigatoriedade é do grupo ──────
  // `image` e `template` preenchem o mesmo slot; um toggle só, por lado.
  // Ver o S0 da F1: dois checkboxes independentes produziram uma
  // condição impossível numa loja publicada.
  const artSourceFront = useMemo(
    () => config.fields.filter((f) => isArtSourceType(f.type) && (f as any).side !== "back"),
    [config.fields]
  );
  const artSourceBack = useMemo(
    () => config.fields.filter((f) => isArtSourceType(f.type) && (f as any).side === "back"),
    [config.fields]
  );

  // ── Counts de Frente/Verso para o sumário ────────────
  const frontFieldsCount = useMemo(
    () => config.fields.filter((f: any) => (f.side ?? "front") !== "back").length,
    [config.fields]
  );
  const backFieldsCount = useMemo(
    () => config.fields.filter((f: any) => f.side === "back").length,
    [config.fields]
  );

  // ── Load mount ─────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    studioApi.getCustomizationConfig(companyId, productId)
      .then((r) => {
        if (!mounted) return;
        setIsPersonalizable(!!r.is_personalizable);
        setConfig(sanitizeConfig(r.config));
      })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] load error", {
          status: e?.status, code: e?.code, message: e?.message, data: e?.data,
        });
        const status = e?.status ? `[${e.status}] ` : "";
        toast.error(`${status}${e?.data?.error || e?.message || "Erro ao carregar"}`);
        // Mesmo erro: garante fallback usável
        setConfig(sanitizeConfig(null));
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [companyId, productId]);

  // ── Load do mockup: vínculo do produto + catálogo publicado ──
  // Não bloqueia o painel: falha aqui só esconde o seletor.
  useEffect(() => {
    let mounted = true;
    studioVisualApi.getProductVisualTemplate(companyId, productId)
      .then((r) => { if (mounted) setVisualKey(r.visual_template_key || null); })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] visual-template load error", {
          status: e?.status, code: e?.code, message: e?.message,
        });
      });
    studioVisualApi.listVisualTemplates(companyId)
      .then((r) => { if (mounted) setVisualTemplates(r.templates || []); })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] visual-templates list error", {
          status: e?.status, code: e?.code, message: e?.message,
        });
      });
    return () => { mounted = false; };
  }, [companyId, productId]);

  // ── Troca de mockup — salva na hora (padrão do toggle de loja) ──
  async function selectVisualTemplate(key: string | null) {
    if (key === visualKey || savingVisual) return;
    const prev = visualKey;
    setSavingVisual(true);
    setVisualKey(key);
    try {
      await studioVisualApi.setProductVisualTemplate(companyId, productId, key);
      invalidateProductTemplate(companyId, productId);
      setVisualEpoch((e) => e + 1);
      toast.success(key ? "Mockup vinculado ao produto" : "Mockup removido");
      onSaved?.(config);
    } catch (e: any) {
      setVisualKey(prev);
      console.error("[StudioPersonalizacao] set visual-template error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro ao vincular mockup"}`);
    } finally {
      setSavingVisual(false);
    }
  }

  // ── previewValues — gera valores de exemplo ────────────
  const previewValues = useMemo(() => {
    const out: Record<string, any> = {};
    for (const f of config.fields) {
      if (f.type === "text") {
        out[f.id] = "João";
      } else if (f.type === "color") {
        const colors = (f.config?.colors as string[] | undefined) || ["#FFFFFF"];
        out[f.id] = colors[0];
      } else if (f.type === "option") {
        const choices = (f.config?.choices as Array<{ value: string }> | undefined) || [];
        if (choices.length > 0) out[f.id] = choices[0].value;
      }
    }
    return out;
  }, [config]);

  // ── Toggle personalizável ──────────────────────────────
  async function togglePersonalizable(next: boolean) {
    setTogglePending(true);
    console.log("[StudioPersonalizacao] toggle", { productId, next });
    try {
      const resp = await studioApi.togglePersonalizable(companyId, productId, next);
      setIsPersonalizable(!!resp.is_personalizable);
      toast.success(next ? "Personalização habilitada" : "Personalização desabilitada");
    } catch (e: any) {
      console.error("[StudioPersonalizacao] toggle error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro"}`);
    } finally {
      setTogglePending(false);
    }
  }

  // ── Mutators do config ─────────────────────────────────
  function patchPrintArea(patch: Partial<CustomizationConfig["print_area"]>) {
    setConfig((prev) => ({ ...prev, print_area: { ...prev.print_area, ...patch } }));
  }

  // Verso — toggle e mutators
  function toggleHasBack(next: boolean) {
    setConfig((prev: any) => {
      if (next) {
        const existingBack = prev.back_print_area && typeof prev.back_print_area === "object"
          ? prev.back_print_area
          : { width_cm: 10, height_cm: 10, position: "center" };
        return { ...prev, has_back: true, back_print_area: existingBack };
      }
      // Desligar: limpa back_*, força side="front" em todos os fields
      const { has_back, back_print_area, back_charge_enabled, back_price_delta, ...rest } = prev;
      return {
        ...rest,
        fields: prev.fields.map((f: any) => ({ ...f, side: "front" as FieldSide })),
      };
    });
  }
  function patchBackPrintArea(patch: Partial<{ width_cm: number; height_cm: number; position: "left" | "center" | "right" }>) {
    setConfig((prev: any) => {
      const current = prev.back_print_area && typeof prev.back_print_area === "object"
        ? prev.back_print_area
        : { width_cm: 10, height_cm: 10, position: "center" };
      return { ...prev, has_back: true, back_print_area: { ...current, ...patch } };
    });
  }
  function toggleBackCharge(next: boolean) {
    setConfig((prev: any) => {
      if (next) {
        return {
          ...prev,
          back_charge_enabled: true,
          back_price_delta: typeof prev.back_price_delta === "number" ? prev.back_price_delta : 0,
        };
      }
      const { back_charge_enabled, back_price_delta, ...rest } = prev;
      return rest;
    });
  }
  function patchBackPriceDelta(value: number) {
    setConfig((prev: any) => ({ ...prev, back_price_delta: value }));
  }

  function patchField(id: string, patch: Partial<CustomizationField> & { side?: FieldSide }) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? ({ ...f, ...patch } as any) : f)),
    }));
  }
  function patchFieldConfig(id: string, configPatch: Record<string, any>) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === id ? { ...f, config: { ...(f.config || {}), ...configPatch } } : f
      ),
    }));
  }
  function setFieldSide(id: string, side: FieldSide) {
    if (side === "back" && !hasBack) {
      toast.error("Habilite verso no topo");
      return;
    }
    // O lado entra no id (`image` na frente, `image_back` no verso),
    // então trocar de lado renumera.
    setConfig((prev) => comIdsCanonicos({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? ({ ...f, side } as any) : f)),
    }));
  }
  function removeField(id: string) {
    setConfig((prev) => comIdsCanonicos({
      ...prev,
      fields: prev.fields.filter((f) => f.id !== id),
    }));
  }
  function moveField(id: string, dir: -1 | 1) {
    setConfig((prev) => {
      const idx = prev.fields.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      // Pula os campos do serviço de arte: eles não aparecem na lista
      // (quem os edita é o card próprio), e trocar de lugar com um
      // deles seria um clique que não faz nada visível.
      let next = idx + dir;
      while (
        next >= 0 && next < prev.fields.length &&
        (isArtServiceField(prev.fields[next]) || isArtBriefField(prev.fields[next]))
      ) {
        next += dir;
      }
      if (next < 0 || next >= prev.fields.length) return prev;
      const arr = [...prev.fields];
      const [item] = arr.splice(idx, 1);
      arr.splice(next, 0, item);
      // Reordenar dois campos do mesmo tipo troca quem é o primeiro —
      // e o primeiro é quem fica com o id que o motor visual procura.
      return comIdsCanonicos({ ...prev, fields: arr });
    });
  }
  function addField(type: CustomizationFieldType) {
    setAddMenuOpen(false);
    setConfig((prev) => comIdsCanonicos({
      ...prev,
      fields: [...prev.fields, makeField(type, "front")],
    }));
  }

  // ── Origem da arte: um toggle para o grupo inteiro ─────
  function setArtSourceRequired(side: FieldSide, next: boolean) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        isArtSourceType(f.type) && ((f as any).side === "back") === (side === "back")
          ? { ...f, required: next }
          : f
      ),
    }));
  }

  // ── Serviço de arte ────────────────────────────────────
  // Liga/desliga o par art_service + briefing. Estava só no wizard, que
  // ninguém alcançava — era por isso que nenhuma lojista conseguia
  // precificar a criação de arte.
  function toggleArtService(next: boolean) {
    setConfig((prev) => {
      if (!next) {
        return {
          ...prev,
          fields: prev.fields.filter((f) => !isArtServiceField(f) && !isArtBriefField(f)),
        };
      }
      if (prev.fields.some((f) => isArtServiceField(f))) return prev;
      return { ...prev, fields: [...prev.fields, ...makeArtServiceFields(0, 0)] };
    });
  }
  function patchArtPrices(adjust: number, design: number) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        isArtServiceField(f)
          ? { ...f, config: { ...f.config, is_art_service: true, choices: buildArtServiceChoices(adjust, design) } }
          : f
      ),
    }));
  }

  // ── Guia de medidas ────────────────────────────────────
  async function handleGuideFileSelect(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    if (!file) return;
    if (!GUIA_TIPOS_ACEITOS.includes(file.type)) {
      setGuideError("Aceitos: PNG, JPG, WEBP ou PDF");
      return;
    }
    if (file.size > GUIA_MAX_MB * 1024 * 1024) {
      setGuideError(`Arquivo grande demais (max ${GUIA_MAX_MB} MB)`);
      return;
    }
    setGuideUploading(true);
    setGuideError(null);
    try {
      const { url, content_type } = await uploadSizeGuide(companyId, file);
      setConfig((prev) => ({ ...prev, size_guide: { file_url: url, content_type } } as any));
      toast.success("Guia de medidas enviado! Salve para publicar.");
      try { if (guideInputRef.current) guideInputRef.current.value = ""; } catch (_) {}
    } catch (e: any) {
      console.error("[StudioPersonalizacao] guide upload error", {
        status: e?.status, code: e?.code, message: e?.message,
      });
      setGuideError(e?.data?.error || e?.message || "Erro no upload do guia");
    } finally {
      setGuideUploading(false);
    }
  }
  function removeGuide() {
    setConfig((prev) => ({ ...prev, size_guide: null } as any));
    setGuideError(null);
  }

  // ── Save ───────────────────────────────────────────────
  async function save() {
    const cfgAnyLocal: any = config;

    // As dimensões do verso são a única validação que sobrou aqui: a
    // normalização preencheria 10×10 em silêncio, e para uma medida de
    // impressão o silêncio é pior do que o erro.
    if (cfgAnyLocal.has_back) {
      const bp = cfgAnyLocal.back_print_area;
      if (!bp || !(bp.width_cm > 0) || !(bp.height_cm > 0)) {
        toast.error("Configure as dimensões do verso");
        return;
      }
      if (cfgAnyLocal.back_charge_enabled) {
        const bpd = Number(cfgAnyLocal.back_price_delta);
        if (!Number.isFinite(bpd) || bpd < 0) {
          toast.error("Valor de cobrança inválido");
          return;
        }
      }
    }

    // Tudo o que se grava passa por aqui: ids canônicos, config
    // completo por tipo, obrigatoriedade coerente. É este ponto que
    // impede o painel de reintroduzir uma config como a da Sheid.
    const cfg = normalizeCustomizationConfig(config);
    if (!cfg.fields.length) { toast.error("Adicione 1 campo"); return; }
    setSaving(true);
    console.log("[StudioPersonalizacao] save start", {
      productId,
      fieldsCount: cfg.fields.length,
      hasBack: !!(cfg as any).has_back,
      backChargeEnabled: !!(cfg as any).back_charge_enabled,
    });
    try {
      const resp = await studioApi.saveCustomizationConfig(companyId, productId, cfg);
      console.log("[StudioPersonalizacao] save OK", resp);
      // A tela passa a mostrar o que foi gravado, não o que estava
      // digitado: a normalização pode ter renomeado ids e preenchido
      // config, e esconder isso faria o painel divergir do banco.
      setConfig(cfg);
      toast.success("Configuracao salva!");
      onSaved?.(cfg);
    } catch (e: any) {
      console.error("[StudioPersonalizacao] save error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro"}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Sugestões IA ───────────────────────────────────────
  async function fetchSuggestions() {
    setSuggestOpen(true);
    setSuggestLoading(true);
    setSuggestions([]);
    setSuggestChecked({});
    console.log("[StudioPersonalizacao] suggest start", { productId });
    try {
      const resp = await studioApi.suggestTemplates(companyId, productId);
      console.log("[StudioPersonalizacao] suggest OK", resp);
      setSuggestions(resp.suggestions || []);
      const checked: Record<string, boolean> = {};
      (resp.suggestions || []).forEach((sg) => { checked[sg.template_id] = true; });
      setSuggestChecked(checked);
      if (resp.fallback) {
        toast.success("Sugestões geradas (modo fallback)");
      }
    } catch (e: any) {
      console.error("[StudioPersonalizacao] suggest error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro nas sugestões"}`);
      setSuggestOpen(false);
    } finally {
      setSuggestLoading(false);
    }
  }

  function applySuggestions() {
    const selected = suggestions.filter((sg) => suggestChecked[sg.template_id]);
    if (selected.length === 0) { toast.error("Selecione ao menos 1 template"); setSuggestOpen(false); return; }
    // Marca como template_field existente OU cria — heurística: se ja tem template field, sobrescreve category_ids; senão cria
    setConfig((prev) => {
      const existing = prev.fields.find((f) => f.type === "template");
      if (existing) {
        return {
          ...prev,
          fields: prev.fields.map((f) =>
            f.id === existing.id
              ? { ...f, config: { ...(f.config || {}), suggested_template_ids: selected.map((sg) => sg.template_id) } }
              : f
          ),
        };
      }
      const novo = makeField("template", "front");
      return comIdsCanonicos({
        ...prev,
        fields: [
          ...prev.fields,
          {
            ...novo,
            label: "Template (sugestão IA)",
            config: { ...novo.config, suggested_template_ids: selected.map((sg) => sg.template_id) },
          } as any,
        ],
      });
    });
    setSuggestOpen(false);
    toast.success(`${selected.length} sugestão(ões) aplicada(s)`);
  }

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={t.primary} size="large" />
        <Text style={s.loadingTxt}>Carregando personalização...</Text>
      </View>
    );
  }

  // ── Disabled state ─────────────────────────────────────
  if (!isPersonalizable) {
    return (
      <View style={s.container}>
        <StudioEmpty
          icon="sparkles"
          title="Produto não aceita personalização"
          desc="Habilite pra configurar campos (texto, cor, template) que o cliente preenche ao comprar."
          primaryCta={{
            label: togglePending ? "Habilitando..." : "Habilitar personalização",
            onPress: () => togglePersonalizable(true),
          }}
        />
      </View>
    );
  }

  // ── Enabled state ──────────────────────────────────────
  const hasFields = config.fields.length > 0;
  const saveLabel = saving
    ? "Salvando..."
    : hasFields
      ? "Salvar configuração"
      : "Adicione 1 campo";
  const saveDisabled = saving || !hasFields;

  const previewBlock = (
    <View style={[s.previewCol, isWide ? s.previewColWide : s.previewColStack]}>
      <View style={s.previewCard}>
        <Text style={s.eyebrow}>PREVIEW AO VIVO</Text>
        <View style={s.previewBox}>
          <EnginePreview
            key={`${visualEpoch}-${visualKey || "none"}`}
            config={config}
            values={previewValues}
            size={isWide ? 320 : 280}
            productName={productName}
            showLabel
            companyId={companyId}
            productId={productId}
          />
        </View>
        {slug ? (
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") return;
              const url = `https://loja.getaura.com.br/${slug}/studio/${productId}`;
              try { window.open(url, "_blank"); } catch (e) {
                console.error("[StudioPersonalizacao] window.open failed", e);
              }
            }}
            style={s.linkBtn}
          >
            <Icon name="external-link" size={14} color={t.primary} />
            <Text style={s.linkBtnTxt}>Ver como cliente</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Mockup do produto — 3D (canecas) ou foto 2D. Salva na hora. */}
      {visualTemplates.length > 0 ? (
        <View style={s.mockupCard}>
          <Text style={s.eyebrow}>MOCKUP DO PRODUTO</Text>
          <Text style={s.helpTxt}>
            Como o cliente vê o produto na loja: escolha um modelo 3D ou foto. O preview acima muda na hora.
          </Text>
          <View style={s.mockupGrid}>
            <Pressable
              onPress={() => selectVisualTemplate(null)}
              disabled={savingVisual}
              style={[s.mockupItem, visualKey === null && s.mockupItemActive]}
            >
              <View style={s.mockupThumbEmpty}>
                <Icon name="x" size={16} color={t.ink4} />
              </View>
              <Text style={[s.mockupName, visualKey === null && s.mockupNameActive]} numberOfLines={2}>
                Sem mockup
              </Text>
            </Pressable>
            {visualTemplates.map((vt) => {
              const active = visualKey === vt.key;
              return (
                <Pressable
                  key={vt.key}
                  onPress={() => selectVisualTemplate(vt.key)}
                  disabled={savingVisual}
                  style={[s.mockupItem, active && s.mockupItemActive]}
                >
                  <View style={s.mockupThumbWrap}>
                    <VisualTemplateThumb kind={vt.kind} size={88} />
                    <View style={[s.mockupKindBadge, { backgroundColor: vt.kind === "model3d" ? t.accent : t.primary }]}>
                      <Text style={s.mockupKindBadgeTxt}>{vt.kind === "model3d" ? "3D" : "2D"}</Text>
                    </View>
                  </View>
                  <Text style={[s.mockupName, active && s.mockupNameActive]} numberOfLines={2}>
                    {vt.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  const formBlock = (
    <View style={[s.formCol, isWide && s.formColWide]}>
      {/* Área de impressão — Frente e Verso num card só (19/08/2026:
          eram 3 cards — toggle+sumário, frente, verso — virou 1) */}
      <View style={s.card}>
        <Text style={s.eyebrow}>ÁREA DE IMPRESSÃO</Text>

        <PrintAreaRow
          t={t}
          s={s}
          title="Frente"
          area={config.print_area}
          onPatch={(p) => patchPrintArea(p as any)}
        />

        {/* Verso: switch inline no mesmo card */}
        <View style={[s.toggleRow, s.backToggleRow]}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Tem verso?</Text>
            <Text style={s.helpTxt}>Habilite pra imprimir também no verso da peça.</Text>
          </View>
          <Switch
            value={hasBack}
            onValueChange={(v) => toggleHasBack(v)}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>

        {hasBack && backPrintArea ? (
          <View style={{ gap: 10 }}>
            <PrintAreaRow
              t={t}
              s={s}
              title="Verso"
              area={backPrintArea}
              onPatch={(p) => patchBackPrintArea(p)}
            />

            {/* Cobrança pelo verso — inline compacto */}
            <View style={s.backChargeRow}>
              <View style={s.toggleRow}>
                <Text style={[s.rowTitle, { flex: 1 }]}>Cobrar pelo verso?</Text>
                <Switch
                  value={backChargeEnabled}
                  onValueChange={(v) => toggleBackCharge(v)}
                  trackColor={{ false: t.ink5, true: t.accent }}
                  thumbColor="#fff"
                />
              </View>
              {backChargeEnabled ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={s.fieldLabel}>Valor extra (R$)</Text>
                  <TextInput
                    value={typeof backPriceDelta === "number" ? String(backPriceDelta) : ""}
                    onChangeText={(txt) => {
                      const n = Number(txt.replace(",", "."));
                      patchBackPriceDelta(Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                    keyboardType="decimal-pad"
                    style={[s.input, s.inputSm]}
                    placeholder="0,00"
                    placeholderTextColor={t.ink4}
                  />
                  <Text style={[s.helpTxt, { flex: 1 }]}>Somado ao preço quando o cliente marcar verso.</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* Fields list */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>CAMPOS</Text>
            <Text style={s.cardHeader}>O que o cliente preenche</Text>
          </View>
          <Pressable onPress={() => setAddMenuOpen(true)} style={s.smallBtn}>
            <Icon name="plus" size={14} color={t.primary} />
            <Text style={s.smallBtnTxt}>Adicionar campo</Text>
          </Pressable>
        </View>

        {config.fields.length === 0 ? (
          <Text style={s.empty}>Nenhum campo. Adicione pelo menos 1.</Text>
        ) : (
          <View style={{ gap: 10, marginTop: 6 }}>
            {camposEditaveis.map((f, i) => (
              <FieldRow
                key={f.id}
                t={t}
                s={s}
                field={f}
                index={i}
                total={camposEditaveis.length}
                hasBack={hasBack}
                onPatch={(p) => patchField(f.id, p)}
                onPatchConfig={(p) => patchFieldConfig(f.id, p)}
                onSetSide={(side) => setFieldSide(f.id, side)}
                onRemove={() => removeField(f.id)}
                onMoveUp={() => moveField(f.id, -1)}
                onMoveDown={() => moveField(f.id, 1)}
              />
            ))}
          </View>
        )}

        {/* Origem da arte — obrigatoriedade do GRUPO.
            Fica fora das linhas de campo de propósito: exigir "Foto" e
            "Template da galeria" separadamente é a condição impossível
            que travou a compra na sheid-mania. Aqui é uma pergunta só,
            e ela não tem como sair errada. */}
        {(artSourceFront.length > 0 || artSourceBack.length > 0) && (
          <View style={s.artSourceBox}>
            <Text style={s.eyebrow}>ORIGEM DA ARTE</Text>
            {artSourceFront.length > 0 && (
              <Pressable
                onPress={() => setArtSourceRequired("front", !artSourceRequired(config.fields, "front"))}
                style={s.requiredRow}
              >
                <View style={[s.checkbox, artSourceRequired(config.fields, "front") && s.checkboxOn]}>
                  {artSourceRequired(config.fields, "front") && <Icon name="check" size={11} color="#fff" />}
                </View>
                <Text style={s.requiredTxt}>
                  O cliente precisa escolher uma arte
                  {hasBack ? " (frente)" : ""}
                </Text>
              </Pressable>
            )}
            {artSourceBack.length > 0 && (
              <Pressable
                onPress={() => setArtSourceRequired("back", !artSourceRequired(config.fields, "back"))}
                style={s.requiredRow}
              >
                <View style={[s.checkbox, artSourceRequired(config.fields, "back") && s.checkboxOn]}>
                  {artSourceRequired(config.fields, "back") && <Icon name="check" size={11} color="#fff" />}
                </View>
                <Text style={s.requiredTxt}>O cliente precisa escolher uma arte (verso)</Text>
              </Pressable>
            )}
            <Text style={s.helpTxt}>
              {artSourceFront.length + artSourceBack.length > 1
                ? "Vale qualquer um dos caminhos de arte — enviar arquivo OU escolher da galeria. Não são cumulativos."
                : "Sem isso marcado, o cliente pode comprar sem enviar arte."}
              {artEnabled ? " Quem contrata a criação da arte fica dispensado." : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Serviço de arte */}
      <View style={s.card}>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>SERVIÇO PREMIUM</Text>
            <Text style={s.cardHeader}>Vocês criam ou ajustam a arte?</Text>
            <Text style={s.helpTxt}>
              Três caminhos na vitrine: o cliente manda a arte pronta, manda e vocês
              ajustam, ou vocês criam do zero. Os dois últimos entram no preço do pedido.
            </Text>
          </View>
          <Switch
            value={artEnabled}
            onValueChange={toggleArtService}
            trackColor={{ false: t.ink5, true: t.accent }}
            thumbColor="#fff"
          />
        </View>

        {artEnabled && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <View style={s.inlineRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Ajustar a arte do cliente (R$)</Text>
                <TextInput
                  value={artAdjustPrice ? String(artAdjustPrice) : ""}
                  onChangeText={(txt) => patchArtPrices(parseArtPrice(txt), artDesignPrice)}
                  keyboardType="decimal-pad"
                  style={s.input}
                  placeholder="0,00"
                  placeholderTextColor={t.ink4}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Criar a arte do zero (R$)</Text>
                <TextInput
                  value={artDesignPrice ? String(artDesignPrice) : ""}
                  onChangeText={(txt) => patchArtPrices(artAdjustPrice, parseArtPrice(txt))}
                  keyboardType="decimal-pad"
                  style={s.input}
                  placeholder="30,00"
                  placeholderTextColor={t.ink4}
                />
              </View>
            </View>
            <Text style={s.helpTxt}>
              Preço 0 mantém o caminho visível e sem custo — útil para dizer "a gente
              ajusta por nossa conta" e ainda assim saber que aquele pedido dá trabalho.
              O briefing do cliente vai junto, no campo "{ART_SERVICE_BRIEF_ID}".
            </Text>
          </View>
        )}
      </View>

      {/* Guia de medidas */}
      <View style={s.card}>
        <Text style={s.eyebrow}>GUIA DE MEDIDAS</Text>
        <Text style={s.cardHeader}>Tabela de tamanhos (opcional)</Text>
        <Text style={s.helpTxt}>
          Imagem ou PDF com as medidas do produto. O cliente vê um link
          "Ver guia de medidas" na tela de personalização.
        </Text>

        {sizeGuide ? (
          <View style={s.guidePreview}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <Icon
                name={sizeGuide.content_type === "application/pdf" ? "file_text" : "image"}
                size={16}
                color={t.primary}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.guideFileName} numberOfLines={1}>
                  {sizeGuide.content_type === "application/pdf" ? "Guia PDF enviado" : "Imagem do guia enviada"}
                </Text>
                <Text style={s.guideFileType}>{sizeGuide.content_type}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {Platform.OS === "web" && (
                <Pressable
                  onPress={() => {
                    try { window.open(sizeGuide.file_url, "_blank"); } catch (e) {
                      console.error("[StudioPersonalizacao] window.open failed", e);
                    }
                  }}
                  style={s.smallBtn}
                >
                  <Text style={s.smallBtnTxt}>Abrir</Text>
                </Pressable>
              )}
              <Pressable onPress={removeGuide} style={s.guideRemoveBtn}>
                <Text style={s.guideRemoveTxt}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ) : Platform.OS === "web" ? (
          <View style={{ marginTop: 8 }}>
            {/* @ts-ignore — label/input nativos no web */}
            <label
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 6,
                padding: 18,
                backgroundColor: t.bgSoft,
                border: "2px dashed " + t.ink5,
                borderRadius: 10,
                cursor: guideUploading ? "wait" : "pointer",
                opacity: guideUploading ? 0.6 : 1,
              } as any}
            >
              <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700" }}>
                {guideUploading ? "Enviando..." : "Escolher arquivo"}
              </Text>
              <Text style={{ fontSize: 11, color: t.ink3 }}>
                PNG, JPG, WEBP ou PDF — até {GUIA_MAX_MB} MB
              </Text>
              {/* @ts-ignore */}
              <input
                ref={guideInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                onChange={handleGuideFileSelect}
                disabled={guideUploading}
                style={{ display: "none" } as any}
              />
            </label>
          </View>
        ) : (
          <Text style={s.helpTxt}>
            Upload de guia de medidas disponível somente na versão web do Studio.
          </Text>
        )}
        {guideError && (
          <Text style={{ fontSize: 11.5, color: t.danger, marginTop: 6 }}>{guideError}</Text>
        )}
      </View>

      {/* Ações secundárias — linha discreta, sem card */}
      <View style={s.toolsRow}>
        <Pressable onPress={fetchSuggestions} style={s.toolBtn}>
          <Icon name="sparkles" size={14} color={t.accent} />
          <Text style={s.toolBtnTxt}>Sugestões IA</Text>
        </Pressable>
        <Pressable onPress={() => setShowWaPreview(true)} style={s.toolBtn}>
          <Icon name="share-2" size={14} color={t.primary} />
          <Text style={s.toolBtnTxt}>Preview WhatsApp</Text>
        </Pressable>
      </View>

      {/* Save footer */}
      <View style={s.saveBar}>
        <View style={s.saveSummary}>
          <Text style={s.saveSummaryTxt}>
            Frente: {frontFieldsCount} {frontFieldsCount === 1 ? "campo" : "campos"}
            {hasBack ? ` · Verso: ${backFieldsCount} ${backFieldsCount === 1 ? "campo" : "campos"}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={save}
          disabled={saveDisabled}
          style={[s.saveBtn, saveDisabled && { opacity: 0.5 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="check" size={14} color="#fff" />
              <Text style={s.saveTxt}>{saveLabel}</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Desativar — discreto no rodapé (era um card inteiro no topo) */}
      <Pressable
        onPress={() => togglePersonalizable(false)}
        disabled={togglePending}
        style={s.disableRow}
      >
        <Icon name="eye_off" size={13} color={t.ink3} />
        <Text style={s.disableRowTxt}>
          {togglePending ? "Aguarde..." : "Desativar personalização deste produto"}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={s.container}>
      {isWide ? (
        <View style={s.split}>
          {previewBlock}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
            {formBlock}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {previewBlock}
          {formBlock}
        </ScrollView>
      )}

      {/* Add field menu */}
      {addMenuOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
          <Pressable onPress={() => setAddMenuOpen(false)} style={s.menuOverlay}>
            <View style={s.menuCard}>
              <Text style={s.menuTitle}>Tipo de campo</Text>
              {(Object.keys(FIELD_TYPE_META) as CustomizationFieldType[]).map((tp) => {
                const meta = FIELD_TYPE_META[tp];
                return (
                  <Pressable key={tp} onPress={() => addField(tp)} style={s.menuItem}>
                    <View style={s.menuItemIcon}>
                      <Icon name={meta.icon as any} size={16} color={t.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.menuItemTitle}>{meta.label}</Text>
                      <Text style={s.menuItemDesc}>{meta.desc}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Suggestions modal */}
      {suggestOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSuggestOpen(false)}>
          <View style={s.menuOverlay}>
            <View style={[s.menuCard, { maxWidth: 480 }]}>
              <Text style={s.menuTitle}>Sugestões IA de templates</Text>
              {suggestLoading ? (
                <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color={t.primary} />
                  <Text style={s.helpTxt}>Analisando produto...</Text>
                </View>
              ) : suggestions.length === 0 ? (
                <Text style={s.empty}>Nenhuma sugestão disponível.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 360 }}>
                  {suggestions.map((sg) => {
                    const checked = !!suggestChecked[sg.template_id];
                    return (
                      <Pressable
                        key={sg.template_id}
                        onPress={() => setSuggestChecked((prev) => ({ ...prev, [sg.template_id]: !checked }))}
                        style={[s.suggestRow, checked && s.suggestRowActive]}
                      >
                        <View style={[s.checkbox, checked && s.checkboxOn]}>
                          {checked && <Icon name="check" size={12} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.menuItemTitle}>{sg.template_id}</Text>
                          <Text style={s.menuItemDesc}>{sg.reason}</Text>
                        </View>
                        <Text style={s.score}>{Math.round((sg.score || 0) * 100)}%</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              <View style={s.modalActions}>
                <Pressable onPress={() => setSuggestOpen(false)} style={s.cancelBtn}>
                  <Text style={s.cancelTxt}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={applySuggestions}
                  disabled={suggestLoading || suggestions.length === 0}
                  style={[s.applyBtn, (suggestLoading || suggestions.length === 0) && { opacity: 0.5 }]}
                >
                  <Text style={s.applyTxt}>Aplicar selecionadas</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* WhatsApp preview */}
      <PreviewWhatsAppModal
        visible={showWaPreview}
        onClose={() => setShowWaPreview(false)}
        product={{ id: productId, name: productName, price: productPrice }}
        shop={{ name: "Aura Studio", slug: slug || "loja" }}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Editores visuais de paleta e opções (19/08/2026)
//
// Substituem a edição por texto "hex:preço, hex" / "label:value:preço".
// O price_delta continua existindo — vira um input de R$ por linha —
// e a forma gravada é idêntica: `colors` (o que a vitrine desenha) +
// `choices` (de onde sai o price_delta, casado pelo hex/value).
// ────────────────────────────────────────────────────────────
type Choice = { label: string; value: string; price_delta?: number };

// ── PrintAreaRow — L × A + posição numa linha só (Frente/Verso) ──
function PrintAreaRow({
  t, s, title, area, onPatch,
}: {
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  title: string;
  area: { width_cm: number; height_cm: number; position: "left" | "center" | "right" };
  onPatch: (p: Partial<{ width_cm: number; height_cm: number; position: "left" | "center" | "right" }>) => void;
}) {
  return (
    <View style={s.paRow}>
      <Text style={s.paTitle}>{title}</Text>
      <View style={s.paControls}>
        <View style={s.paDim}>
          <TextInput
            value={String(area.width_cm)}
            onChangeText={(txt) => {
              const n = Number(txt.replace(",", "."));
              onPatch({ width_cm: Number.isFinite(n) && n > 0 ? n : 0 });
            }}
            keyboardType="decimal-pad"
            style={[s.input, s.inputSm]}
            placeholder="10"
            placeholderTextColor={t.ink4}
          />
          <Text style={s.paX}>×</Text>
          <TextInput
            value={String(area.height_cm)}
            onChangeText={(txt) => {
              const n = Number(txt.replace(",", "."));
              onPatch({ height_cm: Number.isFinite(n) && n > 0 ? n : 0 });
            }}
            keyboardType="decimal-pad"
            style={[s.input, s.inputSm]}
            placeholder="10"
            placeholderTextColor={t.ink4}
          />
          <Text style={s.paUnit}>cm</Text>
        </View>
        <View style={s.chipRow}>
          {POSITIONS.map((p) => {
            const active = area.position === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => onPatch({ position: p.value })}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── ColorPaletteEditor — swatches + preço por cor ────────────
function ColorPaletteEditor({
  t, s, config, onPatchConfig,
}: {
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  config: any;
  onPatchConfig: (p: Record<string, any>) => void;
}) {
  const [customHex, setCustomHex] = useState("#");
  const colors: string[] = (config?.colors as string[] | undefined) || [];
  const choices: Choice[] = (config?.choices as Choice[] | undefined) || [];
  const normalized = colors.map((c) => c.toUpperCase());

  function commit(nextColors: string[], nextChoices: Choice[]) {
    // choices só carrega quem tem preço — mesma forma de textoParaCor
    onPatchConfig({
      colors: nextColors,
      choices: nextChoices.filter((c) => (c.price_delta || 0) > 0),
    });
  }
  function addColor(hex: string) {
    const up = hex.toUpperCase();
    if (!isValidHex(up) || normalized.includes(up)) return;
    commit([...colors, up], choices);
  }
  function removeColor(hex: string) {
    commit(
      colors.filter((c) => c.toUpperCase() !== hex.toUpperCase()),
      choices.filter((c) => c.value.toUpperCase() !== hex.toUpperCase()),
    );
  }
  function setColorPrice(hex: string, raw: string) {
    const delta = parseArtPrice(raw);
    const rest = choices.filter((c) => c.value !== hex);
    commit(colors, delta > 0 ? [...rest, { label: hex, value: hex, price_delta: delta }] : rest);
  }
  function priceOf(hex: string): string {
    const d = choices.find((c) => c.value === hex)?.price_delta;
    return d ? String(d) : "";
  }
  function submitCustom() {
    const v = customHex.trim().toUpperCase();
    if (!isValidHex(v)) { toast.error("Cor inválida — use o formato #RRGGBB"); return; }
    addColor(v);
    setCustomHex("#");
  }

  const availablePresets = COLOR_PRESETS.filter((p) => !normalized.includes(p));

  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      <Text style={s.fieldLabel}>
        Paleta ({colors.length} {colors.length === 1 ? "cor" : "cores"}) — R$ cobra a mais por cor
      </Text>
      {colors.length === 0 ? (
        <Text style={s.helpTxt}>Nenhuma cor. Adicione abaixo.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {colors.map((c) => (
            <View key={c} style={s.colorRow}>
              <View style={[s.swatch, { backgroundColor: c }]} />
              <Text style={s.colorHex}>{c.toUpperCase()}</Text>
              <View style={s.colorPriceWrap}>
                <Text style={s.colorPricePrefix}>+R$</Text>
                <TextInput
                  value={priceOf(c)}
                  onChangeText={(txt) => setColorPrice(c, txt)}
                  keyboardType="decimal-pad"
                  style={s.colorPriceInput}
                  placeholder="0"
                  placeholderTextColor={t.ink4}
                />
              </View>
              <Pressable onPress={() => removeColor(c)} hitSlop={6} style={s.iconBtn}>
                <Icon name="x" size={12} color={t.ink3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={s.fieldLabel}>Adicionar</Text>
      <View style={s.swatchRow}>
        {availablePresets.map((p) => (
          <Pressable key={p} onPress={() => addColor(p)} style={s.swatchWrap}>
            <View style={[s.swatch, s.swatchPreset, { backgroundColor: p }]} />
          </Pressable>
        ))}
        {Platform.OS === "web" ? (
          // Color picker nativo do browser — 1 clique pra cor exata
          // @ts-ignore — input DOM no web
          <input
            type="color"
            value={isValidHex(customHex) ? customHex : "#888888"}
            onChange={(e: any) => setCustomHex(String(e.target.value || "").toUpperCase())}
            style={{
              width: 30, height: 30, padding: 0, border: `1.5px dashed ${t.ink4}`,
              borderRadius: 8, background: "transparent", cursor: "pointer",
            } as any}
            title="Escolher cor exata"
          />
        ) : (
          <TextInput
            value={customHex}
            onChangeText={setCustomHex}
            style={[s.input, s.inputSm, { minWidth: 90 }]}
            placeholder="#RRGGBB"
            placeholderTextColor={t.ink4}
            autoCapitalize="characters"
          />
        )}
        <Pressable
          onPress={submitCustom}
          style={[s.smallBtn, !isValidHex(customHex) && { opacity: 0.5 }]}
          disabled={!isValidHex(customHex)}
        >
          <Icon name="plus" size={12} color={t.primary} />
          <Text style={s.smallBtnTxt}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── OptionChoicesEditor — linhas com preço + adicionar por rótulo ──
function OptionChoicesEditor({
  t, s, choices, onChange,
}: {
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addChoice() {
    const label = draft.trim();
    if (!label) return;
    if (choices.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Essa opção já existe");
      return;
    }
    let value = slugifyOption(label) || `op-${choices.length + 1}`;
    if (choices.some((c) => c.value === value)) {
      let i = 2;
      while (choices.some((c) => c.value === `${value}-${i}`)) i++;
      value = `${value}-${i}`;
    }
    onChange([...choices, { label, value }]);
    setDraft("");
  }
  function removeChoice(value: string) {
    onChange(choices.filter((c) => c.value !== value));
  }
  function setPrice(value: string, raw: string) {
    const delta = parseArtPrice(raw);
    onChange(choices.map((c) => {
      if (c.value !== value) return c;
      const { price_delta, ...rest } = c;
      return delta > 0 ? { ...rest, price_delta: delta } : rest;
    }));
  }

  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      <Text style={s.fieldLabel}>Opções ({choices.length}) — R$ cobra a mais na opção</Text>
      {choices.length === 0 ? (
        <Text style={s.helpTxt}>Nenhuma opção. Adicione abaixo (ex: P, M, G).</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {choices.map((c) => (
            <View key={c.value} style={s.colorRow}>
              <Text style={[s.colorHex, { flex: 1 }]} numberOfLines={1}>{c.label}</Text>
              <View style={s.colorPriceWrap}>
                <Text style={s.colorPricePrefix}>+R$</Text>
                <TextInput
                  value={c.price_delta ? String(c.price_delta) : ""}
                  onChangeText={(txt) => setPrice(c.value, txt)}
                  keyboardType="decimal-pad"
                  style={s.colorPriceInput}
                  placeholder="0"
                  placeholderTextColor={t.ink4}
                />
              </View>
              <Pressable onPress={() => removeChoice(c.value)} hitSlop={6} style={s.iconBtn}>
                <Icon name="x" size={12} color={t.ink3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addChoice}
          style={[s.input, s.inputSm, { flex: 1, width: undefined, textAlign: "left" as any }]}
          placeholder="Nova opção (ex: Azul marinho)"
          placeholderTextColor={t.ink4}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <Pressable
          onPress={addChoice}
          style={[s.smallBtn, !draft.trim() && { opacity: 0.5 }]}
          disabled={!draft.trim()}
        >
          <Icon name="plus" size={12} color={t.primary} />
          <Text style={s.smallBtnTxt}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// FieldRow — edição inline de um campo
// ────────────────────────────────────────────────────────────
function FieldRow({
  t, s, field, index, total, hasBack, onPatch, onPatchConfig, onSetSide, onRemove, onMoveUp, onMoveDown,
}: {
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  field: CustomizationField & { side?: FieldSide };
  index: number;
  total: number;
  hasBack: boolean;
  onPatch: (p: Partial<CustomizationField>) => void;
  onPatchConfig: (p: Record<string, any>) => void;
  onSetSide: (side: FieldSide) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = FIELD_TYPE_META[field.type];
  const currentSide: FieldSide = (field.side ?? "front") as FieldSide;
  return (
    <View style={s.fieldCard}>
      <View style={s.fieldHead}>
        <View style={s.fieldIcon}>
          <Icon name={meta.icon as any} size={14} color={t.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldType}>{meta.label.toUpperCase()}</Text>
          <TextInput
            value={field.label}
            onChangeText={(txt) => onPatch({ label: txt })}
            style={s.fieldLabelInput}
            placeholder="Rótulo do campo"
            placeholderTextColor={t.ink4}
          />
        </View>
        <View style={s.fieldActions}>
          <Pressable onPress={onMoveUp} disabled={index === 0} style={[s.iconBtn, index === 0 && { opacity: 0.3 }]}>
            <Icon name="chevron-up" size={14} color={t.ink2} />
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={index === total - 1} style={[s.iconBtn, index === total - 1 && { opacity: 0.3 }]}>
            <Icon name="chevron-down" size={14} color={t.ink2} />
          </Pressable>
          <Pressable onPress={onRemove} style={s.iconBtn}>
            <Icon name="trash-2" size={14} color={t.danger} />
          </Pressable>
        </View>
      </View>

      <View style={s.fieldBody}>
        <View style={s.fieldInlineRow}>
          {/* Origem da arte não tem checkbox próprio: a pergunta é do
              grupo e vive no fim da lista. Ver o S0 da F1. */}
          {isArtSourceType(field.type) ? (
            <Text style={s.helpTxt}>
              Obrigatoriedade em "Origem da arte", no fim da lista — vale para
              enviar arquivo e escolher da galeria ao mesmo tempo.
            </Text>
          ) : (
            <Pressable
              onPress={() => onPatch({ required: !field.required })}
              style={s.requiredRow}
            >
              <View style={[s.checkbox, field.required && s.checkboxOn]}>
                {field.required && <Icon name="check" size={11} color="#fff" />}
              </View>
              <Text style={s.requiredTxt}>Obrigatório</Text>
            </Pressable>
          )}

          {/* Side picker — só aparece se o produto tem verso (19/08/2026:
              chip Verso desabilitado em todo campo era só ruído) */}
          {hasBack ? (
            <View style={s.sideRow}>
              <Text style={s.sideLabel}>Lado:</Text>
              <Pressable
                onPress={() => onSetSide("front")}
                style={[s.sideChip, currentSide === "front" && s.sideChipActive]}
              >
                <Text style={[s.sideChipTxt, currentSide === "front" && s.sideChipTxtActive]}>Frente</Text>
              </Pressable>
              <Pressable
                onPress={() => onSetSide("back")}
                style={[s.sideChip, currentSide === "back" && s.sideChipActiveBack]}
              >
                <Text style={[s.sideChipTxt, currentSide === "back" && { color: t.accent }]}>Verso</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {field.type === "text" && (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.fieldLabel}>Max caracteres</Text>
            <TextInput
              value={String((field.config?.max_chars as number) || "")}
              onChangeText={(txt) => {
                const n = Number(txt);
                onPatchConfig({ max_chars: Number.isFinite(n) && n > 0 ? n : undefined });
              }}
              keyboardType="number-pad"
              style={[s.input, s.inputSm]}
              placeholder="30"
              placeholderTextColor={t.ink4}
            />
          </View>
        )}

        {field.type === "color" && (
          <ColorPaletteEditor
            t={t}
            s={s}
            config={field.config}
            onPatchConfig={onPatchConfig}
          />
        )}

        {field.type === "option" && !isArtServiceField(field) && (
          <OptionChoicesEditor
            t={t}
            s={s}
            choices={(field.config?.choices as Choice[] | undefined) || []}
            onChange={(choices) => onPatchConfig({ choices })}
          />
        )}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    container: { padding: 20, gap: 16, backgroundColor: t.bg, flex: 1 },

    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
    loadingTxt: { fontSize: 13, color: t.ink3, fontWeight: "600" },

    split: { flex: 1, flexDirection: "row", gap: 20 },

    previewCol: { gap: 12 },
    previewColWide: { width: 360, position: "sticky" as any, top: 0, alignSelf: "flex-start" as any },
    previewColStack: { marginBottom: 16 },

    previewCard: {
      backgroundColor: t.paperCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 16,
      gap: 10,
      alignItems: "center",
    },

    previewBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
    },

    linkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.primaryBorder,
      backgroundColor: t.primaryGhost,
    },
    linkBtnTxt: { color: t.primary, fontSize: 12, fontWeight: "800" },

    formCol: { gap: 12 },
    formColWide: { flex: 1 },

    card: {
      backgroundColor: t.paperCard,
      borderColor: t.ink5,
      borderWidth: 1,
      borderRadius: 14,
      padding: 16,
      gap: 8,
    },
    cardHeader: { fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
    cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    eyebrow: {
      color: t.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    helpTxt: { fontSize: 12, color: t.ink3, marginTop: 2 },
    empty: { fontSize: 12, color: t.ink3, fontStyle: "italic", textAlign: "center", padding: 16 },

    toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },

    summaryRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 10,
    },
    summaryPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.primarySoft,
      borderWidth: 1,
      borderColor: t.primaryBorder,
    },
    summaryPillBack: {
      backgroundColor: t.accentSoft,
      borderColor: t.accent,
    },
    summaryPillTxt: {
      fontSize: 11,
      fontWeight: "800",
      color: t.primary,
      letterSpacing: 0.2,
    },

    inlineRow: { flexDirection: "row", gap: 10, marginTop: 6 },

    fieldLabel: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    input: {
      backgroundColor: t.bgSoft,
      color: t.ink,
      padding: 12,
      borderRadius: 10,
      fontSize: 14,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },

    chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: t.bgSoft,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },
    chipActive: { backgroundColor: t.primarySoft, borderColor: t.primary },
    chipTxt: { fontSize: 12, color: t.ink2, fontWeight: "700" },
    chipTxtActive: { color: t.primary },

    smallBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.primaryBorder,
      backgroundColor: t.primaryGhost,
    },
    smallBtnTxt: { color: t.primary, fontSize: 12, fontWeight: "800" },

    fieldCard: {
      backgroundColor: t.paperCardElev,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.ink5,
      overflow: "hidden",
    },
    fieldHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    fieldIcon: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: t.primarySoft,
      alignItems: "center", justifyContent: "center",
    },
    fieldType: { fontSize: 10, color: t.ink3, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
    fieldLabelInput: {
      fontSize: 14,
      color: t.ink,
      fontWeight: "700",
      padding: 0,
      marginTop: 2,
    },
    fieldActions: { flexDirection: "row", gap: 4 },
    iconBtn: {
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: t.bgSoft,
      alignItems: "center", justifyContent: "center",
    },
    fieldBody: { padding: 12, gap: 6 },

    sideRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    sideLabel: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginRight: 4,
    },
    sideChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.bgSoft,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },
    sideChipActive: {
      backgroundColor: t.primarySoft,
      borderColor: t.primary,
    },
    sideChipActiveBack: {
      backgroundColor: t.accentSoft,
      borderColor: t.accent,
    },
    sideChipDisabled: {
      opacity: 0.45,
    },
    sideChipTxt: {
      fontSize: 11,
      fontWeight: "800",
      color: t.ink2,
    },
    sideChipTxtActive: {
      color: t.primary,
    },

    requiredRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    requiredTxt: { fontSize: 12, color: t.ink2, fontWeight: "700" },

    artSourceBox: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      gap: 4,
    },

    swatchRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
    swatch: {
      width: 30, height: 30, borderRadius: 8,
      borderWidth: 1.5, borderColor: t.ink5,
    },
    swatchWrap: { position: "relative" },
    swatchPreset: {
      opacity: 0.9,
      borderStyle: "dashed" as any,
    },

    // Linhas do editor visual de cor/opção (swatch + preço + remover)
    colorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: t.bgSoft,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    colorHex: { fontSize: 12, fontWeight: "700", color: t.ink, minWidth: 76 },
    colorPriceWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginLeft: "auto" as any,
    },
    colorPricePrefix: { fontSize: 11, fontWeight: "700", color: t.ink3 },
    colorPriceInput: {
      width: 54,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      fontSize: 12,
      fontWeight: "700",
      color: t.ink,
      textAlign: "right" as any,
    },

    // Área de impressão — linha compacta (Frente/Verso no mesmo card)
    paRow: { gap: 8 },
    paTitle: { fontSize: 13, fontWeight: "800", color: t.ink },
    paControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    paDim: { flexDirection: "row", alignItems: "center", gap: 6 },
    paX: { fontSize: 13, color: t.ink3, fontWeight: "700" },
    paUnit: { fontSize: 12, color: t.ink3, fontWeight: "700" },
    rowTitle: { fontSize: 14, fontWeight: "800", color: t.ink },
    backToggleRow: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
    },
    backChargeRow: {
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: t.bgSoft,
    },
    inputSm: {
      paddingVertical: 7,
      paddingHorizontal: 10,
      fontSize: 13,
      width: 64,
      textAlign: "center" as any,
    },
    fieldInlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
    },

    // Desativar personalização — rodapé discreto
    disableRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    disableRowTxt: {
      fontSize: 12,
      color: t.ink3,
      fontWeight: "600",
      textDecorationLine: "underline",
    },

    // Seletor de mockup (motor visual 2D/3D)
    mockupCard: {
      backgroundColor: t.paperCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 14,
      gap: 8,
    },
    mockupGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    mockupItem: {
      width: 100,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.bgSoft,
      padding: 6,
      gap: 6,
      alignItems: "center",
    },
    mockupItemActive: {
      borderColor: t.primary,
      backgroundColor: t.primarySoft,
    },
    mockupThumbWrap: {
      width: 88,
      height: 67,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: t.bgSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    mockupThumbEmpty: {
      width: 88,
      height: 67,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: t.ink5,
      borderStyle: "dashed" as any,
      alignItems: "center",
      justifyContent: "center",
    },
    mockupKindBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    mockupKindBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
    mockupName: {
      fontSize: 10.5,
      color: t.ink2,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 13,
    },
    mockupNameActive: { color: t.primary },

    guidePreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      backgroundColor: t.bgSoft,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    guideFileName: { fontSize: 13, fontWeight: "700", color: t.ink },
    guideFileType: { fontSize: 10.5, color: t.ink4, marginTop: 1 },
    guideRemoveBtn: {
      paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: t.dangerSoft,
      backgroundColor: t.dangerSoft,
    },
    guideRemoveTxt: { fontSize: 12, fontWeight: "800", color: t.danger },

    checkbox: {
      width: 18, height: 18, borderRadius: 4,
      borderWidth: 1.5, borderColor: t.ink4,
      backgroundColor: "transparent",
      alignItems: "center", justifyContent: "center",
    },
    checkboxOn: { backgroundColor: t.primary, borderColor: t.primary },

    toolsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
    toolBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
      backgroundColor: t.bgSoft,
      borderWidth: 1.5, borderColor: t.ink5,
    },
    toolBtnTxt: { fontSize: 12, color: t.ink, fontWeight: "700" },

    saveBar: {
      paddingTop: 4,
      gap: 8,
    },
    saveSummary: {
      paddingHorizontal: 4,
    },
    saveSummaryTxt: {
      fontSize: 12,
      color: t.ink3,
      fontWeight: "700",
    },
    saveBtn: {
      backgroundColor: t.primary,
      paddingVertical: 13,
      paddingHorizontal: 20,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    saveTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },

    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    menuCard: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: t.paperCardElev,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    menuTitle: { fontSize: 16, fontWeight: "800", color: t.ink, marginBottom: 4 },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: t.bgSoft,
    },
    menuItemIcon: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: t.primarySoft,
      alignItems: "center", justifyContent: "center",
    },
    menuItemTitle: { fontSize: 13, fontWeight: "800", color: t.ink },
    menuItemDesc: { fontSize: 11.5, color: t.ink3, marginTop: 1 },

    suggestRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: t.bgSoft,
      marginVertical: 4,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },
    suggestRowActive: { borderColor: t.primary, backgroundColor: t.primaryGhost },
    score: { fontSize: 12, fontWeight: "800", color: t.primary },

    modalActions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
    cancelBtn: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev,
    },
    cancelTxt: { color: t.ink2, fontSize: 13, fontWeight: "700" },
    applyBtn: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
      backgroundColor: t.primary,
    },
    applyTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  });
}

export default StudioPersonalizacaoPanel;
