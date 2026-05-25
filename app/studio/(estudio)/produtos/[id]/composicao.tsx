// ============================================================
// AURA STUDIO · Composition Editor (pendência F3 + UX overhaul)
//
// Liga 1 produto a N insumos (com qty_per_unit).
// Mostra summary de custo + margem com semáforo (verde/amarelo/vermelho).
//
// 25/05 — item #11: edição inline de preço pra what-if margem
// (preview local; persistir requer endpoint products PATCH).
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioTokens, StudioRadiusV2 } from "@/constants/studio-tokens-v2";
import { studioApi, type StudioInput, type CompositionItem } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { GlassCard, BubbleIcon, GradientHeader } from "@/components/studio/StudioPrimitives";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";

function marginTone(pct: number | null): { label: string; color: string; bg: string } {
  if (pct == null)    return { label: "—",     color: StudioTokens.ink3, bg: StudioTokens.bgSoft };
  if (pct >= 50)      return { label: "Excelente", color: StudioTokens.success, bg: StudioTokens.successSoft };
  if (pct >= 30)      return { label: "Boa",       color: StudioTokens.warning, bg: StudioTokens.warningSoft };
  if (pct >= 10)      return { label: "Apertada",  color: "#F97316",        bg: "#FFEDD5" };
  return                     { label: "Crítica",   color: StudioTokens.danger,  bg: StudioTokens.dangerSoft };
}

