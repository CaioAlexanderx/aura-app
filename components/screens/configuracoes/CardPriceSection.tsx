import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch, TextInput } from "react-native";
import type { PdvSettings } from "@/services/api";
import type { CardFeePalette } from "@/components/screens/configuracoes/CardFeeSection";
import { fmtPct, fmtReais, precoNoCartaoAutomatico } from "@/utils/precoNoCartao";

// ============================================================
// AURA. — "Cobro mais no cartão" (22/09/2026)
// Mockup aprovado: docs/mockups/preco-no-cartao.html, tela 1.
//
// Mora no quadro "Cartão" das Políticas do Caixa, logo abaixo da Taxa da
// maquininha — o lojista pensa nas duas juntas ("cobro 11% porque a
// máquina me come 4,5%"), mas uma não liga a outra. Todos os planos.
//
// Mesmo desenho da CardFeeSection: presentacional, quem monta é dono do
// estado e do save (o `saving` único do PdvSettingsCard serializa os PUTs).
// Desligada, só a linha do toggle existe; o resto nasce quando liga.
// ============================================================

type Props = {
  display: PdvSettings;
  saving: boolean;
  onToggle: (key: keyof PdvSettings, value: boolean | number) => void;
  palette: CardFeePalette;
  /** Quantos produtos seguem o % e quantos têm preço no cartão ajustado à
   *  mão. null enquanto a lista de produtos não chegou. */
  contagem?: { auto: number; manual: number } | null;
};

export function CardPriceSection({ display, saving, onToggle, palette, contagem }: Props) {
  const [pctInput, setPctInput] = useState<string>("");
  // % que ESTA sessão mudou — o aviso de "reimprima as etiquetas" aparece
  // depois de gravar, com o número novo.
  const [pctMudou, setPctMudou] = useState(false);
  const s = useMemo(() => buildStyles(palette), [palette]);
  const ligado = display.card_price_enabled === true;
  const pctSalvo = display.card_price_pct == null ? null : Number(display.card_price_pct);
  const pct = pctSalvo != null && isFinite(pctSalvo) ? pctSalvo : 0;

  function commitPct(raw: string) {
    if (!raw.trim()) return;
    const n = Math.max(0, Math.min(100, Number(raw.replace(",", ".").replace(/[^\d.]/g, "")) || 0));
    if (n !== pctSalvo) {
      onToggle("card_price_pct", n);
      setPctMudou(true);
    }
  }

  const exemplo = precoNoCartaoAutomatico(100, pct);

  return (
    <>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Cobro mais no cartão</Text>
          <Text style={s.rowDesc}>Cada produto ganha um preço no cartão, para débito e crédito. Dinheiro, PIX e crediário continuam no preço de sempre.</Text>
        </View>
        <Switch
          value={ligado}
          onValueChange={function(v) { onToggle("card_price_enabled", v); }}
          trackColor={{ false: palette.trackOff, true: palette.trackOn }}
          thumbColor={ligado ? palette.thumbOn : palette.thumbOff}
          disabled={saving}
          testID="pdv-settings-card-price"
        />
      </View>

      {ligado && (
        <View style={s.box} testID="pdv-settings-card-price-box">
          <View style={s.frase}>
            <Text style={s.fraseTxt}>No cartão, cobro</Text>
            <TextInput
              testID="pdv-settings-card-price-pct"
              accessibilityLabel="Quanto a mais no cartão, em %"
              value={pctInput || (pctSalvo == null ? "" : fmtPct(pctSalvo))}
              onChangeText={v => setPctInput(v.replace(/[^\d,.]/g, ""))}
              onBlur={() => { commitPct(pctInput); setPctInput(""); }}
              onSubmitEditing={() => { commitPct(pctInput); setPctInput(""); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.hint}
              style={s.pctInput}
              editable={!saving}
            />
            <Text style={s.fraseTxt}>% a mais</Text>
          </View>
          <Text style={s.hint}>
            {pctSalvo == null
              ? "Digite quanto a mais o cliente paga no cartão. Dá para ajustar produto a produto no cadastro."
              : "Um produto de R$ 100,00 sai a " + fmtReais(exemplo) + " no cartão — no débito e no crédito."}
          </Text>

          {contagem ? (
            <View style={s.contagem}>
              <Text style={s.contagemPill}>
                {contagem.auto + (contagem.auto === 1 ? " produto segue os " : " produtos seguem os ") + fmtPct(pct) + "%"}
              </Text>
              {contagem.manual > 0 ? (
                <Text style={s.contagemPill}>
                  {contagem.manual + " com preço no cartão ajustado à mão"}
                </Text>
              ) : null}
            </View>
          ) : null}

          {pctMudou && (
            <View style={s.aviso} testID="pdv-settings-card-price-aviso">
              <Text style={s.avisoTxt}>
                {(contagem ? "Os " + contagem.auto + " produtos automáticos passam" : "Os produtos automáticos passam") +
                  " a cobrar " + fmtPct(pct) + "% a mais no cartão." +
                  (contagem && contagem.manual > 0 ? " Os " + contagem.manual + " ajustados à mão não mudam." : "") +
                  " Reimprima as etiquetas (Estoque › Etiquetas) — as da prateleira mostram o preço antigo."}
              </Text>
            </View>
          )}

          <Text style={s.foot}>
            Taxa da maquininha é o que a maquininha fica de você; o preço no cartão é o que o cliente paga a mais. Pode cobrar diferente no cartão (Lei 13.455/2017), desde que o cliente veja os dois preços — a Aura mostra os dois no Caixa e imprime os dois na etiqueta e no orçamento.
          </Text>
        </View>
      )}
    </>
  );
}

function buildStyles(p: CardFeePalette) {
  return StyleSheet.create({
    row:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    rowLabel:  { fontSize: 13, color: p.label, fontWeight: "600" },
    rowDesc:   { fontSize: 11, color: p.desc, marginTop: 2, lineHeight: 15 },
    box:       { marginTop: 2, marginBottom: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: p.boxBorder, gap: 6 },
    frase:     { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingVertical: 4 },
    fraseTxt:  { fontSize: 13, color: p.label, fontWeight: "600" },
    pctInput:  {
      backgroundColor: p.inputBg, color: p.inputText,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
      borderWidth: 1, borderColor: p.inputBorder,
      fontSize: 14, fontWeight: "700", width: 72, textAlign: "center",
    },
    hint:      { fontSize: 11, color: p.desc, lineHeight: 15 },
    contagem:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    contagemPill: {
      fontSize: 11, color: p.label, borderWidth: 1, borderColor: p.inputBorder,
      borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: "hidden",
    },
    aviso:     {
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)",
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    },
    avisoTxt:  { fontSize: 11, color: p.label, lineHeight: 16 },
    foot:      { fontSize: 10, color: p.hint, lineHeight: 14 },
  });
}

export default CardPriceSection;
