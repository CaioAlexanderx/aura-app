// ============================================================
// AURA. — Vendas › aba Condicionais (C4 25/11, C5 26/11/2026)
//
// Mockup aprovado em 25/11 (condicional/mockup.html, tela 1). C5: a lista.
//   · Cartões: "Com clientes agora" (R$ X, "em N peças com M clientes. Ainda
//     são da loja."; o totalizador do backend, sempre das abertas, para não
//     mudar quando a lojista troca o chip), "Vencem hoje" e "Atrasadas".
//   · Chips Em aberto (padrão) · Vence hoje · Atrasadas · Concluídas, com a
//     contagem do backend (counts), e a busca.
//   · Linhas: número, cliente, peças, valor, prazo e o selo da situação
//     (petróleo tracejado "Com a cliente"; Atrasada em vermelho com os dias;
//     "Falta cobrar" com "R$ X para cobrar"). "Lembrar" nas atrasadas abre a
//     prévia do WhatsApp (LembrarCondicional).
//   · Consolidado multi-CNPJ: /me/condicionais, chips das lojas e o selo da
//     loja em cada linha. Sem criar (o botão é do C6).
//   · Estados: carregando (ListSkeleton), vazio, erro com "Tentar de novo",
//     sem resultado no chip ou na busca.
//
// Ficam para os cards deles: "Nova condicional" (C6), "Decidir"/"Ver" e o
// detalhe (C10), "Cobrar no Caixa" (C12), "Peças para resolver" (C16).
// Nenhum aparece, nem desligado. Tocar na linha chama `onAbrir` (o C10 liga
// o detalhe); sem ele, a linha não é tocável.
//
// Celular: abaixo de 900 px a tabela vira cartões; abaixo de 700 px só o
// cartão "Com clientes agora" fica (como no mockup), chips e botões com 44 px.
// Nada aparece só no hover (regra 7 do CLAUDE.md).
//
// Quem decide se a aba existe é useAbaCondicionais (trava + módulo).
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Colors, CondicionalCores as CD } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import { hojeEmSaoPaulo } from "@/components/screens/vendas/pedidos/regrasDosPedidos";
import { normalizeBrPhone } from "@/utils/whatsapp";
import { useCondicionais, type FiltroDasCondicionais, type LinhaDaCondicional } from "@/hooks/useCondicionais";
import {
  TEXTOS_DA_LISTA as L, TEXTOS_FORA_DO_MOCKUP as F, chipsDasCondicionais, mostraParcial, prazoNaTabela,
  prazoNoCartao, seloDaSituacao, somaDaSituacao, subDaLinha, subDoTotalizador, valorDaLinha,
  type Prazo, type TomDaSituacao,
} from "./regrasDasCondicionais";
import { LembrarCondicional } from "./LembrarCondicional";
import { GavetaDaCondicional } from "./detalhe/GavetaDaCondicional";
import { useNovaCondicional } from "./nova/useNovaCondicional";

export const TEXTOS_DAS_CONDICIONAIS = {
  aba: "Condicionais",
  subtitulo: "Peças que as clientes levaram para experimentar. Nada é cobrado até ela decidir.",
  vazioTitulo: "Nenhuma condicional por aqui",
  vazioTexto: "Quando uma cliente quiser levar peças para experimentar em casa, registre aqui. A loja sabe o que saiu, com quem está e até quando volta.",
};

/** Abaixo disto a lista vira cartões (celular e tablet em pé). */
export const LARGURA_DA_TABELA = 900;
/** Abaixo disto só o cartão "Com clientes agora" fica (mockup, 700 px). */
export const LARGURA_DO_CELULAR = 700;

type Props = {
  /** Observa a abertura do detalhe (a gaveta do C10 abre sozinha, por dentro da aba). */
  onAbrir?: (c: LinhaDaCondicional) => void;
};

