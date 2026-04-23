import { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  productsVariationsApi, matrixKey,
  type ColorEntry, type MatrixMap, type VariationsMode,
} from "@/services/productsVariationsApi";
import { hexToName, nameToHex } from "@/utils/colorNames";

// ============================================================
// AURA. -- ProductVariationsSection (reformulado)
//
// UX radicalmente simplificada:
//   [+ Cor]       [+ Tamanho]
//
// Ao adicionar cor OU tamanho, a tela revela grid de estoque.
// - Se so cor: lista "Azul: 5" "Preto: 3"
// - Se so tamanho: lista "P: 10" "M: 5"
// - Se ambos: matriz NxM com estoque por combinacao
//
// Preco unico do produto pai (nao ha preco por variante).
// ============================================================

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899",
  "#FFFFFF", "#1F2937", "#6B7280", "#92400E",
];

// ─── Modal inline para adicionar cor ───
function AddColorPopover({ onAdd, onCancel, existingHexes }: {
  onAdd: (color: ColorEntry) => void;
  onCancel: () => void;
  existingHexes: Set<string>;
}) {
  const [hex, setHex] = useState("#3B82F6");
  const [customInput, setCustomInput] = useState("");

  function tryAddFromInput() {
    const resolved = nameToHex(customInput.trim());
    if (resolved) {
      setHex(resolved);
      setCustomInput("");
    } else if (customInput.trim()) {
      toast.error('Cor "' + customInput + '" nao reconhecida. Use o seletor.');
    }
  }

  function confirm() {
    const normalizedHex = hex.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalizedHex)) {
      toast.error("Cor invalida");
      return;
    }
    if (existingHexes.has(normalizedHex)) {
      toast.error("Essa cor ja foi adicionada");
      return;
    }
    onAdd({ hex: normalizedHex, name: hexToName(normalizedHex) || null });
  }

  return (
    <View style={s.popover}>
      <Text style={s.popoverTitle}>Adicionar cor</Text>

      {/* Color picker preset */}
      <View style={s.colorGrid}>
        {PRESET_COLORS.map(c => (
          <Pressable key={c} onPress={() => setHex(c)}
            style={[s.colorPresetDot, { backgroundColor: c }, hex.toUpperCase() === c.toUpperCase() && s.colorPresetActive]} />
        ))}
      </View>

      {/* Picker web nativo */}
      {Platform.OS === "web" && (
        <View style={s.nativePickerRow}>
          <Text style={s.popoverLabel}>Ou escolha exata:</Text>
          <input
            type="color"
            value={hex}
            onChange={(e: any) => setHex(e.target.value.toUpperCase())}
            style={{
              width: 40, height: 32, borderRadius: 6, border: "1px solid #333",
              background: "transparent", cursor: "pointer", padding: 0,
            } as any}
          />
        </View>
      )}

      {/* Input por nome */}
      <View style={s.nameInputRow}>
        <TextInput
          style={s.popoverInput}
          value={customInput}
          onChangeText={setCustomInput}
          placeholder="Ou digite o nome: azul, rosa claro..."
          placeholderTextColor={Colors.ink3}
          onBlur={tryAddFromInput}
          onSubmitEditing={tryAddFromInput}
        />
      </View>

      {/* Preview */}
      <View style={s.previewRow}>
        <View style={[s.previewDot, { backgroundColor: hex }]} />
        <Text style={s.previewText}>{hexToName(hex)} \u00b7 {hex}</Text>
      </View>

      <View style={s.popoverActions}>
        <Pressable onPress={onCancel} style={s.popoverCancel}>
          <Text style={s.popoverCancelText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={confirm} style={s.popoverConfirm}>
          <Text style={s.popoverConfirmText}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Popover inline pra adicionar tamanho ───
function AddSizePopover({ onAdd, onCancel, existingSizes }: {
  onAdd: (size: string) => void;
  onCancel: () => void;
  existingSizes: Set<string>;
}) {
  const [value, setValue] = useState("");

  function confirm() {
    const trimmed = value.trim();
    if (!trimmed) { toast.error("Digite um tamanho"); return; }
    if (existingSizes.has(trimmed)) { toast.error("Tamanho ja adicionado"); return; }
    if (trimmed.length > 30) { toast.error("Maximo 30 caracteres"); return; }
    onAdd(trimmed);
  }

  return (
    <View style={s.popover}>
      <Text style={s.popoverTitle}>Adicionar tamanho</Text>
      <TextInput
        style={s.popoverInput}
        value={value}
        onChangeText={setValue}
        placeholder="Ex: P, M, G, 38, 500ml..."
        placeholderTextColor={Colors.ink3}
        autoFocus
        onSubmitEditing={confirm}
      />
      <View style={s.popoverActions}>
        <Pressable onPress={onCancel} style={s.popoverCancel}>
          <Text style={s.popoverCancelText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={confirm} style={s.popoverConfirm}>
          <Text style={s.popoverConfirmText}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Componente principal ───
type Props = {
  productId: string;
  productName: string;
};

export function ProductVariationsSection({ productId, productName }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  // Estado local (o que ta sendo editado)
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<MatrixMap>({});
  const [dirty, setDirty] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showSizePopover, setShowSizePopover] = useState(false);

  // Fetch inicial
  const { data, isLoading } = useQuery({
    queryKey: ["productVariations", company?.id, productId],
    queryFn: () => productsVariationsApi.get(company!.id, productId),
    enabled: !!company?.id && !!productId,
    staleTime: 30000,
  });

  // Hidrata o estado local ao carregar dados
  useEffect(() => {
    if (data) {
      setColors(data.colors || []);
      setSizes(data.sizes || []);
      setMatrix(data.matrix || {});
      setDirty(false);
    }
  }, [data]);

  const mode: VariationsMode = useMemo(() => {
    if (colors.length > 0 && sizes.length > 0) return 'matrix';
    if (colors.length > 0) return 'color';
    if (sizes.length > 0) return 'size';
    return 'none';
  }, [colors, sizes]);

  // Save mutation
  const saveMut = useMutation({
    mutationFn: () => productsVariationsApi.save(company!.id, productId, { colors, sizes, matrix }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["productVariations", company?.id, productId] });
      qc.invalidateQueries({ queryKey: ["products", company?.id] });
      toast.success(
        res.created_count === 0
          ? "Produto sem variacoes"
          : res.created_count + " variac" + (res.created_count === 1 ? "ao salva" : "oes salvas") + " \u00b7 total " + res.total_stock + " un"
      );
      setDirty(false);
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || err?.message || "Erro ao salvar variacoes");
    },
  });

  // Handlers
  function addColor(c: ColorEntry) {
    setColors([...colors, c]);
    setShowColorPopover(false);
    setDirty(true);
  }
  function removeColor(hex: string) {
    setColors(colors.filter(c => c.hex !== hex));
    // Remove entradas da matrix referentes a essa cor
    const newMatrix = { ...matrix };
    Object.keys(newMatrix).forEach(k => {
      if (k.startsWith(hex + '|') || k === hex + '|') delete newMatrix[k];
    });
    setMatrix(newMatrix);
    setDirty(true);
  }
  function addSize(s: string) {
    setSizes([...sizes, s]);
    setShowSizePopover(false);
    setDirty(true);
  }
  function removeSize(value: string) {
    setSizes(sizes.filter(s => s !== value));
    // Remove entradas da matrix referentes a esse tamanho
    const newMatrix = { ...matrix };
    Object.keys(newMatrix).forEach(k => {
      if (k.endsWith('|' + value)) delete newMatrix[k];
    });
    setMatrix(newMatrix);
    setDirty(true);
  }
  function updateStock(hex: string | null, size: string | null, value: string) {
    const n = parseInt(value) || 0;
    const key = matrixKey(hex, size);
    setMatrix({ ...matrix, [key]: n < 0 ? 0 : n });
    setDirty(true);
  }
  function stockAt(hex: string | null, size: string | null): string {
    const key = matrixKey(hex, size);
    const v = matrix[key];
    return v === undefined ? "" : String(v);
  }

  const existingHexSet = useMemo(() => new Set(colors.map(c => c.hex.toUpperCase())), [colors]);
  const existingSizeSet = useMemo(() => new Set(sizes), [sizes]);

  if (isLoading) {
    return (
      <View style={s.container}>
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 8 }}>Carregando variacoes...</Text>
        </View>
      </View>
    );
  }

  const totalStock = Object.values(matrix).reduce((acc, v) => acc + (v || 0), 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Cores e Tamanhos</Text>
          <Text style={s.subtitle}>
            {mode === 'none' && "Adicione cores ou tamanhos para cadastrar estoque por variacao."}
            {mode === 'color' && colors.length + " cor" + (colors.length === 1 ? "" : "es") + " \u00b7 total " + totalStock + " un"}
            {mode === 'size' && sizes.length + " tamanho" + (sizes.length === 1 ? "" : "s") + " \u00b7 total " + totalStock + " un"}
            {mode === 'matrix' && (colors.length * sizes.length) + " combinac" + ((colors.length * sizes.length) === 1 ? "ao" : "oes") + " \u00b7 total " + totalStock + " un"}
          </Text>
        </View>
      </View>

      {/* Cores */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>Cores</Text>
          {!showColorPopover && (
            <Pressable onPress={() => setShowColorPopover(true)} style={s.addPillBtn}>
              <Icon name="plus" size={11} color={Colors.violet3} />
              <Text style={s.addPillText}>Adicionar cor</Text>
            </Pressable>
          )}
        </View>

        <View style={s.chipsRow}>
          {colors.map(c => (
            <View key={c.hex} style={s.colorChip}>
              <View style={[s.colorChipDot, { backgroundColor: c.hex }]} />
              <Text style={s.colorChipText}>{c.name || hexToName(c.hex)}</Text>
              <Pressable onPress={() => removeColor(c.hex)} hitSlop={6} style={s.chipRemove}>
                <Icon name="x" size={10} color={Colors.ink3} />
              </Pressable>
            </View>
          ))}
          {colors.length === 0 && !showColorPopover && (
            <Text style={s.emptyHint}>Nenhuma cor. Clique em "Adicionar cor".</Text>
          )}
        </View>

        {showColorPopover && (
          <AddColorPopover
            onAdd={addColor}
            onCancel={() => setShowColorPopover(false)}
            existingHexes={existingHexSet}
          />
        )}
      </View>

      {/* Tamanhos */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>Tamanhos</Text>
          {!showSizePopover && (
            <Pressable onPress={() => setShowSizePopover(true)} style={s.addPillBtn}>
              <Icon name="plus" size={11} color={Colors.violet3} />
              <Text style={s.addPillText}>Adicionar tamanho</Text>
            </Pressable>
          )}
        </View>

        <View style={s.chipsRow}>
          {sizes.map(sz => (
            <View key={sz} style={s.sizeChip}>
              <Text style={s.sizeChipText}>{sz}</Text>
              <Pressable onPress={() => removeSize(sz)} hitSlop={6} style={s.chipRemove}>
                <Icon name="x" size={10} color={Colors.ink3} />
              </Pressable>
            </View>
          ))}
          {sizes.length === 0 && !showSizePopover && (
            <Text style={s.emptyHint}>Nenhum tamanho. Clique em "Adicionar tamanho".</Text>
          )}
        </View>

        {showSizePopover && (
          <AddSizePopover
            onAdd={addSize}
            onCancel={() => setShowSizePopover(false)}
            existingSizes={existingSizeSet}
          />
        )}
      </View>

      {/* Grid de estoque */}
      {mode !== 'none' && (
        <View style={s.stockBlock}>
          <Text style={s.stockLabel}>Estoque por variacao</Text>

          {mode === 'color' && (
            <View style={{ gap: 6 }}>
              {colors.map(c => (
                <View key={c.hex} style={s.stockRow}>
                  <View style={[s.stockRowDot, { backgroundColor: c.hex }]} />
                  <Text style={s.stockRowLabel}>{c.name || hexToName(c.hex)}</Text>
                  <TextInput
                    style={s.stockInput}
                    value={stockAt(c.hex, null)}
                    onChangeText={v => updateStock(c.hex, null, v)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.ink3}
                  />
                  <Text style={s.stockUnit}>un</Text>
                </View>
              ))}
            </View>
          )}

          {mode === 'size' && (
            <View style={{ gap: 6 }}>
              {sizes.map(sz => (
                <View key={sz} style={s.stockRow}>
                  <View style={[s.stockRowDot, { backgroundColor: Colors.violet }]} />
                  <Text style={s.stockRowLabel}>{sz}</Text>
                  <TextInput
                    style={s.stockInput}
                    value={stockAt(null, sz)}
                    onChangeText={v => updateStock(null, sz, v)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.ink3}
                  />
                  <Text style={s.stockUnit}>un</Text>
                </View>
              ))}
            </View>
          )}

          {mode === 'matrix' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* Header da tabela: linha com tamanhos */}
                <View style={s.matrixRow}>
                  <View style={[s.matrixCellHeader, { width: 110 }]}>
                    <Text style={s.matrixHeaderText}>Cor \\ Tamanho</Text>
                  </View>
                  {sizes.map(sz => (
                    <View key={sz} style={s.matrixCellHeader}>
                      <Text style={s.matrixHeaderText}>{sz}</Text>
                    </View>
                  ))}
                </View>
                {/* Linhas: 1 por cor */}
                {colors.map(c => (
                  <View key={c.hex} style={s.matrixRow}>
                    <View style={[s.matrixCellHeader, s.matrixCellHeaderRow, { width: 110 }]}>
                      <View style={[s.matrixColorDot, { backgroundColor: c.hex }]} />
                      <Text style={s.matrixRowLabel} numberOfLines={1}>{c.name || hexToName(c.hex)}</Text>
                    </View>
                    {sizes.map(sz => (
                      <View key={sz} style={s.matrixCell}>
                        <TextInput
                          style={s.matrixInput}
                          value={stockAt(c.hex, sz)}
                          onChangeText={v => updateStock(c.hex, sz, v)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.ink3}
                          selectTextOnFocus
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* Botao salvar */}
      {dirty && (
        <View style={s.saveBar}>
          <Text style={s.saveHint}>
            {mode === 'none' ? "As variacoes serao removidas." : "Alteracoes nao salvas"}
          </Text>
          <Pressable onPress={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            style={[s.saveBtn, saveMut.isPending && { opacity: 0.6 }]}>
            {saveMut.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={12} color="#fff" />
                <Text style={s.saveBtnText}>Salvar variacoes</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 3, lineHeight: 15 },

  sectionBlock: { marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.5 },
  addPillBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  addPillText: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  emptyHint: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" as any },
  colorChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  colorChipDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  colorChipText: { fontSize: 11, color: Colors.ink, fontWeight: "500" },
  sizeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  sizeChipText: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  chipRemove: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },

  // Popover
  popover: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginTop: 8 },
  popoverTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  popoverLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  popoverInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: Colors.ink },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  colorPresetDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.border },
  colorPresetActive: { borderWidth: 3, borderColor: Colors.violet },
  nativePickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  nameInputRow: { marginBottom: 10 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  previewDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  previewText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  popoverActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  popoverCancel: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: Colors.border },
  popoverCancelText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  popoverConfirm: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 7, backgroundColor: Colors.violet },
  popoverConfirmText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  // Stock grid
  stockBlock: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  stockLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.5, marginBottom: 8 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  stockRowDot: { width: 14, height: 14, borderRadius: 7 },
  stockRowLabel: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },
  stockInput: { width: 70, backgroundColor: Colors.bg4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: Colors.ink, textAlign: "right", fontWeight: "600" },
  stockUnit: { fontSize: 10, color: Colors.ink3, fontWeight: "600", width: 24 },

  // Matrix
  matrixRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  matrixCellHeader: { width: 70, height: 34, borderRadius: 6, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  matrixCellHeaderRow: { flexDirection: "row", gap: 4, paddingHorizontal: 6 },
  matrixHeaderText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },
  matrixColorDot: { width: 10, height: 10, borderRadius: 5 },
  matrixRowLabel: { fontSize: 10, color: Colors.ink, fontWeight: "600", flex: 1 },
  matrixCell: { width: 70, height: 34 },
  matrixInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, fontSize: 12, color: Colors.ink, textAlign: "center", fontWeight: "600" },

  // Save bar
  saveBar: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  saveHint: { flex: 1, fontSize: 11, color: Colors.amber, fontWeight: "600" },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  saveBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default ProductVariationsSection;
