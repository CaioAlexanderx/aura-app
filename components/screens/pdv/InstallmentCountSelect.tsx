/**
 * InstallmentCountSelect — nº de parcelas do crediário no PDV (15/09/2026).
 *
 * Antes eram botões "1x, 2x, ... Nx" em grade. Com o teto padrão de 500
 * parcelas a tela virava um mural de chips e o vencimento da 1ª parcela
 * ia parar lá embaixo, fora da vista. Feedback de lojista.
 *
 * Na web, onde o PDV roda, vira um <select> nativo, no mesmo padrão da troca
 * (components/screens/pdv/troca/SplitForm.tsx). No app nativo não existe
 * <select>: fica o campo numérico que já existia ao lado dos chips.
 *
 * Não importa Icon nem Toast de propósito: os dois não carregam no Jest.
 */
import { useMemo } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { buildInstallmentOptions, clampInstallments } from "@/utils/installmentOptions";

const IS_WEB = Platform.OS === "web";

type Props = {
  value: number;
  onChange: (n: number) => void;
  /** Teto de parcelas da loja. */
  max: number;
  /** Valor total; com ele cada opção mostra o valor da parcela. */
  total?: number;
  formatMoney: (v: number) => string;
  testID?: string;
};

export function InstallmentCountSelect({ value, onChange, max, total = 0, formatMoney, testID }: Props) {
  const options = useMemo(
    () => buildInstallmentOptions(max, total, formatMoney),
    [max, total, formatMoney],
  );

  if (IS_WEB) {
    return (
      <select
        data-testid={testID}
        aria-label="Número de parcelas"
        value={String(value)}
        onChange={(e: any) => onChange(clampInstallments(e.target.value, max))}
        style={selectStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <View style={s.typerWrap} testID={testID}>
      <TextInput
        style={s.typer}
        value={String(value)}
        onChangeText={(raw) => onChange(clampInstallments(raw, max))}
        keyboardType="numeric"
        maxLength={3}
        selectTextOnFocus
        accessibilityLabel="Número de parcelas"
      />
      <Text style={s.suffix}>x</Text>
    </View>
  );
}

// Mesmo visual dos campos do modal (fieldInput): fundo bg3, borda 1.5px, raio 10.
const selectStyle: any = {
  width: "100%",
  backgroundColor: Colors.bg3,
  border: `1.5px solid ${Colors.border}`,
  borderRadius: 10,
  color: Colors.ink,
  padding: "11px 12px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  outline: "none",
  cursor: "pointer",
  // Lista aberta legível no tema escuro (o dropdown é desenhado pelo navegador).
  colorScheme: IS_DARK_MODE ? "dark" : "light",
};

const s = StyleSheet.create({
  typerWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  typer: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.ink, paddingVertical: 7 },
  suffix: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
});
