// ============================================================
// AURA. -- PDV/Caixa · Glass search box with ⌘K shortcut
// ============================================================
import { useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly } from "./types";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 16/09/2026: a busca tinha `minWidth: 340` fixo. Num 390px isso não
   *  deixava espaço pro chip de estado do leitor ao lado — agora ela ocupa a
   *  linha e o pai decide o limite. */
  maxWidth?: number;
};

export function SearchBox({ value, onChange, placeholder, maxWidth }: Props) {
  const ref = useRef<TextInput | null>(null);

  // Web keyboard shortcut: ⌘K / Ctrl+K focuses the input.
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K";
      if (!isK) return;
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const el: any = ref.current;
        if (el && typeof el.focus === "function") el.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const webBox = webOnly({
    background: Glass.card,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid " + Glass.lineBorderCard,
  });

  return (
    <View style={[s.box, maxWidth ? { maxWidth } : null, Platform.OS === "web" ? (webBox as any) : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}>
      <Icon name="search" size={15} color={Colors.ink3} />
      <TextInput
        ref={ref}
        style={s.input as any}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || "Buscar produto ou código…"}
        placeholderTextColor={Colors.ink3}
      />
      {IS_WEB && <Text style={s.kbd}>⌘K</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    flex: 1,
    minWidth: 0,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    color: Colors.ink,
    fontSize: 13,
    outlineStyle: "none",
    borderWidth: 0 as any,
  } as any,
  kbd: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Glass.lineFaint,
    color: Colors.ink3,
  },
});

export default SearchBox;
