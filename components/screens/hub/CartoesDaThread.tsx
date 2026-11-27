// ============================================================
// Hub — bolhas estruturadas da thread (Main.dc.html): cartão de orçamento,
// cartão de Pix e cartão do link da loja.
//
// O WhatsApp recebe o texto de sempre; a thread desenha o cartão quando a
// mensagem tem `tipo` (orcamento | pix | link_loja). Os dados vêm de
// `metadata.cartao` (Aura-backend: hubWhatsappEnvio.js):
//   orçamento  { numero, itens:[{nome,qtd,valor}], total, validade, url }
//   pix        { valor, loja, chave, codigo }
//   link_loja  { loja, url, imagem, descricao }
// Mensagens antigas não têm `cartao`: o cartão lê o texto (linhas com "R$"
// viram valor; o maior trecho sem espaço é o código do Pix; a URL do texto
// vira o botão). O que não for achado não aparece, sem inventar nada.
// ============================================================
import { useState } from "react";
import { View, Pressable, Image, Linking } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { copyToClipboard } from "@/utils/clipboard";
import { fmt } from "@/constants/helpers";
import type { HubCartao } from "@/services/hubApi";
import { K, Tx, Meta, Pilula, MONO, SERIF, web, superficie, anima } from "./conversasUi";

const limpa = (s: string) => s.replace(/[*_]/g, "").trim();
const VALOR = /R\$\s*[\d.]+(?:,\d{1,2})?/;
const URL_RE = /https?:\/\/[^\s]+/i;

function linhas(content: string): string[] {
  return String(content || "").split(/\r?\n/).map(limpa).filter(Boolean);
}
const dataCurta = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
};

/** O botão em pílula clara do cartão ("Ver e aprovar", "Copiar código Pix"). */
function ChipBotao({ testID, children, onPress }: { testID?: string; children: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress}
      style={[{ marginTop: 10, minHeight: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: K.chipClaro }, web({ cursor: "pointer" })]}>
      <Tx style={{ fontSize: 13, fontWeight: "700", lineHeight: 18 }}>{children}</Tx>
    </Pressable>
  );
}

export function CartaoOrcamento({ content, cartao }: { content: string; cartao?: HubCartao | null }) {
  const ls = linhas(content);
  const c: any = cartao || {};
  const numTxt = /or[cç]amento\s*(?:n[ºo°.]*\s*)?#?(\d{2,8})/i.exec(content || "")?.[1];
  const numero = c.numero != null ? String(c.numero).padStart(4, "0") : numTxt || null;
  let itens: { esq: string; dir: string }[] = [];
  let total: string | null = c.total != null ? fmt(Number(c.total)) : null;
  const extras: string[] = [];
  if (Array.isArray(c.itens) && c.itens.length) {
    itens = c.itens.map((i: any) => ({
      esq: `${Number(i.qtd) > 1 ? `${Number(i.qtd)} × ` : ""}${i.nome}`,
      dir: fmt(Number(i.valor) * (Number(i.qtd) > 0 ? Number(i.qtd) : 1)),
    }));
  } else if (!cartao) {
    ls.forEach((l, i) => {
      const m = VALOR.exec(l);
      if (/^total\b/i.test(l) && m) { total = m[0]; return; }
      if (m && i > 0) { const k = l.indexOf(m[0]); itens.push({ esq: limpa(l.slice(0, k)).replace(/[:·\-–]\s*$/, ""), dir: m[0] }); return; }
      if (i === 0 && /or[cç]amento/i.test(l) && !m) return; // título
      if (/^(veja|ver) e aprove/i.test(l)) return;
      extras.push(l);
    });
  }
  const validade = dataCurta(c.validade) || (/vale at[eé]\s*(\d{2}\/\d{2})/i.exec(content || "")?.[1] ?? "");
  const url: string | null = c.url || URL_RE.exec(content || "")?.[0] || null;
  return (
    <View testID="hub-cartao-orcamento">
      <Meta style={{ color: K.acc }}>{numero ? `Orçamento ${numero}` : "Orçamento"}</Meta>
      {itens.length > 0 && (
        <View style={{ gap: 4, marginVertical: 10 }}>
          {itens.map((it, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Tx style={{ fontSize: 14, lineHeight: 20, flexShrink: 1 }}>{it.esq}</Tx>
              <Tx style={{ fontSize: 14, lineHeight: 20 }}>{it.dir}</Tx>
            </View>
          ))}
        </View>
      )}
      {total && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: K.linha, paddingTop: 8 }}>
          <Tx style={{ fontSize: 17, fontWeight: "800", lineHeight: 24 }}>Total</Tx>
          <Tx style={{ fontSize: 17, fontWeight: "800", lineHeight: 24 }}>{total}</Tx>
        </View>
      )}
      {!!validade && <Tx style={{ fontSize: 13, color: K.ink2, lineHeight: 18, marginTop: 4 }}>{`Vale até ${validade}`}</Tx>}
      {extras.map((l, i) => <Tx key={i} style={{ fontSize: 13, color: K.ink2, lineHeight: 18, marginTop: 4 }}>{l}</Tx>)}
      {url && <ChipBotao testID="hub-cartao-orcamento-abrir" onPress={() => { void Linking.openURL(url); }}>Ver e aprovar</ChipBotao>}
    </View>
  );
}

