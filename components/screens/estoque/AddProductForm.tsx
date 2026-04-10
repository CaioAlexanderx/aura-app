import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import type { Product } from "./types";
import { UNITS } from "./types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <View style={{ marginBottom: 16 }}><Text style={s.label}>{label}{required && <Text style={{ color: Colors.red }}> *</Text>}</Text>{children}</View>;
}

function isValidHex(v: string) { return /^#[0-9A-Fa-f]{6}$/.test(v); }

export function AddProductForm({ categories, onSave, onCancel, editProduct }: {
  categories: string[]; onSave: (p: Product) => void; onCancel: () => void; editProduct?: Product | null;
}) {
  const isEdit = !!editProduct;
  const [name, setName] = useState(editProduct?.name || "");
  const [code, setCode] = useState(editProduct?.code || "");
  const [barcode, setBarcode] = useState(editProduct?.barcode || "");
  const [category, setCategory] = useState(editProduct?.category || categories[0] || "");
  const [price, setPrice] = useState(editProduct ? String(editProduct.price) : "");
  const [cost, setCost] = useState(editProduct ? String(editProduct.cost) : "");
  const [stock, setStock] = useState(editProduct ? String(editProduct.stock) : "");
  const [minStock, setMinStock] = useState(editProduct ? String(editProduct.minStock) : "");
  const [unit, setUnit] = useState(editProduct?.unit || "un");
  const [notes, setNotes] = useState(editProduct?.notes || "");
  const [color, setColor] = useState(editProduct?.color || "");
  const [size, setSize] = useState(editProduct?.size || "");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  function handleColorChange(v: string) {
    const val = v.startsWith("#") ? v : "#" + v;
    setColor(val.slice(0, 7));
  }

  function generateCode() {
    const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "PRD";
    setCode(prefix + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"));
  }

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!price.trim()) { toast.error("Preencha o preco de venda"); return; }
    const finalCategory = showNewCat && newCategory.trim() ? newCategory.trim() : category;
    onSave({
      id: editProduct?.id || Date.now().toString(),
      name: name.trim(), code: code.trim() || "---", barcode: barcode.trim(),
      category: finalCategory || "Produtos",
      price: parseFloat(price.replace(",", ".")) || 0,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      stock: parseInt(stock) || 0, minStock: parseInt(minStock) || 0,
      abc: editProduct?.abc || "C", sold30d: editProduct?.sold30d || 0,
      unit, brand: editProduct?.brand || "", notes: notes.trim(),
      color: isValidHex(color) ? color : "",
      size: size.trim(),
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
              {UNITS.map(u => <Pressable key={u} onPress={() => setUnit(u)} style={[s.chip, unit === u && s.chipActive]}><Text style={[s.chipText, unit === u && s.chipTextActive]}>{u}</Text></Pressable>)}
            </ScrollView>
          </FormField>
        </View>
      </View>

      <FormField label="Categoria">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {categories.map(c => <Pressable key={c} onPress={() => { setCategory(c); setShowNewCat(false); }} style={[s.chip, category === c && !showNewCat && s.chipActive]}><Text style={[s.chipText, category === c && !showNewCat && s.chipTextActive]}>{c}</Text></Pressable>)}
          <Pressable onPress={() => setShowNewCat(true)} style={[s.chip, showNewCat && s.chipActive]}><Text style={[s.chipText, showNewCat && s.chipTextActive]}>+ Nova categoria</Text></Pressable>
        </ScrollView>
        {showNewCat && <TextInput style={[s.input, { marginTop: 8 }]} value={newCategory} onChangeText={setNewCategory} placeholder="Nome da nova categoria" placeholderTextColor={Colors.ink3} autoFocus />}
      </FormField>

      <View style={s.divider} />

      <View style={s.row2}>
        <View style={{ flex: 1 }}><FormField label="Preco de venda" required><TextInput style={s.input} value={price} onChangeText={setPrice} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></FormField></View>
        <View style={{ flex: 1 }}><FormField label="Custo"><TextInput style={s.input} value={cost} onChangeText={setCost} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></FormField></View>
      </View>

      <View style={s.row2}>
        <View style={{ flex: 1 }}><FormField label="Quantidade atual"><TextInput style={s.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></FormField></View>
        <View style={{ flex: 1 }}><FormField label="Estoque minimo"><TextInput style={s.input} value={minStock} onChangeText={setMinStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></FormField></View>
      </View>

      <View style={s.divider} />

      {/* P1-8: Cor e Tamanho */}
      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Cor (hexadecimal)">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={color}
                onChangeText={handleColorChange}
                placeholder="#FFFFFF"
                placeholderTextColor={Colors.ink3}
                maxLength={7}
                autoCapitalize="none"
              />
              {isValidHex(color) ? (
                <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: color, borderWidth: 1, borderColor: Colors.border }} />
              ) : (
                <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 10, color: Colors.ink3 }}>Cor</Text>
                </View>
              )}
            </View>
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Tamanho">
            <TextInput style={s.input} value={size} onChangeText={setSize} placeholder="P, M, G, 500ml..." placeholderTextColor={Colors.ink3} />
          </FormField>
        </View>
      </View>

      <BarcodeQRSection
        code={barcode}
        productName={name}
        price={parseFloat(price.replace(",", ".")) || 0}
        onCodeChange={setBarcode}
      />

      <FormField label="Descricao (opcional)">
        <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Detalhes do produto, composicao, instrucoes..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />
      </FormField>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}><Text style={s.saveText}>{isEdit ? "Atualizar produto" : "Salvar produto"}</Text></Pressable>
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
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  miniBtn: { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  miniBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default AddProductForm;
