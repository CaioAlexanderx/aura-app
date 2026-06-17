// components/screens/financeiro/ExportDreModal.tsx
//
// Modal acionado pelo botão "Exportar" da topbar do Financeiro. Escolhe o
// período (atalhos + intervalo personalizado) e exporta um PDF no modelo DRE
// (utils/dreReport). Busca os lançamentos do período no momento da exportação
// — independente do filtro de período da própria tela.
//
// Individual: GET /companies/:id/transactions. Consolidado (multi-CNPJ):
// /me/transactions (com company_name por lançamento, usado na seção por empresa).
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, TextInput, ActivityIndicator, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { meAggregatesApi } from "@/services/meAggregates";
import type { Transaction } from "./types";
import { exportDreReport } from "@/utils/dreReport";

var isWeb = Platform.OS === "web";

type Props = {
  visible: boolean;
  onClose: () => void;
  consolidated: boolean;
  companyName: string;
  companyCount: number;
};

type RangeKey = "month" | "prev_month" | "year" | "custom";

function toISO(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function maskDate(v: string): string {
  var d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length >= 5) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}
function brToISO(br: string): string | null {
  var p = br.split("/");
  if (p.length !== 3 || p[2].length !== 4) return null;
  var d = parseInt(p[0]), m = parseInt(p[1]), y = parseInt(p[2]);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020) return null;
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

// Resolve {start,end,label} ISO a partir do atalho selecionado.
function resolveRange(key: RangeKey, customStartISO?: string, customEndISO?: string): { start: string; end: string; label: string } | null {
  var now = new Date();
  if (key === "month") {
    var s = new Date(now.getFullYear(), now.getMonth(), 1);
    var e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    var nm = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { start: toISO(s), end: toISO(e), label: nm.charAt(0).toUpperCase() + nm.slice(1) };
  }
  if (key === "prev_month") {
    var pm = now.getMonth() - 1, py = now.getFullYear();
    if (pm < 0) { pm = 11; py--; }
    var ps = new Date(py, pm, 1), pe = new Date(py, pm + 1, 0);
    var pnm = ps.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { start: toISO(ps), end: toISO(pe), label: pnm.charAt(0).toUpperCase() + pnm.slice(1) };
  }
  if (key === "year") {
    return { start: toISO(new Date(now.getFullYear(), 0, 1)), end: toISO(new Date(now.getFullYear(), 11, 31)), label: String(now.getFullYear()) };
  }
  // custom
  if (customStartISO && customEndISO) {
    var sl = customStartISO.slice(8, 10) + "/" + customStartISO.slice(5, 7) + "/" + customStartISO.slice(0, 4);
    var el = customEndISO.slice(8, 10) + "/" + customEndISO.slice(5, 7) + "/" + customEndISO.slice(0, 4);
    return { start: customStartISO, end: customEndISO, label: sl + " a " + el };
  }
  return null;
}

function mapTx(t: any): Transaction {
  return {
    id: t.id || String(Math.random()),
    date: t.date || "",
    desc: t.description || t.desc || "Lancamento",
    type: t.type === "expense" ? "expense" : "income",
    category: t.category || "Outros",
    amount: parseFloat(t.amount) || 0,
    status: t.status === "pending" ? "pending" : "confirmed",
    source: t.source || "manual",
    due_date: t.due_date || null,
    created_at: t.created_at || null,
    paid_at: t.paid_at || null,
    company_id: t.company_id || null,
    company_name: t.company_name || null,
  } as Transaction;
}

