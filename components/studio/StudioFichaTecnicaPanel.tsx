import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { toast } from "@/components/Toast";
import { studioApi } from "@/services/studioApi";
import StudioLoading from "@/components/studio/StudioLoading";
import StudioEmpty from "@/components/studio/StudioEmpty";

type CompositionItem = {
  id?: string;
  input_id: string;
  input_name?: string;
  input_unit?: string;
  input_unit_cost?: number;
  qty_per_unit: number;
  notes?: string | null;
  sort_order?: number;
};

type StudioInput = {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  stock_qty: number;
  stock_min: number | null;
  is_active: boolean;
  is_low_stock?: boolean;
};

type Summary = {
  total_cost: number;
  margin_pct: number | null;
  item_count: number;
};

type Props = {
  productId: string;
  companyId: string;
  productName: string;
  productPrice: number;
  onSaved?: (summary: Summary) => void;
};

function getMarginTone(margin: number | null, t: any) {
  if (margin == null) return { fg: t.ink3, bg: t.bgSoft };
  if (margin >= 30) return { fg: t.successInk, bg: t.successSoft };
  if (margin >= 10) return { fg: t.warningInk, bg: t.warningSoft };
  return { fg: t.dangerInk, bg: t.dangerSoft };
}

function formatBRL(value: number): string {
  try {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "R$ " + value.toFixed(2);
  }
}

