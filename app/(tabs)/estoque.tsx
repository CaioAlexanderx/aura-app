import { useState, useRef, useMemo, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions, ActivityIndicator } from "react-native";
import { Colors, useColors, useThemeStore } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useProducts } from "@/hooks/useProducts";
import { useProductCategories } from "@/hooks/useProductCategories";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { ServerImport } from "@/components/ServerImport";
import { AddProductForm } from "@/components/screens/estoque/AddProductForm";
import { AddServiceForm } from "@/components/screens/estoque/AddServiceForm";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { AlertsList } from "@/components/screens/estoque/AlertsList";
import { PrintLabels } from "@/components/PrintLabels";
import { Pagination } from "@/components/Pagination";
import { ScrollableChips } from "@/components/ScrollableChips";
import { MergeDuplicatesModal } from "@/components/MergeDuplicatesModal";
import { CategoriesModal } from "@/components/screens/estoque/CategoriesModal";
import { QuickBatchProductsModal } from "@/components/QuickBatchProductsModal";
import { DanfeImportModal } from "@/components/screens/estoque/DanfeImportModal";
import { LinkProductModal } from "@/components/LinkProductModal";
import { WebPortal } from "@/components/WebPortal";
import { usePagination } from "@/hooks/usePagination";
import { TABS, DEFAULT_CATEGORIES, fmt } from "@/components/screens/estoque/types";
import type { Product } from "@/components/screens/estoque/types";
import type { CategoryType } from "@/services/api";
import { arrayToCSV, downloadCSV, PRODUCT_COLUMNS } from "@/utils/csv";
import { productMatchesSearch } from "@/utils/productSearch";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { productLinksApi, type AggregatedProduct } from "@/services/productLinks";
// Sidebar-style premium components (Estoque v2 — 08/05/2026).
// Cada um vive em seu próprio arquivo pra manter este screen <50KB e
// permitir backtracking limpo. Todos web-only (Platform.OS check interno).
import { useEstoquePremiumStyles } from "@/components/screens/estoque/useEstoquePremiumStyles";
import { EstoqueHero } from "@/components/screens/estoque/EstoqueHero";
import { EstoqueKpiStrip } from "@/components/screens/estoque/EstoqueKpiStrip";
import { CategoryDropdownWeb } from "@/components/screens/estoque/CategoryDropdownWeb";
import { ProductTableWeb } from "@/components/screens/estoque/ProductTableWeb";
import { ProductGridWeb } from "@/components/screens/estoque/ProductGridWeb";
// import { EstoqueRightRail } from "@/components/screens/estoque/EstoqueRightRail"; // Phase 2 — right rail

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const PAGE_SIZE = 20;
// Thresholds reativos pro layout split (table+rail). 1100px = mostra
// rail; 900px = mostra Table/Grid (abaixo cai pra ProductRow).
const RAIL_BREAKPOINT = 1100;
const TABLE_BREAKPOINT = 900;

function useScreenWidth(): number {
  const [w, setW] = useState(
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.innerWidth
      : Dimensions.get("window").width
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

function SummaryCard({ label, value, color, sub, onPress }: { label: string; value: string; color?: string; sub?: string; onPress?: () => void }) {
  const [h, sH] = useState(false); const w = Platform.OS === "web";
  return <Pressable onPress={onPress} onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
    style={[s.card, h && { transform: [{ translateY: -2 }], borderColor: Colors.border2 }, w && { transition: "all 0.2s ease", cursor: onPress ? "pointer" : "default" } as any]}>
    <Text style={s.cardLabel}>{label}</Text>
    <Text style={[s.cardValue, color ? { color } : {}]}>{value}</Text>
    {sub && <Text style={s.cardSub}>{sub}</Text>}
  </Pressable>;
}

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}
    contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
    {TABS.map((tab, i) => <Pressable key={tab} onPress={() => onSelect(i)} style={[s.tab, active === i && s.tabActive]}><Text style={[s.tabText, active === i && s.tabTextActive]}>{tab}</Text></Pressable>)}
  </ScrollView>;
}

type CategoriesModalState = { open: boolean; initialType?: CategoryType };