export function AbaCondicionais({ onAbrir: aoAbrir }: Props = {}) {
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_DA_TABELA;
  const celular = width < LARGURA_DO_CELULAR;
  const [filtro, setFiltro] = useState<FiltroDasCondicionais>("em_aberto");
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [loja, setLoja] = useState<string | null>(null);
  const [lembrar, setLembrar] = useState<LinhaDaCondicional | null>(null);
  // C10: a condicional aberta na gaveta de detalhe e decisão.
  const [aberta, setAberta] = useState<LinhaDaCondicional | null>(null);
  const onAbrir = (c: LinhaDaCondicional) => { setAberta(c); if (aoAbrir) aoAbrir(c); };
  // "Nova condicional" (C6/C7): ao guardar, a lista, o totalizador e o número da aba recarregam.
  const qc = useQueryClient();
  const nova = useNovaCondicional({
    onCriada: () => { qc.invalidateQueries({ queryKey: ["condicionais"] }); },
  });

  // A busca sai 300 ms depois da última tecla (uma ida ao servidor, não uma por letra).
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const lista = useCondicionais(filtro, busca, { loja });
  // "Em aberto" sem busca: os cartões Vencem hoje e Atrasadas (R$ e peças).
  // No padrão é a mesma consulta da lista (mesma chave, uma ida só).
  const base = useCondicionais("em_aberto", "", { loja });
  // Consolidado: os chips das lojas saem de todas as lojas, mesmo com uma
  // escolhida (com company_id o por_empresa vem só com ela). Sem loja
  // escolhida, é a mesma consulta de `base` (e a do número da aba).
  const geral = useCondicionais("em_aberto", "", { enabled: !!loja });
  const todas = loja ? geral : base;

  const hoje = lista.hoje || base.hoje || hojeEmSaoPaulo();
  const mostrarLoja = lista.consolidado && (todas.lojas > 1 || lista.lojas > 1);
  const contagem = base.contagem || lista.contagem;
  const chips = chipsDasCondicionais(contagem);
  const nenhuma = !!contagem && (contagem.todas || 0) === 0 && !loja;

  if (lista.isLoading && !lista.carregou) {
    return (
      <View testID="aba-condicionais">
        <View style={s.carregando} testID="condicionais-carregando" accessibilityState={{ busy: true }}>
          <ListSkeleton rows={4} showCards={false} />
          <Text style={s.carregandoTexto}>{L.carregando}</Text>
        </View>
      </View>
    );
  }
  if (lista.error && !lista.carregou) {
    return (
      <View testID="aba-condicionais">
        <View style={s.erro} testID="condicionais-erro" accessibilityRole="alert">
          <Icon name="alert_circle" size={16} color={CD.badInk} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.erroTexto}><Text style={s.forte}>{L.erroTitulo}</Text> {L.erroTexto}</Text>
            <View style={s.erroAcoes}>
              <Button title={L.tentarDeNovo} size="sm" variant="ghost" onPress={() => { lista.refetch(); base.refetch(); }} style={s.botao} testID="condicionais-tentar" />
            </View>
          </View>
        </View>
      </View>
    );
  }
  if (nenhuma && !busca) {
    return (
      <View testID="aba-condicionais">
        <View style={s.vazio} testID="condicionais-vazio">
          <View style={s.vazioIcone}><Icon name="hanger" size={26} color={CD.cdInk} /></View>
          <Text style={s.vazioTitulo}>{TEXTOS_DAS_CONDICIONAIS.vazioTitulo}</Text>
          <Text style={s.vazioTexto}>{TEXTOS_DAS_CONDICIONAIS.vazioTexto}</Text>
          <Button title={L.nova} onPress={nova.abrir} style={s.botaoNova} testID="condicionais-nova-vazio" />
        </View>
        {nova.modal}
      </View>
    );
  }

  const totalizador = base.totalizador || lista.totalizador;
  const hojeSoma = somaDaSituacao(base.condicionais, "vence_hoje");
  const atrasadasSoma = somaDaSituacao(base.condicionais, "atrasada");
  const porEmpresa = loja ? [] : (base.porEmpresa.length ? base.porEmpresa : lista.porEmpresa);

  return (
    <View testID="aba-condicionais">
      <View style={s.topo}>
        <Button title={L.nova} onPress={nova.abrir} style={s.botaoNova} testID="condicionais-nova" />
      </View>
      {nova.modal}
      <View style={s.kpis}>
        <View style={[s.kpi, s.kpiCd]} testID="kpi-com-clientes" accessibilityLabel={totalizador?.texto}>
          <View style={s.kpiRotuloLinha}>
            <Icon name="hanger" size={14} color={CD.cdInk} />
            <Text style={[s.kpiRotulo, { color: CD.cdInk }]}>{L.kpiComClientes}</Text>
          </View>
          <Text style={s.kpiValor} testID="kpi-com-clientes-valor">{brl(totalizador?.valor || 0)}</Text>
          <Text style={s.kpiSub} testID="kpi-com-clientes-sub">{subDoTotalizador(totalizador, mostrarLoja ? porEmpresa : [])}</Text>
        </View>
        {!celular && (
          <View style={s.kpi} testID="kpi-vencem-hoje">
            <Text style={s.kpiRotulo}>{L.kpiVencemHoje}</Text>
            <Text style={s.kpiValor}>{String(contagem?.vence_hoje || 0)}</Text>
            {!!hojeSoma.texto && <Text style={s.kpiSub}>{hojeSoma.texto}</Text>}
          </View>
        )}
        {!celular && (
          <View style={s.kpi} testID="kpi-atrasadas">
            <Text style={s.kpiRotulo}>{L.kpiAtrasadas}</Text>
            <Text style={[s.kpiValor, { color: CD.badInk }]}>{String(contagem?.atrasadas || 0)}</Text>
            {!!atrasadasSoma.texto && <Text style={s.kpiSub}>{atrasadasSoma.texto}</Text>}
          </View>
        )}
      </View>

      {mostrarLoja && (
        <View style={s.chips} testID="condicionais-lojas">
          <Filtro on={!loja} onPress={() => setLoja(null)} label={L.todasAsLojas}
            contagem={todas.contagem?.em_aberto || 0} testID="loja-todas" />
          {todas.porEmpresa.map((e) => (
            <Filtro key={e.company_id} on={loja === e.company_id} onPress={() => setLoja(e.company_id)}
              label={e.company_name || ""} contagem={e.counts?.em_aberto || 0} testID={"loja-" + e.company_id} />
          ))}
        </View>
      )}

      <View style={s.ferramentas}>
        <View style={s.chips}>
          {chips.map((c) => (
            <Filtro key={c.key} on={c.key === filtro} onPress={() => setFiltro(c.key)} label={c.label} contagem={c.contagem} testID={"chip-" + c.key} />
          ))}
        </View>
        <View style={[s.busca, celular && s.buscaCheia]}>
          <Icon name="search" size={15} color={Colors.ink3} />
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={L.busca}
            placeholderTextColor={Colors.ink3}
            accessibilityLabel={L.buscaRotulo}
            style={s.buscaInput}
            testID="busca-condicionais"
          />
        </View>
      </View>

      {!lista.condicionais.length ? (
        <View style={s.semResultado} testID={busca ? "condicionais-sem-resultado-busca" : "condicionais-sem-resultado"}>
          <Text style={s.semResultadoTexto}>{busca ? F.semResultadoNaBusca : F.semResultadoNoChip}</Text>
        </View>
      ) : largo ? (
        <View style={s.tabela} testID="condicionais-tabela">
          <View style={[s.tr, s.trCab]}>
            <Text style={[s.th, s.colNum]}>{L.colNumero}</Text>
            <Text style={[s.th, s.colCliente]}>{L.colCliente}</Text>
            <Text style={[s.th, s.colValor]}>{L.colValor}</Text>
            <Text style={[s.th, s.colPrazo]}>{L.colVolta}</Text>
            <Text style={[s.th, s.colSit]}>{L.colSituacao}</Text>
            <View style={s.colAcoes} />
          </View>
          {lista.condicionais.map((c) => (
            <Linha key={c.id} c={c} hoje={hoje} mostrarLoja={mostrarLoja} onAbrir={onAbrir} onLembrar={setLembrar} />
          ))}
        </View>
      ) : (
        <View style={s.cartoes} testID="condicionais-cartoes">
          {lista.condicionais.map((c) => (
            <Cartao key={c.id} c={c} hoje={hoje} mostrarLoja={mostrarLoja} onAbrir={onAbrir} onLembrar={setLembrar} />
          ))}
        </View>
      )}

      <LembrarCondicional linha={lembrar} onClose={() => setLembrar(null)} />
      {!!aberta && (
        <GavetaDaCondicional key={aberta.id} linha={aberta} hoje={hoje} mostrarLoja={mostrarLoja} onClose={() => setAberta(null)} />
      )}
    </View>
  );
}

