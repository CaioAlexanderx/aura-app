// ============================================================
// UsoCard — "quanto o WhatsApp já custou este mês?"
//
// Irmão varejo do WaUsageCard do dojô. Tudo vem do GET /whatsapp/status
// e tudo é OPCIONAL: backend anterior à Fase 1 não devolve `usage` nem
// `quality_rating`, e nesse caso o cartão simplesmente não aparece —
// melhor ausente do que mostrando zeros que parecem verdade.
// ============================================================
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WaStatus } from "@/services/waApi";
import { waPausedReasonLabel, waQualitySpec } from "./waGuards";
import { waTonePair } from "./varejoTheme";

interface Props {
  status: WaStatus | null;
}

export function UsoCard({ status }: Props) {
  const usage = status?.usage || null;
  const quality = waQualitySpec(status?.quality_rating);
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
  const qualityTone = quality ? waTonePair(quality.tone) : null;

  return (
    <View style={s.card} testID="wa-varejo-uso">
      <View style={s.head}>
        <View style={s.headTitle}>
          <Icon name="bar_chart" size={16} color={Colors.violet3} />
          <Text style={s.title}>Uso do mês</Text>
        </View>
        {!!quality && !!qualityTone && (
          <View style={[s.badge, { backgroundColor: qualityTone.bg }]} testID="wa-varejo-qualidade">
            <Icon name={quality.icon} size={12} color={qualityTone.color} />
            <Text style={[s.badgeTxt, { color: qualityTone.color }]}>{quality.label}</Text>
          </View>
        )}
      </View>

      {hasUsage && (
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNum} testID="wa-varejo-uso-mes">{month != null ? month : "—"}</Text>
            <Text style={s.statTxt}>mensagens neste mês</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum} testID="wa-varejo-uso-hoje">
              {today != null ? today : "—"}{cap != null ? ` / ${cap}` : ""}
            </Text>
            <Text style={s.statTxt}>hoje{cap != null ? " (teto diário)" : ""}</Text>
          </View>
        </View>
      )}

      {nearCap && !paused && (
        <View style={s.warnBox} testID="wa-varejo-perto-do-teto">
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.warnTxt}>
            A loja está perto do teto de mensagens do dia. O que passar do limite não se perde: fica
            na fila e sai no próximo dia.
          </Text>
        </View>
      )}

      {!!paused && (
        <View style={s.dangerBox} testID="wa-varejo-pausado">
          <Icon name="alert" size={13} color={Colors.red} />
          <Text style={s.dangerTxt}>
            A fila de envios está pausada: {waPausedReasonLabel(paused)} Nenhuma mensagem automática
            sai enquanto isso — a cobrança manual pelo wa.me continua funcionando.
          </Text>
        </View>
      )}

      <Text style={s.hint}>
        A Meta cobra por conversa iniciada, não por mensagem avulsa. Os números acima contam o que
        saiu de verdade pela fila automática, incluindo os envios de teste.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  stat: {
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 11,
    paddingVertical: 10, paddingHorizontal: 13, minWidth: 150, gap: 2,
  },
  statNum: { fontSize: 19, fontWeight: "800", color: Colors.ink },
  statTxt: { fontSize: 11.5, fontWeight: "600", color: Colors.ink2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: Colors.amberD, borderRadius: 10, borderWidth: 1, borderColor: Colors.amber + "33",
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  },
  warnTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.amber, lineHeight: 16.5 },
  dangerBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: Colors.redD, borderRadius: 10, borderWidth: 1, borderColor: Colors.red + "33",
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  },
  dangerTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.red, lineHeight: 16.5 },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 12, lineHeight: 16 },
} as any);
