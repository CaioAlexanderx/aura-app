// ============================================================
// AURA STUDIO · StudioShell — Sidebar desktop (flutuante)
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Renderiza apenas o branch desktop (isWide). Composição de:
//   FloatingBubble (brand) → NavCircle (Início + grupos + Config)
//   + ChildBubble (click) / ChildHoverBubble (hover) por grupo
//   + avatar
//
// Mantém comportamento atual; Fase 5 trocará pela sidebar docada.
//
// 31/05/2026 (Fase 3): StudioThemeToggle removido — passou pra Topbar.
// Aposentadoria da rail flutuante adiada pra Fase 5 (confirmação Caio).
// ============================================================
import { useMemo, useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { AuraStudioMark } from "@/components/studio/AuraStudioMark";
import { FloatingBubble } from "./FloatingBubble";
import { NavCircle } from "./NavCircle";
import { ChildBubble, ChildHoverBubble } from "./ChildBubble";
import { GROUPS } from "./types";
import { makeStyles } from "./styles";

function initials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Sidebar({
  pathname,
  isHome,
  floatPause,
  userName,
  go,
}: {
  pathname: string;
  isHome: boolean;
  floatPause: boolean;
  userName?: string | null;
  go: (href: string) => void;
}) {
  const tk = useStudioTokens();
  const s = useMemo(() => makeStyles(tk), [tk]);

  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  const closeHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelCloseHover = () => {
    if (closeHoverTimerRef.current) {
      clearTimeout(closeHoverTimerRef.current);
      closeHoverTimerRef.current = null;
    }
  };
  const scheduleCloseHover = (groupId: string) => {
    cancelCloseHover();
    closeHoverTimerRef.current = setTimeout(() => {
      setHoveredGroupId((prev) => (prev === groupId ? null : prev));
    }, 200);
  };
  useEffect(() => () => cancelCloseHover(), []);

  function navigate(href: string) {
    go(href);
    setOpenGroup(null);
    setHoveredGroupId(null);
    cancelCloseHover();
  }

  return (
    <View style={s.sidebar}>
      <FloatingBubble idx={0} pause={floatPause} style={{ marginBottom: 18 }}>
        <Pressable
          onPress={() => navigate("/studio")}
          accessibilityLabel="Ir para início do Aura Studio"
          accessibilityRole="button"
          style={s.brandWrap}
        >
          <AuraStudioMark size={60} />
        </Pressable>
      </FloatingBubble>

      <NavCircle
        icon="grid"
        active={isHome}
        idx={1}
        pause={floatPause}
        accessibilityLabel="Início do Aura Studio"
        onPress={() => navigate("/studio")}
      />

      {GROUPS.map((g, i) => {
        const open = openGroup === i;
        const childActive = g.children.some((c) => pathname.startsWith(c.href));
        const isHovered = hoveredGroupId === g.id;
        const showHoverChildren =
          Platform.OS === "web" && isHovered && !open;
        const groupLabel = `Área ${g.label} — ${g.children.map((c) => c.label).join(", ")}`;
        const childContainerHoverProps: any =
          Platform.OS === "web"
            ? {
                onMouseEnter: cancelCloseHover,
                onMouseLeave: () => scheduleCloseHover(g.id),
              }
            : {};
        return (
          <View key={g.label} style={{ position: "relative" }}>
            <NavCircle
              icon={g.icon}
              idx={i + 2}
              active={open || childActive}
              glowing={isHovered}
              isGroup
              pause={floatPause}
              accessibilityLabel={groupLabel}
              onHoverIn={() => {
                cancelCloseHover();
                setHoveredGroupId(g.id);
              }}
              onHoverOut={() => scheduleCloseHover(g.id)}
              onPress={() => setOpenGroup(open ? null : i)}
            >
              {open && (
                <View style={s.childrenPop}>
                  <View style={s.childrenInner}>
                    {g.children.map((c, ci) => (
                      <ChildBubble
                        key={c.href}
                        child={c}
                        idx={ci}
                        tone={g.toneKey}
                        pause={floatPause}
                        onPress={() => navigate(c.href)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </NavCircle>

            {showHoverChildren && (
              <View
                style={s.childBubblesContainer}
                {...childContainerHoverProps}
              >
                {g.children.map((c, ci) => (
                  <ChildHoverBubble
                    key={c.href}
                    child={c}
                    tone={g.toneKey}
                    delay={ci * 60}
                    onPress={() => navigate(c.href)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ flex: 1 }} />

      <NavCircle
        icon="settings"
        idx={6}
        pause={floatPause}
        active={pathname.startsWith("/studio/configuracoes")}
        accessibilityLabel="Configurações do Studio"
        onPress={() => navigate("/studio/configuracoes")}
      />

      <View style={s.avatar} accessibilityLabel="Avatar do usuário">
        <Text style={s.avatarTxt}>{initials(userName)}</Text>
      </View>
    </View>
  );
}
