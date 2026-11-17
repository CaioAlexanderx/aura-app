// ============================================================
// AURA. — "Chegou mercadoria" · Passo 3, origem "Digitar os itens" (A5)
//
// Mockup estoque-portas-mockup-17-11.html, parte 4 ("Passo 3 · Origem
// 'Digitar os itens'"). Reaproveita a busca de produto, a quantidade, o
// custo, a grade ("Quantas chegaram de cada?", GradeDaEntrada) e o "Nº da
// nota (opcional)" do EntradaMercadoriaModal. Vira uma lista de linhas; quem
// não acha o produto cadastra ali (só nome e preço).
//
// Contas em digitarRegras.ts; a gravação é o A7 (mesmo caminho da nota).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi } from "@/services/api";
import { maskCurrency } from "@/utils/masks";
import { fmtQty } from "@/utils/matconUnits";
import { numeroPositivo, previaDaEntrada } from "@/utils/entradaDeMercadoria";
import { GradeDaEntrada } from "@/components/screens/estoque/GradeDaEntrada";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import { buscarProdutos, type ProdutoDaLoja } from "./chegouRegras";
import { novaLinhaDigitada, quantidadeDaLinha, type LinhaDigitada } from "./digitarRegras";

const brl = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? "—"
    : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const paraCampo = (n: number | null | undefined) => (Number(n) > 0 ? maskCurrency(String(Math.round(Number(n) * 100))) : "");

type Props = {
  estreito: boolean;
  semCusto: boolean;
  companyId: string;
  produtos: ProdutoDaLoja[];
  porId: Map<string, ProdutoDaLoja>;
  linhas: LinhaDigitada[];
  onMudar: (linhas: LinhaDigitada[]) => void;
  numeroDaNota: string;
  onNumeroDaNota: (v: string) => void;
  /** Recusas do servidor por linha (n = posição na lista, a partir de 1). */
  errosDasLinhas?: Record<number, string>;
};

