import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W > 768;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ── Mock Data ────────────────────────────────────────────────

const MOCK_PRODUCTS = [
  { id: "1", name: "Pomada Modeladora", sku: "POM-001", barcode: "7891000315507", category: "Produtos", price: 35.90, cost: 18.50, stock: 24, minStock: 10, abc: "A" as const, sold30d: 42 },
  { id: "2", name: "Shampoo Anticaspa", sku: "SHA-001", barcode: "7891000428901", category: "Produtos", price: 28.50, cost: 14.20, stock: 18, minStock: 8, abc: "A" as const, sold30d: 38 },
  { id: "3", name: "Oleo para Barba", sku: "OLE-001", barcode: null, category: "Produtos", price: 42.00, cost: 22.00, stock: 12, minStock: 5, abc: "A" as const, sold30d: 29 },
  { id: "4", name: "Cera Capilar", sku: "CER-001", barcode: "7891000532104", category: "Produtos", price: 32.90, cost: 16.80, stock: 15, minStock: 8, abc: "B" as const, sold30d: 18 },
  { id: "5", name: "Cerveja Artesanal", sku: "CER-002", barcode: "7891000667802", category: "Bebidas", price: 14.00, cost: 7.50, stock: 36, minStock: 20, abc: "B" as const, sold30d: 15 },
  { id: "6", name: "Condicionador Premium", sku: "CON-001", barcode: null, category: "Produtos", price: 38.00, cost: 19.00, stock: 3, minStock: 5, abc: "B" as const, sold30d: 12 },
  { id: "7", name: "Gel Fixador", sku: "GEL-001", barcode: null, category: "Produtos", price: 22.90, cost: 11.00, stock: 8, minStock: 10, abc: "C" as const, sold30d: 6 },
  { id: "8", name: "Toalha Descartavel", sku: "TOA-001", barcode: null, category: "Consumiveis", price: 0.50, cost: 0.15, stock: 200, minStock: 100, abc: "C" as const, sold30d: 4 },
  { id: "9", name: "Lamina Descartavel", sku: "LAM-001", barcode: null, category: "Consumiveis", price: 1.20, cost: 0.40, stock: 150, minStock: 50, abc: "C" as const, sold30d: 3 },
  { id: "10", name: "Pos-Barba Premium", sku: "POS-001", barcode: null, category: "Produtos", price: 48.00, cost: 25.00, stock: 2, minStock: 5, abc: "B" as const, sold30d: 10 },
];

const TABS = ["Produtos", "Curva ABC", "Alertas"];

// ── Summary Card ─────────────────────────────────────────────

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        sm.card,
        hovered && { transform: [{ translateY: -2 }], borderColor: Colors.border2 },
        isWeb && { transition: "all 0.2s ease" } as any,
      ]}
    >
      <Text style={sm.label}>{label}</Text>
      <Text style={[sm.value, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={sm.sub}>{sub}</Text>}
    </Pressable>
  );
}
const sm = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  label: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  value: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
});

// ── Tab Bar ──────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tb.scroll} contentContainerStyle={tb.row}>
      {TABS.map((tab, i) => (
        <Pressable key={tab} onPress={() => onSelect(i)} style={[tb.tab, active === i && tb.tabActive]}>
          <Text style={[tb.label, active === i && tb.labelActive]}>{tab}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const tb = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 20 },
  row: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: "#fff", fontWeight: "600" },
});

// ── ABC Badge ────────────────────────────────────────────────

function AbcBadge({ abc }: { abc: "A" | "B" | "C" }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return (
    <View style={[ab.badge, { backgroundColor: bgs[abc] }]}>
      <Text style={[ab.text, { color: colors[abc] }]}>{abc}</Text>
    </View>
  );
}
const ab = StyleSheet.create({
  badge: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 12, fontWeight: "800" },
});

// ── Product Row ──────────────────────────────────────────────

