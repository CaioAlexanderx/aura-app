import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";

// ============================================================
// MKT-02: NfceDashboard — NFC-e emission + management
// ============================================================

export interface NfceEmission {
  id: string; numero: number; serie: number; chave_acesso?: string;
  protocolo?: string; status: string; customer_cpf?: string; customer_name?: string;
  total_nfce: number; payment_method: string; authorized_at?: string;
  cancelled_at?: string; created_at: string;
}

export interface NfceStats { total: number; authorized: number; cancelled: number; total_value: number; }

interface Props {
  emissions: NfceEmission[];
  stats: NfceStats;
  isConfigured: boolean;
  ambiente?: string;
  onEmit?: () => void;
  onCancel?: (nfceId: string) => void;
  onConfigure?: () => void;
  onPrint?: (nfceId: string) => void;
}

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pendente:     { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Pendente" },
  processando:  { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Processando" },
  autorizada:   { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Autorizada" },
  rejeitada:    { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Rejeitada" },
  cancelada:    { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Cancelada" },
  inutilizada:  { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Inutilizada" },
};

const PAY: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", credito: "Credito", debito: "Debito", vale: "Vale",
};

export function NfceDashboard({ emissions, stats, isConfigured, ambiente, onEmit, onCancel, onConfigure, onPrint }: Props) {
  return (
    <View style={s.container}>
      {!isConfigured && (
        <View style={s.alertBox}>
          <Text style={s.alertTitle}>NFC-e nao configurada</Text>
          <Text style={s.alertText}>Configure o certificado digital, CSC e inscricao estadual para emitir cupons fiscais.</Text>
          {onConfigure && <Pressable onPress={onConfigure} style={s.configBtn}><Text style={s.configBtnT}>Configurar NFC-e</Text></Pressable>}
        </View>
      )}

      {isConfigured && ambiente === "homologacao" && (
        <View style={[s.envBadge, { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)" }]}>
          <Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "600" }}>Ambiente: HOMOLOGACAO (testes)</Text>
        </View>
      )}

      <View style={s.kpiRow}>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{stats.authorized}</Text><Text style={s.kpiLbl}>Autorizadas</Text></HoverCard>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: Colors.ink }]}>{fmt(stats.total_value)}</Text><Text style={s.kpiLbl}>Valor total</Text></HoverCard>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{stats.cancelled}</Text><Text style={s.kpiLbl}>Canceladas</Text></HoverCard>
        <HoverCard style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{stats.total}</Text><Text style={s.kpiLbl}>Total</Text></HoverCard>
      </View>

      <View style={s.header}>
        <Text style={s.title}>Cupons fiscais (NFC-e)</Text>
        {isConfigured && onEmit && <Pressable onPress={onEmit} style={s.emitBtn}><Text style={s.emitBtnT}>+ Emitir NFC-e</Text></Pressable>}
      </View>

      {/* Table */}
      <View style={s.tableH}>
        <Text style={[s.th, { width: 55 }]}>Numero</Text>
        <Text style={[s.th, { flex: 1 }]}>Cliente</Text>
        <Text style={[s.th, { width: 70 }]}>Pagamento</Text>
        <Text style={[s.th, { width: 80, textAlign: "right" }]}>Valor</Text>
        <Text style={[s.th, { width: 70 }]}>Status</Text>
        <Text style={[s.th, { width: 60 }]}>Acoes</Text>
      </View>

      {emissions.map(nf => {
        const st = ST[nf.status] || ST.pendente;
        return (
          <View key={nf.id} style={s.tr}>
            <Text style={[s.td, { width: 55, fontWeight: "600" }]}>{nf.numero}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.td}>{nf.customer_name || "Consumidor"}</Text>
              {nf.customer_cpf && <Text style={s.tdSub}>CPF: {nf.customer_cpf}</Text>}
            </View>
            <Text style={[s.td, { width: 70 }]}>{PAY[nf.payment_method] || nf.payment_method}</Text>
            <Text style={[s.td, { width: 80, textAlign: "right", fontWeight: "600" }]}>{fmt(nf.total_nfce)}</Text>
            <View style={{ width: 70 }}><View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeT, { color: st.color }]}>{st.label}</Text></View></View>
            <View style={{ width: 60, flexDirection: "row", gap: 4 }}>
              {onPrint && nf.status === "autorizada" && <Pressable onPress={() => onPrint(nf.id)} style={s.actBtn}><Text style={s.actBtnT}>Imprimir</Text></Pressable>}
              {onCancel && nf.status === "autorizada" && <Pressable onPress={() => onCancel(nf.id)} style={[s.actBtn, { borderColor: "#EF4444" }]}><Text style={[s.actBtnT, { color: "#EF4444" }]}>Cancelar</Text></Pressable>}
            </View>
          </View>
        );
      })}
      {emissions.length === 0 && <Text style={s.emptyT}>Nenhuma NFC-e emitida.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  alertBox: { padding: 16, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.06)", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)", gap: 8 },
  alertTitle: { fontSize: 14, fontWeight: "700", color: "#F59E0B" }, alertText: { fontSize: 12, color: Colors.ink2, lineHeight: 18 },
  configBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" }, configBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  envBadge: { padding: 8, borderRadius: 8, borderWidth: 0.5, alignItems: "center" },
  kpiRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "45%", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kpiVal: { fontSize: 20, fontWeight: "800" }, kpiLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  emitBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 }, emitBtnT: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tableH: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8, alignItems: "center" },
  th: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", fontWeight: "600" },
  tr: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 8, alignItems: "center" },
  td: { fontSize: 12, color: Colors.ink }, tdSub: { fontSize: 10, color: Colors.ink3 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" }, badgeT: { fontSize: 9, fontWeight: "600" },
  actBtn: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5, borderColor: Colors.violet },
  actBtnT: { fontSize: 8, fontWeight: "600", color: Colors.violet3 },
  emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 20 },
});

export default NfceDashboard;
