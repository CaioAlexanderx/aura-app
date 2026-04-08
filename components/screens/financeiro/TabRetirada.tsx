import { useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "./types";
import { fmt } from "./types";

type Props = { transactions: Transaction[] };

export function TabRetirada({ transactions }: Props) {
  const realIncome = useMemo(() => transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const realExpenses = useMemo(() => transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);

  const [customRevenue, setCustomRevenue] = useState("");
  const [customExpenses, setCustomExpenses] = useState("");

  const rev = parseFloat(customRevenue.replace(/[^0-9.,]/g, "").replace(",", ".")) || realIncome;
  const exp = parseFloat(customExpenses.replace(/[^0-9.,]/g, "").replace(",", ".")) || realExpenses;

  // Calculations
  const dasRate = 0.06;
  const das = rev * dasRate;
  const lucroOp = rev - exp - das;
  const proLaboreMin = rev * 0.28;
  const proLabore = Math.max(proLaboreMin, 1412);
  const inss = proLabore * 0.11;
  const fatorR = rev > 0 ? Math.round((proLabore / rev) * 100) : 0;

  // Three withdrawal levels
  const maxRetirada = Math.max(0, lucroOp - proLabore - inss);
  const seguraRetirada = Math.max(0, maxRetirada * 0.85);
  const idealRetirada = Math.max(0, maxRetirada * 0.70);

  // Status after withdrawal
  const caixaApos = rev - exp - das - proLabore - inss - seguraRetirada;

  const hasData = rev > 0;

  return (
    <View>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Quanto voce pode retirar?</Text>
        <Text style={s.headerDesc}>Simulacao baseada na sua receita, despesas e regras do Simples Nacional.</Text>
      </View>

      {/* Inputs */}
      <View style={s.inputRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.inputLabel}>Receita bruta</Text>
          <TextInput style={s.input} value={customRevenue} onChangeText={setCustomRevenue} placeholder={realIncome > 0 ? fmt(realIncome) : "0,00"} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          {realIncome > 0 && !customRevenue && <Text style={s.inputHint}>Valor dos lancamentos</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.inputLabel}>Despesas operacionais</Text>
          <TextInput style={s.input} value={customExpenses} onChangeText={setCustomExpenses} placeholder={realExpenses > 0 ? fmt(realExpenses) : "0,00"} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          {realExpenses > 0 && !customExpenses && <Text style={s.inputHint}>Valor dos lancamentos</Text>}
        </View>
      </View>

      {hasData && (
        <View>
          {/* Three levels hero */}
          <View style={s.levelsCard}>
            <View style={s.levelMain}>
              <Text style={s.levelMainLabel}>RETIRADA SEGURA</Text>
              <Text style={s.levelMainValue}>{fmt(seguraRetirada)}</Text>
              <Text style={s.levelMainSub}>sem pressionar o caixa, mantendo enquadramento fiscal</Text>
            </View>
            <View style={s.levelsRow}>
              <View style={s.levelItem}>
                <View style={[s.levelDot, { backgroundColor: Colors.green }]} />
                <Text style={s.levelLabel}>Ideal</Text>
                <Text style={[s.levelValue, { color: Colors.green }]}>{fmt(idealRetirada)}</Text>
                <Text style={s.levelHint}>maximo conservadorismo</Text>
              </View>
              <View style={[s.levelItem, s.levelItemBorder]}>
                <View style={[s.levelDot, { backgroundColor: Colors.amber }]} />
                <Text style={s.levelLabel}>Segura</Text>
                <Text style={[s.levelValue, { color: Colors.amber }]}>{fmt(seguraRetirada)}</Text>
                <Text style={s.levelHint}>equilibrio recomendado</Text>
              </View>
              <View style={s.levelItem}>
                <View style={[s.levelDot, { backgroundColor: Colors.red }]} />
                <Text style={s.levelLabel}>Maxima</Text>
                <Text style={[s.levelValue, { color: Colors.red }]}>{fmt(maxRetirada)}</Text>
                <Text style={s.levelHint}>limite - sem folga</Text>
              </View>
            </View>
          </View>

          {/* Impact section */}
          <View style={s.impactCard}>
            <Text style={s.impactTitle}>Se voce retirar o valor seguro:</Text>
            <View style={s.impactRow}><Text style={s.impactLabel}>Caixa apos retirada</Text><Text style={[s.impactValue, { color: caixaApos >= 0 ? Colors.green : Colors.red }]}>{fmt(caixaApos)}</Text></View>
            <View style={s.impactRow}><Text style={s.impactLabel}>Reserva tributaria (DAS)</Text><Text style={[s.impactValue, { color: Colors.amber }]}>{fmt(das)}</Text></View>
            <View style={s.impactRow}><Text style={s.impactLabel}>Pro-labore + INSS</Text><Text style={s.impactValue}>{fmt(proLabore + inss)}</Text></View>
            <View style={[s.impactRow, { borderBottomWidth: 0 }]}><Text style={s.impactLabel}>Status geral</Text><View style={[s.impactBadge, { backgroundColor: caixaApos >= 0 ? Colors.greenD : Colors.redD }]}><Text style={[s.impactBadgeText, { color: caixaApos >= 0 ? Colors.green : Colors.red }]}>{caixaApos >= 0 ? "Saudavel" : "Risco"}</Text></View></View>
          </View>

          {/* Smart message */}
          <View style={s.messageCard}>
            <Text style={s.messageText}>
              {seguraRetirada > 0
                ? `Hoje voce pode retirar ${fmt(seguraRetirada)} com seguranca. Acima de ${fmt(maxRetirada)}, sua folga de caixa comeca a ficar apertada.`
                : `Com o cenario atual, nao recomendamos retirada. Suas despesas e obrigacoes consomem toda a receita.`
              }
            </Text>
          </View>

          {/* Waterfall */}
          <View style={s.waterfall}>
            <Text style={s.wfTitle}>Como calculamos</Text>
            <View style={s.wfSection}><Text style={s.wfSectionLabel}>Resultado do negocio</Text></View>
            <WRow label="(+) Receita bruta" value={rev} color={Colors.green} />
            {exp > 0 && <WRow label="(-) Despesas operacionais" value={exp} color={Colors.red} />}
            <WRow label={`(-) DAS estimado (${(dasRate*100).toFixed(0)}%)`} value={das} color={Colors.red} />
            <WRow label="= Lucro operacional" value={lucroOp} bold />
            <View style={s.wfSection}><Text style={s.wfSectionLabel}>Obrigacoes do socio</Text></View>
            <WRow label={`(-) Pro-labore (${fatorR}% da receita)`} value={proLabore} color={Colors.amber} />
            <WRow label="(-) INSS (11%)" value={inss} color={Colors.red} />
            <View style={s.wfSection}><Text style={s.wfSectionLabel}>Resultado final</Text></View>
            <WRow label="Retirada segura (85%)" value={seguraRetirada} highlight color={Colors.green} />
          </View>

          {/* Fator R monitor */}
          <View style={s.fatorCard}>
            <View style={s.fatorTop}>
              <View>
                <Text style={s.fatorTitle}>Monitor Fator R</Text>
                <Text style={s.fatorValue}>{fatorR}%</Text>
              </View>
              <View style={[s.fatorBadge, { backgroundColor: fatorR >= 28 ? Colors.greenD : Colors.redD }]}>
                <Text style={[s.fatorBadgeText, { color: fatorR >= 28 ? Colors.green : Colors.red }]}>{fatorR >= 28 ? "Anexo III" : "Risco Anexo V"}</Text>
              </View>
            </View>
            <View style={s.fatorBar}>
              <View style={[s.fatorFill, { width: `${Math.min(fatorR, 100)}%`, backgroundColor: fatorR >= 28 ? Colors.green : Colors.red }]} />
              <View style={s.fatorMark} />
            </View>
            <View style={s.fatorLabels}><Text style={s.fatorLabelLeft}>0%</Text><Text style={s.fatorLabel28}>28%</Text><Text style={s.fatorLabelRight}>100%</Text></View>
            <Text style={s.fatorHint}>
              {fatorR >= 28
                ? `Seu pro-labore esta ${fatorR - 28} pontos acima do minimo. Voce tem folga para se manter no Anexo III.`
                : `Pro-labore ${28 - fatorR} pontos abaixo do minimo. Considere aumentar para evitar o Anexo V (aliquota maior).`
              }
            </Text>
          </View>

          <View style={s.disclaimer}><Text style={s.disclaimerIcon}>!</Text><Text style={s.disclaimerText}>Estimativas para apoio a decisao. Regras e interpretacoes contabeis podem variar. Consulte seu contador.</Text></View>
        </View>
      )}
    </View>
  );
}

function WRow({ label, value, color, bold, highlight }: { label: string; value: number; color?: string; bold?: boolean; highlight?: boolean }) {
  return (
    <View style={[s.wRow, bold && s.wRowBold, highlight && s.wRowHighlight]}>
      <Text style={[s.wLabel, bold && s.wLabelBold, highlight && s.wLabelHL]}>{label}</Text>
      <Text style={[s.wValue, bold && s.wValueBold, color ? { color } : {}]}>{fmt(value)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, gap: 8 },
  headerTitle: { fontSize: 20, color: Colors.ink, fontWeight: "800" },
  headerDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  inputRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  inputLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.ink, fontWeight: "600" },
  inputHint: { fontSize: 10, color: Colors.violet3, marginTop: 4, fontStyle: "italic" },
  // Three levels
  levelsCard: { backgroundColor: Colors.bg3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20, overflow: "hidden" },
  levelMain: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  levelMainLabel: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  levelMainValue: { fontSize: 40, fontWeight: "800", color: Colors.green, letterSpacing: -1, marginBottom: 6 },
  levelMainSub: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  levelsRow: { flexDirection: "row" },
  levelItem: { flex: 1, alignItems: "center", paddingVertical: 16, gap: 4 },
  levelItemBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  levelDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  levelLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  levelValue: { fontSize: 16, fontWeight: "800" },
  levelHint: { fontSize: 9, color: Colors.ink3 },
  // Impact
  impactCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  impactTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 12 },
  impactRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  impactLabel: { fontSize: 13, color: Colors.ink3 },
  impactValue: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  impactBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  impactBadgeText: { fontSize: 11, fontWeight: "700" },
  // Message
  messageCard: { backgroundColor: Colors.violetD, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  messageText: { fontSize: 13, color: Colors.ink, lineHeight: 20, fontWeight: "500" },
  // Waterfall
  waterfall: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  wfTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 12, paddingHorizontal: 10 },
  wfSection: { paddingVertical: 6, paddingHorizontal: 10 },
  wfSectionLabel: { fontSize: 10, color: Colors.violet3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  wRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  wRowBold: { backgroundColor: Colors.bg4, borderBottomWidth: 0, borderRadius: 10, marginTop: 4, marginBottom: 4 },
  wRowHighlight: { backgroundColor: Colors.violetD, borderBottomWidth: 0, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  wLabel: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  wLabelBold: { color: Colors.ink, fontWeight: "600" },
  wLabelHL: { color: Colors.ink, fontWeight: "700" },
  wValue: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  wValueBold: { fontSize: 16, fontWeight: "800" },
  // Fator R
  fatorCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, gap: 12 },
  fatorTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fatorTitle: { fontSize: 12, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  fatorValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  fatorBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  fatorBadgeText: { fontSize: 12, fontWeight: "700" },
  fatorBar: { height: 12, backgroundColor: Colors.bg4, borderRadius: 6, overflow: "visible", position: "relative" },
  fatorFill: { height: 12, borderRadius: 6 },
  fatorMark: { position: "absolute", left: "28%", top: -3, width: 3, height: 18, backgroundColor: Colors.ink, borderRadius: 1.5 },
  fatorLabels: { flexDirection: "row", justifyContent: "space-between" },
  fatorLabelLeft: { fontSize: 9, color: Colors.ink3 },
  fatorLabel28: { fontSize: 9, color: Colors.ink, fontWeight: "700", marginLeft: "23%" },
  fatorLabelRight: { fontSize: 9, color: Colors.ink3 },
  fatorHint: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  // Disclaimer
  disclaimer: { flexDirection: "row", gap: 8, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14 },
  disclaimerIcon: { fontSize: 14, color: Colors.amber, fontWeight: "700" },
  disclaimerText: { fontSize: 11, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default TabRetirada;
