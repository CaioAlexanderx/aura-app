// ============================================================
// components/studio/storefront/SacolaEmGaveta.tsx
//
// A sacola em gaveta (Fase 2, Tela 1 do mockup studio-vitrine-02-fechar-
// a-venda). Só com a chave `vitrine_v2`.
//
// Hoje não existe sacola: a lista mora dentro do checkout e "Editar"
// devolve para a home (JORNADA §4.5). A gaveta abre POR CIMA de onde a
// cliente está — lateral no desktop, folha de baixo no celular — e cada
// item mostra a ARTE dela na peça, não a foto de catálogo.
//
//   - quantidade digitável, além do − / + (decisão do PO, 25/09);
//   - preço e resumo em linguagem de gente ("Frente e verso · Arte: Mãe",
//     "R$ 57,90 cada · inclui R$ 8,00 do verso");
//   - "Editar" embaixo da miniatura: mexer na arte perto da arte; salvar
//     volta para a gaveta;
//   - remover é a lixeira, com "Desfazer" por 5 segundos;
//   - vazia, com voz; loja fechada, "Finalizar" some e vira orçamento;
//   - os valores vêm da cotação do servidor (contrato B3), com a conta
//     local só como estimativa do primeiro instante.
//
// Camada absoluta sobre a área da loja, e não `Modal`: o Modal do
// react-native-web vai para um portal no <body>, fora do tema e da
// tipografia da vitrine (mesma razão de SacolaFechada.tsx).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, TextInput, Linking, Platform, useWindowDimensions } from "react-native";
import type { StorefrontState } from "./useStorefront";
import type { CartLine } from "./types";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { Texto, Numero, useTipografia, estiloNumero } from "./TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "./moeda";
import { wash, tintaSobre } from "./theme";
import { modoDaVitrine } from "./modoDaVitrine";
import { precoDaLinha, descontoDoPix, pecasNaSacola, subtotalDaSacola } from "./precoDaSacola";
import { resumoDaLinha } from "./resumoDaPeca";
import { linkDoOrcamentoDoCarrinho } from "./pedidoPeloWhatsApp";
import { BotaoOrcamentoDaSacola } from "./SacolaFechada";
import { MiniaturaDaLinha } from "./ui/MiniaturaDaLinha";
import { Botao, Nota, BORDA_DE_CAMPO, FUNDO_APAGADO } from "./ui/Formulario";
import { diasUteis } from "./formularioDoCheckout";

/** O "Desfazer" fica na tela por 5 segundos (decisão de desenho do mockup). */
const TEMPO_DO_DESFAZER = 5000;
/** O toast "Adicionado à sacola" fica o bastante para ler e tocar. */
const TEMPO_DO_TOAST = 4500;

export type ValoresDaSacola = {
  /** Total de cada linha, na ordem da sacola. */
  linhas: number[];
  subtotal: number;
  /** Quanto a sacola sai no Pix (subtotal − desconto), ou null sem desconto. */
  noPix: number | null;
  pixPct: number;
  prazo: number;
  /** true enquanto a cotação do servidor não chegou. */
  estimativa: boolean;
};

/**
 * Os números da sacola: os do servidor quando a cotação vale para esta
 * sacola; a conta local enquanto ela não chega.
 */
export function valoresDaSacola(sf: StorefrontState): ValoresDaSacola {
  const pixPct = Number((sf.store as any)?.payment?.pix_discount_pct) || 0;
  const temPix = !!sf.store?.payment?.has_pix;
  const c = sf.cotacao;
  const prazoLoja = Number(sf.store?.sla?.total_estimate_days) || 0;
  if (c) {
    const noPix = temPix && c.total_pix < c.subtotal ? c.total_pix : null;
    return {
      linhas: c.itens.map((i) => i.total),
      subtotal: c.subtotal,
      noPix,
      pixPct,
      prazo: c.prazo_dias_uteis || prazoLoja,
      estimativa: false,
    };
  }
  const subtotal = subtotalDaSacola(sf.cart);
  const desc = temPix ? descontoDoPix(subtotal, pixPct) : 0;
  return {
    linhas: sf.cart.map((l) => precoDaLinha(l).total),
    subtotal,
    noPix: desc > 0 ? subtotal - desc : null,
    pixPct,
    prazo: prazoLoja,
    estimativa: true,
  };
}