export default function StudioFichaTecnicaPanel({
  productId,
  companyId,
  productName,
  productPrice,
  onSaved,
}: Props) {
  const t = useStudioTokens();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CompositionItem[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [inputs, setInputs] = useState<StudioInput[]>([]);
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, inputsRes] = await Promise.all([
        studioApi.getComposition(companyId, productId),
        studioApi.listInputs(companyId),
      ]);
      const loadedItems: CompositionItem[] = Array.isArray(compRes?.items)
        ? compRes.items
        : [];
      setItems(loadedItems);
      setNotes(compRes?.composition?.notes || "");
      setInputs(Array.isArray(inputsRes?.inputs) ? inputsRes.inputs : []);
    } catch (e: any) {
      const status = e?.status;
      const code = e?.code;
      const message = e?.message;
      const data = e?.data || {};
      console.error("[StudioFichaTecnicaPanel.load]", {
        status,
        code,
        message,
        data,
      });
      toast.error("[" + (status || "?") + "] " + (data.error || message || "Erro ao carregar ficha técnica"));
    } finally {
      setLoading(false);
    }
  }, [companyId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCost = useMemo(
    () =>
      items.reduce(
        (s, it) => s + (Number(it.qty_per_unit) || 0) * (Number(it.input_unit_cost) || 0),
        0
      ),
    [items]
  );

  const marginPct = useMemo(() => {
    if (!productPrice || productPrice <= 0) return null;
    return ((productPrice - totalCost) / productPrice) * 100;
  }, [productPrice, totalCost]);

  const marginValue = useMemo(
    () => (productPrice ? productPrice - totalCost : 0),
    [productPrice, totalCost]
  );

  const marginTone = useMemo(() => getMarginTone(marginPct, t), [marginPct, t]);

  const addRow = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        input_id: "",
        qty_per_unit: 0,
        sort_order: prev.length,
      },
    ]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateQty = useCallback((idx: number, raw: string) => {
    const normalized = raw.replace(",", ".");
    const qty = parseFloat(normalized);
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty_per_unit: isNaN(qty) ? 0 : qty } : it))
    );
  }, []);

  const pickInput = useCallback(
    (idx: number, input: StudioInput) => {
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                input_id: input.id,
                input_name: input.name,
                input_unit: input.unit,
                input_unit_cost: input.unit_cost,
              }
            : it
        )
      );
      setOpenPickerIdx(null);
      setPickerQuery("");
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payloadItems = items
        .filter((i) => i.input_id && Number(i.qty_per_unit) > 0)
        .map((i, idx) => ({
          input_id: i.input_id,
          qty_per_unit: Number(i.qty_per_unit),
          notes: i.notes || null,
          sort_order: idx,
        }));
      const res = await studioApi.saveComposition(companyId, productId, {
        notes,
        items: payloadItems,
      });
      toast.success("Ficha técnica salva");
      if (res?.summary && onSaved) {
        onSaved(res.summary);
      }
      await load();
    } catch (e: any) {
      const status = e?.status;
      const code = e?.code;
      const message = e?.message;
      const data = e?.data || {};
      console.error("[StudioFichaTecnicaPanel.save]", {
        status,
        code,
        message,
        data,
      });
      toast.error("[" + (status || "?") + "] " + (data.error || message || "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  }, [companyId, productId, items, notes, onSaved, load]);

  const filteredInputs = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = inputs.filter((i) => i.is_active !== false);
    if (!q) return list;
    return list.filter((i) => (i.name || "").toLowerCase().includes(q));
  }, [inputs, pickerQuery]);

  if (loading) {
    return (
      <View style={styles.container}>
        <StudioLoading variant="skeleton-list" rows={3} />
      </View>
    );
  }

  if (items.length === 0 && inputs.length === 0) {
    return (
      <View style={styles.container}>
        <StudioEmpty
          icon="package"
          title="Cadastre insumos primeiro"
          desc="Você precisa ter pelo menos 1 insumo na lista pra montar a ficha técnica."
          primaryCta={{
            label: "Ir pra Insumos",
            onPress: () => router.push("/studio/insumos"),
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {productName}
            </Text>
            <Text style={styles.headerSubtitle}>Ficha técnica</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: t.bgSoft }]}>
            <Feather name="layers" size={12} color={t.ink2} />
            <Text style={[styles.badgeText, { color: t.ink2 }]}>
              {items.length} {items.length === 1 ? "item" : "itens"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Custo total</Text>
            <Text style={[styles.kpiValue, { color: t.ink1 }]}>{formatBRL(totalCost)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Preço de venda</Text>
            <Text style={[styles.kpiValue, { color: t.ink1 }]}>{formatBRL(productPrice)}</Text>
          </View>
          <View style={[styles.kpiBox, styles.kpiMargin, { backgroundColor: marginTone.bg }]}>
            <Text style={[styles.kpiLabel, { color: marginTone.fg }]}>Margem</Text>
            <Text style={[styles.kpiValue, { color: marginTone.fg }]}>
              {marginPct == null ? "—" : marginPct.toFixed(1) + "%"}
            </Text>
            <Text style={[styles.kpiSub, { color: marginTone.fg }]}>{formatBRL(marginValue)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Insumos</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyRowsBox}>
            <Feather name="inbox" size={20} color={t.ink3} />
            <Text style={styles.emptyRowsText}>Nenhum insumo adicionado ainda</Text>
          </View>
        ) : (
          items.map((it, idx) => {
            const subtotal = (Number(it.qty_per_unit) || 0) * (Number(it.input_unit_cost) || 0);
            const isOpen = openPickerIdx === idx;
            const displayName = it.input_name || "Selecionar insumo";
            return (
              <View key={(it.id || "new") + "-" + idx} style={styles.itemRow}>
                <View style={styles.itemTopRow}>
                  <Pressable
                    style={styles.inputSelect}
                    onPress={() => {
                      setOpenPickerIdx(isOpen ? null : idx);
                      setPickerQuery("");
                    }}
                  >
                    <Feather name="package" size={14} color={t.ink2} />
                    <Text
                      style={[
                        styles.inputSelectText,
                        { color: it.input_id ? t.ink1 : t.ink3 },
                      ]}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                    <Feather
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={t.ink3}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => removeRow(idx)}
                    style={styles.removeBtn}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={16} color={t.dangerInk} />
                  </Pressable>
                </View>

                {isOpen ? (
                  <View style={styles.pickerBox}>
                    <View style={styles.pickerSearch}>
                      <Feather name="search" size={14} color={t.ink3} />
                      <TextInput
                        value={pickerQuery}
                        onChangeText={setPickerQuery}
                        placeholder="Buscar insumo"
                        placeholderTextColor={t.ink3}
                        style={styles.pickerSearchInput}
                        autoFocus
                      />
                    </View>
                    <ScrollView style={styles.pickerList} nestedScrollEnabled>
                      {filteredInputs.length === 0 ? (
                        <View style={styles.pickerEmpty}>
                          <Text style={styles.pickerEmptyText}>Nenhum insumo</Text>
                        </View>
                      ) : (
                        filteredInputs.map((inp) => (
                          <Pressable
                            key={inp.id}
                            style={styles.pickerOption}
                            onPress={() => pickInput(idx, inp)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.pickerOptionName} numberOfLines={1}>
                                {inp.name}
                              </Text>
                              <Text style={styles.pickerOptionMeta}>
                                {formatBRL(inp.unit_cost)} / {inp.unit}
                              </Text>
                            </View>
                            {inp.is_low_stock ? (
                              <View
                                style={[styles.lowStockBadge, { backgroundColor: t.warningSoft }]}
                              >
                                <Text style={[styles.lowStockText, { color: t.warningInk }]}>
                                  baixo
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        ))
                      )}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.itemMetricsRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>
                      Qtd{it.input_unit ? " (" + it.input_unit + ")" : ""}
                    </Text>
                    <TextInput
                      value={String(it.qty_per_unit ?? "")}
                      onChangeText={(v) => updateQty(idx, v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={t.ink3}
                      style={styles.metricInput}
                    />
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Custo unit.</Text>
                    <Text style={styles.metricValue}>
                      {it.input_unit_cost != null ? formatBRL(it.input_unit_cost) : "—"}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Subtotal</Text>
                    <Text style={[styles.metricValue, { color: t.ink1, fontWeight: "700" }]}>
                      {formatBRL(subtotal)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <Pressable
          onPress={addRow}
          style={styles.addRowBtn}
          disabled={inputs.length === 0}
        >
          <Feather name="plus" size={16} color={t.primary} />
          <Text style={[styles.addRowText, { color: t.primary }]}>Adicionar insumo</Text>
        </Pressable>

        {inputs.length === 0 ? (
          <Pressable
            onPress={() => router.push("/studio/insumos")}
            style={styles.hintBox}
          >
            <Feather name="info" size={14} color={t.infoInk} />
            <Text style={[styles.hintText, { color: t.infoInk }]}>
              Cadastre insumos pra liberar a edição da ficha.
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Observações</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anotações sobre a ficha técnica (opcional)"
          placeholderTextColor={t.ink3}
          style={styles.notesInput}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: t.primary }, saving && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Salvar ficha técnica</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function buildStyles(t: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },
    headerCard: {
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
      gap: 14,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    headerTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: t.ink1,
    },
    headerSubtitle: {
      fontSize: 12,
      color: t.ink3,
      marginTop: 2,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    kpiRow: {
      flexDirection: "row",
      gap: 8,
    },
    kpiBox: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      backgroundColor: t.bgSoft,
      gap: 4,
    },
    kpiMargin: {
      borderWidth: 0,
    },
    kpiLabel: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: "800",
    },
    kpiSub: {
      fontSize: 11,
      fontWeight: "600",
    },
    section: {
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: t.ink1,
    },
    emptyRowsBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 18,
      gap: 6,
    },
    emptyRowsText: {
      fontSize: 12,
      color: t.ink3,
    },
    itemRow: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 10,
      gap: 10,
      backgroundColor: t.bg,
    },
    itemTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    inputSelect: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: t.bgSoft,
      borderWidth: 1,
      borderColor: t.border,
    },
    inputSelectText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
    },
    removeBtn: {
      padding: 8,
      borderRadius: 8,
    },
    pickerBox: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surface,
      overflow: "hidden",
    },
    pickerSearch: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    pickerSearchInput: {
      flex: 1,
      fontSize: 13,
      color: t.ink1,
      paddingVertical: 2,
    },
    pickerList: {
      maxHeight: 200,
    },
    pickerEmpty: {
      padding: 14,
      alignItems: "center",
    },
    pickerEmptyText: {
      fontSize: 12,
      color: t.ink3,
    },
    pickerOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    pickerOptionName: {
      fontSize: 13,
      fontWeight: "600",
      color: t.ink1,
    },
    pickerOptionMeta: {
      fontSize: 11,
      color: t.ink3,
      marginTop: 2,
    },
    lowStockBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    lowStockText: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    itemMetricsRow: {
      flexDirection: "row",
      gap: 8,
    },
    metricBox: {
      flex: 1,
      padding: 8,
      borderRadius: 8,
      backgroundColor: t.bgSoft,
      gap: 4,
    },
    metricLabel: {
      fontSize: 10,
      color: t.ink3,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    metricInput: {
      fontSize: 14,
      fontWeight: "700",
      color: t.ink1,
      padding: 0,
    },
    metricValue: {
      fontSize: 13,
      color: t.ink2,
      fontWeight: "600",
    },
    addRowBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderStyle: "dashed",
    },
    addRowText: {
      fontSize: 13,
      fontWeight: "600",
    },
    hintBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 10,
      borderRadius: 8,
      backgroundColor: t.infoSoft,
    },
    hintText: {
      fontSize: 12,
      fontWeight: "500",
      flex: 1,
    },
    notesInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 13,
      color: t.ink1,
      backgroundColor: t.bgSoft,
      minHeight: 70,
      textAlignVertical: "top",
    },
    footer: {
      paddingTop: 4,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
