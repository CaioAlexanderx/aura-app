import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-17/B-18: CotaParte — Partner NFS-e + cota-parte (Lei do Salão)

export interface PartnerInvoice { id: string; partner_name: string; partner_type: string; partner_cnpj?: string; professional_name?: string; period_start: string; period_end: string; gross_revenue: number; partner_share: number; salon_share: number; partner_share_pct: number; deductions: number; partner_nfse_status: string; salon_nfse_status: string; partner_nfse_number?: string; }
export interface InvoiceSummary { total_gross: number; total_partner: number; total_salon: number; pending_nfse: number; }

interface Props { invoices: PartnerInvoice[]; summary: InvoiceSummary; onGenerate?: () => void; onUpdateNfse?: (invId: string) => void; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }
const NFSE_ST: Record<string, { color: string; label: string }> = { pendente: { color: "#F59E0B", label: "Pendente" }, emitida: { color: "#10B981", label: "Emitida" }, erro: { color: "#EF4444", label: "Erro" } };

export function CotaParte({ invoices, summary, onGenerate, onUpdateNfse }: Props) {
  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(summary.total_gross)}</Text><Text style={s.kpiLbl}>Receita bruta</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{fmt(summary.total_partner)}</Text><Text style={s.kpiLbl}>Cota parceiro</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: Colors.violet3 }]}>{fmt(summary.total_salon)}</Text><Text style={s.kpiLbl}>Cota salao</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: summary.pending_nfse > 0 ? "#EF4444" : "#10B981" }]}>{summary.pending_nfse}</Text><Text style={s.kpiLbl}>NFS-e pendentes</Text></View>
      </View>
      <View style={s.header}><Text style={s.title}>Cota-parte (Lei do Salao 13.352)</Text>{onGenerate && <Pressable onPress={onGenerate} style={s.addBtn}><Text style={s.addBtnT}>+ Gerar fatura</Text></Pressable>}</View>
      <View style={s.infoBox}><Text style={s.infoText}>A Lei do Salao exige que o parceiro MEI emita NFS-e para o salao, discriminando a cota-parte de cada um. A Aura calcula automaticamente e controla a emissao.</Text></View>
      {invoices.map(inv => (
        <View key={inv.id} style={s.card}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.name}>{inv.partner_name} <Text style={s.type}>({inv.partner_type})</Text></Text>
            {inv.professional_name && <Text style={s.pro}>{inv.professional_name}</Text>}
            <Text style={s.period}>{new Date(inv.period_start).toLocaleDateString("pt-BR")} a {new Date(inv.period_end).toLocaleDateString("pt-BR")}</Text>
            <View style={s.splitRow}>
              <Text style={s.splitLabel}>Bruto: {fmt(inv.gross_revenue)}</Text>
              <Text style={[s.splitLabel, { color: "#F59E0B" }]}>Parceiro ({inv.partner_share_pct}%): {fmt(inv.partner_share)}</Text>
              <Text style={[s.splitLabel, { color: Colors.violet3 }]}>Salao: {fmt(inv.salon_share)}</Text>
            </View>
          </View>
          <View style={s.nfseCol}>
            <View style={s.nfseRow}><Text style={s.nfseLabel}>NFS-e Parceiro:</Text><Text style={{ fontSize: 10, color: NFSE_ST[inv.partner_nfse_status]?.color || "#888" }}>{NFSE_ST[inv.partner_nfse_status]?.label || inv.partner_nfse_status}</Text></View>
            {inv.partner_nfse_number && <Text style={s.nfseNum}>{inv.partner_nfse_number}</Text>}
            {onUpdateNfse && inv.partner_nfse_status === "pendente" && <Pressable onPress={() => onUpdateNfse(inv.id)} style={s.nfseBtn}><Text style={s.nfseBtnT}>Atualizar NFS-e</Text></Pressable>}
          </View>
        </View>
      ))}
      {invoices.length === 0 && <Text style={s.emptyT}>Nenhuma fatura de cota-parte gerada.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: 80, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border, gap: 2 },
  kpiVal: { fontSize: 16, fontWeight: "800" }, kpiLbl: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  infoBox: { padding: 10, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.06)", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)" },
  infoText: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },
  card: { flexDirection: "row", padding: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink }, type: { fontSize: 11, color: Colors.ink3, fontWeight: "400" }, pro: { fontSize: 11, color: "#F59E0B" },
  period: { fontSize: 10, color: Colors.ink3 }, splitRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, splitLabel: { fontSize: 10, color: Colors.ink2 },
  nfseCol: { alignItems: "flex-end", gap: 4, minWidth: 100 }, nfseRow: { flexDirection: "row", gap: 4, alignItems: "center" }, nfseLabel: { fontSize: 9, color: Colors.ink3 }, nfseNum: { fontSize: 10, color: Colors.ink, fontFamily: "monospace" },
  nfseBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5, borderColor: "#F59E0B" }, nfseBtnT: { fontSize: 9, fontWeight: "600", color: "#F59E0B" },
  emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
});

export default CotaParte;
