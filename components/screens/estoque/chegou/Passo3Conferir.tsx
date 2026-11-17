// ============================================================
// AURA. — "Chegou mercadoria" · Passo 3: conferir linha a linha (A4a)
//
// Mockup estoque-portas-mockup-17-11.html, parte 4 ("Passo 3 · Conferir
// linha a linha" e "no celular"). As contas e os estados vêm prontos do
// chegouRegras (conferirLinha, resumirConferencia, linhasVisiveis); aqui só
// há tela.
//
// Estados da linha: pronta (com "achado pelo …"), "Confere?" (custo bem
// acima do de costume: pergunta e não trava), sem par (cadastrar novo,
// ligar a um produto ou deixar de fora), quantidade zero (fica de fora
// sozinha, "Dizer quantos") e grade (produto de cores e tamanhos).
//
// Fica para o A4b: os painéis "Produto novo" (nome, preço, categoria) e
// "Ligar a um produto" (busca), "Trocar produto" e a margem dos novos.
// ============================================================
import { useState, type ReactNode } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { maskCurrency } from "@/utils/masks";
import { fmtQty } from "@/utils/matconUnits";
import { numeroPositivo } from "@/utils/entradaDeMercadoria";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import type { NotaLida } from "./lerNota";
import {
  diaMes, linhasVisiveis,
  type LinhaConferida, type ResumoDaConferencia, type DecisaoDaLinha, type AjusteDaLinha,
} from "./chegouRegras";

const brl = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? "—"
    : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  estreito: boolean;
  semCusto: boolean;
  nota: NotaLida;
  linhas: LinhaConferida[];
  resumo: ResumoDaConferencia;
  /** Códigos do fornecedor ainda chegando: a conferência espera. */
  carregando: boolean;
  mostrarTodas: boolean;
  onMostrarTodas: () => void;
  usarMedio: boolean;
  onUsarMedio: (v: boolean) => void;
  /** Decisão da linha (n do item); null desfaz. */
  onDecidir: (n: number, d: DecisaoDaLinha | null) => void;
  onAjustar: (n: number, a: Partial<AjusteDaLinha>) => void;
  /** "Cadastrar novo" já preenchido (nome da nota, preço sugerido). */
  novoPara: (l: LinhaConferida) => DecisaoDaLinha;
};