export function ExportDreModal({ visible, onClose, consolidated, companyName, companyCount }: Props) {
  var { company, token } = useAuthStore();
  var [rangeKey, setRangeKey] = useState<RangeKey>("month");
  var [startBR, setStartBR] = useState("");
  var [endBR, setEndBR] = useState("");
  var [loading, setLoading] = useState(false);

  var customStartISO = brToISO(startBR) || undefined;
  var customEndISO = brToISO(endBR) || undefined;

  var SHORTCUTS: { key: RangeKey; label: string }[] = [
    { key: "month", label: "Mês atual" },
    { key: "prev_month", label: "Mês passado" },
    { key: "year", label: "Ano" },
    { key: "custom", label: "Personalizado" },
  ];

  async function handleExport() {
    var range = resolveRange(rangeKey, customStartISO, customEndISO);
    if (!range) { toast.error("Informe as datas De e Até"); return; }
    if (!consolidated && !company?.id) { toast.error("Empresa não identificada"); return; }
    if (!token) { toast.error("Sessão expirada"); return; }

    setLoading(true);
    try {
      var resp: any;
      if (consolidated) {
        resp = await meAggregatesApi.transactions({ start: range.start, end: range.end, limit: 5000 });
      } else {
        var params = "limit=5000&start=" + range.start + "&end=" + range.end;
        resp = await companiesApi.transactions(company!.id, params);
      }
      var raw = (resp && (resp.transactions || resp.rows)) || [];
      if (!(raw instanceof Array)) raw = [];
      var txs = raw.map(mapTx);

      var label = consolidated
        ? "Consolidado · " + companyCount + " empresa" + (companyCount !== 1 ? "s" : "")
        : (companyName || "Sua empresa");

      var ok = exportDreReport({
        periodLabel: range.label,
        companyLabel: label,
        consolidated: consolidated,
        transactions: txs,
      });
      if (!ok) { toast.error("Permita pop-ups para gerar o PDF"); setLoading(false); return; }
      toast.success("DRE gerado · use \"Salvar como PDF\" na impressão");
      onClose();
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Erro ao exportar");
    } finally {
      setLoading(false);
    }
  }

  var body = (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.titleWrap}>
          <View style={s.titleIcon}><Icon name="file_text" size={16} color={Colors.violet3} /></View>
          <View>
            <Text style={s.title}>Exportar DRE</Text>
            <Text style={s.subtitle}>Receitas e despesas do período em PDF</Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn}>
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      {consolidated && (
        <View style={s.consolidatedNote}>
          <Icon name="globe" size={12} color={Colors.violet3} />
          <Text style={s.consolidatedText}>Consolidado · {companyCount} empresas (DRE somado + por empresa)</Text>
        </View>
      )}

      <Text style={s.label}>Período</Text>
      <View style={s.chips}>
        {SHORTCUTS.map(function (sc) {
          var active = rangeKey === sc.key;
          return (
            <Pressable key={sc.key} onPress={function () { setRangeKey(sc.key); }} style={[s.chip, active && s.chipActive]}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{sc.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {rangeKey === "custom" && (
        <View style={s.customRow}>
          <View style={s.customField}>
            <Text style={s.customLabel}>De</Text>
            <TextInput style={s.input} value={startBR} onChangeText={function (v) { setStartBR(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
          </View>
          <View style={s.customField}>
            <Text style={s.customLabel}>Até</Text>
            <TextInput style={s.input} value={endBR} onChangeText={function (v) { setEndBR(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} />
          </View>
        </View>
      )}

      <Pressable onPress={handleExport} disabled={loading} style={[s.exportBtn, loading && { opacity: 0.6 }]}>
        {loading ? <ActivityIndicator color="#fff" size="small" /> : (
          <>
            <Icon name="download" size={15} color="#fff" />
            <Text style={s.exportText}>Exportar PDF</Text>
          </>
        )}
      </Pressable>
      <Text style={s.hint}>Abre a janela de impressão — escolha "Salvar como PDF".</Text>
    </View>
  );

  if (!visible) return null;

  if (isWeb) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" } as any} onClick={onClose}>
        <div onClick={function (e: any) { e.stopPropagation(); }} style={{ width: "100%", maxWidth: 440, padding: 16 } as any}>
          {body}
        </div>
      </div>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.nativeWrap}>{body}</View>
    </Modal>
  );
}

var s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  nativeWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  card: { width: "100%", maxWidth: 440, backgroundColor: Colors.bg2, borderRadius: 18, borderWidth: 1, borderColor: Colors.border2, padding: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  titleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  consolidatedNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 14, borderWidth: 1, borderColor: Colors.border2 },
  consolidatedText: { fontSize: 11, color: Colors.violet3, fontWeight: "600", flex: 1 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: Colors.ink3, textTransform: "uppercase", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipText: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  customRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  customField: { flex: 1 },
  customLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  input: { backgroundColor: Colors.bg4, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, textAlign: "center" },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, marginTop: 20 },
  exportText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  hint: { fontSize: 11, color: Colors.ink3, textAlign: "center", marginTop: 10 },
});

export default ExportDreModal;
