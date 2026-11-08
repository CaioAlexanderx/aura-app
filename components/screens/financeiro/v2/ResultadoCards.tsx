// components/screens/financeiro/v2/ResultadoCards.tsx
//
// 08/11/2026 (p-82, mockup v3 aprovado pelo Caio em 07/11): a faixa de cima
// da aba Receitas responde em quatro cartões — quanto entrou (Faturamento),
// quanto custou o que vendi (Custos), quanto sobrou da venda (Lucro bruto) e
// quanto gastei para tocar a loja (Despesas). O resto da aba não muda.
//
// Números do backend (GET .../financeiro/resultado, card p-81). Este
// componente só desenha: quem decide se aparece é o TabReceitas (sem custo
// visível ou backend antigo, ele nem é montado).

import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { fmt, fmtK } from "../types";
import {
  type ResultadoDoPeriodo, type Variacao,
  FRASE_DO_PERIODO, variacao, textoDaCobertura,
} from "@/utils/resultadoDoPeriodo";

var isWeb = Platform.OS === "web";

// Acima de R$ 100 mil o valor cheio não cabe no cartão de 375 px.
function valor(n: number): string {
  return Math.abs(n) >= 100000 ? fmtK(n) : fmt(n);
}

type Props = {
  resultado: ResultadoDoPeriodo;
  period: string;
  // Leva para Lançamentos já filtrado em Fornecedores.
  onVerCompras?: () => void;
  // Leva para o Estoque, onde o custo é cadastrado. Ausente no Studio.
  onCadastrarCustos?: () => void;
};

function corDoTom(v: Variacao): string {
  if (!v) return Colors.ink3;
  return v.tom === "bom" ? Colors.green : v.tom === "ruim" ? Colors.red : Colors.ink3;
}

