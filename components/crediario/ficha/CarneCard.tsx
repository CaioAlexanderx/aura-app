// ============================================================
// CarneCard — Aura · Crediário (10/10/2026)
//
// Um cartão por carnê na ficha do cliente (mockup docs/mockups/
// crediario-carnes-por-compra.html). Cada venda no crediário nasce como um
// carnê; o cartão FECHADO já responde o essencial — o que comprou, quanto
// falta, quantas pagou, quando vence a próxima. ABERTO mostra os itens, as
// parcelas pagas, as que faltam e as ações só daquele carnê.
//
// Presentational: tudo o que ele mostra vem pronto de
// utils/crediarioCarne.derivarCarne (testada sozinha). A linha da parcela a
// pagar continua sendo o <ParcelaRow> de sempre, montado pela TabParcelas e
// entregue por renderParcela — Receber, Pix e Alterar data não mudam.
//
// Sem hover-reveal (regra 7): tudo o que dá para fazer está visível no
// cartão aberto. Ações com alvo ≥44px e flexWrap — em 360px os três botões
// secundários quebram de linha em vez de cortar o texto.
//
// Backend antigo (sem os campos do #803): sem itens, sem barra, sem parcelas
// pagas — sobra nome, saldo, parcelas e ações, que é o que a ficha já tinha.
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { diaMes, type CarneDerivado, type ParcelaAbertaDoCarne } from "@/utils/crediarioCarne";
import { fmt } from "./fichaHelpers";

export type CarneCardProps<P extends ParcelaAbertaDoCarne> = {
  carne: CarneDerivado<P>;
  expanded: boolean;
  onToggle: () => void;
  /** Linha da parcela a pagar (o ParcelaRow da TabParcelas). */
  renderParcela: (p: P) => React.ReactNode;
  onReceber: () => void;
  onImprimir: () => void;
  /** Ausente = sem o botão (carnê sem parcela para renegociar). */
  onRenegociar?: () => void;
  /** Rótulo do botão de renegociar ("Parcelar saldo" no fiado). */
  renegociarLabel?: string;
  /** Ausente = cliente sem telefone. */
  onCobrar?: () => void;
};

