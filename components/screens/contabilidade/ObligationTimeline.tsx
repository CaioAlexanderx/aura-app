import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Obligation } from "./types";
import { STATUS_COLORS } from "./types";
import { useState } from "react";

type Props = { items: Obligation[]; onGuide: (code: string) => void };

export function ObligationTimeline({ items, onGuide }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={s.container}>
      {items.map((o, i) => (
        <TimelineItem key={o.code} obligation={o} onGuide={() => onGuide(o.code)} isLast={i === items.length - 1} />
      ))}
    </View>
  );
}

function TimelineItem({ obligation: o, onGuide, isLast }: { obligation: Obligation; onGuide: () => void; isLast: boolean }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const bc = STATUS_COLORS[o.status] || Colors.ink3;
  const isDone = o.status === "done";
  const isFuture = o.status === "future";
  const isAutomatic = o.filter_label === "aura_resolve";

  return (
    <View style={s.itemWrap}>
      {/* Timeline line + dot */}
      <View style={s.lineCol}>
        <View style={[s.dot, { backgroundColor: isDone ? Colors.green : bc }]}>
          {isDone && <Text style={s.dotCheck}>OK</Text>}
        </View>
        {!isLast && <View style={[s.line, { backgroundColor: isDone ? Colors.green + "44" : Colors.border }]} />}
      </View>

      {/* Content */}
      <Pressable onPress={isFuture ? undefined : onGuide} onHoverIn={w && !isFuture ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
        style={[s.card, isDone && s.cardDone, isFuture && s.cardFuture, h && s.cardHover, w && { transition: "all 0.15s ease" } as any]}>

        <View style={s.cardTop}>
          <Text style={[s.name, isDone && s.nameDone]} numberOfLines={1}>{o.name}</Text>
          {isDone ? <Text style={s.okTag}>Concluida</Text>
            : o.days_until_due != null && o.days_until_due >= 0 ? <Text style={[s.daysTag, { color: o.days_until_due <= 7 ? Colors.red : Colors.amber }]}>vence em {o.days_until_due}d</Text>
            : o.status === "overdue" ? <Text style={[s.daysTag, { color: Colors.red }]}>VENCIDA</Text>
            : isFuture ? <Text style={[s.daysTag, { color: Colors.ink3 }]}>futuro</Text>
            : null}
        </View>

        {/* Clear action tag */}
        <View style={[s.actionBadge, { backgroundColor: isAutomatic ? Colors.greenD : Colors.amberD }]}>
          <Text style={[s.actionIcon, { color: isAutomatic ? Colors.green : Colors.amber }]}>{isAutomatic ? "A" : "!"}</Text>
          <Text style={[s.actionText, { color: isAutomatic ? Colors.green : Colors.amber }]}>{isAutomatic ? "Automatico — nao precisa fazer nada" : "Voce precisa agir — guia passo a passo"}</Text>
        </View>

        <Text style={s.desc} numberOfLines={2}>{o.aura_action}</Text>

        {!isDone && !isFuture && (
          <View style={s.cardBottom}>
            <Text style={s.freq}>{o.frequency}</Text>
            <Pressable style={s.guideBtn} onPress={onGuide}><Text style={s.guideBtnText}>{isAutomatic ? "Acompanhar" : "Ver guia"}</Text></Pressable>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 20 },
  itemWrap: { flexDirection: "row", gap: 14 },
  lineCol: { width: 24, alignItems: "center" },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", zIndex: 1 },
  dotCheck: { fontSize: 8, fontWeight: "800", color: "#fff" },
  line: { flex: 1, width: 2, marginVertical: 2 },
  card: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, gap: 8 },
  cardDone: { opacity: 0.7, borderColor: Colors.green + "33" },
  cardFuture: { opacity: 0.5 },
  cardHover: { borderColor: Colors.border2, backgroundColor: Colors.bg4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink, flex: 1 },
  nameDone: { textDecorationLine: "line-through", color: Colors.ink3 },
  okTag: { fontSize: 10, fontWeight: "700", color: Colors.green },
  daysTag: { fontSize: 11, fontWeight: "700" },
  actionBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  actionIcon: { fontSize: 12, fontWeight: "800" },
  actionText: { fontSize: 11, fontWeight: "500" },
  desc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  freq: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  guideBtn: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  guideBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

export default ObligationTimeline;
