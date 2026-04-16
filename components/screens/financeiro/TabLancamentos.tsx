import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { EmptyState } from "@/components/EmptyState";
import { ImportExportBar } from "@/components/ImportExportBar";
import { TransactionRow } from "./TransactionRow";
import { Icon } from "@/components/Icon";
import type { Transaction } from "./types";
import { fmt } from "./types";

var isWeb = Platform.OS === "web";
var PAGE_SIZE = 50;

var ALL_CATS = ["Vendas", "Servicos", "Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Investimentos", "Outros"];

type Props = {
  transactions: Transaction[];
  isLoading: boolean;
  importing: boolean;
  onNewTransaction: () => void;
  onExport: () => void;
  onImport: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
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

export function TabLancamentos({ transactions, isLoading, importing, onNewTransaction, onExport, onImport, onDelete, onEdit }: Props) {
  var [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  var [search, setSearch] = useState("");
  var [catFilter, setCatFilter] = useState<string | null>(null);
  var [showAllCats, setShowAllCats] = useState(false);
  var [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  var presentCats = useMemo(function() {
    var set = new Set<string>();
    transactions.forEach(function(t) { if (t.category) set.add(t.category); });
    return ALL_CATS.filter(function(c) { return set.has(c); });
  }, [transactions]);

  var displayTransactions = useMemo(function() {
    var result = transactions;
    if (typeFilter !== "all") result = result.filter(function(t) { return t.type === typeFilter; });
    if (catFilter) result = result.filter(function(t) { return t.category === catFilter; });
    if (search.length >= 2) {
      var q = search.toLowerCase();
      result = result.filter(function(t) {
        return t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || String(t.amount).includes(q);
      });
    }
    return result;
  }, [transactions, typeFilter, catFilter, search]);

  // Reset pagination when filters change
  useMemo(function() { setVisibleCount(PAGE_SIZE); }, [typeFilter, catFilter, search]);

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
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar por descricao, categoria ou valor..." placeholderTextColor={Colors.ink3} />
        {search.length > 0 && <Pressable onPress={function() { setSearch(""); }}><Icon name="x" size={12} color={Colors.ink3} /></Pressable>}
      </View>

      <View style={s.typeFilterRow}>
        {(["all", "income", "expense"] as const).map(function(tf) {
          return (
            <Pressable key={tf} onPress={function() { setTypeFilter(tf); }}
              style={[s.typeBtn, typeFilter === tf && s.typeBtnActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.typeText, typeFilter === tf && s.typeTextActive]}>
                {tf === "all" ? "Todos" : tf === "income" ? "Entradas" : "Saidas"}
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
        </View>
      )}

      {displayTransactions.length > 0 && (typeFilter !== "all" || catFilter || search.length >= 2) && (
        <View style={s.filteredTotals}>
          <View style={s.ftItem}><Text style={s.ftLabel}>Entradas</Text><Text style={[s.ftValue, { color: Colors.green }]}>+{fmt(filteredIncome)}</Text></View>
          <View style={[s.ftItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}><Text style={s.ftLabel}>Saidas</Text><Text style={[s.ftValue, { color: Colors.red }]}>-{fmt(filteredExpense)}</Text></View>
          <View style={[s.ftItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}><Text style={s.ftLabel}>Saldo</Text><Text style={[s.ftValue, { color: filteredIncome - filteredExpense >= 0 ? Colors.green : Colors.red }]}>{fmt(filteredIncome - filteredExpense)}</Text></View>
        </View>
      )}

      {displayTransactions.length === 0 && !isLoading && (
        <EmptyState icon="dollar" iconColor={Colors.green} title="Nenhum lancamento" subtitle={search || catFilter ? "Nenhum resultado para os filtros aplicados." : "Lance sua primeira receita ou despesa, ou importe de uma planilha CSV."}
          actionLabel={search || catFilter ? "Limpar filtros" : "Novo lancamento"}
          onAction={search || catFilter ? function() { setSearch(""); setCatFilter(null); setTypeFilter("all"); } : onNewTransaction}
          secondaryLabel={!search && !catFilter ? (importing ? "Importando..." : "Importar CSV") : undefined}
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
          Exibindo {Math.min(visibleCount, totalItems)} de {totalItems} lancamentos
        </Text>
      )}
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
