// ============================================================
// AURA. — Financeiro › Relatórios: painel "Ajustar o relatório" (p-115b)
//
// Acordeão: abre fechado no celular e aberto no computador. Filtros
// (Estoque, Vendas, Custo, Categoria), Ordenar por, Agrupar por produto e
// Colunas. Só despacha as ações do reducer de utils/relatorioProdutos.ts;
// qualquer ajuste passa o chip do modelo para Personalizado.
// Quem não vê custo não vê o filtro Custo nem as colunas e ordens de custo.
// Nada depende de hover: tudo é toque/clique.
// ============================================================
import { useEffect, useState, type Dispatch } from "react";
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  COLUNAS, colunasDoPainel, ordensDoPainel, podeDesmarcar, limitarNumero,
  modoEstoque, modoVendas, modoCusto, acoesDoEstoque, acoesDasVendas, acoesDoCusto, abaixoDeEstoqueMax,
  ACABA_EM_PADRAO, ABAIXO_DE_PADRAO, PARADO_PADRAO,
  type AcaoRelatorio, type EstadoRelatorio, type ColunaId, type OrdemApi,
  type ModoEstoque, type ModoVendas, type ModoCusto,
} from "@/utils/relatorioProdutos";

export type CategoriaDoPainel = { id: string; nome: string; nivel: number; caminho: string };

type Props = {
  estado: EstadoRelatorio;
  despachar: Dispatch<AcaoRelatorio>;
  colunasVisiveis: ColunaId[];
  ordem: OrdemApi;
  podeVerCusto: boolean;
  /** No consolidado a categoria vai pelo nome (as árvores são por loja). */
  consolidado: boolean;
  categorias: CategoriaDoPainel[];
  abertoNoInicio: boolean;
  compacto: boolean;
};

function Chip({ rotulo, on, onPress, testID, disabled, tracejado }: {
  rotulo: string; on: boolean; onPress?: () => void; testID?: string; disabled?: boolean; tracejado?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: !!disabled }}
      style={[s.chip, tracejado && { borderStyle: "dashed" }, on && s.chipOn, disabled && { opacity: 0.65 }]}
    >
      <Text style={[s.chipTexto, on && s.chipTextoOn]}>{rotulo}</Text>
    </Pressable>
  );
}

/** Número de 1 a 365: o texto é livre enquanto digita; vale o número limitado. */
export function CampoNumero({ valor, onValor, unidade, testID, rotulo }: {
  valor: number; onValor: (n: number) => void; unidade: string; testID: string; rotulo: string;
}) {
  var [texto, setTexto] = useState(String(valor));
  useEffect(function() { setTexto(String(valor)); }, [valor]);
  return (
    <View style={s.numeroLinha}>
      <TextInput
        testID={testID}
        style={s.numero}
        value={texto}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel={rotulo}
        onChangeText={function(v) {
          var dig = String(v).replace(/\D/g, "").slice(0, 3);
          if (!dig) { setTexto(""); return; }
          var n = limitarNumero(dig, valor);
          setTexto(Number(dig) > n ? String(n) : dig);
          if (n !== valor) onValor(n);
        }}
        onBlur={function() { setTexto(String(valor)); }}
      />
      <Text style={s.numeroUnidade}>{unidade}</Text>
    </View>
  );
}

