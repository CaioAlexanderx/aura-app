// ============================================================
// Quadro do Financeiro (28/09/2026) — Kanban dos lançamentos do mês.
//
// Colunas: Atrasado · A receber · Recebido (A pagar · Pago nas despesas),
// decisão do Caio em 28/09. Web arrasta (hooks da fila do Studio); celular
// usa o botão do cartão. Crediário fica fora nesta fase; vendas do Caixa e
// taxas da maquininha entram agrupadas por dia em Recebido/Pago.
// Só em empresa individual — o consolidado não tem o endpoint.
// ============================================================
import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { toast } from "@/components/Toast";
import { useStudioKanbanDnD, useDropZoneRef } from "@/components/studio/kanban/useStudioKanbanDnD";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { todayLocalString } from "@/utils/dateOnly";
import { fmt } from "@/components/screens/financeiro/types";
import { useQuadroFinanceiro } from "@/hooks/useQuadroFinanceiro";
import {
  ORDEM_DAS_COLUNAS, ddmm, motivoDoBloqueio, movimento, nomeDoMes, rotulos, somarMes,
  type CartaoQuadro, type ColunaDados, type ColunaQuadro, type Movimento, type Quadro, type TipoQuadro,
} from "@/utils/quadroFinanceiro";
import { QuadroCartao } from "./QuadroCartao";
import { MoverSheet, type AlvoDoMovimento } from "./MoverSheet";

const COR_DA_COLUNA: Record<ColunaQuadro, string> = { atrasado: Colors.red, aberto: Colors.amber, feito: Colors.green };

function acharColuna(q: Quadro | undefined, id: string | null): { coluna: ColunaQuadro; cartao: CartaoQuadro } | null {
  if (!q || !id) return null;
  for (const k of ORDEM_DAS_COLUNAS) {
    const c = q.columns[k].items.find((x) => x.id === id);
    if (c) return { coluna: k, cartao: c };
  }
  return null;
}

