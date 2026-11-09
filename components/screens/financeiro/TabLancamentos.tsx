import { useState, useMemo, useEffect } from "react";
import { casaComFiltro, normalizarCategoria } from "@/utils/categoriasFinanceiro";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { ImportExportBar } from "@/components/ImportExportBar";
import { TransactionRow } from "./TransactionRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { ReconciliationSection } from "./ReconciliationSection";
import { Icon } from "@/components/Icon";
import type { Transaction } from "./types";
import { fmt } from "./types";

var isWeb = Platform.OS === "web";
var PAGE_SIZE = 50;

// Ordem preferida das categorias conhecidas. NAO e mais uma lista fechada:
// ver presentCats abaixo.
var CAT_ORDER = ["Vendas", "Servicos", "Crediário", "Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Investimentos", "Outros"];

type Props = {
  transactions: Transaction[];
  isLoading: boolean;
  importing: boolean;
  // FIX A7 (24/08/2026): eram obrigatorios e a tela os passava sempre, mesmo
  // em modo consolidado — onde criar/importar nao funciona. O botao aparecia,
  // o usuario clicava e levava um toast de erro. Agora chegam undefined em
  // consolidado e o botao simplesmente nao existe, igual a Topbar ja fazia.
  onNewTransaction?: () => void;
  onExport: () => void;
  onImport?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
  // 08/11/2026 (p-82): "Ver lançamentos" das compras de mercadoria abre a
  // lista já filtrada (saídas de Fornecedores). `n` muda a cada clique, para
  // reaplicar o filtro mesmo se a pessoa o tirou.
  // 09/11/2026: subcategoria opcional ("" = sem subcategoria) — vem do bloco
  // de categorias da aba Despesas (mockup, seção D).
  filtroInicial?: { categoria: string; subcategoria?: string | null; tipo: "income" | "expense"; n: number } | null;
};

