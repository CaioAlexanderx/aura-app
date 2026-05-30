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
import { useEffect, useState, useCallback, useRef } from "react";
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
import { StudioColors } from "@/constants/studio-tokens";
import {
  studioApi,
  type StudioPricingRule,
  type StudioPricingTier,
} from "@/services/studioApi";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

// ─── Tipos locais ──────────────────────────────────────────
type Product = { id: string; name: string; price: number };

type TierDraft = {
  min_qty: string;
  max_qty: string;
  unit_multiplier: string;
  unit_price: string;
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
  return { min_qty: "", max_qty: "", unit_multiplier: "", unit_price: "" };
}

function ruleToDraft(rule: StudioPricingRule): Omit<ProductRuleDraft, "product" | "saving" | "preview_price"> {
  const tiers: TierDraft[] = Array.isArray(rule.qty_tiers)
    ? rule.qty_tiers.map((t) => ({
        min_qty:         String(t.min_qty ?? ""),
        max_qty:         t.max_qty != null ? String(t.max_qty) : "",
        unit_multiplier: t.unit_multiplier != null ? String(t.unit_multiplier) : "",
        unit_price:      t.unit_price      != null ? String(t.unit_price)      : "",
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
      if (t.unit_multiplier.trim() !== "") tier.unit_multiplier = parseFloat(t.unit_multiplier) || 1;
      if (t.unit_price.trim()      !== "") tier.unit_price      = parseFloat(t.unit_price)      || 0;
      return tier;
    });
}

// ─── Componente: editor de faixas de tiragem ───────────────
function TiersEditor({
  tiers,
  onChange,
}: {
  tiers: TierDraft[];
  onChange: (tiers: TierDraft[]) => void;
}) {
  function update(idx: number, key: keyof TierDraft, value: string) {
    const next = tiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t));
    onChange(next);
  }

  function add() {
    onChange([...tiers, emptyTier()]);
  }

  function remove(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }

  return (
    <View style={ts.tiersWrap}>
      <Text style={ts.tiersTitle}>Faixas de Tiragem</Text>
      <Text style={ts.tiersHint}>
        Preencha Min Qty (obrigatório). Deixe Max Qty em branco para "sem limite".
        Use Multiplicador OU Preço fixo/un — não ambos.
      </Text>

      {tiers.length === 0 && (
        <Text style={ts.tiersEmpty}>Sem faixas definidas — preço será calculado sem desconto por volume.</Text>
      )}

      {tiers.map((tier, idx) => (
        <View key={idx} style={ts.tierRow}>
          <View style={ts.tierCell}>
            <Text style={ts.tierLabel}>Min Qty</Text>
            <TextInput
              style={ts.tierInput}
              keyboardType="number-pad"
              placeholder="1"
              value={tier.min_qty}
              onChangeText={(v) => update(idx, "min_qty", v)}
            />
          </View>
          <View style={ts.tierCell}>
            <Text style={ts.tierLabel}>Max Qty</Text>
            <TextInput
              style={ts.tierInput}
              keyboardType="number-pad"
              placeholder="∞"
              value={tier.max_qty}
              onChangeText={(v) => update(idx, "max_qty", v)}
            />
          </View>
          <View style={ts.tierCell}>
            <Text style={ts.tierLabel}>Multiplicador</Text>
            <TextInput
              style={ts.tierInput}
              keyboardType="decimal-pad"
              placeholder="ex: 0.85"
              value={tier.unit_multiplier}
              onChangeText={(v) => update(idx, "unit_multiplier", v)}
            />
          </View>
          <View style={ts.tierCell}>
            <Text style={ts.tierLabel}>Preço fixo/un</Text>
            <TextInput
              style={ts.tierInput}
              keyboardType="decimal-pad"
              placeholder="ex: 39.90"
              value={tier.unit_price}
              onChangeText={(v) => update(idx, "unit_price", v)}
            />
          </View>
          <Pressable onPress={() => remove(idx)} style={ts.tierRemoveBtn}>
            <Icon name="x" size={14} color={StudioColors.dangerInk} />
          </Pressable>
        </View>
      ))}

      <Pressable onPress={add} style={ts.tiersAddBtn}>
        <Icon name="plus" size={13} color={StudioColors.primary} />
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
}: {
  cid: string;
  productId: string | null;
  qty: number;
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

  if (loading) return <ActivityIndicator size="small" color={StudioColors.primary} style={{ marginTop: 8 }} />;
  if (price === null) return null;

  return (
    <View style={ts.previewBadge}>
      <Icon name="tag" size={12} color={StudioColors.primary} />
      <Text style={ts.previewTxt}>
        Preço sugerido ({qty}un): <Text style={{ fontWeight: "800" }}>R$ {price.toFixed(2)}</Text>
      </Text>
    </View>
  );
}

