// ============================================================
// CarneCard — Aura · Crediário
//
// Um cartão por carnê na ficha do cliente (10/10/2026). Tudo o que ele
// mostra vem pronto de utils/crediarioCarne.derivarCarne (testada sozinha).
//
// 23/11/2026 (F4 do redesenho da ficha, mockup aprovado — seção c):
//  - sem sanfona dentro de sanfona: o cartão não abre e fecha mais; as
//    parcelas a pagar aparecem direto, cada uma com a data (lápis sempre à
//    vista) e o "Receber" (linha montada pela TabParcelas);
//  - selo só quando há algo fora do normal ("Atrasado"); o "Em dia" de cada
//    carnê saiu (repetia o topo);
//  - "Falta R$ X de R$ Y" no alto; "Imprimir" à vista (é o que se faz depois
//    de toda venda); o raro no "⋯": Mudar as parcelas, Receber o carnê
//    inteiro, Excluir este carnê;
//  - parcelas pagas numa linha só ("2 pagas · 01/09 e 05/10 · ver"), que
//    abre com toque junto com os itens da compra.
//
// Sem hover-reveal (regra 7): o "⋯" abre com toque, a lista entra no fluxo.
// ============================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { CorDaFicha } from "./fichaStyles";
import { Button } from "@/components/Button";
import { Fonts } from "@/constants/fonts";
import { diaMes, type CarneDerivado, type ParcelaAbertaDoCarne } from "@/utils/crediarioCarne";
import { datasDasPagas } from "@/utils/crediarioTresFatos";
import { BotaoMais, ListaDoMenu, type ItemDoMenu } from "./MenuMais";
import { fmt } from "./fichaHelpers";

/** QA 23/11/2026: o que a linha precisa saber do carnê. */
export type InfoDaLinha<P> = {
  /** "3 de 4" pela POSIÇÃO no carnê (por data) — depois de juntar carnês o
   *  número gravado repetia ("1 de 2, 2 de 2, 1 de 3"). Só na tela. */
  numero: string;
  /** Parcelas abertas do carnê que vêm antes desta (o Receber abate por elas). */
  anteriores: P[];
};

export type CarneCardProps<P extends ParcelaAbertaDoCarne> = {
  carne: CarneDerivado<P>;
  /** Linha da parcela a pagar (montada pela TabParcelas). O índice diz se é a
   *  primeira do carnê (o "Receber" dela é o primário). */
  renderParcela: (p: P, indice: number, info: InfoDaLinha<P>) => React.ReactNode;
  onReceber: () => void;
  onImprimir: () => void;
  /** Ausente = sem a opção (carnê sem parcela para renegociar). */
  onRenegociar?: () => void;
  /** Rótulo da opção de renegociar ("Dividir em parcelas" no fiado). */
  renegociarLabel?: string;
  /** Ausente = sem a opção (grupo sem carnê, carnê cancelado ou juntado). */
  onExcluir?: () => void;
};