export function CarneCard<P extends ParcelaAbertaDoCarne>({
  carne, expanded, onToggle, renderParcela,
  onReceber, onImprimir, onRenegociar, renegociarLabel = "Renegociar", onCobrar,
}: CarneCardProps<P>) {
  const c = carne;
  const corValor = c.atrasado ? Colors.red : c.falta > 0 ? Colors.ink : Colors.ink3;

  return (
    <View style={[s.card, c.atrasado && s.cardLate]} testID={`carne-${c.key}`}>
      <Pressable
        onPress={onToggle}
        style={s.head}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${c.nome}, falta ${fmt(c.falta)}. ${c.resumo}. Toque para ${expanded ? "recolher" : "abrir"}`}
        testID={`carne-${c.key}-cabecalho`}
      >
        <View style={s.l1}>
          <Text style={s.nome}>{c.nome}</Text>
          <Text style={[s.valor, { color: corValor }]} testID={`carne-${c.key}-falta`}>{fmt(c.falta)}</Text>
        </View>

        {!!c.itensResumo && (
          <Text style={s.itens} numberOfLines={1}>{c.itensResumo}</Text>
        )}

        {c.progresso != null && (
          <View
            style={s.prog}
            testID={`carne-${c.key}-progresso`}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: c.total || 0, now: c.pagas || 0 }}
          >
            <View style={[s.progFill, { width: `${Math.round(c.progresso * 100)}%` }]} />
          </View>
        )}

        <View style={s.l3}>
          <Text style={s.resumo}>{c.resumo}</Text>
          <View style={s.chips}>
            {c.atrasado && (
              <View style={[s.chip, s.chipLate]}><Text style={[s.chipT, { color: Colors.red }]}>Em atraso</Text></View>
            )}
            {c.semCarne && (
              <View style={[s.chip, s.chipOld]}><Text style={[s.chipT, { color: Colors.amber }]}>Sem carnê</Text></View>
            )}
            {!c.atrasado && !c.semCarne && !c.vazio && (
              <View style={[s.chip, s.chipOk]}><Text style={[s.chipT, { color: Colors.green }]}>Em dia</Text></View>
            )}
            <View style={expanded ? { transform: [{ rotate: "90deg" }] } : undefined}>
              <Icon name="chevron_right" size={15} color={expanded ? Colors.violet3 : Colors.ink3} />
            </View>
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={s.body} testID={`carne-${c.key}-corpo`}>
          {c.compras.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={s.lbl}>{c.semCarne ? "Compras" : "Itens da compra"}</Text>
              {c.compras.map((l, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.rowK}>{l.rotulo}</Text>
                  <Text style={s.rowV}>{fmt(l.valor)}</Text>
                </View>
              ))}
              {c.devolvido > 0 && (
                <View style={s.row}>
                  <Text style={[s.rowK, { color: Colors.ink3 }]}>Devolvido</Text>
                  <Text style={[s.rowV, { color: Colors.ink3 }]}>−{fmt(c.devolvido)}</Text>
                </View>
              )}
              {c.comprasTotal != null && (
                <View style={[s.row, s.rowSum]}>
                  <Text style={[s.rowK, s.strong]}>{c.semCarne ? "Total" : "Total da compra"}</Text>
                  <Text style={[s.rowV, s.strong]}>{fmt(c.comprasTotal)}</Text>
                </View>
              )}
              {c.juntadoDe.length > 0 && (
                <Text style={s.nota}>Carnês juntados: {c.juntadoDe.join(", ")}</Text>
              )}
            </View>
          )}

          {(c.parcelasPagas.length > 0 || c.parcelasAbertas.length > 0) && (
            <Text style={s.lbl}>Parcelas</Text>
          )}
          {c.parcelasPagas.map(p => (
            <View key={p.id} style={s.row} testID={`carne-${c.key}-paga`}>
              <Text style={[s.rowK, { color: Colors.ink3 }]}>
                <Text style={{ color: Colors.green, fontWeight: "800" }}>✓ </Text>
                {p.installment_number}/{p.total_installments}
                {diaMes(p.paid_at) ? ` · paga em ${diaMes(p.paid_at)}` : " · paga"}
              </Text>
              <Text style={[s.rowV, { color: Colors.ink3 }]}>{fmt(p.amount)}</Text>
            </View>
          ))}
          {c.parcelasAbertas.length > 0 && (
            <View style={{ marginTop: c.parcelasPagas.length > 0 ? 8 : 0 }}>
              {c.parcelasAbertas.map(p => renderParcela(p))}
            </View>
          )}

          {c.semParcelas && (
            <Text style={s.nota} testID={`carne-${c.key}-sem-parcelas`}>
              {c.total && c.total > 0
                ? `Faltam ${fmt(c.falta)} sem parcela a vencer. Receba qualquer valor pelo botão abaixo.`
                : "Sem parcelas — à vista no crediário. Receba qualquer valor pelo botão abaixo."}
            </Text>
          )}
          {c.vazio && (
            <Text style={s.nota}>Sem parcelas abertas neste carnê.</Text>
          )}

          {!c.vazio && (
            <View style={{ marginTop: 12 }}>
              <Button
                title={`Receber ${fmt(c.falta)}`}
                variant="primary"
                size="md"
                onPress={onReceber}
                style={s.receber}
              />
              <View style={s.acts}>
                <Acao rotulo="Imprimir" onPress={onImprimir} />
                {!!onRenegociar && <Acao rotulo={renegociarLabel} onPress={onRenegociar} />}
                {!!onCobrar && <Acao rotulo="Cobrar" onPress={onCobrar} />}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Botão secundário do carnê. Próprio (e não o <Button>) porque o Button
 *  corta o texto em 1 linha: aqui o rótulo nunca trunca e a linha quebra. */
function Acao({ rotulo, onPress }: { rotulo: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }: any) => [s.act, pressed && { backgroundColor: Colors.violetD }]}
    >
      <Text style={s.actT}>{rotulo}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, marginBottom: 11, overflow: "hidden",
  },
  cardLate: { borderColor: Colors.red + "66" },
  head: { paddingHorizontal: 14, paddingVertical: 13, minHeight: 48 },
  l1: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  // flex:1 + minWidth:0 — nome comprido quebra em linhas; o valor nunca espreme.
  nome: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700", color: Colors.ink },
  valor: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] as any },
  itens: { fontSize: 12.5, color: Colors.ink2, marginTop: 2 },
  prog: { height: 6, borderRadius: 99, backgroundColor: Colors.bg4, marginTop: 10, overflow: "hidden" },
  progFill: { height: "100%", backgroundColor: Colors.green, borderRadius: 99 },
  l3: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" },
  resumo: { flexGrow: 1, flexShrink: 1, minWidth: 0, fontSize: 12, color: Colors.ink3 },
  chips: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" as any },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 1 },
  chipT: { fontSize: 11, fontWeight: "700" },
  chipOk: { borderColor: Colors.green + "59", backgroundColor: Colors.greenD },
  chipLate: { borderColor: Colors.red + "66", backgroundColor: Colors.redD },
  chipOld: { borderColor: Colors.amber + "66", backgroundColor: Colors.amberD },

  body: { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  lbl: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase", color: Colors.ink3, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 5 },
  rowK: { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink },
  rowV: { fontSize: 13, color: Colors.ink, fontVariant: ["tabular-nums"] as any },
  rowSum: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 8 },
  strong: { fontWeight: "700" },
  nota: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginTop: 6 },

  receber: { minHeight: 44, alignSelf: "stretch" },
  acts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  act: {
    flexGrow: 1, flexBasis: 84, minHeight: 44,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 10, borderRadius: 11,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: "transparent",
  },
  actT: { fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "center" },
});

export default CarneCard;