function Filtro({ on, onPress, label, contagem, testID }: { on: boolean; onPress: () => void; label: string; contagem?: number; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]} testID={testID}>
      <Text style={[s.chipTexto, on && s.chipTextoOn]}>{label}</Text>
      {contagem !== undefined && <Text style={[s.chipNum, on && s.chipTextoOn]}>{contagem}</Text>}
    </Pressable>
  );
}

const TONS: Record<TomDaSituacao, { bg: string; ink: string; line: string; dashed?: boolean }> = {
  bad: { bg: CD.badBg, ink: CD.badInk, line: CD.badLine },
  warn: { bg: CD.warnBg, ink: CD.warnInk, line: CD.warnLine },
  ok: { bg: CD.okBg, ink: CD.okInk, line: CD.okLine },
  cd: { bg: CD.cdBg, ink: CD.cdInk, line: CD.cdLine, dashed: true },
  fc: { bg: CD.fcBg, ink: CD.fcInk, line: CD.fcLine },
  mut: { bg: Colors.bg4, ink: Colors.ink2, line: Colors.border },
};

export function SeloDaSituacao({ situacao }: { situacao: string }) {
  const { label, tom } = seloDaSituacao(situacao);
  const t = TONS[tom];
  return (
    <View style={[s.selo, { backgroundColor: t.bg, borderColor: t.line }, t.dashed && s.tracejado]} testID={"selo-" + situacao}>
      {tom === "cd" && <Icon name="hanger" size={13} color={t.ink} />}
      {tom === "fc" && <Icon name="coin" size={13} color={CD.fcIc} />}
      <Text style={[s.seloTexto, { color: t.ink }]}>{label}</Text>
    </View>
  );
}

