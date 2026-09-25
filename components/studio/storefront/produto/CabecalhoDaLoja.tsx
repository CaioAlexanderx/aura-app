// ============================================================
// components/studio/storefront/produto/CabecalhoDaLoja.tsx
//
// O cabeçalho da página do produto e da grade de modelos nova (Telas 1
// e 9 do mockup). Sai o de hoje ("Personalize", selo azul "Estúdio ·
// Arte personalizada", seta sem rótulo): no celular, voltar · nome da
// loja · busca · sacola; no desktop, nome · categorias · busca · sacola.
//
// A sacola abre a gaveta da Fase 2 quando ela existe (sf.abrirSacola);
// sem ela, leva ao checkout, que é onde a sacola de hoje mora. O
// contador pulsa quando entra peça.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import type { StorefrontState } from "../useStorefront";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { BotaoIcone, transicao, usePulso } from "./kitDaPagina";

/** Peças na sacola (soma das quantidades). */
export function pecasNaSacola(sf: StorefrontState): number {
  return (sf.cart || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
}

/** Abre a sacola: a gaveta da Fase 2 quando existe; senão, o checkout. */
export function abrirASacola(sf: StorefrontState) {
  const gaveta = (sf as any).abrirSacola;
  if (typeof gaveta === "function") { gaveta(); return; }
  if (sf.cart.length) sf.goTo("checkout");
}

export function CabecalhoDaLoja({
  sf, desktop, onVoltar, categoriaAtiva, linhaEmbaixo,
}: {
  sf: StorefrontState;
  desktop: boolean;
  onVoltar?: () => void;
  /** A chave da categoria em destaque na navegação do desktop. */
  categoriaAtiva?: string | null;
  linhaEmbaixo?: boolean;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const nome = String((sf.store as any)?.site?.name || "");
  const n = pecasNaSacola(sf);
  const antes = useRef(n);
  const [gatilho, setGatilho] = useState(0);
  useEffect(() => {
    if (n > antes.current) setGatilho((g) => g + 1);
    antes.current = n;
  }, [n]);
  const pulsa = usePulso(gatilho, 600);

  const categorias = (sf.vitrine || []).filter((e: any) => e.kind === "category").slice(0, 5) as any[];

  const sacola = (
    <View>
      <BotaoIcone icone="shopping_bag" rotulo={n ? `Abrir a sacola, ${n} ${n === 1 ? "peça" : "peças"}` : "Abrir a sacola"} onPress={() => abrirASacola(sf)} testID="botao-da-sacola" />
      {n > 0 ? (
        <View
          pointerEvents="none"
          testID="contador-da-sacola"
          style={[{
            position: "absolute", top: 6, right: 5, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
            backgroundColor: t.marcaFill, alignItems: "center", justifyContent: "center",
            transform: [{ scale: pulsa ? 1.35 : 1 }],
          }, transicao("transform", 300)]}
        >
          <Numero style={{ fontSize: 10.5, lineHeight: 18, fontWeight: "700", color: t.sobreMarca }}>{n}</Numero>
        </View>
      ) : null}
    </View>
  );

  if (!desktop) {
    return (
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: linhaEmbaixo ? t.border : "transparent" }}>
        {onVoltar ? <BotaoIcone icone="chevron_left" rotulo="Voltar" onPress={onVoltar} /> : <View style={{ width: 44 }} />}
        <Pressable style={{ flex: 1, alignItems: "center" }} onPress={() => sf.goTo("list")} accessibilityRole="link" accessibilityLabel={`${nome}, página inicial`}>
          <Texto numberOfLines={1} style={{ fontFamily: tipo.display, fontSize: 20, color: t.marcaTexto, letterSpacing: -0.2 }}>{nome}</Texto>
        </Pressable>
        <BotaoIcone icone="search" rotulo="Buscar na loja" onPress={() => sf.goTo("list")} />
        {sacola}
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center", height: 64, paddingHorizontal: 40, flexDirection: "row", alignItems: "center", gap: 36 }}>
        <Pressable onPress={() => sf.goTo("list")} accessibilityRole="link" accessibilityLabel={`${nome}, página inicial`}>
          <Texto numberOfLines={1} style={{ fontFamily: tipo.display, fontSize: 24, color: t.marcaTexto, letterSpacing: -0.2 }}>{nome}</Texto>
        </Pressable>
        <View accessibilityRole={"navigation" as any} accessibilityLabel="Categorias" style={{ flexDirection: "row", gap: 4, flexShrink: 1 }}>
          {categorias.map((c) => {
            const chave = String(c.category?.slug || c.category?.id || "");
            const ativa = !!categoriaAtiva && chave === categoriaAtiva;
            return (
              <Pressable
                key={chave}
                onPress={() => sf.abrirGrupo(c.category, c.products)}
                accessibilityRole="link"
                accessibilityState={{ selected: ativa }}
                style={({ hovered }: any) => ({ minHeight: 44, paddingHorizontal: 10, borderRadius: 10, justifyContent: "center", backgroundColor: hovered ? t.bg3 : "transparent" })}
              >
                <Texto style={{ fontSize: 14, color: ativa ? t.ink : t.ink2, fontWeight: ativa ? "600" : "400" }}>{c.category?.name}</Texto>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => sf.goTo("list")}
          accessibilityRole="search"
          accessibilityLabel="Buscar na loja"
          style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8, height: 42, width: 260, borderRadius: 999, backgroundColor: t.bg3, paddingHorizontal: 16, ...(Platform.OS === "web" ? ({ cursor: "text" } as any) : null) }}
        >
          <Icon name="search" size={16} color={t.ink3} />
          <Texto style={{ fontSize: 13.5, color: t.ink3 }}>Buscar na loja</Texto>
        </Pressable>
        {sacola}
      </View>
    </View>
  );
}

/**
 * A trilha "Início / Canecas / Alça Coração" (Tela 1). Cada nível leva a
 * uma tela; o último é onde a cliente está.
 */
export function Trilha({ niveis, desktop }: { niveis: Array<{ rotulo: string; onPress?: () => void }>; desktop: boolean }) {
  const t = useTemaDaVitrine();
  return (
    <View accessibilityRole={"navigation" as any} accessibilityLabel="Você está em" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, paddingHorizontal: desktop ? 0 : 16, paddingBottom: 4 }}>
      {niveis.map((n, i) => {
        const ultimo = i === niveis.length - 1;
        return (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {ultimo || !n.onPress ? (
              <Texto accessibilityRole={ultimo ? ("text" as any) : undefined} numberOfLines={1} style={{ fontSize: 12.5, color: ultimo ? t.ink2 : t.ink3, fontWeight: ultimo ? "500" : "400", maxWidth: 240 }}>{n.rotulo}</Texto>
            ) : (
              <Pressable onPress={n.onPress} accessibilityRole="link" style={{ minHeight: 40, justifyContent: "center" }}>
                <Texto style={{ fontSize: 12.5, color: t.ink3 }}>{n.rotulo}</Texto>
              </Pressable>
            )}
            {!ultimo ? <Texto style={{ fontSize: 12.5, color: t.ink4 }}>/</Texto> : null}
          </View>
        );
      })}
    </View>
  );
}