/** "R$ 57,90 cada · inclui R$ 8,00 do verso", em uma linha. */
export function linhaDePreco(l: CartLine, sf: StorefrontState, indice: number): string {
  const p = precoDaLinha(l);
  const det = sf.cotacao?.itens[indice]?.detalhe;
  const unit = sf.cotacao?.itens[indice]?.preco_unitario ?? p.unitario;
  const verso = det ? det.verso : p.verso;
  const meio = det ? det.meio : p.meio;
  const opcoes = det ? det.opcoes : p.opcoes;
  const arte = det ? det.arte : p.arte;
  const faixa = det ? det.faixa : p.faixa;
  const partes = [`${dinheiro(unit)} cada`];
  const inclui: string[] = [];
  if (verso > 0) inclui.push(`${dinheiro(verso)} do verso`);
  if (meio > 0) inclui.push(`${dinheiro(meio)} da faixa central`);
  if (opcoes > 0) inclui.push(`${dinheiro(opcoes)} das opções`);
  if (inclui.length) partes.push("inclui " + inclui.join(" e "));
  if (faixa) partes.push(`faixa de ${faixa.min_qty} un (−${String(faixa.pct).replace(".", ",")}%)`);
  if (arte > 0) partes.push(`+ ${dinheiro(arte)} do serviço de arte, uma vez`);
  return partes.join(" · ");
}

/** A quantidade: − / número digitável / +. */
function Quantidade({ valor, onMudar, nome }: { valor: number; onMudar: (n: number) => void; nome: string }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const [rascunho, setRascunho] = useState(String(valor));
  useEffect(() => { setRascunho(String(valor)); }, [valor]);
  const confirmar = () => {
    const n = Math.floor(Number(rascunho.replace(/\D/g, "")));
    if (!Number.isFinite(n) || n < 1) { setRascunho(String(valor)); return; }
    if (n !== valor) onMudar(n);
  };
  const botao = (icone: string, rotulo: string, fazer: () => void, desligado?: boolean) => (
    <Pressable
      onPress={fazer}
      disabled={desligado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: desligado ? 0.35 : 1 }}
    >
      <Icon name={icone} size={16} color={T.ink} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: BORDA_DE_CAMPO,
        borderRadius: 12, backgroundColor: T.card, height: 46, overflow: "hidden",
      }}
    >
      {botao("minus", "Menos uma de " + nome, () => onMudar(Math.max(1, valor - 1)), valor <= 1)}
      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: T.border }} />
      <TextInput
        value={rascunho}
        onChangeText={(t) => setRascunho(t.replace(/\D/g, "").slice(0, 4))}
        onBlur={confirmar}
        onSubmitEditing={confirmar}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        accessibilityLabel={"Quantidade de " + nome}
        style={[estiloNumero(tipo), { width: 44, textAlign: "center", fontSize: 16, color: T.ink, height: 44 }]}
      />
      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: T.border }} />
      {botao("plus", "Mais uma de " + nome, () => onMudar(valor + 1))}
    </View>
  );
}

function ItemDaSacola({ sf, l, indice, total }: { sf: StorefrontState; l: CartLine; indice: number; total: number }) {
  const T = usePaletaDaVitrine();
  const resumo = resumoDaLinha(l).join(" · ");
  return (
    <View
      testID="item-da-sacola"
      style={{ flexDirection: "row", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.border }}
    >
      <View style={{ alignItems: "center", gap: 6 }}>
        <MiniaturaDaLinha line={l} tamanho={84} corDaLoja={(sf.store as any)?.site?.primary_color} />
        <Pressable
          onPress={() => sf.editCartLine(l)}
          accessibilityRole="button"
          accessibilityLabel={"Editar " + l.product.name}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, paddingHorizontal: 6 }}
        >
          <Icon name="edit" size={14} color={T.ink} />
          <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Editar</Texto>
        </Pressable>
      </View>
      <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Texto style={{ flex: 1, fontSize: 15, fontWeight: "700", color: T.ink }} numberOfLines={2}>{l.product.name}</Texto>
          <Pressable
            onPress={() => sf.removeCartLine(l.lineId)}
            accessibilityRole="button"
            accessibilityLabel={"Remover " + l.product.name + " da sacola"}
            hitSlop={6}
            style={{ width: 36, height: 36, marginTop: -8, marginRight: -8, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="trash" size={16} color={T.ink3} />
          </Pressable>
        </View>
        {resumo ? <Texto style={{ fontSize: 13, color: T.ink2, lineHeight: 18 }}>{resumo}</Texto> : null}
        <Numero style={{ fontSize: 12, color: T.ink3, lineHeight: 17 }}>{linhaDePreco(l, sf, indice)}</Numero>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
          <Quantidade valor={l.qty} nome={l.product.name} onMudar={(n) => sf.setCartLineQty(l.lineId, n)} />
          <Numero style={{ fontSize: 15.5, fontWeight: "700", color: T.ink }}>{dinheiro(total)}</Numero>
        </View>
      </View>
    </View>
  );
}

