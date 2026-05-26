import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StudioGradient } from "@/components/studio/StudioGradient";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { studioApi } from "@/services/studioApi";
import { toast } from "@/components/Toast";

type Unit = "un" | "g" | "kg" | "ml" | "L" | "folha" | "cm" | "m";

const UNITS: Unit[] = ["un", "g", "kg", "ml", "L", "folha", "cm", "m"];

type CreatedInsumo = {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  stock_qty: number;
};

type Props = {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onCreated?: (insumo: CreatedInsumo) => void;
};

function parseDecimal(v: string): number {
  if (!v) return 0;
  const norm = v.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return isFinite(n) ? n : 0;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function NovoInsumoModal({
  visible,
  companyId,
  onClose,
  onCreated,
}: Props) {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const { width } = useWindowDimensions();
  const isMobile = width < 720;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("un");
  const [unitCost, setUnitCost] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nameInputRef = useRef<TextInput>(null);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
      const t1 = setTimeout(() => nameInputRef.current?.focus(), 120);
      return () => clearTimeout(t1);
    } else {
      opacity.value = 0;
      scale.value = 0.95;
      // reset form on close
      setName("");
      setUnit("un");
      setUnitCost("");
      setStockQty("");
      setStockMin("");
      setSupplierName("");
      setSupplierPhone("");
      setNotes("");
      setShowMore(false);
      setSubmitting(false);
    }
  }, [visible, opacity, scale]);

  // ESC closes (web)
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const nameValid = name.trim().length >= 2;
  const costNumber = parseDecimal(unitCost);
  const costValid = costNumber > 0;
  const canSubmit = nameValid && costValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      if (!nameValid) {
        toast.error("Informe um nome com pelo menos 2 caracteres");
        return;
      }
      if (!costValid) {
        toast.error("Custo unitário deve ser maior que zero");
        return;
      }
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        unit,
        unit_cost: costNumber,
        stock_qty: parseDecimal(stockQty) || 0,
        stock_min: stockMin ? parseDecimal(stockMin) : null,
        supplier_name: supplierName.trim() || null,
        supplier_phone: supplierPhone.replace(/\D/g, "") || null,
        notes: notes.trim() || null,
      };
      console.log("[NovoInsumoModal] creating input", {
        companyId,
        name: payload.name,
        unit: payload.unit,
      });
      const r = await studioApi.createInput(companyId, payload);
      console.log("[NovoInsumoModal] created", r);
      toast.success("Insumo cadastrado!");
      onCreated?.({
        id: r.id,
        name: r.name,
        unit: r.unit,
        unit_cost: Number(r.unit_cost) || 0,
        stock_qty: Number(r.stock_qty) || 0,
      });
      onClose();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status ?? "?";
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.message ||
        "Falha ao cadastrar insumo";
      console.error("[NovoInsumoModal] create failed", {
        status,
        msg,
      });
      toast.error(`[${status}] ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            isMobile ? styles.cardMobile : styles.cardDesktop,
          ]}
        >
          {/* Header — gradient brand cross-platform */}
          <StudioGradient
            colors={[t.primary, t.accent]}
            direction="135deg"
            style={styles.header}
          >
            <Text style={styles.eyebrow}>ESTOQUE · CADASTRO RÁPIDO</Text>
            <Text style={styles.title}>Novo insumo</Text>
            <Text style={styles.subtitle}>
              Cadastre o item de matéria-prima e ele já entra na ficha do
              produto
            </Text>
          </StudioGradient>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Nome */}
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Tinta sublimática azul"
                placeholderTextColor={t.ink3}
                style={styles.input}
              />
            </View>

            {/* Unidade chips */}
            <View style={styles.field}>
              <Text style={styles.label}>Unidade</Text>
              <View
                style={[
                  styles.chipGrid,
                  isMobile ? styles.chipGridMobile : styles.chipGridDesktop,
                ]}
              >
                {UNITS.map((u) => {
                  const active = unit === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.chip,
                        active && styles.chipActive,
                        isMobile && styles.chipMobile,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Custo + Estoque inicial */}
            <View style={styles.row}>
              <View style={[styles.field, styles.rowItem]}>
                <Text style={styles.label}>Custo unitário</Text>
                <View style={styles.prefixWrap}>
                  <Text style={styles.prefix}>R$</Text>
                  <TextInput
                    value={unitCost}
                    onChangeText={setUnitCost}
                    placeholder="0,00"
                    placeholderTextColor={t.ink3}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.inputPrefixed]}
                  />
                </View>
              </View>
              <View style={[styles.field, styles.rowItem]}>
                <Text style={styles.label}>Estoque inicial</Text>
                <TextInput
                  value={stockQty}
                  onChangeText={setStockQty}
                  placeholder="0"
                  placeholderTextColor={t.ink3}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Mínimo */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Mínimo{" "}
                <Text style={styles.labelHint}>(alerta crítico, opcional)</Text>
              </Text>
              <TextInput
                value={stockMin}
                onChangeText={setStockMin}
                placeholder="0"
                placeholderTextColor={t.ink3}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            {/* Expand */}
            <Pressable
              onPress={() => setShowMore((v) => !v)}
              style={styles.expandBtn}
            >
              <Text style={styles.expandText}>
                {showMore ? "− Menos detalhes" : "+ Mais detalhes"}
              </Text>
            </Pressable>

            {showMore && (
              <View>
                <View style={styles.field}>
                  <Text style={styles.label}>Fornecedor</Text>
                  <TextInput
                    value={supplierName}
                    onChangeText={setSupplierName}
                    placeholder="Nome do fornecedor"
                    placeholderTextColor={t.ink3}
                    style={styles.input}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Telefone do fornecedor</Text>
                  <TextInput
                    value={supplierPhone}
                    onChangeText={(v) => setSupplierPhone(maskPhone(v))}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={t.ink3}
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Observações</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Notas internas, código do fornecedor, etc"
                    placeholderTextColor={t.ink3}
                    multiline
                    numberOfLines={3}
                    style={[styles.input, styles.textarea]}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={[styles.btn, styles.btnGhost]}
            >
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[
                styles.btn,
                styles.btnPrimary,
                !canSubmit && styles.btnDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Criar e adicionar</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
    },
    backdropPress: { ...StyleSheet.absoluteFillObject },
    card: {
      backgroundColor: t.paperCard,
      borderRadius: 20,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    cardMobile: {
      width: "100%",
      height: "100%",
      borderRadius: 0,
    },
    cardDesktop: {
      width: 540,
      maxHeight: "90%",
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 22,
    },
    eyebrow: {
      color: t.accentSoft,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      marginBottom: 8,
    },
    title: {
      color: "#fff",
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 6,
    },
    subtitle: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 13,
      lineHeight: 18,
    },
    body: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { padding: 20, paddingBottom: 8 },
    field: { marginBottom: 14 },
    label: {
      fontSize: 12,
      fontWeight: "700",
      color: t.ink,
      marginBottom: 6,
      letterSpacing: 0.2,
    },
    labelHint: {
      fontWeight: "500",
      color: t.ink3,
      fontSize: 11,
    },
    input: {
      backgroundColor: t.bgSoft,
      borderWidth: 1,
      borderColor: t.ink5,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "web" ? 10 : 12,
      fontSize: 14,
      color: t.ink,
    },
    inputPrefixed: { paddingLeft: 32 },
    prefixWrap: { position: "relative" },
    prefix: {
      position: "absolute",
      left: 12,
      top: 0,
      bottom: 0,
      textAlignVertical: "center",
      lineHeight: Platform.OS === "web" ? 38 : 44,
      color: t.ink3,
      fontWeight: "700",
      fontSize: 13,
      zIndex: 1,
    },
    textarea: {
      minHeight: 70,
      textAlignVertical: "top",
      paddingTop: 10,
    },
    row: { flexDirection: "row", gap: 12 },
    rowItem: { flex: 1 },
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chipGridMobile: {},
    chipGridDesktop: {},
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: t.bgSoft,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    chipMobile: { minWidth: "22%", alignItems: "center" },
    chipActive: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    chipText: {
      fontSize: 13,
      color: t.ink,
      fontWeight: "600",
    },
    chipTextActive: { color: "#fff" },
    expandBtn: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      marginTop: 2,
      marginBottom: 8,
    },
    expandText: {
      color: t.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    footer: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      backgroundColor: t.paperCard,
    },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    btnGhost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.ink5,
    },
    btnGhostText: {
      color: t.ink,
      fontWeight: "700",
      fontSize: 14,
    },
    btnPrimary: { backgroundColor: t.primary },
    btnPrimaryText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
    btnDisabled: { opacity: 0.5 },
  });
}
