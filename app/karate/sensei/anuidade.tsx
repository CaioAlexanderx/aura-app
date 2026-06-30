// ============================================================
// Painel do Sensei — Anuidade (DESIGN-23)
// Anuidade do dojô à federação: situação, Pix e histórico.
// Somente leitura; o pagamento é conciliado pela federação.
// ============================================================
import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { SENSEI_DOJO } from "./_layout";

const STATUS = { label: "Em dia", tone: "ok" as const, sub: "Vence em 31 de dezembro de 2026" };
const VALOR = "R$ 1.450";
const PIX = "fpkt@federacao.org.br";
const HISTORICO = [
  { ano: "2026", valor: "R$ 1.450", quando: "10 de janeiro de 2026", ok: true },
  { ano: "2025", valor: "R$ 1.380", quando: "08 de janeiro de 2025", ok: true },
  { ano: "2024", valor: "R$ 1.320", quando: "15 de janeiro de 2024", ok: true },
];

export default function SenseiAnuidade() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>{SENSEI_DOJO.name} · {SENSEI_DOJO.code}</Text>
        <Text style={styles.title}>Anuidade do dojô</Text>
        <Text style={styles.lead}>A filiação anual do seu dojô à federação. O pagamento é por Pix e a federação confirma o recebimento.</Text>
      </View>

      {/* Situação */}
      <View style={[styles.statusCard, styles.okCard]}>
        <View style={[styles.statusIco, { borderColor: KarateColors.ok }]}>
          <Icon name="checkmark-circle" size={24} color={KarateColors.ok} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusT, { color: KarateColors.ok }]}>Anuidade {new Date().getFullYear()} · {STATUS.label}</Text>
          <Text style={styles.statusSub}>{STATUS.sub}</Text>
        </View>
        <Text style={styles.valor}>{VALOR}</Text>
      </View>

      {/* Pix */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pagamento</Text>
        <Text style={styles.cardSub}>Use a chave Pix da federação. Depois do pagamento, a federação concilia e atualiza aqui.</Text>
        <View style={styles.pixRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pixLabel}>Chave Pix da federação</Text>
            <Text style={styles.pixVal}>{PIX}</Text>
          </View>
          <TouchableOpacity style={styles.copyBtn} accessibilityLabel="Copiar chave Pix">
            <Icon name="copy-outline" size={15} color={KarateColors.primary} />
            <Text style={styles.copyTxt}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Histórico */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Histórico de pagamentos</Text>
        <Text style={styles.cardSub}>Últimas renovações</Text>
        {HISTORICO.map((h) => (
          <View key={h.ano} style={styles.histRow}>
            <View style={styles.histIco}><Icon name="checkmark" size={14} color={KarateColors.ok} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.histAno}>Anuidade {h.ano}</Text>
              <Text style={styles.histQuando}>Pago em {h.quando}</Text>
            </View>
            <Text style={styles.histValor}>{h.valor}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: KarateRadius.lg, borderWidth: 1, padding: 16 } as ViewStyle,
  okCard: { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.ok } as ViewStyle,
  statusIco: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  statusT: { fontSize: 15, fontWeight: "800" } as TextStyle,
  statusSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 2 } as TextStyle,
  valor: { fontSize: 18, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2, marginBottom: 8, lineHeight: 17 } as TextStyle,
  pixRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 12 } as ViewStyle,
  pixLabel: { fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  pixVal: { fontSize: 14, color: KarateColors.ink, fontWeight: "600", marginTop: 3 } as TextStyle,
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  copyTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  histIco: { width: 28, height: 28, borderRadius: 14, backgroundColor: KarateColors.okSoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  histAno: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  histQuando: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  histValor: { fontSize: 13, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
});
