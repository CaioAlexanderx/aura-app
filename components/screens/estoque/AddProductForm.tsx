// Extracted from estoque.tsx — FE-03 refactor
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// Props type (customize as needed)
interface AddProductFormProps {
  [key: string]: any;
}

export function AddProductForm({ categories, onSave, onCancel }: {
  categories: string[]; onSave: (p: Product) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState(categories[0] || "Produtos");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [unit, setUnit] = useState("un");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [barcodeMode, setBarcodeMode] = useState<"none" | "manual" | "generate">("none");
  const [formStep, setFormStep] = useState(0);
  const FORM_STEPS = ["Basico", "Precos", "Estoque", "Codigo", "Notas"];

  function generateBarcode() {
    const prefix = "789";
    const random = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
    setBarcode(prefix + random);
    setBarcodeMode("generate");
  }

  function generateCode() {
    const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "PRD";
    const num = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    setCode(prefix + "-" + num);
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Preencha o nome do produto"); return; }
    if (!price.trim()) { Alert.alert("Preencha o preco de venda"); return; }
    const finalCategory = showNewCat && newCategory.trim() ? newCategory.trim() : category;
    const product: Product = {
      id: Date.now().toString(),
      name: name.trim(),
      code: code.trim() || "---",
      barcode: barcode.trim(),
      category: finalCategory,
      price: parseFloat(price.replace(",", ".")) || 0,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 0,
      abc: "C",
      sold30d: 0,
      unit,
      brand: brand.trim(),
      notes: notes.trim(),
    };
    onSave(product);
  }

  return (
    <View style={af.container}>
      <View style={af.header}>
        <Text style={af.title}>Adicionar produto</Text>
        <Pressable onPress={onCancel} style={af.closeBtn}><Text style={af.closeText}>x</Text></Pressable>
      </View>
      <Text style={af.hint}>Preencha as informacoes do produto. Campos com * sao obrigatorios.</Text>

      {/* UX-03: Step indicator */}
      <View style={{ flexDirection: "row", gap: 4, marginVertical: 12, alignItems: "center" }}>
        {FORM_STEPS.map((step, i) => (
          <Pressable key={step} onPress={() => setFormStep(i)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: i === formStep ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i <= formStep ? Colors.violet : Colors.bg4, transition: "all 0.2s ease" } as any} />
            {i === formStep && <Text style={{ fontSize: 10, color: Colors.violet3, fontWeight: "600" }}>{step}</Text>}
          </Pressable>
        ))}
        <Text style={{ fontSize: 10, color: Colors.ink3, marginLeft: "auto" }}>{formStep + 1}/{FORM_STEPS.length}</Text>
      </View>

      <View style={af.divider} />
      <Text style={af.sectionTitle}>Informacoes basicas</Text>

      <FormField label="Nome do produto" required>
        <TextInput style={af.input} value={name} onChangeText={setName} placeholder="Ex: Pomada modeladora, Camisa polo M..." placeholderTextColor={Colors.ink3} />
      </FormField>

      <View style={af.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Codigo interno">
            <View style={af.inputRow}>
              <TextInput style={[af.input, { flex: 1 }]} value={code} onChangeText={setCode} placeholder="Ex: POM-001" placeholderTextColor={Colors.ink3} />
              <Pressable onPress={generateCode} style={af.miniBtn}><Text style={af.miniBtnText}>Gerar</Text></Pressable>
            </View>
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Unidade">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={af.unitRow}>
              {UNITS.map(u => (
                <Pressable key={u} onPress={() => setUnit(u)} style={[af.unitChip, unit === u && af.unitChipActive]}>
                  <Text style={[af.unitText, unit === u && af.unitTextActive]}>{u}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </FormField>
        </View>
      </View>

      <FormField label="Categoria">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={af.catRow}>
          {categories.map(c => (
            <Pressable key={c} onPress={() => { setCategory(c); setShowNewCat(false); }} style={[af.catChip, category === c && !showNewCat && af.catChipActive]}>
              <Text style={[af.catText, category === c && !showNewCat && af.catTextActive]}>{c}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowNewCat(true)} style={[af.catChip, showNewCat && af.catChipActive]}>
            <Text style={[af.catText, showNewCat && af.catTextActive]}>+ Nova</Text>
          </Pressable>
        </ScrollView>
        {showNewCat && (
          <TextInput style={[af.input, { marginTop: 8 }]} value={newCategory} onChangeText={setNewCategory} placeholder="Nome da nova categoria" placeholderTextColor={Colors.ink3} />
        )}
      </FormField>

      <FormField label="Marca (opcional)">
        <TextInput style={af.input} value={brand} onChangeText={setBrand} placeholder="Ex: Head&Shoulders, Nike..." placeholderTextColor={Colors.ink3} />
      </FormField>

      <View style={af.divider} />
      <Text style={af.sectionTitle}>Precos</Text>

      <View style={af.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Preco de venda" required>
            <TextInput style={af.input} value={price} onChangeText={setPrice} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Custo">
            <TextInput style={af.input} value={cost} onChangeText={setCost} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </FormField>
        </View>
      </View>
      {price && cost && parseFloat(price.replace(",",".")) > 0 && (
        <View style={af.marginPreview}>
          <Text style={af.marginLabel}>Margem estimada:</Text>
          <Text style={af.marginValue}>
            {(((parseFloat(price.replace(",",".")) - parseFloat(cost.replace(",","."))) / parseFloat(price.replace(",","."))) * 100).toFixed(0)}%
          </Text>
        </View>
      )}

      <View style={af.divider} />
      <Text style={af.sectionTitle}>Estoque</Text>

      <View style={af.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Quantidade atual">
            <TextInput style={af.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Estoque minimo">
            <TextInput style={af.input} value={minStock} onChangeText={setMinStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
          </FormField>
        </View>
      </View>

      <View style={af.divider} />
      <Text style={af.sectionTitle}>Codigo de barras / QR Code</Text>
      <Text style={af.sectionHint}>Gere um codigo para leitura no PDV ou insira o EAN do fabricante.</Text>

      <View style={af.barcodeActions}>
        <Pressable onPress={generateBarcode} style={[af.barcodeBtn, af.barcodeBtnPrimary]}>
          <Text style={af.barcodeBtnPrimaryText}>Gerar codigo de barras</Text>
        </Pressable>
        <Pressable onPress={() => setBarcodeMode("manual")} style={af.barcodeBtn}>
          <Text style={af.barcodeBtnText}>Digitar EAN manualmente</Text>
        </Pressable>
      </View>

      {(barcodeMode !== "none" || barcode) && (
        <View style={af.barcodeResult}>
          {barcodeMode === "generate" && barcode && (
            <View style={af.generatedCode}>
              <View style={af.barcodeBars}>
                {barcode.split("").map((d, i) => (
                  <View key={i} style={[af.bar, { width: parseInt(d) % 3 === 0 ? 3 : 2, opacity: parseInt(d) > 4 ? 1 : 0.5 }]} />
                ))}
              </View>
              <Text style={af.barcodeNum}>{barcode}</Text>
              <Text style={af.barcodeHint}>Codigo gerado - pronto para leitura no PDV</Text>
            </View>
          )}
          {(barcodeMode === "manual" || (barcodeMode === "none" && barcode)) && (
            <TextInput style={af.input} value={barcode} onChangeText={setBarcode} placeholder="Digite o EAN (ex: 7891000315507)" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
          )}
        </View>
      )}

      <View style={af.divider} />
      <FormField label="Observacoes (opcional)">
        <TextInput style={[af.input, af.textarea]} value={notes} onChangeText={setNotes} placeholder="Detalhes adicionais, variantes, tamanhos..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />
      </FormField>

      <View style={af.footer}>
        <Pressable onPress={onCancel} style={af.cancelBtn}><Text style={af.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={af.saveBtn}><Text style={af.saveText}>Salvar produto</Text></Pressable>
      </View>
    </View>
  );
}


