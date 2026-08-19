// ============================================================
// AURA STUDIO · /studio/configuracoes/precificacao
// Camada 1 — Fase B (Motor de Precificação)
//
// Três seções:
//   1. Regra Global   — Setup/Arte, Mão de obra, Margem, Urgência
//   2. Regras por Produto — lista + inline editor + faixas de tiragem
//   3. Preview ao vivo   — preço sugerido após salvar
//
// Consome exclusivamente studioApi (listPricingRules / savePricingRule /
// calculateQuoteLine) + GET /companies/:cid/products?q= para busca de produto.
//
// Cores: navy #1E3A8A (primary), magenta #EC4899 (accent) — StudioColors.
// Layout: segue padrão de marketplace.tsx (ScrollView + section cards).
// ============================================================
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import {
  studioApi,
  type StudioPricingRule,
  type StudioPricingTier,
} from "@/services/studioApi";
import { request } from "@/services/api";
import { confirmAlert } from "@/utils/webAlert";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// ─── Tipos locais ──────────────────────────────────────────
type Product = { id: string; name: string; price: number };

// QA fix (achado #15): antes existiam DOIS campos de preço (Multiplicador
// e Preço fixo/un) lado a lado, com a regra "use um OU outro" só em texto
// de ajuda — sem validação. Isso permitia preencher os dois por engano e
// o motor aplicar um comportamento não óbvio. Agora é um toggle explícito:
// só o campo do modo escolhido aparece.
type TierMode = "multiplier" | "fixed";

type TierDraft = {
  min_qty: string;
  max_qty: string;
  unit_multiplier: string;
  unit_price: string;
  mode: TierMode;
};

type ProductRuleDraft = {
  product: Product;
  setup_fee: string;
  labor_cost: string;
  default_margin_pct: string;
  urgency_pct: string;
  tiers: TierDraft[];
  saving: boolean;
  preview_price: number | null;
};

// ─── Helpers ───────────────────────────────────────────────
function emptyTier(): TierDraft {
  return { min_qty: "", max_qty: "", unit_multiplier: "", unit_price: "", mode: "multiplier" };
}

function ruleToDraft(rule: StudioPricingRule): Omit<ProductRuleDraft, "product" | "saving" | "preview_price"> {
  const tiers: TierDraft[] = Array.isArray(rule.qty_tiers)
    ? rule.qty_tiers.map((t) => ({
        min_qty:         String(t.min_qty ?? ""),
        max_qty:         t.max_qty != null ? String(t.max_qty) : "",
        unit_multiplier: t.unit_multiplier != null ? String(t.unit_multiplier) : "",
        unit_price:      t.unit_price      != null ? String(t.unit_price)      : "",
        // Regra já salva com preço fixo → toggle abre em "fixed"; senão
        // (ou nenhum dos dois) abre em "multiplier" (default histórico).
        mode:            t.unit_price != null ? "fixed" : "multiplier",
      }))
    : [];
  return {
    setup_fee:          String(rule.setup_fee          ?? "0"),
    labor_cost:         String(rule.labor_cost         ?? "0"),
    default_margin_pct: rule.default_margin_pct != null ? String(rule.default_margin_pct) : "",
    urgency_pct:        String(rule.urgency_pct        ?? "0"),
    tiers,
  };
}

function tiersFromDraft(tiers: TierDraft[]): StudioPricingTier[] {
  return tiers
    .filter((t) => t.min_qty.trim() !== "")
    .map((t) => {
      const tier: StudioPricingTier = {
        min_qty: parseInt(t.min_qty, 10) || 0,
        max_qty: t.max_qty.trim() !== "" ? parseInt(t.max_qty, 10) : null,
      };
      // Só manda o campo do modo selecionado — nunca os dois (achado #15).
      if (t.mode === "fixed") {
        tier.unit_price = parseFloat(t.unit_price) || 0;
      } else {
        tier.unit_multiplier = t.unit_multiplier.trim() !== "" ? parseFloat(t.unit_multiplier) || 1 : 1;
      }
      return tier;
    });
}