export function QuadroFinanceiro({ companyId }: { companyId: string }) {
  const [tipo, setTipo] = useState<TipoQuadro>("income");
  const [mes, setMes] = useState(() => todayLocalString().slice(0, 7));
  const [alvo, setAlvo] = useState<AlvoDoMovimento>(null);
  const { quadro, carregando, erro, recarregar, mover } = useQuadroFinanceiro(companyId, tipo, mes);
  const { m } = useValoresOcultos();
  const { width } = useWindowDimensions();
  const largo = width >= 760;
  const r = rotulos(tipo);
  const hoje = quadro?.today || todayLocalString();

  const abrirMovimento = useCallback((cartao: CartaoQuadro, de: ColunaQuadro, mov: Movimento) => {
    const bloqueio = motivoDoBloqueio(de, mov === "baixa" ? "feito" : "aberto", cartao.movable);
    if (bloqueio) { toast.info(bloqueio); return; }
    setAlvo({ cartao, mov });
  }, []);

  const aoSoltar = useCallback((id: string, para: ColunaQuadro) => {
    const achado = acharColuna(quadro, id);
    if (!achado || achado.coluna === para) return;
    const bloqueio = motivoDoBloqueio(achado.coluna, para, achado.cartao.movable);
    if (bloqueio) { toast.info(bloqueio); return; }
    const mov = movimento(achado.coluna, para);
    if (mov) setAlvo({ cartao: achado.cartao, mov });
  }, [quadro]);

  const dnd = useStudioKanbanDnD<ColunaQuadro>(aoSoltar);
  const origem = useMemo(() => acharColuna(quadro, dnd.draggingId)?.coluna || null, [quadro, dnd.draggingId]);

  const col = quadro?.columns;
  const soma = col ? col.atrasado.total + col.aberto.total + col.feito.total : 0;

  return (
    <View style={s.wrap} testID="quadro-financeiro">
      <View style={s.topo}>
        <View style={s.seg} accessibilityRole="tablist">
          {(["income", "expense"] as TipoQuadro[]).map((t) => (
            <Pressable key={t} onPress={() => setTipo(t)} style={[s.segBtn, tipo === t && s.segAtivo]}
              accessibilityRole="tab" accessibilityState={{ selected: tipo === t }} testID={"quadro-tipo-" + t}>
              <Text style={[s.segTxt, tipo === t && s.segTxtAtivo]}>{rotulos(t).titulo}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.mesNav}>
          <Pressable onPress={() => setMes(somarMes(mes, -1))} style={s.mesBtn} accessibilityLabel="Mês anterior"><Text style={s.mesSeta}>‹</Text></Pressable>
          <Text style={s.mesTxt}>{nomeDoMes(mes)}</Text>
          <Pressable onPress={() => setMes(somarMes(mes, 1))} style={s.mesBtn} accessibilityLabel="Próximo mês"><Text style={s.mesSeta}>›</Text></Pressable>
        </View>
      </View>

      {col && (
        <View style={{ gap: 8 }}>
          <View style={s.resumo}>
            <Text style={s.resumoItem}>{r.feito} <Text style={s.resumoNum}>{m(fmt(col.feito.total))}</Text></Text>
            <Text style={s.resumoItem}>{r.aberto} <Text style={s.resumoNum}>{m(fmt(col.aberto.total))}</Text></Text>
            <Text style={s.resumoItem}>Atrasado <Text style={s.resumoNum}>{m(fmt(col.atrasado.total))}</Text></Text>
          </View>
          <View style={s.barra}>
            {soma > 0 && (["feito", "aberto", "atrasado"] as ColunaQuadro[]).map((k) => (
              <View key={k} style={{ width: (col[k].total / soma * 100) + "%" as any, backgroundColor: COR_DA_COLUNA[k] }} />
            ))}
          </View>
          <Text style={s.dica}>
            {dnd.isWeb ? "Arraste o cartão quando o dinheiro " + (tipo === "income" ? "entrar" : "sair") + ". " : ""}
            O que vence e não é {r.verbo} passa sozinho para Atrasado. Crediário fica na tela do Crediário.
          </Text>
        </View>
      )}

      {carregando && <ActivityIndicator color={Colors.violet} style={{ marginVertical: 40 }} />}
      {erro && !carregando && (
        <Pressable onPress={() => recarregar()} style={s.erro}>
          <Text style={s.erroTxt}>Não deu para carregar o quadro. Toque para tentar de novo.</Text>
        </Pressable>
      )}

      {col && (
        <View style={[s.board, largo ? s.boardLargo : null]}>
          {ORDEM_DAS_COLUNAS.map((k) => (
            <QuadroColuna
              key={k}
              chave={k}
              nome={r[k]}
              dados={col[k]}
              tipo={tipo}
              hoje={hoje}
              mes={mes}
              largo={largo}
              arrastavel={dnd.isWeb}
              arrastandoId={dnd.draggingId}
              aceita={!!origem && !!movimento(origem, k)}
              recusa={!!origem && k === "atrasado" && origem !== "atrasado"}
              emFoco={dnd.hoverStatus === k}
              limite={quadro?.limit_per_column || 150}
              onDrop={dnd.onDrop}
              onHover={dnd.onHoverChange}
              onInicio={dnd.onCardDragStart}
              onFim={dnd.onCardDragEnd}
              onAcao={abrirMovimento}
            />
          ))}
        </View>
      )}

      <MoverSheet
        alvo={alvo}
        tipo={tipo}
        hoje={hoje}
        onFechar={() => setAlvo(null)}
        onConfirmar={(dados) => {
          if (alvo) mover({ id: alvo.cartao.id, mov: alvo.mov, data: dados.data, forma: dados.forma });
          setAlvo(null);
        }}
      />
    </View>
  );
}

function QuadroColuna(p: {
  chave: ColunaQuadro; nome: string; dados: ColunaDados; tipo: TipoQuadro; hoje: string; mes: string;
  largo: boolean; arrastavel: boolean; arrastandoId: string | null; aceita: boolean; recusa: boolean; emFoco: boolean; limite: number;
  onDrop: (id: string, para: ColunaQuadro) => void; onHover: (k: ColunaQuadro | null) => void;
  onInicio: (id: string) => void; onFim: () => void;
  onAcao: (c: CartaoQuadro, de: ColunaQuadro, mov: Movimento) => void;
}) {
  const ref = useDropZoneRef<ColunaQuadro>(p.chave, p.onDrop, p.onHover);
  const { m } = useValoresOcultos();
  const nota = p.chave === "atrasado" ? "Entra sozinho quando vence"
    : p.chave === "aberto" ? (p.mes < p.hoje.slice(0, 7) ? "Mês passado: o que ficou aberto está em Atrasado" : "Vence em " + nomeDoMes(p.mes).split(" ")[0].toLowerCase())
    : (p.tipo === "income" ? "Entrou" : "Saiu") + " em " + nomeDoMes(p.mes).split(" ")[0].toLowerCase();
  const cortado = p.dados.count > p.dados.items.length + (p.dados.grupos || []).reduce((a, g) => a + g.count, 0);
  const vazio = !p.dados.items.length && !(p.dados.grupos || []).length;

  return (
    <View ref={ref} style={[s.coluna, p.largo && s.colunaLarga, p.aceita && p.emFoco && s.colunaFoco, p.recusa && s.colunaRecusa]} testID={"quadro-coluna-" + p.chave}>
      <View style={s.colTopo}>
        <View style={s.colTitulo}>
          <View style={[s.ponto, { backgroundColor: COR_DA_COLUNA[p.chave] }]} />
          <Text style={s.colNome}>{p.nome}</Text>
          <Text style={s.colQtd}>{p.dados.count}</Text>
        </View>
        <Text style={s.colTotal}>{m(fmt(p.dados.total))}</Text>
        <Text style={s.colNota}>{nota}</Text>
      </View>
      {p.recusa && <Text style={s.recusaTxt}>Atrasado é pela data de vencimento. Não dá para arrastar para cá.</Text>}
      {p.dados.items.map((c) => (
        <QuadroCartao
          key={c.id}
          cartao={c}
          coluna={p.chave}
          tipo={p.tipo}
          hoje={p.hoje}
          mes={p.mes}
          arrastavel={p.arrastavel}
          arrastando={p.arrastandoId === c.id}
          onInicio={p.onInicio}
          onFim={p.onFim}
          onAcao={p.onAcao}
        />
      ))}
      {(p.dados.grupos || []).map((g) => (
        <View key={g.date + g.origem} style={[s.card, s.grupo]}>
          <View style={s.grupoLinha}>
            <Text style={s.grupoDesc}>{g.origem === "caixa" ? "Vendas do Caixa" : "Taxas da maquininha"} · {ddmm(g.date)}</Text>
            <Text style={s.grupoValor}>{m(fmt(g.total))}</Text>
          </View>
          <Text style={s.grupoMeta}>{g.count} {g.origem === "caixa" ? (g.count === 1 ? "venda" : "vendas") : (g.count === 1 ? "taxa" : "taxas")}</Text>
        </View>
      ))}
      {cortado && <Text style={s.colNota}>Mostrando os {p.limite} primeiros. Use a lista para ver todos.</Text>}
      {vazio && <Text style={s.vazio}>{p.chave === "atrasado" ? "Nada atrasado." : "Nenhum lançamento."}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 14 },
  topo: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 },
  seg: { flexDirection: "row", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 3 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7 },
  segAtivo: { backgroundColor: Colors.violetD },
  segTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  segTxtAtivo: { color: Colors.violet3 },
  mesNav: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10 },
  mesBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  mesSeta: { fontSize: 18, color: Colors.ink2 },
  mesTxt: { minWidth: 124, textAlign: "center", fontSize: 13, fontWeight: "600", color: Colors.ink },
  resumo: { flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 4 },
  resumoItem: { fontSize: 12.5, color: Colors.ink3 },
  resumoNum: { fontFamily: Fonts.mono, color: Colors.ink, fontWeight: "500" },
  barra: { height: 8, borderRadius: 99, overflow: "hidden", flexDirection: "row", backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  dica: { fontSize: 12, color: Colors.ink3 },
  erro: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  erroTxt: { color: Colors.ink2, fontSize: 13 },
  board: { gap: 14 },
  boardLargo: { flexDirection: "row", alignItems: "flex-start" },
  coluna: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 12, gap: 10 },
  colunaLarga: { flex: 1, minWidth: 0, minHeight: 320 },
  colunaFoco: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  colunaRecusa: { borderStyle: "dashed" },
  colTopo: { gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  colTitulo: { flexDirection: "row", alignItems: "center", gap: 8 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  colNome: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase", color: Colors.ink2 },
  colQtd: { marginLeft: "auto", fontFamily: Fonts.mono, fontSize: 12, color: Colors.ink3 },
  colTotal: { fontFamily: Fonts.heading, fontSize: 26, color: Colors.ink },
  colNota: { fontSize: 11.5, color: Colors.ink3 },
  recusaTxt: { fontSize: 11.5, color: Colors.ink3, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 10, padding: 10, textAlign: "center" },
  vazio: { fontSize: 12, color: Colors.ink3, paddingVertical: 8, paddingHorizontal: 4 },
  card: { backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  grupo: { borderStyle: "dashed", gap: 4 },
  grupoLinha: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  grupoDesc: { flex: 1, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  grupoValor: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.ink },
  grupoMeta: { fontSize: 11, color: Colors.ink3 },
});