export function CarneCard<P extends ParcelaAbertaDoCarne>({
  carne, renderParcela,
  onReceber, onImprimir, onRenegociar, renegociarLabel = "Mudar as parcelas", onExcluir,
}: CarneCardProps<P>) {
  const c = carne;
  const [menu, setMenu] = useState(false);
  const [detalhe, setDetalhe] = useState(false);
  // F5: no celular o "Imprimir" entra no "⋯" (mockup, celular).
  const { width } = useWindowDimensions();
  const celular = width < 768;
  const corValor = c.atrasado ? Colors.red : c.falta > 0 ? Colors.ink : CorDaFicha.secundario;
  const temDetalhe = c.parcelasPagas.length > 0 || c.compras.length > 0;
  // Fiado no grupo sem carnê: os dois botões ficam à vista (mockup).
  const fiadoSemCarne = c.semCarne && c.semParcelas;

  const itensDoMenu: ItemDoMenu[] = [];
  if (celular && !c.vazio && !fiadoSemCarne) {
    itensDoMenu.push({ rotulo: "Imprimir este carnê", onPress: onImprimir, testID: `carne-${c.key}-imprimir` });
  }
  if (onRenegociar && !fiadoSemCarne) {
    itensDoMenu.push({ rotulo: renegociarLabel === "Mudar as parcelas" ? "Mudar as parcelas (renegociar)" : renegociarLabel, onPress: onRenegociar, testID: `carne-${c.key}-renegociar` });
  }
  if (!c.vazio && !c.semParcelas) {
    itensDoMenu.push({ rotulo: "Receber o carnê inteiro", onPress: onReceber, testID: `carne-${c.key}-receber-tudo` });
  }
  if (onExcluir) {
    itensDoMenu.push({ rotulo: "Excluir este carnê", onPress: onExcluir, destrutivo: true, testID: `carne-${c.key}-excluir` });
  }

  // QA 23/11/2026: numeração pela posição no carnê, por data (pagas
  // primeiro, depois as abertas). Backend antigo (sem as pagas na resposta):
  // o número gravado, que é o único que se conhece.
  const pagas = c.temCamposNovos
    ? c.parcelasPagas.slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)) || a.installment_number - b.installment_number)
    : c.parcelasPagas;
  const totalNoCarne = pagas.length + c.parcelasAbertas.length;
  const numeroDaPaga = (p: (typeof pagas)[number], j: number) =>
    c.temCamposNovos ? `${j + 1} de ${totalNoCarne}` : `${p.installment_number} de ${p.total_installments}`;
  const numeroDaAberta = (p: P, i: number) =>
    c.temCamposNovos ? `${pagas.length + i + 1} de ${totalNoCarne}`
      : `${(p as any).installment_number ?? i + 1} de ${(p as any).total_installments ?? c.parcelasAbertas.length}`;
  const resumoPagas = pagas.length > 0
    ? `${pagas.length} ${pagas.length === 1 ? "paga" : "pagas"}${datasDasPagas(pagas.map(p => diaMes(p.paid_at))) ? ` · ${datasDasPagas(pagas.map(p => diaMes(p.paid_at)))}` : ""}`
    : c.semCarne ? "Compras" : "Itens da compra";

  return (
    <View style={[s.card, c.atrasado && s.cardLate]} testID={`carne-${c.key}`}>
      <View style={s.head} testID={`carne-${c.key}-cabecalho`}>
        {/* Base de 160 px: em tela estreita o valor e os botões descem de
            linha em vez de espremer o nome. */}
        <View style={s.nomeBloco}>
          <View style={s.nomeLinha}>
            <Text style={s.nome}>{c.nome}</Text>
            {c.atrasado && (
              <View style={[s.chip, s.chipLate]}><Text style={[s.chipT, { color: Colors.red }]}>Atrasado</Text></View>
            )}
          </View>
          {!!c.itensResumo && <Text style={s.itens} numberOfLines={1}>{c.itensResumo}</Text>}
          {c.semCarne && c.semParcelas && <Text style={s.itens}>Compras sem parcelas definidas.</Text>}
        </View>
        <View style={s.falta}>
          <Text style={[s.valor, { color: corValor }]} testID={`carne-${c.key}-falta`}>{`Falta ${fmt(c.falta)}`}</Text>
          {c.valorOriginal != null && c.valorOriginal > c.falta + 0.009 && (
            <Text style={s.de}>{`de ${fmt(c.valorOriginal)}`}</Text>
          )}
        </View>
        <View style={s.acoesTopo}>
          {!celular && !c.vazio && !fiadoSemCarne && (
            <Pressable
              onPress={onImprimir}
              style={({ pressed }: any) => [s.act, pressed && { backgroundColor: Colors.violetD }]}
              accessibilityRole="button"
              accessibilityLabel="Imprimir"
              testID={`carne-${c.key}-imprimir`}
            >
              <Text style={s.actT}>Imprimir</Text>
            </Pressable>
          )}
          {itensDoMenu.length > 0 && (
            <BotaoMais aberto={menu} onPress={() => setMenu(v => !v)} rotulo={`Mais ações de ${c.nome}`} testID={`carne-${c.key}-mais`} />
          )}
        </View>
      </View>

      {menu && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
          <ListaDoMenu itens={itensDoMenu} onEscolher={() => setMenu(false)} testID={`carne-${c.key}-menu`} />
        </View>
      )}

      {c.progresso != null && (
        <View style={s.pg}>
          <View
            style={s.prog}
            testID={`carne-${c.key}-progresso`}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: c.total || 0, now: c.pagas || 0 }}
          >
            <View style={[s.progFill, { width: `${Math.round(c.progresso * 100)}%` }]} />
          </View>
          <Text style={s.pgTxt}>{`${c.pagas ?? 0} de ${c.total ?? 0} pagas`}</Text>
        </View>
      )}

      {temDetalhe && (
        <Pressable
          onPress={() => setDetalhe(v => !v)}
          style={s.linhaPagas}
          accessibilityRole="button"
          accessibilityState={{ expanded: detalhe }}
          testID={`carne-${c.key}-detalhe`}
        >
          {pagas.length > 0 && <Text style={s.marcaPaga}>✓</Text>}
          <Text style={s.linhaPagasTxt} numberOfLines={2}>
            {resumoPagas}
            <Text style={s.ver}>{detalhe ? "  ocultar" : "  ver"}</Text>
          </Text>
        </Pressable>
      )}

      {detalhe && (
        <View style={s.corpo} testID={`carne-${c.key}-corpo`}>
          {c.compras.length > 0 && (
            <View style={{ marginBottom: pagas.length > 0 ? 12 : 0 }}>
              <Text style={s.lbl}>{c.semCarne ? "Compras" : "Itens da compra"}</Text>
              {c.compras.map((l, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.rowK}>{l.rotulo}</Text>
                  <Text style={s.rowV}>{fmt(l.valor)}</Text>
                </View>
              ))}
              {c.devolvido > 0 && (
                <View style={s.row}>
                  <Text style={[s.rowK, { color: CorDaFicha.secundario }]}>Devolvido</Text>
                  <Text style={[s.rowV, { color: CorDaFicha.secundario }]}>−{fmt(c.devolvido)}</Text>
                </View>
              )}
              {c.comprasTotal != null && (
                <View style={[s.row, s.rowSum]}>
                  <Text style={[s.rowK, s.strong]}>{c.semCarne ? "Total" : "Total da compra"}</Text>
                  <Text style={[s.rowV, s.strong]}>{fmt(c.comprasTotal)}</Text>
                </View>
              )}
            </View>
          )}
          {pagas.map((p, j) => (
            <View key={p.id} style={s.row} testID={`carne-${c.key}-paga`}>
              <Text style={[s.rowK, { color: CorDaFicha.secundario }]}>
                <Text style={{ color: Colors.green, fontWeight: "800" }}>✓ </Text>
                {`Parcela ${numeroDaPaga(p, j)}`}
                {diaMes(p.paid_at) ? ` · paga em ${diaMes(p.paid_at)}` : " · paga"}
              </Text>
              <Text style={[s.rowV, { color: CorDaFicha.secundario }]}>{fmt(p.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {c.juntadoDe.length > 0 && (
        <Text style={[s.nota, { paddingHorizontal: 14 }]}>Carnês juntados: {c.juntadoDe.join(", ")}</Text>
      )}

      {c.parcelasAbertas.map((p, i) => renderParcela(p, i, { numero: numeroDaAberta(p, i), anteriores: c.parcelasAbertas.slice(0, i) }))}

      {c.semParcelas && (
        <View style={s.semParcelas}>
          <Text style={s.nota} testID={`carne-${c.key}-sem-parcelas`}>
            {c.semCarne
              ? "Você pode receber qualquer valor, ou dividir esse saldo em parcelas."
              : c.total && c.total > 0
              ? `Faltam ${fmt(c.falta)} sem parcela a vencer. Receba qualquer valor.`
              : "Sem parcelas — à vista no crediário. Receba qualquer valor."}
          </Text>
          <View style={s.botoes}>
            <Button title={`Receber ${fmt(c.falta)}`} variant="primary" size="sm" onPress={onReceber} />
            {fiadoSemCarne && !!onRenegociar && (
              <Pressable
                onPress={onRenegociar}
                style={({ pressed }: any) => [s.act, pressed && { backgroundColor: Colors.violetD }]}
                accessibilityRole="button"
                accessibilityLabel={renegociarLabel}
                testID={`carne-${c.key}-dividir`}
              >
                <Text style={s.actT}>{renegociarLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      {c.vazio && (
        <Text style={[s.nota, { paddingHorizontal: 14, paddingBottom: 12 }]}>Sem parcelas abertas neste carnê.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, marginBottom: 12, overflow: "hidden",
  },
  cardLate: { borderColor: Colors.red + "66" },
  head: { flexDirection: "row", alignItems: "flex-start", flexWrap: "wrap", gap: 10, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10 },
  nomeLinha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  nomeBloco: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  // Nome comprido quebra em linhas; o valor nunca espreme.
  nome: { fontFamily: Fonts.body, flexShrink: 1, minWidth: 0, fontSize: 14.5, fontWeight: "700", color: Colors.ink },
  itens: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.ink2, marginTop: 2 },
  falta: { alignItems: "flex-end", marginLeft: "auto" as any },
  valor: { fontFamily: Fonts.mono, fontSize: 14.5, fontWeight: "500", fontVariant: ["tabular-nums"] as any },
  de: { fontFamily: Fonts.mono, fontSize: 11.5, color: CorDaFicha.secundario, marginTop: 1, fontVariant: ["tabular-nums"] as any },
  acoesTopo: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 1 },
  chipT: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "700" },
  chipLate: { borderColor: Colors.red + "66", backgroundColor: Colors.redD },

  pg: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  prog: { flex: 1, height: 6, borderRadius: 99, backgroundColor: Colors.bg4, overflow: "hidden" },
  progFill: { height: "100%", backgroundColor: Colors.green, borderRadius: 99 },
  pgTxt: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario },

  linhaPagas: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44,
    paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  marcaPaga: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "800", color: Colors.green, width: 20, textAlign: "center" },
  linhaPagasTxt: { fontFamily: Fonts.body, flex: 1, fontSize: 12.5, color: CorDaFicha.secundario },
  ver: { fontFamily: Fonts.body, fontWeight: "700", color: Colors.violet3 },

  corpo: { paddingHorizontal: 14, paddingBottom: 10 },
  lbl: { fontFamily: Fonts.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase", color: CorDaFicha.secundario, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  rowK: { fontFamily: Fonts.body, flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink },
  rowV: { fontFamily: Fonts.mono, fontSize: 12.5, color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  rowSum: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8 },
  strong: { fontWeight: "700" },
  nota: { fontFamily: Fonts.body, fontSize: 12, color: CorDaFicha.secundario, lineHeight: 17, marginTop: 2, marginBottom: 6 },

  semParcelas: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  botoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  act: {
    minHeight: 44, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 12, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: "transparent",
  },
  actT: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "center" },
});

export default CarneCard;
