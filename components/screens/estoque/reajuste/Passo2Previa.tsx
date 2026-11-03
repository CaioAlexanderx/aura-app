// ============================================================================
// AURA. — Reajuste de preço em lote · Passo 2: conferir antes de aplicar (p-52)
// A prévia é do servidor (dry_run: nada gravado). Por item: custo, preço
// atual e novo, variação, margem antes e depois. Abaixo do custo em
// vermelho; produto de grupo avisado (o preço vale para todas as lojas).
// No celular cada item vira um cartão (nada de tabela larga a 375 px).
// ============================================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { ItemReajuste, RespostaReajuste } from "@/services/priceAdjustmentsApi";
import {
  brl, margemTxt, variacaoTxt, plural, itensDoFiltro, margemMediaTxt, nomeDoItem, motivoDeFora, usaCusto,
  produtosQueMudam, produtosDeFora, produtosAbaixoDoCusto, type FiltroPrevia,
} from "./reajusteRegras";
import { Aviso } from "./Aviso";

var LOTE = 50;

type Props = { previa: RespostaReajuste; estreito: boolean };

export function Passo2Previa({ previa, estreito }: Props) {
  var [filtro, setFiltro] = useState<FiltroPrevia>("todos");
  var [limite, setLimite] = useState(LOTE);
  var r = previa.summary;
  var mudam = produtosQueMudam(previa.items).length;
  var fora = produtosDeFora(previa.items).length;
  var abaixo = produtosAbaixoDoCusto(previa.items).length;
  var semCustoFora = previa.items.filter(function (i) { return i.skip_reason === "no_cost"; });
  var semPrecoFora = previa.items.filter(function (i) { return i.skip_reason === "not_positive"; });
  var margem = margemMediaTxt(previa);
  var lista = itensDoFiltro(previa.items, filtro);
  var visiveis = lista.slice(0, limite);

  function trocarFiltro(f: FiltroPrevia) { setFiltro(f); setLimite(LOTE); }

  var chips: Array<[FiltroPrevia, string]> = [["todos", "Todos (" + previa.items.length + ")"]];
  if (fora > 0) chips.push(["fora", "Só os que ficam de fora (" + itensDoFiltro(previa.items, "fora").length + ")"]);
  if (abaixo > 0) chips.push(["abaixo", "Abaixo do custo (" + itensDoFiltro(previa.items, "abaixo").length + ")"]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.tiles}>
        <Tile testID="reajuste-n-mudam" numero={String(mudam)} texto={mudam === 1 ? "produto muda" : "produtos mudam"} />
        <Tile testID="reajuste-n-fora" numero={String(fora)} texto={fora === 1 ? "fica de fora" : "ficam de fora"} />
        <Tile testID="reajuste-margem-media" numero={margem || "—"} texto="margem média dos que têm custo" />
      </View>

      {mudam === 0 && (
        <Aviso tipo="aviso" testID="reajuste-nada-muda">
          Com essa escolha nenhum preço muda. Volte e experimente outro valor.
        </Aviso>
      )}
      {abaixo > 0 && (
        <Aviso tipo="erro" testID="reajuste-aviso-abaixo">
          <Text style={s.b}>{plural(abaixo, "produto ficaria", "produtos ficariam")} abaixo do custo</Text> (em vermelho na lista). Se não for o que você quer, volte e mude o valor.
        </Aviso>
      )}
      {semCustoFora.length > 0 && usaCusto(previa.mode) && (
        <Aviso tipo="aviso" testID="reajuste-aviso-sem-custo-previa">
          <Text style={s.b}>{plural(produtosDeFora(semCustoFora).length, "produto sem custo fica", "produtos sem custo ficam")} de fora.</Text> Sem o custo cadastrado não dá para calcular o markup ou a margem. Os outros mudam normalmente.
        </Aviso>
      )}
      {semPrecoFora.length > 0 && (
        <Aviso tipo="aviso" testID="reajuste-aviso-sem-preco">
          <Text style={s.b}>{plural(semPrecoFora.length, "item fica", "itens ficam")} de fora</Text> porque o preço ficaria zerado ou negativo.
        </Aviso>
      )}
      {r.group_shared > 0 && (
        <Aviso tipo="info" testID="reajuste-aviso-grupo-previa">
          <Text style={s.b}>{plural(r.group_shared, "produto é", "produtos são")} do grupo de lojas</Text> (marcados com “grupo”). O preço é um só para todas as lojas do grupo: o novo vale em todas elas.
        </Aviso>
      )}
      {r.not_found > 0 && (
        <Aviso tipo="aviso" testID="reajuste-aviso-nao-achados">
          {plural(r.not_found, "produto marcado não foi encontrado", "produtos marcados não foram encontrados")} (pode ter sido apagado ou desativado) e fica de fora.
        </Aviso>
      )}
      {r.card_price_changed > 0 && (
        <Text style={s.dica} testID="reajuste-dica-cartao">
          {plural(r.card_price_changed, "preço no cartão preenchido à mão muda", "preços no cartão preenchidos à mão mudam")} na mesma proporção. O preço no cartão automático acompanha sozinho.
        </Text>
      )}

      {chips.length > 1 && (
        <View style={s.chips}>
          {chips.map(function (c) {
            var on = filtro === c[0];
            return (
              <Pressable key={c[0]} onPress={function () { trocarFiltro(c[0]); }} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }} testID={"reajuste-filtro-" + c[0]}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c[1]}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={s.lista} testID="reajuste-lista">
        {!estreito && (
          <View style={[s.linha, s.cab]}>
            <Text style={[s.th, s.colNome]}>Produto</Text>
            <Text style={[s.th, s.colNum]}>Custo</Text>
            <Text style={[s.th, s.colNum]}>Atual</Text>
            <Text style={[s.th, s.colNum]}>Novo</Text>
            <Text style={[s.th, s.colNum]}>Variação</Text>
            <Text style={[s.th, s.colMargem]}>Margem</Text>
          </View>
        )}
        {visiveis.map(function (i, idx) {
          return estreito
            ? <CartaoItem key={i.product_id + (i.variant_id || "") + idx} item={i} />
            : <LinhaItem key={i.product_id + (i.variant_id || "") + idx} item={i} />;
        })}
        {lista.length === 0 && <Text style={[s.dica, { padding: 14 }]}>Nenhum item neste filtro.</Text>}
      </View>
      {lista.length > LOTE && (
        <View style={s.rodapeLista}>
          <Text style={s.dica} testID="reajuste-lista-conta">Mostrando {visiveis.length.toLocaleString("pt-BR")} de {lista.length.toLocaleString("pt-BR")}</Text>
          {visiveis.length < lista.length && (
            <Pressable onPress={function () { setLimite(limite + LOTE); }} style={s.mais} accessibilityRole="button" testID="reajuste-lista-mais">
              <Text style={s.maisTxt}>Mostrar mais {Math.min(LOTE, lista.length - visiveis.length)}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Tile({ numero, texto, testID }: { numero: string; texto: string; testID: string }) {
  return (
    <View style={s.tile} testID={testID}>
      <Text style={s.tileNum}>{numero}</Text>
      <Text style={s.tileTxt}>{texto}</Text>
    </View>
  );
}

function Etiquetas({ item }: { item: ItemReajuste }) {
  var fora = motivoDeFora(item);
  var abaixo = item.status === "change" && item.below_cost;
  if (!item.group_shared && !fora && !abaixo && item.status !== "unchanged") return null;
  return (
    <View style={s.tags}>
      {item.group_shared && <Text style={[s.tag, s.tagGrupo]}>grupo</Text>}
      {!!fora && <Text style={[s.tag, s.tagFora]}>{fora}</Text>}
      {abaixo && <Text style={[s.tag, s.tagAbaixo]} testID="reajuste-tag-abaixo">abaixo do custo</Text>}
      {item.status === "unchanged" && <Text style={[s.tag, s.tagIgual]}>já está nesse preço</Text>}
    </View>
  );
}

function corDaVariacao(item: ItemReajuste) {
  if (item.change_pct == null || item.change_pct === 0) return Colors.ink2;
  return item.change_pct > 0 ? Colors.green : Colors.red;
}

function margemDoItem(item: ItemReajuste): string {
  if (item.cost_price == null) return "sem custo";
  if (item.status === "skipped") return margemTxt(item.margin_before);
  return margemTxt(item.margin_before) + " → " + margemTxt(item.margin_after);
}

function LinhaItem({ item }: { item: ItemReajuste }) {
  var fora = item.status === "skipped";
  var abaixo = item.status === "change" && item.below_cost;
  return (
    <View style={[s.linha, fora && s.linhaFora]} testID={"reajuste-item-" + item.product_id + (item.variant_id ? "-" + item.variant_id : "")}>
      <View style={s.colNome}>
        <Text style={s.nome} numberOfLines={2}>{nomeDoItem(item)}</Text>
        <Etiquetas item={item} />
      </View>
      <Text style={[s.td, s.colNum, s.tdFraco]}>{item.cost_price == null ? "—" : brl(item.cost_price)}</Text>
      <Text style={[s.td, s.colNum]}>{brl(item.price_before)}</Text>
      <Text style={[s.td, s.colNum, s.tdForte, abaixo && { color: Colors.red }]} testID="reajuste-preco-novo">{fora ? "—" : brl(item.price_after)}</Text>
      <Text style={[s.td, s.colNum, { color: corDaVariacao(item) }]}>{fora ? "—" : variacaoTxt(item.change_pct)}</Text>
      <Text style={[s.td, s.colMargem, abaixo && { color: Colors.red }]}>{margemDoItem(item)}</Text>
    </View>
  );
}

function CartaoItem({ item }: { item: ItemReajuste }) {
  var fora = item.status === "skipped";
  var abaixo = item.status === "change" && item.below_cost;
  return (
    <View style={[s.cartao, fora && s.linhaFora]} testID={"reajuste-item-" + item.product_id + (item.variant_id ? "-" + item.variant_id : "")}>
      <Text style={s.nome}>{nomeDoItem(item)}</Text>
      <Etiquetas item={item} />
      <View style={s.cartaoPrecos}>
        <Text style={s.td}>{brl(item.price_before)}</Text>
        <Text style={s.tdFraco}>→</Text>
        <Text style={[s.td, s.tdForte, abaixo && { color: Colors.red }]} testID="reajuste-preco-novo">{fora ? "—" : brl(item.price_after)}</Text>
        {!fora && <Text style={[s.td, { color: corDaVariacao(item) }]}>{variacaoTxt(item.change_pct)}</Text>}
      </View>
      <Text style={[s.cartaoSub, abaixo && { color: Colors.red }]}>
        Custo {item.cost_price == null ? "não cadastrado" : brl(item.cost_price)} · Margem {margemDoItem(item)}
      </Text>
    </View>
  );
}

var s = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexGrow: 1, flexBasis: 140, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, paddingVertical: 10, paddingHorizontal: 12 },
  tileNum: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  tileTxt: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  b: { fontWeight: "800" },
  dica: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, justifyContent: "center" },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  chipTxtOn: { color: Colors.violet3 },
  lista: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, overflow: "hidden" },
  linha: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cab: { paddingVertical: 8 },
  th: { fontSize: 10.5, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  colNome: { flex: 1, minWidth: 0 },
  colNum: { width: 84, textAlign: "right" },
  colMargem: { width: 104, textAlign: "right" },
  nome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  td: { fontSize: 13, color: Colors.ink },
  tdFraco: { color: Colors.ink3 },
  tdForte: { fontWeight: "800" },
  linhaFora: { opacity: 0.6 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 },
  tag: { fontSize: 11, fontWeight: "700", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, overflow: "hidden" },
  tagGrupo: { backgroundColor: Colors.violetD, color: Colors.violet3 },
  tagFora: { backgroundColor: Colors.amberD, color: Colors.amber },
  tagAbaixo: { backgroundColor: Colors.redD, color: Colors.red },
  tagIgual: { backgroundColor: Colors.bg4, color: Colors.ink3 },
  cartao: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 3 },
  cartaoPrecos: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 2 },
  cartaoSub: { fontSize: 12, color: Colors.ink3 },
  rodapeLista: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  mais: { minHeight: 40, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, justifyContent: "center" },
  maisTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
});

export default Passo2Previa;