/** A sacola vazia, com voz (Tela 1, "Vazia"). */
function SacolaVazia({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const categorias = (sf.vitrine || []).filter((e: any) => e.kind === "category").slice(0, 2) as any[];
  const abrir = (e: any) => {
    sf.fecharSacola();
    sf.abrirGrupo(e.category, e.products);
  };
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 20, gap: 12 }} testID="sacola-vazia">
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: FUNDO_APAGADO, alignItems: "center", justifyContent: "center" }}>
        <Icon name="shopping_bag" size={28} color={T.ink} />
      </View>
      <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 22, color: T.ink, textAlign: "center" }}>
        Sua sacola está vazia
      </Texto>
      <Texto style={{ fontSize: 14.5, lineHeight: 22, color: T.ink2, textAlign: "center", maxWidth: 320 }}>
        Escolha uma peça e deixe com a sua cara. A gente mostra como fica antes de produzir.
      </Texto>
      <View style={{ marginTop: 6, minWidth: 180 }}>
        <Botao
          titulo={categorias[0] ? "Ver " + artigo(categorias[0].category?.name) : "Ver a loja"}
          onPress={() => (categorias[0] ? abrir(categorias[0]) : (sf.fecharSacola(), sf.goTo("list")))}
        />
      </View>
      {categorias[1] ? (
        <Pressable onPress={() => abrir(categorias[1])} accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }}>
          <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>
            {"Ver " + artigo(categorias[1].category?.name)}
          </Texto>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Canecas" → "as canecas" (plural em -s é o caso de toda categoria da loja). */
function artigo(nome: string | null | undefined): string {
  const n = String(nome || "").trim();
  if (!n) return "a loja";
  const minusculo = n.charAt(0).toLowerCase() + n.slice(1);
  return (/s$/i.test(n) ? "as " : "") + minusculo;
}

