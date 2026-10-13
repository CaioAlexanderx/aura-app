// ============================================================
// Gestão Aura › Hoje — BlocoCard
//
// Card genérico de um bloco: título, subtítulo, número grande, pill de
// variação, gráfico e rodapé. O botão de expandir é controlado pela tela
// (um aberto por vez): aberto, o card ocupa a largura toda e mostra o
// detalhe — indicadores pequenos, gráficos e listas por loja, insight.
// ============================================================
import { forwardRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Grafico } from "./Graficos";
import { Paleta, TextoRico, coresDaEtiqueta, corDoTom } from "./paleta";
import { usePainelBloco } from "./usePainelHoje";
import type { DefinicaoBloco } from "./blocos";
import type { Bloco, BlocoDetalhe, Celula, Indicador, Insight, Lista, Variacao } from "./tipos";

type Props = {
  definicao: DefinicaoBloco;
  bloco: Bloco | null;            // null = ligado no catálogo, ainda sem cálculo
  aberto: boolean;
  largura: number | string;
  onAlternar: () => void;
  onAbrirLoja: (companyId: string) => void;
  onVerbo: (verbo: string, loja: string) => void;
};

export function Pill(props: { variacao: Variacao }) {
  var c = coresDaEtiqueta(props.variacao.tom);
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={[s.pillText, { color: c.fg }]} numberOfLines={1}>{props.variacao.texto}</Text>
    </View>
  );
}

