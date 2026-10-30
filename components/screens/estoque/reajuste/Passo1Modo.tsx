// ============================================================================
// AURA. — Reajuste de preço em lote · Passo 1: o que mudar (p-52)
// Modo (percentual, valor fixo, markup, margem), aumentar/diminuir, valor e
// terminação. Sem hover: tudo visível e com alvo de 44 px (touch).
// ============================================================================
import React from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { DirecaoReajuste, ModoReajuste, Terminacao } from "@/services/priceAdjustmentsApi";
import {
  MODOS, TERMINACOES, MAX_PRODUTOS_REAJUSTE, usaDirecao, usaCusto, rotuloDoValor, exemploTerminacao, plural,
} from "./reajusteRegras";
import { Aviso } from "./Aviso";

type Props = {
  modo: ModoReajuste;
  direcao: DirecaoReajuste;
  valorTxt: string;
  terminacao: Terminacao;
  erroValor: string | null;
  mostrarErro: boolean;
  semCusto: number;
  produtosDeGrupo: number | null;
  totalSelecionados: number;
  erro: string | null;
  estreito: boolean;
  onModo: (m: ModoReajuste) => void;
  onDirecao: (d: DirecaoReajuste) => void;
  onValor: (v: string) => void;
  onTerminacao: (t: Terminacao) => void;
  onEnviar: () => void;
};

export function Passo1Modo(p: Props) {
  var exemplo = exemploTerminacao(p.terminacao);
  var demais = p.totalSelecionados > MAX_PRODUTOS_REAJUSTE;
  return (
    <View style={{ gap: 14 }}>
      <View style={[s.modos, p.estreito && s.modosCel]} accessibilityRole="radiogroup" accessibilityLabel="Como ajustar o preço">
        {MODOS.map(function (m) {
          var on = p.modo === m.modo;
          return (
            <Pressable
              key={m.modo}
              onPress={function () { p.onModo(m.modo); }}
              style={[s.modo, p.estreito && s.modoCel, on && s.modoOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              testID={"reajuste-modo-" + m.modo}
            >
              <Text style={[s.modoTit, on && { color: Colors.violet3 }]}>{m.titulo}</Text>
              <Text style={s.modoTxt}>{m.texto}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.campos}>
        {usaDirecao(p.modo) && (
          <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel="Aumentar ou diminuir">
            {([["up", "Aumentar"], ["down", "Diminuir"]] as Array<[DirecaoReajuste, string]>).map(function (d, idx) {
              var on = p.direcao === d[0];
              return (
                <Pressable
                  key={d[0]}
                  onPress={function () { p.onDirecao(d[0]); }}
                  style={[s.segBtn, idx > 0 && s.segBtnSep, on && s.segBtnOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  testID={"reajuste-direcao-" + d[0]}
                >
                  <Text style={[s.segTxt, on && s.segTxtOn]}>{d[1]}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={s.campo}>
          <Text style={s.rot} nativeID="reajuste-rot-valor">{rotuloDoValor(p.modo)}</Text>
          <TextInput
            value={p.valorTxt}
            onChangeText={p.onValor}
            onSubmitEditing={p.onEnviar}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[s.inp, p.mostrarErro && !!p.erroValor && s.inpErro]}
            accessibilityLabel={rotuloDoValor(p.modo)}
            testID="reajuste-valor"
          />
        </View>
      </View>
      {p.mostrarErro && !!p.erroValor && <Text style={s.erroCampo} testID="reajuste-erro-valor" accessibilityLiveRegion="polite">{p.erroValor}</Text>}

      <View style={{ gap: 6 }}>
        <Text style={s.rot}>Terminar em</Text>
        <View style={[s.seg, { alignSelf: "flex-start" }]} accessibilityRole="radiogroup" accessibilityLabel="Terminação do preço">
          {TERMINACOES.map(function (t, idx) {
            var on = p.terminacao === t.valor;
            return (
              <Pressable
                key={t.valor}
                onPress={function () { p.onTerminacao(t.valor); }}
                style={[s.segBtn, idx > 0 && s.segBtnSep, on && s.segBtnOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t.valor === "none" ? "Sem ajuste" : "Terminar em " + t.rotulo}
                testID={"reajuste-terminacao-" + t.valor}
              >
                <Text style={[s.segTxt, on && s.segTxtOn]}>{t.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>
        {exemplo && <Text style={s.dica} testID="reajuste-exemplo-terminacao">{exemplo}</Text>}
      </View>

      {usaCusto(p.modo) && p.semCusto > 0 && (
        <Aviso tipo="aviso" testID="reajuste-aviso-sem-custo">
          <Text style={s.b}>{plural(p.semCusto, "produto sem custo fica", "produtos sem custo ficam")} de fora</Text> neste modo, porque sem o custo não dá para fazer a conta. Os outros mudam normalmente.
        </Aviso>
      )}
      {!!p.produtosDeGrupo && p.produtosDeGrupo > 0 && (
        <Aviso tipo="info" testID="reajuste-aviso-grupo">
          <Text style={s.b}>{plural(p.produtosDeGrupo, "produto vale", "produtos valem")} para todas as lojas do grupo.</Text> O preço novo vale em todas elas.
        </Aviso>
      )}
      {demais && (
        <Aviso tipo="erro" testID="reajuste-aviso-demais">
          Dá para ajustar até {MAX_PRODUTOS_REAJUSTE.toLocaleString("pt-BR")} produtos de uma vez. Você marcou {p.totalSelecionados.toLocaleString("pt-BR")}: desmarque alguns ou faça em duas partes.
        </Aviso>
      )}
      {!!p.erro && (
        <Aviso tipo="erro" testID="reajuste-erro">
          {p.erro}
        </Aviso>
      )}
      <View style={s.nota}>
        <Icon name="info" size={14} color={Colors.ink3} />
        <Text style={s.notaTxt}>Só muda o preço de venda (e o preço no cartão, se você preencheu à mão). Estoque, custo e código continuam iguais.</Text>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  modos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modosCel: { flexDirection: "column" },
  modo: { flexBasis: "48%", flexGrow: 1, minHeight: 60, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "center" },
  modoCel: { flexBasis: "auto" },
  modoOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  modoTit: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  modoTxt: { fontSize: 12.5, color: Colors.ink3, marginTop: 2 },
  campos: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" },
  campo: { gap: 6 },
  rot: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  inp: { width: 140, minHeight: 48, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, paddingHorizontal: 12, fontSize: 18, fontWeight: "700", color: Colors.ink, outlineStyle: "none" } as any,
  inpErro: { borderColor: Colors.red },
  erroCampo: { fontSize: 13, fontWeight: "600", color: Colors.red, marginTop: -6 },
  seg: { flexDirection: "row", borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, overflow: "hidden" },
  segBtn: { minHeight: 46, minWidth: 54, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  segBtnSep: { borderLeftWidth: 1, borderLeftColor: Colors.border2 },
  segBtnOn: { backgroundColor: Colors.violet },
  segTxt: { fontSize: 14, fontWeight: "600", color: Colors.ink2 },
  segTxtOn: { color: "#fff", fontWeight: "700" },
  dica: { fontSize: 12.5, color: Colors.ink3 },
  b: { fontWeight: "800" },
  nota: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  notaTxt: { flex: 1, fontSize: 12.5, color: Colors.ink3, lineHeight: 18 },
});

export default Passo1Modo;
