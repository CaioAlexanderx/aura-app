// ============================================================
// AURA. — "Neste computador / Neste celular" da impressão automática
// (p-159, 17/11/2026)
//
// Aparece junto do interruptor "Imprimir o cupom ao finalizar a venda"
// quando ele está ligado. Dois botões ("Imprimir aqui" / "Neste aparelho
// não") em vez de uma chave com negação, como no mockup aprovado (p-139).
// A escolha é deste aparelho e fica no navegador (utils/impressaoAutomatica);
// não passa pelo servidor.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  type EscolhaDoAparelho, ehCelular, lerEscolhaDoAparelho, gravarEscolhaDoAparelho,
  textoDaEscolha, TEXTOS_DA_IMPRESSAO,
} from "@/utils/impressaoAutomatica";

type Props = {
  companyId: string | null | undefined;
  /** Injetável para teste. */
  celular?: boolean;
};

export function ImpressaoNesteAparelho({ companyId, celular }: Props) {
  const [ehCel] = useState(() => (typeof celular === "boolean" ? celular : ehCelular()));
  const [escolha, setEscolha] = useState<EscolhaDoAparelho>(() => lerEscolhaDoAparelho(companyId, ehCel));

  function escolher(e: EscolhaDoAparelho) {
    setEscolha(e);
    gravarEscolhaDoAparelho(companyId, e);
  }

  const opcoes: Array<{ key: EscolhaDoAparelho; rotulo: string }> = [
    { key: "imprimir", rotulo: TEXTOS_DA_IMPRESSAO.imprimirAqui },
    { key: "nao", rotulo: TEXTOS_DA_IMPRESSAO.nesteAparelhoNao },
  ];

  return (
    <View testID="impressao-neste-aparelho" style={s.box}>
      <Text style={s.label}>{ehCel ? TEXTOS_DA_IMPRESSAO.tituloCelular : TEXTOS_DA_IMPRESSAO.tituloComputador}</Text>
      <View style={s.linha}>
        {opcoes.map((o) => {
          const on = o.key === escolha;
          return (
            <Pressable
              key={o.key}
              testID={"impressao-aparelho-" + o.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => { if (!on) escolher(o.key); }}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{o.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text testID="impressao-aparelho-texto" style={s.efeito}>{textoDaEscolha(escolha, ehCel)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box:       { marginTop: 4, marginBottom: 6 },
  label:     { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  linha:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip:      { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipOn:    { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipTxt:   { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  chipTxtOn: { color: Colors.violet3 },
  efeito:    { fontSize: 11, color: Colors.ink3, marginTop: 8, lineHeight: 15 },
});
