// fe20-fe21.js
// Run from aura-app root: node fe20-fe21.js
// FE-20: Transaction entry modal (unit + batch)
// FE-21: Wire shared transaction store into Financeiro

const fs = require('fs');
const p = require('path');
let total = 0;

const fin = p.join('app', '(tabs)', 'financeiro.tsx');

if (!fs.existsSync(fin)) {
  console.log('ERROR: financeiro.tsx not found');
  process.exit(1);
}

let c = fs.readFileSync(fin, 'utf-8');

// ═══════════════════════════════════════════════════
// 1. Add imports for transaction store and new components
// ═══════════════════════════════════════════════════
console.log('\n=== FE-20/21: Adding imports ===');

if (c.includes('useTransactions')) {
  console.log('  SKIP: already applied');
  process.exit(0);
}

// Add TextInput and Modal imports
c = c.replace(
  'import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions }',
  'import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Dimensions, TextInput, Modal }'
);

// Add transaction store import after useAuthStore
c = c.replace(
  'import { useAuthStore } from "@/stores/auth";',
  'import { useAuthStore } from "@/stores/auth";\nimport { useTransactions } from "@/stores/transactions";\nimport { toast } from "@/components/Toast";\nimport { Icon } from "@/components/Icon";'
);
console.log('  OK: imports added');
total++;

// ═══════════════════════════════════════════════════
// 2. Add categories constant
// ═══════════════════════════════════════════════════
c = c.replace(
  "const TABS = [",
  `const INCOME_CATS = ["Vendas", "Servi\\u00e7os", "Outros", "Investimentos"];
const EXPENSE_CATS = ["Fornecedores", "Fixas", "Operacional", "Folha", "Impostos", "Marketing", "Outros"];

const TABS = [`
);
console.log('  OK: categories added');
total++;

// ═══════════════════════════════════════════════════
// 3. Add TransactionModal component before TabBar
// ═══════════════════════════════════════════════════
console.log('\n=== FE-20: Transaction modal ===');

