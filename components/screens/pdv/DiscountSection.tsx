import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const MAX_PCT = 50;
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Props = {
  total: number;
  discountType: "%" | "R$";
  setDiscountType: (t: "%" | "R$") => void;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  manualDiscountAmount: number;
  clearDiscount: () => void;
};

/**
 * P1 #1: Manual discount section for PDV CartPanel
 * Toggle between % and R$, max 50%, shows computed discount
 */
export function DiscountSection({ total, discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount }: Props) {
  const parsed = parseFloat(discountValue.replace(",", ".")) || 0;
  const isOverMax = discountType === "%" && parsed > MAX_PCT;
  const effectivePct = total > 0 ? Math.round(manualDiscountAmount / total * 100) : 0;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.label}>Desconto manual</Text>
        {manualDiscountAmount > 0 && (
          <Pressable onPress={clearDiscount} style={s.clearBtn}>
            <Icon name="x" size={10} color={Colors.red} />
          </Pressable>
        )}
      </View>

      <View style={s.row}>
        {/* Type toggle */}
        <View style={s.toggle}>
          <Pressable onPress={() => setDiscountType("%")} style={[s.toggleBtn, discountType === "%" && s.toggleActive]}>
            <Text style={[s.toggleText, discountType === "%" && s.toggleTextActive]}>%</Text>
          </Pressable>
          <Pressable onPress={() => setDiscountType("R$")} style={[s.toggleBtn, discountType === "R$" && s.toggleActive]}>
            <Text style={[s.toggleText, discountType === "R$" && s.toggleTextActive]}>R$</Text>
          </Pressable>
        </View>

        {/* Value input */}
        <TextInput
          style={[s.input, isOverMax && s.inputError]}
          value={discountValue}
          onChangeText={setDiscountValue}
          placeholder={discountType === "%" ? "0" : "0,00"}
          placeholderTextColor={Colors.ink3}
          keyboardType="decimal-pad"
          maxLength={6}
        />

        {/* Computed result */}
        {manualDiscountAmount > 0 && (
          <View style={s.result}>
            <Text style={s.resultText}>-{fmt(manualDiscountAmount)}</Text>
            {discountType === "R$" && <Text style={s.resultPct}>({effectivePct}%)</Text>}
          </View>
        )}
      </View>

      {isOverMax && <Text style={s.warn}>Desconto limitado a {MAX_PCT}%</Text>}
      {!isOverMax && parsed > 0 && discountType === "%" && (
        <Text style={s.hint}>{parsed}% de {fmt(total)} = -{fmt(manualDiscountAmount)}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 2, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  clearBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggle: { flexDirection: "row", backgroundColor: Colors.bg, borderRadius: 8, padding: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  toggleActive: { backgroundColor: Colors.violet },
  toggleText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  input: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  inputError: { borderColor: Colors.red },
  result: { alignItems: "flex-end", minWidth: 80 },
  resultText: { fontSize: 14, color: Colors.red, fontWeight: "700" },
  resultPct: { fontSize: 10, color: Colors.ink3 },
  warn: { fontSize: 10, color: Colors.red, marginTop: 4 },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" as any },
});

export default DiscountSection;