export function Indicadores(props: { itens: Indicador[] }) {
  if (!props.itens.length) return null;
  return (
    <View style={s.mini}>
      {props.itens.map(function(ind, i) {
        return (
          <View key={i} style={s.miniItem}>
            <Text style={s.rotulo} numberOfLines={1}>{ind.rotulo}</Text>
            <Text style={[s.miniValor, ind.tom ? { color: corDoTom(ind.tom) } : null]}>{ind.valor}</Text>
            {ind.nota ? <Text style={s.miniNota} numberOfLines={1}>{ind.nota}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function CaixaInsight(props: { insight: Insight }) {
  var tom = props.insight.tom;
  var bg = tom === "risco" ? Colors.redD : tom === "alerta" ? Colors.amberD : Paleta.accentSuave;
  var fg = tom === "risco" ? Colors.red : tom === "alerta" ? Colors.amber : Paleta.accentTexto;
  return (
    <View style={[s.insight, { backgroundColor: bg }]}>
      <Icon name={tom === "neutro" ? "info" : "alert"} size={15} color={fg} />
      <TextoRico texto={props.insight.texto} style={s.insightText} corDestaque={fg} />
    </View>
  );
}

function textoDa(c: Celula): string {
  if (typeof c === "number") return c.toLocaleString("pt-BR");
  return typeof c === "object" ? c.texto : c;
}

// Coluna de números alinha à direita.
function colunaNumerica(lista: Lista, col: number): boolean {
  if (!lista.linhas.length) return false;
  return lista.linhas.every(function(l) {
    var c = l[col];
    if (typeof c === "number") return true;
    return typeof c === "string" && /^[\d.,—-]+$/.test(c);
  });
}

function Tabela(props: { lista: Lista; onAbrirLoja: (cid: string) => void }) {
  var lista = props.lista;
  var n = lista.colunas.length;
  var numericas = lista.colunas.map(function(_, i) { return i > 0 && colunaNumerica(lista, i); });
  return (
    <View>
      <ScrollView horizontal style={s.tabelaWrap} contentContainerStyle={{ flexGrow: 1 }} showsHorizontalScrollIndicator={false}>
        <View style={{ flex: 1, minWidth: n * 104 }}>
          <View style={[s.tr, s.trHead]}>
            {lista.colunas.map(function(col, i) {
              return <Text key={i} style={[s.th, i === 0 && s.tdPrimeira, numericas[i] && s.direita]} numberOfLines={1}>{col}</Text>;
            })}
          </View>
          {lista.linhas.map(function(linha, li) {
            return (
              <View key={li} style={[s.tr, li === lista.linhas.length - 1 && { borderBottomWidth: 0 }]}>
                {lista.colunas.map(function(_, ci) {
                  var c = linha[ci];
                  var base = [s.tdBox, ci === 0 && s.tdPrimeira, numericas[ci] && { alignItems: "flex-end" as const }];
                  if (c == null) return <View key={ci} style={base} />;
                  if (typeof c === "object" && c.company_id) {
                    var cid = c.company_id;
                    return (
                      <Pressable key={ci} style={base} testID={"loja-" + cid} onPress={function() { props.onAbrirLoja(cid); }}>
                        <Text style={[s.td, s.loja]} numberOfLines={1}>{c.texto}</Text>
                      </Pressable>
                    );
                  }
                  if (typeof c === "object" && c.etiqueta) {
                    return <View key={ci} style={base}><Pill variacao={{ texto: c.texto, tom: c.tom || "neutro" }} /></View>;
                  }
                  return (
                    <View key={ci} style={base}>
                      <Text style={[s.td, ci === 0 && s.tdNome, typeof c === "object" && c.tom ? { color: corDoTom(c.tom) } : null]} numberOfLines={1}>{textoDa(c)}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {lista.mais ? <Text style={s.mais}>{lista.mais}</Text> : null}
    </View>
  );
}

// Uma coluna de cartões por loja (degraus do trial).
function ColunaDeCartoes(props: { lista: Lista; onAbrirLoja: (cid: string) => void; onVerbo: (verbo: string, loja: string) => void }) {
  var lista = props.lista;
  return (
    <View style={s.degrau}>
      <View style={s.degrauHead}>
        <Text style={s.rotulo} numberOfLines={1}>{lista.titulo}</Text>
        {lista.total != null ? <Text style={s.degrauTotal}>{lista.total}</Text> : null}
      </View>
      {lista.linhas.map(function(linha, i) {
        var loja = linha[0];
        var detalhe = linha[1];
        var verbos = linha.slice(2).filter(function(c) { return typeof c === "object" && c.verbo; }) as Extract<Celula, object>[];
        var atrasado = typeof detalhe === "object" && detalhe.tom === "desce";
        var cid = typeof loja === "object" ? loja.company_id : undefined;
        return (
          <View key={i} style={[s.cartao, atrasado && { borderColor: Colors.red }]}>
            <Text style={s.cartaoNome} numberOfLines={1} onPress={cid ? function() { props.onAbrirLoja(cid as string); } : undefined}>{textoDa(loja)}</Text>
            {detalhe != null ? <Text style={s.cartaoDetalhe}>{textoDa(detalhe)}</Text> : null}
            {verbos.length > 0 && (
              <View style={s.cartaoAcoes}>
                {verbos.map(function(v, vi) {
                  return (
                    <Pressable key={vi} style={[s.btnSm, v.primario && s.btnSmPrimario]} onPress={function() { props.onVerbo(v.texto, textoDa(loja)); }}>
                      <Text style={[s.btnSmText, v.primario && { color: "#fff" }]}>{v.texto}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
      {lista.mais ? <Text style={s.mais}>{lista.mais}</Text> : null}
    </View>
  );
}

export function DetalheDoBloco(props: { detalhe: BlocoDetalhe; onAbrirLoja: (cid: string) => void; onVerbo: (verbo: string, loja: string) => void }) {
  var d = props.detalhe;
  var tabelas = d.listas.filter(function(l) { return l.formato !== "cartoes"; });
  var cartoes = d.listas.filter(function(l) { return l.formato === "cartoes"; });
  return (
    <View style={{ gap: 16 }}>
      {d.insight ? <CaixaInsight insight={d.insight} /> : null}
      <Indicadores itens={d.indicadores} />
      {cartoes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
          {cartoes.map(function(l, i) { return <ColunaDeCartoes key={i} lista={l} onAbrirLoja={props.onAbrirLoja} onVerbo={props.onVerbo} />; })}
        </ScrollView>
      )}
      {(d.series.length > 0 || tabelas.length > 0) && (
        <View style={s.cols}>
          {d.series.map(function(sr, i) {
            return (
              <View key={"s" + i} style={s.col}>
                <Text style={[s.rotulo, { marginBottom: 8 }]}>{sr.titulo}</Text>
                <Grafico tipo={sr.tipo} pontos={sr.pontos} opcoes={{ max: sr.max }} />
              </View>
            );
          })}
          {tabelas.map(function(l, i) {
            return (
              <View key={"t" + i} style={s.col}>
                <Text style={[s.rotulo, { marginBottom: 8 }]}>{l.titulo}</Text>
                <Tabela lista={l} onAbrirLoja={props.onAbrirLoja} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// Só monta com o card aberto: é quem busca GET /admin/painel/blocos/:id.
function DetalheCarregado(props: Pick<Props, "definicao" | "onAbrirLoja" | "onVerbo">) {
  var { detalhe, carregando } = usePainelBloco(props.definicao.id);
  if (carregando) return <ActivityIndicator color={Colors.violet3} />;
  if (!detalhe) return <Text style={s.vazio}>Sem detalhe para este bloco ainda.</Text>;
  return <DetalheDoBloco detalhe={detalhe} onAbrirLoja={props.onAbrirLoja} onVerbo={props.onVerbo} />;
}

export var BlocoCard = forwardRef<View, Props>(function BlocoCard(props, ref) {
  var def = props.definicao;
  var b = props.bloco;
  var temHero = !!b && (b.valor != null || !!b.legenda || !!b.variacao);
  return (
    <View ref={ref} testID={"bloco-" + def.id} style={[s.card, { width: props.largura as any }, props.aberto && s.cardAberto]}>
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo}>{def.titulo}</Text>
          <Text style={s.subtitulo}>{def.subtitulo}</Text>
        </View>
        {b ? (
          <Pressable
            testID={"bloco-expandir-" + def.id}
            onPress={props.onAlternar}
            accessibilityRole="button"
            accessibilityLabel={(props.aberto ? "Recolher " : "Expandir ") + def.titulo}
            style={[s.btnIcone, props.aberto && { backgroundColor: Paleta.accentSuave }]}
            hitSlop={8}
          >
            <Icon name={props.aberto ? "chevron_up" : "chevron_down"} size={16} color={props.aberto ? Paleta.accentTexto : Colors.ink3} />
          </Pressable>
        ) : null}
      </View>

      {!b ? (
        <View style={s.semDados} testID={"bloco-sem-dados-" + def.id}>
          <Text style={s.vazio}>Ainda sem cálculo. O bloco aparece aqui quando o número se calcular sozinho.</Text>
        </View>
      ) : (
        <>
          {temHero && (
            <View style={s.hero}>
              {b.valor != null ? <Text style={s.heroValor}>{String(b.valor)}</Text> : null}
              {b.legenda ? <Text style={s.heroLegenda}>{b.legenda}</Text> : null}
              {b.variacao ? <View style={{ marginBottom: 2 }}><Pill variacao={b.variacao} /></View> : null}
            </View>
          )}
          <View style={[s.grafico, props.aberto && { maxWidth: 680 }]}>
            <Grafico tipo={def.grafico} pontos={b.serie} opcoes={def.opcoes} />
          </View>
          {def.legenda && (
            <View style={s.legenda}>
              <View style={s.legendaItem}><View style={[s.amostra, { backgroundColor: Paleta.accent }]} /><Text style={s.legendaText}>{def.legenda[0]}</Text></View>
              <View style={s.legendaItem}><View style={[s.amostra, { backgroundColor: Paleta.teal }]} /><Text style={s.legendaText}>{def.legenda[1]}</Text></View>
            </View>
          )}
          <View style={s.rodape}>
            <TextoRico texto={b.resumo} style={s.rodapeText} corDestaque={Colors.ink2} />
            {b.fonte ? <Text style={s.rodapeText}>Fonte: {b.fonte}</Text> : null}
          </View>
          {props.aberto && (
            <View style={s.detalhe} testID={"bloco-detalhe-" + def.id}>
              <DetalheCarregado definicao={def} onAbrirLoja={props.onAbrirLoja} onVerbo={props.onVerbo} />
            </View>
          )}
        </>
      )}
    </View>
  );
});

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 10, minWidth: 0 },
  cardAberto: { borderColor: Colors.border2 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  titulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  subtitulo: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  btnIcone: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: "row", alignItems: "flex-end", columnGap: 10, rowGap: 4, flexWrap: "wrap" },
  heroValor: { fontSize: 32, lineHeight: 34, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  heroLegenda: { fontSize: 13, lineHeight: 22, color: Colors.ink3, flexShrink: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: "flex-start", maxWidth: "100%" },
  pillText: { fontSize: 12, fontWeight: "600" },
  grafico: { minHeight: 72, justifyContent: "flex-end" },
  legenda: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  legendaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendaText: { fontSize: 12, color: Colors.ink3 },
  amostra: { width: 10, height: 10, borderRadius: 3 },
  rodape: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: "auto" },
  rodapeText: { fontSize: 12, color: Colors.ink3, flexShrink: 1 },
  detalhe: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14, marginTop: 4 },
  semDados: { flex: 1, minHeight: 90, justifyContent: "center" },
  vazio: { fontSize: 12, color: Colors.ink3 },
  rotulo: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  mini: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniItem: { flexGrow: 1, flexBasis: 120, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minWidth: 0 },
  miniValor: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: Colors.ink },
  miniNota: { fontSize: 11, color: Colors.ink3 },
  insight: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  insightText: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.ink2 },
  cols: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  col: { flexGrow: 1, flexBasis: 280, minWidth: 0, maxWidth: "100%" },
  tabelaWrap: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12 },
  tr: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Colors.border },
  trHead: { backgroundColor: Colors.bg4 },
  th: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3 },
  tdBox: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, minWidth: 0, alignItems: "flex-start" },
  tdPrimeira: { flex: 1.6 },
  td: { fontSize: 13, color: Colors.ink2 },
  tdNome: { fontWeight: "600", color: Colors.ink },
  loja: { fontWeight: "600", color: Paleta.accentTexto },
  direita: { textAlign: "right" },
  mais: { fontSize: 12, color: Colors.ink3, textAlign: "center", padding: 6 },
  degrau: { width: 196, backgroundColor: Colors.bg4, borderRadius: 12, padding: 10 },
  degrauHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6 },
  degrauTotal: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  cartao: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  cartaoNome: { fontSize: 13, fontWeight: "700", color: Paleta.accentTexto },
  cartaoDetalhe: { fontSize: 12, color: Colors.ink3 },
  cartaoAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  btnSm: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.bg3 },
  btnSmPrimario: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnSmText: { fontSize: 12, fontWeight: "500", color: Colors.ink },
});
