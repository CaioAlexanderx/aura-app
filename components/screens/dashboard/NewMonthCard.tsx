// ============================================================
// AURA. — NewMonthCard (01/09/2026)
//
// QA da virada do mês. O Painel usava o onboarding de conta nova
// ("Bem-vindo, Lorena! Seu painel vai ganhar vida...") sempre que o mês
// corrente estava zerado. Como o critério era "mês atual sem movimento",
// TODA lojista via isso todo dia 1º — com R$ 15 mil de histórico e 602
// clientes na conta — e a leitura era "meus dados sumiram".
//
// Este card é o outro lado da bifurcação: mês começando, com o
// fechamento do mês anterior em destaque (momento de valor em vez de
// susto) e os CTAs da operação do dia no lugar dos de cadastro inicial.
//
// Layout: reaproveita a estrutura do EmptyDashboard (mesmo wrap glass,
// mesmo anel, mesma faixa de ações) de propósito — nenhum layout novo
// foi inventado aqui.
// ============================================================
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE, fmt, webOnly } from "./types";

export type PreviousMonthTotals = { income: number; expenses: number; net: number };

type Props = {
  /** Mês corrente já capitalizado: "Setembro". */
  monthLabel: string;
  /** Mês anterior em minúsculas, pra usar no meio da frase: "agosto". */
  prevMonthLabel: string;
  /** Fechamento do mês anterior. null quando o histórico não veio. */
  prevTotals?: PreviousMonthTotals | null;
  /** Estamos nos primeiros dias do mês (fuso BR)? Muda só o título. */
  early: boolean;
  onPress: (path: string) => void;
};

export function NewMonthCard({ monthLabel, prevMonthLabel, prevTotals, early, onPress }: Props) {
  const webCard = webOnly({
    background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,91,213,0.05))",
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
  });
  const webOrb = webOnly({
    width: 84, height: 84, borderRadius: 42,
    background: "conic-gradient(from 0deg, #7c3aed, #8b5cf6, #4f5bd5, #7c3aed)",
    padding: 3,
    animation: "auraSpin 6s linear infinite",
  });

  const hasPrev = !!prevTotals;

  // Título: nos primeiros dias é "mês começando"; depois disso o mês já
  // andou e o texto honesto é que ele segue sem movimento.
  const title = early ? monthLabel + " começando" : monthLabel + " ainda sem movimento";

  const sub = hasPrev
    ? prevMonthLabel.charAt(0).toUpperCase() + prevMonthLabel.slice(1) +
      " fechou em " + fmt(prevTotals!.income) + " de entradas. " +
      "Os números de " + monthLabel.toLowerCase() + " aparecem aqui assim que o primeiro lançamento entrar."
    : "Nenhum lançamento em " + monthLabel.toLowerCase() + " ainda. " +
      "Seu histórico continua inteiro no Financeiro — aqui o mês é que está começando.";

  return (
    <View style={[s.wrap, Platform.OS === "web" ? (webCard as any) : { backgroundColor: Colors.bg3 }]}>
      <View style={[s.ring, Platform.OS === "web" ? (webOrb as any) : { backgroundColor: Colors.violet }]}>
        <View style={s.ringInner}><Icon name="calendar" size={28} color={Colors.violet3} /></View>
      </View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{sub}</Text>

      {hasPrev && (
        <View style={s.prevPanel}>
          <Text style={s.prevTitle}>Fechamento de {prevMonthLabel}</Text>
          <View style={s.prevRow}>
            <View style={s.prevItem}>
              <Text style={s.prevK}>Entrou</Text>
              <Text style={[s.prevV, { color: Colors.green }]}>{fmt(prevTotals!.income)}</Text>
            </View>
            <View style={s.prevItem}>
              <Text style={s.prevK}>Saiu</Text>
              <Text style={[s.prevV, { color: Colors.red }]}>{fmt(prevTotals!.expenses)}</Text>
            </View>
            <View style={s.prevItem}>
              <Text style={s.prevK}>Resultado</Text>
              <Text style={[s.prevV, { color: prevTotals!.net >= 0 ? Colors.ink : Colors.red }]}>{fmt(prevTotals!.net)}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={s.actions}>
        {/* CTA da operação do dia — não de cadastro inicial. */}
        <Pressable
          style={[s.action, s.actionPrimary]}
          onPress={() => onPress("/pdv")}
          accessibilityRole="button"
          {...({ dataSet: { auraHover: "card" } } as any)}
        >
          <Icon name="cart" size={18} color="#fff" />
          <Text style={[s.actionText, { color: "#fff" }]}>Abrir o Caixa</Text>
        </Pressable>
        {/* Atalho pro fechamento: a Visão geral do Financeiro abre já com o
            comparativo mês x mês anterior. */}
        <Pressable
          style={s.action}
          onPress={() => onPress("/financeiro?tab=visao")}
          accessibilityRole="button"
          {...({ dataSet: { auraHover: "card" } } as any)}
        >
          <Icon name="bar_chart" size={18} color={Colors.violet3} />
          <Text style={s.actionText}>Ver o fechamento de {prevMonthLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 24, padding: 32,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", marginBottom: 28,
  },
  ring: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  ringInner: { width: 78, height: 78, borderRadius: 39, backgroundColor: Colors.bg2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: Colors.ink, marginBottom: 10, letterSpacing: -0.3, textAlign: "center" },
  sub: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 20, maxWidth: 420 },

  prevPanel: {
    width: "100%", borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    backgroundColor: Glass.lineWhisper,
  },
  prevTitle: {
    fontSize: 10, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 10, textAlign: "center",
  },
  prevRow: { flexDirection: "row", justifyContent: "space-around", gap: 12 },
  prevItem: { alignItems: "center", flex: 1, minWidth: 0 },
  prevK: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 4 },
  prevV: {
    fontSize: 14, fontWeight: "700",
    fontFamily: (Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" : undefined),
  },

  actions: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, width: "100%" },
  action: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "rgba(14,18,40,0.55)", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    flex: 1,
  },
  actionPrimary: { backgroundColor: Colors.violet, borderColor: "rgba(255,255,255,0.18)" },
  actionText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
});

export default NewMonthCard;
