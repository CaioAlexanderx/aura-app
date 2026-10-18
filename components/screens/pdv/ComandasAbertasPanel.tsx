// ============================================================
// AURA. — Comandas do Caixa: o painel das abertas (17/10/2026, tc-02)
//
// Mockup aprovado pelo Caio em 17/10: docs/mockups/comandas-abertas.html.
//
// O botão "Comandas (N)" do rodapé do carrinho abre este painel: gaveta à
// direita no computador, folha de baixo no celular. Cada comanda mostra
// número, nome, há quanto tempo está aberta, nº de itens e total, com duas
// ações sempre visíveis (nada de hover: o toque funciona igual):
//   · Cobrar      — abre a conferência de sempre (taxa, imprimir, tirar
//                   item) já com essa comanda; dali o "Cobrar" leva ao
//                   carrinho (useComandaNoCaixa.cobrar);
//   · Lançar mais — manda o carrinho para essa comanda (modal de lançar já
//                   com o número e o nome). Carrinho vazio: o hook fecha o
//                   painel e lembra de adicionar os produtos primeiro.
// Âmbar a partir de 3 h aberta (fixo). Ordem padrão: mais antigas primeiro.
//
// 17/10/2026 (tc-04): comanda com parte já cobrada (alguém pagou alguns
// itens e foi embora) ganha a etiqueta "Parcial" e mostra o que resta e o
// que já foi pago — a lojista não precisa lembrar. Vem do backend
// (`parcial`, `paid_subtotal`, migration 392); sem ele, nada muda.
//
// A lista é a mesma do react-query dos modais (chaveDasComandas) e se
// atualiza ao abrir e a cada 30 s com o painel aberto (dois caixas na
// mesma loja). A comanda é sempre da empresa aberta no Caixa: o backend
// filtra por company_id, então o consolidado multi-CNPJ não muda nada aqui.
//
// No web o overlay vai para o document.body (WebPortal): dentro do shell o
// z-index:0 do RNW prende o overlay atrás do topbar.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { comandaApi, type ComandaResumo } from "@/services/comandaApi";
import { chaveDasComandas } from "@/components/screens/pdv/ComandaModals";
import {
  minutosAberta, tempoDaComanda, comandaVelha, ordenarComandas, filtrarComandas,
  nomeDaComanda, type OrdemDasComandas,
} from "@/utils/comanda";

/** Com o painel aberto a lista se atualiza neste intervalo. */
export const ATUALIZA_PAINEL_MS = 30000;

/** Abaixo disto o painel vira folha de baixo (celular). */
const LARGURA_DA_GAVETA = 768;