function SeloMudo({ children, icone, testID }: { children: string; icone?: string; testID?: string }) {
  const t = TONS.mut;
  return (
    <View style={[s.selo, { backgroundColor: t.bg, borderColor: t.line }]} testID={testID}>
      {!!icone && <Icon name={icone} size={13} color={t.ink} />}
      <Text style={[s.seloTexto, { color: t.ink }]}>{children}</Text>
    </View>
  );
}

/**
 * O valor da linha. Concluída com venda: o mockup mostra o valor do que ficou,
 * que a lista do backend ainda não traz (card C18): fica sem valor, nunca "—".
 * Concluída sem venda (tudo devolvido): "—" na tabela e "Sem venda" no cartão,
 * como no mockup.
 */
function textoDoValor(c: LinhaDaCondicional, valor: number, semVenda: string): string {
  if (valor) return brl(valor);
  if (c.situacao === "concluida") return (Number(c.pecas_ficou) || 0) > 0 ? "" : semVenda;
  return "—";
}

/**
 * Selo da loja no consolidado: UMA linha, reticências no fim; o nome inteiro
 * no title (web) e no toque longo. A linha da lista nunca cresce por causa dele.
 */
export function SeloDaLoja({ nome, testID }: { nome: string; testID?: string }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = ref.current;
    if (el && typeof el.setAttribute === "function") el.setAttribute("title", nome);
  }, [nome]);
  const t = TONS.mut;
  return (
    <Pressable
      ref={ref}
      onLongPress={() => toast.info(nome)}
      accessibilityLabel={nome}
      style={[s.selo, s.seloLoja, { backgroundColor: t.bg, borderColor: t.line }]}
      testID={testID}
    >
      <Icon name="store" size={13} color={t.ink} />
      <Text style={[s.seloTexto, s.seloLojaTexto, { color: t.ink }]} numberOfLines={1} ellipsizeMode="tail">{nome}</Text>
    </Pressable>
  );
}

function corDoPrazo(p: Prazo): any {
  if (p.tom === "bad") return { color: CD.badInk, fontWeight: "700" };
  if (p.tom === "warn") return { color: CD.warnInk, fontWeight: "700" };
  if (p.tom === "fc") return { color: CD.fcInk, fontWeight: "700" };
  return null;
}

/** "Lembrar" só na atrasada com telefone que dê para usar. */
function podeLembrar(c: LinhaDaCondicional): boolean {
  return c.situacao === "atrasada" && !!normalizeBrPhone(c.customer_phone);
}

type LinhaProps = {
  c: LinhaDaCondicional;
  hoje: string;
  mostrarLoja: boolean;
  onAbrir?: (c: LinhaDaCondicional) => void;
  onLembrar: (c: LinhaDaCondicional) => void;
};