const modalCode = `
// ── FE-20: Transaction Entry Modal ───────────────────────────
function TransactionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { add, addBatch } = useTransactions();
  const [mode, setMode] = useState<"unit" | "batch">("unit");
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [batchText, setBatchText] = useState("");
  const isIncome = txType === "income";
  const cats = isIncome ? INCOME_CATS : EXPENSE_CATS;

  function reset() { setAmount(""); setDesc(""); setCategory(""); setBatchText(""); setMode("unit"); }

  function handleSaveUnit() {
    const val = parseFloat(amount.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!val || val <= 0) { toast.error("Informe um valor v\\u00e1lido"); return; }
    if (!desc.trim()) { toast.error("Informe uma descri\\u00e7\\u00e3o"); return; }
    const cat = category || cats[0];
    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2,"0") + "/" + String(today.getMonth()+1).padStart(2,"0");
    add({ date: dateStr, desc: desc.trim(), type: txType, category: cat, amount: val, status: "confirmed", source: "manual" });
    toast.success(isIncome ? "Receita lan\\u00e7ada" : "Despesa lan\\u00e7ada");
    reset(); onClose();
  }

  function handleSaveBatch() {
    const lines = batchText.trim().split("\\n").filter(l => l.trim());
    if (lines.length === 0) { toast.error("Nenhum lan\\u00e7amento informado"); return; }
    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2,"0") + "/" + String(today.getMonth()+1).padStart(2,"0");
    const items = [];
    for (const line of lines) {
      // Format: descricao;valor;categoria (optional)
      const parts = line.split(";").map(s => s.trim());
      if (parts.length < 2) continue;
      const val = parseFloat(parts[1].replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!val || val <= 0) continue;
      items.push({ date: dateStr, desc: parts[0], type: txType, category: parts[2] || cats[0], amount: val, status: "confirmed" as const, source: "lote" as const });
    }
    if (items.length === 0) { toast.error("Formato inv\\u00e1lido. Use: descri\\u00e7\\u00e3o;valor;categoria"); return; }
    addBatch(items);
    toast.success(items.length + " lan\\u00e7amentos adicionados");
    reset(); onClose();
  }

  if (!visible) return null;

  return (
    <View style={md.overlay}>
      <View style={md.modal}>
        <View style={md.header}>
          <Text style={md.title}>Novo lan\\u00e7amento</Text>
          <Pressable onPress={() => { reset(); onClose(); }} style={md.closeBtn}><Text style={md.closeText}>\\u2715</Text></Pressable>
        </View>

        {/* Type toggle */}
        <View style={md.toggleRow}>
          <Pressable onPress={() => setTxType("income")} style={[md.toggleBtn, isIncome && { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
            <Text style={[md.toggleText, isIncome && { color: Colors.green }]}>Receita</Text>
          </Pressable>
          <Pressable onPress={() => setTxType("expense")} style={[md.toggleBtn, !isIncome && { backgroundColor: Colors.redD, borderColor: Colors.red }]}>
            <Text style={[md.toggleText, !isIncome && { color: Colors.red }]}>Despesa</Text>
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View style={md.modeRow}>
          <Pressable onPress={() => setMode("unit")} style={[md.modeBtn, mode === "unit" && md.modeBtnActive]}>
            <Text style={[md.modeText, mode === "unit" && md.modeTextActive]}>Unit\\u00e1rio</Text>
          </Pressable>
          <Pressable onPress={() => setMode("batch")} style={[md.modeBtn, mode === "batch" && md.modeBtnActive]}>
            <Text style={[md.modeText, mode === "batch" && md.modeTextActive]}>Lote</Text>
          </Pressable>
        </View>

        {mode === "unit" ? (
          <View style={md.form}>
            <View style={md.field}>
              <Text style={md.label}>Valor</Text>
              <TextInput style={md.input} value={amount} onChangeText={setAmount} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
            </View>
            <View style={md.field}>
              <Text style={md.label}>Descri\\u00e7\\u00e3o</Text>
              <TextInput style={md.input} value={desc} onChangeText={setDesc} placeholder="Ex: Venda cliente Maria" placeholderTextColor={Colors.ink3} />
            </View>
            <View style={md.field}>
              <Text style={md.label}>Categoria</Text>
              <View style={md.catGrid}>
                {cats.map(cat => (
                  <Pressable key={cat} onPress={() => setCategory(cat)} style={[md.catBtn, category === cat && md.catBtnActive]}>
                    <Text style={[md.catText, category === cat && md.catTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={handleSaveUnit} style={[md.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}>
              <Text style={md.saveBtnText}>{isIncome ? "Lan\\u00e7ar receita" : "Lan\\u00e7ar despesa"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={md.form}>
            <View style={md.field}>
              <Text style={md.label}>Lan\\u00e7amentos em lote</Text>
              <Text style={md.hint}>Uma linha por lan\\u00e7amento. Formato: descri\\u00e7\\u00e3o;valor;categoria</Text>
              <TextInput
                style={[md.input, md.textarea]}
                value={batchText}
                onChangeText={setBatchText}
                placeholder={"Venda cliente A;150,00;Vendas\\nAluguel;1200,00;Fixas\\nMaterial;45,90;Operacional"}
                placeholderTextColor={Colors.ink3}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            <Pressable onPress={handleSaveBatch} style={[md.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}>
              <Text style={md.saveBtnText}>Lan\\u00e7ar em lote</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const md = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  modal: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 28, maxWidth: 480, width: "90%", borderWidth: 1, borderColor: Colors.border2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 18, color: Colors.ink3 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  toggleText: { fontSize: 14, fontWeight: "600", color: Colors.ink3 },
  modeRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.bg4 },
  modeBtnActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet },
  modeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  modeTextActive: { color: Colors.violet3 },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  textarea: { minHeight: 120, textAlignVertical: "top" as any, paddingTop: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  catTextActive: { color: Colors.violet3, fontWeight: "600" },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

`;

// Insert modal before TabBar function
c = c.replace(
  '// ── Tab Bar',
  modalCode + '// ── Tab Bar'
);
console.log('  OK: TransactionModal component added');
total++;

// ═══════════════════════════════════════════════════
// 4. Wire store into TabLancamentos + add "Novo" button
// ═══════════════════════════════════════════════════
console.log('\n=== FE-21: Wire transaction store ===');