export default function ComposicaoEditor() {
  const router = useRouter();
  const { id: productId } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState(0);
  // #11: preço editável inline — mantém o original pra mostrar "preço atual"
  const [originalPrice, setOriginalPrice] = useState(0);
  const [priceDraft, setPriceDraft] = useState("");
  const [editingPrice, setEditingPrice] = useState(false);

  const [allInputs, setAllInputs] = useState<StudioInput[]>([]);
  const [items, setItems] = useState<CompositionItem[]>([]);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!company?.id || !productId) return;
    setLoading(true);
    try {
      const [inputsRes, compRes] = await Promise.all([
        studioApi.listInputs(company.id),
        studioApi.getComposition(company.id, String(productId)),
      ]);
      setAllInputs(inputsRes.inputs || []);
      setItems(compRes.items || []);
      setNotes(compRes.composition?.notes || "");
      if (compRes.summary) {
        setProductName(compRes.summary.product_name || "");
        setProductPrice(compRes.summary.product_price || 0);
        setOriginalPrice(compRes.summary.product_price || 0);
        setPriceDraft(String(compRes.summary.product_price || 0));
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar composição");
    } finally { setLoading(false); }
  }, [company?.id, productId]);

  useEffect(() => { load(); }, [load]);

  const totalCost = useMemo(() => {
    return items.reduce((sum, it) => {
      const inp = allInputs.find((i) => i.id === it.input_id);
      return sum + (inp ? Number(inp.unit_cost) * Number(it.qty_per_unit) : 0);
    }, 0);
  }, [items, allInputs]);

  const marginPct = productPrice > 0 ? ((productPrice - totalCost) / productPrice) * 100 : null;
  const tone = marginTone(marginPct);
  const priceChanged = Math.abs(productPrice - originalPrice) > 0.001;

  function commitPriceDraft() {
    const v = parseFloat(priceDraft.replace(",", "."));
    if (!isNaN(v) && v > 0) {
      setProductPrice(v);
    } else {
      setPriceDraft(String(productPrice));
    }
    setEditingPrice(false);
  }

  function resetPrice() {
    setProductPrice(originalPrice);
    setPriceDraft(String(originalPrice));
  }

  function addInput(inp: StudioInput) {
    if (items.some((i) => i.input_id === inp.id)) {
      toast.error("Esse insumo já está na composição");
      return;
    }
    setItems((prev) => [...prev, {
      input_id: inp.id, input_name: inp.name, input_unit: inp.unit,
      input_unit_cost: inp.unit_cost, qty_per_unit: 1,
    }]);
  }

  function updateQty(idx: number, raw: string) {
    const qty = parseFloat(raw.replace(",", "."));
    if (isNaN(qty) || qty <= 0) return;
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, qty_per_unit: qty } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!company?.id || !productId) return;
    setSaving(true);
    try {
      await studioApi.saveComposition(company.id, String(productId), {
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          input_id: it.input_id,
          qty_per_unit: it.qty_per_unit,
          notes: it.notes || null,
        })),
      });
      if (priceChanged) {
        toast.success("Composição salva! Atualize o preço do produto na tela de Produtos pra persistir a mudança.");
      } else {
        toast.success("✨ Composição salva!");
      }
      router.back();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  const availableInputs = allInputs.filter((inp) => !items.some((it) => it.input_id === inp.id));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: StudioTokens.bg }} contentContainerStyle={{ padding: 28, maxWidth: 920, alignSelf: "center", width: "100%" }}>
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Produtos", href: "/studio/produtos" },
          { label: productName || "Composição" },
        ]}
        sticky={false}
      />

      <GradientHeader
        eyebrow="FASE 3 · COMPOSIÇÃO"
        title={productName ? `Composição de "${productName}"` : "Composição"}
        sub="Liste os insumos consumidos a cada unidade produzida. Custo e margem são calculados automaticamente."
        rightSlot={
          <Pressable style={s.cta} onPress={save} disabled={saving || items.length === 0}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Icon name="check" size={14} color="#fff" />
                <Text style={s.ctaTxt}>Salvar</Text>
              </>
            )}
          </Pressable>
        }
      />

      {loading ? (
        <View style={{ paddingVertical: 40 }}><ActivityIndicator size="large" color={StudioTokens.primary} /></View>
      ) : (
        <>
          {/* Summary com preço editável (#11) */}
          <GlassCard tone="neutral" pad="lg" style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
              {/* Preço — inline edit */}
              <View style={{ flex: 1, minWidth: 150 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: StudioTokens.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Preço de venda
                  </Text>
                  <Pressable onPress={() => setEditingPrice((v) => !v)}>
                    <Icon name={editingPrice ? "check" : "edit-3"} size={12} color={StudioTokens.primary} />
                  </Pressable>
                </View>
                {editingPrice ? (
                  <TextInput
                    style={s.priceInput}
                    value={priceDraft}
                    onChangeText={setPriceDraft}
                    onBlur={commitPriceDraft}
                    onSubmitEditing={commitPriceDraft}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                ) : (
                  <Pressable onPress={() => setEditingPrice(true)}>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: StudioTokens.ink, letterSpacing: -0.3, marginTop: 4 }}>
                      R$ {productPrice.toFixed(2)}
                    </Text>
                  </Pressable>
                )}
                {priceChanged && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: StudioTokens.warning, fontWeight: "700" }}>
                      preview · original R$ {originalPrice.toFixed(2)}
                    </Text>
                    <Pressable onPress={resetPrice}>
                      <Icon name="rotate-ccw" size={10} color={StudioTokens.warning} />
                    </Pressable>
                  </View>
                )}
              </View>
              <Summary label="Custo total"     value={`R$ ${totalCost.toFixed(2)}`}  color={StudioTokens.danger} />
              <Summary label="Lucro"           value={`R$ ${(productPrice - totalCost).toFixed(2)}`} color={StudioTokens.success} />
              <Summary
                label="Margem"
                value={marginPct != null ? `${marginPct.toFixed(1)}%` : "—"}
                color={tone.color}
                badge={tone.label}
                badgeBg={tone.bg}
              />
            </View>
          </GlassCard>

          {/* Items */}
          <Text style={s.sectionLabel}>INSUMOS USADOS POR UNIDADE</Text>
          {items.length === 0 ? (
            <View style={s.empty}>
              <Icon name="package" size={28} color={StudioTokens.ink4} />
              <Text style={s.emptyTxt}>Nenhum insumo vinculado ainda</Text>
              <Text style={s.emptySub}>Adicione abaixo os insumos consumidos a cada produto vendido.</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginBottom: 18 }}>
              {items.map((it, idx) => {
                const lineCost = (it.input_unit_cost || 0) * (it.qty_per_unit || 0);
                return (
                  <View key={it.input_id} style={s.row}>
                    <BubbleIcon ico="package" tone="navy" size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowName}>{it.input_name}</Text>
                      <Text style={s.rowMeta}>R$ {Number(it.input_unit_cost).toFixed(4)} / {it.input_unit}</Text>
                    </View>
                    <View style={s.qtyBox}>
                      <Text style={s.qtyLabel}>qty</Text>
                      <TextInput
                        style={s.qtyInput}
                        value={String(it.qty_per_unit)}
                        onChangeText={(v) => updateQty(idx, v)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.lineCost}>R$ {lineCost.toFixed(2)}</Text>
                      <Text style={s.lineCostLabel}>por unid.</Text>
                    </View>
                    <Pressable onPress={() => removeItem(idx)} style={s.del}>
                      <Icon name="trash" size={14} color={StudioTokens.danger} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Add insumo */}
          {availableInputs.length > 0 && (
            <>
              <Text style={s.sectionLabel}>ADICIONAR INSUMO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 14 }}>
                {availableInputs.map((inp) => (
                  <Pressable key={inp.id} style={s.addChip} onPress={() => addInput(inp)}>
                    <Icon name="plus" size={12} color={StudioTokens.primary} />
                    <Text style={s.addChipTxt}>{inp.name}</Text>
                    <Text style={s.addChipPrice}>R$ {Number(inp.unit_cost).toFixed(2)}/{inp.unit}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {availableInputs.length === 0 && allInputs.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Sem insumos cadastrados ainda</Text>
              <Text style={s.emptySub}>Cadastre os insumos primeiro em Estúdio › Insumos.</Text>
              <Pressable style={s.cta} onPress={() => router.push("/studio/insumos" as any)}>
                <Icon name="plus" size={14} color="#fff" />
                <Text style={s.ctaTxt}>Cadastrar insumos</Text>
              </Pressable>
            </View>
          )}

          {/* Notes */}
          <Text style={[s.sectionLabel, { marginTop: 18 }]}>OBSERVAÇÕES (opcional)</Text>
          <TextInput
            style={s.notesInput}
            placeholder="Anotações sobre processo, variações por cor, etc..."
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </>
      )}
    </ScrollView>
  );
}

