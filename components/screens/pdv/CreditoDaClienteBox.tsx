// ============================================================
// AURA. — Caixa: caixa "Crédito da cliente" (INC-2026-11-17-03)
//
// Logo acima das formas de pagamento, como a caixa da garantia. Só aparece
// com cliente escolhida, carrinho com itens e saldo a favor nesta loja.
// "Usar na venda" abate o que der (até o saldo e até o total); o valor é
// editável. O resto se paga como sempre (chip ou dividido).
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useLeitorNoCampo } from "@/hooks/useLeitorNoCampo";
import { TEXTOS_DO_CREDITO as T, lerValor } from "./creditoDaCliente";

export type CreditoDoCaixa = {
  saldo: number;
  usado: number;
  aPagar: number;
  usar: () => void;
  mudar: (valor: number) => void;
  naoUsar: () => void;
};

function paraTexto(v: number): string {
  return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).replace(".", ",");
}

/** `onScan`: o bipe com o cursor no campo vai para o carrinho (p-157), como
 *  nos outros campos do carrinho. */
export function CreditoDaClienteBox({ credito, disabled, onScan }: { credito: CreditoDoCaixa; disabled?: boolean; onScan?: (code: string) => void }) {
  const { saldo, usado, aPagar } = credito;
  const emUso = usado > 0;
  const [texto, setTexto] = useState(paraTexto(usado));
  // O valor que vale pode mudar por fora (o total da venda caiu, o saldo
  // mudou): o campo acompanha.
  useEffect(() => { setTexto(paraTexto(usado)); }, [usado]);
  const ligarLeitor = useLeitorNoCampo({ escrever: setTexto, onLeitura: onScan });

  function gravar() {
    const v = lerValor(texto);
    if (!Number.isFinite(v) || v <= 0) { credito.naoUsar(); return; }
    credito.mudar(v);
    setTexto(paraTexto(Math.min(v, saldo)));
  }

  const sobra = Math.round((saldo - usado) * 100) / 100;

  return (
    <View testID="caixa-credito-da-cliente" style={[st.box, emUso && st.boxOn]}>
      <View style={st.top}>
        <Icon name="wallet" size={16} color={emUso ? Colors.violet3 : Colors.ink2} />
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{T.titulo}</Text>
          <Text testID="credito-disponivel" style={st.sub}>{T.disponivel(saldo)}</Text>
        </View>
        <Pressable
          testID={emUso ? "credito-nao-usar" : "credito-usar"}
          onPress={emUso ? credito.naoUsar : credito.usar}
          disabled={disabled}
          hitSlop={6}
          style={disabled ? { opacity: 0.5 } : null}
        >
          <Text style={st.action}>{emUso ? T.naoUsar : T.usar}</Text>
        </Pressable>
      </View>
      {emUso && (
        <View style={st.body}>
          <View style={st.row}>
            <Text style={st.label}>{T.campo}</Text>
            <View style={st.inputBox}>
              <Text style={st.prefix}>R$</Text>
              <TextInput
                ref={ligarLeitor}
                testID="credito-valor"
                value={texto}
                onChangeText={setTexto}
                onBlur={gravar}
                onSubmitEditing={gravar}
                keyboardType="decimal-pad"
                editable={!disabled}
                selectTextOnFocus
                style={st.input}
                accessibilityLabel={T.campo}
              />
            </View>
          </View>
          <Text testID="credito-a-pagar" style={st.resto}>
            {aPagar > 0.005 ? T.aPagar(aPagar) : T.pagoNoCredito}
          </Text>
          {sobra > 0.005 ? <Text style={st.sub}>{T.sobra(sobra)}</Text> : null}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  box: {
    padding: 11, marginBottom: 10, gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  boxOn: { borderColor: Colors.violet, backgroundColor: Colors.violet + "14" },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  action: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  body: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { fontSize: 12, color: Colors.ink2 },
  inputBox: {
    flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 8, paddingHorizontal: 8, backgroundColor: Colors.bg2,
  },
  prefix: { fontSize: 12, color: Colors.ink3 },
  input: { width: 84, paddingVertical: 6, fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "right" },
  resto: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
