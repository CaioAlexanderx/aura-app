import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch, TextInput } from "react-native";
import type { PdvSettings } from "@/services/api";

// ============================================================
// AURA. — Taxa da maquininha (seção compartilhada)
//
// 18/08/2026: extraída do PdvSettingsCard porque a taxa vale pro
// shell Negócio E pro Studio (backend PR #501), mas empresas com
// vertical_active='studio' são redirecionadas de /configuracoes
// pelo guard do _layout e nunca viam o toggle. Cada shell renderiza
// esta seção com sua própria paleta (Colors no varejo, tokens do
// useStudioTokens no Studio) e seu próprio ciclo de save.
//
// O componente é presentacional: quem monta é dono do estado
// (display/saving/onToggle). Isso preserva, no varejo, o `saving`
// único que serializa os PUTs de todos os toggles do card — o
// PUT /pdv-settings substitui o jsonb inteiro, então dois saves
// concorrentes partindo do mesmo cache perderiam a mudança um
// do outro.
// ============================================================

export type CardFeePalette = {
  label: string;       // texto principal das linhas
  desc: string;        // descrição do toggle
  hint: string;        // hints, rodapé e placeholder
  trackOff: string;    // Switch: trilho desligado
  trackOn: string;     // Switch: trilho ligado
  thumbOff: string;    // Switch: bolinha desligada
  thumbOn: string;     // Switch: bolinha ligada
  inputBg: string;
  inputBorder: string;
  inputText: string;
  boxBorder: string;   // borda esquerda do bloco de alíquotas
};

type Props = {
  display: PdvSettings;
  saving: boolean;
  onToggle: (key: keyof PdvSettings, value: boolean | number) => void;
  palette: CardFeePalette;
};

export function CardFeeSection({ display, saving, onToggle, palette }: Props) {
  // Crédito e débito têm alíquotas próprias, então cada campo guarda
  // o texto em edição separadamente e só persiste no blur.
  const [creditFeeInput, setCreditFeeInput] = useState<string>("");
  const [debitFeeInput, setDebitFeeInput] = useState<string>("");
  const s = useMemo(() => buildStyles(palette), [palette]);

  function commitPct(raw: string, key: "card_fee_credit_pct" | "card_fee_debit_pct") {
    const n = Math.max(0, Math.min(100, Number((raw || "").replace(/[^\d.]/g, "")) || 0));
    if (n !== Number(display[key] || 0)) {
      onToggle(key, n);
    }
  }

  return (
    <>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Taxa da maquininha</Text>
          <Text style={s.rowDesc}>Lança sozinho a despesa do que a maquininha retém em cada venda no cartão. Sua receita continua cheia — a taxa entra separada, na data da venda.</Text>
        </View>
        <Switch
          value={display.card_fee_enabled === true}
          onValueChange={function(v) { onToggle("card_fee_enabled", v); }}
          trackColor={{ false: palette.trackOff, true: palette.trackOn }}
          thumbColor={display.card_fee_enabled === true ? palette.thumbOn : palette.thumbOff}
          disabled={saving}
        />
      </View>

      {display.card_fee_enabled === true && (
        <View style={s.cardFeeBox}>
          <View style={s.cardFeeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardFeeLabel}>Crédito</Text>
              <Text style={s.cardFeeHint}>Quanto a adquirente retém no crédito</Text>
            </View>
            <TextInput
              value={creditFeeInput || String(display.card_fee_credit_pct ?? "")}
              onChangeText={setCreditFeeInput}
              onBlur={() => {
                commitPct(creditFeeInput, "card_fee_credit_pct");
                setCreditFeeInput("");
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.hint}
              style={s.feeInput}
              editable={!saving}
            />
            <Text style={s.pctSign}>%</Text>
          </View>

          <View style={s.cardFeeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardFeeLabel}>Débito</Text>
              <Text style={s.cardFeeHint}>Quanto a adquirente retém no débito</Text>
            </View>
            <TextInput
              value={debitFeeInput || String(display.card_fee_debit_pct ?? "")}
              onChangeText={setDebitFeeInput}
              onBlur={() => {
                commitPct(debitFeeInput, "card_fee_debit_pct");
                setDebitFeeInput("");
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.hint}
              style={s.feeInput}
              editable={!saving}
            />
            <Text style={s.pctSign}>%</Text>
          </View>

          <Text style={s.cardFeeFoot}>As alíquotas estão no extrato da sua adquirente. Taxa extra por parcelamento não entra nesta conta.</Text>
        </View>
      )}
    </>
  );
}

function buildStyles(p: CardFeePalette) {
  return StyleSheet.create({
    row:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    rowLabel:     { fontSize: 13, color: p.label, fontWeight: "600" },
    rowDesc:      { fontSize: 11, color: p.desc, marginTop: 2, lineHeight: 15 },
    pctSign:      { color: p.desc, fontSize: 13, fontWeight: "700" },
    cardFeeBox:   {
      marginTop: 2, marginBottom: 6, paddingLeft: 10,
      borderLeftWidth: 2, borderLeftColor: p.boxBorder,
    },
    cardFeeRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
    cardFeeLabel: { fontSize: 12, color: p.label, fontWeight: "600" },
    cardFeeHint:  { fontSize: 10, color: p.hint, marginTop: 1 },
    cardFeeFoot:  { fontSize: 10, color: p.hint, marginTop: 4, lineHeight: 14 },
    feeInput: {
      backgroundColor: p.inputBg, color: p.inputText,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
      borderWidth: 1, borderColor: p.inputBorder,
      fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "center",
    },
  });
}

export default CardFeeSection;
