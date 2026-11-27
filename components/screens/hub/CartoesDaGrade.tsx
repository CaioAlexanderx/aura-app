// ============================================================
// Hub — peças da thread do "Produto com fotos e tamanhos" (artboard ProdutoGrade):
// a bolha com as fotos e a legenda, o "Qual tamanho?" com os botões, a resposta
// da cliente ("tocou no botão") e a sugestão de reservar e mandar o Pix.
// Contrato: hub_messages.metadata (Aura-backend #1142).
// ============================================================
import { View, Image } from "react-native";
import { fmt } from "@/constants/helpers";
import type { HubCartao } from "@/services/hubApi";
import type { SugestaoReserva } from "@/services/hubProdutoGradeApi";
import { K, Tx, Pilula, superficie, anima } from "./conversasUi";
import { legendaDoCartao } from "./produtoGrade";

export const TIPO_PERGUNTA = "pergunta_tamanho";

/** Bolha com as fotos e a legenda (tipo "produto" com `cartao.fotos`; .bub do artboard). */
export function CartaoProdutoGrade({ cartao }: { cartao?: HubCartao | null }) {
  const c = cartao || {};
  const fotos = (c.fotos || []).filter(Boolean);
  const [l1, l2] = legendaDoCartao(c);
  return (
    <View testID="hub-cartao-grade">
      {fotos.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {fotos.map((u, i) => (
            <View key={`${u}-${i}`} style={{ width: fotos.length === 1 ? "100%" : "49%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: K.trilho }}>
              <Image testID={`hub-cartao-grade-foto-${i}`} source={{ uri: u }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
            </View>
          ))}
        </View>
      )}
      <View style={{ paddingTop: 8, paddingHorizontal: 8, paddingBottom: 2, gap: 2 }}>
        {!!l1 && <Tx style={{ fontWeight: "700" }}>{l1}</Tx>}
        {!!l2 && <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>{l2}</Tx>}
      </View>
    </View>
  );
}

/** "Qual tamanho?" com os botões de resposta (metadata.opcoes). */
export function PerguntaDeTamanho({ opcoes }: { opcoes: string[] }) {
  return (
    <View testID="hub-pergunta-tamanho">
      <Tx style={{ paddingTop: 4, paddingHorizontal: 8, paddingBottom: 6, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>Qual tamanho?</Tx>
      {opcoes.map((b) => (
        <View key={b} testID={`hub-pergunta-botao-${b}`} style={{ minHeight: 40, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.16)" }}>
          <Tx style={{ fontSize: 14, fontWeight: "700", color: K.acc, lineHeight: 20 }}>{b}</Tx>
        </View>
      ))}
    </View>
  );
}

/** A resposta da cliente por botão ou lista: "tocou no botão" e o tamanho. */
export function RespostaDeBotao({ tamanho, lista }: { tamanho: string; lista?: boolean }) {
  return (
    <View testID="hub-resposta-botao">
      <Tx style={{ fontSize: 12, color: K.ink3, lineHeight: 16 }}>{lista ? "escolheu na lista" : "tocou no botão"}</Tx>
      <Tx style={{ fontSize: 15, lineHeight: 22 }}>{tamanho}</Tx>
    </View>
  );
}

/**
 * A sugestão sob a resposta da cliente.
 *  - reserva liberada: "Reservar e mandar o Pix" (a do artboard);
 *  - sem a trava do Pedido: "Mandar o Pix" com o preço do tamanho (envio de Pix de sempre);
 *  - `sem_estoque` e `feita`: só a frase, sem botão.
 */
export function SugestaoDeReserva({ nome, sugestao, reservaLiberada, ocupado, onReservar, onMandarPix }: {
  nome: string; sugestao: SugestaoReserva; reservaLiberada: boolean; ocupado?: boolean; onReservar: () => void; onMandarPix: () => void;
}) {
  const an = anima("pop", 0.4, 0.2);
  const ela = nome === "o cliente" ? "O cliente" : `A ${nome}`;
  const valor = fmt(Number(sugestao.preco));
  let texto: string;
  let botao: string | null = null;
  let acao = onReservar;
  if (sugestao.estado === "feita") texto = `Reservada: o ${sugestao.tamanho} e o Pix de ${valor} já foram para ${nome === "o cliente" ? "o cliente" : nome}.`;
  else if (sugestao.estado === "sem_estoque") texto = `${ela} quer o ${sugestao.tamanho}, mas esse tamanho acabou entre o envio e o toque. Mande outro tamanho.`;
  else if (reservaLiberada) { texto = `${ela} quer o ${sugestao.tamanho}. Reservar uma e mandar o Pix de ${valor}?`; botao = "Reservar e mandar o Pix"; }
  else { texto = `${ela} quer o ${sugestao.tamanho}. Mandar o Pix de ${valor}?`; botao = "Mandar o Pix"; acao = onMandarPix; }
  return (
    <View testID="hub-sugestao-reserva" {...({ dataSet: an.dataSet } as any)}
      style={[superficie.seca(20), { alignSelf: "stretch", paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, an.style]}>
      <Tx style={{ flex: 1, minWidth: 200, fontSize: 14, color: K.ink2, lineHeight: 20 }}>{texto}</Tx>
      {botao && <Pilula pequena on testID="hub-sugestao-reservar" disabled={ocupado} onPress={acao}>{botao}</Pilula>}
    </View>
  );
}