/** O rodapé: totais, prazo e "Finalizar compra" (ou o orçamento, loja fechada). */
function RodapeDaSacola({ sf, v }: { sf: StorefrontState; v: ValoresDaSacola }) {
  const T = usePaletaDaVitrine();
  const modo = modoDaVitrine(sf.store);
  const linkWhats = linkDoOrcamentoDoCarrinho({
    numero: (sf.store?.site as any)?.whatsapp,
    linhas: sf.cart,
    nomeDaLoja: sf.store?.site?.name,
  });
  const linha = (rotulo: string, valor: string, cor?: string, fracoValor?: boolean) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
      <Texto style={{ fontSize: 14.5, color: cor || T.ink2 }}>{rotulo}</Texto>
      {fracoValor
        ? <Texto style={{ fontSize: 13.5, color: T.ink3 }}>{valor}</Texto>
        : <Numero style={{ fontSize: 15, fontWeight: "600", color: cor || T.ink }}>{valor}</Numero>}
    </View>
  );
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, gap: 9, backgroundColor: T.card }}>
      {!modo.aceita ? (
        <Nota tom="ambar" icone="calendar" testID="sacola-fechada">{modo.recado}</Nota>
      ) : null}
      {linha("Subtotal", dinheiro(v.subtotal))}
      {v.noPix != null ? linha(`No Pix (${String(v.pixPct).replace(".", ",")}% off)`, dinheiro(v.noPix), T.green) : null}
      {modo.aceita ? linha("Frete", "calculado no próximo passo", undefined, true) : null}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 2 }}>
        <Icon name="clock" size={15} color={T.ink2} />
        <Texto style={{ fontSize: 13.5, color: T.ink2, flex: 1 }}>
          Pronto em {diasUteis(v.prazo)} após a aprovação da arte.
        </Texto>
      </View>
      <View style={{ marginTop: 6 }}>
        {modo.aceita ? (
          <Botao
            testID="finalizar-compra"
            titulo="Finalizar compra"
            iconeDepois="arrow_right"
            onPress={() => {
              // begin_checkout sai do checkout ao montar (uma vez por visita),
              // como no checkout de hoje — aqui seria medir duas vezes.
              sf.fecharSacola();
              sf.goTo("checkout");
            }}
          />
        ) : (
          <BotaoOrcamentoDaSacola sf={sf} onAntes={sf.fecharSacola} />
        )}
      </View>
      {modo.aceita && linkWhats ? (
        <Pressable
          onPress={() => Linking.openURL(linkWhats)}
          accessibilityRole="link"
          accessibilityLabel="Prefere fechar pelo WhatsApp? Mandar a sacola para a loja"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 }}
        >
          <Icon name="whatsapp" size={15} color={T.ink2} />
          <Texto style={{ fontSize: 13.5, fontWeight: "600", color: T.ink2, textDecorationLine: "underline", textAlign: "center" }}>
            Prefere fechar pelo WhatsApp? Mandar a sacola
          </Texto>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A faixa "saiu da sacola · Desfazer", por 5 segundos. */
function Desfazer({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const r = sf.removida;
  useEffect(() => {
    if (!r) return;
    const t = setTimeout(() => sf.esquecerRemocao(), TEMPO_DO_DESFAZER);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.n]);
  if (!r) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: 16, marginTop: 10, borderRadius: 12, backgroundColor: T.ink,
        flexDirection: "row", alignItems: "center", paddingLeft: 14, gap: 10,
      }}
    >
      <Texto style={{ flex: 1, color: T.bg, fontSize: 13.5 }} numberOfLines={2}>
        {r.line.product.name} saiu da sacola
      </Texto>
      <Pressable
        onPress={sf.desfazerRemocao}
        accessibilityRole="button"
        accessibilityLabel={"Desfazer: devolver " + r.line.product.name + " para a sacola"}
        style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: "center" }}
      >
        <Texto style={{ color: T.bg, fontSize: 14, fontWeight: "800", textDecorationLine: "underline" }}>Desfazer</Texto>
      </Pressable>
    </View>
  );
}

/**
 * O toast "Adicionado à sacola" (Tela 1, "Acabou de adicionar"): a
 * miniatura da peça, o resumo e o "Ver sacola". A cliente continua na
 * peça; se quiser outra igual para a irmã, a personalização está ali.
 */
export function AvisoDeAdicionado({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const a = sf.adicionado;
  useEffect(() => {
    if (!a) return;
    const t = setTimeout(() => sf.limparAdicionado(), TEMPO_DO_TOAST);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.n]);
  if (!a || sf.sacolaAberta) return null;
  const l = sf.cart.find((x) => x.lineId === a.lineId);
  if (!l) return null;
  const resumo = resumoDaLinha(l).slice(0, 2).join(" · ");
  const tinta = tintaSobre(T.ink);
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 8, left: 12, right: 12, zIndex: 80, alignItems: "center" }}>
      <View
        testID="aviso-adicionado"
        accessibilityLiveRegion="polite"
        accessibilityRole={"status" as any}
        style={{
          width: "100%", maxWidth: 460, backgroundColor: T.ink, borderRadius: 16,
          flexDirection: "row", alignItems: "center", gap: 12, padding: 10,
          boxShadow: "0 24px 60px -20px rgba(26,23,20,.35)",
        } as any}
      >
        <MiniaturaDaLinha line={l} tamanho={48} corDaLoja={(sf.store as any)?.site?.primary_color} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto style={{ color: tinta, fontSize: 14.5, fontWeight: "700" }}>Adicionado à sacola</Texto>
          <Texto style={{ color: tinta, opacity: 0.78, fontSize: 12.5 }} numberOfLines={2}>
            {l.product.name}{resumo ? " · " + resumo : ""}
          </Texto>
        </View>
        <Pressable
          onPress={sf.abrirSacola}
          accessibilityRole="button"
          style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: wash(tinta, 0.14), justifyContent: "center" }}
        >
          <Texto style={{ color: tinta, fontSize: 13.5, fontWeight: "700" }}>Ver sacola</Texto>
        </Pressable>
      </View>
    </View>
  );
}

