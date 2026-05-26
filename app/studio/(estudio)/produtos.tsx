// ============================================================
// AURA STUDIO · Produtos personalizáveis (Fase 1 + Fase 4 preview + Fases 9B/10B/11B + Fase 12 theme)
//
// Lista produtos da empresa + toggle "personalizável" + form
// expandido inline pra configurar print area e campos.
//
// Fase 4 (26/05/2026): preview ao vivo lateral usando
// <PersonalizationPreview> dentro do expand — split horizontal
// no desktop (vw > 768), preview acima do form no mobile.
//
// Fase 9B (26/05/2026): badge ProductQualityScore no canto
// superior direito de cada card de produto.
//
// 26/05/2026 (fix): trocado `compact` por `badgeOnly` no badge.
// O `compact` tinha flex:1 e esticava virando barra horizontal
// sobreposta aos outros cards. `badgeOnly` é a bolinha 24x24
// fixa criada no componente. Wrapper agora tem width/height
// fixos pra não permitir extensão.
//
// Fase 10B (26/05/2026): botão "✨ Sugestões IA" dentro do form
// expandido — chama studioApi.suggestTemplates e abre modal de
// checkboxes pra vincular templates em lote.
//
// Fase 11B (26/05/2026): botão "📲 Preview WhatsApp" no header
// do form expandido — abre <PreviewWhatsAppModal>.
//
// Fase 12 (25/05/2026): StyleSheet via buildStyles(t) + useStudioTokens()
// pra suportar light/dark mode. ExpandedForm/FilterChip recebem `s` e
// `t` por prop pra evitar closure sobre globals.
//
// 26/05/2026 — Fix defensivo Bug A (salvamento personalização):
//   1. sanitizeConfig(cfg) garante schema válido antes de mandar pro
//      backend (gera id se faltar, força required:boolean, normaliza
//      tipos numéricos, filtra fields com type inválido).
//   2. saveConfig agora loga payload/response no console e exibe o
//      ERRO REAL do backend no toast (status + mensagem) em vez do
//      genérico "Erro ao salvar".
//   3. openExpand sanitiza config legado no LOAD pra evitar que
//      configs antigos sem `id` quebrem no save.
//
// Endpoints (backend src/routes/studio.js):
//   GET    /companies/:cid/studio/products/:pid/customization-config
//   PUT    /companies/:cid/studio/products/:pid/customization-config
//   POST   /companies/:cid/studio/products/:pid/personalize
//   POST   /companies/:cid/studio/products/:pid/suggest-templates  (Fase 10B)
//
// Quando salva config: marca onboarding.product = true no studio_settings.
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Switch, useWindowDimensions, Platform, Modal,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, type CustomizationConfig, type CustomizationField, type CustomizationFieldType } from "@/services/studioApi";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { ProductQualityScore, calculateProductScore } from "@/components/studio/ProductQualityScore";
import { PreviewWhatsAppModal } from "@/components/studio/PreviewWhatsAppModal";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";

// Tipo enxuto pro produto vindo de /companies/:cid/products
type ProductRow = {
  id: string;
  name: string;
  price: number;
  is_personalizable?: boolean;
  category_name?: string | null;
};

type Tokens = ReturnType<typeof useStudioTokens>;
type Styles = ReturnType<typeof buildStyles>;

const FIELD_TYPE_LABELS: Record<CustomizationFieldType, string> = {
  text:     "Texto",
  image:    "Foto do cliente",
  template: "Escolher template da galeria",
  color:    "Cor",
  option:   "Opções",
};

const FIELD_TYPE_ICONS: Record<CustomizationFieldType, string> = {
  text:     "edit",
  image:    "image",
  template: "star",
  color:    "tag",
  option:   "check",
};

// Default config quando produto ainda não tem nada salvo (ou GET falhou).
// Sempre criar config terminal — nunca deixar `undefined` no cache, senão
// o render do expand fica no spinner pra sempre (bug 25/05/2026).
function defaultConfig(): CustomizationConfig {
  return {
    print_area: { width_cm: 10, height_cm: 10, position: "center" },
    fields: [],
  };
}

// 26/05/2026 — Fix defensivo Bug A: sanitiza config antes do save/load.
// Backend valida com schema rígido (id string non-empty + required boolean
// + type ∈ enum). Configs legados ou patches incrementais podem ter campos
// sem id ou required undefined → backend rejeita → toast genérico → usuário
// acha que salvou e perde o trabalho. Sanitização garante schema válido.
function sanitizeConfig(cfg: CustomizationConfig | null | undefined): CustomizationConfig {
  const fallback: CustomizationConfig = {
    print_area: { width_cm: 10, height_cm: 10, position: "center" },
    fields: [],
  };
  if (!cfg) return fallback;

  // Print area com tipos válidos (Number coerce + range guard)
  const pa: any = cfg.print_area || {};
  const width = Number(pa.width_cm);
  const height = Number(pa.height_cm);
  const validPositions = ["center", "left", "right"] as const;
  const print_area = {
    width_cm: Number.isFinite(width) && width > 0 ? width : 10,
    height_cm: Number.isFinite(height) && height > 0 ? height : 10,
    position: (validPositions as readonly string[]).includes(pa.position)
      ? (pa.position as "center" | "left" | "right")
      : ("center" as const),
  };

  // Fields com schema correto (gera id se faltar; força required boolean;
  // filtra type inválido; garante label não-vazio)
  const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
  const validTypes: CustomizationFieldType[] = ["text", "image", "template", "color", "option"];
  const sanitizedFields: CustomizationField[] = fields
    .filter((f: any) => f && validTypes.includes(f.type))
    .map((f: any, i: number) => ({
      id: typeof f.id === "string" && f.id.trim() ? f.id : `f_${Date.now()}_${i}`,
      type: f.type as CustomizationFieldType,
      label: typeof f.label === "string" && f.label.trim() ? f.label : `Campo ${i + 1}`,
      required: typeof f.required === "boolean" ? f.required : false,
      config: f.config && typeof f.config === "object" ? f.config : {},
    }));

  return { print_area, fields: sanitizedFields };
}

