// ============================================================
// AURA STUDIO · StudioShell — Topbar (Fase 3 disciplina de cor + topbar)
//
// 31/05/2026: topbar desktop horizontal acima do conteúdo. 3 áreas:
//   - Breadcrumb à esquerda (derivado de pathname via GROUPS)
//   - Busca placeholder no meio (visual, sem backend ainda)
//   - StudioThemeToggle à direita
//
// Mobile/tablet: a top bar atual (MobileBar) continua sem topbar adicional.
// Topbar é EXCLUSIVA do branch desktop (isWide).
//
// Per PLANO seção 5/Fase 3 + confirmação Caio 31/05:
// busca é UI-only (placeholder), sem `headerRight` slot — topbar é
// puramente shell, NÃO mexe na API do StudioScreen.
// ============================================================
import { useMemo } from "react";
import { View, Text, TextInput } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioThemeToggle } from "@/components/studio/StudioThemeToggle";
import { GROUPS } from "./types";

// Mapa pathname → segments de breadcrumb. Lê GROUPS pra resolver
// label do grupo/child. Sub-paths conhecidos (novo, configuracoes/X)
// recebem rótulo amigável.
function buildBreadcrumb(pathname: string): string[] {
  if (!pathname || pathname === "/studio" || pathname === "/studio/") {
    return ["Início"];
  }

  const out: string[] = ["Início"];

  // Configurações (sub-rota dedicada)
  if (pathname.startsWith("/studio/configuracoes")) {
    out.push("Configurações");
    const after = pathname.replace("/studio/configuracoes", "").replace(/^\//, "");
    if (after) {
      const seg = after.split("/")[0];
      // capitaliza
      out.push(seg.charAt(0).toUpperCase() + seg.slice(1));
    }
    return out;
  }

  // Busca grupo + child que casam com o pathname
  for (const g of GROUPS) {
    // Ordena children por href.length DESC pra match mais específico primeiro
    const sortedChildren = [...g.children].sort((a, b) => b.href.length - a.href.length);
    for (const child of sortedChildren) {
      if (pathname === child.href || pathname.startsWith(child.href + "/")) {
        out.push(g.label, child.label);
        // Sub-path (detalhe, novo, etc)
        const sub = pathname.slice(child.href.length).replace(/^\//, "");
        if (sub) {
          const seg = sub.split("/")[0];
          if (seg === "novo" || seg === "new") out.push("Novo");
          else if (seg === "marketplace") out.push("Marketplace");
          else if (seg === "eventos") out.push("Eventos");
          else if (/^[a-f0-9-]{6,}$/i.test(seg)) out.push("Detalhe");
          else out.push(seg.charAt(0).toUpperCase() + seg.slice(1));
        }
        return out;
      }
    }
  }

  // Fallback: rota desconhecida — mostra Início + último segmento
  const segs = pathname.split("/").filter(Boolean);
  const last = segs[segs.length - 1] || "";
  if (last && last !== "studio") {
    out.push(last.charAt(0).toUpperCase() + last.slice(1));
  }
  return out;
}

export function Topbar({ pathname }: { pathname: string }) {
  const t = useStudioTokens();
  const crumbs = useMemo(() => buildBreadcrumb(pathname), [pathname]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        paddingHorizontal: 20,
        backgroundColor: t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.ink5,
        gap: 12,
      }}
    >
      {/* Breadcrumb */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <View
              key={c + ":" + i}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {i > 0 && <Icon name="chevron-right" size={11} color={t.ink4} />}
              <Text
                style={{
                  fontSize: 13,
                  color: isLast ? t.ink : t.ink3,
                  fontWeight: isLast ? "700" : "500",
                  letterSpacing: -0.1,
                }}
                numberOfLines={1}
              >
                {c}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Busca (placeholder UI-only) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: t.paperCardElev,
          borderWidth: 1,
          borderColor: t.ink5,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          gap: 6,
          minWidth: 200,
          maxWidth: 320,
        }}
      >
        <Icon name="search" size={13} color={t.ink4} />
        <TextInput
          placeholder="Buscar no Studio..."
          placeholderTextColor={t.ink4}
          style={{
            flex: 1,
            fontSize: 13,
            color: t.ink,
            padding: 0,
            // Web: remove outline default no foco — focus ring vem do CSS injetado
            ...({ outlineStyle: "none" } as any),
          }}
        />
      </View>

      {/* Theme toggle */}
      <StudioThemeToggle />
    </View>
  );
}
