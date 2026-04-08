import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Obligation } from "./types";
import { STATUS_COLORS, FILTER_CONFIG } from "./types";

type Props = { obligation: Obligation; onGuide: () => void };

export function CheckpointCard({ obligation: o, onGuide }: Props) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const bc = STATUS_COLORS[o.status] || Colors.ink3;
  const fc = FILTER_CONFIG[o.filter_label];
  const locked = o.status === "future";
  const pct = o.checkpoint_total > 0 ? Math.round((o.checkpoint_done / o.checkpoint_total) * 100) : 0;

  return (
    <Pressable onPress={locked ? undefined : onGuide} onHoverIn={w && !locked ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[s.card, { borderLeftColor: bc }, locked && s.locked, h && s.hovered, w && { transition: "all 0.15s ease" } as any]}>
      <View style={s.topRow}>
        <View style={[s.statusDot, { backgroundColor: bc }]} />
        <Text style={s.name} numberOfLines={1}>{o.name}</Text>
        {o.status === "done" ? <Text style={[s.statusTag, { color: Colors.green }]}>OK</Text>
          : o.days_until_due != null && o.days_until_due >= 0 ? <Text style={[s.statusTag, { color: o.days_until_due <= 7 ? Colors.red : Colors.amber }]}>{o.days_until_due}d</Text>
          : o.status === "overdue" ? <Text style={[s.statusTag, { color: Colors.red }]}>VENCIDA</Text>
          : null}
      </View>

      <View style={[s.badge, { backgroundColor: fc.bg }]}><Text style={[s.badgeText, { color: fc.color }]}>{fc.label}</Text></View>

      <Text style={s.desc} numberOfLines={2}>{o.aura_action}</Text>

      {o.checkpoint_total > 0 && o.status !== "done" && (
        <View style={s.progressRow}>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: `${pct}%` }]} /></View>
          <Text style={s.progressText}>{o.checkpoint_done}/{o.checkpoint_total}</Text>
        </View>
      )}

      <View style={s.bottom}>
        <Text style={s.freq}>{o.frequency}</Text>
        {o.status !== "done" && <Pressable style={s.guideBtn} onPress={onGuide}><Text style={s.guideBtnText}>Ver guia</Text></Pressable>}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderRadius: 14, padding: 14, gap: 6 },
  locked: { opacity: 0.5 },
  hovered: { borderColor: Colors.border2, backgroundColor: Colors.bg4 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink, flex: 1 },
  statusTag: { fontSize: 11, fontWeight: "800" },
  badge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: 10, fontWeight: "600" },
  desc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.violet },
  progressText: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  freq: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  guideBtn: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  guideBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

export default CheckpointCard;
