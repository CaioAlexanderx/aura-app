import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-15: ContratoPDF — Auto-generated treatment contract
// Displays contract preview with patient + treatment details
// Actual PDF generation happens via backend or react-native-print
// ============================================================

export interface ContratoData {
  clinicName: string;
  clinicCnpj?: string;
  clinicAddress?: string;
  professionalName: string;
  croNumber?: string;
  croState?: string;
  patientName: string;
  patientCpf?: string;
  planNumber: string;
  items: { procedure: string; tooth?: number; price: number }[];
  total: number;
  discount_pct: number;
  finalTotal: number;
  installments?: number;
  installmentValue?: number;
  validUntil?: string;
}

interface Props {
  contrato: ContratoData;
  onGeneratePDF?: () => void;
  onSendWhatsApp?: () => void;
  onPrint?: () => void;
}

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }

export function ContratoPDF({ contrato: c, onGeneratePDF, onSendWhatsApp, onPrint }: Props) {
  return (
    <View style={s.container}>
      {/* Preview card */}
      <View style={s.preview}>
        {/* Header */}
        <View style={s.previewHeader}>
          <Text style={s.clinicName}>{c.clinicName}</Text>
          {c.clinicCnpj && <Text style={s.clinicInfo}>CNPJ: {c.clinicCnpj}</Text>}
          {c.clinicAddress && <Text style={s.clinicInfo}>{c.clinicAddress}</Text>}
        </View>

        <View style={s.divider} />

        <Text style={s.docTitle}>CONTRATO DE PRESTACAO DE SERVICOS ODONTOLOGICOS</Text>
        <Text style={s.docNum}>Referente ao Orcamento {c.planNumber}</Text>

        {/* Parties */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CONTRATANTE (Paciente)</Text>
          <Text style={s.fieldVal}>{c.patientName}{c.patientCpf ? " \u2014 CPF: " + c.patientCpf : ""}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>CONTRATADA (Clinica)</Text>
          <Text style={s.fieldVal}>{c.clinicName} \u2014 Dr(a). {c.professionalName}</Text>
          {c.croNumber && <Text style={s.fieldVal}>CRO-{c.croState || "SP"} {c.croNumber}</Text>}
        </View>

        {/* Services */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SERVICOS CONTRATADOS</Text>
          {c.items.map((item, i) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.itemNum}>{i + 1}.</Text>
              <Text style={[s.itemProc, { flex: 1 }]}>{item.procedure}{item.tooth ? " (dente " + item.tooth + ")" : ""}</Text>
              <Text style={s.itemPrice}>{fmt(item.price)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totals}>
          {c.discount_pct > 0 && (
            <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalVal}>{fmt(c.total)}</Text></View>
          )}
          {c.discount_pct > 0 && (
            <View style={s.totalRow}><Text style={s.totalLabel}>Desconto ({c.discount_pct}%)</Text><Text style={[s.totalVal, { color: "#10B981" }]}>-{fmt(c.total - c.finalTotal)}</Text></View>
          )}
          <View style={s.totalRow}><Text style={[s.totalLabel, { fontWeight: "700" }]}>VALOR TOTAL</Text><Text style={[s.totalVal, { fontWeight: "700", fontSize: 16 }]}>{fmt(c.finalTotal)}</Text></View>
          {c.installments && c.installmentValue && (
            <View style={s.totalRow}><Text style={s.totalLabel}>Parcelamento</Text><Text style={s.totalVal}>{c.installments}x de {fmt(c.installmentValue)}</Text></View>
          )}
        </View>

        {/* Terms */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CLAUSULAS</Text>
          <Text style={s.clause}>1. O contratante autoriza a realizacao dos procedimentos listados acima.</Text>
          <Text style={s.clause}>2. O tratamento pode sofrer alteracoes conforme evolucao clinica, mediante acordo entre as partes.</Text>
          <Text style={s.clause}>3. Faltas sem aviso previo de 24h poderao ser cobradas.</Text>
          <Text style={s.clause}>4. Validade deste orcamento: {c.validUntil ? new Date(c.validUntil).toLocaleDateString("pt-BR") : "30 dias"}.</Text>
        </View>

        {/* Signatures */}
        <View style={s.sigRow}>
          <View style={s.sigBlock}><View style={s.sigLine} /><Text style={s.sigLabel}>Contratante</Text><Text style={s.sigName}>{c.patientName}</Text></View>
          <View style={s.sigBlock}><View style={s.sigLine} /><Text style={s.sigLabel}>Contratada</Text><Text style={s.sigName}>Dr(a). {c.professionalName}</Text>{c.croNumber && <Text style={s.sigCro}>CRO-{c.croState || "SP"} {c.croNumber}</Text>}</View>
        </View>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {onGeneratePDF && <Pressable onPress={onGeneratePDF} style={s.btnPrimary}><Text style={s.btnPrimaryT}>Gerar PDF</Text></Pressable>}
        {onSendWhatsApp && <Pressable onPress={onSendWhatsApp} style={s.btnOut}><Text style={s.btnOutT}>Enviar WhatsApp</Text></Pressable>}
        {onPrint && <Pressable onPress={onPrint} style={s.btnOut}><Text style={s.btnOutT}>Imprimir</Text></Pressable>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  preview: { backgroundColor: Colors.bg2 || "#fafafa", borderRadius: 12, padding: 20, borderWidth: 0.5, borderColor: Colors.border || "#ddd", gap: 12 },
  previewHeader: { alignItems: "center", gap: 2 },
  clinicName: { fontSize: 16, fontWeight: "700", color: Colors.ink || "#000" },
  clinicInfo: { fontSize: 10, color: Colors.ink3 || "#888" },
  divider: { height: 1, backgroundColor: Colors.border || "#ddd" },
  docTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink || "#000", textAlign: "center" },
  docNum: { fontSize: 11, color: Colors.ink3 || "#888", textAlign: "center" },
  section: { gap: 4 },
  sectionTitle: { fontSize: 10, fontWeight: "700", color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldVal: { fontSize: 12, color: Colors.ink || "#000" },
  itemRow: { flexDirection: "row", gap: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: Colors.border || "#eee" },
  itemNum: { fontSize: 11, color: Colors.ink3 || "#888", width: 18 },
  itemProc: { fontSize: 12, color: Colors.ink || "#000" },
  itemPrice: { fontSize: 12, fontWeight: "500", color: Colors.ink || "#000", width: 80, textAlign: "right" },
  totals: { borderTopWidth: 1, borderTopColor: Colors.border || "#ddd", paddingTop: 8, gap: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 12, color: Colors.ink2 || "#666" },
  totalVal: { fontSize: 13, color: Colors.ink || "#000" },
  clause: { fontSize: 10, color: Colors.ink2 || "#666", lineHeight: 15, paddingLeft: 4 },
  sigRow: { flexDirection: "row", gap: 24, justifyContent: "center", paddingTop: 20 },
  sigBlock: { alignItems: "center", gap: 3, minWidth: 140 },
  sigLine: { width: 140, height: 1, backgroundColor: Colors.ink || "#000" },
  sigLabel: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase" },
  sigName: { fontSize: 11, fontWeight: "600", color: Colors.ink || "#000" },
  sigCro: { fontSize: 10, color: "#06B6D4" },
  actions: { flexDirection: "row", gap: 8 },
  btnPrimary: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  btnPrimaryT: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnOut: { borderWidth: 0.5, borderColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnOutT: { color: "#06B6D4", fontSize: 12, fontWeight: "500" },
});

export default ContratoPDF;
