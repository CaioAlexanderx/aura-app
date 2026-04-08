import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[] };

export function TabRetirada({ transactions }: Props) {
  // Compute real income from transactions
  const realIncome = useMemo(() => {
    return transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  }, [transactions]);

  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");

  // Use real data or manual input
  const rev = parseFloat(revenue.replace(/[^0-9.,]/g, "").replace(",", ".")) || realIncome;
  const exp = parseFloat(expenses.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;

  // Simples Nacional calculations
  const dasRate = 0.06; // Anexo III 6%
  const das = rev * dasRate;
  const lucroOperacional = rev - exp - das;
  const proLaboreMin = rev * 0.28; // Fator R minimum for Anexo III
  const proLabore = Math.max(proLaboreMin, 1412); // At least 1 salario minimo
  const inss = proLabore * 0.11; // 11% INSS sobre pro-labore
  const lucroLiquido = lucroOperacional - proLabore - inss;
  const retiradaSugerida = Math.max(0, lucroLiquido);
  const fatorR = rev > 0 ? Math.round((proLabore / rev) * 100) : 0;

  return (
    <View>
      {/* Header explicativo */}
      <View style={s.headerCard}>
        <Text style={s.headerTitle}>Simulador de Retirada</Text>
        <Text style={s.headerDesc}>Calcule quanto voce pode retirar do negocio mantendo o enquadramento no Simples Nacional (Anexo III via Fator R).</Text>
      </View>

      {/* Inputs */}
      <View style={s.inputSection}>
        <View style={s.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.inputLabel}>Receita bruta mensal</Text>
            <TextInput style={s.input} value={revenue} onChangeText={setRevenue} placeholder={realIncome > 0 ? fmt(realIncome) : "0,00"} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
            {realIncome > 0 && !revenue && <Text style={s.inputHint}>Usando valor real dos lancamentos</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.inputLabel}>Despesas operacionais</Text>
            <TextInput style={s.input} value={expenses} onChangeText={setExpenses} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </View>
        </View>
      </View>

      {rev > 0 && (
        <View>
          {/* Resultado principal */}
          <View style={s.resultHero}>
            <Text style={s.resultLabel}>Retirada sugerida</Text>
            <Text style={[s.resultValue, { color: retiradaSugerida > 0 ? Colors.green : Colors.red }]}>{fmt(retiradaSugerida)}</Text>
            <Text style={s.resultSub}>Valor que voce pode retirar sem comprometer o caixa</Text>
          </View>

          {/* Waterfall */}
          <View style={s.waterfall}>
            <WRow label="(+) Receita bruta" value={rev} color={Colors.green} />
            <WRow label={`(-) DAS estimado (${(dasRate * 100).toFixed(0)}%)`} value={das} color={Colors.red} />
            {exp > 0 && <WRow label="(-) Despesas operacionais" value={exp} color={Colors.red} />}
            <WRow label="= Lucro operacional" value={lucroOperacional} bold />
            <View style={s.divider} />
            <WRow label={`(-) Pro-labore (Fator R ${fatorR}%)`} value={proLabore} color={Colors.amber} />
            <WRow label="(-) INSS (11%)" value={inss} color={Colors.red} />
            <WRow label="= Retirada sugerida" value={retiradaSugerida} highlight color={Colors.green} />
          </View>

          {/* Fator R explanation */}
          <View style={s.fatorCard}>
            <View style={s.fatorHeader}>
              <Text style={s.fatorTitle}>Fator R: {fatorR}%</Text>
              <View style={[s.fatorBadge, { backgroundColor: fatorR >= 28 ? Colors.greenD : Colors.redD }]}>
                <Text style={[s.fatorBadgeText, { color: fatorR >= 28 ? Colors.green : Colors.red }]}>{fatorR >= 28 ? "Anexo III" : "Anexo V"}</Text>
              </View>
            </View>
            <View style={s.fatorBar}>
              <View style={[s.fatorFill, { width: `${Math.min(fatorR, 100)}%`, backgroundColor: fatorR >= 28 ? Colors.green : Colors.red }]} />
              <View style={s.fatorMark} />
            </View>
            <Text style={s.fatorHint}>{fatorR >= 28 ? "Seu pro-labore esta acima de 28% da receita. Voce se enquadra no Anexo III (aliquota menor)." : "Pro-labore abaixo de 28%. Considere aumentar para se enquadrar no Anexo III e pagar menos imposto."}</Text>
          </View>

          <View style={s.disclaimer}>
            <Text style={s.disclaimerIcon}>!</Text>
            <Text style={s.disclaimerText}>Valores estimativos para apoio a decisao. Consulte seu contador para calculos oficiais.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function WRow({ label, value, color, bold, highlight }: { label: string; value: number; color?: string; bold?: boolean; highlight?: boolean }) {
  return (
    <View style={[s.wRow, bold && s.wRowBold, highlight && s.wRowHighlight]}>
      <Text style={[s.wLabel, bold && s.wLabelBold, highlight && s.wLabelHighlight]}>{label}</Text>
      <Text style={[s.wValue, bold && s.wValueBold, color ? { color } : {}]}>{fmt(value)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  headerCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, gap: 8 },
  headerTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  headerDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  inputSection: { marginBottom: 20 },
  inputRow: { flexDirection: "row", gap: 12 },
  inputLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.ink, fontWeight: "600" },
  inputHint: { fontSize: 10, color: Colors.violet3, marginTop: 4, fontStyle: "italic" },
  resultHero: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", marginBottom: 20, gap: 6 },
  resultLabel: { fontSize: 12, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  resultValue: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  resultSub: { fontSize: 11, color: Colors.ink3 },
  waterfall: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  wRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: 6 },
  wRowBold: { backgroundColor: Colors.bg4, borderBottomWidth: 0, borderRadius: 10, marginTop: 4 },
  wRowHighlight: { backgroundColor: Colors.violetD, borderBottomWidth: 0, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  wLabel: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  wLabelBold: { color: Colors.ink, fontWeight: "600" },
  wLabelHighlight: { color: Colors.ink, fontWeight: "700" },
  wValue: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  wValueBold: { fontSize: 16, fontWeight: "800" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  fatorCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, gap: 10 },
  fatorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fatorTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  fatorBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  fatorBadgeText: { fontSize: 11, fontWeight: "700" },
  fatorBar: { height: 10, backgroundColor: Colors.bg4, borderRadius: 5, overflow: "hidden", position: "relative" },
  fatorFill: { height: 10, borderRadius: 5 },
  fatorMark: { position: "absolute", left: "28%", top: -2, width: 2, height: 14, backgroundColor: Colors.ink3, borderRadius: 1 },
  fatorHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  disclaimer: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14 },
  disclaimerIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  disclaimerText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default TabRetirada;