// ────────────────────────────────────────────────────────────
// MSL-06: View AGREGADA (modo "Todas as empresas")
// ────────────────────────────────────────────────────────────
function AggregatedView() {
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["productsAggregated", refreshKey],
    queryFn: () => productLinksApi.aggregated(),
    staleTime: 30000,
  });

  const groups = data?.products || [];
  // 07/05/2026: usa productMatchesSearch pra paridade com Estoque single-company
  // e PDV (acentos normalizados, multi-termo AND, haystack consolidado).
  const filtered = useMemo(() => {
    if (!search) return groups;
    return groups.filter((g: AggregatedProduct) =>
      productMatchesSearch(
        {
          name: g.name,
          barcode: g.barcode,
          sku: g.sku,
          code: g.master_sku,
          category: g.category,
        },
        search
      )
    );
  }, [groups, search]);

  const linkedCount = groups.filter((g: AggregatedProduct) => g.is_linked).length;
  const totalUnits = groups.reduce((acc: number, g: AggregatedProduct) => acc + g.total_stock, 0);

  if (isLoading) return <ListSkeleton rows={4} showCards />;

  if (error) {
    return (
      <View style={agg.errorBox}>
        <Text style={agg.errorText}>Erro ao carregar produtos agregados.</Text>
        <Pressable onPress={() => setRefreshKey((k) => k + 1)} style={agg.retryBtn}>
          <Text style={agg.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={agg.banner}>
        <Icon name="bag" size={16} color="#7c3aed" />
        <View style={{ flex: 1 }}>
          <Text style={agg.bannerTitle}>Visão consolidada — todas suas empresas</Text>
          <Text style={agg.bannerDesc}>
            Estoque somado entre CNPJs vinculados via código mestre. Para editar produtos, troque para uma empresa específica no switcher.
          </Text>
        </View>
      </View>

      <View style={s.summaryRow}>
        <SummaryCard label="GRUPOS" value={String(groups.length)} sub={`${linkedCount} vinculados entre empresas`} />
        <SummaryCard label="UNIDADES TOTAIS" value={String(Math.round(totalUnits))} />
        <SummaryCard label="EMPRESAS" value={String(data?.searched_companies ?? 0)} />
      </View>

      <TextInput
        style={s.searchInput}
        placeholder="Buscar por nome, código mestre, SKU ou código de barras..."
        placeholderTextColor={Colors.ink3}
        value={search}
        onChangeText={setSearch}
      />

      {filtered.length === 0 && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 13, color: Colors.ink3 }}>
            {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado em nenhuma empresa"}
          </Text>
        </View>
      )}

      <View style={s.listCard}>
        {filtered.map((g: AggregatedProduct) => (
          <View key={g.group_key} style={agg.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={agg.nameLine}>
                <Text style={agg.name} numberOfLines={1}>{g.name}</Text>
                {g.is_linked && (
                  <View style={agg.linkedBadge}>
                    <Text style={agg.linkedBadgeText}>{"🔗 " + g.company_count + " CNPJs"}</Text>
                  </View>
                )}
              </View>
              <Text style={agg.meta}>
                {g.master_sku ? "Código: " + g.master_sku : (g.sku || g.barcode || "Sem código")}
                {g.category ? " · " + g.category : ""}
              </Text>
              {g.is_linked && (
                <View style={agg.itemsList}>
                  {g.items.map((item) => (
                    <View key={item.product_id} style={agg.itemChip}>
                      <Text style={agg.itemChipText}>
                        {item.company_name}: {Math.round(item.stock_qty)} un
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={agg.rightCol}>
              <Text style={agg.totalStock}>{Math.round(g.total_stock)}</Text>
              <Text style={agg.totalStockLabel}>{g.unit || "un"}</Text>
              <Text style={agg.price}>{fmt(g.avg_price)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const agg = StyleSheet.create({
  banner: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: "#7c3aed12", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#7c3aed30", marginBottom: 16,
  },
  bannerTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  bannerDesc: { fontSize: 11, color: Colors.ink3, marginTop: 4, lineHeight: 16 },
  errorBox: { alignItems: "center", padding: 32, gap: 12 },
  errorText: { fontSize: 13, color: Colors.red },
  retryBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  row: {
    flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: "flex-start",
  },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "700", flexShrink: 1 },
  linkedBadge: {
    backgroundColor: "#7c3aed20", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "#7c3aed40",
  },
  linkedBadgeText: { fontSize: 10, color: "#7c3aed", fontWeight: "700" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  itemsList: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  itemChip: {
    backgroundColor: Colors.bg4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemChipText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  rightCol: { alignItems: "flex-end", gap: 2, minWidth: 70 },
  totalStock: { fontSize: 18, fontWeight: "800", color: Colors.ink, lineHeight: 22 },
  totalStockLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  price: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
});

export default function EstoqueScreen() {
  useEstoquePremiumStyles();
  const { products, categories, isLoading, isDemo, addProduct, updateProduct, deleteProduct, bulkDeleteProducts } = useProducts();
  const { categoryNames: managedCategoryNames } = useProductCategories();
  const { company, availableCompanies, consolidatedView } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const C = useColors();
  const { isDark } = useThemeStore();
  const screenW = useScreenWidth();
  // Web-wide habilita Hero + KpiStrip + Table/Grid + multi-select cat.
  // Em narrow web ou native, mantém o layout antigo (compat 100%).
  const isWebWide = Platform.OS === "web" && screenW > TABLE_BREAKPOINT;
  const isMobileNarrow = Platform.OS === "web" && screenW < 500;
  const showRailDefault = Platform.OS === "web" && screenW >= RAIL_BREAKPOINT;

  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  // catFilter: single-select chip (narrow). catsMulti: dropdown (wide).
  // effectiveCats abaixo combina os dois.
  const [catFilter, setCatFilter] = useState("Todos");
  const [catsMulti, setCatsMulti] = useState<string[]>([]);
  const [view, setView] = useState<"table" | "grid">("table");
  const [showRail, setShowRail] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelSelection, setLabelSelection] = useState<string[]>([]);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showDanfeModal, setShowDanfeModal] = useState(false);
  const [categoriesModal, setCategoriesModal] = useState<CategoriesModalState>({ open: false });

  // Scanner popup: TextInput inline simples (sem ScannerInput pra evitar
  // conflitos de auto-focus + overlay). Foco é dado via ref.focus() quando
  // o popup abre. Ao bipar (Enter) ou clicar Aplicar, joga no search.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanText, setScanText] = useState("");
  const scanRef = useRef<any>(null);
  const scanInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!scanOpen || Platform.OS !== "web") return;
    function onDoc(e: MouseEvent) {
      if (scanRef.current && !scanRef.current.contains(e.target)) {
        setScanOpen(false);
        setScanText("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [scanOpen]);

  // Auto-focus quando popup abre — pequeno timeout pra esperar o render.
  useEffect(() => {
    if (!scanOpen) return;
    const t = setTimeout(() => {
      scanInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [scanOpen]);

  const [linkTarget, setLinkTarget] = useState<Product | null>(null);
  const [sortOrder, setSortOrder] = useState<"recent" | "price_desc" | "price_asc" | "low_stock">("recent");
  const hasMultipleCnpjs = (availableCompanies?.length || 0) >= 2;
  const canLinkProducts = hasMultipleCnpjs && !consolidatedView && !!company?.id;

  const { data: dupGroupsData, refetch: refetchDupGroups } = useQuery({
    queryKey: ["duplicateGroups", company?.id],
    queryFn: () => companiesApi.duplicateGroups(company!.id),
    enabled: !!company?.id && !isDemo && !consolidatedView,
    staleTime: 60000,
  });
  const dupGroupsCount = ((dupGroupsData as any)?.groups?.length || 0);

  const allCategories = useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_CATEGORIES,
      ...managedCategoryNames,
      ...categories,
      ...products.map(p => p.category),
    ])).filter(Boolean);
  }, [managedCategoryNames, categories, products]);

  const filterCategories = ["Todos", ...allCategories];

  // effectiveCats: combina single (catFilter) + multi (catsMulti).
  // Wide usa o multi-select. Narrow usa o single-chip antigo.
  // Vazio = "Todos".
  const effectiveCats = useMemo<string[]>(() => {
    if (isWebWide) return catsMulti;
    return catFilter === "Todos" ? [] : [catFilter];
  }, [isWebWide, catsMulti, catFilter]);

  // 07/05/2026: paridade com PDV via utils/productSearch — fix bug Davi.
  // Antes a busca falhava em três cenários reportados:
  //   - acentos no nome ("tenis" não achava "Tênis")
  //   - ordem de palavras invertida ("preto activita" vs "Activita ... Preto")
  //   - busca por marca/cor/tamanho/categoria (campos não cobertos)
  // Agora normalizeText + tokenização AND + haystack consolidado resolvem
  // os três (mesma lógica que o PDV já usava e o Davi confirmou funcional).
  const filtered = useMemo(() => {
    const q = (search || "").trim();
    return products.filter(p => {
      const matchSearch = productMatchesSearch(p, q);
      const matchCat = effectiveCats.length === 0 || effectiveCats.includes(p.category);
      return matchSearch && matchCat;
    });
  }, [products, search, effectiveCats]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortOrder === "recent") {
      arr.sort((a, b) => new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime());
    } else if (sortOrder === "price_desc") {
      arr.sort((a, b) => ((b as any).price ?? 0) - ((a as any).price ?? 0));
    } else if (sortOrder === "price_asc") {
      arr.sort((a, b) => ((a as any).price ?? 0) - ((b as any).price ?? 0));
    } else if (sortOrder === "low_stock") {
      arr.sort((a, b) => a.stock - b.stock);
    }
    return arr;
  }, [filtered, sortOrder]);

  // Pagination key inclui catsMulti pra resetar página quando user
  // troca categorias no wide layout (multi-select dropdown).
  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(sorted, PAGE_SIZE, search + catFilter + catsMulti.join(",") + sortOrder);
  const lowStock = products.filter(p => p.stock <= p.minStock && p.unit !== "srv");
  const totalValue = products.reduce((acc, p) => acc + p.stock * p.cost, 0);
  const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
  const serviceCount = products.filter(p => p.category === "Servicos" || p.unit === "srv").length;

  function closeFormModal() {
    setShowAddForm(false);
    setShowServiceForm(false);
    setEditProduct(null);
  }

  function handleSaveProduct(product: Product) {
    if (editProduct) { updateProduct(product); setEditProduct(null); }
    else addProduct(product);
    setShowAddForm(false);
    setShowServiceForm(false);
    setTimeout(() => refetchDupGroups(), 500);
  }

  function handleEdit(product: Product) {
    setEditProduct(product);
    setShowAddForm(true);
    setShowServiceForm(false);
    setActiveTab(0);
  }

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function applyScan() {
    const cleaned = (scanText || "").trim();
    if (!cleaned) return;
    setSearch(cleaned);
    setScanOpen(false);
    setScanText("");
    // Feedback rápido se for match único
    setTimeout(() => {
      const matches = products.filter(p =>
        (p as any).barcode === cleaned ||
        (p as any).sku === cleaned ||
        p.code === cleaned
      );
      if (matches.length === 1) {
        toast.success(matches[0].name);
      } else if (matches.length === 0) {
        toast.info("Nenhum produto com esse código. Mostrando busca textual.");
      }
    }, 50);
  }

  function handleExport() {
    if (products.length === 0) { toast.error("Nenhum produto para exportar"); return; }
    downloadCSV(arrayToCSV(products, PRODUCT_COLUMNS), `aura_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function handleImportComplete() {
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
    refetchDupGroups();
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (bulkSelected.size === filtered.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(filtered.map(p => p.id)));
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()); }

  async function handleBulkDelete() {
    await bulkDeleteProducts(Array.from(bulkSelected));
    exitBulkMode();
    refetchDupGroups();
  }

  const formOpen = showAddForm || showServiceForm;

  if (consolidatedView) {
    return (
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Estoque consolidado</Text>
          </View>
        </View>
        <AggregatedView />
      </ScrollView>
    );
  }

  // Helper: 5 botões de ação do header (reusados em wide e narrow)
  // 12/05/2026: "Selecionar" volta como toggle do bulkMode (Eryca).
  const ActionButtons = () => (
    <>
      <Pressable onPress={() => { setEditProduct(null); setShowServiceForm(true); setShowAddForm(false); setActiveTab(0); }} style={[s.serviceBtn, isMobileNarrow && s.btnIconOnly]}>
        <Icon name="star" size={14} color={Colors.violet3} />
        {!isMobileNarrow && <Text style={s.serviceBtnText}>+ Servico</Text>}
      </Pressable>
      {!isDemo && (
        <Pressable onPress={() => setShowBatchModal(true)} style={[s.batchBtn, isMobileNarrow && s.btnIconOnly]}>
          <Icon name="layers" size={14} color={Colors.violet3} />
          {!isMobileNarrow && <Text style={s.batchBtnText}>+ Em lote</Text>}
        </Pressable>
      )}
      {!isDemo && (
        <Pressable onPress={() => setShowDanfeModal(true)} style={[s.danfeBtn, isMobileNarrow && s.btnIconOnly]}>
          <Icon name="file_text" size={14} color={Colors.violet3} />
          {!isMobileNarrow && <Text style={s.danfeBtnText}>Importar DANFE</Text>}
        </Pressable>
      )}
      {/* 12/05/2026: botao Selecionar — toggle bulk mode. So aparece se ja tem produto e usuario nao e demo. */}
      {!isDemo && products.length > 0 && (
        <Pressable
          onPress={() => { if (bulkMode) { exitBulkMode(); } else { setBulkMode(true); } }}
          style={[s.bulkBtn, bulkMode && s.bulkBtnActive, isMobileNarrow && s.btnIconOnly]}
        >
          <Icon name="check" size={14} color={bulkMode ? "#fff" : Colors.violet3} />
          {!isMobileNarrow && <Text style={[s.bulkBtnText, bulkMode && { color: "#fff" }]}>
            {bulkMode ? "Sair da selecao" : "Selecionar"}
          </Text>}
        </Pressable>
      )}
      <Pressable onPress={() => { setEditProduct(null); setShowAddForm(true); setShowServiceForm(false); setActiveTab(0); }} style={s.addBtn}>
        <Icon name="package" size={14} color="#fff" />
        <Text style={s.addBtnText}>+ Produto</Text>
      </Pressable>
    </>
  );

  // 12/05/2026: barra de acoes em lote. Renderizada quando bulkMode=true.
  // Mostra contador + select-all + delete + cancel. Botoes propagam pros
  // handlers ja existentes (handleSelectAll, setShowBulkConfirm, exitBulkMode).
  const BulkActionBar = () => {
    if (!bulkMode) return null;
    const allSelected = filtered.length > 0 && bulkSelected.size === filtered.length;
    return (
      <View style={s.bulkBar}>
        <Text style={s.bulkCount}>
          {bulkSelected.size} de {filtered.length} selecionado{bulkSelected.size === 1 ? "" : "s"}
        </Text>
        <Pressable onPress={handleSelectAll} style={s.bulkAction} disabled={filtered.length === 0}>
          <Text style={s.bulkActionText}>
            {allSelected ? "Limpar selecao" : "Selecionar todos"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { if (bulkSelected.size > 0) setShowBulkConfirm(true); }}
          disabled={bulkSelected.size === 0}
          style={[s.bulkAction, s.bulkDeleteAction, bulkSelected.size === 0 && { opacity: 0.4 }]}
        >
          <Text style={[s.bulkActionText, { color: Colors.red }]}>
            Excluir{bulkSelected.size > 0 ? " (" + bulkSelected.size + ")" : ""}
          </Text>
        </Pressable>
        <Pressable onPress={exitBulkMode} style={s.bulkAction}>
          <Text style={s.bulkActionText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={s.wrapper}>
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={isWebWide ? s.contentWide : s.content}>
        {isWebWide ? (
          <>
            <EstoqueHero totalProducts={products.length} totalUnits={totalItems} lowCount={lowStock.length} />
            <View style={[s.headerRow, { marginBottom: 18, marginTop: 4 }]}>
              <View style={s.headerActions}>
                <ActionButtons />
              </View>
            </View>
          </>
        ) : (
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle}>Estoque</Text>
            </View>
            <View style={s.headerActions}>
              <ActionButtons />
            </View>
          </View>
        )}

        {canLinkProducts && products.length > 0 && (
          <View style={s.multicnpjHint}>
            <Icon name="bag" size={14} color="#7c3aed" />
            <Text style={s.multicnpjHintText}>
              Você tem {availableCompanies.length} CNPJs. Toque em qualquer produto e use "🔗 Vincular CNPJ" para somar estoque entre lojas.
            </Text>
          </View>
        )}

        {products.length > 0 && (
          isWebWide ? (
            <EstoqueKpiStrip
              totalValue={totalValue}
              totalProducts={products.length}
              totalUnits={totalItems}
              lowCount={lowStock.length}
              onLowClick={lowStock.length > 0 ? () => setActiveTab(1) : undefined}
            />
          ) : (
            <View style={s.summaryRow}>
              <SummaryCard label="TOTAL PRODUTOS" value={String(products.length)} sub={`${totalItems} unidades` + (serviceCount > 0 ? ` + ${serviceCount} servico${serviceCount > 1 ? "s" : ""}` : "")} />
              <SummaryCard label="VALOR EM ESTOQUE" value={fmt(totalValue)} />
              <SummaryCard label="ESTOQUE BAIXO" value={String(lowStock.length)} color={lowStock.length > 0 ? Colors.red : Colors.green} sub={lowStock.length > 0 ? "Ver alertas" : "Tudo OK"} onPress={lowStock.length > 0 ? () => setActiveTab(1) : undefined} />
            </View>
          )
        )}

        {dupGroupsCount > 0 && !isDemo && (
          <Pressable onPress={() => setShowMergeModal(true)} style={s.dupBanner}>
            <View style={s.dupBannerIcon}><Text style={s.dupBannerIconText}>!</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.dupBannerTitle}>{dupGroupsCount} grupo{dupGroupsCount > 1 ? "s" : ""} de produtos duplicados</Text>
              <Text style={s.dupBannerDesc}>Produtos com o mesmo nome podem ser unificados em variantes (cor/tamanho).</Text>
            </View>
            <View style={s.dupBannerCta}><Text style={s.dupBannerCtaText}>Unificar</Text><Text style={s.dupBannerArrow}>{"›"}</Text></View>
          </Pressable>
        )}

        {isLoading && <ListSkeleton rows={4} showCards />}

        {!isLoading && products.length === 0 && !isDemo && (
          <View>
            <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Cadastre seu primeiro produto ou servico, ou importe de uma planilha." actionLabel="+ Adicionar produto" onAction={() => { setShowAddForm(true); setActiveTab(0); }} />
            <View style={s.emptyImport}>
              <View style={s.emptyImportIcon}><Icon name="layers" size={18} color={Colors.violet3} /></View>
              <View style={{ flex: 1 }}><Text style={s.emptyImportTitle}>Adicionar em lote</Text><Text style={s.emptyImportDesc}>Cole varios produtos de uma vez e cadastre em segundos</Text></View>
              <Pressable onPress={() => setShowBatchModal(true)} style={s.batchBtnSmall}>
                <Text style={s.batchBtnSmallText}>Abrir</Text>
              </Pressable>
            </View>
            <View style={s.emptyImport}>
              <View style={s.emptyImportIcon}><Icon name="file_text" size={18} color={Colors.violet3} /></View>
              <View style={{ flex: 1 }}><Text style={s.emptyImportTitle}>Importar DANFE (XML)</Text><Text style={s.emptyImportDesc}>Cadastre todos os produtos de uma nota fiscal — selecione o arquivo .xml gerado pela SEFAZ</Text></View>
              <Pressable onPress={() => setShowDanfeModal(true)} style={s.batchBtnSmall}>
                <Text style={s.batchBtnSmallText}>Abrir</Text>
              </Pressable>
            </View>
            <View style={s.emptyImport}>
              <View style={s.emptyImportIcon}><Icon name="upload" size={18} color={Colors.violet3} /></View>
              <View style={{ flex: 1 }}><Text style={s.emptyImportTitle}>Importar planilha CSV</Text><Text style={s.emptyImportDesc}>Cadastre centenas de produtos via arquivo CSV</Text></View>
              <ServerImport entity="products" onComplete={handleImportComplete} />
            </View>
          </View>
        )}

        {products.length > 0 && <TabBar active={activeTab} onSelect={handleTabSelect} />}

        {products.length > 0 && activeTab === 0 && (
          <View>
            <View style={s.searchRow} ref={scanRef as any}>
              <TextInput
                style={s.searchInput}
                placeholder="Buscar por nome, código, SKU ou código de barras..."
                placeholderTextColor={Colors.ink3}
                value={search}
                onChangeText={setSearch}
              />
              <Pressable onPress={() => setScanOpen(o => !o)} style={[s.scanBtn, scanOpen && s.scanBtnActive]}>
                <Icon name="barcode" size={20} color={scanOpen ? "#fff" : Colors.violet3} />
              </Pressable>
              {scanOpen && (
                <View style={s.scanPop}>
                  <Text style={s.scanPopTitle}>Bipar código de barras</Text>
                  <View style={s.scanInputRow}>
                    <Icon name="barcode" size={16} color={Colors.violet3} />
                    <TextInput
                      ref={scanInputRef}
                      style={s.scanInput}
                      placeholder="Bipe ou digite o código…"
                      placeholderTextColor={Colors.ink3}
                      value={scanText}
                      onChangeText={setScanText}
                      onSubmitEditing={applyScan}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    <Pressable
                      onPress={applyScan}
                      disabled={!scanText.trim()}
                      style={[s.scanApply, !scanText.trim() && { opacity: 0.4 }]}
                    >
                      <Text style={s.scanApplyTxt}>Aplicar</Text>
                    </Pressable>
                  </View>
                  <Text style={s.scanPopHint}>
                    Aponte o leitor USB ou digite manualmente. Aceita código de barras, SKU ou código interno.
                  </Text>
                </View>
              )}
            </View>
            {/* Sort + view toggle */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Text style={s.sortLabel}>Ordenar:</Text>
              {(["recent", "price_desc", "price_asc", "low_stock"] as const).map((key) => {
                const opts: Record<string, string> = { recent: "🕐 Últimos adicionados", price_desc: "↑ Maior preço", price_asc: "↓ Menor preço", low_stock: "⚠ Menor estoque" };
                return (
                  <Pressable key={key} onPress={() => setSortOrder(key)} style={[s.sortChip, sortOrder === key && s.sortChipActive]}>
                    <Text style={[s.sortChipText, sortOrder === key && s.sortChipTextActive]}>{opts[key]}</Text>
                  </Pressable>
                );
              })}
              {isWebWide && Platform.OS === "web" ? (
                <>
                  <View style={{ width: 12 } as any} />
                  <View style={s.viewToggleWrap}>
                    <Pressable onPress={() => setView("table")} style={[s.viewToggleBtn, view === "table" && s.viewToggleBtnActive]}>
                      <Icon name="menu" size={14} color={view === "table" ? "#fff" : Colors.ink3} />
                    </Pressable>
                    <Pressable onPress={() => setView("grid")} style={[s.viewToggleBtn, view === "grid" && s.viewToggleBtnActive]}>
                      <Icon name="grid" size={14} color={view === "grid" ? "#fff" : Colors.ink3} />
                    </Pressable>
                  </View>
                </>
              ) : null}
            </ScrollView>

            {/* Category filter — multi-select dropdown (wide) ou ScrollableChips (narrow) */}
            {isWebWide ? (
              <View style={{ marginBottom: 14 } as any}>
                <CategoryDropdownWeb categories={allCategories} selected={catsMulti} onChange={setCatsMulti} />
              </View>
            ) : (
              <ScrollableChips items={filterCategories} active={catFilter} onSelect={setCatFilter} />
            )}

            {/* 12/05/2026: barra de acoes em lote — visivel apenas quando bulkMode=true */}
            <BulkActionBar />

            {/* List view: ProductTableWeb / ProductGridWeb (wide) ou ProductRow (narrow) */}
            {isWebWide ? (
              <View style={{ marginBottom: 12 } as any}>
                {view === "table" ? (
                  <ProductTableWeb
                    items={paginated}
                    onEdit={!isDemo ? handleEdit : undefined}
                    onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined}
                    onLink={canLinkProducts ? (p) => setLinkTarget(p) : undefined}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected}
                    onSelect={toggleBulkSelect}
                    canLink={canLinkProducts}
                  />
                ) : (
                  <ProductGridWeb
                    items={paginated}
                    onEdit={!isDemo ? handleEdit : undefined}
                    onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined}
                    onLink={canLinkProducts ? (p) => setLinkTarget(p) : undefined}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected}
                    onSelect={toggleBulkSelect}
                    canLink={canLinkProducts}
                  />
                )}
              </View>
            ) : (
              <View style={s.listCard}>
                {paginated.map(p => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onDelete={!isDemo && !bulkMode ? (id) => setDeleteTarget(id) : undefined}
                    onEdit={!isDemo && !bulkMode ? handleEdit : undefined}
                    onLink={canLinkProducts && !bulkMode ? (prod) => setLinkTarget(prod) : undefined}
                    isSelected={bulkSelected.has(p.id)}
                    onSelect={bulkMode ? toggleBulkSelect : undefined}
                  />
                ))}
                {filtered.length === 0 && <View style={{ alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
              </View>
            )}
            <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
          </View>
        )}

        {/* Aba 1: Alertas (era 2 antes da Curva ABC migrar) */}
        {activeTab === 1 && <AlertsList products={products} />}
        {/* Aba 2: Etiquetas (era 3 antes da Curva ABC migrar) */}
        {activeTab === 2 && <PrintLabels products={products} selectedIds={labelSelection} onSelectionChange={setLabelSelection} />}

      </ScrollView>

      {/* === Modais e overlays — fora do ScrollView para renderizar fixos na viewport === */}
      <ConfirmDialog visible={!!deleteTarget} title="Excluir produto?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => { if (deleteTarget) { deleteProduct(deleteTarget); setDeleteTarget(null); refetchDupGroups(); } }} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog visible={showBulkConfirm} title={`Excluir ${bulkSelected.size} produto${bulkSelected.size > 1 ? "s" : ""}`} message="Esta acao nao pode ser desfeita. Todos os produtos selecionados serao removidos permanentemente." confirmLabel="Excluir todos" destructive onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }} onCancel={() => setShowBulkConfirm(false)} />
      <MergeDuplicatesModal visible={showMergeModal} onClose={() => setShowMergeModal(false)} onComplete={() => { qc.invalidateQueries({ queryKey: ["products", company?.id] }); refetchDupGroups(); }} />
      <QuickBatchProductsModal visible={showBatchModal} onClose={() => setShowBatchModal(false)} allCategories={allCategories} />
      {company?.id && (
        <DanfeImportModal
          visible={showDanfeModal}
          companyId={company.id}
          onClose={() => setShowDanfeModal(false)}
          onSuccess={() => handleImportComplete()}
        />
      )}
      <CategoriesModal
        visible={categoriesModal.open}
        initialType={categoriesModal.initialType}
        onClose={() => setCategoriesModal({ open: false })}
      />
      {linkTarget && company?.id && (
        <LinkProductModal
          visible={!!linkTarget}
          companyId={company.id}
          productId={linkTarget.id}
          onClose={() => setLinkTarget(null)}
          onLinked={() => {
            qc.invalidateQueries({ queryKey: ["products", company?.id] });
            qc.invalidateQueries({ queryKey: ["productsAggregated"] });
          }}
        />
      )}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}

      {/* ─── Modal de adicionar/editar (padrão do Lançamento Financeiro) ──
          WebPortal escapa do wrapper (position: relative) e renderiza
          direto no document.body como position: fixed full-screen.
          Modal centralizado, maxWidth 540, maxHeight 92% — ScrollView
          interno com flex: 1 garante que TODO o conteúdo possa ser
          rolado, inclusive o footer com Cancelar/Salvar (que antes
          ficava cortado no bottom-sheet).
      ──────────────────────────────────────────────────────────────────── */}
      <WebPortal active={formOpen}>
        <Pressable style={s.formOverlay} onPress={closeFormModal}>
          <Pressable style={s.formSheet} onPress={() => {}}>
            <ScrollView
              style={{ flex: 1 }}
              bounces={false}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
            >
              {showServiceForm && (
                <AddServiceForm
                  onSave={handleSaveProduct}
                  onCancel={closeFormModal}
                  onOpenCategories={() => setCategoriesModal({ open: true, initialType: "service" })}
                />
              )}
              {showAddForm && (
                <AddProductForm
                  categories={allCategories}
                  onSave={handleSaveProduct}
                  onCancel={closeFormModal}
                  editProduct={editProduct}
                />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </WebPortal>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1, position: "relative" },
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  // Wide layout: max-width maior pra acomodar Hero + Table; padding reduzido.
  contentWide: { padding: 28, paddingBottom: 60, maxWidth: 1480, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 8, flexWrap: "wrap" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  serviceBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  serviceBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  batchBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  batchBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  danfeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(124,58,237,0.18)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.35)", borderStyle: "dashed" as any },
  danfeBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  batchBtnSmall: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  batchBtnSmallText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  btnIconOnly: { paddingHorizontal: 10, gap: 0 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  cardSub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  catBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  catBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  // 12/05/2026: bulkBtn agora vive no header (junto com Servico/Lote/DANFE/Produto).
  // bulkBtnActive aplica quando bulkMode=true pra dar feedback visual.
  bulkBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  bulkBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  dupBtn: { backgroundColor: Colors.amberD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" },
  dupBtnText: { fontSize: 12, color: Colors.amber, fontWeight: "700" },
  bulkBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount: { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, position: "relative", zIndex: 50 },
  searchInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  scanBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  scanBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  scanPop: {
    position: "absolute",
    top: 50, right: 0,
    width: 360, maxWidth: "100%" as any,
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
    padding: 14,
    zIndex: 999,
    ...(Platform.OS === "web" ? {
      boxShadow: "0 20px 40px -10px rgba(124,58,237,0.25)",
    } as any : {}),
  } as any,
  scanPopTitle: {
    fontSize: 10, fontWeight: "700", color: Colors.ink3,
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10,
  },
  scanInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.bg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1.5, borderColor: "rgba(124,58,237,0.4)",
  },
  scanInput: {
    flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "500",
    paddingVertical: 10,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
  } as any,
  scanApply: {
    backgroundColor: Colors.violet,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scanApplyTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  scanPopHint: {
    fontSize: 10, color: Colors.ink3, marginTop: 8,
    lineHeight: 14,
  },
  sortLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.8, alignSelf: "center" as const, marginRight: 2 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  sortChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  sortChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" as const },
  sortChipTextActive: { color: "#fff", fontWeight: "600" as const },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  emptyImport: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginTop: 12 },
  emptyImportIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  emptyImportTitle: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  emptyImportDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  dupBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fef3c7", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", marginBottom: 16 },
  dupBannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center" },
  dupBannerIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  dupBannerTitle: { fontSize: 13, fontWeight: "700", color: "#78350f" },
  dupBannerDesc: { fontSize: 11.5, color: "#92400e", marginTop: 2, lineHeight: 16 },
  dupBannerCta: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f59e0b", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  dupBannerCtaText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  dupBannerArrow: { fontSize: 14, color: "#fff", fontWeight: "800" },
  multicnpjHint: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#7c3aed10", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#7c3aed30", marginBottom: 16,
  },
  multicnpjHintText: { fontSize: 11.5, color: Colors.ink, flex: 1, lineHeight: 16 },
  // Overlay do modal de adicionar/editar produto — padrão centralizado
  // (mesmo do TransactionModal/Lançamento Financeiro). WebPortal renderiza
  // este overlay direto no document.body, então position: fixed cobre a
  // tela inteira (incluindo a sidebar) e não fica preso no wrapper.
  formOverlay: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  formSheet: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    width: "92%",
    maxWidth: 540,
    maxHeight: "92%",
    // display: flex implícito via View — ScrollView com flex: 1 ocupa
    // a altura disponível e habilita scroll interno do conteúdo.
    overflow: "hidden",
  },
  // Estoque Premium v2 (08/05/2026) — view toggle (table/grid)
  viewToggleWrap: {
    flexDirection: "row",
    backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 3, gap: 2,
  },
  viewToggleBtn: {
    width: 32, height: 28, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.violet,
  },
});
