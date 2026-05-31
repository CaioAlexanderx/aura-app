// ============================================================
// AURA STUDIO · Insumos / Matéria-prima + Fichas Técnicas (Fase 3 + Fase D BOM)
//
// Duas abas:
//   "Insumos"       — CRUD funcional de matérias-primas (existente, sem alteração)
//   "Fichas Técnicas" — BOM: vincular insumos a produtos, calcular custo + margem
//
// Fase D (Camada 1, 30/05/2026): plug BOM usando endpoints já existentes no backend:
//   getComposition / saveComposition / listCompositionsSummary (studioApi)
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { type StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type StudioInput, type CompositionItem, type CompositionSummary } from "@/services/studioApi";
import { companiesApi } from "@/services/companiesApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";

const UNITS = ["un", "g", "kg", "ml", "L", "folha", "cm", "m"];

// ─── Semáforo de margem ───────────────────────────────────────────────────────
function marginColor(pct: number | null): string {
  if (pct == null) return "#94a3b8";
  if (pct >= 30) return "#22c55e";
  if (pct >= 10) return "#f59e0b";
  return "#ef4444";
}
function marginLabel(pct: number | null): string {
  if (pct == null) return "—";
  return pct.toFixed(1) + "%";
}

// ─── Tipo simples para lista de produtos ─────────────────────────────────────
type SimpleProduct = { id: string; name: string; price: number };

