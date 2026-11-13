// ============================================================
// AURA. — Financeiro › Relatórios › Produtos: a tabela (p-115a)
//
// Computador: coluna Produto fixa à esquerda e as colunas escolhidas rolando
// na horizontal. Clicar no cabeçalho ordena (e o chip vira Personalizado).
// Celular (compacto): cada produto vira um cartão com o nome e 3 colunas, a
// da ordem primeiro. Nada depende de hover.
// Rodapé: "Mostrando X de Y" e "Mostrar mais" (próxima página da API).
// ============================================================
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  COLUNAS, celula, colunasDoCartao,
  type ColunaId, type LinhaRelatorio, type OrdemApi, type Direcao, type Tom, type Agrupar,
} from "@/utils/relatorioProdutos";

var LARGURA_PRODUTO = 230;
var ALTURA_LINHA = 52;
var ALTURA_CABECALHO = 38;

function larguraDa(c: ColunaId): number {
  switch (c) {
    case "loja": case "categoria": case "faturamento": case "lucro": case "valor_parado": return 132;
    case "valor_estoque_venda": return 150;
    case "ultima_venda": case "dias_ate_acabar": case "dias_sem_vender": case "media_diaria": return 124;
    default: return 108;
  }
}

function corDoTom(t: Tom): string {
  return t === "vermelho" ? Colors.red : t === "ambar" ? Colors.amber : t === "apagado" ? Colors.ink3 : Colors.ink;
}

function detalheDoNome(l: LinhaRelatorio, mostrarCodigo: boolean, agrupar: Agrupar): string {
  var partes: string[] = [];
  if (mostrarCodigo && (l.sku || l.codigo_barras)) partes.push(String(l.sku || l.codigo_barras));
  if (agrupar === "produto" && (l.variantes || 0) > 1) partes.push(l.variantes + " variações");
  if (!l.ativo) partes.push("inativo");
  return partes.join(" · ");
}

type Props = {
  linhas: LinhaRelatorio[];
  colunas: ColunaId[];
  ordem: OrdemApi;
  direcao: Direcao;
  agrupar: Agrupar;
  hoje: string;
  total: number;
  compacto: boolean;
  onOrdenar: (o: OrdemApi) => void;
  temMais: boolean;
  carregandoMais: boolean;
  onMostrarMais: () => void;
};

