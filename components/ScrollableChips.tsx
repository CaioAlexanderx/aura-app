import { useRef, useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

const isWeb = Platform.OS === "web";
const SCROLL_STEP = 200;

type Props = {
  items: string[];
  active: string;
  onSelect: (item: string) => void;
};

/**
 * ScrollableChips — horizontal chip selector with arrow buttons on desktop.
 * Used in PDV (categories) and Estoque (category filter).
 * Mobile: native horizontal scroll.
 * Desktop: left/right arrow buttons + smooth scroll.
 */
export function ScrollableChips({ items, active, onSelect }: Props) {
  const scrollRef = useRef<any>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function checkArrows() {
    if (!isWeb || !scrollRef.current) return;
    const el = (scrollRef.current as any)?.getScrollableNode?.() || scrollRef.current;
    if (!el || !el.scrollLeft === undefined) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    if (!isWeb) return;
    const timer = setTimeout(checkArrows, 100);
    return () => clearTimeout(timer);
  }, [items]);

  function scroll(dir: number) {
    if (!scrollRef.current) return;
    const el = (scrollRef.current as any)?.getScrollableNode?.() || scrollRef.current;
    if (el?.scrollBy) {
      el.scrollBy({ left: dir * SCROLL_STEP, behavior: "smooth" });
      setTimeout(checkArrows, 350);
    }
  }

  return (
    <View style={s.wrap}>
      {isWeb && canLeft && (
        <Pressable onPress={() => scroll(-1)} style={[s.arrow, s.arrowLeft]}>
          <Text style={s.arrowText}>{"\u2039"}</Text>
        </Pressable>
      )}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={isWeb ? checkArrows : undefined}
        scrollEventThrottle={100}
        style={s.scroll}
        contentContainerStyle={s.chips}
      >
        {items.map(item => (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            style={[s.chip, active === item && s.chipActive]}
          >
            <Text style={[s.chipText, active === item && s.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {isWeb && canRight && (
        <Pressable onPress={() => scroll(1)} style={[s.arrow, s.arrowRight]}>
          <Text style={s.arrowText}>{"\u203A"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    position: "relative" as any,
  },
  scroll: {
    flexGrow: 0,
  },
  chips: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 20,
    paddingLeft: 2,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.violetD,
    borderColor: Colors.border2,
  },
  chipText: {
    fontSize: 12,
    color: Colors.ink3,
    fontWeight: "500",
  },
  chipTextActive: {
    color: Colors.violet3,
    fontWeight: "600",
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  arrowLeft: {
    marginRight: 6,
  },
  arrowRight: {
    marginLeft: 6,
  },
  arrowText: {
    fontSize: 18,
    color: Colors.ink,
    fontWeight: "600",
    lineHeight: 20,
  },
});

export default ScrollableChips;