// QA fix (achado #15): nada impedia faixas sobrepostas (ex: 1-50 e
// 10-100) — o motor aplica a primeira que bater, gerando preço errado no
// orçamento do cliente sem nenhum aviso. Valida ordem e sobreposição antes
// de salvar.
function validateTiers(tiers: TierDraft[]): string | null {
  const filled = tiers.filter((t) => t.min_qty.trim() !== "");
  if (filled.length === 0) return null;

  const parsed = filled.map((t) => ({
    min: parseInt(t.min_qty, 10) || 0,
    max: t.max_qty.trim() !== "" ? parseInt(t.max_qty, 10) : null,
  }));

  for (const r of parsed) {
    if (r.max != null && r.max < r.min) {
      return `Faixa inválida: "Até" (${r.max}) não pode ser menor que "De" (${r.min}).`;
    }
  }

  const sorted = [...parsed].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const curEnd = cur.max ?? Infinity;
    if (next.min <= curEnd) {
      return `Faixas sobrepostas: ${cur.min}–${cur.max ?? "∞"} e ${next.min}–${next.max ?? "∞"} se cruzam. Ajuste os limites pra não sobrar dúvida sobre qual faixa vale.`;
    }
  }
  return null;
}

// ─── Componente: editor de faixas de tiragem ───────────────
function TiersEditor({
  tiers,
  onChange,
  t,
  ts,
}: {
  tiers: TierDraft[];
  onChange: (tiers: TierDraft[]) => void;
  t: any;
  ts: any;
}) {
  function update(idx: number, key: keyof TierDraft, value: string) {
    const next = tiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t));
    onChange(next);
  }

  function setMode(idx: number, mode: TierMode) {
    const next = tiers.map((t, i) => (i === idx ? { ...t, mode } : t));
    onChange(next);
  }

  function add() {
    onChange([...tiers, emptyTier()]);
  }

  function remove(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }

  // QA fix (achado #15): valida sobreposição/ordem em tempo real.
  const validationError = validateTiers(tiers);

  return (
    <View style={ts.tiersWrap}>
      <Text style={ts.tiersTitle}>Faixas de Tiragem</Text>
      <Text style={ts.tiersHint}>
        Preencha "De" (obrigatório). Deixe "Até" em branco para "sem limite".
      </Text>

      {tiers.length === 0 && (
        <Text style={ts.tiersEmpty}>Sem faixas definidas — preço será calculado sem desconto por volume.</Text>
      )}

      {tiers.map((tier, idx) => (
        <View key={idx} style={ts.tierRow}>
          <View style={ts.tierRowTop}>
            <View style={ts.tierCell}>
              <Text style={ts.tierLabel}>De (qtd)</Text>
              <TextInput
                style={ts.tierInput}
                keyboardType="number-pad"
                placeholder="1"
                value={tier.min_qty}
                onChangeText={(v) => update(idx, "min_qty", v)}
              />
            </View>
            <View style={ts.tierCell}>
              <Text style={ts.tierLabel}>Até (qtd)</Text>
              <TextInput
                style={ts.tierInput}
                keyboardType="number-pad"
                placeholder="∞"
                value={tier.max_qty}
                onChangeText={(v) => update(idx, "max_qty", v)}
              />
            </View>
            <Pressable onPress={() => remove(idx)} style={ts.tierRemoveBtn}>
              <Icon name="x" size={14} color={t.dangerInk} />
            </Pressable>
          </View>

          {/* Toggle explícito — QA fix #15: antes eram dois campos junto
              com um aviso em texto pra "usar um OU outro". */}
          <View style={ts.tierModeRow}>
            <Pressable
              onPress={() => setMode(idx, "multiplier")}
              style={[ts.tierModeChip, tier.mode === "multiplier" && ts.tierModeChipSel]}
            >
              <Text style={[ts.tierModeChipTxt, tier.mode === "multiplier" && ts.tierModeChipTxtSel]}>Multiplicador</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode(idx, "fixed")}
              style={[ts.tierModeChip, tier.mode === "fixed" && ts.tierModeChipSel]}
            >
              <Text style={[ts.tierModeChipTxt, tier.mode === "fixed" && ts.tierModeChipTxtSel]}>Preço fechado</Text>
            </Pressable>
          </View>

          {tier.mode === "multiplier" ? (
            <View style={ts.tierCell}>
              <Text style={ts.tierLabel}>Multiplicador sobre o custo base</Text>
              <TextInput
                style={ts.tierInput}
                keyboardType="decimal-pad"
                placeholder="ex: 0.85 (15% mais barato)"
                value={tier.unit_multiplier}
                onChangeText={(v) => update(idx, "unit_multiplier", v)}
              />
            </View>
          ) : (
            <View style={ts.tierCell}>
              <Text style={ts.tierLabel}>Preço fechado por unidade (R$)</Text>
              <TextInput
                style={ts.tierInput}
                keyboardType="decimal-pad"
                placeholder="ex: 39,90"
                value={tier.unit_price}
                onChangeText={(v) => update(idx, "unit_price", v)}
              />
            </View>
          )}
        </View>
      ))}

      {validationError && (
        <View style={ts.tierErrorBox}>
          <Icon name="alert-circle" size={13} color={t.dangerInk} />
          <Text style={ts.tierErrorTxt}>{validationError}</Text>
        </View>
      )}

      <Pressable onPress={add} style={ts.tiersAddBtn}>
        <Icon name="plus" size={13} color={t.primary} />
        <Text style={ts.tiersAddTxt}>Adicionar faixa</Text>
      </Pressable>
    </View>
  );
}

