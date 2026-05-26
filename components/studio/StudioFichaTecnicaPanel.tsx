import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { type StudioPalette } from "@/constants/studio-tokens";
import { toast } from "@/components/Toast";
import { studioApi } from "@/services/studioApi";
import StudioLoading from "@/components/studio/StudioLoading";
import StudioEmpty from "@/components/studio/StudioEmpty";
import NovoInsumoModal from "@/components/studio/NovoInsumoModal";

// Defensive import — Agent 4 may not have shipped helper yet
let extractProductVariantsFn:
  | ((cfg: any) => ProductVariant[])
  | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@/utils/productVariants");
  if (mod && typeof mod.extractProductVariants === "function") {
    extractProductVariantsFn = mod.extractProductVariants;
  }
} catch (e) {
  console.log("[StudioFichaTecnicaPanel] productVariants helper not yet available, fallback to []");
}

type ProductVariant = {
  fieldId: string;
  fieldLabel: string;
  fieldType: "option" | "color";
  values: Array<{ value: string; label: string }>;
};

type CompositionItem = {
  id?: string;
  input_id: string;
  input_name?: string;
  input_unit?: string;
  input_unit_cost?: number;
  qty_per_unit: number;
  notes?: string | null;
  sort_order?: number;
  qty_multiplier_by_option?: Record<string, Record<string, number>> | null;
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

type CustomizationConfig = {
  fields?: Array<{ id: string; type: string; label: string; config?: any }>;
} | null;

type Props = {
  productId: string;
  companyId: string;
  productName?: string;
  productPrice?: number;
  customizationConfig?: CustomizationConfig;
  onSaved?: (summary: Summary) => void;
  onChanged?: () => void;
};

function getMarginTone(margin: number | null, t: StudioPalette) {
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

function safeExtractVariants(cfg: CustomizationConfig): ProductVariant[] {
  if (!cfg) return [];
  if (extractProductVariantsFn) {
    try {
      const out = extractProductVariantsFn(cfg);
      return Array.isArray(out) ? out : [];
    } catch (e) {
      console.error("[StudioFichaTecnicaPanel.safeExtractVariants] helper threw", e);
    }
  }
  // Inline fallback — mirror shape from Agent 4 spec
  try {
    const fields = Array.isArray(cfg?.fields) ? cfg.fields : [];
    const out: ProductVariant[] = [];
    for (const f of fields) {
      if (!f || (f.type !== "option" && f.type !== "color")) continue;
      const opts = Array.isArray(f?.config?.options) ? f.config.options : [];
      const values = opts
        .map((o: any) => {
          const value = String(o?.value ?? o?.id ?? "").trim();
          const label = String(o?.label ?? o?.name ?? value).trim();
          return value ? { value, label: label || value } : null;
        })
        .filter(Boolean) as Array<{ value: string; label: string }>;
      if (values.length === 0) continue;
      out.push({
        fieldId: String(f.id),
        fieldLabel: String(f.label || f.id),
        fieldType: f.type as "option" | "color",
        values,
      });
    }
    return out;
  } catch (e) {
    console.error("[StudioFichaTecnicaPanel.safeExtractVariants] fallback threw", e);
    return [];
  }
}

export default function StudioFichaTecnicaPanel({
  productId,
  companyId,
  productName,
  productPrice,
  customizationConfig,
  onSaved,
  onChanged,
}: Props) {
  const t = useStudioTokens();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(t), [t]);

  const variants = useMemo<ProductVariant[]>(
    () => safeExtractVariants(customizationConfig ?? null),
    [customizationConfig]
  );

  const safeProductName = productName || "Produto";
  const safeProductPrice = typeof productPrice === "number" ? productPrice : 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CompositionItem[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [inputs, setInputs] = useState<StudioInput[]>([]);
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState<string>("");
  const [novoInsumoOpen, setNovoInsumoOpen] = useState(false);
  // Tracks which variant field is currently chosen per row (when multiple variants exist)
  const [activeVariantFieldByIdx, setActiveVariantFieldByIdx] = useState<Record<number, string>>({});
  // Tracks open-picker for "Varia por" select per row
  const [openVariantPickerIdx, setOpenVariantPickerIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, inputsRes] = await Promise.all([
        studioApi.getComposition(companyId, productId),
        studioApi.listInputs(companyId),
      ]);
      const loadedItems: CompositionItem[] = Array.isArray(compRes?.items)
        ? compRes.items.map((it: any) => ({
            ...it,
            qty_multiplier_by_option: it?.qty_multiplier_by_option ?? null,
          }))
        : [];
      setItems(loadedItems);
      setNotes(compRes?.composition?.notes || "");
      setInputs(Array.isArray(inputsRes?.inputs) ? inputsRes.inputs : []);

      // Pre-populate activeVariantFieldByIdx from saved data
      const initActive: Record<number, string> = {};
      loadedItems.forEach((it, idx) => {
        if (it.qty_multiplier_by_option) {
          const keys = Object.keys(it.qty_multiplier_by_option);
          if (keys.length > 0) initActive[idx] = keys[0];
        }
      });
      setActiveVariantFieldByIdx(initActive);
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
      toast.error("[" + (status || "?") + "] " + (data.error || message || "Erro ao carregar ficha tecnica"));
    } finally {
      setLoading(false);
    }
  }, [companyId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute "average multiplier" for a row (used in totalCost / footer estimation)
  const computeAvgMultiplier = useCallback(
    (it: CompositionItem): number => {
      if (!it.qty_multiplier_by_option) return 1;
      const fieldKeys = Object.keys(it.qty_multiplier_by_option);
      if (fieldKeys.length === 0) return 1;
      // Use first variant field
      const fk = fieldKeys[0];
      const map = it.qty_multiplier_by_option[fk] || {};
      const values = Object.values(map).map((v) => Number(v) || 0);
      if (values.length === 0) return 1;
      const sum = values.reduce((s, v) => s + v, 0);
      return sum / values.length;
    },
    []
  );

  const totalCost = useMemo(
    () =>
      items.reduce((s, it) => {
        const qty = Number(it.qty_per_unit) || 0;
        const unitCost = Number(it.input_unit_cost) || 0;
        const avgMul = computeAvgMultiplier(it);
        return s + qty * unitCost * avgMul;
      }, 0),
    [items, computeAvgMultiplier]
  );

  const marginPct = useMemo(() => {
    if (!safeProductPrice || safeProductPrice <= 0) return null;
    return ((safeProductPrice - totalCost) / safeProductPrice) * 100;
  }, [safeProductPrice, totalCost]);

  const marginValue = useMemo(
    () => (safeProductPrice ? safeProductPrice - totalCost : 0),
    [safeProductPrice, totalCost]
  );

  const marginTone = useMemo(() => getMarginTone(marginPct, t), [marginPct, t]);

  const addRow = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        input_id: "",
        qty_per_unit: 0,
        sort_order: prev.length,
        qty_multiplier_by_option: null,
      },
    ]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setActiveVariantFieldByIdx((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
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

  // Toggle Fixa <-> Por variante for a row
  const toggleVariantMode = useCallback(
    (idx: number, on: boolean) => {
      if (!on) {
        // Switch back to Fixa
        setItems((prev) =>
          prev.map((it, i) =>
            i === idx ? { ...it, qty_multiplier_by_option: null } : it
          )
        );
        setActiveVariantFieldByIdx((prev) => {
          const next = { ...prev };
          delete next[idx];
          return next;
        });
        return;
      }
      if (variants.length === 0) {
        toast.error("Produto sem variantes. Cadastre options em Personalizacao");
        return;
      }
      // Pick variant: if only 1, use it; else default to first and let user change
      const chosen = variants[0];
      const initialMap: Record<string, number> = {};
      chosen.values.forEach((v) => {
        initialMap[v.value] = 1.0;
      });
      const wrapped: Record<string, Record<string, number>> = {
        [chosen.fieldId]: initialMap,
      };
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx ? { ...it, qty_multiplier_by_option: wrapped } : it
        )
      );
      setActiveVariantFieldByIdx((prev) => ({ ...prev, [idx]: chosen.fieldId }));
    },
    [variants]
  );

  const changeVariantField = useCallback(
    (idx: number, fieldId: string) => {
      const target = variants.find((v) => v.fieldId === fieldId);
      if (!target) return;
      const initialMap: Record<string, number> = {};
      target.values.forEach((v) => {
        initialMap[v.value] = 1.0;
      });
      const wrapped: Record<string, Record<string, number>> = {
        [target.fieldId]: initialMap,
      };
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx ? { ...it, qty_multiplier_by_option: wrapped } : it
        )
      );
      setActiveVariantFieldByIdx((prev) => ({ ...prev, [idx]: target.fieldId }));
      setOpenVariantPickerIdx(null);
    },
    [variants]
  );

  const updateMultiplier = useCallback(
    (idx: number, fieldId: string, valueKey: string, raw: string) => {
      const normalized = raw.replace(",", ".");
      const num = parseFloat(normalized);
      setItems((prev) =>
        prev.map((it, i) => {
          if (i !== idx) return it;
          const cur = { ...(it.qty_multiplier_by_option || {}) };
          const fieldMap = { ...(cur[fieldId] || {}) };
          fieldMap[valueKey] = isNaN(num) ? 0 : num;
          cur[fieldId] = fieldMap;
          return { ...it, qty_multiplier_by_option: cur };
        })
      );
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
          qty_multiplier_by_option: i.qty_multiplier_by_option || null,
        }));
      const res = await studioApi.saveComposition(companyId, productId, {
        notes,
        items: payloadItems,
      });
      toast.success("Ficha tecnica salva");
      if (res?.summary && onSaved) {
        onSaved(res.summary);
      }
      if (onChanged) onChanged();
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
  }, [companyId, productId, items, notes, onSaved, onChanged, load]);

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
          desc="Voce precisa ter pelo menos 1 insumo na lista pra montar a ficha tecnica."
          primaryCta={{
            label: "Ir pra Insumos",
            onPress: () => router.push("/studio/insumos"),
          }}
        />
        <NovoInsumoModal
          visible={novoInsumoOpen}
          companyId={companyId}
          onClose={() => setNovoInsumoOpen(false)}
          onCreated={(insumo: StudioInput) => {
            setInputs((prev) => [insumo, ...prev]);
            setItems((prev) => [
              ...prev,
              {
                input_id: insumo.id,
                input_name: insumo.name,
                input_unit: insumo.unit,
                input_unit_cost: insumo.unit_cost,
                qty_per_unit: 1,
                qty_multiplier_by_option: null,
                sort_order: prev.length,
              },
            ]);
            setNovoInsumoOpen(false);
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
              {safeProductName}
            </Text>
            <Text style={styles.headerSubtitle}>Ficha tecnica</Text>
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
            <Text style={styles.kpiLabel}>Custo medio</Text>
            <Text style={[styles.kpiValue, { color: t.ink }]}>{formatBRL(totalCost)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Preco de venda</Text>
            <Text style={[styles.kpiValue, { color: t.ink }]}>{formatBRL(safeProductPrice)}</Text>
          </View>
          <View style={[styles.kpiBox, styles.kpiMargin, { backgroundColor: marginTone.bg }]}>
            <Text style={[styles.kpiLabel, { color: marginTone.fg }]}>Margem</Text>
            <Text style={[styles.kpiValue, { color: marginTone.fg }]}>
              {marginPct == null ? "-" : marginPct.toFixed(1) + "%"}
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
            const isOpen = openPickerIdx === idx;
            const displayName = it.input_name || "Selecionar insumo";
            const isVariantMode = !!it.qty_multiplier_by_option;
            const activeFieldId =
              activeVariantFieldByIdx[idx] ||
              (it.qty_multiplier_by_option
                ? Object.keys(it.qty_multiplier_by_option)[0]
                : "");
            const activeVariant = variants.find((v) => v.fieldId === activeFieldId);
            const multiplierMap =
              (isVariantMode && activeFieldId && it.qty_multiplier_by_option?.[activeFieldId]) ||
              {};
            const avgMul = computeAvgMultiplier(it);
            const qtyBase = Number(it.qty_per_unit) || 0;
            const unitCost = Number(it.input_unit_cost) || 0;
            const subtotalAvg = qtyBase * unitCost * avgMul;
            const hasVariants = variants.length > 0;
            const variantPickerOpen = openVariantPickerIdx === idx;

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
                        { color: it.input_id ? t.ink : t.ink3 },
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
                      Qtd base{it.input_unit ? " (" + it.input_unit + ")" : ""}
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
                      {it.input_unit_cost != null ? formatBRL(it.input_unit_cost) : "-"}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>
                      {isVariantMode ? "Subtotal medio" : "Subtotal"}
                    </Text>
                    <Text style={[styles.metricValue, { color: t.ink, fontWeight: "700" }]}>
                      {formatBRL(subtotalAvg)}
                    </Text>
                  </View>
                </View>

                {/* Toggle Fixa | Por variante */}
                <View style={styles.modeToggleRow}>
                  <View style={styles.modeToggleWrap}>
                    <Pressable
                      onPress={() => toggleVariantMode(idx, false)}
                      style={[
                        styles.modeChip,
                        !isVariantMode && {
                          backgroundColor: t.primary,
                          borderColor: t.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          { color: !isVariantMode ? "#fff" : t.ink2 },
                        ]}
                      >
                        Fixa
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (!hasVariants) {
                          toast.error("Produto sem variantes. Cadastre options em Personalizacao");
                          return;
                        }
                        toggleVariantMode(idx, true);
                      }}
                      style={[
                        styles.modeChip,
                        isVariantMode && {
                          backgroundColor: t.warning,
                          borderColor: t.warning,
                        },
                        !hasVariants && { opacity: 0.5 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          { color: isVariantMode ? "#fff" : t.ink2 },
                        ]}
                      >
                        Por variante
                      </Text>
                    </Pressable>
                  </View>
                  {isVariantMode && activeVariant ? (
                    <View style={[styles.variantTag, { backgroundColor: t.warningSoft }]}>
                      <Feather name="layers" size={11} color={t.warningInk} />
                      <Text style={[styles.variantTagText, { color: t.warningInk }]}>
                        Varia por: {activeVariant.fieldLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Variant multipliers block */}
                {isVariantMode && hasVariants && activeVariant ? (
                  <View style={styles.variantBlock}>
                    {variants.length > 1 ? (
                      <View style={styles.variantPickerWrap}>
                        <Text style={styles.variantPickerLabel}>Varia por</Text>
                        <Pressable
                          onPress={() =>
                            setOpenVariantPickerIdx(variantPickerOpen ? null : idx)
                          }
                          style={styles.variantPickerBtn}
                        >
                          <Text style={styles.variantPickerBtnText}>
                            {activeVariant.fieldLabel}
                          </Text>
                          <Feather
                            name={variantPickerOpen ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={t.ink3}
                          />
                        </Pressable>
                        {variantPickerOpen ? (
                          <View style={styles.variantPickerList}>
                            {variants.map((vv) => (
                              <Pressable
                                key={vv.fieldId}
                                onPress={() => changeVariantField(idx, vv.fieldId)}
                                style={[
                                  styles.variantPickerOption,
                                  vv.fieldId === activeVariant.fieldId && {
                                    backgroundColor: t.bgSoft,
                                  },
                                ]}
                              >
                                <Text style={styles.variantPickerOptionText}>
                                  {vv.fieldLabel}
                                </Text>
                                <Text style={styles.variantPickerOptionMeta}>
                                  {vv.values.length} valor{vv.values.length === 1 ? "" : "es"}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Multipliers table */}
                    <View style={styles.multiplierTable}>
                      <View style={[styles.multiplierHeaderRow, { backgroundColor: t.bgSoft }]}>
                        <Text style={[styles.multiplierHeaderCell, { flex: 1 }]}>Valor</Text>
                        <Text style={[styles.multiplierHeaderCell, { width: 70, textAlign: "right" }]}>
                          Multiplicador
                        </Text>
                      </View>
                      {activeVariant.values.map((v, vi) => {
                        const current = multiplierMap[v.value];
                        return (
                          <View
                            key={v.value}
                            style={[
                              styles.multiplierBodyRow,
                              vi % 2 === 1 && { backgroundColor: t.bgSoft },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.multiplierValueLabel} numberOfLines={1}>
                                {v.label}
                              </Text>
                              <Text style={styles.multiplierValueKey}>{v.value}</Text>
                            </View>
                            <TextInput
                              value={
                                current != null && current !== undefined
                                  ? String(current)
                                  : ""
                              }
                              onChangeText={(raw) =>
                                updateMultiplier(idx, activeVariant.fieldId, v.value, raw)
                              }
                              keyboardType="decimal-pad"
                              placeholder="1.0"
                              placeholderTextColor={t.ink3}
                              style={styles.multiplierInput}
                            />
                          </View>
                        );
                      })}
                      <View style={styles.multiplierFooter}>
                        <Text style={styles.multiplierFooterText}>
                          Ex: qty base {qtyBase}{it.input_unit ? it.input_unit : ""} x
                          multiplier do valor escolhido pelo cliente. Custo medio por unidade:{" "}
                          <Text style={{ fontWeight: "700", color: t.ink }}>
                            {formatBRL(subtotalAvg)}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {isVariantMode && !hasVariants ? (
                  <View style={[styles.hintBox, { backgroundColor: t.warningSoft }]}>
                    <Feather name="alert-triangle" size={14} color={t.warningInk} />
                    <Text style={[styles.hintText, { color: t.warningInk }]}>
                      Produto sem variantes. Cadastre options em Personalizacao.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View style={styles.addRowGroup}>
          <Pressable
            onPress={addRow}
            style={[styles.addRowBtn, { flex: 1 }]}
            disabled={inputs.length === 0}
          >
            <Feather name="plus" size={16} color={t.primary} />
            <Text style={[styles.addRowText, { color: t.primary }]}>Adicionar insumo</Text>
          </Pressable>
          <Pressable
            onPress={() => setNovoInsumoOpen(true)}
            style={[styles.addRowBtn, styles.btnSec, { flex: 1 }]}
          >
            <Feather name="plus-circle" size={16} color={t.ink2} />
            <Text style={[styles.addRowText, styles.btnSecTxt, { color: t.ink2 }]}>
              Cadastrar insumo
            </Text>
          </Pressable>
        </View>

        {inputs.length === 0 ? (
          <Pressable
            onPress={() => router.push("/studio/insumos")}
            style={styles.hintBox}
          >
            <Feather name="info" size={14} color={t.infoInk} />
            <Text style={[styles.hintText, { color: t.infoInk }]}>
              Cadastre insumos pra liberar a edicao da ficha.
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Observacoes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anotacoes sobre a ficha tecnica (opcional)"
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
              <Text style={styles.saveBtnText}>Salvar ficha tecnica</Text>
            </>
          )}
        </Pressable>
      </View>

      <NovoInsumoModal
        visible={novoInsumoOpen}
        companyId={companyId}
        onClose={() => setNovoInsumoOpen(false)}
        onCreated={(insumo: StudioInput) => {
          setInputs((prev) => [insumo, ...prev]);
          setItems((prev) => [
            ...prev,
            {
              input_id: insumo.id,
              input_name: insumo.name,
              input_unit: insumo.unit,
              input_unit_cost: insumo.unit_cost,
              qty_per_unit: 1,
              qty_multiplier_by_option: null,
              sort_order: prev.length,
            },
          ]);
          setNovoInsumoOpen(false);
        }}
      />
    </ScrollView>
  );
}

function buildStyles(t: StudioPalette) {
  const webShadow =
    Platform.OS === "web"
      ? { boxShadow: "0 1px 2px rgba(0,0,0,0.04)" as any }
      : {};
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
      backgroundColor: t.paperCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 16,
      gap: 14,
      ...webShadow,
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
      color: t.ink,
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
      backgroundColor: t.paperCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 14,
      gap: 12,
      ...webShadow,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: t.ink,
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
      borderColor: t.ink5,
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
      borderColor: t.ink5,
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
      borderColor: t.ink5,
      borderRadius: 10,
      backgroundColor: t.paperCard,
      overflow: "hidden",
    },
    pickerSearch: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    pickerSearchInput: {
      flex: 1,
      fontSize: 13,
      color: t.ink,
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
      borderBottomColor: t.ink5,
    },
    pickerOptionName: {
      fontSize: 13,
      fontWeight: "600",
      color: t.ink,
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
      color: t.ink,
      padding: 0,
    },
    metricValue: {
      fontSize: 13,
      color: t.ink2,
      fontWeight: "600",
    },
    modeToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
    },
    modeToggleWrap: {
      flexDirection: "row",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.ink5,
      overflow: "hidden",
    },
    modeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: t.bgSoft,
      borderWidth: 0,
      borderColor: t.ink5,
    },
    modeChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    variantTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    variantTagText: {
      fontSize: 11,
      fontWeight: "700",
    },
    variantBlock: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 10,
      gap: 10,
      backgroundColor: t.bgSoft,
    },
    variantPickerWrap: {
      gap: 4,
      position: "relative",
    },
    variantPickerLabel: {
      fontSize: 10,
      color: t.ink3,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    variantPickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.ink5,
      borderRadius: 8,
      backgroundColor: t.paperCard,
    },
    variantPickerBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: t.ink,
    },
    variantPickerList: {
      borderWidth: 1,
      borderColor: t.ink5,
      borderRadius: 8,
      backgroundColor: t.paperCard,
      overflow: "hidden",
    },
    variantPickerOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    variantPickerOptionText: {
      fontSize: 13,
      fontWeight: "600",
      color: t.ink,
    },
    variantPickerOptionMeta: {
      fontSize: 11,
      color: t.ink3,
    },
    multiplierTable: {
      borderWidth: 1,
      borderColor: t.ink5,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: t.paperCard,
    },
    multiplierHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    multiplierHeaderCell: {
      fontSize: 10,
      fontWeight: "700",
      color: t.ink3,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    multiplierBodyRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    multiplierValueLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.ink,
    },
    multiplierValueKey: {
      fontSize: 10,
      color: t.ink3,
      marginTop: 1,
    },
    multiplierInput: {
      width: 50,
      borderWidth: 1,
      borderColor: t.ink5,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 4,
      fontSize: 13,
      fontWeight: "700",
      color: t.ink,
      textAlign: "right",
      backgroundColor: t.bg,
    },
    multiplierFooter: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: t.bgSoft,
    },
    multiplierFooterText: {
      fontSize: 11,
      color: t.ink3,
    },
    addRowGroup: {
      flexDirection: "row",
      gap: 8,
    },
    addRowBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.ink5,
      borderStyle: "dashed",
    },
    btnSec: {
      backgroundColor: t.bgSoft,
      borderStyle: "solid",
    },
    btnSecTxt: {
      fontWeight: "600",
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
      borderColor: t.ink5,
      borderRadius: 10,
      padding: 10,
      fontSize: 13,
      color: t.ink,
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
