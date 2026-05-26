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
// Convenções (não negociar):
//   - useStudioTokens() de @/contexts/StudioThemeMode
//   - toast de @/components/Toast
//   - useMemo(() => buildStyles(t), [t])
//   - sanitizeConfig inline (id/required/type/label/side)
//   - Toast erro: [status] data.error || message
//   - console.log + console.error com {status, code, message, data}
//   - NUNCA logar payload completo (PII) — só counts/sizes
// ============================================================
import { useEffect, useMemo, useState } from "react";
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
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { PreviewWhatsAppModal } from "@/components/studio/PreviewWhatsAppModal";
import { StudioEmpty } from "@/components/studio/StudioEmpty";

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

// ────────────────────────────────────────────────────────────
// Sanitizer
// ────────────────────────────────────────────────────────────
function sanitizeConfig(cfg: CustomizationConfig | null | undefined): CustomizationConfig {
  const fallback: CustomizationConfig = {
    print_area: { width_cm: 10, height_cm: 10, position: "center" },
    fields: [{ id: `f_${Date.now()}_0`, type: "text", label: "Nome a estampar", required: true, config: { max_chars: 30 }, side: "front" } as any],
  };
  if (!cfg) return fallback;
  const pa: any = cfg.print_area || {};
  const width = Number(pa.width_cm);
  const height = Number(pa.height_cm);
  const print_area = {
    width_cm: Number.isFinite(width) && width > 0 ? width : 10,
    height_cm: Number.isFinite(height) && height > 0 ? height : 10,
    position: (["center", "left", "right"] as const).includes(pa.position) ? pa.position : "center",
  } as CustomizationConfig["print_area"];

  // ── Verso (passa por se já existir no objeto cfg, fora do tipo CustomizationConfig)
  const cfgAny: any = cfg;
  const hasBack = !!cfgAny.has_back;
  let backPrintArea: any = undefined;
  if (hasBack) {
    const bp: any = cfgAny.back_print_area || {};
    const bw = Number(bp.width_cm);
    const bh = Number(bp.height_cm);
    backPrintArea = {
      width_cm: Number.isFinite(bw) && bw > 0 ? bw : 10,
      height_cm: Number.isFinite(bh) && bh > 0 ? bh : 10,
      position: (["center", "left", "right"] as const).includes(bp.position) ? bp.position : "center",
    };
  }
  const backChargeEnabled = hasBack && !!cfgAny.back_charge_enabled;
  let backPriceDelta: number | undefined;
  if (backChargeEnabled) {
    const bpd = Number(cfgAny.back_price_delta);
    backPriceDelta = Number.isFinite(bpd) && bpd >= 0 ? bpd : 0;
  }

  const validTypes: CustomizationFieldType[] = ["text", "image", "template", "color", "option"];
  const fields: CustomizationField[] = (Array.isArray(cfg.fields) ? cfg.fields : [])
    .filter((f: any) => f && validTypes.includes(f.type))
    .map((f: any, i: number) => {
      const rawSide: any = f.side;
      const side: FieldSide = rawSide === "back" && hasBack ? "back" : "front";
      return {
        id: typeof f.id === "string" && f.id.trim() ? f.id : `f_${Date.now()}_${i}`,
        type: f.type as CustomizationFieldType,
        label: typeof f.label === "string" && f.label.trim() ? f.label : `Campo ${i + 1}`,
        required: typeof f.required === "boolean" ? f.required : false,
        config: f.config && typeof f.config === "object" ? f.config : {},
        side,
      } as any;
    });
  if (fields.length === 0) {
    fields.push({ id: `f_${Date.now()}_0`, type: "text", label: "Nome a estampar", required: true, config: { max_chars: 30 }, side: "front" } as any);
  }

  const out: any = { print_area, fields };
  if (hasBack) {
    out.has_back = true;
    out.back_print_area = backPrintArea;
    if (backChargeEnabled) {
      out.back_charge_enabled = true;
      out.back_price_delta = backPriceDelta ?? 0;
    }
  }
  return out as CustomizationConfig;
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

  // ── Verso — derive flags do config ───────────────────
  const cfgAny: any = config;
  const hasBack: boolean = !!cfgAny.has_back;
  const backChargeEnabled: boolean = !!cfgAny.back_charge_enabled;
  const backPriceDelta: number | undefined = typeof cfgAny.back_price_delta === "number" ? cfgAny.back_price_delta : undefined;
  const backPrintArea: { width_cm: number; height_cm: number; position: "left" | "center" | "right" } | undefined =
    cfgAny.back_print_area && typeof cfgAny.back_print_area === "object" ? cfgAny.back_print_area : undefined;

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
    patchField(id, { side } as any);
  }
  function removeField(id: string) {
    setConfig((prev) => ({ ...prev, fields: prev.fields.filter((f) => f.id !== id) }));
  }
  function moveField(id: string, dir: -1 | 1) {
    setConfig((prev) => {
      const idx = prev.fields.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.fields.length) return prev;
      const arr = [...prev.fields];
      const [item] = arr.splice(idx, 1);
      arr.splice(next, 0, item);
      return { ...prev, fields: arr };
    });
  }
  function addField(type: CustomizationFieldType) {
    setAddMenuOpen(false);
    const defaults: Record<CustomizationFieldType, CustomizationField> = {
      text:     { id: `f_${Date.now()}`, type: "text",     label: "Texto",      required: false, config: { max_chars: 30 } } as any,
      color:    { id: `f_${Date.now()}`, type: "color",    label: "Cor",        required: false, config: { colors: ["#FFFFFF", "#000000", "#EF4444"] } } as any,
      option:   { id: `f_${Date.now()}`, type: "option",   label: "Opção",      required: false, config: { choices: [{ value: "p", label: "P" }, { value: "m", label: "M" }, { value: "g", label: "G" }] } } as any,
      template: { id: `f_${Date.now()}`, type: "template", label: "Template",   required: false, config: {} } as any,
      image:    { id: `f_${Date.now()}`, type: "image",    label: "Imagem",     required: false, config: { max_mb: 5, formats: ["png", "jpg"] } } as any,
    };
    const newField: any = { ...defaults[type], side: "front" as FieldSide };
    setConfig((prev) => ({ ...prev, fields: [...prev.fields, newField] }));
  }

  // ── Save ───────────────────────────────────────────────
  async function save() {
    const cfgAnyLocal: any = config;
    const sanitizeForSave = (): CustomizationConfig | null => {
      const base: any = {
        print_area: config.print_area,
        fields: config.fields.map((f: any) => ({ ...f, side: (f.side === "back" && cfgAnyLocal.has_back) ? "back" : "front" })),
      };
      if (cfgAnyLocal.has_back) {
        const bp = cfgAnyLocal.back_print_area;
        if (!bp || !(bp.width_cm > 0) || !(bp.height_cm > 0) || !["left", "center", "right"].includes(bp.position)) {
          toast.error("Configure as dimensões do verso");
          return null;
        }
        base.has_back = true;
        base.back_print_area = {
          width_cm: Number(bp.width_cm),
          height_cm: Number(bp.height_cm),
          position: bp.position,
        };
        if (cfgAnyLocal.back_charge_enabled) {
          const bpd = Number(cfgAnyLocal.back_price_delta);
          if (!Number.isFinite(bpd) || bpd < 0) {
            toast.error("Valor de cobrança inválido");
            return null;
          }
          base.back_charge_enabled = true;
          base.back_price_delta = bpd;
        }
      } else {
        // Force side=front em todos
        base.fields = base.fields.map((f: any) => ({ ...f, side: "front" }));
      }
      return base as CustomizationConfig;
    };

    const cfg = sanitizeForSave();
    if (!cfg) return;
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
      return {
        ...prev,
        fields: [
          ...prev.fields,
          {
            id: `f_${Date.now()}`,
            type: "template",
            label: "Template (sugestão IA)",
            required: false,
            config: { suggested_template_ids: selected.map((sg) => sg.template_id) },
            side: "front",
          } as any,
        ],
      };
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
          <PersonalizationPreview
            config={config}
            values={previewValues}
            size={isWide ? 320 : 280}
            productName={productName}
            showLabel
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
    </View>
  );

  const formBlock = (
    <View style={[s.formCol, isWide && s.formColWide]}>
      {/* Toggle */}
      <View style={s.card}>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardHeader}>Este produto aceita personalização</Text>
            <Text style={s.helpTxt}>Desligue pra ocultar campos no checkout.</Text>
          </View>
          <Switch
            value={isPersonalizable}
            onValueChange={(v) => togglePersonalizable(v)}
            disabled={togglePending}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Sumário Frente/Verso */}
        <View style={s.summaryRow}>
          <View style={s.summaryPill}>
            <Icon name="square" size={11} color={t.primary} />
            <Text style={s.summaryPillTxt}>Frente: {frontFieldsCount} {frontFieldsCount === 1 ? "campo" : "campos"}</Text>
          </View>
          {hasBack ? (
            <View style={[s.summaryPill, s.summaryPillBack]}>
              <Icon name="square" size={11} color={t.accent} />
              <Text style={[s.summaryPillTxt, { color: t.accent }]}>Verso: {backFieldsCount} {backFieldsCount === 1 ? "campo" : "campos"}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Print area — Frente */}
      <View style={s.card}>
        <Text style={s.eyebrow}>ÁREA DE IMPRESSÃO · FRENTE</Text>
        <Text style={s.cardHeader}>Dimensões da arte</Text>

        <View style={s.inlineRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Largura (cm)</Text>
            <TextInput
              value={String(config.print_area.width_cm)}
              onChangeText={(txt) => {
                const n = Number(txt.replace(",", "."));
                patchPrintArea({ width_cm: Number.isFinite(n) && n > 0 ? n : 0 });
              }}
              keyboardType="decimal-pad"
              style={s.input}
              placeholder="10"
              placeholderTextColor={t.ink4}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Altura (cm)</Text>
            <TextInput
              value={String(config.print_area.height_cm)}
              onChangeText={(txt) => {
                const n = Number(txt.replace(",", "."));
                patchPrintArea({ height_cm: Number.isFinite(n) && n > 0 ? n : 0 });
              }}
              keyboardType="decimal-pad"
              style={s.input}
              placeholder="10"
              placeholderTextColor={t.ink4}
            />
          </View>
        </View>

        <Text style={[s.fieldLabel, { marginTop: 10 }]}>Posição</Text>
        <View style={s.chipRow}>
          {POSITIONS.map((p) => {
            const active = config.print_area.position === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => patchPrintArea({ position: p.value })}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Verso — toggle + bloco */}
      <View style={s.card}>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardHeader}>Tem verso?</Text>
            <Text style={s.helpTxt}>Habilite para configurar a área de impressão no verso da peça.</Text>
          </View>
          <Switch
            value={hasBack}
            onValueChange={(v) => toggleHasBack(v)}
            trackColor={{ false: t.ink5, true: t.primary }}
            thumbColor="#fff"
          />
        </View>

        {hasBack && backPrintArea ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={s.eyebrow}>ÁREA DE IMPRESSÃO · VERSO</Text>

            <View style={s.inlineRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Largura (cm)</Text>
                <TextInput
                  value={String(backPrintArea.width_cm)}
                  onChangeText={(txt) => {
                    const n = Number(txt.replace(",", "."));
                    patchBackPrintArea({ width_cm: Number.isFinite(n) && n > 0 ? n : 0 });
                  }}
                  keyboardType="decimal-pad"
                  style={s.input}
                  placeholder="10"
                  placeholderTextColor={t.ink4}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Altura (cm)</Text>
                <TextInput
                  value={String(backPrintArea.height_cm)}
                  onChangeText={(txt) => {
                    const n = Number(txt.replace(",", "."));
                    patchBackPrintArea({ height_cm: Number.isFinite(n) && n > 0 ? n : 0 });
                  }}
                  keyboardType="decimal-pad"
                  style={s.input}
                  placeholder="10"
                  placeholderTextColor={t.ink4}
                />
              </View>
            </View>

            <Text style={[s.fieldLabel, { marginTop: 6 }]}>Posição</Text>
            <View style={s.chipRow}>
              {POSITIONS.map((p) => {
                const active = backPrintArea.position === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => patchBackPrintArea({ position: p.value })}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Cobrança pelo verso */}
            <View style={[s.toggleRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.ink5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardHeader}>Cobrar pelo verso?</Text>
                <Text style={s.helpTxt}>Adicionado ao preço final quando o cliente marcar verso.</Text>
              </View>
              <Switch
                value={backChargeEnabled}
                onValueChange={(v) => toggleBackCharge(v)}
                trackColor={{ false: t.ink5, true: t.accent }}
                thumbColor="#fff"
              />
            </View>

            {backChargeEnabled ? (
              <View style={{ marginTop: 6 }}>
                <Text style={s.fieldLabel}>Valor extra (R$)</Text>
                <TextInput
                  value={typeof backPriceDelta === "number" ? String(backPriceDelta) : ""}
                  onChangeText={(txt) => {
                    const n = Number(txt.replace(",", "."));
                    patchBackPriceDelta(Number.isFinite(n) && n >= 0 ? n : 0);
                  }}
                  keyboardType="decimal-pad"
                  style={s.input}
                  placeholder="0,00"
                  placeholderTextColor={t.ink4}
                />
                <Text style={s.helpTxt}>Adicionado ao preço final quando o cliente marcar verso.</Text>
              </View>
            ) : null}
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
            {config.fields.map((f, i) => (
              <FieldRow
                key={f.id}
                t={t}
                s={s}
                field={f}
                index={i}
                total={config.fields.length}
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
      </View>

      {/* Ações secundárias */}
      <View style={s.card}>
        <Text style={s.eyebrow}>FERRAMENTAS</Text>
        <View style={s.toolsRow}>
          <Pressable onPress={fetchSuggestions} style={s.toolBtn}>
            <Icon name="sparkles" size={14} color={t.accent} />
            <Text style={s.toolBtnTxt}>Sugestões IA de templates</Text>
          </Pressable>
          <Pressable onPress={() => setShowWaPreview(true)} style={s.toolBtn}>
            <Icon name="share-2" size={14} color={t.primary} />
            <Text style={s.toolBtnTxt}>Preview WhatsApp</Text>
          </Pressable>
        </View>
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
  const backDisabled = !hasBack;
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
        {/* Side picker — Frente / Verso */}
        <View style={s.sideRow}>
          <Text style={s.sideLabel}>Lado:</Text>
          <Pressable
            onPress={() => onSetSide("front")}
            style={[s.sideChip, currentSide === "front" && s.sideChipActive]}
          >
            <Icon name="square" size={11} color={currentSide === "front" ? t.primary : t.ink3} />
            <Text style={[s.sideChipTxt, currentSide === "front" && s.sideChipTxtActive]}>Frente</Text>
          </Pressable>
          <Pressable
            onPress={() => onSetSide("back")}
            disabled={backDisabled}
            // @ts-ignore — title (tooltip) é válido em RN Web
            title={backDisabled ? "Habilite verso no topo" : undefined}
            style={[
              s.sideChip,
              currentSide === "back" && s.sideChipActiveBack,
              backDisabled && s.sideChipDisabled,
            ]}
          >
            <Icon name="square" size={11} color={currentSide === "back" ? t.accent : t.ink3} />
            <Text style={[
              s.sideChipTxt,
              currentSide === "back" && { color: t.accent },
              backDisabled && { color: t.ink4 },
            ]}>Verso</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => onPatch({ required: !field.required })}
          style={s.requiredRow}
        >
          <View style={[s.checkbox, field.required && s.checkboxOn]}>
            {field.required && <Icon name="check" size={11} color="#fff" />}
          </View>
          <Text style={s.requiredTxt}>Obrigatório</Text>
        </Pressable>

        {field.type === "text" && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.fieldLabel}>Max caracteres</Text>
            <TextInput
              value={String((field.config?.max_chars as number) || "")}
              onChangeText={(txt) => {
                const n = Number(txt);
                onPatchConfig({ max_chars: Number.isFinite(n) && n > 0 ? n : undefined });
              }}
              keyboardType="number-pad"
              style={s.input}
              placeholder="30"
              placeholderTextColor={t.ink4}
            />
          </View>
        )}

        {field.type === "color" && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.fieldLabel}>Paleta (hex, vírgula)</Text>
            <TextInput
              value={((field.config?.colors as string[] | undefined) || []).join(",")}
              onChangeText={(txt) => {
                const list = txt.split(",").map((x) => x.trim()).filter(Boolean);
                onPatchConfig({ colors: list });
              }}
              style={s.input}
              placeholder="#FFFFFF, #000000, #EF4444"
              placeholderTextColor={t.ink4}
              autoCapitalize="characters"
            />
          </View>
        )}

        {field.type === "option" && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.fieldLabel}>Choices (label:value, vírgula)</Text>
            <TextInput
              value={(((field.config?.choices as Array<{ label: string; value: string }> | undefined) || [])
                .map((c) => `${c.label}:${c.value}`).join(", "))}
              onChangeText={(txt) => {
                const choices = txt.split(",").map((pair) => {
                  const parts = pair.split(":").map((x) => x.trim());
                  if (parts.length < 2) return null;
                  return { label: parts[0], value: parts[1] };
                }).filter(Boolean) as Array<{ label: string; value: string }>;
                onPatchConfig({ choices });
              }}
              style={s.input}
              placeholder="P:p, M:m, G:g"
              placeholderTextColor={t.ink4}
            />
          </View>
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

    previewCol: {},
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