function Summary({ label, value, color, badge, badgeBg }: { label: string; value: string; color?: string; badge?: string; badgeBg?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 130 }}>
      <Text style={{ fontSize: 11, color: StudioTokens.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: color || StudioTokens.ink, letterSpacing: -0.3 }}>
          {value}
        </Text>
      </View>
      {badge && (
        <View style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: badgeBg }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color, letterSpacing: 0.4 }}>{badge.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cta: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: StudioTokens.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  sectionLabel: { fontSize: 11, color: StudioTokens.ink3, fontWeight: "800", letterSpacing: 0.6, marginBottom: 10 },
  empty: { alignItems: "center", padding: 30, gap: 8, backgroundColor: StudioTokens.paperCard, borderRadius: StudioRadiusV2.xl, borderWidth: 1, borderColor: StudioTokens.borderSoft, marginBottom: 18 },
  emptyTxt: { fontSize: 14, fontWeight: "700", color: StudioTokens.ink, marginTop: 6 },
  emptySub: { fontSize: 12, color: StudioTokens.ink3, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: StudioTokens.paperCard, borderRadius: StudioRadiusV2.lg, borderWidth: 1, borderColor: StudioTokens.borderSoft },
  rowName: { fontSize: 13.5, fontWeight: "700", color: StudioTokens.ink },
  rowMeta: { fontSize: 11.5, color: StudioTokens.ink3, marginTop: 2 },
  qtyBox: { alignItems: "center" },
  qtyLabel: { fontSize: 10, color: StudioTokens.ink3, fontWeight: "700" },
  qtyInput: { width: 56, padding: 6, fontSize: 13, fontWeight: "700", textAlign: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: StudioTokens.borderSoft, borderRadius: 8, color: StudioTokens.ink },
  lineCost: { fontSize: 13, fontWeight: "800", color: StudioTokens.ink },
  lineCostLabel: { fontSize: 10, color: StudioTokens.ink3 },
  del: { width: 28, height: 28, borderRadius: 14, backgroundColor: StudioTokens.dangerSoft, alignItems: "center", justifyContent: "center" },
  addChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioTokens.borderSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addChipTxt: { fontSize: 12.5, fontWeight: "700", color: StudioTokens.ink },
  addChipPrice: { fontSize: 10.5, color: StudioTokens.ink3, fontWeight: "600" },
  notesInput: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioTokens.borderSoft, borderRadius: StudioRadiusV2.md, padding: 12, fontSize: 13, color: StudioTokens.ink, minHeight: 80 },

  priceInput: {
    fontSize: 18, fontWeight: "800", color: StudioTokens.ink,
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: StudioTokens.primary,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 4, width: 120,
  },
});
