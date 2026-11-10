import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Switch, TextInput } from "react-native";
import type { PdvSettings } from "@/services/api";
import { parsePercent, formatPercent } from "@/utils/parsePercent";

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
// (display/saving/onToggle). Os dois shells usam o
// useSalvarPdvSettings, que serializa os PUTs numa fila e monta
// cada corpo do último salvo + o pendente (10/11/2026).
//
// 09/11/2026: "Pix pela maquininha %" (card_fee_pix_pct), logo abaixo do
// Débito. A venda não sabe se o Pix passou pela maquininha, então com o
// campo > 0 toda venda Pix paga a taxa (backend). 0 ou vazio = Pix sem
// taxa, igual a antes.
//
// 10/11/2026 (incidente: 14 lojas com a chave ligada e tudo em 0%): a
// alíquota só era gravada no blur. No navegador, o blur não chega quando o
// campo some sem clique (Esc, voltar do navegador ou do mouse, atalho que
// troca de tela) — medido no Chrome: digitar e desmontar sem clique não
// dispara o onBlur do React. Agora grava também ao digitar (com uma pausa
// curta), no Enter e ao sair da tela. O campo não trava mais durante o save
// (o que se digitava nesse meio-tempo sumia). Com a chave ligada e tudo em
// 0%, um aviso diz que nada será lançado.
// ============================================================

type PctKey = "card_fee_credit_pct" | "card_fee_debit_pct" | "card_fee_pix_pct";
const PCT_KEYS: PctKey[] = ["card_fee_credit_pct", "card_fee_debit_pct", "card_fee_pix_pct"];

/** Espera depois da última tecla antes de gravar a alíquota digitada. */
export const CARD_FEE_DEBOUNCE_MS = 700;

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
  // Cada campo guarda o texto em edição separadamente.
  // null = campo intocado (mostra o valor salvo); "" = a lojista apagou.
  const [creditFeeInput, setCreditFeeInput] = useState<string | null>(null);
  const [debitFeeInput, setDebitFeeInput] = useState<string | null>(null);
  const [pixFeeInput, setPixFeeInput] = useState<string | null>(null);
  const s = useMemo(() => buildStyles(palette), [palette]);

  // Refs: o timer e a desmontagem precisam do texto e do display MAIS
  // RECENTES, não dos que estavam no render em que o timer nasceu.
  const rascunho = useRef<Record<PctKey, string | null>>({ card_fee_credit_pct: null, card_fee_debit_pct: null, card_fee_pix_pct: null });
  const timers = useRef<Partial<Record<PctKey, ReturnType<typeof setTimeout>>>>({});
  const atual = useRef({ display, onToggle });
  atual.current = { display, onToggle };

  const setters: Record<PctKey, (v: string | null) => void> = {
    card_fee_credit_pct: setCreditFeeInput,
    card_fee_debit_pct: setDebitFeeInput,
    card_fee_pix_pct: setPixFeeInput,
  };

  function commitPct(key: PctKey) {
    const t = timers.current[key];
    if (t) { clearTimeout(t); delete timers.current[key]; }
    const raw = rascunho.current[key];
    if (raw === null) return; // não mexeu no campo: nada a gravar
    // Vírgula e ponto valem como decimal ("11,52" = 11.52), até 2 casas.
    const n = parsePercent(raw, 100);
    const { display: d, onToggle: gravar } = atual.current;
    if (n !== Number(d[key] || 0)) gravar(key, n);
  }

  function digitar(key: PctKey, texto: string) {
    rascunho.current[key] = texto;
    setters[key](texto);
    const t = timers.current[key];
    if (t) clearTimeout(t);
    timers.current[key] = setTimeout(() => commitPct(key), CARD_FEE_DEBOUNCE_MS);
  }

  function sair(key: PctKey) {
    commitPct(key);
    rascunho.current[key] = null;
    setters[key](null);
  }

  // Saiu da tela com algo digitado e ainda não gravado (a pausa não
  // terminou e o blur não veio): grava agora.
  useEffect(() => () => { PCT_KEYS.forEach(commitPct); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Vale o que está na tela: o digitado (se houver) ou o salvo.
  const efetivo = (key: PctKey, input: string | null) => (input !== null ? parsePercent(input, 100) : Number(display[key] || 0));
  const tudoZerado = efetivo("card_fee_credit_pct", creditFeeInput) <= 0
    && efetivo("card_fee_debit_pct", debitFeeInput) <= 0
    && efetivo("card_fee_pix_pct", pixFeeInput) <= 0;

  function campo(key: PctKey, testID: string, input: string | null) {
    return (
      <TextInput
        testID={testID}
        value={input ?? formatPercent(display[key])}
        onChangeText={(t) => digitar(key, t)}
        onBlur={() => sair(key)}
        onSubmitEditing={() => commitPct(key)}
        returnKeyType="done"
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={palette.hint}
        style={s.feeInput}
      />
    );
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
          {tudoZerado && (
            <Text style={s.avisoZero} testID="card-fee-aviso-zero">
              Preencha a taxa do crédito, do débito ou do Pix. Com 0%, nada é lançado.
            </Text>
          )}
          <View style={s.cardFeeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardFeeLabel}>Crédito</Text>
              <Text style={s.cardFeeHint}>Quanto a adquirente retém no crédito</Text>
            </View>
            {campo("card_fee_credit_pct", "card-fee-credit", creditFeeInput)}
            <Text style={s.pctSign}>%</Text>
          </View>

          <View style={s.cardFeeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardFeeLabel}>Débito</Text>
              <Text style={s.cardFeeHint}>Quanto a adquirente retém no débito</Text>
            </View>
            {campo("card_fee_debit_pct", "card-fee-debit", debitFeeInput)}
            <Text style={s.pctSign}>%</Text>
          </View>

          <View style={s.cardFeeRow} testID="card-fee-pix-row">
            <View style={{ flex: 1 }}>
              <Text style={s.cardFeeLabel}>Pix pela maquininha</Text>
              <Text style={s.cardFeeHint}>Se o Pix cai direto na chave da loja, deixe 0.</Text>
            </View>
            {campo("card_fee_pix_pct", "card-fee-pix", pixFeeInput)}
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
    avisoZero:    { fontSize: 11, color: p.label, fontWeight: "600", lineHeight: 15, paddingTop: 4, paddingBottom: 2 },
    feeInput: {
      backgroundColor: p.inputBg, color: p.inputText,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
      borderWidth: 1, borderColor: p.inputBorder,
      fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "center",
    },
  });
}

export default CardFeeSection;
