// ============================================================
// AURA. — AddServiceForm
// Formulario simplificado para cadastrar servicos no estoque
// Sem campos de estoque, barcode, cor, tamanho.
// Salva com unit='srv' para diferenciar de produtos fisicos.
// Integra categorias gerenciadas (type='service').
// Aceita onOpenCategories opcional: botao "Gerenciar" inline
// que dispara abertura do CategoriesModal no parent com
// initialType='service' (travado).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { useProductCategories } from "@/hooks/useProductCategories";
import type { Product } from "./types";

var IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

export function AddServiceForm({ onSave, onCancel, onOpenCategories }: {
  onSave: (p: Product) => void;
  onCancel: () => void;
  onOpenCategories?: () => void;
}) {
  var { categories: managedServiceCategories } = useProductCategories("service");

  // Lista de chips: categorias cadastradas do tipo servico, sempre com "Servicos" como fallback
  var chipList = useMemo(() => {
    var names = managedServiceCategories.map(function(c) { return c.name; });
    var set = new Set(names.map(function(n) { return n.toLowerCase(); }));
    if (!set.has("servicos")) names.push("Servicos");
    return names;
  }, [managedServiceCategories]);

  var colorByName = useMemo(() => {
    var map: Record<string, string | null> = {};
    managedServiceCategories.forEach(function(c) { map[c.name] = c.color; });
    return map;
  }, [managedServiceCategories]);

  var [name, setName] = useState("");
  var [price, setPrice] = useState("");
  var [cost, setCost] = useState("");
  var [notes, setNotes] = useState("");
  var [duration, setDuration] = useState("");
  var [category, setCategory] = useState<string>("");
  var [newCategory, setNewCategory] = useState("");
  var [showNewCat, setShowNewCat] = useState(false);

  // Quando as categorias chegam e nada esta selecionado, seleciona a primeira
  useEffect(function() {
    if (!category && chipList.length > 0) {
      setCategory(chipList[0]);
    }
  }, [chipList, category]);

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome do servico"); return; }
    if (!price.trim()) { toast.error("Preencha o preco do servico"); return; }
    var desc = notes.trim();
    if (duration.trim()) desc = (desc ? desc + " | " : "") + "Duracao: " + duration.trim();

    var finalCategory = showNewCat && newCategory.trim() ? newCategory.trim() : (category || "Servicos");

    onSave({
      id: Date.now().toString(),
      name: name.trim(),
      code: "SRV-" + String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0"),
      barcode: "",
      category: finalCategory,
      price: parseFloat(price.replace(",", ".")) || 0,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      stock: 0,
      minStock: 0,
      abc: "C",
      sold30d: 0,
      unit: "srv",
      brand: "",
      notes: desc,
      color: "",
      size: "",
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.iconWrap}><Icon name="star" size={16} color={Colors.violet3} /></View>
          <Text style={s.title}>Novo servico</Text>
        </View>
        <Pressable onPress={onCancel} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
      </View>
      <Text style={s.hint}>Servicos nao possuem estoque e sao vendidos diretamente no Caixa.</Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={s.label}>Nome do servico <Text style={{ color: Colors.red }}>*</Text></Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Corte feminino, Manicure, Consultoria..." placeholderTextColor={Colors.ink3} autoFocus />
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
      </View>

      <View style={{ marginBottom: 16, marginTop: 16 }}>
        <View style={s.categoryLabelRow}>
          <Text style={s.label}>Categoria</Text>
          {onOpenCategories && (
            <Pressable onPress={onOpenCategories} style={s.manageBtn} hitSlop={6}>
              <Text style={s.manageBtnText}>Gerenciar</Text>
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
          {chipList.map(function(c) {
            var selected = category === c && !showNewCat;
            var chipColor = colorByName[c];
            return (
              <Pressable
                key={c}
                onPress={function() { setCategory(c); setShowNewCat(false); }}
                style={[s.chip, selected && s.chipActive]}
              >
                {chipColor ? <View style={[s.chipDot, { backgroundColor: chipColor }]} /> : null}
                <Text style={[s.chipText, selected && s.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={function() { setShowNewCat(true); }} style={[s.chip, showNewCat && s.chipActive]}>
            <Text style={[s.chipText, showNewCat && s.chipTextActive]}>+ Nova</Text>
          </Pressable>
        </ScrollView>
        {showNewCat && (
          <TextInput
            style={[s.input, { marginTop: 8 }]}
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="Nome da nova categoria"
            placeholderTextColor={Colors.ink3}
            autoFocus
          />
        )}
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={s.label}>Duracao estimada (opcional)</Text>
        <TextInput style={s.input} value={duration} onChangeText={setDuration} placeholder="Ex: 45 min, 1h30, 2 horas" placeholderTextColor={Colors.ink3} />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={s.label}>Descricao (opcional)</Text>
        <TextInput style={[s.input, { minHeight: 60, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Detalhes do servico..." placeholderTextColor={Colors.ink3} multiline numberOfLines={2} />
      </View>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
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
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  row2: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 16 },
  categoryLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  manageBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  manageBtnText: { fontSize: 10, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.3 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default AddServiceForm;