export function Passo3Conferir(p: Props) {
  if (p.carregando) {
    return (
      <View style={s.lendo} testID="chegou-conferindo">
        <ActivityIndicator size="small" color={Colors.violet3} />
        <Text style={s.lendoTitulo}>{T.lendoTitulo}</Text>
        <Text style={s.apoio}>{T.lendoTexto}</Text>
      </View>
    );
  }
  const { visiveis, escondidas } = linhasVisiveis(p.linhas, p.mostrarTodas);
  const r = p.resumo;

  const tile = (rotulo: string, valor: string, id: string, cor?: string) => (
    <View style={[s.tile, p.estreito && s.tileEstreito]} key={id} testID={"chegou-resumo-" + id}>
      <Text style={s.tileRotulo}>{rotulo}</Text>
      <Text style={[s.tileValor, cor ? { color: cor } : null]}>{valor}</Text>
    </View>
  );

  return (
    <View style={{ gap: 12 }} testID="chegou-passo-3">
      <View style={s.resumo}>
        <Text style={s.resumoNota}>{T.resumoNota(p.nota.numero || "—", diaMes(p.nota.emitidaEm))}</Text>
        <View style={s.tiles}>
          {tile(T.resumoItens, String(r.itens), "itens")}
          {tile(T.resumoProntos, String(r.prontos), "prontos", Colors.green)}
          {tile(T.resumoNovos, String(r.novos), "novos", Colors.violet3)}
          {tile(T.resumoFalta, String(r.falta), "falta", r.falta ? Colors.amber : undefined)}
          {tile(T.resumoFora, String(r.fora), "fora")}
          {!p.semCusto && tile(T.resumoTotal, brl(r.totalDosItens), "total")}
        </View>
        {!p.semCusto && r.bate !== null ? (
          <Text style={[s.bate, !r.bate && { color: Colors.amber }]} testID="chegou-total-bate">
            {r.bate ? T.totalBate(brl(p.nota.totalDosProdutos)) : T.totalNaoBate(brl(r.totalDosItens), brl(p.nota.totalDosProdutos))}
          </Text>
        ) : null}
        {!p.semCusto ? (
          <Pressable
            style={s.check}
            onPress={() => p.onUsarMedio(!p.usarMedio)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: p.usarMedio }}
            testID="chegou-usar-medio"
          >
            <View style={[s.caixa, !p.usarMedio && s.caixaDesligada]}>{p.usarMedio ? <Icon name="check" size={11} color="#fff" /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.checkTxt}>{T.usarMedio}</Text>
              <Text style={s.apoioPeq}>{T.usarMedioApoio}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {!p.estreito && (
        <View style={s.cabecalho}>
          <Text style={[s.colTxt, s.col1]}>{T.colItem}</Text>
          <Text style={[s.colTxt, s.col2]}>{T.colChegou}</Text>
          {!p.semCusto && <Text style={[s.colTxt, s.col3]}>{T.colCusto}</Text>}
          <Text style={[s.colTxt, s.col4]}>{T.colEstoque}</Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        {visiveis.map((l) => (
          <LinhaDaConferencia key={l.item.n} l={l} {...p} />
        ))}
      </View>

      {escondidas > 0 && (
        <Pressable onPress={p.onMostrarTodas} style={s.mostrar} accessibilityRole="button" testID="chegou-mostrar-outros">
          <Icon name="chevron_down" size={14} color={Colors.violet3} />
          <Text style={s.mostrarTxt}>{T.mostrarOutros(escondidas)}</Text>
        </Pressable>
      )}
    </View>
  );
}

function LinhaDaConferencia({ l, estreito, semCusto, onDecidir, onAjustar, novoPara }: Props & { l: LinhaConferida }) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [custoTxt, setCustoTxt] = useState("");
  const [dizendo, setDizendo] = useState(false);
  const [qtdTxt, setQtdTxt] = useState("");
  const n = l.item.n;
  const un = l.produto && l.produto.unit && l.produto.unit !== "un" ? l.produto.unit : "un";
  const cod = l.item.codigoFornecedor ? " · " + T.codigoDoItem(l.item.codigoFornecedor) : "";
  const decisaoTipo = l.decisao ? l.decisao.tipo : null;
  const semDecisao = l.estado === "sem_par" || l.estado === "novo" || l.estado === "ligar" || (l.estado === "fora" && decisaoTipo === "fora");

  let titulo = l.item.descricao;
  if (l.produto) titulo = l.produto.name;
  if (l.estado === "sem_par") titulo = T.semParTitulo;
  if (l.estado === "novo") titulo = T.produtoNovo;
  if (l.estado === "ligar") titulo = T.ligarProduto;

  const tom =
    l.estado === "sem_par" || l.estado === "ligar" || l.estado === "grade" || l.estado === "confere" || (l.estado === "novo" && l.falta)
      ? s.linhaAmbar
      : l.estado === "erro"
        ? s.linhaVermelha
        : l.estado === "fora"
          ? s.linhaApagada
          : l.estado === "novo"
            ? s.linhaVioleta
            : null;

  // Coluna "Estoque e custo médio" (ou o quadro vivo da decisão).
  let direita: ReactNode = null;
  if (l.previa && l.produto && (l.estado === "pronta" || l.estado === "confere")) {
    const pv = l.previa;
    direita = (
      <View style={{ gap: 2 }}>
        <Text style={s.previa}>{T.previaEstoque(fmtQty(pv.estoqueAntes), fmtQty(pv.estoqueDepois), un)}</Text>
        {!semCusto && pv.custoDepois !== null ? <Text style={s.previaPeq}>{T.previaCusto(brl(pv.custoAntes), brl(pv.custoDepois))}</Text> : null}
        {!semCusto && pv.margemDepois !== null ? <Text style={s.previaPeq}>{T.previaMargem(pv.margemAntes, pv.margemDepois)}</Text> : null}
      </View>
    );
  } else if (l.estado === "novo") {
    direita = <Text style={s.previaPeq}>{T.entraCom(fmtQty(l.quantidade), semCusto ? null : brl(l.custo))}</Text>;
  }

  const vivo =
    decisaoTipo === "novo" ? T.vivoNovo(fmtQty(l.quantidade), semCusto ? null : brl(l.custo))
      : decisaoTipo === "ligar" ? T.vivoLigar
        : decisaoTipo === "fora" ? T.vivoFora
          : T.semParTexto;

  const botaoDecisao = (tipo: "novo" | "ligar" | "fora", rotulo: string) => {
    const on = decisaoTipo === tipo;
    return (
      <Pressable
        key={tipo}
        onPress={() => {
          if (on) onDecidir(n, null);
          else onDecidir(n, tipo === "novo" ? novoPara(l) : tipo === "ligar" ? { tipo: "ligar", produtoId: null } : { tipo: "fora" });
        }}
        style={[s.btnSec, on && s.btnOn]}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        testID={"chegou-linha-" + n + "-" + tipo}
      >
        <Text style={[s.btnSecTxt, on && { color: "#fff" }]}>{rotulo}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[s.linha, tom, estreito && s.linhaEstreita]} testID={"chegou-linha-" + n} accessibilityLabel={l.estado}>
      <View style={[s.linhaTopo, estreito && { flexDirection: "column", alignItems: "stretch" }]}>
        <View style={[s.col1, { gap: 2 }]}>
          <Text style={[s.titulo, (l.estado === "sem_par" || l.estado === "ligar") && { color: Colors.amber }]} numberOfLines={2}>{titulo}</Text>
          <Text style={s.daNota} numberOfLines={2}>{l.item.descricao + cod}</Text>
          {l.par && (l.estado === "pronta" || l.estado === "confere") ? (
            <Text style={s.achado} testID={"chegou-linha-" + n + "-achado"}>{T.achadoPor[l.par.como]}</Text>
          ) : null}
        </View>
        <View style={[s.col2, estreito && s.colEstreita]}>
          {estreito ? <Text style={s.colTxt}>{T.colChegou}</Text> : null}
          <Text style={[s.qtd, l.estado === "erro" && { color: Colors.red }]}>{fmtQty(l.quantidade)} {un}</Text>
        </View>
        {!semCusto && (
          <View style={[s.col3, estreito && s.colEstreita]}>
            {estreito ? <Text style={s.colTxt}>{T.colCusto}</Text> : null}
            <Text style={s.custo}>{brl(l.custo)}</Text>
            {l.quantidade > 0 ? <Text style={s.previaPeq}>{brl(Math.round(l.quantidade * l.custo * 100) / 100)}</Text> : null}
          </View>
        )}
        <View style={[s.col4, estreito && s.colEstreita]}>{direita}</View>
      </View>

      {l.estado === "confere" && !semCusto ? (
        <View style={s.acaoBloco} testID={"chegou-linha-" + n + "-confere"}>
          <Text style={s.avisoTxt}>{T.confere(brl(l.custo), brl(l.previa ? l.previa.custoAntes : null))}</Text>
          {corrigindo ? (
            <TextInput
              value={custoTxt}
              onChangeText={(t) => {
                const m = maskCurrency(t);
                setCustoTxt(m);
                const v = numeroPositivo(m);
                if (v) onAjustar(n, { custo: v });
              }}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              autoFocus
              style={s.input as any}
              accessibilityLabel={T.corrigirCusto}
              testID={"chegou-linha-" + n + "-custo"}
            />
          ) : null}
          <View style={s.acoes}>
            {!corrigindo && (
              <Pressable onPress={() => setCorrigindo(true)} style={s.btnSec} accessibilityRole="button" testID={"chegou-linha-" + n + "-corrigir"}>
                <Text style={s.btnSecTxt}>{T.corrigirCusto}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => onAjustar(n, { custoConferido: true })} style={s.btnSec} accessibilityRole="button" testID={"chegou-linha-" + n + "-esta-certo"}>
              <Text style={s.btnSecTxt}>{T.estaCerto}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {semDecisao ? (
        <View style={s.acaoBloco}>
          <Text style={s.apoio} testID={"chegou-linha-" + n + "-vivo"}>{vivo}</Text>
          <View style={s.acoes}>
            {botaoDecisao("novo", T.cadastrarNovo)}
            {botaoDecisao("ligar", T.ligarProduto)}
            {botaoDecisao("fora", T.deixarDeFora)}
          </View>
        </View>
      ) : null}

      {l.estado === "grade" ? (
        <View style={s.acaoBloco}>
          <Text style={s.avisoTxt}>{T.gradeTexto}</Text>
        </View>
      ) : null}

      {l.estado === "erro" ? (
        <View style={s.acaoBloco} testID={"chegou-linha-" + n + "-erro"}>
          <Text style={[s.avisoTxt, { color: Colors.red }]}>{T.erroQtdZero}</Text>
          {dizendo ? (
            <TextInput
              value={qtdTxt}
              onChangeText={(t) => {
                const limpo = t.replace(/[^\d,]/g, "");
                setQtdTxt(limpo);
                const v = numeroPositivo(limpo);
                if (v) onAjustar(n, { quantidade: v });
              }}
              placeholder="0"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              autoFocus
              style={s.input as any}
              accessibilityLabel={T.dizerQuantos}
              testID={"chegou-linha-" + n + "-quantos"}
            />
          ) : (
            <View style={s.acoes}>
              <Pressable onPress={() => setDizendo(true)} style={s.btnSec} accessibilityRole="button" testID={"chegou-linha-" + n + "-dizer-quantos"}>
                <Text style={s.btnSecTxt}>{T.dizerQuantos}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  lendo: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 12 },
  lendoTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  apoio: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  apoioPeq: { fontSize: 11.5, color: Colors.ink3 },
  resumo: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  resumoNota: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { minWidth: 110, flexGrow: 1, padding: 10, borderRadius: 10, backgroundColor: Colors.bg4, gap: 2 },
  tileEstreito: { minWidth: "30%" as any },
  tileRotulo: { fontSize: 11, fontWeight: "600", color: Colors.ink3 },
  tileValor: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  bate: { fontSize: 12.5, color: Colors.green, fontWeight: "600" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 44 },
  caixa: { width: 18, height: 18, borderRadius: 5, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", marginTop: 1 },
  caixaDesligada: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border2 },
  checkTxt: { color: Colors.ink2, fontSize: 13 },
  cabecalho: { flexDirection: "row", gap: 12, paddingHorizontal: 14 },
  colTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3 },
  col1: { flex: 2.4, minWidth: 0 },
  col2: { width: 80 },
  col3: { width: 110 },
  col4: { flex: 1.6, minWidth: 0 },
  colEstreita: { width: "100%", flex: undefined, flexDirection: "row", gap: 8, alignItems: "baseline" },
  linha: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, gap: 10 },
  linhaEstreita: { padding: 12 },
  linhaAmbar: { borderColor: Colors.amber, backgroundColor: Colors.amberD },
  linhaVermelha: { borderColor: Colors.red, backgroundColor: Colors.redD },
  linhaVioleta: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  linhaApagada: { opacity: 0.75 },
  linhaTopo: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  titulo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  daNota: { fontSize: 11.5, color: Colors.ink3, fontFamily: "monospace" as any },
  achado: { fontSize: 11, fontWeight: "700", color: Colors.green, marginTop: 2 },
  qtd: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  custo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  previa: { fontSize: 12.5, fontWeight: "600", color: Colors.ink },
  previaPeq: { fontSize: 11.5, color: Colors.ink3 },
  acaoBloco: { gap: 8 },
  avisoTxt: { fontSize: 12.5, color: Colors.amber, fontWeight: "600", lineHeight: 18 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnSec: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg3, minHeight: 44, maxWidth: 200,
  },
  mostrar: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "center", paddingHorizontal: 12 },
  mostrarTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
});
