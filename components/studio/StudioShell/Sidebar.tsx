// ============================================================
// AURA STUDIO · StudioShell — Sidebar desktop (docada — Fase 5)
//
// 31/05/2026 (Fase 5 batch A): substitui rail flutuante circular
// (com glow + bobbing + bolhas) por sidebar DOCADA/rotulada per
// plano D3.
//
// Modelo:
//   - Expandida ~248px: brand + lista vertical com label
//     (Início, grupos como sections com children indentados,
//     Configurações, avatar)
//   - Recolhida ~76px: só ícones; hover em grupo abre popover
//     à direita listando children
//   - Estado ativo = magenta-soft (accent 10% bg + accent text +
//     barra accent à esquerda)
//   - Toggle de recolher/expandir acima do avatar
//
// API externa preservada (mesmas props). floatPause continua sendo
// passado pelo index mas não é mais usado (mantido pra back-compat
// se algum lugar ainda chamar a API antiga). Glow/bobbing aposentados.
//
// Fade route + reduceMotion gating mora no index.tsx — Sidebar
// só anima a largura.
//
// 31/05/2026 (Fase 5 audit AA): ink4 promovido pra ink3 em texto visível
// (section labels dos grupos, 9px uppercase). ink4 falha 4.5:1 sobre
// paperCard em ambos os temas (light 2.4:1, dark 3.1:1). Active state
// magenta (accent em label sobre rgba(236,72,153,0.10) → 2.99:1 light) é
// residual conhecido — follow-up vai separar accentInk pra texto.
//
// 02/06/2026 (Shell clareza):
//   - NavItem agora aceita `subtitle` e `primary` de NavChild
//   - Porta primária Caixa/PDV recebe destaque visual (left-bar navy + bg tinted)
//   - Subtítulo de 1 linha exibido quando sidebar expandida
//   - Labels e subtítulos derivados de STUDIO_NAV via types.ts (sem strings duplicadas)
//
// 13/06/2026 (fix scroll v1): root recebe flex:1 + miolo do nav vira
//   ScrollView — mas flex:1 dentro de flexDirection:"row" expandia a
//   sidebar horizontalmente. Fix v2: alignSelf:"stretch" dá altura 100%
//   sem afetar a largura (controlada por width: railW).
// ============================================================
import { useMemo, useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Platform, AccessibilityInfo } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { AuraStudioMark } from "@/components/studio/AuraStudioMark";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { Fonts } from "@/constants/fonts";
import { GROUPS } from "./types";

const RAIL_W_EXPANDED = 248;
const RAIL_W_COLLAPSED = 76;

// ─── Motion (Fase 6.1): entrada escalonada + barra ativa, web-only,
// atrás de reduceMotion. Keyframes injetados uma vez no head.
function injectSidebarMotion() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("aura-sb-motion")) return;
  const st = document.createElement("style");
  st.id = "aura-sb-motion";
  st.textContent =
    "@keyframes auraSbIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}" +
    "@keyframes auraSbBar{from{opacity:0;transform:scaleY(0.25)}to{opacity:1;transform:scaleY(1)}}";
  document.head.appendChild(st);
}
function useReduceMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    let m = true;
    AccessibilityInfo.isReduceMotionEnabled().then((e) => { if (m) setRm(!!e); });
    return () => { m = false; };
  }, []);
  return rm;
}
function enterStyle(delay: number, reduced: boolean): any {
  if (Platform.OS !== "web" || reduced) return {};
  return { animation: "auraSbIn .42s cubic-bezier(.4,0,.2,1) both", animationDelay: delay + "ms" };
}

