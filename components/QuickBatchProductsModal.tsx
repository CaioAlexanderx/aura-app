import { useState, useMemo } from "react";
import { View, Text, Modal, Pressable, StyleSheet, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productsBatchApi, type BatchProductInput } from "@/services/productsBatchApi";
import { nameToHex, hexToName } from "@/utils/colorNames";

// ============================================================
// AURA. -- QuickBatchProductsModal (lote de produtos gerais)
//
// Modal com textarea onde o usuario cola 1 produto por linha.
// Formato: Nome | Preco | Tamanho | Cor | Estoque
// Separador: pipe "|" ou TAB (copy/paste de planilha).
//
// So "Nome" e obrigatorio. Os demais sao posicionais e opcionais.
//
// Categoria: campo unico aplicado a todos os itens do lote.
//
// Regra: permite duplicados, soh avisa no final ("X duplicados criados").
// Max: 200 linhas por lote.
// ============================================================

type ParsedRow = {
  line: string;          // linha original (pra debug)
  name: string;
  price: number;
  size: string | null;
  colorInput: string | null;   // o que o user digitou
  colorHex: string | null;     // convertido pelo nameToHex
  stock: number;
  isValid: boolean;
  errorMsg?: string;
};

// Detecta o separador usado na textarea
// Preferencia: tab > pipe > semicolon
function detectSeparator(text: string): string {
  const firstNonEmptyLine = text.split(/\r?\n/).find(l => l.trim());
  if (!firstNonEmptyLine) return "|";
  if (firstNonEmptyLine.includes("\t")) return "\t";
  if (firstNonEmptyLine.includes("|")) return "|";
  if (firstNonEmptyLine.includes(";")) return ";";
  return "|";  // default fallback
}

// Parse numerico tolerante: "49,90" ou "49.90" ou "49" -> 49.90
function parseBrlNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  // Se tem virgula E ponto, assume ponto como milhar e virgula como decimal
  // ("1.299,90" -> 1299.90)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // So virgula: decimal BR
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  // So ponto OU nenhum: parse direto
  return parseFloat(cleaned) || 0;
}

