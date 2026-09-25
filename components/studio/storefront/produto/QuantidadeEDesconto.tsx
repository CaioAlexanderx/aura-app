// ============================================================
// components/studio/storefront/produto/QuantidadeEDesconto.tsx
//
// Tela 5 do mockup (itens da Fase 3A): quantidade DIGITÁVEL entre − e +
// (50 unidades eram 49 toques), a escada de desconto como régua com o
// preço de cada parada, UMA frase ("Faltam 3 para pagar R$ 44,91 cada"),
// o prazo daquela quantidade e a porta para o orçamento em lote.
//
// Tocar numa parada sobe a quantidade até ela, nunca desce (regra de
// hoje, ProductConfigurator). As contas são de regrasDaPagina.ts; o
// preço unitário vem do hook.
// ============================================================
import { useEffect, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import type { QtyTier } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia, estiloNumero } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "../moeda";
import { useReduzirMovimento } from "../movimento";
import {
  QTD_MAXIMA, quantidadeValida, quantidadeDigitada, reguaDaEscada, fraseDaEscada,
  economiaNaFaixa, prazoDaQuantidade, textoDeDias,
} from "./regrasDaPagina";
import { borda2, transicao, useNumeroAnimado } from "./kitDaPagina";

export function QuantidadeEDesconto({
  qtd, onQtd, unitario, tiers, precoDeTabela, adicionalPorUnidade, prazoDaLoja, onLote, destacarPrazo,
}: {
  qtd: number;
  onQtd: (n: number) => void;
  /** O preço unitário do hook (configuringUnitPrice). */
  unitario: number;
  tiers: QtyTier[] | null | undefined;
  precoDeTabela: number;
  adicionalPorUnidade: number;
  prazoDaLoja: number | null;
  onLote: () => void;
  destacarPrazo?: boolean;
}) {
  const t = useTemaDaVitrine();
  const par = useTipografia();
  const reduzir = useReduzirMovimento();
  const [campo, setCampo] = useState(String(qtd));
  const [focado, setFocado] = useState(false);
  // O campo segue a quantidade quando ela muda por fora (−, +, parada da
  // régua), mas não enquanto a cliente digita.
  useEffect(() => { if (!focado) setCampo(String(qtd)); }, [qtd, focado]);

  const unit = useNumeroAnimado(unitario);
  const regua = reguaDaEscada(tiers, precoDeTabela, adicionalPorUnidade, qtd);
  const frase = fraseDaEscada(tiers, precoDeTabela, adicionalPorUnidade, qtd);
  const economia = economiaNaFaixa(tiers, precoDeTabela, qtd);
  const prazo = prazoDaQuantidade(tiers as any, qtd, prazoDaLoja);

  const mudar = (n: number) => onQtd(quantidadeValida(n));

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", height: 52, padding: 3, borderRadius: 14, borderWidth: 1, borderColor: borda2(t), backgroundColor: t.bg2 }}>
          <Pressable onPress={() => mudar(qtd - 1)} accessibilityRole="button" accessibilityLabel="Diminuir quantidade"
            style={({ hovered }: any) => ({ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? t.bg3 : "transparent" })}>
            <Icon name="minus" size={20} color={t.ink} />
          </Pressable>
          <TextInput
            value={campo}
            onChangeText={(v) => {
              const d = quantidadeDigitada(v);
              setCampo(d);
              if (d) onQtd(quantidadeValida(d));
            }}
            onFocus={() => setFocado(true)}
            onBlur={() => { setFocado(false); const n = quantidadeValida(campo); setCampo(String(n)); onQtd(n); }}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={String(QTD_MAXIMA).length}
            accessibilityLabel="Quantidade"
            selectTextOnFocus
            style={[{
              width: 64, height: 44, textAlign: "center", fontSize: 19, fontWeight: "500", color: t.ink, borderRadius: 8,
            }, estiloNumero(par) as any, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
              focado && Platform.OS === "web" ? ({ boxShadow: `0 0 0 2px ${t.marcaTexto}` } as any) : null]}
          />
          <Pressable onPress={() => mudar(qtd + 1)} accessibilityRole="button" accessibilityLabel="Aumentar quantidade"
            style={({ hovered }: any) => ({ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? t.bg3 : "transparent" })}>
            <Icon name="plus" size={20} color={t.ink} />
          </Pressable>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Numero style={{ fontSize: 18, fontWeight: "600", color: t.ink }}>{dinheiro(unit)}</Numero>
          <Texto style={{ fontSize: 12.5, color: t.ink3 }}>por unidade</Texto>
        </View>
      </View>

      {regua ? (
        <View style={{ height: 78, marginTop: 20, marginHorizontal: 6, marginBottom: 4, position: "relative" }}>
          <View style={{ position: "absolute", left: 0, right: 0, top: 30, height: 6, borderRadius: 3, backgroundColor: t.bg4, overflow: "hidden" }}>
            <View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${regua.progresso * 100}%`, backgroundColor: t.marcaFill, borderRadius: 3 }, reduzir ? null : transicao("width", 320)]} />
          </View>
          <View
            pointerEvents="none"
            style={[{
              position: "absolute", top: 23, left: `${regua.progresso * 100}%` as any, marginLeft: -10, width: 20, height: 20, borderRadius: 10, zIndex: 2,
              backgroundColor: t.bg2, borderWidth: 3, borderColor: t.marcaFill,
            }, reduzir ? null : transicao("left", 320)]}
          />
          {regua.paradas.map((p, i) => {
            const n = regua.paradas.length - 1;
            const primeira = i === 0;
            const ultima = i === n;
            const pos = `${(i / n) * 100}%`;
            const conteudo = (
              <>
                <Texto style={{ fontSize: 12, lineHeight: 18, fontWeight: "600", color: t.ink2 }}>
                  <Numero style={{ fontSize: 12, fontWeight: "600" }}>{p.qtd}</Numero> un
                  {p.pct ? <Numero style={{ fontSize: 11, fontWeight: "500", color: p.alcancada ? t.ink2 : t.ink3 }}>{"  −" + String(p.pct).replace(".", ",") + "%"}</Numero> : null}
                </Texto>
                <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 8, backgroundColor: p.alcancada ? t.marcaFill : t.bg2, borderWidth: p.alcancada ? 0 : 2, borderColor: borda2(t) }} />
                <Numero style={{ fontSize: 12, fontWeight: "500", marginTop: 8, color: p.alcancada ? t.ink : t.ink3 }}>{dinheiro(p.preco)}</Numero>
              </>
            );
            const estilo: any = {
              position: "absolute", top: 0, height: 78, minWidth: 64,
              alignItems: primeira ? "flex-start" : ultima ? "flex-end" : "center",
              ...(ultima ? { right: 0 } : { left: pos }),
              ...(primeira || ultima ? null : { transform: [{ translateX: "-50%" as any }] }),
            };
            if (primeira) return <View key={p.qtd} style={estilo}>{conteudo}</View>;
            return (
              <Pressable key={p.qtd} style={estilo} onPress={() => mudar(Math.max(qtd, p.qtd))}
                accessibilityRole="button" accessibilityLabel={`Levar ${p.qtd} unidades: ${dinheiro(p.preco)} cada`}>
                {conteudo}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {frase ? (
        <Texto accessibilityLiveRegion="polite" style={{ fontSize: 15, fontWeight: "600", color: t.ink, marginTop: 8 }}>
          {frase.tipo === "menor" ? "Você chegou ao menor preço: " : frase.tipo === "faltam" ? `Faltam ${frase.faltam} para pagar ` : `Leve ${frase.quantidade} e pague `}
          <Numero style={{ fontSize: 15, fontWeight: "500" }}>{dinheiro(frase.preco)}</Numero> cada
        </Texto>
      ) : null}
      {economia ? (
        <Texto style={{ fontSize: 12.5, fontWeight: "600", color: t.green, marginTop: 2 }}>
          {`Você economiza ${dinheiro(economia.valor)} com o desconto de ${String(economia.pct).replace(".", ",")}%.`}
        </Texto>
      ) : null}
      {prazo != null ? (
        <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, borderRadius: 8 }, destacarPrazo ? { backgroundColor: t.marcaWashForte } : null, transicao("background-color", 600)]}>
          <Icon name="clock" size={18} color={t.marcaTexto} />
          <Texto style={{ flex: 1, fontSize: 13.5, color: t.ink2 }}>
            <Numero style={{ fontSize: 13.5 }}>{qtd}</Numero> {qtd === 1 ? "unidade" : "unidades"}: <Texto style={{ fontWeight: "600", color: t.ink }}>{`pronto em ${textoDeDias(prazo)}`}</Texto>
          </Texto>
        </View>
      ) : null}

      <Pressable
        onPress={onLote}
        accessibilityRole="link"
        accessibilityLabel="Comprando para evento ou empresa? Peça um orçamento em lote"
        style={({ hovered }: any) => [{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: hovered ? t.bg4 : t.bg3 }, transicao("background-color")]}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}>
          <Icon name="box" size={20} color={t.marcaTexto} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto style={{ fontSize: 14.5, fontWeight: "600", color: t.ink }}>Comprando para evento ou empresa?</Texto>
          <Texto style={{ fontSize: 12.5, lineHeight: 18, color: t.ink3 }}>Peça um orçamento em lote: mande a lista de nomes e a loja responde com o preço.</Texto>
        </View>
        <Icon name="chevron_right" size={20} color={t.ink3} />
      </Pressable>
    </View>
  );
}
