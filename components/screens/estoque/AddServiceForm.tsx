// ============================================================
// AURA. — AddServiceForm (simplified form for services)
// No stock, no barcode, no color/size — just name, price, description
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import type { Product } from "./types";

type Props = {
  categories: string[];
  onSave: (p: Product) => void;
  onCancel: () => void;
};

export function AddServiceForm({ categories, onSave, onCancel }: Props) {
  var [name, setName] = useState("");
  var [price, setPrice] = useState("");
  var [cost, setCost] = useState("");
  var [notes, setNotes] = useState("");
  var [duration, setDuration] = useState("");

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome do servico"); return; }
    if (!price.trim()) { toast.error("Preencha o preco do servico"); return; }
    onSave({
      id: Date.now().toString(),
      name: name.trim(),
      code: "SRV-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"),
      barcode: "",
      category: "Servicos",
      price: parseFloat(price.replace(",", ".")) || 0,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      stock: 0,
      minStock: 0,
      abc: "C",
      sold30d: 0,
      unit: "srv",
      brand: "",
      notes: (duration ? "Duracao: " + duration + "min. " : "") + notes.trim(),
      color: "",
      size: "",
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.iconWrap}>
            <Icon name="star" size={16} color={Colors.violet3} />
          </View>
          <Text style={s.title}>Adicionar servico</Text>
        </View>
        <Pressable onPress={onCancel} style={s.closeBtn}>
          <Text style={s.closeText}>x</Text>
        </Pressable>
      </View>

      <Text style={s.hint}>Servicos nao controlam estoque. Ideal para manicure, corte, consultoria, etc.</Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={s.label}>Nome do servico <Text style={{ color: Colors.red }}>*</Text></Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Corte feminino, Design de sobrancelha..." placeholderTextColor={Colors.ink3} autoFocus />
      </View>

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Preco <Text style={{ color: Colors.red }}>*</Text></Text>
          <TextInput style={s.input} value={price} onChangeText={setPrice} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Custo (opcional)</Text>
          <TextInput style={s.input} value={cost} onChangeText={setCost} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Duracao (min)</Text>
          <TextInput style={s.input} value={duration} onChangeText={setDuration} placeholder="30" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
        </View>
      </View>

      <View style={{ marginBottom: 16, marginTop: 16 }}>
        <Text style={s.label}>Descricao (opcional)</Text>
        <TextInput style={[s.input, { minHeight: 60, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Detalhes do servico..." placeholderTextColor={Colors.ink3} multiline numberOfLines={2} />
      </View>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}>
          <Icon name="check" size={14} color="#fff" />
          <Text style={s.saveText}>Salvar servico</Text>
        </Pressable>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  title: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink } as any,
  row2: { flexDirection: "row", gap: 12 } as any,
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default AddServiceForm;
