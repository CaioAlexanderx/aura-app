// ============================================================
// AURA. — Aba Pedidos: uma linha da lista (A5a, 17/11/2026)
//
// Mockup aprovado em 17/11 (parte 3): no computador, linha de tabela
// (Pedido · Cliente e peças · Data prometida · Situação · Sinal · Falta ·
// Ações); no celular, cartão. O atrasado fica vermelho, com a faixa à
// esquerda, e sobe para o topo (a ordem vem do backend). As ações ficam
// sempre na linha, sem depender de passar o mouse (regra 7 do CLAUDE.md).
// No consolidado, o selo da loja fica embaixo do nome da cliente.
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import type { LinhaDoPedido as Pedido } from "@/hooks/usePedidos";
import {
  TEXTOS_DOS_PEDIDOS as T, corDaSituacao, dataCurta, quandoVemBuscar, rotuloDaSituacao,
  pecasDaLinha, seloDeAtraso, type CorDaSituacao,
} from "./regrasDosPedidos";

const AZUL = IS_DARK_MODE ? "#93c5fd" : "#1e40af";
const AZUL_D = IS_DARK_MODE ? "rgba(37,99,235,0.16)" : "rgba(37,99,235,0.08)";

const COR: Record<CorDaSituacao, { fg: string; bg: string }> = {
  violeta: { fg: Colors.violet3, bg: Colors.violetD },
  azul: { fg: AZUL, bg: AZUL_D },
  verde: { fg: Colors.green, bg: Colors.greenD },
  neutro: { fg: Colors.ink2, bg: Colors.bg4 },
  vermelho: { fg: Colors.red, bg: Colors.redD },
};

export function SeloDaSituacao({ status }: { status: string }) {
  const c = COR[corDaSituacao(status)];
  return (
    <View style={[s.selo, { backgroundColor: c.bg }]} testID={"selo-situacao-" + status}>
      <View style={[s.seloPonto, { backgroundColor: c.fg }]} />
      <Text style={[s.seloTexto, { color: c.fg }]}>{rotuloDaSituacao(status)}</Text>
    </View>
  );
}

export function SeloDaLoja({ nome }: { nome: string | null | undefined }) {
  if (!nome) return null;
  return (
    <View style={s.loja}>
      <Text style={s.lojaTexto} numberOfLines={1}>{nome}</Text>
    </View>
  );
}

type Props = {
  pedido: Pedido;
  hoje: string;
  /** Tabela (computador) ou cartão (celular). */
  largo: boolean;
  /** Selo da loja (consolidado com mais de uma loja). */
  mostrarLoja: boolean;
  /** Botões da linha (A5b). Sem eles a coluna Ações fica vazia. */
  acoes?: React.ReactNode;
  /** Toque na linha abre a gaveta do pedido (A5b). */
  onAbrir?: () => void;
};