export function CartaoPix({ content, cartao }: { content: string; cartao?: HubCartao | null }) {
  const { company } = useAuthStore() as any;
  const c: any = cartao || {};
  const lojaApp = String(company?.trade_name || company?.name || "").trim();
  const loja = String(c.loja || lojaApp).trim();
  const [copiado, setCopiado] = useState(false);
  const ls = linhas(content);
  const codigo: string | null = c.codigo || ls.join(" ").split(/\s+/).filter((w) => w.length >= 40).sort((a, b) => b.length - a.length)[0] || null;
  const valor: string | null = c.valor != null ? fmt(Number(c.valor)) : cartao ? null : VALOR.exec(content || "")?.[0] || null;
  const resto = cartao
    ? []
    : ls.filter((l) => !(codigo && l.includes(codigo))).map((l) => (valor ? l.replace(valor, "").replace(/^[\s:·\-–]+|[\s:·\-–]+$/g, "") : l)).filter((l) => l && !/^pix da /i.test(l) && !/copia e cola/i.test(l));
  return (
    <View testID="hub-cartao-pix">
      <Meta style={{ color: K.acc }}>{loja ? `Pix da ${loja}` : "Pix"}</Meta>
      {valor && <Tx style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.78, lineHeight: 32, marginTop: 6 }}>{valor}</Tx>}
      {!!c.chave && <Tx style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{`chave: ${c.chave}`}</Tx>}
      {resto.map((l, i) => <Tx key={i} style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{l}</Tx>)}
      {codigo && (
        <>
          <View style={{ marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: K.campo }}>
            <Tx numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12, color: K.ink2, lineHeight: 16 }}>{codigo}</Tx>
          </View>
          <ChipBotao testID="hub-cartao-pix-copiar" onPress={async () => setCopiado(await copyToClipboard(codigo))}>
            {copiado ? "Código copiado" : "Copiar código Pix"}
          </ChipBotao>
        </>
      )}
    </View>
  );
}

export function CartaoLinkLoja({ content, cartao }: { content: string; cartao?: HubCartao | null }) {
  const { company } = useAuthStore() as any;
  const c: any = cartao || {};
  const lojaApp = String(company?.trade_name || company?.name || "").trim();
  const loja = String(c.loja || lojaApp).trim();
  const ls = linhas(content);
  const url: string | null = c.url || URL_RE.exec(content || "")?.[0] || null;
  const host = url ? url.replace(/^https?:\/\//, "") : "";
  const titulo = cartao ? (loja ? `${loja} · loja online` : "Loja online") : ls[0];
  const apoio = cartao ? [c.descricao ? `${host} · ${c.descricao}` : host].filter(Boolean) : ls.slice(1);
  return (
    <View testID="hub-cartao-link">
      {c.imagem
        ? <Image source={{ uri: c.imagem }} resizeMode="cover" style={{ height: 110, borderRadius: 14, backgroundColor: "#2a1a5e" }} />
        : (
          <View style={[{ height: 110, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#2a1a5e" }, web({ backgroundImage: "radial-gradient(120% 90% at 10% 0%,#5b3fb0,#1c1240 70%)" })]}>
            <Tx style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 40, color: "#f3efff" }}>
              {loja ? loja.split(/\s+/)[0] : "Loja"}<Tx style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 40, color: "#c4b5fd" }}>.</Tx>
            </Tx>
          </View>
        )}
      <View style={{ paddingTop: 10, paddingHorizontal: 6, gap: 2 }}>
        {!!titulo && <Tx style={{ fontWeight: "700" }}>{titulo}</Tx>}
        {apoio.map((l, i) => <Tx key={i} style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{l}</Tx>)}
      </View>
    </View>
  );
}

