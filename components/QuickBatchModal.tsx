import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { variantsQuickBatchApi } from "@/services/variantsQuickBatchApi";

// ============================================================
// AURA. — Mini-modal de Quick-Batch (Tarefa A: Variantes via "+")
//
// Permite criar N variantes de uma vez:
//   1. Cliente seleciona o atributo (Tamanho, Cor, etc)
//   2. Digita valores separados por virgula: "P, M, G"
//   3. Preview mostra diff vs produto pai antes de confirmar
//   4. Backend cria todas atomicamente, promovendo o pai a
//      variante padrao se for o primeiro batch
//
// Decisoes fechadas (BLOCO C do contexto):
//   - "+" coexiste com a secao Variantes atual (este modal eh o "+")
//   - Mostra diff antes de confirmar
//   - Aceita batch input ("P, M, G" cria 3)
//   - Pra 3+ atributos, herda os dois do pai (color/size automatico)
//   - Ao criar 1a variante, pai vira variante automaticamente
// ============================================================

const ATTR_PRESETS = [
  { key: "Tamanho", label: "Tamanho", placeholder: "P, M, G, GG" },
  { key: "Cor", label: "Cor", placeholder: "Azul, Vermelho, Verde" },
  { key: "Material", label: "Material", placeholder: "Algodao, Poliester" },
  { key: "Sabor", label: "Sabor", placeholder: "Chocolate, Baunilha" },
  { key: "Volume", label: "Volume", placeholder: "100ml, 250ml, 500ml" },
];