export function ResultadoCards({ resultado: r, period, onVerCompras, onCadastrarCustos }: Props) {
  var { width: vw } = useWindowDimensions();
  var quatroColunas = vw > 700;
  var [verProdutos, setVerProdutos] = useState(false);
  var [verComo, setVerComo] = useState(false);

  var ant = r.anterior;
  var cob = textoDaCobertura(r, period);
  var semCusto = cob.tipo === "nenhum";
  var quando = FRASE_DO_PERIODO[period] || "no período";

  var vFat = variacao(r.faturamento, ant?.faturamento, false, period);
  var vCus = semCusto ? null : variacao(r.custos, ant?.custos, true, period);
  var vDes = variacao(r.despesas, ant?.despesas, true, period);

  var celula = quatroColunas ? s.celulaLarga : s.celulaEstreita;

  var rodapeLucro = semCusto || r.lucro_bruto == null
    ? "cadastre o custo para ver"
    : valor(r.receita_com_custo) + " vendidos com custo − " + valor(r.custos);

  var corCobertura = cob.tipo === "completo" ? Colors.greenD : cob.tipo === "parcial" ? Colors.amberD : Colors.violetD;
  var produtos = r.produtos_sem_custo || [];
  var nSem = r.cobertura.produtos_sem_custo;

  return (
    <View testID="receitas-resultado">
      <View style={s.grade}>
        <Cartao
          testID="cartao-faturamento" estilo={celula}
          nome="Faturamento" valor={valor(r.faturamento)}
          linha={vFat ? vFat.texto : null} corLinha={corDoTom(vFat)}
          rodape={"vendido " + quando}
        />
        <Cartao
          testID="cartao-custos" estilo={celula}
          nome="Custos" valor={semCusto ? "—" : valor(r.custos)}
          linha={semCusto ? "sem custo cadastrado" : vCus ? vCus.texto : null} corLinha={corDoTom(vCus)}
          rodape="o que custou o que você vendeu"
        />
        <Cartao
          testID="cartao-lucro" estilo={celula} destaque
          nome="Lucro bruto" valor={r.lucro_bruto == null ? "—" : valor(r.lucro_bruto)}
          linha={r.margem_pct == null ? "precisa do custo" : String(r.margem_pct).replace(".", ",") + "% de margem"}
          corLinha={r.margem_pct == null ? Colors.ink3 : r.margem_pct >= 0 ? Colors.green : Colors.red}
          rodape={rodapeLucro}
        />
        <Cartao
          testID="cartao-despesas" estilo={celula}
          nome="Despesas" valor={valor(r.despesas)}
          linha={vDes ? vDes.texto : null} corLinha={corDoTom(vDes)}
          rodape="aluguel, contas e outras saídas"
        />
      </View>

      {cob.tipo !== "sem_venda" ? (
        <View testID="receitas-cobertura" style={[s.faixa, { backgroundColor: corCobertura }]}>
          <Text style={[s.faixaTexto, { color: Colors.ink }]}>
            <Text style={{ fontWeight: "700" }}>{cob.titulo}</Text>
            {" "}{cob.detalhe}
          </Text>
          {cob.tipo === "parcial" && produtos.length > 0 ? (
            <Link
              testID="receitas-ver-produtos"
              texto={verProdutos ? "Fechar a lista" : nSem === 1 ? "Ver o produto" : "Ver os " + nSem + " produtos"}
              onPress={function() { setVerProdutos(!verProdutos); }}
            />
          ) : null}
          {cob.tipo === "nenhum" && onCadastrarCustos ? (
            <Link testID="receitas-cadastrar-custos" texto="Cadastrar custos" onPress={onCadastrarCustos} />
          ) : null}
        </View>
      ) : null}

      {verProdutos ? (
        <View testID="receitas-lista-sem-custo" style={[s.lista, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.listaTitulo, { color: Colors.ink3 }]}>
            {produtos.length < nSem ? "Os " + produtos.length + " que mais venderam sem custo" : "Vendidos sem custo"}
          </Text>
          {produtos.map(function(p, i) {
            return (
              <View key={(p.product_id || p.nome) + i} style={[s.listaLinha, { borderBottomColor: Colors.border }]}>
                <Text style={[s.listaNome, { color: Colors.ink }]} numberOfLines={1}>{p.nome}</Text>
                <Text style={[s.listaValor, { color: Colors.ink2 }]}>{valor(p.receita)}</Text>
              </View>
            );
          })}
          {onCadastrarCustos ? (
            <View style={{ marginTop: 10 }}>
              <Link testID="receitas-cadastrar-custos-lista" texto="Cadastrar custos no Estoque" onPress={onCadastrarCustos} />
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={[s.conta, { color: Colors.ink3 }]}>
        Faturamento − Custos = <Text style={{ color: Colors.ink, fontWeight: "700" }}>Lucro bruto</Text>
        {"  ·  "}Despesas são as saídas da loja e ficam à parte
      </Text>

      {r.compras_pagas.total > 0 ? (
        <View testID="receitas-compras" style={[s.compras, { backgroundColor: Colors.bg3, borderColor: Colors.border2 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.comprasTitulo, { color: Colors.ink2 }]}>Compras de mercadoria pagas</Text>
            <Text style={[s.comprasSub, { color: Colors.ink3 }]}>Não entram no lucro: viram estoque e só contam quando você vende.</Text>
            {onVerCompras ? (
              <Link testID="receitas-ver-compras" texto="Ver lançamentos" onPress={onVerCompras} />
            ) : null}
          </View>
          <Text style={[s.comprasValor, { color: Colors.ink }]}>{valor(r.compras_pagas.total)}</Text>
        </View>
      ) : null}

      <Text testID="receitas-ressalva" style={[s.ressalva, { color: Colors.ink3 }]}>
        O lucro bruto olha as vendas do período que têm custo. O Saldo da Visão geral olha o dinheiro que entrou e saiu. Por isso os dois podem ser diferentes.
      </Text>

      <Pressable
        testID="receitas-como-calcula"
        accessibilityRole="button"
        onPress={function() { setVerComo(!verComo); }}
        style={[s.como, { backgroundColor: Colors.bg3, borderColor: Colors.border }, isWeb ? ({ cursor: "pointer" } as any) : null]}
      >
        <View style={s.comoTopo}>
          <Text style={[s.comoTitulo, { color: Colors.ink }]}>Como cada número é calculado</Text>
          <Text style={[s.comoAbrir, { color: Colors.violet3 }]}>{verComo ? "Fechar" : "Abrir"}</Text>
        </View>
        {verComo ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            <Definicao nome="Faturamento" texto="Tudo o que você vendeu no período, já com os descontos. Nas trocas, entra o que foi vendido e sai o que foi devolvido." />
            <Definicao nome="Custos" texto="O que você pagou pelos produtos que saíram nessas vendas, pelo custo cadastrado em cada um." />
            <Definicao nome="Lucro bruto" texto="Faturamento menos custos, só nas vendas com custo cadastrado. É o que sobra da venda antes de pagar as despesas." />
            <Definicao nome="Despesas" texto="O que saiu para tocar a loja, como aluguel, contas e taxas de cartão. A compra de mercadoria não conta aqui: ela vira custo quando você vende." />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function Cartao({ nome, valor: v, linha, corLinha, rodape, destaque, estilo, testID }: {
  nome: string; valor: string; linha: string | null; corLinha: string; rodape: string;
  destaque?: boolean; estilo: any; testID: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        s.cartao, estilo,
        { backgroundColor: destaque ? Colors.violetD : Colors.bg3, borderColor: destaque ? Colors.violet : Colors.border },
      ]}
    >
      <Text style={[s.cartaoNome, { color: Colors.ink3 }]}>{nome}</Text>
      <Text style={[s.cartaoValor, { color: destaque ? Colors.violet3 : Colors.ink }]} numberOfLines={1}>{v}</Text>
      {linha ? <Text style={[s.cartaoLinha, { color: corLinha }]}>{linha}</Text> : null}
      <Text style={[s.cartaoRodape, { color: Colors.ink3 }]}>{rodape}</Text>
    </View>
  );
}

function Link({ texto, onPress, testID }: { texto: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={8} style={isWeb ? ({ cursor: "pointer" } as any) : null}>
      <Text style={[s.link, { color: Colors.violet3 }]}>{texto}</Text>
    </Pressable>
  );
}

function Definicao({ nome, texto }: { nome: string; texto: string }) {
  return (
    <View>
      <Text style={[s.defNome, { color: Colors.ink }]}>{nome}</Text>
      <Text style={[s.defTexto, { color: Colors.ink2 }]}>{texto}</Text>
    </View>
  );
}

var s = StyleSheet.create({
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  celulaLarga: { flex: 1, minWidth: 0 },
  celulaEstreita: { flexBasis: "46%", flexGrow: 1, minWidth: 0 },
  cartao: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cartaoNome: { fontSize: 9.5, letterSpacing: 0.6, fontWeight: "600", textTransform: "uppercase" },
  cartaoValor: { fontSize: 20, fontWeight: "800", marginTop: 6, letterSpacing: -0.4 },
  cartaoLinha: { fontSize: 11.5, fontWeight: "600", marginTop: 4 },
  cartaoRodape: { fontSize: 11.5, marginTop: 3, lineHeight: 15 },
  faixa: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, gap: 6 },
  faixaTexto: { fontSize: 12.5, lineHeight: 18 },
  link: { fontSize: 12.5, fontWeight: "700" },
  lista: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  listaTitulo: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  listaLinha: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1 },
  listaNome: { flex: 1, minWidth: 0, fontSize: 13 },
  listaValor: { fontSize: 12.5, fontWeight: "600" },
  conta: { fontSize: 12, textAlign: "center", marginBottom: 10, lineHeight: 17 },
  compras: {
    flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap",
    borderRadius: 12, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
  },
  comprasTitulo: { fontSize: 13, fontWeight: "600" },
  comprasSub: { fontSize: 11.5, marginTop: 2, marginBottom: 4, lineHeight: 16 },
  comprasValor: { fontSize: 15, fontWeight: "700" },
  ressalva: { fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
  como: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  comoTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  comoTitulo: { flex: 1, fontSize: 13, fontWeight: "600" },
  comoAbrir: { fontSize: 12.5, fontWeight: "600" },
  defNome: { fontSize: 12.5, fontWeight: "700" },
  defTexto: { fontSize: 12.5, lineHeight: 18, marginTop: 1 },
});

export default ResultadoCards;
