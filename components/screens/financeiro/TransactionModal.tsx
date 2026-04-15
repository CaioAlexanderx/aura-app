import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { INCOME_CATS, EXPENSE_CATS } from "./types";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { Icon } from "@/components/Icon";

var isWeb = Platform.OS === "web";

// Date mask: DD/MM/AAAA
function maskDate(v: string): string {
  var d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length >= 5) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

// Convert DD/MM/AAAA to YYYY-MM-DD
function dateToISO(br: string): string | null {
  var parts = br.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  var day = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  var year = parseInt(parts[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020 || year > 2099) return null;
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

// Get today in DD/MM/AAAA format (Brazil timezone)
function todayBR(): string {
  var now = new Date();
  // Use timezone-aware formatting
  var parts = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).split("/");
  return parts.join("/");
}

export function TransactionModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void;
  onSave: (body: { type: string; amount: number; description: string; category: string; due_date?: string }) => void;
}) {
  var [txType, setTxType] = useState<"income" | "expense">("income");
  var [mode, setMode] = useState<"unit" | "batch">("unit");
  var [amount, setAmount] = useState("");
  var [desc, setDesc] = useState("");
  var [category, setCategory] = useState("");
  var [dateStr, setDateStr] = useState(todayBR());
  var [batchText, setBatchText] = useState("");
  var isIncome = txType === "income";
  var cats = isIncome ? INCOME_CATS : EXPENSE_CATS;

  function reset() { setAmount(""); setDesc(""); setCategory(""); setDateStr(todayBR()); setBatchText(""); setMode("unit"); }

  function parseAmount(masked: string): number {
    var nums = unmaskNumber(masked);
    return nums ? parseInt(nums) / 100 : 0;
  }

  function handleSaveUnit() {
    var val = parseAmount(amount);
    if (!val || val <= 0) { toast.error("Informe um valor valido"); return; }
    if (!desc.trim()) { toast.error("Informe uma descricao"); return; }

    // Validate and convert date
    var dueDate: string | undefined;
    if (dateStr.trim()) {
      var iso = dateToISO(dateStr);
      if (!iso) { toast.error("Data invalida. Use DD/MM/AAAA"); return; }
      dueDate = iso;
    }

    onSave({ type: txType, amount: val, description: desc.trim(), category: category || cats[0], due_date: dueDate });
    reset(); onClose();
  }

  function handleSaveBatch() {
    var lines = batchText.trim().split("\n").filter(function(l) { return l.trim(); });
    if (lines.length === 0) { toast.error("Nenhum lancamento"); return; }
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(";").map(function(s) { return s.trim(); });
      if (parts.length < 2) continue;
      var val = parseFloat(parts[1].replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!val || val <= 0) continue;
      // Batch: optional 4th column for date (DD/MM/AAAA)
      var batchDate: string | undefined;
      if (parts[3]) {
        var iso = dateToISO(parts[3]);
        if (iso) batchDate = iso;
      }
      onSave({ type: txType, amount: val, description: parts[0], category: parts[2] || cats[0], due_date: batchDate });
      count++;
    }
    if (count === 0) { toast.error("Formato invalido. Use: descricao;valor;categoria;data"); return; }
    toast.success(count + " lancamentos adicionados");
    reset(); onClose();
  }

  if (!visible) return null;

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.title}>Novo lancamento</Text>
          <Pressable onPress={function() { reset(); onClose(); }} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
        </View>

        <View style={s.toggleRow}>
          <Pressable onPress={function() { setTxType("income"); }} style={[s.toggleBtn, isIncome && { backgroundColor: Colors.greenD, borderColor: Colors.green }]}><Text style={[s.toggleText, isIncome && { color: Colors.green }]}>Receita</Text></Pressable>
          <Pressable onPress={function() { setTxType("expense"); }} style={[s.toggleBtn, !isIncome && { backgroundColor: Colors.redD, borderColor: Colors.red }]}><Text style={[s.toggleText, !isIncome && { color: Colors.red }]}>Despesa</Text></Pressable>
        </View>

        <View style={s.modeRow}>
          {(["unit", "batch"] as const).map(function(m) {
            return <Pressable key={m} onPress={function() { setMode(m); }} style={[s.modeBtn, mode === m && s.modeBtnActive]}><Text style={[s.modeText, mode === m && s.modeTextActive]}>{m === "unit" ? "Unitario" : "Lote"}</Text></Pressable>;
          })}
        </View>

        {mode === "unit" ? (
          <View style={s.form}>
            <View style={s.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Valor (R$)</Text>
                <TextInput style={s.input} value={amount} onChangeText={function(v) { setAmount(maskCurrency(v)); }} placeholder="R$ 0,00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
              </View>
              <View style={{ width: 130 }}>
                <Text style={s.label}>Data</Text>
                <TextInput style={s.input} value={dateStr} onChangeText={function(v) { setDateStr(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
              </View>
            </View>
            <Text style={s.label}>Descricao</Text>
            <TextInput style={s.input} value={desc} onChangeText={setDesc} placeholder="Ex: Venda cliente Maria" placeholderTextColor={Colors.ink3} />
            <Text style={s.label}>Categoria</Text>
            <View style={s.catGrid}>
              {cats.map(function(cat) { return <Pressable key={cat} onPress={function() { setCategory(cat); }} style={[s.catBtn, category === cat && s.catBtnActive]}><Text style={[s.catText, category === cat && s.catTextActive]}>{cat}</Text></Pressable>; })}
            </View>
            <View style={s.dateHint}>
              <Icon name="info" size={11} color={Colors.ink3} />
              <Text style={s.dateHintText}>Altere a data para lancar retroativamente. Padrao: hoje.</Text>
            </View>
            <Pressable onPress={handleSaveUnit} style={[s.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}><Text style={s.saveBtnText}>{isIncome ? "Lancar receita" : "Lancar despesa"}</Text></Pressable>
          </View>
        ) : (
          <View style={s.form}>
            <Text style={s.label}>Lancamentos em lote</Text>
            <Text style={s.hint}>Uma linha por lancamento: descricao;valor;categoria;data (opcional)</Text>
            <TextInput style={[s.input, { minHeight: 120, textAlignVertical: "top" }]} value={batchText} onChangeText={setBatchText} placeholder={"Venda A;150,00;Vendas;10/04/2026\nAluguel;1200,00;Fixas"} placeholderTextColor={Colors.ink3} multiline numberOfLines={6} />
            <Pressable onPress={handleSaveBatch} style={[s.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}><Text style={s.saveBtnText}>Lancar em lote</Text></Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
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
  rowFields: { flexDirection: "row", gap: 10 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  catTextActive: { color: Colors.violet3, fontWeight: "600" },
  dateHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  dateHintText: { fontSize: 10, color: Colors.ink3 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default TransactionModal;