export function AjustarRelatorio(p: Props) {
  var [aberto, setAberto] = useState(p.abertoNoInicio);
  var [categoriasAbertas, setCategoriasAbertas] = useState(false);
  var f = p.estado.filtros;
  var me = modoEstoque(f);
  var mv = modoVendas(f);
  var mc = modoCusto(f);

  function varias(acoes: AcaoRelatorio[]) { acoes.forEach(function(a) { p.despachar(a); }); }

  var nEstoque = me === "acabando" ? (f.acaba_em_dias || ACABA_EM_PADRAO)
    : me === "abaixo" && f.estoque_max !== null ? abaixoDeEstoqueMax(f.estoque_max) : ABAIXO_DE_PADRAO;
  var nParado = f.sem_vender_dias || PARADO_PADRAO;

  var categoriaAtual = f.categoria
    ? (p.categorias.find(function(c) { return c.id === f.categoria || c.nome === f.categoria; }) || null)
    : null;
  var rotuloCategoria = !f.categoria ? "Todas" : categoriaAtual ? categoriaAtual.caminho : f.categoria;

  var ordens = ordensDoPainel(p.colunasVisiveis);
  var colunas = colunasDoPainel(p.podeVerCusto);
  var largura = p.compacto ? { width: "100%" as const } : { flexBasis: "30%" as const, flexGrow: 1, minWidth: 220 };

  return (
    <View style={s.caixa} testID="relatorio-ajustar">
      <Pressable
        testID="relatorio-ajustar-abrir"
        onPress={function() { setAberto(!aberto); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        style={s.cabeca}
      >
        <Text style={s.cabecaTitulo}>
          Ajustar o relatório <Text style={s.cabecaSub}>filtros, colunas e ordem</Text>
        </Text>
        <Text style={s.cabecaAcao}>{aberto ? "Fechar ▴" : "Abrir ▾"}</Text>
      </Pressable>

      {aberto && (
        <View style={s.corpo} testID="relatorio-ajustar-corpo">
          <View style={[s.campo, largura]}>
            <Text style={s.rotulo}>Estoque</Text>
            <View style={s.chips}>
              {([["todos", "Todos"], ["acabando", "Acabando em até…"], ["zerado", "Zerado"], ["abaixo", "Abaixo de…"]] as [ModoEstoque, string][]).map(function(o) {
                return <Chip key={o[0]} testID={"relatorio-estoque-" + o[0]} rotulo={o[1]} on={me === o[0]} onPress={function() { if (me !== o[0]) varias(acoesDoEstoque(f, o[0], o[0] === "acabando" ? ACABA_EM_PADRAO : ABAIXO_DE_PADRAO)); }} />;
              })}
            </View>
            {(me === "acabando" || me === "abaixo") && (
              <CampoNumero
                testID="relatorio-estoque-n"
                rotulo={me === "acabando" ? "Acabando em até quantos dias" : "Abaixo de quantas unidades"}
                valor={nEstoque}
                unidade={me === "acabando" ? "dias" : "unidades"}
                onValor={function(n) { varias(acoesDoEstoque(f, me, n)); }}
              />
            )}
          </View>

          <View style={[s.campo, largura]}>
            <Text style={s.rotulo}>Vendas</Text>
            <View style={s.chips}>
              {([["qualquer", "Qualquer"], ["vendeu", "Vendeu no período"], ["parado", "Sem vender há… (com estoque)"]] as [ModoVendas, string][]).map(function(o) {
                return <Chip key={o[0]} testID={"relatorio-vendas-" + o[0]} rotulo={o[1]} on={mv === o[0]} onPress={function() { if (mv !== o[0]) varias(acoesDasVendas(f, o[0], PARADO_PADRAO)); }} />;
              })}
            </View>
            {mv === "parado" && (
              <CampoNumero
                testID="relatorio-vendas-n"
                rotulo="Sem vender há quantos dias"
                valor={nParado}
                unidade="dias ou mais"
                onValor={function(n) { varias(acoesDasVendas(f, "parado", n)); }}
              />
            )}
          </View>

          {p.podeVerCusto && (
            <View style={[s.campo, largura]} testID="relatorio-filtro-custo">
              <Text style={s.rotulo}>Custo</Text>
              <View style={s.chips}>
                {([["todos", "Todos"], ["com", "Com custo cadastrado"], ["sem", "Sem custo cadastrado"]] as [ModoCusto, string][]).map(function(o) {
                  return <Chip key={o[0]} testID={"relatorio-custo-" + o[0]} rotulo={o[1]} on={mc === o[0]} onPress={function() { if (mc !== o[0]) varias(acoesDoCusto(o[0])); }} />;
                })}
              </View>
            </View>
          )}

          <View style={[s.campo, largura]}>
            <Text style={s.rotulo}>Categoria</Text>
            <Pressable
              testID="relatorio-categoria"
              onPress={function() { setCategoriasAbertas(!categoriasAbertas); }}
              accessibilityRole="button"
              accessibilityState={{ expanded: categoriasAbertas }}
              style={s.seletor}
            >
              <Text style={s.seletorTexto} numberOfLines={1}>{rotuloCategoria}</Text>
              <Text style={s.cabecaAcao}>{categoriasAbertas ? "▴" : "▾"}</Text>
            </Pressable>
            {categoriasAbertas && (
              <ScrollView style={s.lista} nestedScrollEnabled testID="relatorio-categorias">
                <Pressable
                  testID="relatorio-categoria-todas"
                  onPress={function() { p.despachar({ type: "filtro", campo: "categoria", valor: null }); setCategoriasAbertas(false); }}
                  style={[s.item, !f.categoria && s.itemOn]}
                >
                  <Text style={s.itemTexto}>Todas</Text>
                </Pressable>
                {p.categorias.length === 0 && <Text style={s.vazio}>Nenhuma categoria cadastrada ainda.</Text>}
                {p.categorias.map(function(c) {
                  var valor = p.consolidado ? c.nome : c.id;
                  var on = f.categoria === valor;
                  return (
                    <Pressable
                      key={c.id}
                      testID={"relatorio-categoria-" + c.id}
                      onPress={function() { p.despachar({ type: "filtro", campo: "categoria", valor: valor }); setCategoriasAbertas(false); }}
                      style={[s.item, on && s.itemOn, { paddingLeft: 12 + c.nivel * 16 }]}
                    >
                      <Text style={[s.itemTexto, c.nivel === 0 && { fontWeight: "600" }]} numberOfLines={1}>{c.nome}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {p.consolidado && <Text style={s.dica}>Em todas as lojas, vale a categoria com o mesmo nome em cada loja.</Text>}
          </View>

          <View style={[s.campo, largura]}>
            <Text style={s.rotulo}>Ordenar por</Text>
            <View style={s.chips}>
              {ordens.map(function(o) {
                return <Chip key={o.ordem} testID={"relatorio-ordem-" + o.ordem} rotulo={o.rotulo} on={p.ordem === o.ordem} onPress={function() { if (p.ordem !== o.ordem) p.despachar({ type: "ordenar", ordem: o.ordem }); }} />;
              })}
            </View>
            <View style={[s.chips, { marginTop: 8 }]}>
              <Chip testID="relatorio-direcao-desc" rotulo="Maior primeiro" on={p.estado.direcao === "desc"} onPress={function() { if (p.estado.direcao !== "desc") p.despachar({ type: "ordenar", ordem: p.ordem }); }} />
              <Chip testID="relatorio-direcao-asc" rotulo="Menor primeiro" on={p.estado.direcao === "asc"} onPress={function() { if (p.estado.direcao !== "asc") p.despachar({ type: "ordenar", ordem: p.ordem }); }} />
            </View>
          </View>

          <View style={[s.campo, largura]}>
            <Text style={s.rotulo}>Agrupar</Text>
            <View style={s.chips}>
              <Chip
                testID="relatorio-agrupar"
                rotulo="Agrupar por produto"
                on={p.estado.agrupar === "produto"}
                onPress={function() { p.despachar({ type: "agrupar", agrupar: p.estado.agrupar === "produto" ? "item" : "produto" }); }}
              />
            </View>
            <Text style={s.dica}>{p.estado.agrupar === "produto" ? "Um produto por linha, somando os tamanhos." : "Cada tamanho numa linha."}</Text>
          </View>

          <View style={[s.campo, { width: "100%" }]}>
            <Text style={s.rotulo}>Colunas</Text>
            <View style={s.chips}>
              <Chip testID="relatorio-coluna-produto" rotulo="Produto" on disabled />
              {colunas.map(function(c) {
                var on = p.estado.colunas.indexOf(c) >= 0;
                var travada = on && !podeDesmarcar(c, p.colunasVisiveis);
                return (
                  <Chip
                    key={c}
                    testID={"relatorio-coluna-" + c}
                    rotulo={COLUNAS[c].rotulo}
                    on={on}
                    disabled={travada}
                    onPress={function() {
                      p.despachar({ type: "alternarColuna", coluna: c });
                      // A coluna da ordem saiu da tabela: ordena pelo nome.
                      if (on && COLUNAS[c].ordem === p.ordem) p.despachar({ type: "ordenar", ordem: "nome" });
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  caixa: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14 },
  cabeca: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, minHeight: 44 },
  cabecaTitulo: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.ink },
  cabecaSub: { fontSize: 12.5, fontWeight: "400", color: Colors.ink3 },
  cabecaAcao: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  corpo: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  campo: { minWidth: 0 },
  rotulo: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: Colors.ink3, marginBottom: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, borderRadius: 99, paddingHorizontal: 11, minHeight: 34, justifyContent: "center" },
  chipOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipTexto: { fontSize: 12.5, color: Colors.ink2 },
  chipTextoOn: { color: Colors.violet3, fontWeight: "700" },
  numeroLinha: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  numero: { width: 72, minHeight: 40, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, color: Colors.ink, textAlign: "center" },
  numeroUnidade: { fontSize: 13, color: Colors.ink3 },
  seletor: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12 },
  seletorTexto: { flex: 1, fontSize: 13, color: Colors.ink },
  lista: { maxHeight: 240, marginTop: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg2 },
  item: { paddingHorizontal: 12, minHeight: 40, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemOn: { backgroundColor: Colors.violetD },
  itemTexto: { fontSize: 13, color: Colors.ink },
  vazio: { fontSize: 12.5, color: Colors.ink3, padding: 12 },
  dica: { fontSize: 12, color: Colors.ink3, marginTop: 6 },
});
