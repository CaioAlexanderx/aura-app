import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt } from "./types";

// ============================================================
// AURA. — MonthExpensesBanner (Tarefa C — Bug Eryca)
//
// Banner amarelo discreto que aparece quando o filtro de periodo
// atual NAO esta mostrando despesas do mes vigente, mas existem.
//
// Caso real: Eryca tem 25 despesas (11 pending + 14 confirmed)
// distribuidas em mar/2026 e mai/2026 a mar/2027. No filtro padrao
// "Mensal" (= abr/2026) ela ve 0 despesas e acha que tem bug.
//
// Banner so renderiza quando:
//   - filtro != "month" (ja mostraria as do mes)
//   - filtro != "all"   (ja mostraria as do mes)
//   - currentMonthExpenses.count > 0
// ============================================================

type Props = {
  count: number;
  total: number;
  onSwitchToMonth: () => void;
};

export function MonthExpensesBanner({ count, total, onSwitchToMonth }: Props) {
  if (count === 0) return null;

  var amber = Colors.amber || "#f59e0b";

  return (
    <View style={[s.box, { borderColor: amber + "40", backgroundColor: amber + "10" }]}>
      <Icon name="alert" size={14} color={amber} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>
          Voce tem <Text style={[s.count, { color: amber }]}>{count} despesa{count === 1 ? "" : "s"}</Text>
          {" "}no mes atual ({fmt(total)})
        </Text>
        <Text style={s.subtitle}>
          O filtro selecionado nao esta exibindo essas despesas.
        </Text>
      </View>
      <Pressable onPress={onSwitchToMonth} style={[s.btn, { backgroundColor: amber }]} hitSlop={4}>
        <Text style={s.btnText}>Ver mes atual</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  title: { fontSize: 12, color: Colors.ink, lineHeight: 16 },
  count: { fontWeight: "700" },
  subtitle: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { fontSize: 11, color: "#fff", fontWeight: "700" },
});

export default MonthExpensesBanner;