function groupByDay(txs: Transaction[]): { date: string; label: string; items: Transaction[]; income: number; expense: number }[] {
  var map: Record<string, Transaction[]> = {};
  txs.forEach(function(t) {
    var raw = (t as any).due_date || (t as any).created_at || t.date || "";
    var key = "";
    if (raw && raw.length >= 10) {
      try {
        var d = new Date(raw);
        if (!isNaN(d.getTime())) {
          var isDueDate = raw.length === 10;
          key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: isDueDate ? "UTC" : "America/Sao_Paulo" });
        }
      } catch {}
    }
    if (!key) key = "Sem data";
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });
  return Object.entries(map).map(function(entry) {
    var items = entry[1];
    var inc = items.filter(function(t) { return t.type === "income"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    var exp = items.filter(function(t) { return t.type === "expense"; }).reduce(function(s, t) { return s + t.amount; }, 0);
    return { date: entry[0], label: entry[0], items: items, income: inc, expense: exp };
  });
}

export function TabLancamentos({ transactions, isLoading, importing, onNewTransaction, onExport, onImport, onDelete, onEdit, filtroInicial }: Props) {
  var [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(filtroInicial ? filtroInicial.tipo : "all");
  var [search, setSearch] = useState("");
  var [catFilter, setCatFilterRaw] = useState<string | null>(filtroInicial ? filtroInicial.categoria : null);
  var [subFilter, setSubFilter] = useState<string | null>(filtroInicial && filtroInicial.subcategoria != null ? filtroInicial.subcategoria : null);
  function setCatFilter(c: string | null) { setCatFilterRaw(c); setSubFilter(null); }
  var nDoFiltro = filtroInicial ? filtroInicial.n : 0;
  useEffect(function() {
    if (!filtroInicial) return;
    setTypeFilter(filtroInicial.tipo);
    setCatFilterRaw(filtroInicial.categoria);
    setSubFilter(filtroInicial.subcategoria != null ? filtroInicial.subcategoria : null);
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nDoFiltro]);
  var [showAllCats, setShowAllCats] = useState(false);
  var [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // FIX 24/08/2026: `ALL_CATS` era uma lista FECHADA, e o filtro so oferecia
  // categorias que estivessem nela. Toda categoria que o backend grava e o app
  // nao conhecia ficava invisivel no filtro — inclusive as tres do crediario
  // ('Crediario - A Receber', 'Crediario - Recebido', 'Crediario - Encargos').
  // Pra um cliente que vende quase tudo no crediario, o filtro por categoria
  // simplesmente nao alcancava a maior parte do faturamento dele.
  //
  // Agora a lista sai dos DADOS: as conhecidas primeiro, na ordem de sempre, e
  // as demais em seguida em ordem alfabetica. Nada some por nao estar na lista.
  // 09/11/2026: o rótulo é o nome atual da categoria (category_name) quando o
  // lançamento está ligado, e "Servicos"/"Serviços" viram um chip só.
  var presentCats = useMemo(function() {
    var set = new Set<string>();
    var vistos: Record<string, boolean> = {};
    transactions.forEach(function(t) {
      var nome = t.category_name || t.category;
      if (!nome) return;
      var k = normalizarCategoria(nome);
      if (vistos[k]) return;
      vistos[k] = true; set.add(nome);
    });
    var conhecidas = CAT_ORDER.filter(function(c) { return set.has(c); });
    var resto = Array.from(set)
      .filter(function(c) { return CAT_ORDER.indexOf(c) === -1; })
      .sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });
    return conhecidas.concat(resto);
  }, [transactions]);

  var displayTransactions = useMemo(function() {
    var result = transactions;
    if (typeFilter !== "all") result = result.filter(function(t) { return t.type === typeFilter; });
    if (catFilter) result = result.filter(function(t) { return casaComFiltro(t, catFilter, subFilter); });
    if (search.length >= 2) {
      var q = search.toLowerCase();
      result = result.filter(function(t) {
        return t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || String(t.amount).includes(q);
      });
    }
    return result;
  }, [transactions, typeFilter, catFilter, subFilter, search]);

  // Subcategorias presentes na categoria filtrada (segunda linha de chips).
  var presentSubs = useMemo(function() {
    if (!catFilter) return { subs: [] as string[], semSub: false };
    var vistos: Record<string, boolean> = {};
    var subs: string[] = [];
    var semSub = false;
    transactions.forEach(function(t) {
      if (!casaComFiltro(t, catFilter)) return;
      if (!t.subcategory) { semSub = true; return; }
      var k = normalizarCategoria(t.subcategory);
      if (!vistos[k]) { vistos[k] = true; subs.push(t.subcategory); }
    });
    subs.sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });
    return { subs: subs, semSub: semSub };
  }, [transactions, catFilter]);

  // Reset pagination when filters change
  useMemo(function() { setVisibleCount(PAGE_SIZE); }, [typeFilter, catFilter, subFilter, search]);

  var filteredIncome = useMemo(function() { return displayTransactions.filter(function(t) { return t.type === "income"; }).reduce(function(s, t) { return s + t.amount; }, 0); }, [displayTransactions]);
  var filteredExpense = useMemo(function() { return displayTransactions.filter(function(t) { return t.type === "expense"; }).reduce(function(s, t) { return s + t.amount; }, 0); }, [displayTransactions]);

  // F-04: Paginate — slice displayTransactions, then group by day
  var paginatedTx = useMemo(function() { return displayTransactions.slice(0, visibleCount); }, [displayTransactions, visibleCount]);
  var groups = useMemo(function() { return groupByDay(paginatedTx); }, [paginatedTx]);
  var totalItems = displayTransactions.length;
  var hasMore = totalItems > visibleCount;

  var incomeCount = transactions.filter(function(t) { return t.type === "income"; }).length;
  var expenseCount = transactions.filter(function(t) { return t.type === "expense"; }).length;

  return (
    <View>
      {transactions.length > 0 && (
        <View style={s.importBar}>
          <ImportExportBar onExport={onExport} onImport={!importing ? onImport : undefined} itemCount={displayTransactions.length} />
          {importing && <View style={s.importingBadge}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={s.importingText}>Importando...</Text></View>}
        </View>
      )}

      <View style={s.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar por descrição, categoria ou valor..." placeholderTextColor={Colors.ink3} />
        {search.length > 0 && <Pressable onPress={function() { setSearch(""); }}><Icon name="x" size={12} color={Colors.ink3} /></Pressable>}
      </View>

      <View style={s.typeFilterRow}>
        {(["all", "income", "expense"] as const).map(function(tf) {
          return (
            <Pressable key={tf} onPress={function() { setTypeFilter(tf); }}
              style={[s.typeBtn, typeFilter === tf && s.typeBtnActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.typeText, typeFilter === tf && s.typeTextActive]}>
                {tf === "all" ? "Todos" : tf === "income" ? "Entradas" : "Saídas"}
              </Text>
              <View style={[s.typeBadge, tf === "income" && { backgroundColor: Colors.greenD }, tf === "expense" && { backgroundColor: Colors.redD }]}>
                <Text style={[s.typeBadgeText, tf === "income" && { color: Colors.green }, tf === "expense" && { color: Colors.red }]}>
                  {tf === "all" ? transactions.length : tf === "income" ? incomeCount : expenseCount}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {presentCats.length > 1 && (
        <View style={s.catSection}>
          <View style={s.catRow}>
            <Pressable onPress={function() { setCatFilter(null); }} style={[s.catChip, !catFilter && s.catChipActive]}><Text style={[s.catChipText, !catFilter && s.catChipTextActive]}>Todas</Text></Pressable>
            {(showAllCats ? presentCats : presentCats.slice(0, 5)).map(function(cat) {
              var active = catFilter === cat;
              return (<Pressable key={cat} onPress={function() { setCatFilter(active ? null : cat); }} style={[s.catChip, active && s.catChipActive]}><Text style={[s.catChipText, active && s.catChipTextActive]}>{cat}</Text></Pressable>);
            })}
            {presentCats.length > 5 && (<Pressable onPress={function() { setShowAllCats(!showAllCats); }} style={s.catChip}><Text style={s.catChipText}>{showAllCats ? "Menos" : "+" + (presentCats.length - 5)}</Text></Pressable>)}
          </View>
          {catFilter && presentSubs.subs.length > 0 && (
            <View style={[s.catRow, { marginTop: 6 }]} testID="lancamentos-subcategorias">
              <Pressable onPress={function() { setSubFilter(null); }} style={[s.catChip, subFilter === null && s.catChipActive]}><Text style={[s.catChipText, subFilter === null && s.catChipTextActive]}>Todas de {catFilter}</Text></Pressable>
              {presentSubs.subs.map(function(sub) {
                var active = subFilter !== null && normalizarCategoria(subFilter) === normalizarCategoria(sub);
                return (<Pressable key={sub} onPress={function() { setSubFilter(active ? null : sub); }} style={[s.catChip, active && s.catChipActive]}><Text style={[s.catChipText, active && s.catChipTextActive]}>{sub}</Text></Pressable>);
              })}
              {presentSubs.semSub && (<Pressable onPress={function() { setSubFilter(subFilter === "" ? null : ""); }} style={[s.catChip, subFilter === "" && s.catChipActive]}><Text style={[s.catChipText, subFilter === "" && s.catChipTextActive]}>Sem subcategoria</Text></Pressable>)}
            </View>
          )}
        </View>
      )}

      {displayTransactions.length > 0 && (typeFilter !== "all" || catFilter || search.length >= 2) && (
        <View style={s.filteredTotals}>
          <View style={s.ftItem}><Text style={s.ftLabel}>Entradas</Text><Text style={[s.ftValue, { color: Colors.green }]}>+{fmt(filteredIncome)}</Text></View>
          <View style={[s.ftItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}><Text style={s.ftLabel}>Saídas</Text><Text style={[s.ftValue, { color: Colors.red }]}>-{fmt(filteredExpense)}</Text></View>
          <View style={[s.ftItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}><Text style={s.ftLabel}>Saldo</Text><Text style={[s.ftValue, { color: filteredIncome - filteredExpense >= 0 ? Colors.green : Colors.red }]}>{fmt(filteredIncome - filteredExpense)}</Text></View>
        </View>
      )}

      {displayTransactions.length === 0 && !isLoading && (
        <EmptyState icon="dollar" iconColor={Colors.green} title="Nenhum lançamento" subtitle={search || catFilter ? "Nenhum resultado para os filtros aplicados." : "Lance sua primeira receita ou despesa, ou importe de uma planilha CSV."}
          actionLabel={search || catFilter ? "Limpar filtros" : onNewTransaction ? "Novo lançamento" : undefined}
          onAction={search || catFilter ? function() { setSearch(""); setCatFilter(null); setTypeFilter("all"); } : onNewTransaction}
          secondaryLabel={!search && !catFilter && onImport ? (importing ? "Importando..." : "Importar CSV") : undefined}
          onSecondary={!importing && !search && !catFilter ? onImport : undefined} />
      )}

      {groups.map(function(g) {
        return (
          <View key={g.date} style={s.dayGroup}>
            <View style={s.dayHeader}>
              <Text style={s.dayDate}>{g.label}</Text>
              <View style={s.dayTotals}>
                {g.income > 0 && <Text style={s.dayIncome}>+{fmt(g.income)}</Text>}
                {g.expense > 0 && <Text style={s.dayExpense}>-{fmt(g.expense)}</Text>}
              </View>
            </View>
            <View style={s.listCard}>
              {g.items.map(function(t) { return <TransactionRow key={t.id} item={t} onDelete={onDelete} onEdit={onEdit} />; })}
            </View>
          </View>
        );
      })}

      {/* F-04: Carregar mais */}
      {hasMore && (
        <Pressable onPress={function() { setVisibleCount(function(v) { return v + PAGE_SIZE; }); }} style={s.loadMoreBtn}>
          <Text style={s.loadMoreText}>Carregar mais {Math.min(PAGE_SIZE, totalItems - visibleCount)} de {totalItems - visibleCount} restantes</Text>
        </Pressable>
      )}

      {/* Contador de itens visiveis */}
      {totalItems > 0 && (
        <Text style={s.counterText}>
          Exibindo {Math.min(visibleCount, totalItems)} de {totalItems} lançamentos
        </Text>
      )}

      {/* F2 (24/08/2026): conciliação veio da Visão Geral pra cá. Conferir o
          extrato do banco é uma tarefa sobre a LISTA de lançamentos — na Visão
          Geral era mais um acordeão competindo com o resumo do mês. */}
      {/* Sem gate por transactions.length: quem tem zero lancamento e
          justamente quem pode querer importar o extrato pra comecar. */}
      <CollapsibleSection
        id="conciliacao"
        title="Conferir com o extrato do banco"
        subtitle="Veja quais lançamentos ainda não batem com o extrato"
      >
        <ReconciliationSection />
      </CollapsibleSection>
    </View>
  );
}

var s = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink, padding: 0 } as any,
  typeFilterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  typeBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  typeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  typeTextActive: { color: Colors.violet3, fontWeight: "600" },
  typeBadge: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },
  catSection: { marginBottom: 12 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catChipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  filteredTotals: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  ftItem: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  ftLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  ftValue: { fontSize: 13, fontWeight: "700" },
  dayGroup: { marginBottom: 16 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingHorizontal: 4 },
  dayDate: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  dayTotals: { flexDirection: "row", gap: 10 },
  dayIncome: { fontSize: 11, color: Colors.green, fontWeight: "600" },
  dayExpense: { fontSize: 11, color: Colors.red, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border },
  importBar: { marginBottom: 12 },
  importingBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  importingText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  // F-04: Pagination
  loadMoreBtn: { alignItems: "center", paddingVertical: 14, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, marginBottom: 8 },
  loadMoreText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  counterText: { fontSize: 11, color: Colors.ink3, textAlign: "center", marginBottom: 16 },
});