export function LinhaDoPedido({ pedido: p, hoje, largo, mostrarLoja, acoes, onAbrir }: Props) {
  const quando = quandoVemBuscar(p.status, p.promised_date, hoje);
  const atrasado = !!p.atrasado;
  const pecas = pecasDaLinha(p.first_item_name, p.pecas);
  const sinal = p.sinal_pago > 0 ? brl(p.sinal_pago) : T.semSinal;

  if (largo) {
    return (
      <Pressable
        onPress={onAbrir}
        disabled={!onAbrir}
        accessibilityRole={onAbrir ? "button" : undefined}
        style={[s.linha, atrasado && s.linhaAtrasada]}
        testID={"pedido-" + p.id}
      >
        <Text style={[s.num, s.cNum]}>{p.order_number}</Text>
        <View style={s.cCli}>
          <Text style={s.nome} numberOfLines={1}>{p.customer_name || "—"}</Text>
          {mostrarLoja ? <SeloDaLoja nome={p.company_name} /> : (
            <Text style={s.sub} numberOfLines={1}>{p.customer_phone || T.semTelefone}</Text>
          )}
          <Text style={s.pecas} numberOfLines={2}>{pecas}</Text>
        </View>
        <View style={s.cData}>
          <Text style={[s.data, atrasado && s.vermelho]}>{dataCurta(p.promised_date)}</Text>
          {!!quando && <Text style={[s.sub, atrasado && s.vermelho, quando === "amanhã" && s.ambar]}>{quando}</Text>}
        </View>
        <View style={s.cSit}><SeloDaSituacao status={String(p.status)} /></View>
        <Text style={[s.valor, s.cVal, p.sinal_pago > 0 && s.verde]}>{sinal}</Text>
        <Text style={[s.valor, s.cVal]}>{brl(p.falta)}</Text>
        {acoes !== undefined && <View style={s.cAcoes}>{acoes}</View>}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onAbrir}
      disabled={!onAbrir}
      accessibilityRole={onAbrir ? "button" : undefined}
      style={[s.cartao, atrasado && s.cartaoAtrasado]}
      testID={"pedido-" + p.id}
    >
      <View style={s.l1}>
        <Text style={s.num}>{p.order_number}</Text>
        <SeloDaSituacao status={String(p.status)} />
        <View style={{ flex: 1 }} />
        {atrasado && (
          <View style={[s.selo, { backgroundColor: Colors.redD }]}>
            <View style={[s.seloPonto, { backgroundColor: Colors.red }]} />
            <Text style={[s.seloTexto, { color: Colors.red }]}>{seloDeAtraso(p.dias_de_atraso)}</Text>
          </View>
        )}
      </View>
      <Text style={s.nomeCartao} numberOfLines={1}>{p.customer_name || "—"}</Text>
      {mostrarLoja && <SeloDaLoja nome={p.company_name} />}
      <Text style={s.pecas} numberOfLines={2}>{pecas}</Text>
      <View style={s.vals}>
        <Text style={s.valTexto}>Prometido <Text style={s.valForte}>{dataCurta(p.promised_date)}</Text></Text>
        <Text style={s.valTexto}>{T.sinal} <Text style={[s.valForte, p.sinal_pago > 0 && s.verde]}>{p.sinal_pago > 0 ? brl(p.sinal_pago) : T.semSinal}</Text></Text>
        <Text style={s.valTexto}>{T.colFalta} <Text style={s.valForte}>{brl(p.falta)}</Text></Text>
      </View>
      {!!acoes && <View style={s.acoesCartao}>{acoes}</View>}
    </Pressable>
  );
}

/** Cabeçalho da tabela (computador). */
export function CabecalhoDaLista({ comAcoes }: { comAcoes: boolean }) {
  return (
    <View style={s.cab}>
      <Text style={[s.cabTexto, s.cNum]}>{T.colPedido}</Text>
      <Text style={[s.cabTexto, s.cCli]}>{T.colCliente}</Text>
      <Text style={[s.cabTexto, s.cData]}>{T.colData}</Text>
      <Text style={[s.cabTexto, s.cSit]}>{T.colSituacao}</Text>
      <Text style={[s.cabTexto, s.cVal]}>{T.colSinal}</Text>
      <Text style={[s.cabTexto, s.cVal]}>{T.colFalta}</Text>
      {comAcoes && <Text style={[s.cabTexto, s.cAcoes, { textAlign: "right" }]}>{T.colAcoes}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  cab: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  cabTexto: { fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3, fontWeight: "700" },
  linha: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 64, borderBottomWidth: 1, borderBottomColor: Colors.border },
  linhaAtrasada: { backgroundColor: Colors.redD, borderLeftWidth: 3, borderLeftColor: Colors.red },
  cNum: { width: 70 },
  cCli: { flex: 1, minWidth: 0 },
  cData: { width: 116 },
  cSit: { width: 124 },
  cVal: { width: 92 },
  cAcoes: { width: 276, flexDirection: "row", justifyContent: "flex-end", gap: 6 },
  num: { fontSize: 12.5, color: Colors.ink2, fontFamily: "monospace" as any },
  nome: { fontSize: 13.5, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12, color: Colors.ink3 },
  pecas: { fontSize: 12.5, color: Colors.ink2, marginTop: 2, lineHeight: 17 },
  data: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  valor: { fontSize: 13, color: Colors.ink, fontFamily: "monospace" as any },
  verde: { color: Colors.green },
  vermelho: { color: Colors.red },
  ambar: { color: Colors.amber },
  selo: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  seloPonto: { width: 7, height: 7, borderRadius: 4 },
  seloTexto: { fontSize: 12, fontWeight: "700" },
  loja: { alignSelf: "flex-start", marginTop: 3, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, maxWidth: 200 },
  lojaTexto: { fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  cartao: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3, padding: 12, marginBottom: 10 },
  cartaoAtrasado: { borderColor: Colors.red, borderLeftWidth: 3 },
  l1: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nomeCartao: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginTop: 6 },
  vals: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },
  valTexto: { fontSize: 12.5, color: Colors.ink2 },
  valForte: { color: Colors.ink, fontFamily: "monospace" as any },
  acoesCartao: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
});
