// ============================================================
// ParcelaRow — Aura · Crediário (F1 do redesign; spec §2.3)
//
// Linha de parcela COMPACTA com detalhe sob demanda — substitui os
// 3 blocos de JSX quase idênticos da TabParcelas (carnê, órfã,
// sem-carnê) que empilhavam breakdown + 4 botões sempre visíveis.
//
// Colapsada: "Parcela 1/2 · vence dd/mm · R$ valor · badge".
// Expandida (accordion animado): breakdown de encargos + ações.
// Vencida: borda esquerda vermelha 3px — escaneável sem ler.
//
// Presentational: recebe tudo por props, não conhece API.
// ============================================================
import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Collapsible } from "@/components/anim";
import { Motion, webTransition } from "@/constants/motion";

const IS_WEB = Platform.OS === "web";

export interface ParcelaBreakdownLine {
  label: string;
  value: string;
  /** Linha de total: separador tracejado + peso 800. */
  total?: boolean;
}

interface ParcelaRowProps {
  /** "Parcela 1/2" */
  title:      string;
  /** "venceu 27/06 · 11 dias de atraso" | "vence 27/07 · no prazo" */
  subtitle:   string;
  /** "R$ 153,49" (já formatado) */
  amount:     string;
  overdue?:   boolean;
  expanded:   boolean;
  onToggle:   () => void;
  breakdown?: ParcelaBreakdownLine[];
  /** Botões de ação (Alterar data · Pix · Receber) — <Button size="sm" full/>. */
  actions?:   React.ReactNode;
}

export function ParcelaRow({
  title, subtitle, amount, overdue, expanded, onToggle, breakdown, actions,
}: ParcelaRowProps) {
  const chevron = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(chevron, { toValue: expanded ? 1 : 0, duration: Motion.slow, useNativeDriver: false }).start();
  }, [expanded, chevron]);

  const rotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View
      style={[
        s.wrap,
        overdue && s.wrapOverdue,
        IS_WEB ? (webTransition("border-color", Motion.base) as any) : null,
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${subtitle}, ${amount}. Toque para ${expanded ? "recolher" : "ver detalhes"}`}
        style={({ pressed, hovered }: any) => [
          s.head,
          (hovered || pressed) && { backgroundColor: Colors.violetD },
          IS_WEB ? (webTransition("background-color", Motion.fast) as any) : null,
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Text style={s.sub} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Text style={[s.amount, { color: overdue ? Colors.red : Colors.ink }]}>{amount}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon name="chevron_right" size={15} color={expanded ? Colors.violet3 : Colors.ink3} />
        </Animated.View>
      </Pressable>

      <Collapsible open={expanded}>
        {!!breakdown?.length && (
          <View style={s.breakdown}>
            {breakdown.map((l, i) => (
              <View key={i} style={[s.bLine, l.total && s.bTotal]}>
                <Text style={[s.bLabel, l.total && s.bStrong]}>{l.label}</Text>
                <Text style={[s.bValue, l.total && s.bStrong]}>{l.value}</Text>
              </View>
            ))}
          </View>
        )}
        {!!actions && <View style={s.actions}>{actions}</View>}
      </Collapsible>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    marginBottom: 8, overflow: "hidden", backgroundColor: Colors.bg2,
  },
  wrapOverdue: { borderLeftWidth: 3, borderLeftColor: Colors.red },
  head: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 44,
  },
  title: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] as any },
  breakdown: { paddingHorizontal: 14, paddingBottom: 6 },
  bLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bTotal: { borderTopWidth: 1, borderTopColor: Colors.border, borderStyle: "dashed" as any, marginTop: 4, paddingTop: 7 },
  bLabel: { fontSize: 12, color: Colors.ink2 },
  bValue: { fontSize: 12, color: Colors.ink2, fontVariant: ["tabular-nums"] as any },
  bStrong: { fontWeight: "800", color: Colors.ink },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8 },
});

export default ParcelaRow;