type Props = {
  productId: string;
  productName: string;
  productColor?: string | null;
  productSize?: string | null;
  basePrice: number;
  baseStock: number;
  hasExistingVariants: boolean;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function QuickBatchModal({
  productId, productName, productColor, productSize, basePrice, baseStock,
  hasExistingVariants, visible, onClose, onSuccess,
}: Props) {
  const { company } = useAuthStore();
  const [attrName, setAttrName] = useState<string>("Tamanho");
  const [valuesText, setValuesText] = useState<string>("");
  const [stockPer, setStockPer] = useState<string>("0");
  const [saving, setSaving] = useState<boolean>(false);

  // Parse "P, M, G" -> ["P", "M", "G"]
  const parsedValues = useMemo(function() {
    return valuesText
      .split(/[,\n;]+/)
      .map(function(v) { return v.trim(); })
      .filter(function(v) { return v.length > 0; })
      .filter(function(v, i, arr) { return arr.indexOf(v) === i; }) // dedup
      .slice(0, 20); // max 20 (mesmo limite do backend)
  }, [valuesText]);

  // Atributos herdados do pai (mostrados na preview)
  const parentInheritedAttrs = useMemo(function() {
    var attrs: Array<{ key: string; value: string; isHex?: boolean }> = [];
    if (productColor && /^#[0-9a-f]{6}$/i.test(productColor) && attrName.toLowerCase() !== "cor") {
      attrs.push({ key: "Cor", value: productColor, isHex: true });
    }
    if (productSize && productSize.trim() && attrName.toLowerCase() !== "tamanho") {
      attrs.push({ key: "Tamanho", value: productSize.trim() });
    }
    return attrs;
  }, [productColor, productSize, attrName]);

  // Texto explicativo "Vou criar 3 variantes diferentes do atual..."
  const explanationText = useMemo(function() {
    if (parsedValues.length === 0) return null;
    var willPromote = !hasExistingVariants;
    var parentDesc = parentInheritedAttrs.length > 0
      ? parentInheritedAttrs.map(function(a) { return a.isHex ? "(" + a.value + ")" : a.value; }).join(" \u00b7 ")
      : null;

    var lines = [];
    lines.push("Vou criar " + parsedValues.length + " variante" + (parsedValues.length === 1 ? "" : "s") + ":");
    parsedValues.forEach(function(v) {
      var parts = [attrName + ": " + v];
      parentInheritedAttrs.forEach(function(a) {
        parts.push(a.key + ": " + (a.isHex ? "(" + a.value + ")" : a.value));
      });
      lines.push("  \u2022 " + parts.join(" \u00b7 "));
    });

    if (willPromote && (productColor || productSize)) {
      lines.push("");
      lines.push("O produto atual" + (parentDesc ? ' "' + productName + " (" + parentDesc + ')"' : "") +
        " vira variante automaticamente preservando o estoque (" + baseStock + " un).");
    }

    return lines.join("\n");
  }, [parsedValues, attrName, parentInheritedAttrs, hasExistingVariants, productColor, productSize, productName, baseStock]);

  function handleClose() {
    if (saving) return;
    setAttrName("Tamanho");
    setValuesText("");
    setStockPer("0");
    onClose();
  }

  async function handleSubmit() {
    if (!company?.id) { toast.error("Sessao expirada"); return; }
    if (parsedValues.length === 0) {
      toast.error("Digite pelo menos um valor");
      return;
    }
    if (!attrName.trim()) {
      toast.error("Escolha o tipo de atributo");
      return;
    }

    setSaving(true);
    try {
      var stockNum = Math.max(0, parseInt(stockPer) || 0);
      var result = await variantsQuickBatchApi.quickBatch(company.id, productId, {
        attribute_name: attrName.trim(),
        values: parsedValues,
        stock_per_variant: stockNum,
      });

      var msgParts = [];
      msgParts.push(result.created + " variante" + (result.created === 1 ? "" : "s") + " criada" + (result.created === 1 ? "" : "s"));
      if (result.parent_promoted) msgParts.push("produto pai promovido");
      if (result.skipped > 0) msgParts.push(result.skipped + " puladas (duplicadas)");
      toast.success(msgParts.join(" \u00b7 "));

      // Reset e fecha
      setValuesText("");
      setStockPer("0");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao criar variantes");
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  var isValid = parsedValues.length > 0 && attrName.trim().length > 0;

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Adicionar variantes em lote</Text>
            <Text style={s.subtitle}>{productName}</Text>
          </View>
          <Pressable onPress={handleClose} disabled={saving} style={s.closeBtn}>
            <Text style={s.closeText}>x</Text>
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          {/* Tipo de atributo */}
          <View>
            <Text style={s.label}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: "row", gap: 6, paddingRight: 12 }}>
              {ATTR_PRESETS.map(function(p) {
                var active = attrName === p.key;
                return (
                  <Pressable key={p.key} onPress={function() { setAttrName(p.key); }}
                    style={[s.chip, active && s.chipActive]}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              value={attrName}
              onChangeText={setAttrName}
              placeholder="Ou digite outro tipo (ex: Estampa)"
              placeholderTextColor={Colors.ink3}
            />
          </View>

          {/* Valores em lote */}
          <View>
            <Text style={s.label}>Valores (separe por virgula)</Text>
            <TextInput
              style={[s.input, { minHeight: 60, textAlignVertical: "top" as any }]}
              value={valuesText}
              onChangeText={setValuesText}
              placeholder={ATTR_PRESETS.find(function(p) { return p.key === attrName; })?.placeholder || "P, M, G"}
              placeholderTextColor={Colors.ink3}
              multiline
              autoFocus
            />
            <Text style={s.hint}>
              Maximo 20 valores. Duplicatas sao ignoradas automaticamente.
              {parsedValues.length > 0 && (
                <Text style={{ color: Colors.violet3, fontWeight: "700" as any }}>
                  {" \u00b7 "}{parsedValues.length} valor{parsedValues.length === 1 ? "" : "es"} detectado{parsedValues.length === 1 ? "" : "s"}
                </Text>
              )}
            </Text>
          </View>

          {/* Estoque por variante */}
          <View>
            <Text style={s.label}>Estoque inicial por variante</Text>
            <TextInput
              style={s.input}
              value={stockPer}
              onChangeText={setStockPer}
              placeholder="0"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
            />
            <Text style={s.hint}>
              Mesmo numero pra todas as variantes criadas. Ajuste depois individualmente.
            </Text>
          </View>

          {/* PREVIEW DIFF */}
          {explanationText && (
            <View style={s.previewBox}>
              <View style={s.previewHeader}>
                <Icon name="info" size={12} color={Colors.violet3} />
                <Text style={s.previewTitle}>Preview</Text>
              </View>
              <Text style={s.previewText}>{explanationText}</Text>
            </View>
          )}

          {/* Atributos que serao herdados */}
          {parentInheritedAttrs.length > 0 && parsedValues.length > 0 && (
            <View style={s.inheritedBox}>
              <Text style={s.inheritedLabel}>Atributos herdados do produto pai:</Text>
              <View style={s.inheritedRow}>
                {parentInheritedAttrs.map(function(a, i) {
                  return (
                    <View key={i} style={s.inheritedChip}>
                      {a.isHex && <View style={[s.inheritedDot, { backgroundColor: a.value }]} />}
                      <Text style={s.inheritedKey}>{a.key}:</Text>
                      <Text style={s.inheritedVal}>{a.isHex ? a.value : a.value}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Acoes */}
        <View style={s.actions}>
          <Pressable onPress={handleClose} disabled={saving} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={handleSubmit} disabled={!isValid || saving}
            style={[s.submitBtn, (!isValid || saving) && { opacity: 0.5 }]}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.submitText}>
                Criar {parsedValues.length > 0 ? parsedValues.length + " " : ""}variante{parsedValues.length === 1 ? "" : "s"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "fixed" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center",
    zIndex: 200,
  },
  modal: {
    backgroundColor: Colors.bg3,
    borderRadius: 18,
    padding: 22,
    width: "90%",
    maxWidth: 480,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 12 },
  title: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 14, color: Colors.ink3, fontWeight: "700" },

  label: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" as any, marginBottom: 6 },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" as any, lineHeight: 14 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: Colors.ink },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "700" },

  previewBox: { backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  previewTitle: { fontSize: 10, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.4 },
  previewText: { fontSize: 11, color: Colors.ink, lineHeight: 16, fontFamily: "monospace" as any },

  inheritedBox: { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  inheritedLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.3, marginBottom: 6 },
  inheritedRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  inheritedChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.bg3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  inheritedDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  inheritedKey: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any },
  inheritedVal: { fontSize: 11, color: Colors.ink, fontWeight: "600" },

  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  submitBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.violet, minWidth: 140, alignItems: "center", justifyContent: "center" },
  submitText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default QuickBatchModal;
