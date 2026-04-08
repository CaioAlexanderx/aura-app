import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import type { Product } from "./types";
import { UNITS } from "./types";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <View style={{ marginBottom: 16 }}><Text style={s.label}>{label}{required && <Text style={{ color: Colors.red }}> *</Text>}</Text>{children}</View>;
}

export function AddProductForm({ categories, onSave, onCancel }: { categories: string[]; onSave: (p: Product) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState(categories[0] || "Produtos");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [unit, setUnit] = useState("un");
  const [notes, setNotes] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  function generateCode() {
    const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "PRD";
    setCode(prefix + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"));
  }

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!price.trim()) { toast.error("Preencha o preco de venda"); return; }
    const finalCategory = showNewCat && newCategory.trim() ? newCategory.trim() : category;
    onSave({
      id: Date.now().toString(), name: name.trim(), code: code.trim() || "---", barcode: barcode.trim(),
      category: finalCategory, price: parseFloat(price.replace(",", ".")) || 0, cost: parseFloat(cost.replace(",", ".")) || 0,
      stock: parseInt(stock) || 0, minStock: parseInt(minStock) || 0, abc: "C", sold30d: 0, unit, brand: "", notes: notes.trim(),
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Adicionar produto</Text>
        <Pressable onPress={onCancel} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
      </View>
      <Text style={s.hint}>Campos com * sao obrigatorios.</Text>

      <FormField label="Nome do produto" required>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Pomada modeladora" placeholderTextColor={Colors.ink3} />
      </FormField>

      <View style={s.row2}>
        <View style={{ flex: 1 }}><FormField label="Codigo interno">
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TextInput style={[s.input, { flex: 1 }]} value={code} onChangeText={setCode} placeholder="POM-001" placeholderTextColor={Colors.ink3} />
            <Pressable onPress={generateCode} style={s.miniBtn}><Text style={s.miniBtnText}>Gerar</Text></Pressable>
          </View>
        </FormField></View>
        <View style={{ flex: 1 }}><FormField label="Unidade">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 4 }}>
            {UNITS.map(u => <Pressable key={u} onPress={() => setUnit(u)} style={[s.chip, unit === u && s.chipActive]}><Text style={[s.chipText, unit === u && s.chipTextActive]}>{u}</Text></Pressable>)}
          </ScrollView>
        </FormField></View>
      </View>

      <FormField label="Categoria">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {categories.map(c => <Pressable key={c} onPress={() => { setCategory(c); setShowNewCat(false); }} style={[s.chip, category === c && !showNewCat && s.chipActive]}><Text style={[s.chipText, category === c && !showNewCat && s.chipTextActive]}>{c}</Text></Pressable>)}
          <Pressable onPress={() => setShowNewCat(true)} style={[s.chip, showNewCat && s.chipActive]}><Text style={[s.chipText, showNewCat && s.chipTextActive]}>+ Nova</Text></Pressable>
        </ScrollView>
        {showNewCat && <TextInput style={[s.input, { marginTop: 8 }]} value={newCategory} onChangeText={setNewCategory} placeholder="Nome da nova categoria" placeholderTextColor={Colors.ink3} />}
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

      <FormField label="Codigo de barras (opcional)">
        <TextInput style={s.input} value={barcode} onChangeText={setBarcode} placeholder="EAN: 7891000315507" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
      </FormField>

      <FormField label="Observacoes (opcional)">
        <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Detalhes, variantes..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />
      </FormField>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}><Text style={s.saveText}>Salvar produto</Text></Pressable>
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