// ─── Tela principal ────────────────────────────────────────
export default function StudioPrecificacao() {
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
          // Fallback: usa id como nome
          prodRules.forEach((r) => {
            if (r.product_id) productsMap[r.product_id] = { id: r.product_id, name: r.product_id, price: 0 };
          });
        }
      }

      const drafts: ProductRuleDraft[] = prodRules.map((r) => ({
        product:      productsMap[r.product_id!] ?? { id: r.product_id!, name: r.product_id!, price: 0 },
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

  function removeProductRule(idx: number) {
    setProductRules((prev) => prev.filter((_, i) => i !== idx));
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
        <ActivityIndicator size="small" color={StudioColors.primary} />
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
          <Icon name="arrow-left" size={14} color={StudioColors.ink2} />
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
            <PricingPreview cid={cid} productId={null} qty={1} />
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
          <Icon name="search" size={14} color={StudioColors.ink3} style={{ position: "absolute", left: 12, zIndex: 1 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar produto para adicionar regra..."
            placeholderTextColor={StudioColors.ink4}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading && (
            <ActivityIndicator size="small" color={StudioColors.primary} style={{ position: "absolute", right: 12 }} />
          )}
        </View>

        {searchResults.length > 0 && (
          <View style={s.searchResults}>
            {searchResults.map((p) => (
              <Pressable key={p.id} style={s.searchItem} onPress={() => addProductRule(p)}>
                <Text style={s.searchItemName}>{p.name}</Text>
                <Text style={s.searchItemPrice}>R$ {p.price.toFixed(2)}</Text>
                <Icon name="plus" size={12} color={StudioColors.primary} />
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
                    <Icon name="tag" size={11} color={StudioColors.primary} />
                    <Text style={ts.previewTxt}>
                      Preço sugerido (1un):{" "}
                      <Text style={{ fontWeight: "800" }}>R$ {draft.preview_price.toFixed(2)}</Text>
                    </Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => removeProductRule(idx)} style={s.removeBtn}>
                <Icon name="trash-2" size={13} color={StudioColors.dangerInk} />
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
              onChange={(tiers) => updateProductTiers(idx, tiers)}
            />

            {/* Preview rápido das faixas */}
            {draft.tiers.filter((t) => t.min_qty.trim() !== "").length > 0 && cid && (
              <View style={s.tiersPreviewRow}>
                <Icon name="layers" size={12} color={StudioColors.ink3} />
                <Text style={s.tiersPreviewLabel}>Preview por tiragem:</Text>
                {[1, 10, 50, 100].map((qty) => (
                  <PricingPreview key={qty} cid={cid} productId={draft.product.id} qty={qty} />
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
          <Text style={[s.formulaLine, { marginTop: 8, color: StudioColors.ink3, fontStyle: "italic" }]}>
            Se a faixa definir Preço fixo/un, ele substitui o cálculo de custo (override direto).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: StudioColors.bg },

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
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { fontSize: 24, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: StudioColors.ink3, marginTop: 4, maxWidth: 620, lineHeight: 19 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: StudioColors.ink5,
  },
  backTxt: { fontSize: 12.5, color: StudioColors.ink2, fontWeight: "600" },

  section: {
    marginHorizontal: 28,
    marginTop: 8,
    marginBottom: 16,
    padding: 20,
    gap: 10,
    backgroundColor: StudioColors.paperCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: StudioColors.ink5,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: StudioColors.ink, letterSpacing: -0.2 },
  sectionHelp: { fontSize: 12.5, color: StudioColors.ink3, lineHeight: 18 },

  fieldsRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 8 },
  fieldWrap: { flex: 1, minWidth: 140 },
  label: {
    fontSize: 11,
    color: StudioColors.ink3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  input: {
    backgroundColor: StudioColors.paperCardElev,
    borderWidth: 1.5,
    borderColor: StudioColors.ink5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: StudioColors.ink,
  },
  hint: { fontSize: 11, color: StudioColors.ink4, marginTop: 4, lineHeight: 15 },

  saveRow: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 4 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: StudioColors.primary,
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
    backgroundColor: StudioColors.paperCardElev,
    borderWidth: 1.5,
    borderColor: StudioColors.ink5,
    borderRadius: 10,
    paddingHorizontal: 36,
    paddingVertical: 10,
    fontSize: 13.5,
    color: StudioColors.ink,
  },
  searchResults: {
    backgroundColor: StudioColors.paperCardElev,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: StudioColors.ink5,
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
    borderBottomColor: StudioColors.ink5,
  },
  searchItemName: { flex: 1, fontSize: 13, color: StudioColors.ink, fontWeight: "600" },
  searchItemPrice: { fontSize: 11.5, color: StudioColors.ink3 },

  emptyTxt: { fontSize: 12.5, color: StudioColors.ink3, textAlign: "center", paddingVertical: 12 },

  // Card de produto
  productCard: {
    backgroundColor: StudioColors.paperCardElev,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: StudioColors.primaryBorder,
    padding: 16,
    marginTop: 12,
    gap: 4,
  },
  productCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  productCardName: { fontSize: 15, fontWeight: "800", color: StudioColors.primary },
  removeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: StudioColors.dangerSoft,
  },

  tiersPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: StudioColors.ink5,
  },
  tiersPreviewLabel: { fontSize: 11, color: StudioColors.ink3, fontWeight: "700" },

  // Fórmula
  formulaBox: {
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: StudioColors.primaryBorder,
  },
  formulaLine: { fontSize: 12.5, color: StudioColors.ink2, lineHeight: 18 },
  formulaKey: { fontWeight: "800", color: StudioColors.primary },
});

// Styles usados pelo TiersEditor (separados pra não misturar com o StyleSheet da tela)
const ts = StyleSheet.create({
  tiersWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: StudioColors.ink5,
    gap: 8,
  },
  tiersTitle: { fontSize: 13, fontWeight: "800", color: StudioColors.ink, marginBottom: 2 },
  tiersHint: { fontSize: 11.5, color: StudioColors.ink3, lineHeight: 16, marginBottom: 4 },
  tiersEmpty: { fontSize: 12, color: StudioColors.ink4, fontStyle: "italic" },

  tierRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    backgroundColor: StudioColors.bgSoft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: StudioColors.ink5,
  },
  tierCell: { flex: 1, minWidth: 90 },
  tierLabel: {
    fontSize: 10,
    color: StudioColors.ink3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  tierInput: {
    backgroundColor: StudioColors.paperCardElev,
    borderWidth: 1,
    borderColor: StudioColors.ink5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: StudioColors.ink,
  },
  tierRemoveBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: StudioColors.dangerSoft,
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
    backgroundColor: StudioColors.primaryGhost,
    borderWidth: 1,
    borderColor: StudioColors.primaryBorder,
    marginTop: 4,
  },
  tiersAddTxt: { fontSize: 12, color: StudioColors.primary, fontWeight: "700" },

  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: StudioColors.primarySoft,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  previewTxt: { fontSize: 11.5, color: StudioColors.primary },
});
