// ============================================================
// AURA STUDIO · Insumos / Matéria-prima + Fichas Técnicas
//
// Duas abas:
//   "Insumos"         — CRUD funcional de matérias-primas
//   "Fichas Técnicas" — Lista SOMENTE-LEITURA: produto + custo + margem.
//                       Tocar numa linha navega para /studio/estoque
//                       com ?action=edit-product&id=<pid>, onde o editor
//                       canônico (StudioFichaTecnicaPanel) vive.
//                       Nenhum caminho de escrita de ficha existe aqui.
//
// Deep-link: ?action=novo-insumo → abre NovoInsumoModal automaticamente
// no mount (param consumido via router.replace para não reabrir em
// re-renders).
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { type StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type StudioInput, type CompositionSummary } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";
import NovoInsumoModal from "@/components/studio/NovoInsumoModal";

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

export default function StudioInsumos() {
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"insumos" | "fichas">("insumos");

  // ── Deep-link: ?action=novo-insumo abre modal no mount ────────────────────
  const params = useLocalSearchParams<{ action?: string }>();
  const [novoInsumoOpen, setNovoInsumoOpen] = useState(false);

  useEffect(() => {
    if (params.action === "novo-insumo") {
      setNovoInsumoOpen(true);
      // Consome o param para não reabrir em re-renders
      router.replace("/studio/insumos" as any);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // ABA FICHAS TÉCNICAS — lista somente-leitura
  // Toque navega para o editor canônico em /studio/estoque
  // ═══════════════════════════════════════════════════════════════════════════
  const [fichasLoading, setFichasLoading] = useState(false);
  const [compositions, setCompositions] = useState<CompositionSummary[]>([]);
  const [fichasLoaded, setFichasLoaded] = useState(false);

  const loadFichas = useCallback(async () => {
    if (!company?.id) return;
    setFichasLoading(true);
    try {
      const compRes = await studioApi.listCompositionsSummary(company.id);
      setCompositions(compRes.compositions || []);
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

  // Navega para o editor canônico de produto em Catálogo
  function navigateToProductEditor(productId: string) {
    router.push(`/studio/estoque?action=edit-product&id=${productId}` as any);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <StudioScreen variant="board" scroll={false} padded={false}>
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
          ) : null
        }
      />

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, activeTab === "insumos" && s.tabBtnActive]}
          onPress={() => setActiveTab("insumos")}
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
      {/* ABA: FICHAS TÉCNICAS — somente-leitura                */}
      {/* Toque → navega pro editor canônico em Catálogo        */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "fichas" && (
        <>
          {/* Callout explicativo */}
          <View style={s.fichasHint}>
            <Icon name="info" size={14} color={t.infoInk ?? t.ink3} />
            <Text style={[s.fichasHintText, { color: t.infoInk ?? t.ink3 }]}>
              Toque numa ficha para editar no Catálogo. O editor canônico fica na tela de produto.
            </Text>
          </View>

          {/* Loading */}
          {fichasLoading && <StudioLoading variant="skeleton-list" rows={4} />}

          {/* Lista vazia */}
          {!fichasLoading && compositions.length === 0 && (
            <StudioEmpty
              icon="clipboard-list"
              title="Nenhuma ficha técnica"
              desc="Crie fichas técnicas pelo Catálogo — abra um produto e expanda a seção Ficha Técnica."
              primaryCta={{
                label: "Ir para o Catálogo",
                onPress: () => router.push("/studio/estoque" as any),
              }}
            />
          )}

          {/* Lista de fichas — somente-leitura */}
          {!fichasLoading && compositions.length > 0 && (
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
                    onPress={() => navigateToProductEditor(c.product_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ficha de ${c.product_name} no Catálogo`}
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
      </ScrollView>

      {/* Modal novo insumo (acessível via aba Insumos + deep-link) */}
      <NovoInsumoModal
        visible={novoInsumoOpen}
        companyId={company?.id || ""}
        onClose={() => setNovoInsumoOpen(false)}
        onCreated={(insumo) => {
          setInputs((prev) => [insumo as unknown as StudioInput, ...prev]);
          setNovoInsumoOpen(false);
        }}
      />
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

  // ─── Fichas: hint somente-leitura ────────────────────────────────────────
  fichasHint: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10,
    backgroundColor: t.infoSoft ?? t.bgSoft,
    marginBottom: 16,
  },
  fichasHintText: { fontSize: 12, fontWeight: "500", flex: 1, lineHeight: 17 },

  // ─── Fichas: lista resumo ────────────────────────────────────────────────
  listHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.ink5, marginBottom: 4 },
  listHeaderTxt: { fontSize: 10, fontWeight: "700", color: t.ink4, textTransform: "uppercase", letterSpacing: 0.4 },
  fichaRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5,
  },
  fichaCell: { fontSize: 13, color: t.ink2 },
  marginDot: { width: 8, height: 8, borderRadius: 4 },
});