function ProductRow({ product, showAbc }: { product: typeof MOCK_PRODUCTS[0]; showAbc?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isWeb = Platform.OS === "web";
  const isLow = product.stock <= product.minStock;
  const margin = ((product.price - product.cost) / product.price * 100).toFixed(0);
  const stockValue = product.stock * product.cost;

  return (
    <View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        onHoverIn={isWeb ? () => setHovered(true) : undefined}
        onHoverOut={isWeb ? () => setHovered(false) : undefined}
        style={[
          pr.row,
          hovered && { backgroundColor: Colors.bg4 },
          isWeb && { transition: "background-color 0.15s ease" } as any,
        ]}
      >
        <View style={pr.left}>
          {showAbc && <AbcBadge abc={product.abc} />}
          <View style={pr.info}>
            <Text style={pr.name}>{product.name}</Text>
            <Text style={pr.meta}>{product.sku} / {product.category}{product.barcode ? " / EAN" : ""}</Text>
          </View>
        </View>
        <View style={pr.right}>
          <View style={pr.stockRow}>
            <Text style={[pr.stock, isLow && { color: Colors.red }]}>{product.stock} un</Text>
            {isLow && <View style={pr.alertDot} />}
          </View>
          <Text style={pr.price}>{fmt(product.price)}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={pr.detail}>
          <View style={pr.detailGrid}>
            <View style={pr.detailItem}>
              <Text style={pr.detailLabel}>Custo</Text>
              <Text style={pr.detailValue}>{fmt(product.cost)}</Text>
            </View>
            <View style={pr.detailItem}>
              <Text style={pr.detailLabel}>Margem</Text>
              <Text style={[pr.detailValue, { color: Colors.green }]}>{margin}%</Text>
            </View>
            <View style={pr.detailItem}>
              <Text style={pr.detailLabel}>Vendidos (30d)</Text>
              <Text style={pr.detailValue}>{product.sold30d}</Text>
            </View>
            <View style={pr.detailItem}>
              <Text style={pr.detailLabel}>Valor estoque</Text>
              <Text style={pr.detailValue}>{fmt(stockValue)}</Text>
            </View>
            <View style={pr.detailItem}>
              <Text style={pr.detailLabel}>Estoque minimo</Text>
              <Text style={pr.detailValue}>{product.minStock} un</Text>
            </View>
            <View style={pr.detailItem}>
              <Text style={pr.detailLabel}>Curva ABC</Text>
              <AbcBadge abc={product.abc} />
            </View>
          </View>
          {product.barcode && (
            <View style={pr.barcodeRow}>
              <Text style={pr.barcodeLabel}>Codigo de barras:</Text>
              <Text style={pr.barcodeValue}>{product.barcode}</Text>
            </View>
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
  barcodeRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  barcodeLabel: { fontSize: 11, color: Colors.ink3 },
  barcodeValue: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

// ── ABC Summary ──────────────────────────────────────────────

function AbcSummary({ products }: { products: typeof MOCK_PRODUCTS }) {
  const groups = { A: products.filter(p => p.abc === "A"), B: products.filter(p => p.abc === "B"), C: products.filter(p => p.abc === "C") };
  const total30d = products.reduce((s, p) => s + p.sold30d, 0);
  const totalRevenue = products.reduce((s, p) => s + p.price * p.sold30d, 0);

  return (
    <View style={abc.container}>
      {(["A", "B", "C"] as const).map(grade => {
        const items = groups[grade];
        const sold = items.reduce((s, p) => s + p.sold30d, 0);
        const rev = items.reduce((s, p) => s + p.price * p.sold30d, 0);
        const pctSold = total30d > 0 ? (sold / total30d * 100).toFixed(0) : "0";
        const pctRev = totalRevenue > 0 ? (rev / totalRevenue * 100).toFixed(0) : "0";
        const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
        const labels = { A: "Alta rotatividade - seus campeoes de venda", B: "Rotatividade media - vendas regulares", C: "Baixa rotatividade - avaliar necessidade" };

        return (
          <View key={grade} style={abc.group}>
            <View style={abc.groupHeader}>
              <AbcBadge abc={grade} />
              <View style={abc.groupInfo}>
                <Text style={abc.groupTitle}>Curva {grade} - {items.length} produtos</Text>
                <Text style={abc.groupHint}>{labels[grade]}</Text>
              </View>
            </View>
            <View style={abc.bars}>
              <View style={abc.barRow}>
                <Text style={abc.barLabel}>Vendas</Text>
                <View style={abc.barTrack}>
                  <View style={[abc.barFill, { width: `${pctSold}%`, backgroundColor: colors[grade] }]} />
                </View>
                <Text style={[abc.barPct, { color: colors[grade] }]}>{pctSold}%</Text>
              </View>
              <View style={abc.barRow}>
                <Text style={abc.barLabel}>Receita</Text>
                <View style={abc.barTrack}>
                  <View style={[abc.barFill, { width: `${pctRev}%`, backgroundColor: colors[grade] }]} />
                </View>
                <Text style={[abc.barPct, { color: colors[grade] }]}>{pctRev}%</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const abc = StyleSheet.create({
  container: { gap: 16 },
  group: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  groupInfo: { flex: 1 },
  groupTitle: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  groupHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  bars: { gap: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 10, color: Colors.ink3, width: 50 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.bg4, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barPct: { fontSize: 11, fontWeight: "700", width: 36, textAlign: "right" },
});

// ── Alert Row ────────────────────────────────────────────────

function AlertRow({ product }: { product: typeof MOCK_PRODUCTS[0] }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const deficit = product.minStock - product.stock;
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[
        al.row,
        hovered && { backgroundColor: Colors.bg4 },
        isWeb && { transition: "background-color 0.15s ease" } as any,
      ]}
    >
      <View style={al.alertIcon}><Text style={al.alertIconText}>!</Text></View>
      <View style={al.info}>
        <Text style={al.name}>{product.name}</Text>
        <Text style={al.detail}>Atual: {product.stock} un / Minimo: {product.minStock} un</Text>
      </View>
      <View style={al.right}>
        <View style={al.badge}>
          <Text style={al.badgeText}>Repor {deficit} un</Text>
        </View>
        <Text style={al.cost}>~{fmt(deficit * product.cost)}</Text>
      </View>
    </Pressable>
  );
}
const al = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  alertIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  alertIconText: { fontSize: 14, color: Colors.red, fontWeight: "800" },
  info: { flex: 1 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  detail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  badge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: Colors.red, fontWeight: "700" },
  cost: { fontSize: 10, color: Colors.ink3 },
});

// ── Main Screen ──────────────────────────────────────────────

export default function EstoqueScreen() {
  const { isDemo } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");

  const categories = ["Todos", ...Array.from(new Set(MOCK_PRODUCTS.map(p => p.category)))];

  const filtered = MOCK_PRODUCTS.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const lowStock = MOCK_PRODUCTS.filter(p => p.stock <= p.minStock);
  const totalValue = MOCK_PRODUCTS.reduce((s, p) => s + p.stock * p.cost, 0);
  const totalItems = MOCK_PRODUCTS.reduce((s, p) => s + p.stock, 0);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Estoque</Text>

      {/* Summary cards */}
      <View style={s.summaryRow}>
        <SummaryCard label="TOTAL PRODUTOS" value={String(MOCK_PRODUCTS.length)} sub={`${totalItems} unidades`} />
        <SummaryCard label="VALOR EM ESTOQUE" value={fmt(totalValue)} />
        <SummaryCard label="ESTOQUE BAIXO" value={String(lowStock.length)} color={lowStock.length > 0 ? Colors.red : Colors.green} sub={lowStock.length > 0 ? "Requer atencao" : "Tudo OK"} />
      </View>

      <TabBar active={activeTab} onSelect={setActiveTab} />

      {/* Tab 1: Produtos */}
      {activeTab === 0 && (
        <View>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome ou SKU..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catRow}>
            {categories.map(c => (
              <Pressable key={c} onPress={() => setCatFilter(c)} style={[s.catChip, catFilter === c && s.catChipActive]}>
                <Text style={[s.catChipText, catFilter === c && s.catChipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.listCard}>
            {filtered.map(p => <ProductRow key={p.id} product={p} showAbc />)}
            {filtered.length === 0 && (
              <View style={s.empty}><Text style={s.emptyText}>Nenhum produto encontrado</Text></View>
            )}
          </View>
        </View>
      )}

      {/* Tab 2: Curva ABC */}
      {activeTab === 1 && (
        <View>
          <View style={s.abcInfo}>
            <Text style={s.abcInfoIcon}>i</Text>
            <Text style={s.abcInfoText}>
              A curva ABC classifica seus produtos por importancia nas vendas. Produtos A representam maior faturamento, B sao intermediarios e C tem menor impacto.
            </Text>
          </View>
          <AbcSummary products={MOCK_PRODUCTS} />
          <View style={[s.listCard, { marginTop: 20 }]}>
            <Text style={s.listTitle}>Todos os produtos por classificacao</Text>
            {[...MOCK_PRODUCTS].sort((a, b) => a.abc.localeCompare(b.abc) || b.sold30d - a.sold30d).map(p => (
              <ProductRow key={p.id} product={p} showAbc />
            ))}
          </View>
        </View>
      )}

      {/* Tab 3: Alertas */}
      {activeTab === 2 && (
        <View>
          {lowStock.length === 0 ? (
            <View style={s.allGood}>
              <Text style={s.allGoodIcon}>OK</Text>
              <Text style={s.allGoodTitle}>Estoque em dia!</Text>
              <Text style={s.allGoodSub}>Nenhum produto abaixo do estoque minimo.</Text>
            </View>
          ) : (
            <View>
              <View style={s.alertHeader}>
                <Text style={s.alertHeaderText}>{lowStock.length} produto{lowStock.length > 1 ? "s" : ""} abaixo do estoque minimo</Text>
              </View>
              <View style={s.listCard}>
                {lowStock.sort((a, b) => (a.stock / a.minStock) - (b.stock / b.minStock)).map(p => (
                  <AlertRow key={p.id} product={p} />
                ))}
              </View>
              <View style={s.reorderCard}>
                <Text style={s.reorderTitle}>Custo estimado de reposicao</Text>
                <Text style={s.reorderValue}>
                  {fmt(lowStock.reduce((s, p) => s + (p.minStock - p.stock) * p.cost, 0))}
                </Text>
                <Text style={s.reorderHint}>Para repor todos ao estoque minimo</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {isDemo && (
        <View style={s.demoBanner}>
          <Text style={s.demoText}>Modo demonstrativo - dados ilustrativos</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 20 },

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
