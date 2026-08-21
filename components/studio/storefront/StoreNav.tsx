// ============================================================
// AURA STUDIO · vitrine — barra de navegação por categoria
//
// Até aqui a vitrine não tinha navegação: o cliente rolava a lista inteira
// ou desistia. Numa loja de 3 categorias isso passa; na Finesse, com 28,
// não passa.
//
// A barra segue o formato REAL dos dados (ver storeNavModel): plano e
// numeroso. Ela abre em colunas quando existe hierarquia, mas não depende
// disso para ter serventia — hoje nenhuma loja em produção tem árvore.
//
// PALETA: usa o `T` atual de propósito. A virada para o tema novo é da
// fase 03; uma barra já no visual novo, cercada de telas no antigo, ficaria
// pior do que o problema que resolve. O que já muda aqui é a COR DA LOJA
// marcando o item ativo — a marca dela avançando uma casa.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions, Platform, Animated, Easing } from "react-native";
import { AURA } from "./theme";
import { T } from "./types";
import type { ItemMenu, Menu } from "./storeNavModel";

type Props = {
  menu: Menu;
  /** Categoria ativa, ou null para "Tudo". */
  ativa: ItemMenu | null;
  onSelect: (item: ItemMenu | null) => void;
  /** Cor da loja — marca o item ativo. */
  primary?: string;
};