function fmt(v: number): string {
  return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * As abertas da empresa. Mesma chave dos modais: lançar, cobrar, tirar item
 * ou cancelar invalidam uma vez e todo mundo (badge, painel, fichas) vê.
 * `refetchMs` só com o painel aberto.
 */
export function useComandasAbertas(companyId: string | null | undefined, enabled: boolean, refetchMs?: number | false) {
  return useQuery({
    queryKey: chaveDasComandas(companyId || ""),
    queryFn: () => comandaApi.listOpen(companyId as string),
    enabled: enabled && !!companyId,
    staleTime: 0,
    refetchInterval: refetchMs || false,
  });
}

function atualizadoHa(dataUpdatedAt: number | undefined, agora: number): string {
  if (!dataUpdatedAt) return "Atualizando…";
  const min = Math.floor((agora - dataUpdatedAt) / 60000);
  return min < 1 ? "Atualizado agora" : "Atualizado há " + min + " min";
}

type Props = {
  visible: boolean;
  companyId: string;
  /** Linhas no carrinho: com itens o botão vira "Lançar N itens". */
  cartItemCount: number;
  onClose: () => void;
  onCobrar: (c: ComandaResumo) => void;
  onLancar: (c: ComandaResumo) => void;
};

export function ComandasAbertasPanel(props: Props) {
  if (!props.visible) return null;
  return <PainelAberto {...props} />;
}

function PainelAberto(props: Props) {
  const { companyId, cartItemCount, onClose, onCobrar, onLancar } = props;
  const { width } = useWindowDimensions();
  const gaveta = width >= LARGURA_DA_GAVETA;
  const q = useComandasAbertas(companyId, true, ATUALIZA_PAINEL_MS);
  const [ordem, setOrdem] = useState<OrdemDasComandas>("antigas");
  const [busca, setBusca] = useState("");
  // O "há quanto tempo" anda sozinho com o painel aberto.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(function () {
    const t = setInterval(function () { setAgora(Date.now()); }, ATUALIZA_PAINEL_MS);
    return function () { clearInterval(t); };
  }, []);
  useEffect(function () { setAgora(Date.now()); }, [q.dataUpdatedAt]);

  // Esc fecha (computador).
  useEffect(function () {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    function tecla(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", tecla);
    return function () { window.removeEventListener("keydown", tecla); };
  }, [onClose]);

  const todas = q.data?.comandas || [];
  const lista = useMemo(function () {
    return filtrarComandas(ordenarComandas(todas, ordem), busca);
  }, [todas, ordem, busca]);
  const aReceber = todas.reduce(function (s, c) { return s + (Number(c.subtotal) || 0); }, 0);

  const cabecalho = (
    <View style={[s.head, !gaveta && s.headSheet]}>
      <View style={s.hIcon}><Icon name="clipboard" size={16} color={Colors.violet3} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title}>Comandas abertas</Text>
        <Text style={s.sub} testID="painel-comandas-resumo">
          {todas.length > 0
            ? <><Text style={s.subB}>{todas.length}</Text>{todas.length === 1 ? " aberta · " : " abertas · "}<Text style={s.subB}>{fmt(aReceber)}</Text> a receber</>
            : (q.isLoading ? "Carregando…" : "Nenhuma aberta")}
        </Text>
      </View>
      <Pressable onPress={onClose} hitSlop={10} style={s.x} accessibilityLabel="Fechar o painel das comandas" testID="painel-comandas-fechar">
        <Icon name="x" size={16} color={Colors.ink3} />
      </Pressable>
    </View>
  );

  const ferramentas = todas.length > 0 ? (
    <View style={[s.tools, !gaveta && s.toolsSheet]}>
      <View style={s.busca}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          testID="painel-comandas-busca"
          value={busca}
          onChangeText={setBusca}
          placeholder={gaveta ? "Buscar por número ou nome" : "Número ou nome"}
          placeholderTextColor={Colors.ink3}
          style={s.buscaInput}
        />
      </View>
      <View style={s.seg}>
        {([["antigas", "Mais antigas"], ["numero", "Número"]] as const).map(function ([k, rot]) {
          const on = ordem === k;
          return (
            <Pressable
              key={k}
              testID={"painel-comandas-ordem-" + k}
              onPress={function () { setOrdem(k); }}
              style={[s.segBtn, !gaveta && s.segBtnSheet, on && s.segOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.segTxt, on && { color: "#fff" }]}>{rot}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  let corpo: React.ReactNode;
  if (q.isLoading && todas.length === 0) {
    corpo = <View style={s.vazio}><ActivityIndicator color={Colors.violet3} /></View>;
  } else if (q.isError && todas.length === 0) {
    corpo = (
      <View style={s.vazio} testID="painel-comandas-erro">
        <Text style={s.vazioTxt}>Não deu para carregar as comandas.</Text>
        <Pressable onPress={function () { q.refetch(); }} style={[s.bSec, { marginTop: 12, flex: 0, paddingHorizontal: 16 }]}>
          <Text style={s.bSecTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (todas.length === 0) {
    corpo = (
      <View style={s.vazio} testID="painel-comandas-vazio">
        <Text style={s.vazioTxt}>Nenhuma comanda aberta agora.</Text>
        <Text style={s.vazioTxt}>Para abrir, adicione produtos ao carrinho e toque em <Text style={s.vazioB}>Adicionar à comanda</Text>.</Text>
      </View>
    );
  } else if (lista.length === 0) {
    corpo = (
      <View style={s.vazio} testID="painel-comandas-sem-resultado">
        <Text style={s.vazioTxt}>Nenhuma comanda com “{busca.trim()}”.</Text>
      </View>
    );
  } else {
    corpo = (
      <View style={[s.lista, gaveta && s.listaGrade]}>
        {lista.map(function (c) {
          return (
            <Cartao
              key={c.id}
              c={c}
              agora={agora}
              gaveta={gaveta}
              cartItemCount={cartItemCount}
              onCobrar={onCobrar}
              onLancar={onLancar}
            />
          );
        })}
      </View>
    );
  }

  const rodape = (
    <View style={[s.foot, !gaveta && s.footSheet]}>
      <Text style={s.footTxt} testID="painel-comandas-atualizado">{atualizadoHa(q.dataUpdatedAt, agora)}</Text>
      <Text style={s.footTxt}>Comanda nova: carrinho › Adicionar à comanda</Text>
    </View>
  );

  const painel = (
    <View style={s.overlay} testID="painel-comandas">
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar o painel das comandas" />
      <View
        style={gaveta ? s.drawer : s.sheet}
        testID={gaveta ? "painel-comandas-gaveta" : "painel-comandas-folha"}
        accessibilityRole={"dialog" as any}
        accessibilityLabel="Comandas abertas"
      >
        {!gaveta && <View style={s.grab} />}
        {cabecalho}
        {ferramentas}
        <ScrollView style={gaveta ? s.scrollGaveta : s.scrollFolha} contentContainerStyle={gaveta ? s.listaPad : s.listaPadSheet} keyboardShouldPersistTaps="handled">
          {corpo}
        </ScrollView>
        {rodape}
      </View>
    </View>
  );

  if (Platform.OS === "web") return <WebPortal active>{painel}</WebPortal>;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {painel}
    </Modal>
  );
}

function Cartao(props: {
  c: ComandaResumo; agora: number; gaveta: boolean; cartItemCount: number;
  onCobrar: (c: ComandaResumo) => void; onLancar: (c: ComandaResumo) => void;
}) {
  const { c, agora, gaveta, cartItemCount } = props;
  const min = minutosAberta(c.opened_at, agora);
  const velha = comandaVelha(min);
  const nome = nomeDaComanda(c.name);
  const itens = Number(c.items_count) || 0;
  const parcial = c.parcial === true;
  const lancar = cartItemCount > 0
    ? "Lançar " + cartItemCount + " " + (cartItemCount === 1 ? "item" : "itens")
    : "Lançar mais";
  return (
    <View style={[s.cmd, gaveta && s.cmdGrade, (velha || parcial) && s.cmdVelha]} testID={"painel-comanda-" + c.number}>
      <View style={s.cTop}>
        <View style={[s.num, !gaveta && s.numSheet]}>
          <Text style={[s.numTxt, !gaveta && { fontSize: 19 }]}>{c.number}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.nome, !nome && s.nomeSem]} numberOfLines={1} testID={"painel-comanda-nome-" + c.number}>
            {nome || "sem nome"}
          </Text>
          <View style={s.meta}>
            {min != null && (
              <>
                <Text style={[s.metaTxt, velha && s.metaAlerta]} testID={"painel-comanda-tempo-" + c.number}>{tempoDaComanda(min)}</Text>
                <Text style={s.metaTxt}>·</Text>
              </>
            )}
            <Text style={s.metaTxt}>{itens} {itens === 1 ? "item" : "itens"}</Text>
            {parcial && (
              <View style={s.tagParcial} testID={"painel-comanda-parcial-" + c.number}>
                <Text style={s.tagParcialTxt}>Parcial</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.total}>{fmt(c.subtotal)}</Text>
          {parcial && (
            <Text style={s.jaPago} testID={"painel-comanda-pago-" + c.number}>já pago {fmt(c.paid_subtotal || 0)}</Text>
          )}
        </View>
      </View>
      <View style={s.cAct}>
        <Pressable
          testID={"painel-comanda-lancar-" + c.number}
          onPress={function () { props.onLancar(c); }}
          style={[s.bSec, !gaveta && s.bTouch]}
          accessibilityRole="button"
          accessibilityLabel={lancar + " na comanda " + c.number}
        >
          <Icon name="plus" size={14} color={Colors.ink} />
          <Text style={s.bSecTxt} numberOfLines={1}>{lancar}</Text>
        </Pressable>
        <Pressable
          testID={"painel-comanda-cobrar-" + c.number}
          onPress={function () { props.onCobrar(c); }}
          style={[s.bPri, !gaveta && s.bTouch]}
          accessibilityRole="button"
          accessibilityLabel={"Cobrar a comanda " + c.number}
        >
          <Text style={s.bPriTxt} numberOfLines={1}>Cobrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const MONO = Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace";

const s = StyleSheet.create({
  overlay: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end",
  },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.65)" },
  drawer: {
    width: 620, maxWidth: "100%" as any, height: "100%" as any,
    backgroundColor: Colors.bg2, borderLeftWidth: 1, borderLeftColor: Colors.border2,
    display: "flex" as any, flexDirection: "column",
  },
  sheet: {
    width: "100%" as any, maxHeight: "92%" as any,
    backgroundColor: Colors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderTopColor: Colors.border2,
    display: "flex" as any, flexDirection: "column", overflow: "hidden" as any,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: "center", marginTop: 8 },
  head: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headSheet: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  hIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: Colors.ink },
  sub: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  subB: { color: Colors.ink, fontWeight: "700" },
  x: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tools: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  toolsSheet: { paddingHorizontal: 16, paddingVertical: 10 },
  busca: {
    flexGrow: 1, flexBasis: 180, minWidth: 0, height: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8,
  },
  buscaInput: {
    flex: 1, minWidth: 0, height: 36, fontSize: 13, color: Colors.ink,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  seg: { flexDirection: "row", borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, overflow: "hidden" as any },
  segBtn: { paddingHorizontal: 11, height: 36, justifyContent: "center" },
  segBtnSheet: { paddingHorizontal: 9 },
  segOn: { backgroundColor: Colors.violet },
  segTxt: { fontSize: 11.5, fontWeight: "600", color: Colors.ink3 },
  // Gaveta tem altura cheia: a lista ocupa o resto. Folha cresce com o
  // conteúdo até 92% da tela e só então rola.
  scrollGaveta: { flex: 1 },
  scrollFolha: { flexGrow: 0, flexShrink: 1 },
  listaPad: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },
  listaPadSheet: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  lista: { gap: 10 },
  listaGrade: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cmd: {
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, gap: 8,
  },
  // Duas colunas na gaveta (12 px de vão).
  cmdGrade: { width: "calc(50% - 6px)" as any, flexGrow: 0, flexShrink: 0 },
  cmdVelha: { borderColor: "rgba(251,191,36,0.45)" },
  cTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  num: {
    minWidth: 52, height: 52, paddingHorizontal: 8, borderRadius: 12,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  numSheet: { minWidth: 46, height: 46 },
  numTxt: { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  nome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  nomeSem: { color: Colors.ink3, fontWeight: "500", fontStyle: "italic" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  metaTxt: { fontSize: 11.5, color: Colors.ink3 },
  metaAlerta: { color: Colors.amber, fontWeight: "700" },
  total: { fontFamily: MONO, fontSize: 17, fontWeight: "700", color: Colors.ink, textAlign: "right" },
  jaPago: { fontSize: 10.5, color: Colors.ink3, marginTop: 1, textAlign: "right" },
  tagParcial: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: Colors.amberD },
  tagParcialTxt: { fontSize: 10.5, fontWeight: "700", color: Colors.amber, letterSpacing: 0.4 },
  cAct: { flexDirection: "row", gap: 8 },
  bSec: {
    flex: 1, height: 38, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8,
  },
  bSecTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink },
  bPri: { flex: 1, height: 38, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  bPriTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  // Alvo de toque >= 42 px no celular.
  bTouch: { height: 42 },
  vazio: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20, gap: 2 },
  vazioTxt: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 21 },
  vazioB: { fontWeight: "700", color: Colors.ink2 },
  foot: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10,
    paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footSheet: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  footTxt: { fontSize: 11.5, color: Colors.ink3 },
});
