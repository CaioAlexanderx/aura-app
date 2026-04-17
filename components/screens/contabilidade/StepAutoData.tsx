import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";

type Props = {
  obligationCode: string;
  stepIndex: number;
  completed: boolean;
};

// C4-04: Mostra dados calculados inline nos steps auto=true
// Mapeia obligation code + step → dados a mostrar
var AUTO_STEP_MAP: Record<string, { step: number; label: string; endpoint: string; formatter: (d: any) => { lines: { label: string; value: string }[] } }[]> = {
  das_mei: [{
    step: 0, label: "Valor calculado",
    endpoint: "/obligations/das/auto-preview",
    formatter: function(d: any) {
      var das = d.das || {};
      return { lines: [
        { label: "INSS", value: fmt(das.inss || 0) },
        { label: "ICMS", value: fmt(das.icms || 0) },
        { label: "ISS", value: fmt(das.iss || 0) },
        { label: "Total DAS-MEI", value: fmt(das.total || 0) },
      ]};
    },
  }],
  das_sn: [{
    step: 0, label: "Receita apurada",
    endpoint: "/obligations/das/auto-preview",
    formatter: function(d: any) {
      return { lines: [
        { label: "Receita do mes", value: fmt(d.current_revenue || 0) },
        { label: "RBT12", value: fmt(d.revenue_12m || 0) },
        { label: "Aliquota efetiva", value: (d.das?.effective_rate_pct || 0) + "%" },
        { label: "DAS estimado", value: fmt(d.das?.estimated_das || 0) },
      ]};
    },
  }],
  prolabore: [{
    step: 0, label: "Calculo pro-labore",
    endpoint: "/prolabore/preview",
    formatter: function(d: any) {
      var s = d.suggested || {};
      return { lines: [
        { label: "Pro-labore sugerido", value: fmt(s.gross_prolabore || 0) },
        { label: "INSS retido", value: fmt(s.inss || 0) },
        { label: "Liquido", value: fmt(s.net_prolabore || 0) },
        { label: "Fator R", value: (d.fator_r?.with_suggested || 0) + "%" },
      ]};
    },
  }],
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };

export function StepAutoData({ obligationCode, stepIndex, completed }: Props) {
  var { company } = useAuthStore();
  var [data, setData] = useState<any>(null);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(false);

  var configs = AUTO_STEP_MAP[obligationCode];
  var config = configs?.find(function(c) { return c.step === stepIndex; });

  useEffect(function() {
    if (!config || !company?.id || completed || data) return;
    setLoading(true);
    request("/companies/" + company.id + config.endpoint)
      .then(function(res) { setData(res); })
      .catch(function() { setError(true); })
      .finally(function() { setLoading(false); });
  }, [config, company?.id, completed]);

  if (!config || completed) return null;

  if (loading) return <View style={s.wrap}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={s.loadText}>Calculando...</Text></View>;
  if (error || !data) return null;

  var formatted = config.formatter(data);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{config.label}</Text>
      <View style={s.dataBlock}>
        {formatted.lines.map(function(line, i) {
          var isLast = i === formatted.lines.length - 1;
          return (
            <View key={line.label} style={[s.dataRow, isLast && s.dataRowLast]}>
              <Text style={[s.dataLabel, isLast && { fontWeight: "700", color: Colors.ink }]}>{line.label}</Text>
              <Text style={[s.dataValue, isLast && { fontWeight: "800", color: Colors.violet3, fontSize: 13 }]}>{line.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  wrap: { marginTop: 10, marginLeft: 48, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  loadText: { fontSize: 11, color: Colors.ink3 },
  label: { fontSize: 9, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4, width: "100%" },
  dataBlock: { backgroundColor: Colors.violetD, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border2, width: "100%" },
  dataRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  dataRowLast: { borderBottomWidth: 0, paddingTop: 6, marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border },
  dataLabel: { fontSize: 10, color: Colors.ink3 },
  dataValue: { fontSize: 11, color: Colors.ink, fontWeight: "600", fontFamily: "monospace" },
});

export default StepAutoData;
