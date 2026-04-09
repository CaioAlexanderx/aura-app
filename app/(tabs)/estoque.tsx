import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useProducts } from "@/hooks/useProducts";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { AgentBanner } from "@/components/AgentBanner";
import { AddProductForm } from "@/components/screens/estoque/AddProductForm";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { AbcSummary } from "@/components/screens/estoque/AbcSummary";
import { AlertsList } from "@/components/screens/estoque/AlertsList";
import { PrintLabels } from "@/components/PrintLabels";
import { TABS, DEFAULT_CATEGORIES, fmt } from "@/components/screens/estoque/types";
import type { Product } from "@/components/screens/estoque/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, PRODUCT_COLUMNS, mapImportedProduct } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

function SummaryCard({ label, value, color, sub, onPress }: { label: string; value: string; color?: string; sub?: string; onPress?: () => void }) {
  const [h, sH] = useState(false); const w = Platform.OS === "web";
  return <Pressable onPress={onPress} onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined} style={[s.card, h && { transform: [{ translateY: -2 }], borderColor: Colors.border2 }, w && { transition: "all 0.2s ease", cursor: onPress ? "pointer" : "default" } as any]}><Text style={s.cardLabel}>{label}</Text><Text style={[s.cardValue, color ? { color } : {}]}>{value}</Text>{sub && <Text style={s.cardSub}>{sub}</Text>}</Pressable>;
}

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>{TABS.map((tab, i) => <Pressable key={tab} onPress={() => onSelect(i)} style={[s.tab, active === i && s.tabActive]}><Text style={[s.tabText, active === i && s.tabTextActive]}>{tab}</Text></Pressable>)}</ScrollView>;
}

export default function EstoqueScreen() {
  const { products, categories, isLoading, isDemo, addProduct, updateProduct, deleteProduct } = useProducts();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelSelection, setLabelSelection] = useState<string[]>([]);

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories, ...products.map(p => p.category)]));
  const filterCategories = ["Todos", ...allCategories.filter(Boolean)];
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });
  const lowStock = products.filter(p => p.stock <= p.minStock);
  const totalValue = products.reduce((acc, p) => acc + p.stock * p.cost, 0);
  const totalItems = products.reduce((acc, p) => acc + p.stock, 0);

  function handleSaveProduct(product: Product) {
    if (editProduct) {
      updateProduct(product);
      setEditProduct(null);
      toast.success("Produto atualizado");
    } else {
      addProduct(product);
      toast.success("Produto adicionado");
    }
    setShowAddForm(false);
  }

  function handleEdit(product: Product) {
    setEditProduct(product);
    setShowAddForm(true);
    setActiveTab(0);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }

  function handleCancelForm() {
    setShowAddForm(false);
    setEditProduct(null);
  }

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (products.length === 0) { toast.error("Nenhum produto para exportar"); return; }
    const csv = arrayToCSV(products, PRODUCT_COLUMNS);
    downloadCSV(csv, `aura_estoque_${new Date().toISOString().slice(0,10)}.csv`);
  }

  async function handleImport() {
    try {
      const rows = await pickFileAndParse();
      let imported = 0, skipped = 0;
      for (const row of rows) {
        const mapped = mapImportedProduct(row);
        if (mapped && company?.id) {
          try { await companiesApi.createProduct(company.id, mapped); imported++; }
          catch { skipped++; }
        } else { skipped++; }
      }
      if (imported > 0) {
        qc.invalidateQueries({ queryKey: ["products", company?.id] });
        toast.success(`${imported} produtos importados${skipped > 0 ? ` (${skipped} ignorados)` : ""}`);
      } else { toast.error("Nenhum produto valido encontrado. Verifique as colunas: Nome, Preco venda, Estoque"); }
    } catch {}
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <ScreenHeader title="Estoque" actionLabel="+ Adicionar produto" actionIcon="package" onAction={() => { setEditProduct(null); setShowAddForm(true); setActiveTab(0); }} />

      <View style={s.summaryRow}>
        <SummaryCard label="TOTAL PRODUTOS" value={String(products.length)} sub={`${totalItems} unidades`} />
        <SummaryCard label="VALOR EM ESTOQUE" value={fmt(totalValue)} />
        <SummaryCard label="ESTOQUE BAIXO" value={String(lowStock.length)} color={lowStock.length > 0 ? Colors.red : Colors.green} sub={lowStock.length > 0 ? "Ver alertas" : "Tudo OK"} onPress={lowStock.length > 0 ? () => setActiveTab(2) : undefined} />
      </View>

      {showAddForm && <AddProductForm categories={allCategories} onSave={handleSaveProduct} onCancel={handleCancelForm} editProduct={editProduct} />}

      {isLoading && <ListSkeleton rows={4} showCards />}

      {!isLoading && products.length === 0 && !isDemo && !showAddForm && (
        <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Cadastre seu primeiro produto ou importe de uma planilha." actionLabel="+ Adicionar produto" onAction={() => { setShowAddForm(true); setActiveTab(0); }} secondaryLabel="Importar CSV" onSecondary={handleImport} />
      )}

      {products.length > 0 && <TabBar active={activeTab} onSelect={handleTabSelect} />}
      {products.length > 0 && activeTab === 0 && <ImportExportBar onExport={handleExport} onImport={handleImport} itemCount={products.length} />}

      {activeTab === 0 && products.length > 0 && (
        <View>
          <TextInput style={s.searchInput} placeholder="Buscar por nome ou codigo..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
            {filterCategories.map(c => <Pressable key={c} onPress={() => setCatFilter(c)} style={[s.catChip, catFilter === c && s.catChipActive]}><Text style={[s.catChipText, catFilter === c && s.catChipTextActive]}>{c}</Text></Pressable>)}
          </ScrollView>
          <View style={s.listCard}>
            {filtered.map(p => <ProductRow key={p.id} product={p} showAbc onDelete={(id) => setDeleteTarget(id)} onEdit={!isDemo ? handleEdit : undefined} />)}
            {filtered.length === 0 && <View style={{ alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
          </View>
        </View>
      )}

      {activeTab === 1 && <View><View style={s.abcInfo}><Text style={s.abcInfoIcon}>i</Text><Text style={s.abcInfoText}>A curva ABC classifica seus produtos por importancia nas vendas.</Text></View><AbcSummary products={products} /><View style={[s.listCard, { marginTop: 20 }]}><Text style={s.listTitle}>Todos por classificacao</Text>{[...products].sort((a, b) => a.abc.localeCompare(b.abc) || b.sold30d - a.sold30d).map(p => <ProductRow key={p.id} product={p} showAbc onDelete={(id) => setDeleteTarget(id)} onEdit={!isDemo ? handleEdit : undefined} />)}</View></View>}

      {activeTab === 2 && <AlertsList products={products} />}

      {activeTab === 3 && <PrintLabels products={products} selectedIds={labelSelection} onSelectionChange={setLabelSelection} />}

      <ConfirmDialog visible={!!deleteTarget} title="Excluir produto?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => { if (deleteTarget) { deleteProduct(deleteTarget); setDeleteTarget(null); } }} onCancel={() => setDeleteTarget(null)} />
      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  cardSub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  listTitle: { fontSize: 13, color: Colors.ink3, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  abcInfo: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  abcInfoIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  abcInfoText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
