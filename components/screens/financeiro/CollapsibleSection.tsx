// ============================================================
// AURA. — CollapsibleSection
// Header acordeao com titulo + chevron pra recolher/expandir secao.
// Usado na TabVisaoGeral pra deixar a home do Financeiro mais limpa
// (cliente pediu em 06/05/2026).
//
// Estado persistido em localStorage por id, com fallback pro
// defaultExpanded quando rodando fora do browser ou sem storage.
// Animacao: render condicional simples — sem layout animation pra
// evitar reflow caro em cards grandes (cashflow, DRE).
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const STORAGE_PREFIX = "aura.financeiro.collapsible.";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  rightAccessory?: React.ReactNode;
  children: React.ReactNode;
};

function getInitial(id: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    var raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function persist(id: string, expanded: boolean) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, expanded ? "1" : "0");
  } catch {
    // storage cheio ou desabilitado — silencioso
  }
}

export function CollapsibleSection({
  id, title, subtitle, defaultExpanded = false, rightAccessory, children,
}: Props) {
  const [expanded, setExpanded] = useState<boolean>(function() {
    return getInitial(id, defaultExpanded);
  });

  useEffect(function() {
    persist(id, expanded);
  }, [id, expanded]);

  function toggle() { setExpanded(function(v) { return !v; }); }

  return (
    <View style={s.section}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={(expanded ? "Recolher " : "Expandir ") + title}
        accessibilityState={{ expanded: expanded }}
        style={({ hovered, pressed }: any) => [
          s.header,
          Platform.OS === "web" && hovered ? s.headerHover : null,
          pressed ? s.headerPressed : null,
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {rightAccessory ? <View style={s.accessory}>{rightAccessory}</View> : null}
        <View style={[s.chevWrap, expanded ? s.chevWrapOpen : null]}>
          <Icon name={expanded ? "chevron_down" : "chevron_right"} size={16} color={expanded ? Colors.violet3 : Colors.ink3} />
        </View>
      </Pressable>
      {expanded && <View style={s.body}>{children}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === "web" ? ({ cursor: "pointer", transition: "border-color 0.15s ease, background-color 0.15s ease" } as any) : {}),
  },
  headerHover: { borderColor: Colors.border2, backgroundColor: Colors.bg4 },
  headerPressed: { opacity: 0.85 },
  title: { fontSize: 13, color: Colors.ink, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2, fontWeight: "500" },
  accessory: { flexShrink: 0 },
  chevWrap: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border,
  },
  chevWrapOpen: {
    backgroundColor: Colors.violetD,
    borderColor: Colors.border2,
  },
  body: { marginTop: 12 },
});

export default CollapsibleSection;
