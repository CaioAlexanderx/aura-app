// ============================================================
// Hub — bolhas estruturadas da thread (Main.dc.html): cartão de orçamento,
// cartão de Pix e cartão do link da loja.
//
// O WhatsApp recebe o texto de sempre; aqui a thread desenha o cartão quando
// a mensagem tem `tipo` (orcamento | pix | link_loja). O servidor só grava o
// texto montado (`content`) e o tipo: número do orçamento, itens, validade,
// valor do Pix, chave e código "copia e cola" não vêm em campos. O cartão
// lê o texto: linhas com "R$" viram linha de valor, o código do Pix (o maior
// trecho sem espaço) vai para a caixa de código. O que não for achado fica
// como texto, sem inventar nada.
// ============================================================
import { useState } from "react";
import { View, Pressable } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { copyToClipboard } from "@/utils/clipboard";
import { K, Tx, Meta, MONO, SERIF, web } from "./waVisual";

const limpa = (s: string) => s.replace(/[*_]/g, "").trim();
const VALOR = /R\$\s*[\d.]+(?:,\d{1,2})?/;

function linhas(content: string): string[] {
  return String(content || "").split(/\r?\n/).map(limpa).filter(Boolean);
}

const chipBotao = { marginTop: 10, minHeight: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: K.chipClaro } as const;

export function CartaoOrcamento({ content }: { content: string }) {
  const ls = linhas(content);
  const num = /or[cç]amento\s*(?:n[ºo°.]*\s*)?#?(\d{2,8})/i.exec(content || "")?.[1];
  const itens: { esq: string; dir: string }[] = [];
  const extras: string[] = [];
  let total: string | null = null;
  ls.forEach((l, i) => {
    const m = VALOR.exec(l);
    if (/^total\b/i.test(l) && m) { total = m[0]; return; }
    if (m && i > 0) { const k = l.indexOf(m[0]); itens.push({ esq: limpa(l.slice(0, k)).replace(/[:·\-–]\s*$/, ""), dir: m[0] }); return; }
    if (i === 0 && /or[cç]amento/i.test(l) && !m) return; // título
    extras.push(l);
  });
  return (
    <View testID="hub-cartao-orcamento" style={{ gap: 0 }}>
      <Meta style={{ color: K.acc }}>{num ? `Orçamento ${num}` : "Orçamento"}</Meta>
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
      {extras.map((l, i) => <Tx key={i} style={{ fontSize: 13, color: K.ink2, lineHeight: 18, marginTop: 4 }}>{l}</Tx>)}
    </View>
  );
}

export function CartaoPix({ content }: { content: string }) {
  const { company } = useAuthStore() as any;
  const loja = String(company?.trade_name || company?.name || "").trim();
  const [copiado, setCopiado] = useState(false);
  const ls = linhas(content);
  const codigo = ls.join(" ").split(/\s+/).filter((w) => w.length >= 40).sort((a, b) => b.length - a.length)[0] || null;
  const valor = VALOR.exec(content || "")?.[0] || null;
  const resto = ls.filter((l) => !(codigo && l.includes(codigo))).map((l) => (valor ? l.replace(valor, "").replace(/^[\s:·\-–]+|[\s:·\-–]+$/g, "") : l)).filter(Boolean);
  return (
    <View testID="hub-cartao-pix">
      <Meta style={{ color: K.acc }}>{loja ? `Pix da ${loja}` : "Pix"}</Meta>
      {valor && <Tx style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.78, lineHeight: 32, marginTop: 6 }}>{valor}</Tx>}
      {resto.map((l, i) => <Tx key={i} style={{ fontSize: 13, color: K.ink2, lineHeight: 18 }}>{l}</Tx>)}
      {codigo && (
        <>
          <View style={{ marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: K.campo }}>
            <Tx numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12, color: K.ink2, lineHeight: 16 }}>{codigo}</Tx>
          </View>
          <Pressable testID="hub-cartao-pix-copiar" accessibilityRole="button" onPress={async () => setCopiado(await copyToClipboard(codigo))}
            style={[chipBotao, { marginTop: 8 }, web({ cursor: "pointer" })]}>
            <Tx style={{ fontSize: 13, fontWeight: "700", lineHeight: 18 }}>{copiado ? "Código copiado" : "Copiar código Pix"}</Tx>
          </Pressable>
        </>
      )}
    </View>
  );
}

export function CartaoLinkLoja({ content }: { content: string }) {
  const { company } = useAuthStore() as any;
  const loja = String(company?.trade_name || company?.name || "").trim();
  const ls = linhas(content);
  return (
    <View testID="hub-cartao-link" style={{ gap: 0 }}>
      <View style={[{ height: 110, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#2a1a5e" }, web({ backgroundImage: "radial-gradient(120% 90% at 10% 0%,#5b3fb0,#1c1240 70%)" })]}>
        <Tx style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 40, color: "#f3efff" }}>
          {loja ? loja.split(/\s+/)[0] : "Loja"}<Tx style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 40, color: "#c4b5fd" }}>.</Tx>
        </Tx>
      </View>
      <View style={{ paddingTop: 10, paddingHorizontal: 6, gap: 2 }}>
        {ls.map((l, i) => (
          <Tx key={i} style={i === 0 ? { fontWeight: "700" } : { fontSize: 13, color: K.ink2, lineHeight: 18 }}>{l}</Tx>
        ))}
      </View>
    </View>
  );
}

/** Larguras do mockup: cartões de 300 px (produto, 280). */
export const CARTAO_TIPOS = ["orcamento", "pix", "link_loja"];