// ─── Componente: preview de preço ao vivo ──────────────────
function PricingPreview({
  cid,
  productId,
  qty,
  t,
  ts,
}: {
  cid: string;
  productId: string | null;
  qty: number;
  t: any;
  ts: any;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studioApi
      .calculateQuoteLine(cid, { product_id: productId, quantity: qty })
      .then((res) => {
        if (!cancelled) setPrice(res.unit_price);
      })
      .catch(() => {
        if (!cancelled) setPrice(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cid, productId, qty]);

  if (loading) return <ActivityIndicator size="small" color={t.primary} style={{ marginTop: 8 }} />;
  if (price === null) return null;

  return (
    <View style={ts.previewBadge}>
      <Icon name="tag" size={12} color={t.primary} />
      <Text style={ts.previewTxt}>
        Preço sugerido ({qty}un): <Text style={{ fontWeight: "800" }}>R$ {price.toFixed(2)}</Text>
      </Text>
    </View>
  );
}

// ─── Tela principal ────────────────────────────────────────
export default function StudioPrecificacao() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const ts = useMemo(() => buildTiersStyles(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const cid = company?.id ?? "";

  // ── Estado global rule ──
  const [globalRule, setGlobalRule] = useState<StudioPricingRule | null>(null);
  const [globalDraft, setGlobalDraft] = useState({
    setup_fee:          "0",
    labor_cost:         "0",
    default_margin_pct: "30",
    urgency_pct:        "0",
  });
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalSaved, setGlobalSaved] = useState(false);

  // ── Estado product rules ──
  const [productRules, setProductRules] = useState<ProductRuleDraft[]>([]);

  // ── Busca de produto ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Loading geral ──
  const [loading, setLoading] = useState(true);

  // ─── Carrega regras ────────────────────────────────────────
  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const { rules } = await studioApi.listPricingRules(cid);

      const globalR = rules.find((r) => r.product_id === null) ?? null;
      setGlobalRule(globalR);
      if (globalR) {
        setGlobalDraft({
          setup_fee:          String(globalR.setup_fee          ?? "0"),
          labor_cost:         String(globalR.labor_cost         ?? "0"),
          default_margin_pct: globalR.default_margin_pct != null ? String(globalR.default_margin_pct) : "30",
          urgency_pct:        String(globalR.urgency_pct        ?? "0"),
        });
      }

      // Regras por produto: precisamos do nome do produto
      const prodRules = rules.filter((r) => r.product_id !== null);

      // Busca nomes em lote via products?ids= se houver regras por produto
      const prodIds = prodRules.map((r) => r.product_id!).join(",");
      let productsMap: Record<string, Product> = {};

      if (prodIds) {
        try {
          const { products } = await request<{ products: Product[] }>(
            `/companies/${cid}/products?ids=${prodIds}`,
            { method: "GET" }
          );
          (products || []).forEach((p) => { productsMap[p.id] = p; });
        } catch {
          // QA fix (achado #16): fallback usava o UUID cru como "nome" —
          // o card da regra mostrava algo como "3f9a1c2e-..." em vez de
          // um texto legível.
          prodRules.forEach((r) => {
            if (r.product_id) productsMap[r.product_id] = { id: r.product_id, name: "Produto indisponível", price: 0 };
          });
        }
      }

      const drafts: ProductRuleDraft[] = prodRules.map((r) => ({
        // QA fix (achado #16): mesma cobertura pro caso em que a API
        // devolveu a lista mas SEM esse id específico (produto excluído).
        product:      productsMap[r.product_id!] ?? { id: r.product_id!, name: "Produto indisponível", price: 0 },
        ...ruleToDraft(r),
        saving:       false,
        preview_price: null,
      }));
      setProductRules(drafts);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar regras de precificação");
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => { load(); }, [load]);

  // ─── Salvar regra global ───────────────────────────────────
  async function saveGlobal() {
    if (!cid) return;
    setSavingGlobal(true);
    try {
      await studioApi.savePricingRule(cid, "global", {
        setup_fee:          parseFloat(globalDraft.setup_fee)          || 0,
        labor_cost:         parseFloat(globalDraft.labor_cost)         || 0,
        default_margin_pct: globalDraft.default_margin_pct.trim() !== "" ? parseFloat(globalDraft.default_margin_pct) : null,
        urgency_pct:        parseFloat(globalDraft.urgency_pct)        || 0,
        qty_tiers:          null, // global não usa faixas (DA-B)
      });
      toast.success("Regra global salva!");
      setGlobalSaved(true);
      setTimeout(() => setGlobalSaved(false), 3000);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar regra global");
    } finally {
      setSavingGlobal(false);
    }
  }

  // ─── Salvar regra por produto ──────────────────────────────
  async function saveProductRule(idx: number) {
    if (!cid) return;
    const draft = productRules[idx];

    // QA fix (achado #15): bloqueia o save se as faixas estiverem
    // sobrepostas/fora de ordem — evita salvar uma regra que dá preço
    // errado (ambíguo) no orçamento do cliente.
    const tiersError = validateTiers(draft.tiers);
    if (tiersError) {
      toast.error(tiersError);
      return;
    }

    setProductRules((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, saving: true } : d))
    );
    try {
      const tiers = tiersFromDraft(draft.tiers);
      await studioApi.savePricingRule(cid, draft.product.id, {
        setup_fee:          parseFloat(draft.setup_fee)          || 0,
        labor_cost:         parseFloat(draft.labor_cost)         || 0,
        default_margin_pct: draft.default_margin_pct.trim() !== "" ? parseFloat(draft.default_margin_pct) : null,
        urgency_pct:        parseFloat(draft.urgency_pct)        || 0,
        qty_tiers:          tiers.length > 0 ? tiers : null,
      });
      toast.success(`Regra de "${draft.product.name}" salva!`);

      // Atualiza preview após salvar
      try {
        const { unit_price } = await studioApi.calculateQuoteLine(cid, {
          product_id: draft.product.id,
          quantity:   1,
        });
        setProductRules((prev) =>
          prev.map((d, i) => (i === idx ? { ...d, saving: false, preview_price: unit_price } : d))
        );
      } catch {
        setProductRules((prev) =>
          prev.map((d, i) => (i === idx ? { ...d, saving: false } : d))
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar regra do produto");
      setProductRules((prev) =>
        prev.map((d, i) => (i === idx ? { ...d, saving: false } : d))
      );
    }
  }

  // ─── Adicionar produto ─────────────────────────────────────
  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { products } = await request<{ products: Product[] }>(
          `/companies/${cid}/products?q=${encodeURIComponent(q)}&limit=10`,
          { method: "GET" }
        );
        // Filtra produtos que já têm regra
        const existing = new Set(productRules.map((d) => d.product.id));
        setSearchResults((products || []).filter((p) => !existing.has(p.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }

  function addProductRule(product: Product) {
    setProductRules((prev) => [
      ...prev,
      {
        product,
        setup_fee:          globalDraft.setup_fee,
        labor_cost:         globalDraft.labor_cost,
        default_margin_pct: globalDraft.default_margin_pct,
        urgency_pct:        globalDraft.urgency_pct,
        tiers:              [],
        saving:             false,
        preview_price:      null,
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  // QA fix (achado #4): este botão só tirava o card da tela (filter no
  // estado local) — a regra continuava no banco e seguia sendo aplicada
  // nos orçamentos seguintes. Agora exclui de verdade via
  // DELETE /pricing/rules/:productId (soft-delete no backend), com
  // confirmação porque afeta o preço das próximas propostas.
  //
  // 404 = a regra nunca chegou a ser salva (card recém-adicionado que o
  // lojista desistiu de preencher): tirar da tela é exatamente o
  // resultado esperado, então não é erro.
  function removeProductRule(idx: number) {
    const draft = productRules[idx];
    if (!draft) return;

    confirmAlert(
      "Excluir regra de preço",
      `A regra de "${draft.product.name}" deixa de valer e os próximos orçamentos voltam a usar a regra global.`,
      "Excluir",
      async () => {
        try {
          await studioApi.deletePricingRule(cid, draft.product.id);
          toast.success("Regra excluída");
        } catch (e: any) {
          if (e?.status !== 404) {
            const status = e?.status ? `[${e.status}] ` : "";
            toast.error(`${status}${e?.data?.error || e?.message || "Erro ao excluir regra"}`);
            return;
          }
        }
        setProductRules((prev) => prev.filter((_, i) => i !== idx));
      },
      { destructive: true }
    );
  }

  function updateProductField(
    idx: number,
    key: keyof Omit<ProductRuleDraft, "product" | "tiers" | "saving" | "preview_price">,
    value: string
  ) {
    setProductRules((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d))
    );
  }

  function updateProductTiers(idx: number, tiers: TierDraft[]) {
    setProductRules((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, tiers } : d))
    );
  }

  // ─── Render loading ────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.wrap, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="small" color={t.primary} />
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>CONFIGURAÇÕES · MOTOR DE PRECIFICAÇÃO</Text>
          <Text style={s.title}>Precificação do Estúdio</Text>
          <Text style={s.sub}>
            Defina custo de arte, mão de obra, margem e faixas de tiragem. O motor calcula o preço sugerido automaticamente em cada orçamento.
          </Text>
        </View>
        <Pressable style={s.backBtn} onPress={() => router.push("/studio/configuracoes" as any)}>
          <Icon name="arrow-left" size={14} color={t.ink2} />
          <Text style={s.backTxt}>Voltar</Text>
        </Pressable>
      </View>

      {/* ══ Seção 1: Regra Global ══════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Regra Global da Loja</Text>
        <Text style={s.sectionHelp}>
          Aplicada a todos os produtos sem regra própria. Serve como padrão — você pode criar exceções por produto abaixo.
        </Text>

        <View style={s.fieldsRow}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Setup / Arte (R$)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0,00"
              value={globalDraft.setup_fee}
              onChangeText={(v) => setGlobalDraft((d) => ({ ...d, setup_fee: v }))}
            />
            <Text style={s.hint}>Cobrado uma vez e rateado pela quantidade do pedido.</Text>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Mão de obra / un (R$)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0,00"
              value={globalDraft.labor_cost}
              onChangeText={(v) => setGlobalDraft((d) => ({ ...d, labor_cost: v }))}
            />
            <Text style={s.hint}>Custo de produção por unidade.</Text>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Margem alvo (%)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="30"
              value={globalDraft.default_margin_pct}
              onChangeText={(v) => setGlobalDraft((d) => ({ ...d, default_margin_pct: v }))}
            />
            <Text style={s.hint}>Ex: 30 = 30% de margem sobre o custo total.</Text>
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Urgência (%)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0"
              value={globalDraft.urgency_pct}
              onChangeText={(v) => setGlobalDraft((d) => ({ ...d, urgency_pct: v }))}
            />
            <Text style={s.hint}>Adicional sobre o custo quando o pedido for urgente.</Text>
          </View>
        </View>

        <View style={s.saveRow}>
          <Pressable
            style={[s.saveBtn, savingGlobal && { opacity: 0.6 }]}
            onPress={saveGlobal}
            disabled={savingGlobal}
          >
            {savingGlobal ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name={globalSaved ? "check" : "save"} size={14} color="#fff" />
                <Text style={s.saveBtnTxt}>{globalSaved ? "Salvo!" : "Salvar regra global"}</Text>
              </>
            )}
          </Pressable>

          {globalSaved && cid && (
            <PricingPreview cid={cid} productId={null} qty={1} t={t} ts={ts} />
          )}
        </View>
      </View>

      {/* ══ Seção 2: Regras por Produto ═══════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Regras por Produto</Text>
        <Text style={s.sectionHelp}>
          Exceções à regra global. Quando um produto tem regra própria, ela tem prioridade no cálculo do orçamento. Faixas de tiragem ficam aqui — não na regra global.
        </Text>

        {/* Busca de produto */}
        <View style={s.searchWrap}>
          {/* Bonus fix (mesma classe do achado #22): o componente Icon só
              aceita name/size/color — um style={{position:"absolute"}}
              direto nele é descartado. Envolve num View pra posicionar. */}
          <View style={{ position: "absolute", left: 12, zIndex: 1 }}>
            <Icon name="search" size={14} color={t.ink3} />
          </View>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar produto para adicionar regra..."
            placeholderTextColor={t.ink4}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading && (
            <ActivityIndicator size="small" color={t.primary} style={{ position: "absolute", right: 12 }} />
          )}
        </View>

        {searchResults.length > 0 && (
          <View style={s.searchResults}>
            {searchResults.map((p) => (
              <Pressable key={p.id} style={s.searchItem} onPress={() => addProductRule(p)}>
                <Text style={s.searchItemName}>{p.name}</Text>
                <Text style={s.searchItemPrice}>R$ {p.price.toFixed(2)}</Text>
                <Icon name="plus" size={12} color={t.primary} />
              </Pressable>
            ))}
          </View>
        )}

        {productRules.length === 0 && (
          <Text style={s.emptyTxt}>
            Nenhuma regra por produto. Use a busca acima para adicionar.
          </Text>
        )}

        {productRules.map((draft, idx) => (
          <View key={draft.product.id} style={s.productCard}>
            <View style={s.productCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.productCardName}>{draft.product.name}</Text>
                {draft.preview_price !== null && (
                  <View style={ts.previewBadge}>
                    <Icon name="tag" size={11} color={t.primary} />
                    <Text style={ts.previewTxt}>
                      Preço sugerido (1un):{" "}
                      <Text style={{ fontWeight: "800" }}>R$ {draft.preview_price.toFixed(2)}</Text>
                    </Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => removeProductRule(idx)} style={s.removeBtn}>
                <Icon name="trash-2" size={13} color={t.danger} />
              </Pressable>
            </View>

            <View style={s.fieldsRow}>
              <View style={s.fieldWrap}>
                <Text style={s.label}>Setup / Arte (R$)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  value={draft.setup_fee}
                  onChangeText={(v) => updateProductField(idx, "setup_fee", v)}
                />
              </View>
              <View style={s.fieldWrap}>
                <Text style={s.label}>Mão de obra / un (R$)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  value={draft.labor_cost}
                  onChangeText={(v) => updateProductField(idx, "labor_cost", v)}
                />
              </View>
              <View style={s.fieldWrap}>
                <Text style={s.label}>Margem alvo (%)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  placeholder="30"
                  value={draft.default_margin_pct}
                  onChangeText={(v) => updateProductField(idx, "default_margin_pct", v)}
                />
              </View>
              <View style={s.fieldWrap}>
                <Text style={s.label}>Urgência (%)</Text>
                <TextInput
                  style={s.input}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  value={draft.urgency_pct}
                  onChangeText={(v) => updateProductField(idx, "urgency_pct", v)}
                />
              </View>
            </View>

            {/* Faixas de Tiragem */}
            <TiersEditor
              tiers={draft.tiers}
              onChange={(tiers) => updateProductTiers(idx, tiers)} t={t} ts={ts} />

            {/* Preview rápido das faixas */}
            {draft.tiers.filter((t) => t.min_qty.trim() !== "").length > 0 && cid && (
              <View style={s.tiersPreviewRow}>
                <Icon name="layers" size={12} color={t.ink3} />
                <Text style={s.tiersPreviewLabel}>Preview por tiragem:</Text>
                {[1, 10, 50, 100].map((qty) => (
                  <PricingPreview key={qty} cid={cid} productId={draft.product.id} qty={qty} t={t} ts={ts} />
                ))}
              </View>
            )}

            <Pressable
              style={[s.saveBtn, { marginTop: 14 }, draft.saving && { opacity: 0.6 }]}
              onPress={() => saveProductRule(idx)}
              disabled={draft.saving}
            >
              {draft.saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="save" size={14} color="#fff" />
                  <Text style={s.saveBtnTxt}>Salvar regra de {draft.product.name}</Text>
                </>
              )}
            </Pressable>
          </View>
        ))}
      </View>

      {/* ══ Seção 3: Info sobre o motor ═══════════════════════ */}
      <View style={[s.section, { marginBottom: 8 }]}>
        <Text style={s.sectionTitle}>Como o motor calcula</Text>
        <View style={s.formulaBox}>
          <Text style={s.formulaLine}>
            <Text style={s.formulaKey}>Custo base</Text> = BOM (insumos) × Multiplicador da faixa
          </Text>
          <Text style={s.formulaLine}>
            <Text style={s.formulaKey}>Custo total/un</Text> = Custo base + Mão de obra + (Setup ÷ Qtd)
          </Text>
          <Text style={s.formulaLine}>
            <Text style={s.formulaKey}>Preço sugerido</Text> = Custo total ÷ (1 - Margem/100)
          </Text>
          <Text style={s.formulaLine}>
            <Text style={s.formulaKey}>+ Urgência</Text> = Preço sugerido + (Custo total × Urgência%)
          </Text>
          <Text style={[s.formulaLine, { marginTop: 8, color: t.ink3, fontStyle: "italic" }]}>
            Se a faixa definir Preço fixo/un, ele substitui o cálculo de custo (override direto).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────
const buildStyles = (t: StudioPalette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 11,
    color: t.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { fontSize: 24, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: t.ink3, marginTop: 4, maxWidth: 620, lineHeight: 19 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.ink5,
  },
  backTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },

  section: {
    marginHorizontal: 28,
    marginTop: 8,
    marginBottom: 16,
    padding: 20,
    gap: 10,
    backgroundColor: t.paperCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
  sectionHelp: { fontSize: 12.5, color: t.ink3, lineHeight: 18 },

  fieldsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 8 },
  fieldWrap: { flex: 1, minWidth: 140 },
  label: {
    fontSize: 11,
    color: t.ink3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  input: {
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.ink5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: t.ink,
  },
  hint: { fontSize: 11, color: t.ink4, marginTop: 4, lineHeight: 15 },

  saveRow: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 4 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // Busca de produto
  searchWrap: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.ink5,
    borderRadius: 10,
    paddingHorizontal: 36,
    paddingVertical: 10,
    fontSize: 13.5,
    color: t.ink,
  },
  searchResults: {
    backgroundColor: t.paperCardElev,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.ink5,
    marginTop: 4,
    overflow: "hidden",
  },
  searchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.ink5,
  },
  searchItemName: { flex: 1, fontSize: 13, color: t.ink, fontWeight: "600" },
  searchItemPrice: { fontSize: 11.5, color: t.ink3 },

  emptyTxt: { fontSize: 12.5, color: t.ink3, textAlign: "center", paddingVertical: 12 },

  // Card de produto
  productCard: {
    backgroundColor: t.paperCardElev,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: t.primaryBorder,
    padding: 16,
    marginTop: 12,
    gap: 4,
  },
  productCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  productCardName: { fontSize: 15, fontWeight: "800", color: t.primary },
  removeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: t.dangerSoft,
  },

  tiersPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: t.ink5,
  },
  tiersPreviewLabel: { fontSize: 11, color: t.ink3, fontWeight: "700" },

  // Fórmula
  formulaBox: {
    backgroundColor: t.primaryGhost,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  formulaLine: { fontSize: 12.5, color: t.ink2, lineHeight: 18 },
  formulaKey: { fontWeight: "800", color: t.primary },
});