export default function StudioInsumos() {
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"insumos" | "fichas">("insumos");

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA INSUMOS — estado e lógica (ORIGINAL, sem alteração)
  // ═══════════════════════════════════════════════════════════════════════════
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<StudioInput[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StudioInput | null>(null);
  const [form, setForm] = useState<Partial<StudioInput>>({});

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const r = await studioApi.listInputs(company.id);
      setInputs(r.inputs || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar insumos");
    } finally { setLoading(false); }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  const lowStock = inputs.filter((i) => i.is_low_stock);

  function openNew() {
    setEditing(null);
    setForm({ name: "", unit: "un", unit_cost: 0, stock_qty: 0, stock_min: undefined });
    setShowForm(true);
  }

  function openEdit(i: StudioInput) {
    setEditing(i);
    setForm({
      name: i.name, unit: i.unit, unit_cost: i.unit_cost,
      stock_qty: i.stock_qty, stock_min: i.stock_min,
      supplier_name: i.supplier_name, supplier_phone: i.supplier_phone, notes: i.notes,
    });
    setShowForm(true);
  }

  async function save() {
    if (!company?.id) return;
    if (!form.name || !String(form.name).trim()) {
      toast.error("Nome do insumo é obrigatório");
      return;
    }
    try {
      if (editing) {
        await studioApi.updateInput(company.id, editing.id, form);
        toast.success("Insumo atualizado");
      } else {
        await studioApi.createInput(company.id, form);
        toast.success("✨ Insumo cadastrado!");
      }
      setShowForm(false); setEditing(null);
      load();
    } catch (e: any) { toast.error(e?.message || "Erro ao salvar"); }
  }

  async function remove(i: StudioInput) {
    if (!company?.id) return;
    try {
      await studioApi.deleteInput(company.id, i.id);
      toast.success("Insumo removido");
      load();
    } catch (e: any) { toast.error(e?.message || "Erro"); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA FICHAS TÉCNICAS — estado e lógica (NOVO — Fase D BOM)
  // ═══════════════════════════════════════════════════════════════════════════
  const [fichasLoading, setFichasLoading] = useState(false);
  const [compositions, setCompositions] = useState<CompositionSummary[]>([]);
  const [allProducts, setAllProducts] = useState<SimpleProduct[]>([]);
  const [fichasLoaded, setFichasLoaded] = useState(false);

  // Estado do editor de composição
  const [editorProductId, setEditorProductId] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorItems, setEditorItems] = useState<CompositionItem[]>([]);
  const [editorSummary, setEditorSummary] = useState<{
    total_cost: number; margin_pct: number | null; product_price: number; product_name: string;
  } | null>(null);
  const [editorNotes, setEditorNotes] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);

  // Produto que está sendo editado (metadados)
  const editorProduct = useMemo(
    () => allProducts.find((p) => p.id === editorProductId) || null,
    [allProducts, editorProductId]
  );

  // Busca de produto para nova ficha
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts.slice(0, 20);
    const q = productSearch.toLowerCase();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allProducts, productSearch]);

  // IDs de produtos que já têm ficha
  const existingProductIds = useMemo(
    () => new Set(compositions.map((c) => c.product_id)),
    [compositions]
  );

  const loadFichas = useCallback(async () => {
    if (!company?.id) return;
    setFichasLoading(true);
    try {
      const [compRes, prodRes] = await Promise.all([
        studioApi.listCompositionsSummary(company.id),
        companiesApi.products(company.id),
      ]);
      setCompositions(compRes.compositions || []);
      // Backend devolve produtos em prodRes.products ou array direto
      const raw: any[] = Array.isArray(prodRes) ? prodRes : (prodRes?.products || []);
      setAllProducts(raw.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price || 0) })));
      setFichasLoaded(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar fichas");
    } finally { setFichasLoading(false); }
  }, [company?.id]);

  // Carrega fichas apenas quando a aba é acessada pela 1ª vez
  useEffect(() => {
    if (activeTab === "fichas" && !fichasLoaded) {
      loadFichas();
    }
  }, [activeTab, fichasLoaded, loadFichas]);

  // Insumos já carregados pela aba insumos — reutiliza o estado `inputs`
  // mas pode ser necessário recarregar se a aba ficha foi acessada antes
  useEffect(() => {
    if (activeTab === "fichas" && inputs.length === 0 && !loading) {
      load();
    }
  }, [activeTab, inputs.length, loading, load]);

  async function openEditor(productId: string) {
    if (!company?.id) return;
    setEditorProductId(productId);
    setEditorLoading(true);
    setEditorItems([]);
    setEditorSummary(null);
    setEditorNotes("");
    try {
      const r = await studioApi.getComposition(company.id, productId);
      setEditorItems(r.items || []);
      setEditorSummary(r.summary);
      setEditorNotes(r.composition?.notes || "");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar composição");
    } finally { setEditorLoading(false); }
  }

  function closeEditor() {
    setEditorProductId(null);
    setEditorItems([]);
    setEditorSummary(null);
    setEditorNotes("");
  }

  // Custo total calculado localmente a partir dos items + inputs
  const localTotalCost = useMemo(() => {
    return editorItems.reduce((acc, item) => {
      const input = inputs.find((i) => i.id === item.input_id);
      const unitCost = input?.unit_cost ?? item.input_unit_cost ?? 0;
      return acc + Number(unitCost) * Number(item.qty_per_unit || 0);
    }, 0);
  }, [editorItems, inputs]);

  const localMarginPct = useMemo(() => {
    const price = editorSummary?.product_price ?? editorProduct?.price ?? 0;
    if (!price || price === 0) return null;
    return ((price - localTotalCost) / price) * 100;
  }, [localTotalCost, editorSummary, editorProduct]);

  function addItem() {
    setEditorItems((prev) => [
      ...prev,
      { input_id: "", qty_per_unit: 1 },
    ]);
  }

  function removeItem(idx: number) {
    setEditorItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<CompositionItem>) {
    setEditorItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  async function saveComposition() {
    if (!company?.id || !editorProductId) return;
    const validItems = editorItems.filter((it) => it.input_id && Number(it.qty_per_unit) > 0);
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um insumo com quantidade válida");
      return;
    }
    setEditorSaving(true);
    try {
      await studioApi.saveComposition(company.id, editorProductId, {
        notes: editorNotes || undefined,
        items: validItems.map((it, idx) => ({
          input_id: it.input_id,
          qty_per_unit: Number(it.qty_per_unit),
          notes: it.notes || undefined,
          sort_order: idx,
        })),
      });
      toast.success("Ficha técnica salva!");
      // Recarrega summary e fecha editor
      await loadFichas();
      closeEditor();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar ficha");
    } finally { setEditorSaving(false); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <StudioScreen variant="grid" scroll={false} padded={false}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <StudioPageHeader
        eyebrow="INSUMOS"
        title="Estoque do estúdio"
        subtitle="Controle o que você consome de verdade. Cada venda dá baixa nos insumos, não no produto-final."
        rightSlot={
          activeTab === "insumos" ? (
            <Pressable style={s.ctaPri} onPress={openNew}>
              <Icon name="plus" size={16} color="#fff" />
              <Text style={s.ctaPriTxt}>Novo insumo</Text>
            </Pressable>
          ) : editorProductId == null ? (
            <Pressable style={s.ctaPri} onPress={() => { setShowProductPicker(true); setProductSearch(""); }}>
              <Icon name="plus" size={16} color="#fff" />
              <Text style={s.ctaPriTxt}>Nova ficha</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, activeTab === "insumos" && s.tabBtnActive]}
          onPress={() => { setActiveTab("insumos"); setEditorProductId(null); }}
        >
          <Icon name="package" size={14} color={activeTab === "insumos" ? "#fff" : t.ink3} />
          <Text style={[s.tabBtnTxt, activeTab === "insumos" && s.tabBtnTxtActive]}>Insumos</Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, activeTab === "fichas" && s.tabBtnActive]}
          onPress={() => setActiveTab("fichas")}
        >
          <Icon name="clipboard-list" size={14} color={activeTab === "fichas" ? "#fff" : t.ink3} />
          <Text style={[s.tabBtnTxt, activeTab === "fichas" && s.tabBtnTxtActive]}>Fichas Técnicas</Text>
        </Pressable>
      </View>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ABA: INSUMOS                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "insumos" && (
        <>
          {/* Alertas críticos */}
          {lowStock.length > 0 && (
            <View style={s.alertCard}>
              <View style={s.alertHead}>
                <View style={s.alertIco}>
                  <Icon name="alert-circle" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <AnimatedKpiCounter
                      value={lowStock.length}
                      style={{ fontSize: 28, fontWeight: "800", color: t.danger }}
                    />
                    <Text style={s.alertSub}>insumos abaixo do mínimo</Text>
                  </View>
                  <Text style={s.alertSub}>Pedido de reposição recomendado pra evitar parar produção</Text>
                </View>
              </View>
              <View style={s.alertList}>
                {lowStock.map((i) => (
                  <View key={i.id} style={s.alertRow}>
                    <Text style={s.alertRowName}>{i.name}</Text>
                    <Text style={s.alertRowQty}>
                      <Text style={{ color: t.danger, fontWeight: "800" }}>
                        {i.stock_qty} {i.unit}
                      </Text>
                      <Text> de {i.stock_min} mín.</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Celebration: nada crítico */}
          {!loading && inputs.length > 0 && lowStock.length === 0 && (
            <StudioEmpty
              emoji="✅"
              title="Nada crítico no estoque"
              desc="Todos seus insumos estão acima do mínimo."
              tone="celebration"
              compact
            />
          )}

          {/* Form novo/editar insumo */}
          {showForm && (
            <View style={s.formCard}>
              <View style={s.formHead}>
                <Text style={s.formTitle}>{editing ? "Editar insumo" : "Novo insumo"}</Text>
                <Pressable onPress={() => { setShowForm(false); setEditing(null); }}>
                  <Icon name="x" size={18} color={t.ink3} />
                </Pressable>
              </View>
              <View style={s.formGrid}>
                <View style={{ flex: 2, minWidth: 200 }}>
                  <Text style={s.label}>Nome *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Ex: Caneca branca cerâmica"
                    value={form.name || ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 100 }}>
                  <Text style={s.label}>Unidade</Text>
                  <View style={s.unitRow}>
                    {UNITS.map((u) => (
                      <Pressable
                        key={u}
                        style={[s.unitChip, form.unit === u && s.unitChipSel]}
                        onPress={() => setForm((f) => ({ ...f, unit: u }))}
                      >
                        <Text style={[s.unitChipTxt, form.unit === u && s.unitChipTxtSel]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={s.formGrid}>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={s.label}>Custo unit. (R$)</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    value={String(form.unit_cost ?? "")}
                    onChangeText={(v) => setForm((f) => ({ ...f, unit_cost: parseFloat(v.replace(",", ".")) || 0 }))}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={s.label}>Estoque atual</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    value={String(form.stock_qty ?? "")}
                    onChangeText={(v) => setForm((f) => ({ ...f, stock_qty: parseFloat(v.replace(",", ".")) || 0 }))}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={s.label}>Mínimo (alerta)</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    placeholder="opcional"
                    value={form.stock_min != null ? String(form.stock_min) : ""}
                    onChangeText={(v) => {
                      const n = parseFloat(v.replace(",", "."));
                      setForm((f) => ({ ...f, stock_min: isNaN(n) ? undefined : n }));
                    }}
                  />
                </View>
              </View>

              <View style={s.formGrid}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={s.label}>Fornecedor (opcional)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Nome do fornecedor"
                    value={form.supplier_name || ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, supplier_name: v }))}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <Text style={s.label}>Telefone</Text>
                  <TextInput
                    style={s.input}
                    placeholder="(00) 00000-0000"
                    value={form.supplier_phone || ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, supplier_phone: v }))}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={s.formActions}>
                <Pressable style={s.btnSec} onPress={() => { setShowForm(false); setEditing(null); }}>
                  <Text style={s.btnSecTxt}>Cancelar</Text>
                </Pressable>
                <Pressable style={s.btnPri} onPress={save}>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={s.btnPriTxt}>{editing ? "Salvar alterações" : "Cadastrar"}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Loading */}
          {loading && <StudioLoading variant="skeleton-list" rows={5} />}

          {/* Lista vazia */}
          {!loading && inputs.length === 0 && (
            <StudioEmpty
              icon="package"
              title="Sem insumos cadastrados"
              desc="Cadastre o que você usa pra produzir (tinta, papel, tecido…). Depois vincule aos produtos via composição."
              primaryCta={{ label: "Cadastrar insumo", onPress: () => openNew() }}
            />
          )}

          {/* Lista */}
          {!loading && inputs.length > 0 && (
            <View style={s.list}>
              {inputs.map((i) => (
                <Pressable key={i.id} style={[s.itemRow, i.is_low_stock && s.itemRowLow]} onPress={() => openEdit(i)}>
                  <View style={[s.itemDot, i.is_low_stock && { backgroundColor: t.danger }]}>
                    <Icon name="package" size={14} color={i.is_low_stock ? "#fff" : t.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.itemNameRow}>
                      <Text style={s.itemName} numberOfLines={1}>{i.name}</Text>
                      {i.is_low_stock && (
                        <View style={s.lowBadge}>
                          <Text style={s.lowBadgeTxt}>CRÍTICO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.itemMeta}>
                      R$ {Number(i.unit_cost).toFixed(2)} / {i.unit}
                      {i.supplier_name && <Text style={{ color: t.ink3 }}> · {i.supplier_name}</Text>}
                    </Text>
                  </View>
                  <View style={s.itemQtyBlock}>
                    <Text style={[s.itemQty, i.is_low_stock && { color: t.danger }]}>
                      {Number(i.stock_qty).toFixed(0)} {i.unit}
                    </Text>
                    {i.stock_min != null && (
                      <Text style={s.itemMin}>min {Number(i.stock_min).toFixed(0)}</Text>
                    )}
                  </View>
                  <Pressable onPress={() => remove(i)} style={s.delBtn} hitSlop={10}>
                    <Icon name="trash" size={14} color={t.ink4} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ABA: FICHAS TÉCNICAS                                  */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "fichas" && (
        <>
          {/* Loading */}
          {fichasLoading && <StudioLoading variant="skeleton-list" rows={4} />}

          {/* ── Picker de produto (nova ficha) ── */}
          {!fichasLoading && showProductPicker && editorProductId == null && (
            <View style={s.pickerCard}>
              <View style={s.formHead}>
                <Text style={s.formTitle}>Selecionar produto</Text>
                <Pressable onPress={() => setShowProductPicker(false)}>
                  <Icon name="x" size={18} color={t.ink3} />
                </Pressable>
              </View>
              <TextInput
                style={[s.input, { marginBottom: 12 }]}
                placeholder="Buscar produto pelo nome…"
                value={productSearch}
                onChangeText={setProductSearch}
                autoFocus
              />
              {filteredProducts.length === 0 && (
                <Text style={s.emptyPickerTxt}>Nenhum produto encontrado.</Text>
              )}
              {filteredProducts.map((p) => {
                const hasComp = existingProductIds.has(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={s.pickerRow}
                    onPress={() => {
                      setShowProductPicker(false);
                      openEditor(p.id);
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.pickerName} numberOfLines={1}>{p.name}</Text>
                      <Text style={s.pickerPrice}>R$ {Number(p.price).toFixed(2)}</Text>
                    </View>
                    {hasComp && (
                      <View style={s.hasCompBadge}>
                        <Text style={s.hasCompTxt}>Ficha existente</Text>
                      </View>
                    )}
                    <Icon name="chevron-right" size={14} color={t.ink4} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Editor de composição ── */}
          {!fichasLoading && editorProductId != null && (
            <View style={s.editorCard}>
              {/* Header do editor */}
              <View style={s.editorHead}>
                <Pressable onPress={closeEditor} hitSlop={10}>
                  <Icon name="arrow-left" size={16} color={t.ink3} />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0, marginHorizontal: 12 }}>
                  <Text style={s.editorTitle} numberOfLines={1}>
                    {editorSummary?.product_name ?? editorProduct?.name ?? "Carregando…"}
                  </Text>
                  {(editorSummary?.product_price ?? editorProduct?.price) ? (
                    <Text style={s.editorSubtitle}>
                      Preço de venda: R$ {Number(editorSummary?.product_price ?? editorProduct?.price ?? 0).toFixed(2)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {editorLoading && <StudioLoading variant="skeleton-list" rows={3} />}

              {!editorLoading && (
                <>
                  {/* KPI bar: custo + margem */}
                  <View style={s.kpiBar}>
                    <View style={s.kpiItem}>
                      <Text style={s.kpiLabel}>CUSTO TOTAL</Text>
                      <Text style={s.kpiValue}>R$ {localTotalCost.toFixed(2)}</Text>
                    </View>
                    <View style={[s.kpiItem, s.kpiItemRight]}>
                      <Text style={s.kpiLabel}>MARGEM</Text>
                      <Text style={[s.kpiValue, { color: marginColor(localMarginPct) }]}>
                        {marginLabel(localMarginPct)}
                      </Text>
                      <View style={[s.marginDot, { backgroundColor: marginColor(localMarginPct) }]} />
                    </View>
                  </View>

                  {/* Tabela de itens */}
                  {editorItems.length > 0 && (
                    <View style={s.itemsTable}>
                      {/* Cabeçalho */}
                      <View style={s.tableHeader}>
                        <Text style={[s.tableHeaderTxt, { flex: 2 }]}>Insumo</Text>
                        <Text style={[s.tableHeaderTxt, { flex: 1, textAlign: "right" }]}>Qtd/un</Text>
                        <Text style={[s.tableHeaderTxt, { flex: 1, textAlign: "right" }]}>Custo/un</Text>
                        <Text style={[s.tableHeaderTxt, { flex: 1, textAlign: "right" }]}>Subtotal</Text>
                        <View style={{ width: 30 }} />
                      </View>

                      {editorItems.map((item, idx) => {
                        const input = inputs.find((i) => i.id === item.input_id);
                        const unitCost = input?.unit_cost ?? item.input_unit_cost ?? 0;
                        const subtotal = Number(unitCost) * Number(item.qty_per_unit || 0);
                        return (
                          <View key={idx} style={s.tableRow}>
                            {/* Select de insumo */}
                            <View style={{ flex: 2, minWidth: 120 }}>
                              <View style={s.insumoSelect}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
                                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                                    {inputs.map((inp) => (
                                      <Pressable
                                        key={inp.id}
                                        style={[s.insumoChip, item.input_id === inp.id && s.insumoChipSel]}
                                        onPress={() => updateItem(idx, { input_id: inp.id })}
                                      >
                                        <Text style={[s.insumoChipTxt, item.input_id === inp.id && s.insumoChipTxtSel]} numberOfLines={1}>
                                          {inp.name}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                </ScrollView>
                                {input && (
                                  <Text style={s.insumoSelected} numberOfLines={1}>{input.name}</Text>
                                )}
                              </View>
                            </View>

                            {/* Qtd */}
                            <TextInput
                              style={[s.input, { flex: 1, textAlign: "right", minWidth: 60 }]}
                              keyboardType="decimal-pad"
                              value={String(item.qty_per_unit ?? "")}
                              onChangeText={(v) =>
                                updateItem(idx, { qty_per_unit: parseFloat(v.replace(",", ".")) || 0 })
                              }
                            />

                            {/* Custo/un (calculado) */}
                            <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>
                              {input ? `R$ ${Number(input.unit_cost).toFixed(2)}` : "—"}
                            </Text>

                            {/* Subtotal */}
                            <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontWeight: "700" }]}>
                              R$ {subtotal.toFixed(2)}
                            </Text>

                            {/* Remover */}
                            <Pressable style={s.delBtn} onPress={() => removeItem(idx)} hitSlop={10}>
                              <Icon name="x" size={13} color={t.ink4} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {editorItems.length === 0 && (
                    <StudioEmpty
                      icon="clipboard-list"
                      title="Nenhum insumo nesta ficha"
                      desc="Adicione os insumos que compõem este produto para calcular o custo e a margem."
                      compact
                    />
                  )}

                  {/* Botão adicionar insumo */}
                  <Pressable style={s.addItemBtn} onPress={addItem}>
                    <Icon name="plus" size={14} color={t.primary} />
                    <Text style={s.addItemTxt}>Adicionar insumo</Text>
                  </Pressable>

                  {/* Observações */}
                  <Text style={[s.label, { marginTop: 14 }]}>Observações (opcional)</Text>
                  <TextInput
                    style={[s.input, { minHeight: 60 }]}
                    placeholder="Ex: Rendimento por peça, condições especiais…"
                    value={editorNotes}
                    onChangeText={setEditorNotes}
                    multiline
                  />

                  {/* Footer com CTA */}
                  <View style={s.editorFooter}>
                    <View style={s.footerCosts}>
                      <Text style={s.footerCostLine}>
                        Custo total:{" "}
                        <Text style={{ fontWeight: "800", color: t.ink }}>R$ {localTotalCost.toFixed(2)}</Text>
                      </Text>
                      <Text style={[s.footerCostLine, { color: marginColor(localMarginPct) }]}>
                        Margem sobre preço:{" "}
                        <Text style={{ fontWeight: "800" }}>{marginLabel(localMarginPct)}</Text>
                        {localMarginPct != null && localMarginPct >= 30 && " ✓"}
                        {localMarginPct != null && localMarginPct >= 10 && localMarginPct < 30 && " ⚠"}
                        {localMarginPct != null && localMarginPct < 10 && " ✗"}
                      </Text>
                    </View>
                    <Pressable
                      style={[s.btnPri, editorSaving && { opacity: 0.6 }]}
                      onPress={saveComposition}
                      disabled={editorSaving}
                    >
                      <Icon name={editorSaving ? "loader" : "save"} size={14} color="#fff" />
                      <Text style={s.btnPriTxt}>{editorSaving ? "Salvando…" : "Salvar ficha"}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Lista de fichas existentes ── */}
          {!fichasLoading && editorProductId == null && !showProductPicker && (
            <>
              {compositions.length === 0 && (
                <StudioEmpty
                  icon="clipboard-list"
                  title="Nenhuma ficha técnica"
                  desc="Crie fichas técnicas para vincular insumos aos produtos e calcular o custo + margem de cada peça."
                  primaryCta={{
                    label: "Nova ficha técnica",
                    onPress: () => { setShowProductPicker(true); setProductSearch(""); },
                  }}
                />
              )}

              {compositions.length > 0 && (
                <>
                  {/* Cabeçalho da lista */}
                  <View style={s.listHeader}>
                    <Text style={[s.listHeaderTxt, { flex: 2 }]}>Produto</Text>
                    <Text style={[s.listHeaderTxt, { flex: 1, textAlign: "right" }]}>Custo</Text>
                    <Text style={[s.listHeaderTxt, { flex: 1, textAlign: "right" }]}>Margem</Text>
                    <Text style={[s.listHeaderTxt, { width: 60, textAlign: "right" }]}>Insumos</Text>
                    <View style={{ width: 28 }} />
                  </View>

                  <View style={s.list}>
                    {compositions.map((c) => (
                      <Pressable
                        key={c.composition_id}
                        style={s.fichaRow}
                        onPress={() => openEditor(c.product_id)}
                      >
                        <View style={[s.itemDot, { backgroundColor: t.primarySoft }]}>
                          <Icon name="clipboard-list" size={14} color={t.primary} />
                        </View>
                        <View style={{ flex: 2, minWidth: 0 }}>
                          <Text style={s.itemName} numberOfLines={1}>{c.product_name}</Text>
                          <Text style={s.itemMeta}>
                            Venda: R$ {Number(c.product_price).toFixed(2)}
                          </Text>
                        </View>
                        <Text style={[s.fichaCell, { flex: 1, textAlign: "right" }]}>
                          R$ {Number(c.total_cost).toFixed(2)}
                        </Text>
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                          <Text style={[s.fichaCell, { color: marginColor(c.margin_pct), fontWeight: "800" }]}>
                            {marginLabel(c.margin_pct)}
                          </Text>
                          <View style={[s.marginDot, { backgroundColor: marginColor(c.margin_pct), marginTop: 3 }]} />
                        </View>
                        <Text style={[s.fichaCell, { width: 60, textAlign: "right", color: t.ink3 }]}>
                          {c.item_count}
                        </Text>
                        <Icon name="chevron-right" size={14} color={t.ink4} />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </>
      )}
      </ScrollView>
    </StudioScreen>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.bg },
  container: { padding: 28, paddingBottom: 60, maxWidth: 1000, alignSelf: "center", width: "100%" },

  // ─── Tab switcher ────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row", gap: 8, marginBottom: 20,
    borderBottomWidth: 1, borderBottomColor: t.ink5, paddingBottom: 12,
  },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5,
  },
  tabBtnActive: { backgroundColor: t.primary, borderColor: t.primary },
  tabBtnTxt: { fontSize: 13, fontWeight: "700", color: t.ink3 },
  tabBtnTxtActive: { color: "#fff" },

  // ─── Buttons ─────────────────────────────────────────────────────────────
  ctaPri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  btnPri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 10 },
  btnPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  btnSec: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: "#fff" },
  btnSecTxt: { color: t.ink2, fontWeight: "600", fontSize: 13 },

  // ─── Alert card ──────────────────────────────────────────────────────────
  alertCard: {
    backgroundColor: t.dangerSoft, borderWidth: 1, borderColor: t.danger,
    borderRadius: 18, padding: 18, marginBottom: 18,
  },
  alertHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  alertIco: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.danger, alignItems: "center", justifyContent: "center" },
  alertSub: { fontSize: 12, color: t.danger, marginTop: 2 },
  alertList: { gap: 8 },
  alertRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10 },
  alertRowName: { fontSize: 13, fontWeight: "700", color: t.ink },
  alertRowQty: { fontSize: 12.5, color: t.ink2 },

  // ─── Form card ───────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: t.paperCardElev, borderRadius: 18, padding: 22, marginBottom: 18,
    borderWidth: 1, borderColor: t.primarySoft,
  },
  formHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  formTitle: { fontSize: 17, fontWeight: "800", color: t.ink },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  label: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: t.ink },
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  unitChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5 },
  unitChipSel: { backgroundColor: t.primary, borderColor: t.primary },
  unitChipTxt: { fontSize: 11.5, fontWeight: "700", color: t.ink3 },
  unitChipTxtSel: { color: "#fff" },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 },

  // ─── Lista insumos ────────────────────────────────────────────────────────
  list: { gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5 },
  itemRowLow: { borderColor: t.danger, backgroundColor: t.dangerSoft },
  itemDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { fontSize: 14, fontWeight: "700", color: t.ink, flexShrink: 1 },
  lowBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: t.danger },
  lowBadgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  itemMeta: { fontSize: 12, color: t.ink3, marginTop: 2 },
  itemQtyBlock: { alignItems: "flex-end" },
  itemQty: { fontSize: 14, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
  itemMin: { fontSize: 11, color: t.ink4, marginTop: 1 },
  delBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },

  // ─── Fichas: picker de produto ───────────────────────────────────────────
  pickerCard: {
    backgroundColor: t.paperCardElev, borderRadius: 18, padding: 22, marginBottom: 18,
    borderWidth: 1, borderColor: t.primarySoft,
  },
  pickerRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: t.ink5,
  },
  pickerName: { fontSize: 14, fontWeight: "700", color: t.ink },
  pickerPrice: { fontSize: 12, color: t.ink3, marginTop: 2 },
  hasCompBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: t.primaryGhost },
  hasCompTxt: { fontSize: 10, fontWeight: "700", color: t.primary },
  emptyPickerTxt: { fontSize: 13, color: t.ink3, textAlign: "center", paddingVertical: 20 },

  // ─── Fichas: editor ──────────────────────────────────────────────────────
  editorCard: {
    backgroundColor: t.paperCardElev, borderRadius: 18, padding: 22, marginBottom: 18,
    borderWidth: 1, borderColor: t.primarySoft,
  },
  editorHead: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  editorTitle: { fontSize: 17, fontWeight: "800", color: t.ink },
  editorSubtitle: { fontSize: 12, color: t.ink3, marginTop: 2 },

  kpiBar: {
    flexDirection: "row", backgroundColor: t.bgSoft, borderRadius: 14,
    padding: 16, marginBottom: 18, gap: 0,
  },
  kpiItem: { flex: 1 },
  kpiItemRight: { alignItems: "flex-end", borderLeftWidth: 1, borderLeftColor: t.ink5 },
  kpiLabel: { fontSize: 10, fontWeight: "700", color: t.ink4, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.5 },
  marginDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },

  itemsTable: { marginBottom: 10 },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.ink5, marginBottom: 4 },
  tableHeaderTxt: { fontSize: 10, fontWeight: "700", color: t.ink4, textTransform: "uppercase", letterSpacing: 0.4 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.ink6 ?? t.ink5 },
  tableCell: { fontSize: 13, color: t.ink2 },

  insumoSelect: { gap: 4 },
  insumoChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5 },
  insumoChipSel: { backgroundColor: t.primary, borderColor: t.primary },
  insumoChipTxt: { fontSize: 11, fontWeight: "600", color: t.ink3 },
  insumoChipTxtSel: { color: "#fff" },
  insumoSelected: { fontSize: 12, fontWeight: "700", color: t.primary, marginTop: 2 },

  addItemBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: t.primary,
    alignSelf: "flex-start", marginTop: 8,
  },
  addItemTxt: { fontSize: 13, fontWeight: "700", color: t.primary },

  editorFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.ink5,
    flexWrap: "wrap", gap: 12,
  },
  footerCosts: { gap: 4 },
  footerCostLine: { fontSize: 13, color: t.ink2 },

  // ─── Fichas: lista resumo ────────────────────────────────────────────────
  listHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.ink5, marginBottom: 4 },
  listHeaderTxt: { fontSize: 10, fontWeight: "700", color: t.ink4, textTransform: "uppercase", letterSpacing: 0.4 },
  fichaRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5,
  },
  fichaCell: { fontSize: 13, color: t.ink2 },
});