// Replace TabLancamentos to use store instead of MOCK
c = c.replace(
  'function TabLancamentos() {\n  const income = MOCK_TRANSACTIONS.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);\n  const expense = MOCK_TRANSACTIONS.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);\n  return (\n    <View>\n      <View style={g.row}>\n        <SummaryCard label="ENTRADAS" value={fmt(income)} color={Colors.green} />\n        <SummaryCard label="SAIDAS" value={fmt(expense)} color={Colors.red} />\n        <SummaryCard label="SALDO" value={fmt(income - expense)} color={income - expense >= 0 ? Colors.green : Colors.red} />\n      </View>\n      <View style={g.listCard}>\n        {MOCK_TRANSACTIONS.map(t => <TransactionRow key={t.id} item={t} />)}\n      </View>\n    </View>\n  );\n}',
  `function TabLancamentos() {
  const { transactions, totals } = useTransactions();
  const { income, expense, balance } = totals();
  return (
    <View>
      <View style={g.row}>
        <SummaryCard label="ENTRADAS" value={fmt(income)} color={Colors.green} />
        <SummaryCard label="SA\\u00cdDAS" value={fmt(expense)} color={Colors.red} />
        <SummaryCard label="SALDO" value={fmt(balance)} color={balance >= 0 ? Colors.green : Colors.red} />
      </View>
      <View style={g.listCard}>
        {transactions.map(t => <TransactionRow key={t.id} item={t} />)}
      </View>
    </View>
  );
}`
);
console.log('  OK: TabLancamentos wired to store');
total++;

// ═══════════════════════════════════════════════════
// 5. Add modal state + "Novo lancamento" button to main screen
// ═══════════════════════════════════════════════════
c = c.replace(
  'export default function FinanceiroScreen() {\n  const [activeTab, setActiveTab] = useState(0);\n  const { isDemo } = useAuthStore();',
  `export default function FinanceiroScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const { isDemo } = useAuthStore();`
);

// Add modal render + novo button
c = c.replace(
  '  return (\n    <ScrollView style={g.screen} contentContainerStyle={g.content}>\n      <Text style={g.pageTitle}>Financeiro</Text>\n      <TabBar active={activeTab} onSelect={setActiveTab} />',
  `  return (
    <View style={{flex:1}}>
      <TransactionModal visible={showModal} onClose={() => setShowModal(false)} />
      <ScrollView style={g.screen} contentContainerStyle={g.content}>
        <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <Text style={g.pageTitle}>Financeiro</Text>
          <Pressable onPress={() => setShowModal(true)} style={{flexDirection:"row",alignItems:"center",gap:6,backgroundColor:Colors.violet,borderRadius:10,paddingHorizontal:16,paddingVertical:10}}>
            <Icon name="dollar" size={16} color="#fff" />
            <Text style={{color:"#fff",fontSize:13,fontWeight:"700"}}>Novo lan\\u00e7amento</Text>
          </Pressable>
        </View>
        <TabBar active={activeTab} onSelect={setActiveTab} />`
);

// Fix closing - add missing </View>
c = c.replace(
  '    </ScrollView>\n  );\n}',
  '    </ScrollView>\n    </View>\n  );\n}'
);

// Remove old marginBottom from pageTitle since we moved it to the row
c = c.replace(
  "pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: \"700\", marginBottom: 20 }",
  "pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: \"700\" }"
);

console.log('  OK: Modal + "Novo lancamento" button added');
total++;

// ═══════════════════════════════════════════════════
// 6. Add source badge to TransactionRow
// ═══════════════════════════════════════════════════
c = c.replace(
  '<Text style={tr.meta}>{item.date} / {item.category}{item.status === "pending" ? " / Pendente" : ""}</Text>',
  '<Text style={tr.meta}>{item.date} / {item.category}{item.source && item.source !== "manual" ? " / " + (item.source === "pdv" ? "PDV" : item.source === "folha" ? "Folha" : item.source === "estoque" ? "Estoque" : item.source === "lote" ? "Lote" : "") : ""}{item.status === "pending" ? " / Pendente" : ""}</Text>'
);
console.log('  OK: Source badge on transactions');
total++;

fs.writeFileSync(fin, c, 'utf-8');

console.log(`\n========================================`);
console.log(`DONE: ${total} changes applied`);
console.log(`========================================`);
console.log(`\ngit add -A && git commit -m "feat: FE-20 transaction modal (unit+batch) + FE-21 auto-accounting store" && git push`);
