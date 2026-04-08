import { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { AgentBanner } from "@/components/AgentBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ── Mock Data ────────────────────────────────────────────────

const INITIAL_PRODUCTS = [
  { id: "1", name: "Pomada Modeladora", code: "POM-001", barcode: "7891000315507", category: "Produtos", price: 35.90, cost: 18.50, stock: 24, minStock: 10, abc: "A" as const, sold30d: 42, unit: "un", brand: "", notes: "" },
  { id: "2", name: "Shampoo Anticaspa", code: "SHA-001", barcode: "7891000428901", category: "Produtos", price: 28.50, cost: 14.20, stock: 18, minStock: 8, abc: "A" as const, sold30d: 38, unit: "un", brand: "Head&Shoulders", notes: "" },
  { id: "3", name: "Oleo para Barba", code: "OLE-001", barcode: "", category: "Produtos", price: 42.00, cost: 22.00, stock: 12, minStock: 5, abc: "A" as const, sold30d: 29, unit: "un", brand: "", notes: "" },
  { id: "4", name: "Cera Capilar", code: "CER-001", barcode: "7891000532104", category: "Produtos", price: 32.90, cost: 16.80, stock: 15, minStock: 8, abc: "B" as const, sold30d: 18, unit: "un", brand: "", notes: "" },
  { id: "5", name: "Cerveja Artesanal", code: "CER-002", barcode: "7891000667802", category: "Bebidas", price: 14.00, cost: 7.50, stock: 36, minStock: 20, abc: "B" as const, sold30d: 15, unit: "un", brand: "", notes: "" },
  { id: "6", name: "Condicionador Premium", code: "CON-001", barcode: "", category: "Produtos", price: 38.00, cost: 19.00, stock: 3, minStock: 5, abc: "B" as const, sold30d: 12, unit: "un", brand: "", notes: "" },
  { id: "7", name: "Gel Fixador", code: "GEL-001", barcode: "", category: "Produtos", price: 22.90, cost: 11.00, stock: 8, minStock: 10, abc: "C" as const, sold30d: 6, unit: "un", brand: "", notes: "" },
  { id: "8", name: "Toalha Descartavel", code: "TOA-001", barcode: "", category: "Consumiveis", price: 0.50, cost: 0.15, stock: 200, minStock: 100, abc: "C" as const, sold30d: 4, unit: "pct", brand: "", notes: "" },
  { id: "9", name: "Lamina Descartavel", code: "LAM-001", barcode: "", category: "Consumiveis", price: 1.20, cost: 0.40, stock: 150, minStock: 50, abc: "C" as const, sold30d: 3, unit: "cx", brand: "", notes: "" },
  { id: "10", name: "Pos-Barba Premium", code: "POS-001", barcode: "", category: "Produtos", price: 48.00, cost: 25.00, stock: 2, minStock: 5, abc: "B" as const, sold30d: 10, unit: "un", brand: "", notes: "" },
];

type Product = typeof INITIAL_PRODUCTS[0];
const TABS = ["Produtos", "Curva ABC", "Alertas"];
const UNITS = ["un", "pct", "cx", "kg", "g", "ml", "L", "par", "kit"];
const DEFAULT_CATEGORIES = ["Produtos", "Servicos", "Bebidas", "Consumiveis", "Equipamentos", "Materiais", "Roupas", "Acessorios"];

// ── Shared Components ────────────────────────────────────────

function SummaryCard({ label, value, color, sub, onPress }: { label: string; value: string; color?: string; sub?: string; onPress?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        smS.card,
        hovered && { transform: [{ translateY: -2 }], borderColor: Colors.border2 },
        onPress && hovered && { borderColor: Colors.violet2 },
        isWeb && { transition: "all 0.2s ease", cursor: onPress ? "pointer" : "default" } as any,
      ]}
    >
      <Text style={smS.label}>{label}</Text>
      <Text style={[smS.value, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={[smS.sub, onPress && hovered && { color: Colors.violet3 }]}>{sub}</Text>}
    </Pressable>
  );
}
const smS = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  value: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
});

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tbS.scroll} contentContainerStyle={tbS.row}>
      {TABS.map((tab, i) => (
        <Pressable key={tab} onPress={() => onSelect(i)} style={[tbS.tab, active === i && tbS.tabActive]}>
          <Text style={[tbS.label, active === i && tbS.labelActive]}>{tab}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const tbS = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 20 },
  row: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: "#fff", fontWeight: "600" },
});