function Tocavel({ onAbrir, c, style, testID, children }: { onAbrir?: (c: LinhaDaCondicional) => void; c: LinhaDaCondicional; style: any; testID: string; children: React.ReactNode }) {
  if (!onAbrir) return <View style={style} testID={testID}>{children}</View>;
  return (
    <Pressable style={style} onPress={() => onAbrir(c)} accessibilityRole="button" testID={testID}>
      {children}
    </Pressable>
  );
}

function Linha({ c, hoje, mostrarLoja, onAbrir, onLembrar }: LinhaProps) {
  const prazo = prazoNaTabela(c, hoje);
  const valor = valorDaLinha(c);
  return (
    <Tocavel onAbrir={onAbrir} c={c} style={s.tr} testID={"condicional-" + c.id}>
      <Text style={[s.cod, s.colNum]}>{c.numero_exibicao}</Text>
      <View style={s.colCliente}>
        <View style={s.nomeLinha}>
          <Text style={s.nome} numberOfLines={1}>{c.customer_name || ""}</Text>
          {mostrarLoja && !!c.company_name && <SeloDaLoja nome={c.company_name} testID={"loja-da-linha-" + c.id} />}
        </View>
        <Text style={s.sub} numberOfLines={2}>{subDaLinha(c)}</Text>
      </View>
      <Text style={[s.valor, s.colValor]} testID={"valor-" + c.id}>{textoDoValor(c, valor, "—")}</Text>
      <View style={s.colPrazo} testID={"prazo-" + c.id}>
        {!!prazo.texto && <Text style={[s.prazo, corDoPrazo(prazo)]} numberOfLines={1}>{prazo.texto}</Text>}
        {!!prazo.sub && <Text style={s.sub}>{prazo.sub}</Text>}
      </View>
      <View style={[s.colSit, s.selos]}>
        <SeloDaSituacao situacao={String(c.situacao)} />
        {mostraParcial(c) && <SeloMudo testID={"parcial-" + c.id}>{L.parcial}</SeloMudo>}
      </View>
      <View style={[s.colAcoes, s.acoes]}>
        {podeLembrar(c) && (
          <Button title={L.lembrar} icon="whatsapp" size="sm" variant="ghost" onPress={() => onLembrar(c)} style={s.botao} testID={"lembrar-" + c.id} />
        )}
      </View>
    </Tocavel>
  );
}

function Cartao({ c, hoje, mostrarLoja, onAbrir, onLembrar }: LinhaProps) {
  const prazo = prazoNoCartao(c, hoje);
  const valor = valorDaLinha(c);
  return (
    <Tocavel onAbrir={onAbrir} c={c} style={s.cartao} testID={"condicional-" + c.id}>
      <View style={s.r1}>
        <Text style={s.nomeCartao} numberOfLines={1}>{c.customer_name || ""}</Text>
        <Text style={s.cod}>{c.numero_exibicao}</Text>
        <View style={s.r1Selo}>
          <SeloDaSituacao situacao={String(c.situacao)} />
          {mostraParcial(c) && <SeloMudo testID={"parcial-" + c.id}>{L.parcial}</SeloMudo>}
        </View>
      </View>
      <Text style={s.r2}>
        {subDaLinha(c)}
        {mostrarLoja && !!c.company_name && <Text> · <Text style={s.forte} testID={"loja-da-linha-" + c.id}>{c.company_name}</Text></Text>}
      </Text>
      <View style={s.r3} testID={"prazo-" + c.id}>
        {!!textoDoValor(c, valor, L.semVenda) && <Text style={s.valorCartao} testID={"valor-" + c.id}>{textoDoValor(c, valor, L.semVenda)}</Text>}
        <Text style={s.prazo}>
          <Text style={corDoPrazo(prazo)}>{prazo.texto}</Text>
          {prazo.sub ? " · " + prazo.sub : ""}
        </Text>
      </View>
      {podeLembrar(c) && (
        <View style={s.acoesCartao}>
          <Button title={L.lembrar} icon="whatsapp" size="sm" variant="ghost" onPress={() => onLembrar(c)} style={[s.botao, { flex: 1 }]} testID={"lembrar-" + c.id} />
        </View>
      )}
    </Tocavel>
  );
}

