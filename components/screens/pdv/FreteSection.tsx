// ============================================================
// AURA. — Caixa: seção "Frete / entrega" do resumo do carrinho (30/10/2026)
//
// Mesmo desenho do "Desconto manual" (DiscountSection): rótulo em caixa
// alta, campo de valor e o "x" para tirar. Embaixo, a quem a entrega vai:
// o cliente da venda (não existe um segundo cadastro — "Vincular cliente"
// abre o seletor do topo do Caixa, o mesmo do chip "Cliente").
// Mockup: docs/mockups/frete-no-caixa.html, tela B e C.
// ============================================================
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { textoDoFrete } from "@/utils/frete";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export type FreteProps = {
  /** O texto do campo (useCart.freteValor). */
  value: string;
  onChange: (v: string) => void;
  /** O valor que vale (useCart.frete). 0 = campo vazio ou inválido. */
  amount: number;
  /** Tira o frete e fecha a seção. */
  onClear: () => void;
  /** Cliente da venda, se houver. */
  customerName: string | null;
  /** Abre o seletor de cliente do Caixa. Ausente = loja sem Clientes no
   *  Caixa: a linha do cliente nem aparece. */
  onPickCustomer?: () => void;
};

export function FreteSection({ value, onChange, amount, onClear, customerName, onPickCustomer }: FreteProps) {
  return (
    <View style={s.container} testID="frete-secao">
      <View style={s.header}>
        <Text style={s.label}>Frete / entrega</Text>
        <Pressable onPress={onClear} style={s.clearBtn} testID="frete-tirar" accessibilityLabel="Tirar o frete">
          <Icon name="x" size={10} color={Colors.red} />
        </Pressable>
      </View>

      <View style={s.row}>
        <Text style={s.prefix}>R$</Text>
        <TextInput
          testID="frete-valor"
          style={s.input}
          value={value}
          onChangeText={(t) => onChange(textoDoFrete(t))}
          placeholder="0,00"
          placeholderTextColor={Colors.ink3}
          keyboardType="decimal-pad"
          inputMode="decimal"
          maxLength={9}
          autoFocus
        />
        {amount > 0 && (
          <Text style={s.resultText} testID="frete-resultado">+{fmt(amount)}</Text>
        )}
      </View>

      {onPickCustomer && (
        <Pressable
          onPress={onPickCustomer}
          style={[s.para, !customerName && s.paraVazio]}
          testID="frete-cliente"
          accessibilityRole="button"
          accessibilityLabel={customerName ? "Entrega para " + customerName + ", trocar o cliente" : "Vincular um cliente à entrega"}
        >
          <Icon name={customerName ? "truck" : "user"} size={13} color={Colors.violet3} />
          <Text style={[s.paraTxt, !customerName && s.paraTxtVazio]} numberOfLines={1}>
            {customerName ? <>Entrega para <Text style={s.paraNome}>{customerName}</Text></> : "Entrega sem cliente vinculado"}
          </Text>
          <Text style={s.paraAcao} numberOfLines={1}>{customerName ? "Trocar" : "Vincular cliente"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 2, marginBottom: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  clearBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefix: { fontSize: 12, color: Colors.ink3, fontWeight: "700", paddingLeft: 2 },
  input: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  resultText: { fontSize: 14, color: Colors.violet3, fontWeight: "700", minWidth: 80, textAlign: "right" },
  para: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  paraVazio: { backgroundColor: "transparent", borderStyle: "dashed" },
  paraTxt: { flex: 1, fontSize: 12, color: Colors.ink2 },
  paraTxtVazio: { color: Colors.ink3 },
  paraNome: { color: Colors.ink, fontWeight: "600" },
  paraAcao: { fontSize: 11, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
});

export default FreteSection;