function AbcBadge({ abc }: { abc: "A" | "B" | "C" }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return (<View style={[abS.badge, { backgroundColor: bgs[abc] }]}><Text style={[abS.text, { color: colors[abc] }]}>{abc}</Text></View>);
}
const abS = StyleSheet.create({
  badge: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 12, fontWeight: "800" },
});

// ── Form Field ───────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={ff.field}>
      <Text style={ff.label}>{label}{required && <Text style={ff.req}> *</Text>}</Text>
      {children}
    </View>
  );
}
const ff = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  req: { color: Colors.red },
});

// ── Add Product Form ─────────────────────────────────────────

function AddProductForm({ categories, onSave, onCancel }: {
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
    if (!name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!price.trim()) { toast.error("Preencha o preco de venda"); return; }
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
const af = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, marginBottom: 8 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  sectionTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  sectionHint: { fontSize: 11, color: Colors.ink3, marginBottom: 12 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  textarea: { minHeight: 70, textAlignVertical: "top" },
  row2: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0 },
  inputRow: { flexDirection: "row", gap: 6 },
  miniBtn: { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  miniBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  unitRow: { flexDirection: "row", gap: 4 },
  unitChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  unitChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  unitText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  unitTextActive: { color: Colors.violet3, fontWeight: "600" },
  catRow: { flexDirection: "row", gap: 6 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catTextActive: { color: Colors.violet3, fontWeight: "600" },
  marginPreview: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: Colors.greenD, borderRadius: 8, padding: 10, marginBottom: 8 },
  marginLabel: { fontSize: 11, color: Colors.green },
  marginValue: { fontSize: 14, color: Colors.green, fontWeight: "800" },
  barcodeActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  barcodeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  barcodeBtnPrimary: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  barcodeBtnText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  barcodeBtnPrimaryText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  barcodeResult: { marginBottom: 8 },
  generatedCode: { alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: Colors.border },
  barcodeBars: { flexDirection: "row", gap: 1, height: 50, alignItems: "flex-end" },
  bar: { backgroundColor: Colors.ink, height: "100%", borderRadius: 1 },
  barcodeNum: { fontSize: 14, color: Colors.ink, fontWeight: "600", letterSpacing: 2 },
  barcodeHint: { fontSize: 10, color: Colors.green, fontWeight: "500" },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

// ── Product Row ──────────────────────────────────────────────

function ProductRow({ product, showAbc, onDelete }: { product: Product; showAbc?: boolean; onDelete?: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isWeb = Platform.OS === "web";
  const isLow = product.stock <= product.minStock;
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100).toFixed(0) : "0";
  const stockValue = product.stock * product.cost;

  return (
    <View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        onHoverIn={isWeb ? () => setHovered(true) : undefined}
        onHoverOut={isWeb ? () => setHovered(false) : undefined}
        style={[pr.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}
      >
        <View style={pr.left}>
          {showAbc && <AbcBadge abc={product.abc} />}
          <View style={pr.info}>
            <Text style={pr.name}>{product.name}</Text>
            <Text style={pr.meta}>{product.code} / {product.category}{product.barcode ? " / EAN" : ""}</Text>
          </View>
        </View>
        <View style={pr.right}>
          <View style={pr.stockRow}>
            <Text style={[pr.stock, isLow && { color: Colors.red }]}>{product.stock} {product.unit}</Text>
            {isLow && <View style={pr.alertDot} />}
          </View>
          <Text style={pr.price}>{fmt(product.price)}</Text>
        </View>
      </Pressable>
      {expanded && (
        <View style={pr.detail}>
          <View style={pr.detailGrid}>
            <View style={pr.detailItem}><Text style={pr.detailLabel}>Custo</Text><Text style={pr.detailValue}>{fmt(product.cost)}</Text></View>
            <View style={pr.detailItem}><Text style={pr.detailLabel}>Margem</Text><Text style={[pr.detailValue, { color: Colors.green }]}>{margin}%</Text></View>
            <View style={pr.detailItem}><Text style={pr.detailLabel}>Vendidos (30d)</Text><Text style={pr.detailValue}>{product.sold30d}</Text></View>
            <View style={pr.detailItem}><Text style={pr.detailLabel}>Valor estoque</Text><Text style={pr.detailValue}>{fmt(stockValue)}</Text></View>
            <View style={pr.detailItem}><Text style={pr.detailLabel}>Estoque minimo</Text><Text style={pr.detailValue}>{product.minStock} {product.unit}</Text></View>
            <View style={pr.detailItem}><Text style={pr.detailLabel}>Curva ABC</Text><AbcBadge abc={product.abc} /></View>
          </View>
          {product.brand ? <Text style={pr.brandText}>Marca: {product.brand}</Text> : null}
          {product.barcode ? (
            <View style={pr.barcodeRow}><Text style={pr.barcodeLabel}>Codigo de barras:</Text><Text style={pr.barcodeValue}>{product.barcode}</Text></View>
          ) : null}
          {product.notes ? <Text style={pr.notesText}>{product.notes}</Text> : null}
          {onDelete && (
            <Pressable onPress={() => onDelete(product.id)} style={pr.deleteBtn}>
              <Text style={pr.deleteBtnText}>Excluir produto</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
const pr = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  info: { flex: 1 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 2 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stock: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  price: { fontSize: 11, color: Colors.ink3 },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 8, gap: 4 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  brandText: { fontSize: 11, color: Colors.ink3, marginTop: 8 },
  barcodeRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  barcodeLabel: { fontSize: 11, color: Colors.ink3 },
  barcodeValue: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  notesText: { fontSize: 11, color: Colors.ink3, marginTop: 6, fontStyle: "italic" },
  deleteBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33", alignItems: "center" },
  deleteBtnText: { fontSize: 12, color: Colors.red, fontWeight: "600" },
});

// ── ABC Summary ──────────────────────────────────────────────

function AbcSummary({ products }: { products: Product[] }) {
  const groups = { A: products.filter(p => p.abc === "A"), B: products.filter(p => p.abc === "B"), C: products.filter(p => p.abc === "C") };
  const total30d = products.reduce((s, p) => s + p.sold30d, 0);
  const totalRevenue = products.reduce((s, p) => s + p.price * p.sold30d, 0);
  return (
    <View style={{ gap: 16 }}>
      {(["A", "B", "C"] as const).map(grade => {
        const items = groups[grade];
        const sold = items.reduce((s, p) => s + p.sold30d, 0);
        const rev = items.reduce((s, p) => s + p.price * p.sold30d, 0);
        const pctSold = total30d > 0 ? (sold / total30d * 100).toFixed(0) : "0";
        const pctRev = totalRevenue > 0 ? (rev / totalRevenue * 100).toFixed(0) : "0";
        const clrs = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
        const labels = { A: "Alta rotatividade - seus campeoes de venda", B: "Rotatividade media - vendas regulares", C: "Baixa rotatividade - avaliar necessidade" };
        return (
          <View key={grade} style={abcS.group}>
            <View style={abcS.header}><AbcBadge abc={grade} /><View style={{ flex: 1 }}><Text style={abcS.title}>Curva {grade} - {items.length} produtos</Text><Text style={abcS.hint}>{labels[grade]}</Text></View></View>
            <View style={{ gap: 8 }}>
              {[{ l: "Vendas", p: pctSold }, { l: "Receita", p: pctRev }].map(b => (
                <View key={b.l} style={abcS.barRow}><Text style={abcS.barLabel}>{b.l}</Text><View style={abcS.track}><View style={[abcS.fill, { width: `${b.p}%`, backgroundColor: clrs[grade] }]} /></View><Text style={[abcS.pct, { color: clrs[grade] }]}>{b.p}%</Text></View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
const abcS = StyleSheet.create({
  group: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 10, color: Colors.ink3, width: 50 },
  track: { flex: 1, height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  pct: { fontSize: 11, fontWeight: "700", width: 36, textAlign: "right" },
});

// ── Alert Row ────────────────────────────────────────────────

function AlertRow({ product }: { product: Product }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const deficit = product.minStock - product.stock;
  return (
    <Pressable onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[alS.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
      <View style={alS.icon}><Text style={alS.iconText}>!</Text></View>
      <View style={{ flex: 1 }}><Text style={alS.name}>{product.name}</Text><Text style={alS.detail}>Atual: {product.stock} {product.unit} / Minimo: {product.minStock} {product.unit}</Text></View>
      <View style={{ alignItems: "flex-end", gap: 4 }}><View style={alS.badge}><Text style={alS.badgeText}>Repor {deficit} {product.unit}</Text></View><Text style={alS.cost}>~{fmt(deficit * product.cost)}</Text></View>
    </Pressable>
  );
}
const alS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 14, color: Colors.red, fontWeight: "800" },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  detail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: Colors.red, fontWeight: "700" },
  cost: { fontSize: 10, color: Colors.ink3 },
});

// ── Main Screen ──────────────────────────────────────────────

export default function EstoqueScreen() {
  const { isDemo, company, token } = useAuthStore();

  // UX-06: First-time tooltip

  // UX-04: Keyboard shortcuts

  // CONN-13: Fetch real products when not in demo
  const qc = useQueryClient();
  const deleteProductMutation = useMutation({
    mutationFn: (prodId: string) => companiesApi.deleteProduct(company!.id, prodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", company?.id] });
      toast.success("Produto excluido");
    },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  const addProductMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createProduct(company!.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", company?.id] }),
  });
  const { data: apiData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products", company?.id],
    queryFn: () => companiesApi.products(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 30000,
  });
  // CONN-13: Sync API products into local state when data arrives
  const apiProducts = (apiData?.products || apiData?.rows || apiData);
  useEffect(() => {
    if (apiProducts instanceof Array) {
      const mapped = apiProducts.map((p: any) => ({
        id: p.id || p.product_id || String(Math.random()),
        name: p.name || p.product_name || "Produto",
        code: p.sku || p.code || "---",
        barcode: p.barcode || p.ean || "",
        category: p.category || "Produtos",
        price: parseFloat(p.price || p.sale_price) || 0,
        cost: parseFloat(p.cost || p.cost_price) || 0,
        stock: parseInt(p.stock_quantity ?? p.stock) || 0,
        minStock: parseInt(p.min_stock ?? p.minStock) || 0,
        abc: (p.abc_class || p.abc || "C") as "A" | "B" | "C",
        sold30d: parseInt(p.sold_30d ?? p.sold30d) || 0,
        unit: p.unit || "un",
        brand: p.brand || "",
        notes: p.notes || "",
      }));
      setProducts(mapped);
    }
  }, [apiData]);
  const scrollRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...products.map(p => p.category)]));
  const filterCategories = ["Todos", ...allCategories];

    function handleExportCSV() {
    if (Platform.OS === "web") {
      const header = "Nome,Preco,Estoque,Categoria,Codigo\n";
      const rows = products.map(pp => [pp.name, pp.price, pp.stock ?? "", pp.category, pp.barcode ?? ""].join(",")).join("\n");
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "estoque_aura_" + new Date().toISOString().slice(0,10) + ".csv";
      link.click();
    }
  }

  function handleImportCSV() {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,.xlsx,.xls";
      input.onchange = (ev: any) => {
        const f = ev.target?.files?.[0];
        if (f) {
          alert("Arquivo " + f.name + " recebido! Processando...");
          // CONN-24: Send to backend for processing
          // const formData = new FormData();
          // formData.append("file", f);
          // request(`/companies/${company?.id}/import/products`, { method: "POST", body: formData });
        }
      };
      input.click();
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const lowStock = products.filter(p => p.stock <= p.minStock);
  const totalValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
  const totalItems = products.reduce((s, p) => s + p.stock, 0);

  function requestDeleteProduct(id: string) {
    setDeleteTarget(id);
  }

  function confirmDeleteProduct() {
    if (!deleteTarget) return;
    if (deleteProductMutation && company?.id && !isDemo) {
      deleteProductMutation.mutate(deleteTarget);
    } else {
      setProducts(prev => prev.filter(p => p.id !== deleteTarget));
    }
    setDeleteTarget(null);
  }

  function handleAddProduct(product: Product) {
    if (addProductMutation && company?.id && !isDemo) {
      addProductMutation.mutate({
        name: product.name,
        sku: product.code,
        barcode: product.barcode,
        category: product.category,
        price: product.price,
        cost_price: product.cost,
        stock_qty: product.stock,
        min_stock: product.minStock,
        unit: product.unit,
      }, {
        onSuccess: () => { toast.success("Produto cadastrado!"); setShowAddForm(false); },
        onError: () => { toast.error("Erro ao salvar produto"); },
      });
    } else {
      setProducts(prev => [product, ...prev]);
      setShowAddForm(false);
    }
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <ScreenHeader
        title="Estoque"
        actionLabel="+ Adicionar produto"
        actionIcon="package"
        onAction={() => { setShowAddForm(true); setActiveTab(0); }}
      />

      <View style={s.summaryRow}>
        <SummaryCard label="TOTAL PRODUTOS" value={String(products.length)} sub={`${totalItems} unidades`} />
        <SummaryCard label="VALOR EM ESTOQUE" value={fmt(totalValue)} />
        <SummaryCard
          label="ESTOQUE BAIXO"
          value={String(lowStock.length)}
          color={lowStock.length > 0 ? Colors.red : Colors.green}
          sub={lowStock.length > 0 ? "Clique para ver alertas" : "Tudo OK"}
          onPress={lowStock.length > 0 ? () => setActiveTab(2) : undefined}
        />
      </View>

      {showAddForm && (
        <AddProductForm
          categories={allCategories}
          onSave={handleAddProduct}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {isLoadingProducts && !isDemo && <ListSkeleton rows={4} showCards />}

      {!isLoadingProducts && products.length === 0 && !isDemo && !showAddForm && (
        <EmptyState
          icon="package"
          iconColor={Colors.amber}
          title="Nenhum produto cadastrado"
          subtitle="Cadastre seu primeiro produto para comecar a gerenciar seu estoque."
          actionLabel="+ Adicionar produto"
          onAction={() => { setShowAddForm(true); setActiveTab(0); }}
        />
      )}

      {(products.length > 0 || isDemo) && <TabBar active={activeTab} onSelect={(i: number) => { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }} />}

      <AgentBanner agent="Estoque" insight={{ title: "3 produtos com estoque baixo", desc: "Pomada modeladora (2 un.), Shampoo premium (5 un.) e Kit barba (1 un.) abaixo do mínimo.", actionLabel: "Criar pedido compra", action: "repor", priority: "high", icon: "package" }} />

      {activeTab === 0 && products.length > 0 && (
        <View>
          <TextInput style={s.searchInput} placeholder="Buscar por nome ou codigo..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catRow}>
            {filterCategories.map(c => (
              <Pressable key={c} onPress={() => setCatFilter(c)} style={[s.catChip, catFilter === c && s.catChipActive]}>
                <Text style={[s.catChipText, catFilter === c && s.catChipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.listCard}>
            {filtered.map(p => <ProductRow key={p.id} product={p} showAbc onDelete={requestDeleteProduct} />)}
            {filtered.length === 0 && <View style={s.empty}><Text style={s.emptyText}>Nenhum produto encontrado</Text></View>}
          </View>
        </View>
      )}

      {activeTab === 1 && (
        <View>
          <View style={s.abcInfo}><Text style={s.abcInfoIcon}>i</Text><Text style={s.abcInfoText}>A curva ABC classifica seus produtos por importancia nas vendas. Produtos A representam maior faturamento, B sao intermediarios e C tem menor impacto.</Text></View>
          <AbcSummary products={products} />
          <View style={[s.listCard, { marginTop: 20 }]}>
            <Text style={s.listTitle}>Todos os produtos por classificacao</Text>
            {[...products].sort((a, b) => a.abc.localeCompare(b.abc) || b.sold30d - a.sold30d).map(p => <ProductRow key={p.id} product={p} showAbc onDelete={requestDeleteProduct} />)}
          </View>
        </View>
      )}

      {activeTab === 2 && (
        <View>
          {lowStock.length === 0 ? (
            <View style={s.allGood}><Text style={s.allGoodIcon}>OK</Text><Text style={s.allGoodTitle}>Estoque em dia!</Text><Text style={s.allGoodSub}>Nenhum produto abaixo do estoque minimo.</Text></View>
          ) : (
            <View>
              <View style={s.alertHeader}><Text style={s.alertHeaderText}>{lowStock.length} produto{lowStock.length > 1 ? "s" : ""} abaixo do estoque minimo</Text></View>
              <View style={s.listCard}>{lowStock.sort((a, b) => (a.stock / a.minStock) - (b.stock / b.minStock)).map(p => <AlertRow key={p.id} product={p} />)}</View>
              <View style={s.reorderCard}><Text style={s.reorderTitle}>Custo estimado de reposicao</Text><Text style={s.reorderValue}>{fmt(lowStock.reduce((s, p) => s + (p.minStock - p.stock) * p.cost, 0))}</Text><Text style={s.reorderHint}>Para repor todos ao estoque minimo</Text></View>
            </View>
          )}
        </View>
      )}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  addBtn: { backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 12 },
  catScroll: { flexGrow: 0, marginBottom: 16 },
  catRow: { flexDirection: "row", gap: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  listTitle: { fontSize: 13, color: Colors.ink3, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 13, color: Colors.ink3 },
  abcInfo: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  abcInfoIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  abcInfoText: { fontSize: 12, color: Colors.ink2, flex: 1, lineHeight: 18 },
  alertHeader: { backgroundColor: Colors.redD, borderRadius: 12, padding: 14, marginBottom: 16 },
  alertHeaderText: { fontSize: 13, color: Colors.red, fontWeight: "600" },
  allGood: { alignItems: "center", paddingVertical: 48, gap: 8 },
  allGoodIcon: { fontSize: 32, color: Colors.green, fontWeight: "800" },
  allGoodTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  allGoodSub: { fontSize: 13, color: Colors.ink3 },
  reorderCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", gap: 6 },
  reorderTitle: { fontSize: 12, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  reorderValue: { fontSize: 28, color: Colors.amber, fontWeight: "800", letterSpacing: -0.5 },
  reorderHint: { fontSize: 11, color: Colors.ink3 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