// Styles usados pelo TiersEditor (separados pra não misturar com o StyleSheet da tela)
const buildTiersStyles = (t: any) => StyleSheet.create({
  tiersWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: t.ink5,
    gap: 8,
  },
  tiersTitle: { fontSize: 13, fontWeight: "800", color: t.ink, marginBottom: 2 },
  tiersHint: { fontSize: 11.5, color: t.ink3, lineHeight: 16, marginBottom: 4 },
  tiersEmpty: { fontSize: 12, color: t.ink4, fontStyle: "italic" },

  tierRow: {
    gap: 8,
    backgroundColor: t.bgSoft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  tierRowTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  // Toggle explícito Multiplicador vs Preço fechado (achado #15)
  tierModeRow: { flexDirection: "row", gap: 6 },
  tierModeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.paperCardElev,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  tierModeChipSel: { backgroundColor: t.primary, borderColor: t.primary },
  tierModeChipTxt: { fontSize: 11, fontWeight: "700", color: t.ink2 },
  tierModeChipTxtSel: { color: "#fff" },
  tierErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: t.dangerSoft,
    borderRadius: 8,
    padding: 10,
  },
  tierErrorTxt: { flex: 1, fontSize: 11.5, color: t.dangerInk, lineHeight: 15 },
  tierCell: { flex: 1, minWidth: 90 },
  tierLabel: {
    fontSize: 10,
    color: t.ink3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  tierInput: {
    backgroundColor: t.paperCardElev,
    borderWidth: 1,
    borderColor: t.ink5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: t.ink,
  },
  tierRemoveBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: t.dangerSoft,
    alignSelf: "flex-end",
  },

  tiersAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: t.primaryGhost,
    borderWidth: 1,
    borderColor: t.primaryBorder,
    marginTop: 4,
  },
  tiersAddTxt: { fontSize: 12, color: t.primary, fontWeight: "700" },

  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: t.primarySoft,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  previewTxt: { fontSize: 11.5, color: t.primary },
});
