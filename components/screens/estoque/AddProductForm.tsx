import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import { ProductVariationsSection } from "@/components/ProductVariationsSection";
import { ImageUploadSection } from "@/components/ImageUploadSection";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { useProductCategories } from "@/hooks/useProductCategories";
import type { Product } from "./types";
import { UNITS } from "./types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#1f2937", "#6b7280", "#92400e",
];

// Fix 7: helper para inicializar campo mascarado a partir de número
function amountToMask(n: number): string {
  return maskCurrency(String(Math.round(n * 100)));
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}{required && <Text style={{ color: Colors.red }}> *</Text>}</Text>
      {children}
    </View>
  );
}

export function AddProductForm({ categories, onSave, onCancel, editProduct }: {
  categories: string[];
  onSave: (p: Product) => void;
  onCancel: () => void;
  editProduct?: Product | null;
}) {
  const isEdit = !!editProduct;
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { categories: managedCategories } = useProductCategories();

  const mergedCategoryList = useMemo(() => {
    const managed = managedCategories.map(c => c.name);
    const managedSet = new Set(managed.map(n => n.toLowerCase()));
    const fromProducts = categories.filter(c => c && !managedSet.has(c.toLowerCase()));
    return [...managed, ...fromProducts];
  }, [managedCategories, categories]);

  const managedColorByName = useMemo(() => {
    const map: Record<string, string | null> = {};
    managedCategories.forEach(c => { map[c.name] = c.color; });
    return map;
  }, [managedCategories]);

  const [name, setName]         = useState(editProduct?.name || "");
  const [code, setCode]         = useState(editProduct?.code || "");
  const [barcode, setBarcode]   = useState(editProduct?.barcode || "");
  const [category, setCategory] = useState(editProduct?.category || mergedCategoryList[0] || "");
  // Fix 7: inicializa com máscara de moeda
  const [price, setPrice]       = useState(editProduct ? amountToMask(editProduct.price) : "");
  const [cost, setCost]         = useState(editProduct ? amountToMask(editProduct.cost) : "");
  const [stock, setStock]       = useState(editProduct ? String(editProduct.stock) : "");
  const [minStock, setMinStock] = useState(editProduct ? String(editProduct.minStock) : "");
  const [unit, setUnit]         = useState(editProduct?.unit || "un");
  const [notes, setNotes]       = useState(editProduct?.notes || "");
  const [color, setColor]       = useState(editProduct?.color || "");
  const [size, setSize]         = useState(editProduct?.size || "");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat]   = useState(false);

  // Fix 10: estoque sempre aberto no CREATE; no EDIT segue lógica anterior
  const initialShowStock = isEdit
    ? ((parseInt(editProduct?.stock as any) || 0) > 0 || (parseInt(editProduct?.minStock as any) || 0) > 0)
    : true;
  const [showStock, setShowStock] = useState(initialShowStock);

  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);

  useEffect(() => {
    if (!isEdit && !category && mergedCategoryList.length > 0) {
      setCategory(mergedCategoryList[0]);
    }
  }, [isEdit, category, mergedCategoryList]);

  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2 || !company?.id) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingDup(true);
      try {
        const res = await companiesApi.checkDuplicate(company.id, trimmed, editProduct?.id);
        setDuplicates(res.duplicates || []);
      } catch {
        setDuplicates([]);
      } finally {
        setCheckingDup(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [name, company?.id, editProduct?.id]);

  const { data: variationsData } = useQuery({
    queryKey: ["productVariations", company?.id, editProduct?.id],
    queryFn: () => {
      return import("@/services/productsVariationsApi").then(m =>
        m.productsVariationsApi.get(company!.id, editProduct!.id)
      );
    },
    enabled: isEdit && !!editProduct?.id && !!company?.id,
    staleTime: 30000,
  });
  const hasVariations = !!(variationsData && variationsData.mode !== "none");

  function generateCode() {
    const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "PRD";
    setCode(prefix + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"));
  }

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!price.trim()) { toast.error("Preencha o preco de venda"); return; }
    const finalCategory = showNewCat && newCategory.trim() ? newCategory.trim() : category;
    // Fix 7: parsear valores mascarados
    const parsedPrice = parseInt(unmaskNumber(price) || "0") / 100;
    const parsedCost  = parseInt(unmaskNumber(cost)  || "0") / 100;
    onSave({
      id: editProduct?.id || Date.now().toString(),
      name: name.trim(), code: code.trim() || "---", barcode: barcode.trim(),
      category: finalCategory || "Produtos",
      price: parsedPrice,
      cost: parsedCost,
      stock: parseInt(stock) || 0, minStock: parseInt(minStock) || 0,
      abc: editProduct?.abc || "C", sold30d: editProduct?.sold30d || 0,
      unit, brand: editProduct?.brand || "",
      notes: notes.trim(), color: color || "", size: size.trim(),
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{isEdit ? "Editar produto" : "Adicionar produto"}</Text>
        <Pressable onPress={onCancel} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
      </View>
      <Text style={s.hint}>Campos com * sao obrigatorios.</Text>

      <FormField label="Nome do produto" required>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Pomada modeladora" placeholderTextColor={Colors.ink3} />
      </FormField>

      {duplicates.length > 0 && (
        <View style={s.dupBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Text style={s.dupIcon}>!</Text>
            <Text style={s.dupTitle}>
              Voce ja tem {duplicates.length} produto{duplicates.length > 1 ? "s" : ""} com esse nome
            </Text>
          </View>
          <Text style={s.dupSub}>Podem ser variantes (cor/tamanho) do mesmo produto.</Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            {duplicates.slice(0, 5).map((d, i) => (
              <View key={d.id || i} style={s.dupRow}>
                {d.color && <View style={[s.dupColorDot, { backgroundColor: d.color }]} />}
                <Text style={s.dupRowText} numberOfLines={1}>
                  {d.color ? hexToName(d.color) : ""}{d.color && (d.size || d.barcode) ? " · " : ""}
                  {d.size ? "T: " + d.size : ""}{d.size && d.barcode ? " · " : ""}
                  {d.barcode ? d.barcode.slice(-8) : ""}
                </Text>
                <Text style={s.dupStock}>{d.stock_qty} un</Text>
              </View>
            ))}
            {duplicates.length > 5 && <Text style={s.dupMore}>+ {duplicates.length - 5} outros</Text>}
          </View>
          <Text style={s.dupHint}>
            Dica: depois de salvar, use a ferramenta &quot;Unificar duplicatas&quot; na tela de Estoque.
          </Text>
        </View>
      )}

      {isEdit && editProduct?.id && (
        <ImageUploadSection
          productId={editProduct.id}
          currentImageUrl={(editProduct as any)?.image_url || null}
          onImageChange={() => qc.invalidateQueries({ queryKey: ["products", company?.id] })}
        />
      )}

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Codigo interno">
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TextInput style={[s.input, { flex: 1 }]} value={code} onChangeText={setCode} placeholder="POM-001" placeholderTextColor={Colors.ink3} />
              <Pressable onPress={generateCode} style={s.miniBtn}><Text style={s.miniBtnText}>Gerar</Text></Pressable>
            </View>
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Unidade">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 4 }}>
              {UNITS.map(u => (
                <Pressable key={u} onPress={() => setUnit(u)} style={[s.chip, unit === u && s.chipActive]}>
                  <Text style={[s.chipText, unit === u && s.chipTextActive]}>{u}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </FormField>
        </View>
      </View>

      <FormField label="Categoria">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {mergedCategoryList.map(c => {
            const selected = category === c && !showNewCat;
            const chipColor = managedColorByName[c];
            return (
              <Pressable key={c} onPress={() => { setCategory(c); setShowNewCat(false); }} style={[s.chip, selected && s.chipActive]}>
                {chipColor ? <View style={[s.chipDot, { backgroundColor: chipColor }]} /> : null}
                <Text style={[s.chipText, selected && s.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setShowNewCat(true)} style={[s.chip, showNewCat && s.chipActive]}>
            <Text style={[s.chipText, showNewCat && s.chipTextActive]}>+ Nova</Text>
          </Pressable>
        </ScrollView>
        {showNewCat && <TextInput style={[s.input, { marginTop: 8 }]} value={newCategory} onChangeText={setNewCategory} placeholder="Nome da nova categoria" placeholderTextColor={Colors.ink3} autoFocus />}
        <Text style={s.categoryHint}>Gerencie suas categorias pelo botao &quot;Categorias&quot; na tela de Estoque.</Text>
      </FormField>

      <View style={s.divider} />

      {/* Fix 7: campos de preço/custo com máscara de moeda */}
      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Preco de venda" required>
            <TextInput
              style={s.input}
              value={price}
              onChangeText={v => setPrice(maskCurrency(v))}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
            />
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Custo">
            <TextInput
              style={s.input}
              value={cost}
              onChangeText={v => setCost(maskCurrency(v))}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
            />
          </FormField>
        </View>
      </View>

      {/* Fix 10: estoque aberto por padrão no create */}
      {!hasVariations && (
        <>
          <Pressable onPress={() => setShowStock(!showStock)} style={s.stockToggle}>
            <View style={{ flex: 1 }}>
              <Text style={s.stockToggleTitle}>Estoque {isEdit ? "" : "inicial (opcional)"}</Text>
              <Text style={s.stockToggleSub}>
                {showStock
                  ? "Informe a quantidade em maos e o nivel minimo para alertas."
                  : "Voce pode dar entrada de estoque depois, a qualquer momento."}
              </Text>
            </View>
            <Icon name={showStock ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
          </Pressable>

          {showStock && (
            <View style={s.row2}>
              <View style={{ flex: 1 }}><FormField label="Qtd. atual"><TextInput style={s.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></FormField></View>
              <View style={{ flex: 1 }}><FormField label="Estoque minimo"><TextInput style={s.input} value={minStock} onChangeText={setMinStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></FormField></View>
            </View>
          )}
        </>
      )}

      {hasVariations && (
        <View style={s.stockVariantHint}>
          <Icon name="info" size={13} color={Colors.violet3} />
          <Text style={s.stockVariantHintText}>
            Estoque controlado por variacoes abaixo. Total atual: {variationsData?.total_variants || 0} variantes.
          </Text>
        </View>
      )}

      <View style={s.divider} />

      {/* Fix 8: campo de cor usando <input type="color"> inline no web (não bloqueia) */}
      {!isEdit && (
        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <FormField label="Cor principal (opcional)">
              {Platform.OS === "web" ? (
                <View style={[s.colorRow, { position: "relative" as any }]}>
                  <View style={[s.colorSwatch, { backgroundColor: color || Colors.bg4, borderStyle: color ? "solid" : "dashed" }]} />
                  <Text style={[s.colorText, !color && { color: Colors.ink3 }]}>
                    {color ? (hexToName(color) + " · " + color) : "Toque para escolher"}
                  </Text>
                  {/* Input nativo de cor — cobre toda a área, opacity 0, sem bloquear */}
                  <input
                    type="color"
                    value={color || "#6d28d9"}
                    onChange={(e: any) => setColor(e.target.value)}
                    style={{
                      position: "absolute", inset: 0, opacity: 0,
                      cursor: "pointer", width: "100%", height: "100%", border: "none",
                    } as any}
                  />
                  {color && (
                    <Pressable onPress={(e: any) => { e?.stopPropagation?.(); setColor(""); }}
                      style={{ zIndex: 2 }}>
                      <Text style={{ fontSize: 11, color: Colors.red }}>Remover</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {PRESET_COLORS.map(c => (
                      <Pressable key={c} onPress={() => setColor(color === c ? "" : c)}
                        style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c, borderWidth: color === c ? 3 : 1.5, borderColor: color === c ? Colors.violet : Colors.border }} />
                    ))}
                  </View>
                  {color && <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 6 }}>{hexToName(color)} · {color}</Text>}
                </View>
              )}
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Tamanho (opcional)">
              <TextInput style={s.input} value={size} onChangeText={setSize} placeholder="P, M, G, 500ml..." placeholderTextColor={Colors.ink3} />
            </FormField>
          </View>
        </View>
      )}

      {/* Fix 10: aviso de variantes mais visível no create */}
      {!isEdit && (
        <View style={s.variantsHintBox}>
          <Icon name="layers" size={14} color={Colors.violet3} />
          <View style={{ flex: 1 }}>
            <Text style={s.variantsHintTitle}>Cores e tamanhos com estoque proprio</Text>
            <Text style={s.variantsHintDesc}>Salve o produto para liberar o cadastro de variantes com estoque individual por cor/tamanho.</Text>
          </View>
        </View>
      )}

      <BarcodeQRSection
        code={barcode}
        productName={name}
        price={parseInt(unmaskNumber(price) || "0") / 100}
        onCodeChange={setBarcode}
      />

      {isEdit && editProduct?.id && (
        <ProductVariationsSection
          productId={editProduct.id}
          productName={name}
        />
      )}

      <FormField label="Descricao (opcional)">
        <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes}
          placeholder="Detalhes do produto, composicao..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />
      </FormField>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}>
          <Text style={s.saveText}>{isEdit ? "Atualizar produto" : "Salvar produto"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  row2: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  categoryHint: { fontSize: 10, color: Colors.ink3, marginTop: 6, fontStyle: "italic" as any },
  miniBtn: { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  miniBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border },
  colorText: { fontSize: 12, color: Colors.ink, fontWeight: "500", flex: 1 },
  // Estoque colapsável
  stockToggle: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  stockToggleTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  stockToggleSub: { fontSize: 11, color: Colors.ink3, marginTop: 3, lineHeight: 15 },
  stockVariantHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border2, marginBottom: 10 },
  stockVariantHintText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 15, fontWeight: "500" },
  // Fix 10: aviso de variantes
  variantsHintBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  variantsHintTitle: { fontSize: 12, color: Colors.violet3, fontWeight: "700", marginBottom: 2 },
  variantsHintDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 15 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  // Duplicatas
  dupBanner: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    marginTop: -8,
  },
  dupIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#f59e0b", color: "#fff",
    fontSize: 13, fontWeight: "800", textAlign: "center", lineHeight: 22,
  },
  dupTitle: { fontSize: 13, fontWeight: "700", color: "#78350f", flex: 1 },
  dupSub: { fontSize: 11.5, color: "#92400e", lineHeight: 17 },
  dupRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  dupColorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  dupRowText: { fontSize: 11.5, color: "#78350f", flex: 1 },
  dupStock: { fontSize: 11, color: "#92400e", fontWeight: "600" },
  dupMore: { fontSize: 11, color: "#92400e", fontStyle: "italic", paddingLeft: 8 },
  dupHint: { fontSize: 11, color: "#78350f", marginTop: 10, fontStyle: "italic", lineHeight: 16 },
});

export default AddProductForm;
