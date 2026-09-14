// ============================================================
// WaUsageCard — "Uso do mês" do WhatsApp automático
//
// Cada mensagem custa dinheiro. Este cartão é a única resposta honesta
// para "quanto isso já me custou este mês?" — e o único lugar onde o
// sensei vê, antes da fatura, que o número está perto do teto diário ou
// com a qualidade rebaixada pela Meta.
//
// Tudo vem do GET /whatsapp/status (Fase 1f) e tudo é OPCIONAL: backend
// anterior à Fase 1 não devolve `usage` nem `quality_rating`, e nesse
// caso o cartão simplesmente não aparece — melhor ausente do que
// mostrando zeros que parecem verdade.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { WaStatus } from "@/services/waApi";
import { waPausedReasonLabel, waQualityView } from "./helpers";

interface Props {
  status: WaStatus | null;
}

export function WaUsageCard({ status }: Props) {
  const usage = status?.usage || null;
  const quality = waQualityView(status?.quality_rating);
  const paused = status?.paused_reason || null;
  const hasUsage = !!usage && (
    typeof usage.month_sent === "number" ||
    typeof usage.today_sent === "number" ||
    typeof usage.daily_cap === "number"
  );

  // Nada conhecido = nada na tela (backend antigo).
  if (!hasUsage && !quality && !paused) return null;

  const month = typeof usage?.month_sent === "number" ? usage.month_sent : null;
  const today = typeof usage?.today_sent === "number" ? usage.today_sent : null;
  const cap = typeof usage?.daily_cap === "number" && usage.daily_cap > 0 ? usage.daily_cap : null;
  const nearCap = today != null && cap != null && today >= cap * 0.8;

  return (
    <View style={styles.card} testID="wa-usage-card">
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <Icon name="bar_chart" size={16} color={KarateColors.primary} />
          <Text style={styles.cardTitle}>Uso do mês</Text>
        </View>
        {!!quality && (
          <View style={[styles.badge, { backgroundColor: quality.bg }]} testID="wa-usage-qualidade">
            <Icon name={quality.icon} size={12} color={quality.color} />
            <Text style={[styles.badgeTxt, { color: quality.color }]}>{quality.label}</Text>
          </View>
        )}
      </View>

      {hasUsage && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum} testID="wa-usage-mes">{month != null ? month : "—"}</Text>
            <Text style={styles.statTxt}>mensagens neste mês</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum} testID="wa-usage-hoje">
              {today != null ? today : "—"}{cap != null ? ` / ${cap}` : ""}
            </Text>
            <Text style={styles.statTxt}>hoje{cap != null ? " (teto diário)" : ""}</Text>
          </View>
        </View>
      )}

      {nearCap && !paused && (
        <View style={styles.warnBox} testID="wa-usage-perto-do-teto">
          <Icon name="alert" size={14} color={KarateColors.warn} />
          <Text style={styles.warnTxt}>
            O dojô está perto do teto de mensagens do dia. O que passar do limite não se perde: fica
            na fila e sai no próximo dia.
          </Text>
        </View>
      )}

      {!!paused && (
        <View style={styles.dangerBox} testID="wa-usage-pausado">
          <Icon name="alert" size={14} color={KarateColors.danger} />
          <Text style={styles.dangerTxt}>
            A fila de envios está pausada: {waPausedReasonLabel(paused)} Nenhuma mensagem automática
            sai enquanto isso — a fila manual da aba Régua continua funcionando.
          </Text>
        </View>
      )}

      <Text style={styles.hint}>
        A Meta cobra por conversa iniciada, não por mensagem avulsa. Os números acima contam o que
        saiu de verdade pela fila automática, incluindo os envios de teste.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 } as ViewStyle,
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 } as ViewStyle,
  stat: {
    backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 12, minWidth: 150, gap: 2,
  } as ViewStyle,
  statNum: { fontSize: 18, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  statTxt: { fontSize: 11.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  badgeTxt: { fontSize: 10.5, fontWeight: "700" } as TextStyle,
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm,
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  } as ViewStyle,
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: KarateColors.warn, lineHeight: 17 } as TextStyle,
  dangerBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.sm,
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  } as ViewStyle,
  dangerTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: KarateColors.danger, lineHeight: 17 } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 12, lineHeight: 16.5, maxWidth: 620 } as TextStyle,
});
