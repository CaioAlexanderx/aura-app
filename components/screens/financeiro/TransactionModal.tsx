import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { INCOME_CATS, EXPENSE_CATS } from "./types";
import { maskCurrency, unmaskNumber } from "@/utils/masks";

export function TransactionModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void;
  onSave: (body: { type: string; amount: number; description: string; category: string }) => void;
}) {
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [mode, setMode] = useState<"unit" | "batch">("unit");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("");
  const [batchText, setBatchText] = useState("");
  const isIncome = txType === "income";
  const cats = isIncome ? INCOME_CATS : EXPENSE_CATS;

  function reset() { setAmount(""); setDesc(""); setCategory(""); setBatchText(""); setMode("unit"); }

  // A1: Parse masked currency value
  function parseAmount(masked: string): number {
    const nums = unmaskNumber(masked);
    return nums ? parseInt(nums) / 100 : 0;
  }

  function handleSaveUnit() {
    const val = parseAmount(amount);
    if (!val || val <= 0) { toast.error("Informe um valor valido"); return; }
    if (!desc.trim()) { toast.error("Informe uma descricao"); return; }
    onSave({ type: txType, amount: val, description: desc.trim(), category: category || cats[0] });
    reset(); onClose();
  }

  function handleSaveBatch() {
    const lines = batchText.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) { toast.error("Nenhum lancamento"); return; }
    let count = 0;
    for (const line of lines) {
      const parts = line.split(";").map(s => s.trim());
      if (parts.length < 2) continue;
      const val = parseFloat(parts[1].replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!val || val <= 0) continue;
      onSave({ type: txType, amount: val, description: parts[0], category: parts[2] || cats[0] });
      count++;
    }
    if (count === 0) { toast.error("Formato invalido. Use: descricao;valor;categoria"); return; }
    toast.success(count + " lancamentos adicionados");
    reset(); onClose();
  }

  if (!visible) return null;

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.title}>Novo lancamento</Text>
          <Pressable onPress={() => { reset(); onClose(); }} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
        </View>

        <View style={s.toggleRow}>
          <Pressable onPress={() => setTxType("income")} style={[s.toggleBtn, isIncome && { backgroundColor: Colors.greenD, borderColor: Colors.green }]}><Text style={[s.toggleText, isIncome && { color: Colors.green }]}>Receita</Text></Pressable>
          <Pressable onPress={() => setTxType("expense")} style={[s.toggleBtn, !isIncome && { backgroundColor: Colors.redD, borderColor: Colors.red }]}><Text style={[s.toggleText, !isIncome && { color: Colors.red }]}>Despesa</Text></Pressable>
        </View>

        <View style={s.modeRow}>
          {(["unit", "batch"] as const).map(m => (
            <Pressable key={m} onPress={() => setMode(m)} style={[s.modeBtn, mode === m && s.modeBtnActive]}><Text style={[s.modeText, mode === m && s.modeTextActive]}>{m === "unit" ? "Unitario" : "Lote"}</Text></Pressable>
          ))}
        </View>

        {mode === "unit" ? (
          <View style={s.form}>
            <Text style={s.label}>Valor (R$)</Text>
            {/* A1: Currency mask — only numbers allowed */}
            <TextInput style={s.input} value={amount} onChangeText={v => setAmount(maskCurrency(v))} placeholder="R$ 0,00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
            <Text style={s.label}>Descricao</Text>
            <TextInput style={s.input} value={desc} onChangeText={setDesc} placeholder="Ex: Venda cliente Maria" placeholderTextColor={Colors.ink3} />
            <Text style={s.label}>Categoria</Text>
            <View style={s.catGrid}>
              {cats.map(cat => <Pressable key={cat} onPress={() => setCategory(cat)} style={[s.catBtn, category === cat && s.catBtnActive]}><Text style={[s.catText, category === cat && s.catTextActive]}>{cat}</Text></Pressable>)}
            </View>
            <Pressable onPress={handleSaveUnit} style={[s.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}><Text style={s.saveBtnText}>{isIncome ? "Lancar receita" : "Lancar despesa"}</Text></Pressable>
          </View>
        ) : (
          <View style={s.form}>
            <Text style={s.label}>Lancamentos em lote</Text>
            <Text style={s.hint}>Uma linha por lancamento: descricao;valor;categoria</Text>
            <TextInput style={[s.input, { minHeight: 120, textAlignVertical: "top" }]} value={batchText} onChangeText={setBatchText} placeholder={"Venda A;150,00;Vendas\nAluguel;1200,00;Fixas"} placeholderTextColor={Colors.ink3} multiline numberOfLines={6} />
            <Pressable onPress={handleSaveBatch} style={[s.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}><Text style={s.saveBtnText}>Lancar em lote</Text></Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  modal: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 28, maxWidth: 480, width: "90%", borderWidth: 1, borderColor: Colors.border2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  toggleText: { fontSize: 14, fontWeight: "600", color: Colors.ink3 },
  modeRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.bg4 },
  modeBtnActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet },
  modeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  modeTextActive: { color: Colors.violet3 },
  form: { gap: 12 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 10, color: Colors.ink3, fontStyle: "italic" },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  catTextActive: { color: Colors.violet3, fontWeight: "600" },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default TransactionModal;
