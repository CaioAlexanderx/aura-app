import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WebPortal } from "@/components/WebPortal";
import {
  LIMITE_SEM_CONFIRMACAO_PCT, avisoDoLimite, resolverDescontoManual, textoDoPct,
} from "@/utils/descontoManual";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A pergunta do desconto acima de 50% (useCart.confirmacaoDoDesconto ou a troca). */
export type ConfirmacaoDoDesconto = {
  aberta: boolean;
  mensagem: string;
  confirmar: () => void;
  voltar: () => void;
  /** Saiu do campo: o dono decide se pergunta já. */
  aoTerminarDeDigitar?: () => void;
};

type Props = {
  total: number;
  discountType: "%" | "R$";
  setDiscountType: (t: "%" | "R$") => void;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  manualDiscountAmount: number;
  clearDiscount: () => void;
  /** 12/11/2026: sem a prop, nada de pergunta (usos sem venda). */
  confirmacao?: ConfirmacaoDoDesconto;
  /** Acima de 50% e ainda não confirmado. */
  pendente?: boolean;
};

/**
 * P1 #1: Manual discount section for PDV CartPanel (e Step4 da troca).
 * Toggle % / R$ e o desconto calculado.
 *
 * 12/11/2026: até 100% do total (antes, teto silencioso de 50%). Acima de
 * 50% pede confirmação no ConfirmDialog (via WebPortal); digitado acima do
 * total (R$) ou de 100% (%), a tela diz e vale o total.
 */
export function DiscountSection({
  total, discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
  confirmacao, pendente,
}: Props) {
  const d = resolverDescontoManual(total, discountType, discountValue);
  const aviso = avisoDoLimite(d);

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
          testID="desconto-campo"
          style={[s.input, (aviso || pendente) && s.inputError]}
          value={discountValue}
          onChangeText={setDiscountValue}
          onBlur={() => confirmacao?.aoTerminarDeDigitar?.()}
          onSubmitEditing={() => confirmacao?.aoTerminarDeDigitar?.()}
          placeholder={discountType === "%" ? "0" : "0,00"}
          placeholderTextColor={Colors.ink3}
          keyboardType="decimal-pad"
          maxLength={10}
        />

        {/* Computed result */}
        {manualDiscountAmount > 0 && (
          <View style={s.result}>
            <Text testID="desconto-valor" style={s.resultText}>-{fmt(manualDiscountAmount)}</Text>
            {discountType === "R$" && <Text style={s.resultPct}>({textoDoPct(d.pct)})</Text>}
          </View>
        )}
      </View>

      {aviso ? <Text testID="desconto-aviso-limite" style={s.warn}>{aviso}</Text> : null}
      {!aviso && d.valor > 0 && discountType === "%" && (
        <Text style={s.hint}>{textoDoPct(d.pct)} de {fmt(total)} = -{fmt(manualDiscountAmount)}</Text>
      )}
      {pendente ? (
        <Text testID="desconto-pendente" style={s.pend}>
          Acima de {LIMITE_SEM_CONFIRMACAO_PCT}%: confirme o desconto antes de finalizar.
        </Text>
      ) : null}

      {confirmacao ? (
        <WebPortal active={confirmacao.aberta}>
          <ConfirmDialog
            visible={confirmacao.aberta}
            title={`Desconto acima de ${LIMITE_SEM_CONFIRMACAO_PCT}%`}
            message={confirmacao.mensagem}
            confirmLabel="Confirmar desconto"
            cancelLabel="Voltar"
            destructive={false}
            onConfirm={confirmacao.confirmar}
            onCancel={confirmacao.voltar}
          />
        </WebPortal>
      ) : null}
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
  inputError: { borderColor: Colors.amber },
  result: { alignItems: "flex-end", minWidth: 80 },
  resultText: { fontSize: 14, color: Colors.red, fontWeight: "700" },
  resultPct: { fontSize: 10, color: Colors.ink3 },
  warn: { fontSize: 11, color: Colors.red, marginTop: 4 },
  pend: { fontSize: 11, color: Colors.amber, marginTop: 4 },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" as any },
});

export default DiscountSection;