const s = StyleSheet.create({
  forte: { fontWeight: "700", color: Colors.ink },
  // Cartões do topo (mockup .sum: 1.5fr 1fr 1fr)
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  kpi: { flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bg3 },
  kpiCd: { flexGrow: 1.5, flexBasis: 240, borderStyle: "dashed", borderColor: CD.cdLine, backgroundColor: CD.cdBg },
  kpiRotuloLinha: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiRotulo: { fontSize: 12.5, color: Colors.ink3, fontWeight: "600" },
  kpiValor: { fontSize: 24, color: Colors.ink, fontWeight: "700", marginTop: 2, fontFamily: Fonts.mono as any },
  kpiSub: { fontSize: 12.5, color: Colors.ink3 },
  // Filtros
  ferramentas: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 0 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 13, borderRadius: 99, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  chipOn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipTexto: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  chipTextoOn: { color: Colors.bg3 },
  chipNum: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  busca: { flexGrow: 1, flexShrink: 1, flexBasis: 220, maxWidth: 320, marginLeft: "auto" as any, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  buscaCheia: { flexBasis: "100%" as any, maxWidth: "100%" as any, marginLeft: 0 },
  buscaInput: { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink, paddingVertical: 8 },
  // Tabela (mockup .tr: 74px minmax(170px,1fr) 100px 150px 134px; ações só com Lembrar)
  tabela: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden", backgroundColor: Colors.bg3 },
  tr: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  trCab: { borderTopWidth: 0, paddingVertical: 10, backgroundColor: Colors.bg4 },
  th: { fontSize: 12, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  colNum: { width: 74 },
  colCliente: { flex: 1, minWidth: 170 },
  colValor: { width: 100 },
  colPrazo: { width: 150 },
  colSit: { width: 134 },
  colAcoes: { width: 120 },
  cod: { fontSize: 12.5, color: Colors.ink2, fontFamily: Fonts.mono as any },
  nomeLinha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap", minWidth: 0 },
  nome: { fontSize: 14, fontWeight: "700", color: Colors.ink, flexShrink: 1, minWidth: 0 },
  sub: { fontSize: 12.5, color: Colors.ink3, marginTop: 1 },
  valor: { fontSize: 13.5, fontWeight: "700", color: Colors.ink, fontFamily: Fonts.mono as any },
  prazo: { fontSize: 13, color: Colors.ink2 },
  selos: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  selo: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 22, paddingHorizontal: 9, paddingVertical: 1, borderRadius: 99, borderWidth: 1, alignSelf: "flex-start" },
  tracejado: { borderStyle: "dashed" },
  seloLoja: { flexShrink: 1, minWidth: 0, maxWidth: "60%" as any },
  seloLojaTexto: { flexShrink: 1, minWidth: 0 },
  seloTexto: { fontSize: 12, fontWeight: "700" },
  acoes: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 6 },
  botao: { minHeight: 44 },
  // Cartões (celular)
  cartoes: { gap: 10 },
  cartao: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3, padding: 14 },
  r1: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nomeCartao: { fontSize: 15, fontWeight: "700", color: Colors.ink, flexShrink: 1 },
  r1Selo: { marginLeft: "auto" as any, flexDirection: "row", gap: 4, flexWrap: "wrap" },
  r2: { fontSize: 13, color: Colors.ink2, marginTop: 4 },
  r3: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginTop: 6 },
  valorCartao: { fontSize: 15, fontWeight: "700", color: Colors.ink, fontFamily: Fonts.mono as any },
  acoesCartao: { flexDirection: "row", gap: 8, marginTop: 10 },
  // Estados
  carregando: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3, padding: 16, gap: 12 },
  carregandoTexto: { fontSize: 12.5, color: Colors.ink3 },
  erro: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: CD.badLine, backgroundColor: CD.badBg },
  erroTexto: { fontSize: 13, lineHeight: 19, color: Colors.ink },
  erroAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  topo: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 },
  botaoNova: { minHeight: 44 },
  vazio: { alignItems: "center", gap: 10, paddingVertical: 44, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3 },
  vazioIcone: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: CD.cdBg, borderWidth: 1, borderStyle: "dashed", borderColor: CD.cdLine },
  vazioTitulo: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  vazioTexto: { fontSize: 13.5, lineHeight: 20, color: Colors.ink2, textAlign: "center", maxWidth: 460 },
  semResultado: { alignItems: "center", paddingVertical: 22, paddingHorizontal: 20, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 14, backgroundColor: Colors.bg3 },
  semResultadoTexto: { fontSize: 13, color: Colors.ink2, textAlign: "center" },
});

export default AbaCondicionais;