export function ResultadoDoRelatorio(p: Props) {
  var mostrarCodigo = p.colunas.indexOf("codigo") < 0;
  return (
    <View style={s.caixa} testID="relatorio-resultado">
      {p.compacto ? <Cartoes {...p} mostrarCodigo={mostrarCodigo} /> : <Tabela {...p} mostrarCodigo={mostrarCodigo} />}
      <View style={s.rodape}>
        <Text style={s.rodapeTexto} testID="relatorio-mostrando">
          Mostrando {p.linhas.length.toLocaleString("pt-BR")} de {p.total.toLocaleString("pt-BR")}
        </Text>
        {p.temMais && (
          <Pressable
            testID="relatorio-mostrar-mais"
            onPress={p.onMostrarMais}
            disabled={p.carregandoMais}
            accessibilityRole="button"
            style={[s.btnMais, p.carregandoMais && { opacity: 0.6 }]}
          >
            <Text style={s.btnMaisTexto}>{p.carregandoMais ? "Carregando…" : "Mostrar mais"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Cabecalho({ rotulo, ordemDaColuna, p, largura, alinhar }: {
  rotulo: string; ordemDaColuna: OrdemApi | null; p: Props; largura?: number; alinhar: "left" | "right";
}) {
  var ativo = !!ordemDaColuna && p.ordem === ordemDaColuna;
  var seta = ativo ? (p.direcao === "asc" ? " ▲" : " ▼") : "";
  var estilo = [s.th, largura ? { flexGrow: 1, flexBasis: largura, minWidth: largura } : { width: LARGURA_PRODUTO }];
  var texto = <Text style={[s.thTexto, { textAlign: alinhar }, ativo && { color: Colors.violet3 }]} numberOfLines={1}>{rotulo}{seta}</Text>;
  if (!ordemDaColuna) return <View style={estilo}>{texto}</View>;
  return (
    <Pressable
      testID={"relatorio-ordenar-" + ordemDaColuna}
      onPress={function() { p.onOrdenar(ordemDaColuna as OrdemApi); }}
      accessibilityRole="button"
      accessibilityLabel={"Ordenar por " + rotulo}
      style={estilo}
    >
      {texto}
    </Pressable>
  );
}

function Tabela(p: Props & { mostrarCodigo: boolean }) {
  return (
    <View style={{ flexDirection: "row" }} testID="relatorio-tabela">
      <View style={[s.colunaFixa, { width: LARGURA_PRODUTO }]}>
        <Cabecalho rotulo="Produto" ordemDaColuna="nome" p={p} alinhar="left" />
        {p.linhas.map(function(l, i) {
          var det = detalheDoNome(l, p.mostrarCodigo, p.agrupar);
          return (
            <View key={l.chave} style={[s.td, s.tdNome, i === p.linhas.length - 1 && s.ultima]}>
              <Text style={s.nome} numberOfLines={1}>{l.nome_exibicao || l.nome}</Text>
              {!!det && <Text style={s.codigo} numberOfLines={1}>{det}</Text>}
            </View>
          );
        })}
      </View>
      <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsHorizontalScrollIndicator>
        <View style={{ flexGrow: 1 }}>
          <View style={{ flexDirection: "row" }}>
            {p.colunas.map(function(c) {
              return <Cabecalho key={c} rotulo={COLUNAS[c].rotulo} ordemDaColuna={COLUNAS[c].ordem} p={p} largura={larguraDa(c)} alinhar="right" />;
            })}
          </View>
          {p.linhas.map(function(l, i) {
            return (
              <View key={l.chave} style={{ flexDirection: "row" }}>
                {p.colunas.map(function(c) {
                  var cel = celula(l, c, p.hoje);
                  var w = larguraDa(c);
                  return (
                    <View key={c} style={[s.td, { flexGrow: 1, flexBasis: w, minWidth: w, alignItems: "flex-end" }, i === p.linhas.length - 1 && s.ultima]}>
                      <Text
                        style={[s.valor, { color: corDoTom(cel.tom) }, (cel.tom === "vermelho" || cel.tom === "ambar") && { fontWeight: "700" }]}
                        numberOfLines={1}
                      >
                        {cel.texto}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Cartoes(p: Props & { mostrarCodigo: boolean }) {
  var cols = colunasDoCartao(p.colunas, p.ordem);
  return (
    <View testID="relatorio-cartoes">
      {p.linhas.map(function(l, i) {
        var det = detalheDoNome(l, true, p.agrupar);
        return (
          <View key={l.chave} style={[s.cartao, i === p.linhas.length - 1 && s.ultima]} testID="relatorio-cartao">
            <Text style={s.nome} numberOfLines={2}>{l.nome_exibicao || l.nome}</Text>
            {!!det && <Text style={s.codigo} numberOfLines={1}>{det}</Text>}
            <View style={s.grade}>
              {cols.map(function(c) {
                var cel = celula(l, c, p.hoje);
                return (
                  <View key={c} style={s.gradeItem} testID={"relatorio-cartao-" + c}>
                    <Text style={s.gradeRotulo} numberOfLines={1}>{COLUNAS[c].rotulo}</Text>
                    <Text style={[s.gradeValor, { color: corDoTom(cel.tom) }]} numberOfLines={1}>{cel.texto}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

var s = StyleSheet.create({
  caixa: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden" },
  colunaFixa: { borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: Colors.bg3 },
  th: { height: ALTURA_CABECALHO, justifyContent: "center", paddingHorizontal: 12, backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thTexto: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: Colors.ink3 },
  td: { height: ALTURA_LINHA, justifyContent: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tdNome: { alignItems: "flex-start" },
  ultima: { borderBottomWidth: 0 },
  nome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  codigo: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  valor: { fontSize: 13, color: Colors.ink },
  cartao: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border },
  grade: { flexDirection: "row", gap: 6, marginTop: 8 },
  gradeItem: { flex: 1, minWidth: 0 },
  gradeRotulo: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  gradeValor: { fontSize: 14, fontWeight: "600", color: Colors.ink, marginTop: 2 },
  rodape: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  rodapeTexto: { fontSize: 12.5, color: Colors.ink3, flex: 1 },
  btnMais: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" },
  btnMaisTexto: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
});