function parseIntSafe(s: string): number {
  const n = parseInt(String(s || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseRows(text: string): ParsedRow[] {
  const sep = detectSeparator(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const parts = line.split(sep).map(p => p.trim());
    const name = parts[0] || "";
    const priceStr = parts[1] || "";
    const size = parts[2] || "";
    const colorRaw = parts[3] || "";
    const stockStr = parts[4] || "";

    const row: ParsedRow = {
      line,
      name,
      price: parseBrlNumber(priceStr),
      size: size || null,
      colorInput: colorRaw || null,
      colorHex: colorRaw ? nameToHex(colorRaw) : null,
      stock: parseIntSafe(stockStr),
      isValid: !!name,
      errorMsg: !name ? "Nome vazio" : undefined,
    };
    return row;
  });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  allCategories: string[];     // pra o dropdown de categoria
};

const MAX_ROWS = 200;
const EXAMPLE = "Camiseta Branca | 49,90 | P | Branca | 15\nCamiseta Branca | 49,90 | M | Branca | 10\nTenis Esportivo | 199,90 | 38 | Preto | 5\nBone Aba Reta | 39,90 |  | Preto | 20";

export function QuickBatchProductsModal({ visible, onClose, allCategories }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(() => allCategories[0] || "Produtos");
  const [showCatPicker, setShowCatPicker] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseRows(text) : []), [text]);
  const validRows = useMemo(() => parsed.filter(r => r.isValid), [parsed]);
  const invalidCount = parsed.length - validRows.length;
  const exceedsMax = validRows.length > MAX_ROWS;

  const mut = useMutation({
    mutationFn: function() {
      if (!company?.id) throw new Error("Sem empresa");
      const payload: BatchProductInput[] = validRows.map(r => ({
        name: r.name,
        price: r.price,
        stock_qty: r.stock,
        size: r.size,
        color: r.colorHex,
        category: category || "Produtos",
      }));
      return productsBatchApi.batchCreate(company.id, payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products", company?.id] });
      qc.invalidateQueries({ queryKey: ["duplicateGroups", company?.id] });
      const dup = res.duplicates > 0
        ? ` (${res.duplicates} ${res.duplicates === 1 ? "duplicado criado" : "duplicados criados"})`
        : "";
      toast.success(`${res.total_created} ${res.total_created === 1 ? "produto adicionado" : "produtos adicionados"}${dup}`);
      setText("");
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.data?.error || err?.message || "Erro ao criar produtos";
      toast.error(msg);
    },
  });

  function handleClose() {
    if (mut.isPending) return;
    setText("");
    onClose();
  }

  function handleSubmit() {
    if (validRows.length === 0) {
      toast.error("Digite pelo menos um produto (nome obrigatorio)");
      return;
    }
    if (exceedsMax) {
      toast.error(`Maximo de ${MAX_ROWS} produtos por lote. Voce tem ${validRows.length}.`);
      return;
    }
    mut.mutate();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Adicionar produtos em lote</Text>
              <Text style={s.subtitle}>Cole varios produtos de uma vez</Text>
            </View>
            <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={8}>
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Instrucoes */}
            <View style={s.infoBox}>
              <Icon name="info" size={14} color={Colors.violet3} />
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle}>Formato: Nome | Preco | Tamanho | Cor | Estoque</Text>
                <Text style={s.infoText}>
                  Use "|" ou TAB como separador. So o nome e obrigatorio. Exemplo:
                </Text>
                <View style={s.exampleBox}>
                  <Text style={s.exampleText}>{EXAMPLE}</Text>
                </View>
              </View>
            </View>

            {/* Categoria */}
            <View style={{ marginBottom: 14 }}>
              <Text style={s.label}>Categoria (aplicada a todos)</Text>
              <Pressable onPress={() => setShowCatPicker(!showCatPicker)} style={s.catPicker}>
                <Icon name="tag" size={13} color={Colors.violet3} />
                <Text style={s.catPickerText}>{category}</Text>
                <Icon name={showCatPicker ? "chevron_up" : "chevron_down"} size={12} color={Colors.ink3} />
              </Pressable>
              {showCatPicker && (
                <View style={s.catList}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {allCategories.map(cat => (
                      <Pressable key={cat} onPress={() => { setCategory(cat); setShowCatPicker(false); }}
                        style={[s.catOption, category === cat && s.catOptionActive]}>
                        <Text style={[s.catOptionText, category === cat && { color: Colors.violet3, fontWeight: "700" }]}>{cat}</Text>
                        {category === cat && <Icon name="check" size={12} color={Colors.violet3} />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Textarea */}
            <View style={{ marginBottom: 12 }}>
              <Text style={s.label}>Produtos ({validRows.length} valido{validRows.length === 1 ? "" : "s"})</Text>
              <TextInput
                style={s.textarea}
                value={text}
                onChangeText={setText}
                placeholder={"Cole ou digite aqui...\n\n" + EXAMPLE}
                placeholderTextColor={Colors.ink3}
                multiline
                numberOfLines={Platform.OS === "web" ? 10 : 8}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Preview */}
            {parsed.length > 0 && (
              <View style={s.preview}>
                <View style={s.previewHeader}>
                  <Text style={s.previewTitle}>Preview ({parsed.length} linha{parsed.length === 1 ? "" : "s"})</Text>
                  {invalidCount > 0 && (
                    <Text style={s.previewWarning}>{invalidCount} invalida{invalidCount === 1 ? "" : "s"}</Text>
                  )}
                </View>
                {parsed.slice(0, 30).map((r, idx) => (
                  <View key={idx} style={[s.previewRow, !r.isValid && s.previewRowInvalid]}>
                    <Text style={s.previewIdx}>{idx + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.previewName} numberOfLines={1}>
                        {r.name || <Text style={{ color: Colors.red, fontStyle: "italic" as any }}>[sem nome]</Text>}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                        {r.price > 0 && <Text style={s.previewMeta}>R$ {r.price.toFixed(2).replace(".", ",")}</Text>}
                        {r.size && <Text style={s.previewMeta}>Tam: {r.size}</Text>}
                        {r.colorInput && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            {r.colorHex ? (
                              <View style={[s.colorDot, { backgroundColor: r.colorHex }]} />
                            ) : (
                              <View style={[s.colorDot, { borderWidth: 1, borderColor: Colors.amber, borderStyle: "dashed" as any }]} />
                            )}
                            <Text style={[s.previewMeta, !r.colorHex && { color: Colors.amber }]}>
                              {r.colorHex ? hexToName(r.colorHex) : r.colorInput + " (?)"}
                            </Text>
                          </View>
                        )}
                        {r.stock > 0 && <Text style={s.previewMeta}>{r.stock} un</Text>}
                      </View>
                    </View>
                    {!r.isValid && <Icon name="x" size={12} color={Colors.red} />}
                  </View>
                ))}
                {parsed.length > 30 && (
                  <Text style={s.previewMore}>+ {parsed.length - 30} mais...</Text>
                )}
              </View>
            )}

            {exceedsMax && (
              <View style={s.errorBanner}>
                <Icon name="alert" size={14} color={Colors.red} />
                <Text style={s.errorText}>Maximo de {MAX_ROWS} produtos por lote. Remova {validRows.length - MAX_ROWS} linha{validRows.length - MAX_ROWS === 1 ? "" : "s"}.</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable onPress={handleClose} disabled={mut.isPending} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSubmit}
              disabled={mut.isPending || validRows.length === 0 || exceedsMax}
              style={[s.submitBtn, (mut.isPending || validRows.length === 0 || exceedsMax) && { opacity: 0.5 }]}>
              {mut.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="plus" size={13} color="#fff" />
                  <Text style={s.submitText}>
                    Adicionar {validRows.length > 0 ? validRows.length : ""} produto{validRows.length === 1 ? "" : "s"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 16 },
  modal: { backgroundColor: Colors.bg2, borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90%", borderWidth: 1, borderColor: Colors.border, overflow: "hidden" as any },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 17, fontWeight: "800", color: Colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },

  infoBox: { flexDirection: "row", gap: 10, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  infoTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  infoText: { fontSize: 11, color: Colors.ink3, lineHeight: 15 },
  exampleBox: { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border },
  exampleText: { fontSize: 11, color: Colors.ink, fontFamily: Platform.OS === "web" ? "monospace" : undefined, lineHeight: 16 },

  label: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.4, marginBottom: 6 },
  catPicker: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  catPickerText: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600" },
  catList: { backgroundColor: Colors.bg3, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" as any },
  catOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catOptionActive: { backgroundColor: Colors.violetD },
  catOptionText: { fontSize: 12, color: Colors.ink },

  textarea: {
    backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: Colors.ink,
    minHeight: 140, fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    lineHeight: 18,
  },

  preview: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  previewTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.4 },
  previewWarning: { fontSize: 10, color: Colors.red, fontWeight: "700" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, marginBottom: 3, borderWidth: 1, borderColor: "transparent" },
  previewRowInvalid: { borderColor: Colors.red + "55", backgroundColor: Colors.redD },
  previewIdx: { fontSize: 10, color: Colors.ink3, fontWeight: "700", minWidth: 18 },
  previewName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  previewMeta: { fontSize: 10, color: Colors.ink3 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  previewMore: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" as any, marginTop: 4 },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.red + "33", marginBottom: 8 },
  errorText: { flex: 1, fontSize: 12, color: Colors.red, fontWeight: "600" },

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg3 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  submitBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11 },
  submitText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default QuickBatchProductsModal;