function initials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Sidebar({
  pathname,
  isHome,
  userName,
  go,
  // floatPause preservado pra back-compat com index antigo; ignorado
  // pelo modelo docado.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  floatPause: _floatPause,
}: {
  pathname: string;
  isHome: boolean;
  floatPause?: boolean;
  userName?: string | null;
  go: (href: string) => void;
}) {
  const t = useStudioTokens();
  const [expanded, setExpanded] = useState(true);
  const reduced = useReduceMotion();
  useEffect(() => { injectSidebarMotion(); }, []);

  function navigate(href: string) {
    go(href);
  }

  const railW = expanded ? RAIL_W_EXPANDED : RAIL_W_COLLAPSED;

  return (
    <View
      style={[
        {
          // alignSelf:"stretch" ocupa 100% da altura do container pai (row)
          // sem expandir horizontalmente como faria flex:1 num row container.
          // A largura é controlada exclusivamente por width:railW.
          alignSelf: "stretch",
          width: railW,
          backgroundColor: t.paperCard,
          borderRightWidth: 1,
          borderRightColor: t.ink5,
          paddingTop: 18,
          paddingBottom: 14,
          paddingHorizontal: expanded ? 12 : 10,
          flexDirection: "column",
        },
        Platform.OS === "web" && ({ transition: "width 0.18s ease, padding 0.18s ease" } as any),
      ]}
      accessibilityRole={Platform.OS === "web" ? ("navigation" as any) : undefined}
      accessibilityLabel="Navegação do Studio"
    >
      {/* ─── Brand (fixo no topo) ─── */}
      <Pressable
        onPress={() => navigate("/studio")}
        accessibilityLabel="Ir para início do Aura Studio"
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 6,
          paddingHorizontal: 6,
          marginBottom: 8,
          minHeight: 44,
          flexShrink: 0,
        }}
      >
        <AuraStudioMark size={36} />
        {expanded && (
          <Text
            dataSet={{ auraWm: "true" }}
            style={{ flexShrink: 1, fontFamily: Fonts.heading, fontSize: 22, letterSpacing: -0.5, lineHeight: 24 }}
            numberOfLines={1}
          >
            <Text dataSet={{ auraWm: "true" }} style={{ color: t.ink }}>Aura</Text>
            <Text dataSet={{ auraWm: "true" }} style={{ color: t.ink3 }}> Studio</Text>
            <Text dataSet={{ auraWm: "true" }} style={{ color: t.accent }}>.</Text>
          </Text>
        )}
      </Pressable>

      {/* ─── Nav scrollável — ocupa o espaço restante ─── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 4, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Início ─── */}
        <NavItem
          t={t}
          icon="grid"
          label="Início"
          active={isHome}
          expanded={expanded}
          enterDelay={0}
          reduced={reduced}
          onPress={() => navigate("/studio")}
        />

        {/* ─── Grupos ─── */}
        {GROUPS.map((g, gi) => (
          <GroupSection
            key={g.id}
            t={t}
            group={g}
            pathname={pathname}
            expanded={expanded}
            enterDelay={(gi + 1) * 70}
            reduced={reduced}
            navigate={navigate}
          />
        ))}
      </ScrollView>

      {/* ─── Configurações (fixo) ─── */}
      <NavItem
        t={t}
        icon="settings"
        label="Configurações"
        active={pathname.startsWith("/studio/configuracoes")}
        expanded={expanded}
        enterDelay={(GROUPS.length + 1) * 70}
        reduced={reduced}
        onPress={() => navigate("/studio/configuracoes")}
      />

      {/* ─── Toggle recolher/expandir ─── */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={expanded ? "Recolher menu" : "Expandir menu"}
        accessibilityRole="button"
        style={({ hovered }: any) => [
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: expanded ? "flex-start" : "center",
            gap: 10,
            paddingVertical: 8,
            paddingHorizontal: expanded ? 10 : 8,
            borderRadius: 8,
            marginTop: 6,
            marginBottom: 6,
            minHeight: 36,
          },
          Platform.OS === "web" && ({ cursor: "pointer", transition: "background-color 0.15s ease" } as any),
          hovered && { backgroundColor: t.bgSoft },
        ]}
      >
        <Icon
          name={expanded ? "chevron-left" : "chevron-right"}
          size={14}
          color={t.ink3}
        />
        {expanded && (
          <Text style={{ fontSize: 12, color: t.ink3, fontWeight: "600" }}>
            Recolher
          </Text>
        )}
      </Pressable>

      {/* ─── Avatar ─── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: t.ink5,
          paddingHorizontal: 4,
          minHeight: 50,
        }}
        accessibilityLabel="Avatar do usuário"
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: t.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 }}>
            {initials(userName)}
          </Text>
        </View>
        {expanded && userName && (
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: "700",
              color: t.ink2,
              letterSpacing: -0.1,
            }}
            numberOfLines={1}
          >
            {userName}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── NavItem ─────────────────────────────────────────────────
function NavItem({
  t,
  icon,
  label,
  active,
  expanded,
  indent,
  subtitle,
  primary,
  enterDelay = 0,
  reduced = false,
  onPress,
}: {
  t: StudioPalette;
  icon: string;
  label: string;
  active: boolean;
  expanded: boolean;
  indent?: boolean;
  subtitle?: string;
  primary?: boolean;
  enterDelay?: number;
  reduced?: boolean;
  onPress: () => void;
}) {
  const activeBg = "rgba(236,72,153,0.10)";
  const primaryBg = "rgba(30,58,138,0.08)";
  const web = Platform.OS === "web";
  return (
    <View style={web ? enterStyle(enterDelay, reduced) : undefined}>
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        style={({ hovered, pressed }: any) => [
          {
            flexDirection: "row",
            alignItems: subtitle && expanded ? "flex-start" : "center",
            gap: 10,
            paddingVertical: subtitle && expanded ? 9 : 8,
            paddingHorizontal: expanded ? (indent ? 18 : 10) : 8,
            minHeight: 36,
            borderRadius: 8,
            position: "relative",
            justifyContent: expanded ? "flex-start" : "center",
          },
          web && ({ cursor: "pointer", transition: "background-color .15s ease, box-shadow .15s ease, transform .12s ease" } as any),
          hovered && !active && { backgroundColor: t.accentSoft },
          hovered && !active && web && ({ boxShadow: `0 2px 12px ${t.accent}26` } as any),
          active && { backgroundColor: activeBg },
          !active && primary && { backgroundColor: primaryBg },
          web && pressed && !reduced && ({ transform: "scale(1.03)", backgroundColor: activeBg } as any),
        ]}
      >
        {({ hovered }: any) => (
          <>
            {active && (
              <View
                style={{
                  position: "absolute",
                  left: 2,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  borderRadius: 2,
                  backgroundColor: t.accent,
                  ...(web && !reduced ? ({ animation: "auraSbBar .3s ease both", transformOrigin: "center" } as any) : {}),
                }}
                pointerEvents="none"
              />
            )}
            {!active && primary && (
              <View
                style={{
                  position: "absolute",
                  left: 2,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  borderRadius: 2,
                  backgroundColor: t.primary,
                  opacity: 0.5,
                }}
                pointerEvents="none"
              />
            )}
            <Icon name={icon} size={16} color={active || hovered ? t.accent : primary ? t.primary : t.ink2} />
            {expanded && (
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: active ? "800" : primary ? "700" : "600",
                    color: active ? t.accentInk : hovered ? t.ink : primary ? t.primary : t.ink2,
                    letterSpacing: -0.1,
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {subtitle && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: t.ink3,
                      fontWeight: "400",
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── GroupSection ───────────────────────────────────────────
function GroupSection({
  t,
  group,
  pathname,
  expanded,
  enterDelay = 0,
  reduced = false,
  navigate,
}: {
  t: StudioPalette;
  group: (typeof GROUPS)[number];
  pathname: string;
  expanded: boolean;
  enterDelay?: number;
  reduced?: boolean;
  navigate: (href: string) => void;
}) {
  const childActive = group.children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );

  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHovered(false), 200);
  };
  useEffect(() => () => cancelClose(), []);

  if (expanded) {
    return (
      <View style={{ marginTop: 10 }}>
        <Text
          style={{
            fontSize: 9,
            fontWeight: "800",
            color: t.ink3,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            paddingHorizontal: 10,
            marginBottom: 4,
            ...enterStyle(enterDelay, reduced),
          }}
        >
          {group.label}
        </Text>
        {group.children.map((c, ci) => {
          const active = pathname === c.href || pathname.startsWith(c.href + "/");
          return (
            <NavItem
              key={c.href}
              t={t}
              icon={c.icon}
              label={c.label}
              subtitle={c.subtitle}
              primary={c.primary}
              active={active}
              expanded
              indent
              enterDelay={enterDelay + (ci + 1) * 38}
              reduced={reduced}
              onPress={() => navigate(c.href)}
            />
          );
        })}
      </View>
    );
  }

  // Collapsed: ícone só + hover popover
  const hoverProps: any =
    Platform.OS === "web"
      ? {
          onHoverIn: () => {
            cancelClose();
            setHovered(true);
          },
          onHoverOut: scheduleClose,
        }
      : {};

  return (
    <View style={{ position: "relative", marginTop: 4 }}>
      <Pressable
        accessibilityLabel={`Grupo ${group.label}`}
        accessibilityRole="button"
        {...hoverProps}
        style={({ hovered: pressableHovered }: any) => [
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 8,
            paddingHorizontal: 8,
            minHeight: 36,
            borderRadius: 8,
            position: "relative",
          },
          Platform.OS === "web" && ({ cursor: "pointer", transition: "background-color 0.15s ease" } as any),
          (pressableHovered || hovered) && !childActive && { backgroundColor: t.bgSoft },
          childActive && { backgroundColor: "rgba(236,72,153,0.10)" },
        ]}
      >
        {childActive && (
          <View
            style={{
              position: "absolute",
              left: 2,
              top: 8,
              bottom: 8,
              width: 3,
              borderRadius: 2,
              backgroundColor: t.accent,
            }}
            pointerEvents="none"
          />
        )}
        <Icon name={group.icon} size={16} color={childActive ? t.accent : t.ink2} />
      </Pressable>

      {/* Popover à direita (web hover) */}
      {Platform.OS === "web" && hovered && (
        <View
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          style={[
            {
              position: "absolute",
              left: RAIL_W_COLLAPSED - 8,
              top: 0,
              backgroundColor: t.paperCardElev,
              borderWidth: 1,
              borderColor: t.ink5,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 6,
              minWidth: 180,
              zIndex: 50,
            },
            ({ boxShadow: "0 10px 24px rgba(15,23,42,0.12)" } as any),
          ]}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: "800",
              color: t.ink3,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              paddingHorizontal: 8,
              marginBottom: 4,
            }}
          >
            {group.label}
          </Text>
          {group.children.map((c) => {
            const active = pathname === c.href || pathname.startsWith(c.href + "/");
            return (
              <Pressable
                key={c.href}
                onPress={() => {
                  setHovered(false);
                  cancelClose();
                  navigate(c.href);
                }}
                style={({ hovered: itemHovered }: any) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 7,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                  },
                  Platform.OS === "web" && ({ cursor: "pointer", transition: "background-color 0.15s ease" } as any),
                  itemHovered && !active && { backgroundColor: t.bgSoft },
                  active && { backgroundColor: "rgba(236,72,153,0.10)" },
                ]}
              >
                <Icon name={c.icon} size={14} color={active ? t.accent : t.ink2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: active ? "800" : "600",
                      color: active ? t.accentInk : t.ink2,
                    }}
                    numberOfLines={1}
                  >
                    {c.label}
                  </Text>
                  {c.subtitle && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: t.ink3,
                        fontWeight: "400",
                        marginTop: 1,
                      }}
                      numberOfLines={1}
                    >
                      {c.subtitle}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