// Fase 4: monta valores fake pro preview ao vivo no admin.
// Cada tipo de campo recebe um placeholder representativo:
//   text     → "Exemplo: João"
//   color    → primeira cor da lista de choices/config.colors (fallback #EC4899)
//   option   → primeira choice
//   template → null (sem imagem default, mostra área dashed)
//   image    → null (idem)
function buildPreviewValues(cfg: CustomizationConfig | undefined): Record<string, any> {
  if (!cfg) return {};
  const out: Record<string, any> = {};
  for (const f of cfg.fields) {
    if (f.type === "text") {
      out[f.id] = "Exemplo: João";
    } else if (f.type === "color") {
      const colors = (f.config?.colors as string[] | undefined) || [];
      const choices = (f.config?.choices as Array<{ value: string }> | undefined) || [];
      out[f.id] = colors[0] || choices[0]?.value || "#EC4899";
    } else if (f.type === "option") {
      const choices = (f.config?.choices as Array<{ value: string; label: string }> | undefined) || [];
      out[f.id] = choices[0]?.value || "";
    } else if (f.type === "template" || f.type === "image") {
      out[f.id] = null;
    }
  }
  return out;
}

export default function StudioProdutos() {
  const { company } = useAuthStore();
  const { config: dcConfig } = useDigitalChannel();
  const { width: vw } = useWindowDimensions();
  const isDesktop = vw > 768;
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [filter, setFilter] = useState<"all" | "personalizable" | "non">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configCache, setConfigCache] = useState<Record<string, CustomizationConfig>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [channelSlug, setChannelSlug] = useState<string | null>(null);

  // Fase 10B — IA sugestões de templates
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(null);
  const [suggestionsModal, setSuggestionsModal] = useState<{
    productId: string;
    suggestions: Array<{ template_id: string; reason: string; score: number }>;
  } | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});
  const [linkingSuggestions, setLinkingSuggestions] = useState(false);

  // Fase 11B — Preview WhatsApp
  const [whatsAppPreviewProduct, setWhatsAppPreviewProduct] = useState<ProductRow | null>(null);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // Backend devolve {products: [...]} ou array direto. Tentamos os dois.
      const r: any = await request(`/companies/${company.id}/products?limit=500`, { method: "GET", retry: 1, timeout: 10000 });
      const list: ProductRow[] = Array.isArray(r) ? r : (r.products || r.items || []);
      setProducts(list);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar produtos");
    } finally { setLoading(false); }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  // Fase 4: tenta resolver slug do Canal Digital pra link "Ver como cliente".
  // Best-effort — se endpoint não existir ou retornar vazio, o link some.
  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const r: any = await request(`/companies/${company.id}/digital-channel`, { method: "GET", retry: 0, timeout: 6000 });
        const slug = r?.slug || r?.channel?.slug || r?.digital_channel?.slug || null;
        if (!cancelled && slug) setChannelSlug(String(slug));
      } catch {
        // Endpoint pode não existir nessa empresa — silencioso, link some.
      }
    })();
    return () => { cancelled = true; };
  }, [company?.id]);

  const filtered = products.filter((p) => {
    if (filter === "all") return true;
    if (filter === "personalizable") return !!p.is_personalizable;
    return !p.is_personalizable;
  });

  const personalizedCount = products.filter((p) => p.is_personalizable).length;

  async function togglePersonalizable(p: ProductRow) {
    if (!company?.id) return;
    const next = !p.is_personalizable;
    setSavingId(p.id);
    try {
      await studioApi.togglePersonalizable(company.id, p.id, next);
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_personalizable: next } : x));
      toast.success(next ? "Produto agora aceita personalização" : "Personalização desativada");
      // Se ligou e ainda não tem config, abre o form pra configurar
      if (next && !configCache[p.id]) {
        openExpand(p);
      }
    } catch (e: any) { toast.error(e?.message || "Erro"); }
    finally { setSavingId(null); }
  }

  async function openExpand(p: ProductRow) {
    if (!company?.id) return;
    if (expandedId === p.id) { setExpandedId(null); return; }
    setExpandedId(p.id);
    if (!configCache[p.id]) {
      // SEMPRE termina o load com config terminal — mesmo se 404/erro/null —
      // pra render trocar do spinner pro form. Antes engolia silenciosamente
      // e travava no ActivityIndicator (bug 25/05/2026).
      // 26/05/2026: sanitiza no load também pra evitar configs legados sem
      // id/required quebrarem no save depois.
      try {
        const r = await studioApi.getCustomizationConfig(company.id, p.id);
        const sanitized = sanitizeConfig((r?.config as CustomizationConfig) || null);
        setConfigCache((c) => ({ ...c, [p.id]: sanitized }));
      } catch {
        setConfigCache((c) => ({ ...c, [p.id]: sanitizeConfig(null) }));
      }
    }
  }

  function updateConfig(pid: string, patch: Partial<CustomizationConfig>) {
    setConfigCache((c) => ({
      ...c,
      [pid]: {
        ...(c[pid] || defaultConfig()),
        ...patch,
      },
    }));
  }

  function updateField(pid: string, fid: string, patch: Partial<CustomizationField>) {
    setConfigCache((c) => {
      const cur = c[pid];
      if (!cur) return c;
      return {
        ...c,
        [pid]: {
          ...cur,
          fields: cur.fields.map((f) => f.id === fid ? { ...f, ...patch } : f),
        },
      };
    });
  }

  function addField(pid: string, type: CustomizationFieldType) {
    setConfigCache((c) => {
      const cur = c[pid] || defaultConfig();
      const newField: CustomizationField = {
        id: `f_${Date.now()}`,
        type,
        label: FIELD_TYPE_LABELS[type],
        required: type !== "option" && type !== "color",
        config: type === "text" ? { max_chars: 30 } : {},
      };
      return { ...c, [pid]: { ...cur, fields: [...cur.fields, newField] } };
    });
  }

  function removeField(pid: string, fid: string) {
    setConfigCache((c) => {
      const cur = c[pid];
      if (!cur) return c;
      return { ...c, [pid]: { ...cur, fields: cur.fields.filter((f) => f.id !== fid) } };
    });
  }

  // 26/05/2026 — Fix defensivo Bug A:
  //   - Sanitiza payload ANTES de mandar (gera id, força required:bool, etc)
  //   - Loga payload + response no console
  //   - Mostra erro REAL do backend no toast (status + message), não genérico
  //   - Atualiza cache com config sanitizado (evita drift entre UI e backend)
  async function saveConfig(p: ProductRow) {
    if (!company?.id) {
      toast.error("Empresa não identificada");
      return;
    }
    const cfgRaw = configCache[p.id];
    if (!cfgRaw) {
      toast.error("Configure ao menos 1 campo");
      return;
    }
    const cfg = sanitizeConfig(cfgRaw);
    if (!cfg.fields.length) {
      toast.error("Adicione ao menos 1 campo personalizável");
      return;
    }

    setSavingId(p.id);
    console.log("[StudioProdutos] saveConfig start", { product_id: p.id, payload: cfg });
    try {
      const resp = await studioApi.saveCustomizationConfig(company.id, p.id, cfg);
      console.log("[StudioProdutos] saveConfig OK", resp);
      toast.success("✨ Configuração salva!");
      setProducts((prev) => prev.map((x) =>
        x.id === p.id ? { ...x, is_personalizable: true } : x
      ));
      // Atualiza cache com config sanitizado (evita re-save de schema inválido)
      setConfigCache((c) => ({ ...c, [p.id]: cfg }));
      setExpandedId(null);
    } catch (e: any) {
      console.error("[StudioProdutos] saveConfig ERROR", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const msg = e?.data?.error || e?.message || "Erro desconhecido";
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${msg}`);
    } finally {
      setSavingId(null);
    }
  }

  function openCustomerView() {
    if (!channelSlug) return;
    const url = `https://loja.getaura.com.br/${channelSlug}/studio`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  // ── Fase 10B ─ chama IA pra sugerir templates do produto
  async function fetchSuggestions(pid: string) {
    if (!company?.id) return;
    setLoadingSuggestions(pid);
    try {
      const r = await studioApi.suggestTemplates(company.id, pid);
      if (!r.suggestions || r.suggestions.length === 0) {
        toast.info(r.message || "Sem sugestões agora — adicione mais templates na galeria.");
      } else {
        // Pré-seleciona todas as sugestões por padrão (UX: 1 clique pra confirmar)
        const preSel: Record<string, boolean> = {};
        for (const sug of r.suggestions) preSel[sug.template_id] = true;
        setSelectedSuggestions(preSel);
        setSuggestionsModal({ productId: pid, suggestions: r.suggestions });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao buscar sugestões");
    } finally {
      setLoadingSuggestions(null);
    }
  }

  async function linkSelectedSuggestions() {
    if (!company?.id || !suggestionsModal) return;
    const ids = Object.keys(selectedSuggestions).filter((k) => selectedSuggestions[k]);
    if (ids.length === 0) { toast.error("Selecione ao menos 1 template"); return; }
    setLinkingSuggestions(true);
    let ok = 0, fail = 0;
    for (const tid of ids) {
      try {
        await studioApi.linkTemplate(company.id, suggestionsModal.productId, tid, 0);
        ok++;
      } catch {
        fail++;
      }
    }
    setLinkingSuggestions(false);
    if (ok > 0) {
      toast.success(`${ok} template${ok > 1 ? "s" : ""} vinculado${ok > 1 ? "s" : ""}${fail > 0 ? ` (${fail} falhou)` : ""}`);
    } else {
      toast.error("Nenhum template vinculado");
    }
    setSuggestionsModal(null);
    setSelectedSuggestions({});
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>FASE 1 · PRODUTOS PERSONALIZÁVEIS</Text>
          <Text style={s.title}>O que o cliente pode personalizar</Text>
          <Text style={s.sub}>
            Marque quais produtos do seu catálogo aceitam personalização (texto, foto, escolha de template) e configure o que pode ser mudado.
          </Text>
        </View>
        <View style={s.statPill}>
          <Text style={s.statNum}>{personalizedCount}</Text>
          <Text style={s.statLabel}>personalizáveis</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        <FilterChip s={s} label="Todos" count={products.length} active={filter === "all"} onPress={() => setFilter("all")} />
        <FilterChip s={s} label="Personalizáveis" count={personalizedCount} active={filter === "personalizable"} onPress={() => setFilter("personalizable")} tone="primary" />
        <FilterChip s={s} label="Não personalizáveis" count={products.length - personalizedCount} active={filter === "non"} onPress={() => setFilter("non")} />
      </View>

      {/* Loading */}
      {loading && (
        <View style={{ paddingVertical: 30 }}>
          <ActivityIndicator size="small" color={t.primary} />
        </View>
      )}

      {/* Empty (sem produtos no catálogo) */}
      {!loading && products.length === 0 && (
        <View style={s.emptyCard}>
          <Icon name="shopping-bag" size={32} color={t.ink4} />
          <Text style={s.emptyTitle}>Catálogo vazio</Text>
          <Text style={s.emptySub}>
            Cadastre produtos no Estoque primeiro. Depois volta aqui pra marcar quais aceitam personalização.
          </Text>
        </View>
      )}

      {/* Empty (filtro retornou vazio) */}
      {!loading && products.length > 0 && filtered.length === 0 && (
        <View style={s.emptyCard}>
          <Icon name="filter" size={28} color={t.ink4} />
          <Text style={s.emptyTitle}>Nenhum produto nesta categoria</Text>
          <Text style={s.emptySub}>
            {filter === "personalizable"
              ? "Nenhum produto marcado como personalizável ainda. Mude pra \"Não personalizáveis\" e ative os que aceitam."
              : "Todos os produtos já estão marcados como personalizáveis."}
          </Text>
        </View>
      )}

      {/* Lista */}
      {!loading && filtered.length > 0 && (
        <View style={s.list}>
          {filtered.map((p) => {
            const expanded = expandedId === p.id;
            const cfg = configCache[p.id];
            const saving = savingId === p.id;
            return (
              <View key={p.id} style={[s.productCard, p.is_personalizable && s.productCardActive]}>
                {/* Fase 9B: badge ProductQualityScore no canto sup. direito */}
                {/* badgeOnly = bolinha 24x24 fixa; compact estica e quebra o card */}
                <View style={s.qualityBadgeWrap} pointerEvents="none">
                  <ProductQualityScore product={p} badgeOnly />
                </View>

                {/* Linha principal */}
                <View style={s.productRow}>
                  <View style={[s.productIcon, p.is_personalizable && { backgroundColor: t.primary }]}>
                    <Icon name="shopping-bag" size={16} color={p.is_personalizable ? "#fff" : t.ink3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.productMeta}>
                      R$ {Number(p.price || 0).toFixed(2)}
                      {p.category_name && <Text> · {p.category_name}</Text>}
                    </Text>
                  </View>
                  {p.is_personalizable && (
                    <Pressable style={s.configBtn} onPress={() => openExpand(p)}>
                      <Icon name={expanded ? "chevron-up" : "settings"} size={14} color={t.primary} />
                      <Text style={s.configBtnTxt}>{expanded ? "Fechar" : "Configurar"}</Text>
                    </Pressable>
                  )}
                  <Switch
                    value={!!p.is_personalizable}
                    onValueChange={() => togglePersonalizable(p)}
                    disabled={saving}
                    trackColor={{ false: t.ink5, true: t.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Form expandido + preview ao vivo (Fase 4) */}
                {expanded && p.is_personalizable && (
                  <ExpandedForm
                    s={s}
                    t={t}
                    product={p}
                    cfg={cfg}
                    saving={saving}
                    isDesktop={isDesktop}
                    channelSlug={channelSlug}
                    loadingSuggestions={loadingSuggestions === p.id}
                    onUpdateConfig={(patch) => updateConfig(p.id, patch)}
                    onUpdateField={(fid, patch) => updateField(p.id, fid, patch)}
                    onAddField={(type) => addField(p.id, type)}
                    onRemoveField={(fid) => removeField(p.id, fid)}
                    onClose={() => setExpandedId(null)}
                    onSave={() => saveConfig(p)}
                    onOpenCustomerView={openCustomerView}
                    onFetchSuggestions={() => fetchSuggestions(p.id)}
                    onOpenWhatsAppPreview={() => setWhatsAppPreviewProduct(p)}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Hint */}
      <View style={s.hintCard}>
        <Icon name="info" size={14} color={t.primary} />
        <Text style={s.hintTxt}>
          <Text style={s.hintBold}>Próxima iteração:</Text> integração com galeria de templates por categoria + preview com upload real do cliente.
        </Text>
      </View>

      {/* Fase 10B — Modal de sugestões IA */}
      {suggestionsModal && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => { if (!linkingSuggestions) { setSuggestionsModal(null); setSelectedSuggestions({}); } }}
        >
          <View style={s.modalBackdrop}>
            <View style={s.modalCard}>
              <View style={s.modalHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalEyebrow}>IA AURA · GALERIA</Text>
                  <Text style={s.modalTitle}>Templates sugeridos</Text>
                  <Text style={s.modalSub}>
                    Selecione os templates que combinam com este produto. Vinculados aparecem pro cliente na tela de personalização.
                  </Text>
                </View>
                <Pressable
                  onPress={() => { setSuggestionsModal(null); setSelectedSuggestions({}); }}
                  hitSlop={10}
                  disabled={linkingSuggestions}
                >
                  <Icon name="x" size={18} color={t.ink3} />
                </Pressable>
              </View>

              <ScrollView style={s.modalScroll} contentContainerStyle={{ paddingBottom: 8 }}>
                {suggestionsModal.suggestions.map((sug) => {
                  const checked = !!selectedSuggestions[sug.template_id];
                  return (
                    <Pressable
                      key={sug.template_id}
                      style={[s.suggestRow, checked && s.suggestRowOn]}
                      onPress={() => setSelectedSuggestions((m) => ({ ...m, [sug.template_id]: !m[sug.template_id] }))}
                      disabled={linkingSuggestions}
                    >
                      <View style={[s.suggestCheck, checked && s.suggestCheckOn]}>
                        {checked && <Icon name="check" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.suggestId} numberOfLines={1}>Template #{sug.template_id.slice(0, 8)}</Text>
                        <Text style={s.suggestReason} numberOfLines={2}>{sug.reason}</Text>
                      </View>
                      <View style={s.suggestScorePill}>
                        <Text style={s.suggestScoreTxt}>{Math.round(sug.score * 100)}%</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={s.modalActions}>
                <Pressable
                  style={s.btnSec}
                  onPress={() => { setSuggestionsModal(null); setSelectedSuggestions({}); }}
                  disabled={linkingSuggestions}
                >
                  <Text style={s.btnSecTxt}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[s.btnPri, linkingSuggestions && { opacity: 0.6 }]}
                  onPress={linkSelectedSuggestions}
                  disabled={linkingSuggestions}
                >
                  {linkingSuggestions ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={14} color="#fff" />
                      <Text style={s.btnPriTxt}>
                        Vincular {Object.values(selectedSuggestions).filter(Boolean).length} template{Object.values(selectedSuggestions).filter(Boolean).length !== 1 ? "s" : ""}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Fase 11B — Preview WhatsApp Modal */}
      {whatsAppPreviewProduct && (
        <PreviewWhatsAppModal
          visible={true}
          onClose={() => setWhatsAppPreviewProduct(null)}
          product={whatsAppPreviewProduct}
          shop={{
            name: company?.name || "Aura Studio",
            slug: dcConfig?.slug || "loja",
            logo_url: dcConfig?.logo_url,
          }}
        />
      )}
    </ScrollView>
  );
}

// ============================================================
// ExpandedForm — extraido pra poder usar useMemo do previewValues
// sem violar regras de hooks (não usar dentro de map inline).
// Fase 12: recebe `s` e `t` por prop em vez de closure.
// ============================================================
type ExpandedFormProps = {
  s: Styles;
  t: Tokens;
  product: ProductRow;
  cfg: CustomizationConfig | undefined;
  saving: boolean;
  isDesktop: boolean;
  channelSlug: string | null;
  loadingSuggestions: boolean;
  onUpdateConfig: (patch: Partial<CustomizationConfig>) => void;
  onUpdateField: (fid: string, patch: Partial<CustomizationField>) => void;
  onAddField: (t: CustomizationFieldType) => void;
  onRemoveField: (fid: string) => void;
  onClose: () => void;
  onSave: () => void;
  onOpenCustomerView: () => void;
  onFetchSuggestions: () => void;
  onOpenWhatsAppPreview: () => void;
};

function ExpandedForm({
  s, t, product: p, cfg, saving, isDesktop, channelSlug, loadingSuggestions,
  onUpdateConfig, onUpdateField, onAddField, onRemoveField,
  onClose, onSave, onOpenCustomerView, onFetchSuggestions, onOpenWhatsAppPreview,
}: ExpandedFormProps) {
  // previewValues recalculado quando cfg muda — texto fixo + primeira cor/option.
  const previewValues = useMemo(() => buildPreviewValues(cfg), [cfg]);
  const previewSize = isDesktop ? 320 : 280;

  // PreviewPane — usado nos dois layouts (desktop sidebar / mobile topo)
  const previewPane = (
    <View style={[s.previewPane, isDesktop && s.previewPaneDesktop]}>
      <Text style={s.previewLabel}>PRÉVIA EM TEMPO REAL</Text>
      <View style={s.previewBox}>
        <PersonalizationPreview
          config={cfg || null}
          values={previewValues}
          size={previewSize}
          productName={p.name}
          showLabel={true}
        />
      </View>
      <Text style={s.previewHint}>
        Atualiza conforme você muda a área de impressão ou adiciona campos.
      </Text>
      <View style={s.previewLinks}>
        {channelSlug && Platform.OS === "web" && (
          <Pressable style={s.customerLink} onPress={onOpenCustomerView}>
            <Icon name="external-link" size={12} color={t.primary} />
            <Text style={s.customerLinkTxt}>Ver como cliente</Text>
          </Pressable>
        )}
        {/* Fase 11B: Preview WhatsApp */}
        <Pressable style={s.waPreviewBtn} onPress={onOpenWhatsAppPreview}>
          <Icon name="external-link" size={13} color={t.success} />
          <Text style={s.waPreviewTxt}>Preview WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[s.expand, isDesktop && s.expandDesktop]}>
      {!cfg && (
        <View style={{ paddingVertical: 14, flex: 1 }}>
          <ActivityIndicator size="small" color={t.primary} />
        </View>
      )}
      {cfg && (
        <>
          {/* Layout: desktop = preview à esquerda + form à direita; mobile = preview em cima + form abaixo */}
          {previewPane}

          <View style={[s.formCol, isDesktop && s.formColDesktop]}>
            {/* Print area */}
            <Text style={s.sectionLabel}>ÁREA DE IMPRESSÃO</Text>
            <View style={s.row}>
              <View style={{ flex: 1, minWidth: 100 }}>
                <Text style={s.label}>Largura (cm)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  value={String(cfg.print_area.width_cm)}
                  onChangeText={(v) => onUpdateConfig({ print_area: { ...cfg.print_area, width_cm: parseFloat(v.replace(",", ".")) || 0 } })}
                />
              </View>
              <View style={{ flex: 1, minWidth: 100 }}>
                <Text style={s.label}>Altura (cm)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  value={String(cfg.print_area.height_cm)}
                  onChangeText={(v) => onUpdateConfig({ print_area: { ...cfg.print_area, height_cm: parseFloat(v.replace(",", ".")) || 0 } })}
                />
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={s.label}>Posição</Text>
                <View style={s.positionRow}>
                  {(["left", "center", "right"] as const).map((pos) => (
                    <Pressable
                      key={pos}
                      style={[s.positionChip, cfg.print_area.position === pos && s.positionChipSel]}
                      onPress={() => onUpdateConfig({ print_area: { ...cfg.print_area, position: pos } })}
                    >
                      <Text style={[s.positionChipTxt, cfg.print_area.position === pos && s.positionChipTxtSel]}>
                        {pos === "left" ? "Esq." : pos === "center" ? "Centro" : "Dir."}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Fields */}
            <Text style={[s.sectionLabel, { marginTop: 18 }]}>CAMPOS QUE O CLIENTE PREENCHE</Text>
            {cfg.fields.length === 0 && (
              <Text style={s.hintInline}>
                Adicione pelo menos 1 campo. Ex: "Nome da pessoa" (texto), "Foto" (upload), "Cor" (opção).
              </Text>
            )}
            {cfg.fields.map((f) => (
              <View key={f.id} style={s.fieldRow}>
                <View style={s.fieldIcon}>
                  <Icon name={FIELD_TYPE_ICONS[f.type] as any} size={14} color={t.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.fieldHead}>
                    <TextInput
                      style={s.fieldLabel}
                      value={f.label}
                      onChangeText={(v) => onUpdateField(f.id, { label: v })}
                      placeholder="Nome do campo"
                    />
                    <View style={s.fieldTypePill}>
                      <Text style={s.fieldTypePillTxt}>{FIELD_TYPE_LABELS[f.type]}</Text>
                    </View>
                  </View>
                  <View style={s.fieldOpts}>
                    <Pressable
                      style={[s.fieldOpt, f.required && s.fieldOptOn]}
                      onPress={() => onUpdateField(f.id, { required: !f.required })}
                    >
                      <Icon name={f.required ? "check" : "x"} size={10} color={f.required ? "#fff" : t.ink3} />
                      <Text style={[s.fieldOptTxt, f.required && { color: "#fff" }]}>Obrigatório</Text>
                    </Pressable>
                    {f.type === "text" && (
                      <View style={s.fieldOpt}>
                        <Text style={s.fieldOptTxt}>Máx:</Text>
                        <TextInput
                          style={s.fieldOptInput}
                          keyboardType="number-pad"
                          value={String(f.config?.max_chars || 30)}
                          onChangeText={(v) => onUpdateField(f.id, { config: { ...f.config, max_chars: parseInt(v) || 30 } })}
                        />
                        <Text style={s.fieldOptTxt}>chars</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable onPress={() => onRemoveField(f.id)} style={s.fieldDel} hitSlop={8}>
                  <Icon name="trash" size={13} color={t.ink4} />
                </Pressable>
              </View>
            ))}

            {/* Add field menu */}
            <View style={s.addFieldRow}>
              <Text style={s.addFieldLabel}>+ Adicionar campo:</Text>
              {(["text", "image", "template", "color", "option"] as CustomizationFieldType[]).map((ft) => (
                <Pressable key={ft} style={s.addFieldChip} onPress={() => onAddField(ft)}>
                  <Icon name={FIELD_TYPE_ICONS[ft] as any} size={11} color={t.primary} />
                  <Text style={s.addFieldChipTxt}>{FIELD_TYPE_LABELS[ft]}</Text>
                </Pressable>
              ))}
            </View>

            {/* Fase 10B — Botão IA sugere templates */}
            <Pressable
              onPress={onFetchSuggestions}
              style={[s.aiSuggestBtn, loadingSuggestions && { opacity: 0.6 }]}
              disabled={loadingSuggestions}
            >
              <Icon name="star" size={14} color={t.accent} />
              <Text style={s.aiSuggestTxt}>
                {loadingSuggestions ? "Pensando..." : "Sugestões IA de templates"}
              </Text>
            </Pressable>

            {/* Actions */}
            <View style={s.actions}>
              <Pressable style={s.btnSec} onPress={onClose}>
                <Text style={s.btnSecTxt}>Fechar</Text>
              </Pressable>
              <Pressable style={[s.btnPri, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="check" size={14} color="#fff" />
                    <Text style={s.btnPriTxt}>Salvar configuração</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function FilterChip({ s, label, count, active, onPress, tone }: { s: Styles; label: string; count: number; active: boolean; onPress: () => void; tone?: "primary" }) {
  return (
    <Pressable
      style={[
        s.filterChip,
        active && (tone === "primary" ? s.filterChipActivePri : s.filterChipActive),
      ]}
      onPress={onPress}
    >
      <Text style={[s.filterChipTxt, active && { color: "#fff" }]}>{label}</Text>
      <View style={[s.filterChipCount, active && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
        <Text style={[s.filterChipCountTxt, active && { color: "#fff" }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function buildStyles(t: Tokens) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    container: { padding: 28, paddingBottom: 60, maxWidth: 1100, alignSelf: "center", width: "100%" },

    headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" },
    eyebrow: { fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { fontSize: 24, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.4 },
    sub: { fontSize: 13.5, color: t.ink3, marginTop: 4 },
    statPill: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: t.primarySoft, borderRadius: 16 },
    statNum: { fontSize: 22, fontWeight: "900", color: t.primary, letterSpacing: -0.5 },
    statLabel: { fontSize: 10.5, color: t.primary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: -2 },

    filterRow: { flexDirection: "row", gap: 8, marginBottom: 18, flexWrap: "wrap" },
    filterChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: t.paperCard, borderRadius: 999, borderWidth: 1, borderColor: t.ink5 },
    filterChipActive: { backgroundColor: t.ink, borderColor: t.ink },
    filterChipActivePri: { backgroundColor: t.primary, borderColor: t.primary },
    filterChipTxt: { fontSize: 12.5, fontWeight: "700", color: t.ink2 },
    filterChipCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: t.ink5, alignItems: "center" },
    filterChipCountTxt: { fontSize: 11, fontWeight: "800", color: t.ink3 },

    emptyCard: { alignItems: "center", padding: 40, gap: 10, backgroundColor: t.paperCard, borderRadius: 18, borderWidth: 1, borderColor: t.ink5 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: t.ink, marginTop: 6 },
    emptySub: { fontSize: 13, color: t.ink3, textAlign: "center", maxWidth: 380 },

    list: { gap: 10 },
    productCard: { backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5, overflow: "hidden", position: "relative" },
    productCardActive: { borderColor: t.primarySoft, backgroundColor: t.paperCardElev },
    productRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
    productIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.bgSoft, alignItems: "center", justifyContent: "center" },
    productName: { fontSize: 14, fontWeight: "700", color: t.ink },
    productMeta: { fontSize: 12, color: t.ink3, marginTop: 2 },
    configBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: t.primaryGhost, borderRadius: 8 },
    configBtnTxt: { color: t.primary, fontSize: 11.5, fontWeight: "700" },

    // Fase 9B — quality score badge no canto sup. direito do card.
    // Width/height fixos (24x24) pra não esticar — alguns componentes
    // filhos tem flex:1 ou flexDirection:row e quebram o card se o
    // wrapper for largo. zIndex 5 pra ficar acima do hover/borders.
    qualityBadgeWrap: { position: "absolute", top: 8, right: 8, width: 24, height: 24, zIndex: 5 },

    // Expand: mobile = coluna unica (preview em cima + form em baixo)
    expand: { padding: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.ink5, gap: 16 },
    // Expand desktop: split horizontal (preview esquerda 320 + form direita flex 1)
    expandDesktop: { flexDirection: "row", alignItems: "flex-start", gap: 24 },

    // Preview pane — mobile: full width, centered; desktop: sidebar fixo 320
    previewPane: { alignItems: "center", gap: 10 },
    previewPaneDesktop: {
      width: 320,
      flexShrink: 0,
      // Sticky no web — fallback gracioso no mobile
      ...(Platform.OS === "web" ? ({ position: "sticky", top: 16 } as any) : {}),
    },
    previewLabel: { fontSize: 10.5, color: t.ink3, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", alignSelf: "stretch" },
    previewBox: { alignItems: "center", justifyContent: "center", padding: 8, backgroundColor: t.bgSoft, borderRadius: 14, borderWidth: 1, borderColor: t.ink5 },
    previewHint: { fontSize: 11.5, color: t.ink4, textAlign: "center", fontStyle: "italic", maxWidth: 320 },
    previewLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 2 },
    customerLink: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: t.primaryGhost, borderRadius: 999, borderWidth: 1, borderColor: t.primarySoft },
    customerLinkTxt: { fontSize: 12, fontWeight: "700", color: t.primary },

    // Fase 11B — Preview WhatsApp btn
    waPreviewBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: t.successSoft, borderRadius: 999, borderWidth: 1, borderColor: t.successSoft },
    waPreviewTxt: { fontSize: 12, fontWeight: "700", color: t.successInk },

    // Form column — mobile: cresce naturalmente; desktop: flex 1 do lado do preview
    formCol: { gap: 8 },
    formColDesktop: { flex: 1, minWidth: 0 },

    sectionLabel: { fontSize: 10.5, color: t.ink3, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
    row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    label: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
    input: { backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: t.ink },
    positionRow: { flexDirection: "row", gap: 4 },
    positionChip: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5, alignItems: "center" },
    positionChipSel: { backgroundColor: t.primary, borderColor: t.primary },
    positionChipTxt: { fontSize: 11.5, fontWeight: "700", color: t.ink3 },
    positionChipTxtSel: { color: "#fff" },

    hintInline: { fontSize: 12, color: t.ink3, fontStyle: "italic", marginBottom: 10, padding: 10, backgroundColor: t.bgSoft, borderRadius: 8 },

    fieldRow: { flexDirection: "row", gap: 10, padding: 10, marginTop: 6, backgroundColor: t.paperCardElev, borderRadius: 10, borderWidth: 1, borderColor: t.ink5 },
    fieldIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.primaryGhost, alignItems: "center", justifyContent: "center" },
    fieldHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    fieldLabel: { flex: 1, fontSize: 13.5, fontWeight: "700", color: t.ink, paddingVertical: 4 },
    fieldTypePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: t.bgSoft },
    fieldTypePillTxt: { fontSize: 10, fontWeight: "700", color: t.ink2, textTransform: "uppercase", letterSpacing: 0.3 },
    fieldOpts: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
    fieldOpt: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: t.bgSoft, borderRadius: 6 },
    fieldOptOn: { backgroundColor: t.primary },
    fieldOptTxt: { fontSize: 11, color: t.ink3, fontWeight: "600" },
    fieldOptInput: { fontSize: 11, color: t.ink, fontWeight: "700", paddingHorizontal: 4, minWidth: 28, backgroundColor: t.paperCardElev, borderRadius: 4 },
    fieldDel: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },

    addFieldRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 12 },
    addFieldLabel: { fontSize: 12, fontWeight: "700", color: t.ink3 },
    addFieldChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: t.primaryGhost, borderRadius: 999, borderWidth: 1, borderColor: t.primarySoft },
    addFieldChipTxt: { fontSize: 11.5, fontWeight: "700", color: t.primary },

    // Fase 10B — Botão IA sugestões
    aiSuggestBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: t.accentGhost, borderRadius: 8, borderWidth: 1, borderColor: t.accentSoft, alignSelf: "flex-start", marginTop: 8 },
    aiSuggestTxt: { color: t.accent, fontSize: 11.5, fontWeight: "700" },

    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
    btnPri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 10, minWidth: 120, justifyContent: "center" },
    btnPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
    btnSec: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev },
    btnSecTxt: { color: t.ink2, fontWeight: "600", fontSize: 13 },

    hintCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.primaryGhost, borderRadius: 12, padding: 12, marginTop: 22, borderWidth: 1, borderColor: t.primarySoft },
    hintTxt: { fontSize: 12, color: t.ink2, flex: 1, lineHeight: 17 },
    hintBold: { fontWeight: "700", color: t.primary },

    // Fase 10B — Modal sugestões IA
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
    modalCard: { width: "100%", maxWidth: 540, maxHeight: "85%", backgroundColor: t.paperCard, borderRadius: 18, padding: 18, gap: 12 },
    modalHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    modalEyebrow: { fontSize: 10.5, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    modalTitle: { fontSize: 18, fontWeight: "800", color: t.ink, marginTop: 2, letterSpacing: -0.3 },
    modalSub: { fontSize: 12.5, color: t.ink3, marginTop: 3, lineHeight: 17 },
    modalScroll: { maxHeight: 360 },
    suggestRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCardElev, marginBottom: 8 },
    suggestRowOn: { borderColor: t.accent, backgroundColor: t.accentGhost },
    suggestCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: t.ink5, alignItems: "center", justifyContent: "center", backgroundColor: t.paperCardElev },
    suggestCheckOn: { backgroundColor: t.accent, borderColor: t.accent },
    suggestId: { fontSize: 13, fontWeight: "700", color: t.ink },
    suggestReason: { fontSize: 12, color: t.ink3, marginTop: 2, lineHeight: 16 },
    suggestScorePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: t.accentGhost, borderWidth: 1, borderColor: t.accentSoft },
    suggestScoreTxt: { fontSize: 11, fontWeight: "800", color: t.accent },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  });
}
