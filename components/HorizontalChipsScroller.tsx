import { useRef, useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

const isWeb = Platform.OS === "web";
const SCROLL_STEP = 200;

type Props = {
  children: React.ReactNode;
  /** Step em pixels por clique nas setas. Default 200. */
  scrollStep?: number;
  /** Estilo extra no contentContainer (gap/padding). */
  contentContainerStyle?: any;
};

/**
 * HorizontalChipsScroller — wrapper de ScrollView horizontal com setas
 * de navegação esquerda/direita visíveis APENAS no web (Platform === "web")
 * e somente quando há overflow naquele lado.
 *
 * Por que existe: chips de categoria/unidade nos forms de produto/serviço
 * eram ScrollView puros — no browser desktop o usuário precisava arrastar
 * com o mouse pra ver chips fora da tela, o que não é amigável. Setas
 * resolvem isso sem afetar UX mobile (que usa scroll por gesto nativo).
 *
 * Diferente do ScrollableChips (que renderiza os chips internamente a
 * partir de uma lista de strings), este wrapper aceita children livres
 * — preserva chips ricos (com cor, dot, "+ Nova" especial, etc).
 */
export function HorizontalChipsScroller({
  children,
  scrollStep = SCROLL_STEP,
  contentContainerStyle,
}: Props) {
  const scrollRef = useRef<any>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function getEl(): any {
    if (!scrollRef.current) return null;
    // RN Web: ScrollView expõe getScrollableNode(); fallback pro próprio ref.
    return (scrollRef.current as any)?.getScrollableNode?.() || scrollRef.current;
  }

  function checkArrows() {
    if (!isWeb) return;
    const el = getEl();
    if (!el || el.scrollLeft === undefined) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    if (!isWeb) return;
    // Espera 1 frame pro layout estabilizar antes de medir overflow.
    const timer = setTimeout(checkArrows, 100);
    return () => clearTimeout(timer);
  }, [children]);

  function scroll(dir: number) {
    const el = getEl();
    if (el?.scrollBy) {
      el.scrollBy({ left: dir * scrollStep, behavior: "smooth" });
      setTimeout(checkArrows, 350);
    }
  }

  return (
    <View style={s.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={isWeb ? checkArrows : undefined}
        scrollEventThrottle={100}
        style={s.scroll}
        contentContainerStyle={[s.content, contentContainerStyle]}
      >
        {children}
      </ScrollView>

      {/* Seta esquerda — overlay com fade pra direita */}
      {isWeb && canLeft && (
        <View pointerEvents="box-none" style={[s.arrowSlot, s.arrowSlotLeft]}>
          <View pointerEvents="none" style={[s.fade, s.fadeLeft]} />
          <Pressable onPress={() => scroll(-1)} style={s.arrow}>
            <Text style={s.arrowText}>{"‹"}</Text>
          </Pressable>
        </View>
      )}

      {/* Seta direita */}
      {isWeb && canRight && (
        <View pointerEvents="box-none" style={[s.arrowSlot, s.arrowSlotRight]}>
          <View pointerEvents="none" style={[s.fade, s.fadeRight]} />
          <Pressable onPress={() => scroll(1)} style={s.arrow}>
            <Text style={s.arrowText}>{"›"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "relative" as any,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    flexDirection: "row",
    gap: 6,
    // Padding pra o último chip não encostar na seta direita quando
    // há overflow. Mesma ideia da esquerda.
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  // Slot que segura o gradient + a seta circular sobreposto ao scroll.
  arrowSlot: {
    position: "absolute" as any,
    top: 0, bottom: 0,
    width: 56,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  arrowSlotLeft: {
    left: 0,
    justifyContent: "flex-start",
  },
  arrowSlotRight: {
    right: 0,
    justifyContent: "flex-end",
  },
  // Fade horizontal pra suavizar a transição entre o chip parcialmente
  // cortado e a seta. No web vira linear-gradient; no native fica só um
  // bloco semi-transparente da cor do bg.
  fade: {
    position: "absolute" as any,
    top: 0, bottom: 0,
    width: 36,
    ...(isWeb
      ? {}
      : { backgroundColor: Colors.bg3, opacity: 0.7 }),
  },
  fadeLeft: {
    left: 0,
    ...(isWeb
      ? ({ background: `linear-gradient(to right, ${Colors.bg3} 30%, transparent)` } as any)
      : {}),
  },
  fadeRight: {
    right: 0,
    ...(isWeb
      ? ({ background: `linear-gradient(to left, ${Colors.bg3} 30%, transparent)` } as any)
      : {}),
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bg4,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
    ...(isWeb
      ? ({ cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" } as any)
      : {}),
  },
  arrowText: {
    fontSize: 18,
    color: Colors.ink,
    fontWeight: "700",
    lineHeight: 20,
  },
});

export default HorizontalChipsScroller;