export function StoreNav({ menu, ativa, onSelect, primary }: Props) {
  const { width } = useWindowDimensions();
  const telaLarga = width >= 720;
  const cor = primary || T.primary;
  const [aberto, setAberto] = useState<string | null>(null);

  if (menu.vazio) return null;

  const fechar = () => setAberto(null);

  // ── Item da barra ─────────────────────────────────────────
  function Item({ item, ehExtra }: { item: ItemMenu | null; ehExtra?: boolean }) {
    const sel = item === null ? ativa === null : ativa?.id === item.id;
    const temFilhas = !!item && item.filhas.length > 0;
    const rotulo = item === null ? "Tudo" : item.name;

    return (
      <Pressable
        onPress={() => {
          onSelect(item);
          // Categoria com filhas: o toque abre as opções em vez de só
          // filtrar. No celular não há hover, e sem isto as subcategorias
          // ficariam inalcançáveis.
          if (temFilhas && !telaLarga) setAberto(aberto === item!.id ? null : item!.id);
          else fechar();
        }}
        onHoverIn={temFilhas && telaLarga ? () => setAberto(item!.id) : undefined}
        onHoverOut={temFilhas && telaLarga ? fechar : undefined}
        accessibilityRole="button"
        accessibilityState={{ selected: sel, expanded: temFilhas ? aberto === item?.id : undefined }}
        accessibilityLabel={
          item === null ? "Ver todos os produtos" : `${item.name}, ${item.total} ${item.total === 1 ? "produto" : "produtos"}`
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: ehExtra ? 14 : 12,
          paddingVertical: ehExtra ? 10 : 9,
          borderRadius: ehExtra ? 8 : 999,
          backgroundColor: sel && !ehExtra ? cor : "transparent",
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            fontWeight: sel ? "800" : "600",
            color: sel && !ehExtra ? "#fff" : T.ink2,
          }}
        >
          {rotulo}
        </Text>
        {item !== null && (
          <Text
            style={{
              fontSize: 11,
              fontVariant: ["tabular-nums"],
              color: sel && !ehExtra ? "rgba(255,255,255,0.75)" : T.ink4,
            }}
          >
            {item.total}
          </Text>
        )}
        {temFilhas && telaLarga && (
          <Text style={{ fontSize: 9, color: sel ? "rgba(255,255,255,0.8)" : T.ink4 }}>▾</Text>
        )}
      </Pressable>
    );
  }

  // ── Painel que abre (subcategorias ou "Mais") ─────────────
  function Painel({ itens, titulo }: { itens: ItemMenu[]; titulo?: string }) {
    // Colunas como no varejo grande: a lista quebra em 4 por coluna antes
    // de virar uma tira vertical interminável.
    const porColuna = 5;
    const colunas: ItemMenu[][] = [];
    for (let i = 0; i < itens.length; i += porColuna) colunas.push(itens.slice(i, i + porColuna));

    return (
      <View
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          backgroundColor: T.card,
          borderTopWidth: 1,
          borderTopColor: T.border,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
          paddingVertical: 18,
          paddingHorizontal: 20,
          zIndex: 50,
          ...(Platform.OS === "web"
            ? ({ boxShadow: "0 12px 24px -12px rgba(15,23,42,0.18)" } as any)
            : { shadowColor: "#0F172A", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }),
        }}
      >
        <View style={{ width: "100%", maxWidth: 980, alignSelf: "center", gap: 12 }}>
          {titulo ? (
            <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: T.ink3 }}>
              {titulo}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 28, flexWrap: "wrap" }}>
            {colunas.map((coluna, ci) => (
              <View key={ci} style={{ gap: 2, minWidth: 150 }}>
                {coluna.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => { onSelect(f); fechar(); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.name}, ${f.total} ${f.total === 1 ? "produto" : "produtos"}`}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      gap: 12, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 7,
                      backgroundColor: pressed ? T.bg : "transparent",
                    })}
                  >
                    <Text style={{ fontSize: 13.5, color: T.ink, fontWeight: "600" }}>{f.name}</Text>
                    <Text style={{ fontSize: 11.5, color: T.ink4, fontVariant: ["tabular-nums"] }}>{f.total}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const abertoItem = menu.itens.find((i) => i.id === aberto) || null;
  const mostrandoExtras = aberto === "__mais__";

  // ── Movimento ─────────────────────────────────────────────
  // O painel aparecia e sumia de uma vez, sem transicao — o olho perde o
  // rastro e a navegacao parece piscar. Aqui ele entra descendo 6px e
  // some subindo, na curva unica do design system (220ms).
  //
  // O conteudo fica montado durante a saida, senao o fade-out nao teria o
  // que desenhar.
  const anim = useRef(new Animated.Value(0)).current;
  const [renderizado, setRenderizado] = useState<{ itens: ItemMenu[]; titulo: string } | null>(null);

  const alvo = mostrandoExtras
    ? { itens: menu.extras, titulo: "Todas as categorias" }
    : abertoItem && abertoItem.filhas.length > 0
    ? { itens: abertoItem.filhas, titulo: abertoItem.name }
    : null;
  const chaveAlvo = alvo ? alvo.titulo : "";

  useEffect(() => {
    // Quem pediu pra nao ver animacao nao ve: o sistema manda movimento
    // com proposito, e proposito nenhum justifica ignorar isso.
    const semMovimento =
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (alvo) {
      setRenderizado(alvo);
      if (semMovimento) { anim.setValue(1); return; }
      Animated.timing(anim, {
        toValue: 1, duration: AURA.motion.base, easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (semMovimento) { anim.setValue(0); setRenderizado(null); return; }
    Animated.timing(anim, {
      toValue: 0, duration: AURA.motion.fast, easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setRenderizado(null); });
    // chaveAlvo troca quando o cliente pula de uma categoria pra outra
    // sem fechar: o painel refaz a entrada em vez de trocar seco.
  }, [chaveAlvo, anim]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={{ backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.border, zIndex: 40 }}
      // Sair da barra inteira fecha o painel: sem isto ele fica preso
      // aberto quando o ponteiro passa direto para a lista. `onMouseLeave`
      // existe no react-native-web mas nao no tipo do View, entao entra
      // por spread.
      {...(Platform.OS === "web" ? ({ onMouseLeave: fechar } as any) : {})}
    >
      <View style={{ width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: telaLarga ? 20 : 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: telaLarga ? 0 : 14,
            paddingVertical: 6,
          }}
        >
          <Item item={null} />
          {menu.itens.map((i) => <Item key={i.id} item={i} />)}

          {menu.extras.length > 0 && (
            <Pressable
              onPress={() => setAberto(mostrandoExtras ? null : "__mais__")}
              onHoverIn={telaLarga ? () => setAberto("__mais__") : undefined}
              accessibilityRole="button"
              accessibilityState={{ expanded: mostrandoExtras }}
              accessibilityLabel={`Mais ${menu.extras.length} categorias`}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
                borderWidth: 1, borderColor: T.border,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: T.ink2 }}>
                Mais {menu.extras.length}
              </Text>
              <Text style={{ fontSize: 9, color: T.ink4 }}>▾</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {renderizado ? (
        <Animated.View
          style={{
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          }}
        >
          <Painel itens={renderizado.itens} titulo={renderizado.titulo} />
        </Animated.View>
      ) : null}
    </View>
  );
}