export function Passo3Digitar(p: Props) {
  const [busca, setBusca] = useState("");
  const achados = useMemo(() => buscarProdutos(p.produtos, busca), [p.produtos, busca]);
  const termo = busca.trim();

  function adicionar(base: Partial<LinhaDigitada>) {
    p.onMudar([...p.linhas, novaLinhaDigitada(base)]);
    setBusca("");
  }
  function mudar(id: string, d: Partial<LinhaDigitada>) {
    p.onMudar(p.linhas.map((l) => (l.id === id ? { ...l, ...d } : l)));
  }

  return (
    <View style={{ gap: 12 }} testID="chegou-passo-3-digitar">
      {p.linhas.map((l, i) => (
        <LinhaDigitadaView
          key={l.id}
          n={i + 1}
          l={l}
          produto={l.produtoId ? p.porId.get(l.produtoId) : undefined}
          semCusto={p.semCusto}
          estreito={p.estreito}
          companyId={p.companyId}
          erro={p.errosDasLinhas ? p.errosDasLinhas[i + 1] : undefined}
          onMudar={(d) => mudar(l.id, d)}
          onTirar={() => p.onMudar(p.linhas.filter((x) => x.id !== l.id))}
        />
      ))}

      <View style={{ gap: 6 }}>
        <Text style={s.rotulo}>{T.digitarPergunta}</Text>
        <View style={s.buscaBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={T.ligarBusca}
            placeholderTextColor={Colors.ink3}
            style={s.buscaInput as any}
            accessibilityLabel={T.ligarBusca}
            testID="chegou-digitar-busca"
          />
        </View>
        {termo ? (
          <View style={s.lista}>
            {achados.length === 0 ? <Text style={[s.apoio, { padding: 10 }]}>{T.ligarVazio}</Text> : null}
            {achados.map((prod) => (
              <Pressable
                key={prod.id}
                onPress={() => adicionar({ produtoId: prod.id, custo: !p.semCusto && Number(prod.cost) > 0 ? Number(prod.cost) : null })}
                style={s.achado}
                accessibilityRole="button"
                testID={"chegou-digitar-produto-" + prod.id}
              >
                <Text style={[s.nome, { flex: 1 }]} numberOfLines={1}>{prod.name}</Text>
                <Text style={s.apoioPeq}>{fmtQty(Number(prod.stock) || 0)} {prod.unit && prod.unit !== "un" ? prod.unit : "un"}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => adicionar({ novo: { nome: termo, preco: null } })}
              style={[s.achado, s.achadoNovo]}
              accessibilityRole="button"
              testID="chegou-digitar-novo"
            >
              <Icon name="plus" size={14} color={Colors.violet3} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.nome, { color: Colors.violet3 }]} numberOfLines={1}>{T.cadastrarComoNovo(termo)}</Text>
                <Text style={s.apoioPeq}>{T.digitarNovoApoio}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 6, maxWidth: 260 }}>
        <Text style={s.rotulo}>{T.notaNumero}</Text>
        <TextInput
          value={p.numeroDaNota}
          onChangeText={(t) => p.onNumeroDaNota(t.slice(0, 40))}
          placeholder={T.notaExemplo}
          placeholderTextColor={Colors.ink3}
          style={s.input as any}
          accessibilityLabel={T.notaNumero}
          testID="chegou-digitar-nota"
        />
      </View>
    </View>
  );
}

function LinhaDigitadaView({ n, l, produto, semCusto, estreito, companyId, erro, onMudar, onTirar }: {
  n: number;
  l: LinhaDigitada;
  produto: ProdutoDaLoja | undefined;
  semCusto: boolean;
  estreito: boolean;
  companyId: string;
  erro?: string;
  onMudar: (d: Partial<LinhaDigitada>) => void;
  onTirar: () => void;
}) {
  const [qtdTxt, setQtdTxt] = useState(l.quantidade ? fmtQty(l.quantidade) : "");
  const [custoTxt, setCustoTxt] = useState(paraCampo(l.custo));
  const [precoTxt, setPrecoTxt] = useState(paraCampo(l.novo ? l.novo.preco : null));
  const [grade, setGrade] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {};
    for (const [k, q] of Object.entries(l.grade || {})) g[k] = fmtQty(q);
    return g;
  });
  const temGrade = !!produto && !!produto.has_variants;
  const { data } = useQuery({
    queryKey: ["estoque-consulta-variantes", companyId, produto ? produto.id : null],
    queryFn: () => companiesApi.variants(companyId, produto!.id),
    enabled: temGrade && !!companyId,
    staleTime: 30_000,
  });
  const variantes: any[] = Array.isArray((data as any)?.variants) ? (data as any).variants : [];
  const q = quantidadeDaLinha(l, produto);
  const un = produto && produto.unit && produto.unit !== "un" ? produto.unit : "un";
  const previa = produto && !semCusto && q > 0
    ? previaDaEntrada({ estoqueAntes: Number(produto.stock) || 0, custoAtual: Number(produto.cost) > 0 ? Number(produto.cost) : null, quantidade: q, custoUnitario: l.custo, preco: Number(produto.price) || null })
    : null;

  return (
    <View style={[s.linha, !!erro && s.linhaErro]} testID={"chegou-digitar-linha-" + n}>
      <View style={s.topo}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nome} numberOfLines={2}>{l.novo ? T.produtoNovo : produto ? produto.name : "—"}</Text>
          {produto ? <Text style={s.apoioPeq}>{T.previaEstoque(fmtQty(Number(produto.stock) || 0), fmtQty((Number(produto.stock) || 0) + q), un)}</Text> : null}
          {previa && previa.custoDepois !== null ? <Text style={s.apoioPeq}>{T.previaCusto(brl(previa.custoAntes), brl(previa.custoDepois))}</Text> : null}
        </View>
        <Pressable onPress={onTirar} style={s.tirar} accessibilityLabel={T.digitarTirar} testID={"chegou-digitar-linha-" + n + "-tirar"}>
          <Icon name="x" size={14} color={Colors.ink3} />
        </Pressable>
      </View>

      {l.novo ? (
        <View style={[s.campos, estreito && { flexDirection: "column" }]}>
          <View style={{ flex: 2, minWidth: 0 }}>
            <Text style={s.rotulo}>{T.novoNome}</Text>
            <TextInput
              value={l.novo.nome}
              onChangeText={(t) => onMudar({ novo: { ...l.novo!, nome: t } })}
              style={s.input as any}
              accessibilityLabel={T.novoNome}
              testID={"chegou-digitar-linha-" + n + "-nome"}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rotulo}>{T.novoPreco}</Text>
            <TextInput
              value={precoTxt}
              onChangeText={(t) => { const m = maskCurrency(t); setPrecoTxt(m); onMudar({ novo: { ...l.novo!, preco: numeroPositivo(m) } }); }}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              style={[s.input, !(Number(l.novo.preco) > 0) && s.inputFalta] as any}
              accessibilityLabel={T.novoPreco}
              testID={"chegou-digitar-linha-" + n + "-preco"}
            />
          </View>
        </View>
      ) : null}

      {temGrade ? (
        <View style={{ gap: 6 }}>
          <Text style={s.rotulo}>{T.gradeTitulo}</Text>
          <GradeDaEntrada
            variantes={variantes}
            grade={grade}
            testIDPrefixo={"chegou-digitar-linha-" + n + "-grade-"}
            onChange={(g) => {
              setGrade(g);
              const v: Record<string, number> = {};
              for (const k of Object.keys(g)) { const x = numeroPositivo(g[k]); if (x) v[k] = x; }
              onMudar({ grade: v });
            }}
          />
        </View>
      ) : null}

      <View style={[s.campos, estreito && { flexDirection: "column" }]}>
        {!temGrade ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rotulo}>{T.digitarQuantidade}</Text>
            <TextInput
              value={qtdTxt}
              onChangeText={(t) => { const limpo = t.replace(/[^\d,]/g, ""); setQtdTxt(limpo); onMudar({ quantidade: numeroPositivo(limpo) }); }}
              placeholder="0"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              style={[s.input, !(q > 0) && s.inputFalta] as any}
              accessibilityLabel={T.digitarQuantidade}
              testID={"chegou-digitar-linha-" + n + "-quantidade"}
            />
          </View>
        ) : null}
        {!semCusto ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rotulo}>{T.digitarCusto}</Text>
            <TextInput
              value={custoTxt}
              onChangeText={(t) => { const m = maskCurrency(t); setCustoTxt(m); onMudar({ custo: numeroPositivo(m) }); }}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              style={s.input as any}
              accessibilityLabel={T.digitarCusto}
              testID={"chegou-digitar-linha-" + n + "-custo"}
            />
          </View>
        ) : null}
      </View>
      {erro ? <Text style={s.erro} testID={"chegou-digitar-linha-" + n + "-erro"}>{erro}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  rotulo: { fontSize: 11.5, fontWeight: "600", color: Colors.ink2, marginBottom: 4 },
  apoio: { fontSize: 12.5, color: Colors.ink2 },
  apoioPeq: { fontSize: 11.5, color: Colors.ink3 },
  nome: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  buscaBox: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, backgroundColor: Colors.bg2,
  },
  buscaInput: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 10, outlineStyle: "none" } as any,
  lista: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, overflow: "hidden" },
  achado: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  achadoNovo: { backgroundColor: Colors.violetD },
  linha: { gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2 },
  linhaErro: { borderColor: Colors.red, backgroundColor: Colors.redD },
  topo: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tirar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  campos: { flexDirection: "row", gap: 10 },
  input: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg3, minHeight: 44,
  },
  inputFalta: { borderColor: Colors.amber },
  erro: { fontSize: 12.5, color: Colors.red, fontWeight: "600" },
});