/** Larguras do mockup: cartões de 300 px (link, 300 com 8 de borda). */
export const CARTAO_TIPOS = ["orcamento", "pix", "link_loja"];
/** Mensagens que a thread desenha com peça própria (fotos e tamanhos; resposta por botão). */
export const TIPO_GRADE = "produto_grade";
export const TIPO_RESPOSTA_BOTAO = "resposta_botao";

/** Bolha com as fotos, a legenda e o "Qual tamanho?" com os botões (.bub do artboard ProdutoGrade). */
export function CartaoProdutoGrade({ cartao }: { cartao?: HubCartao | null }) {
  const c = cartao || {};
  const fotos = (c.fotos || []).filter(Boolean);
  const [l1, l2] = c.legenda || [];
  const botoes = (c.botoes || []).filter(Boolean);
  return (
    <View testID="hub-cartao-grade">
      {fotos.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {fotos.map((u, i) => (
            <Image key={`${u}-${i}`} testID={`hub-cartao-grade-foto-${i}`} source={{ uri: u }} resizeMode="cover"
              style={{ width: fotos.length === 1 ? "100%" : "49%", aspectRatio: 1, borderRadius: 12, backgroundColor: K.trilho }} />
          ))}
        </View>
      )}
      <View style={{ paddingTop: 8, paddingHorizontal: 8, paddingBottom: 2, gap: 2 }}>
        {!!l1 && <Tx style={{ fontWeight: "700" }}>{l1}</Tx>}
        {!!l2 && <Tx style={{ fontSize: 14, color: K.ink2, lineHeight: 20 }}>{l2}</Tx>}
      </View>
      {botoes.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Tx style={{ paddingTop: 4, paddingHorizontal: 8, paddingBottom: 6, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{c.pergunta || "Qual tamanho?"}</Tx>
          {botoes.map((b) => (
            <View key={b} testID={`hub-cartao-grade-botao-${b}`} style={{ minHeight: 40, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.16)" }}>
              <Tx style={{ fontSize: 14, fontWeight: "700", color: K.acc, lineHeight: 20 }}>{b}</Tx>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** A resposta da cliente por botão: "tocou no botão" e o tamanho. */
export function RespostaDeBotao({ content, cartao }: { content: string; cartao?: HubCartao | null }) {
  return (
    <View testID="hub-resposta-botao">
      <Tx style={{ fontSize: 12, color: K.ink3, lineHeight: 16 }}>tocou no botão</Tx>
      <Tx style={{ fontSize: 15, lineHeight: 22 }}>{cartao?.tamanho || content}</Tx>
    </View>
  );
}

/** "A Ana quer o M. Reservar uma e mandar o Pix de R$ X?" com o botão de reservar. */
export function SugestaoDeReserva({ nome, cartao, ocupado, onReservar }: {
  nome: string; cartao: HubCartao; ocupado?: boolean; onReservar: () => void;
}) {
  const s = cartao.sugestao;
  const an = anima("pop", 0.4, 0.2);
  if (!s) return null;
  return (
    <View testID="hub-sugestao-reserva" {...({ dataSet: an.dataSet } as any)}
      style={[superficie.seca(20), { alignSelf: "stretch", paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, an.style]}>
      <Tx style={{ flex: 1, minWidth: 200, fontSize: 14, color: K.ink2, lineHeight: 20 }}>
        {`${nome === "o cliente" ? "O cliente" : `A ${nome}`} quer o ${s.size}. Reservar uma e mandar o Pix de ${fmt(Number(s.valor))}?`}
      </Tx>
      <Pilula pequena on testID="hub-sugestao-reservar" disabled={ocupado} onPress={onReservar}>Reservar e mandar o Pix</Pilula>
    </View>
  );
}