/** O ícone da sacola com a contagem, para os cabeçalhos (só com a chave). */
export function BotaoDaSacola({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  if (!sf.vitrineV2) return null;
  const n = pecasNaSacola(sf.cart);
  return (
    <Pressable
      testID="botao-da-sacola"
      onPress={sf.abrirSacola}
      accessibilityRole="button"
      accessibilityLabel={n ? `Sua sacola, ${n} ${n === 1 ? "peça" : "peças"}` : "Sua sacola, vazia"}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="shopping_bag" size={21} color={T.ink} />
      {n > 0 ? (
        <View
          style={{
            position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9,
            paddingHorizontal: 5, backgroundColor: tema.marcaFill, alignItems: "center", justifyContent: "center",
          }}
        >
          <Numero style={{ color: tema.sobreMarca, fontSize: 10.5, fontWeight: "700" }}>{n}</Numero>
        </View>
      ) : null}
    </Pressable>
  );
}

/** A gaveta. Monta sempre que a chave está ligada; desenha quando aberta. */
export function SacolaEmGaveta({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const lateral = width >= 900;
  const fecharRef = useRef<any>(null);

  // Esc fecha, como toda gaveta do navegador.
  useEffect(() => {
    if (!sf.sacolaAberta || Platform.OS !== "web" || typeof document === "undefined") return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") sf.fecharSacola(); };
    document.addEventListener("keydown", tecla);
    try { fecharRef.current?.focus?.(); } catch { /* sem foco programático */ }
    return () => document.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sf.sacolaAberta]);

  if (!sf.vitrineV2) return null;
  const aviso = <AvisoDeAdicionado sf={sf} />;
  if (!sf.sacolaAberta) return aviso;

  const v = valoresDaSacola(sf);
  const n = pecasNaSacola(sf.cart);

  return (
    <>
      {aviso}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} testID="sacola-em-gaveta">
        <Pressable
          onPress={sf.fecharSacola}
          accessibilityRole="button"
          accessibilityLabel="Fechar sacola"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: wash(T.ink, 0.42) }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel="Sua sacola"
          style={[
            { position: "absolute", backgroundColor: T.bg, overflow: "hidden" },
            lateral
              ? { top: 0, bottom: 0, right: 0, width: 440, boxShadow: "0 24px 60px -20px rgba(26,23,20,.35)" } as any
              : { left: 0, right: 0, bottom: 0, maxHeight: "92%", borderTopLeftRadius: 22, borderTopRightRadius: 22 },
          ]}
        >
          {!lateral ? (
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: BORDA_DE_CAMPO }} />
            </View>
          ) : null}
          <View
            style={{
              flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
              paddingTop: lateral ? 18 : 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8,
            }}
          >
            <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 23, color: T.ink }}>
              Sua sacola
            </Texto>
            {n > 0 ? (
              <Numero style={{ fontSize: 12, letterSpacing: 1, color: T.ink3, marginTop: 4 }}>
                {n} {n === 1 ? "peça" : "peças"}
              </Numero>
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable
              ref={fecharRef}
              onPress={sf.fecharSacola}
              accessibilityRole="button"
              accessibilityLabel="Fechar sacola"
              style={{ width: 44, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="x" size={21} color={T.ink} />
            </Pressable>
          </View>
          <Desfazer sf={sf} />
          {sf.cart.length === 0 ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <SacolaVazia sf={sf} />
            </ScrollView>
          ) : (
            <>
              <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {sf.cart.map((l, i) => (
                  <ItemDaSacola key={l.lineId} sf={sf} l={l} indice={i} total={v.linhas[i] ?? precoDaLinha(l).total} />
                ))}
              </ScrollView>
              <RodapeDaSacola sf={sf} v={v} />
            </>
          )}
        </View>
      </View>
    </>
  );
}
