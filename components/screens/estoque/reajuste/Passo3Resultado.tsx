// ============================================================================
// AURA. — Reajuste de preço em lote · Passo 3: pronto (p-53, 30/10/2026)
// Quantos mudaram e quantos ficaram de fora, "Reimprimir etiquetas" dos
// itens reajustados (abre a aba Etiquetas com eles marcados) e "Desfazer"
// em um toque. O desfazer só volta o preço de quem ninguém mexeu depois do
// reajuste; os outros ficam como estão, e a tela diz quais e por quê.
// ============================================================================
import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { RespostaDesfazer, RespostaReajuste } from "@/services/priceAdjustmentsApi";
import {
  brl, nomeDoItem, plural, produtosAbaixoDoCusto, produtosParaEtiqueta, resumoDoDesfazer, resumoDoResultado, explicaMudaramDepois,
} from "./reajusteRegras";
import { Aviso } from "./Aviso";

var MAX_LISTA_DEPOIS = 20;

type Props = {
  resultado: RespostaReajuste;
  desfeito: RespostaDesfazer | null;
  desfazendo: boolean;
  erroDesfazer: string | null;
  onDesfazer: () => void;
  onReimprimir: (productIds: string[]) => void;
};

export function Passo3Resultado({ resultado, desfeito, desfazendo, erroDesfazer, onDesfazer, onReimprimir }: Props) {
  var paraEtiqueta = produtosParaEtiqueta(resultado, desfeito);
  var abaixo = produtosAbaixoDoCusto(resultado.items).length;
  var explica = desfeito ? explicaMudaramDepois(desfeito) : null;

  return (
    <View style={{ gap: 14 }}>
      <View style={s.fim}>
        <View style={[s.ok, desfeito && { backgroundColor: Colors.violetD }]}>
          <Icon name={desfeito ? "rotate_ccw" : "check"} size={24} color={desfeito ? Colors.violet3 : Colors.green} />
        </View>
        <Text style={s.titulo} testID="reajuste-resultado-titulo">{desfeito ? "Reajuste desfeito" : "Preços atualizados"}</Text>
        <Text style={s.texto} testID="reajuste-resultado-resumo">{desfeito ? resumoDoDesfazer(desfeito) : resumoDoResultado(resultado)}</Text>
        {!desfeito && resultado.summary.group_shared > 0 && (
          <Text style={s.texto} testID="reajuste-resultado-grupo">Nos produtos do grupo, as outras lojas já veem o preço novo.</Text>
        )}
        {!desfeito && abaixo > 0 && (
          <Text style={[s.texto, { color: Colors.red }]} testID="reajuste-resultado-abaixo">
            {plural(abaixo, "produto ficou", "produtos ficaram")} abaixo do custo, como você confirmou.
          </Text>
        )}
      </View>

      {!!explica && desfeito && (
        <Aviso tipo="aviso" testID="reajuste-mudaram-depois">
          {explica}
          {"\n"}
          {desfeito.changed_after.slice(0, MAX_LISTA_DEPOIS).map(function (c) {
            var linha = c.reason === "not_found"
              ? "• " + nomeDoItem(c) + ": não está mais no Estoque"
              : "• " + nomeDoItem(c) + ": agora " + brl(c.price_now);
            return linha + "\n";
          }).join("")}
          {desfeito.changed_after.length > MAX_LISTA_DEPOIS ? "e mais " + (desfeito.changed_after.length - MAX_LISTA_DEPOIS) + "." : ""}
        </Aviso>
      )}

      {!!erroDesfazer && <Aviso tipo="erro" testID="reajuste-erro-desfazer">{erroDesfazer}</Aviso>}

      <View style={s.acoes}>
        {paraEtiqueta.length > 0 && (
          <Pressable style={s.btnPri} onPress={function () { onReimprimir(paraEtiqueta); }} testID="reajuste-reimprimir" accessibilityRole="button">
            <Icon name="tag" size={15} color="#fff" />
            <Text style={s.btnPriTxt}>Reimprimir etiquetas ({paraEtiqueta.length})</Text>
          </Pressable>
        )}
        {!desfeito && (
          <Pressable
            style={[s.btnSec, desfazendo && { opacity: 0.6 }]}
            onPress={desfazendo ? undefined : onDesfazer}
            disabled={desfazendo}
            testID="reajuste-desfazer"
            accessibilityRole="button"
            accessibilityState={{ disabled: desfazendo, busy: desfazendo }}
          >
            {desfazendo ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="rotate_ccw" size={15} color={Colors.ink} />}
            <Text style={s.btnSecTxt}>Desfazer este reajuste</Text>
          </Pressable>
        )}
      </View>
      {!desfeito && (
        <Text style={s.dica} testID="reajuste-dica-desfazer">
          Mudou de ideia? Toque em Desfazer antes de fechar esta janela. Só volta o preço dos produtos que ninguém alterou depois do reajuste.
        </Text>
      )}
      {paraEtiqueta.length > 0 && (
        <Text style={s.dica}>As etiquetas abrem com esses produtos já marcados. É só conferir e imprimir.</Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  fim: { alignItems: "center", gap: 6, paddingTop: 6 },
  ok: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  titulo: { fontSize: 19, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  texto: { fontSize: 14, color: Colors.ink2, textAlign: "center", lineHeight: 20 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  btnPri: { backgroundColor: Colors.violet, minHeight: 46, paddingHorizontal: 18, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSec: { minHeight: 46, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnSecTxt: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  dica: { fontSize: 12.5, color: Colors.ink3, textAlign: "center", lineHeight: 18 },
});

export default Passo3Resultado;
