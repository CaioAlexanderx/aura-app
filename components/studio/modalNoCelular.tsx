// ============================================================
// AURA STUDIO · modal no celular (etapa 4, 05/10/2026)
//
// As etapas 1 a 3 (app#1023, app#1024) arrumaram o shell e o miolo das
// telas. Esta etapa dá UMA regra para todo modal, folha e gaveta do
// Studio abaixo de 768 px:
//
//   1. ocupa a tela toda ou é folha de baixo, sem margem que aperte;
//   2. cabeçalho de uma linha, com título e fechar; nada de bloco alto
//      em gradiente nem texto explicativo de 3 linhas;
//   3. corpo rolável;
//   4. rodapé fixo com no máximo 2 botões (um primário e um secundário),
//      alvos de 44 px, respeitando a área segura de baixo;
//   5. nada de foco automático que abra o teclado ao entrar;
//   6. campo pouco usado atrás de "Mais opções".
//
// Cada modal só pergunta aqui; as decisões e as peças moram num lugar
// só. O desktop não passa por nenhuma destas regras.
// ============================================================
import React from "react";
import { View, Text, Pressable, Platform, useWindowDimensions } from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";

import { ALVO_DE_TOQUE, ehCelular } from "./modalNoCelularRegras";

export * from "./modalNoCelularRegras";

/** true abaixo de 768 px: o modal segue a regra do celular. */
export function useModalNoCelular(): boolean {
  const { width } = useWindowDimensions();
  return ehCelular(width);
}

/** Respiro de baixo que respeita a área segura (a barra de gestos do
 *  iPhone). No nativo o Modal já desconta; no web vem do `env()`. */
export function respiroInferior(base = 12): { paddingBottom: any } {
  return Platform.OS === "web"
    ? { paddingBottom: `max(${base}px, env(safe-area-inset-bottom))` }
    : { paddingBottom: base };
}

// ─── Casca ──────────────────────────────────────────────────

type Casca = { fundo: any; caixa: any };
const NADA: Casca = { fundo: null, caixa: null };

/** Soma ao fundo e à caixa de um modal centralizado para ele virar folha
 *  de baixo no celular: largura toda, cantos só em cima, área segura. */
export function folhaDeBaixo(celular: boolean, respiro = 16): Casca {
  if (!celular) return NADA;
  return {
    fundo: { justifyContent: "flex-end", alignItems: "stretch", padding: 0, paddingHorizontal: 0, paddingVertical: 0 },
    caixa: {
      width: "100%", maxWidth: undefined, alignSelf: "stretch", maxHeight: "92%",
      borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
      ...respiroInferior(respiro),
    },
  };
}

/** Soma ao fundo e à caixa para o modal ocupar a tela toda no celular. */
export function telaCheia(celular: boolean): Casca {
  if (!celular) return NADA;
  return {
    fundo: { justifyContent: "flex-start", alignItems: "stretch", padding: 0, paddingHorizontal: 0, paddingVertical: 0 },
    caixa: {
      flex: 1, width: "100%", maxWidth: undefined, maxHeight: undefined, height: "100%", alignSelf: "stretch",
      borderRadius: 0, borderWidth: 0,
    },
  };
}

/** Soma ao rodapé do modal no celular: uma linha, os dois botões dividem
 *  a largura, área segura embaixo. */
export function rodapeFixo(celular: boolean): any {
  if (!celular) return null;
  return {
    flexDirection: "row", flexWrap: "nowrap", alignItems: "stretch", gap: 8,
    paddingHorizontal: 14, paddingTop: 10, ...respiroInferior(10),
  };
}

/** Soma a cada botão do rodapé no celular: 44 px e a largura dividida. */
export function botaoDoRodape(celular: boolean, peso = 1): any {
  if (!celular) return null;
  return { minHeight: ALVO_DE_TOQUE, flexGrow: peso, flexShrink: 1, flexBasis: 0, minWidth: 0, justifyContent: "center", alignItems: "center" };
}

// ─── Peças ──────────────────────────────────────────────────

/** Cabeçalho de uma linha: título, um complemento curto opcional e o
 *  fechar de 44 px. */
export function CabecalhoCompacto({
  t, titulo, sub, onFechar, rotuloFechar = "Fechar", testID, direita,
}: {
  t: StudioPalette; titulo: string; sub?: string | null; onFechar?: () => void;
  rotuloFechar?: string; testID?: string; direita?: React.ReactNode;
}) {
  return (
    <View
      testID={testID || "cabecalho-compacto"}
      style={{
        flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52,
        paddingLeft: 14, paddingRight: 6, paddingVertical: 4,
        borderBottomWidth: 1, borderBottomColor: t.ink5, backgroundColor: t.paperCardElev,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} accessibilityRole="header" style={{ fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }}>
          {titulo}
        </Text>
        {sub ? <Text numberOfLines={1} style={{ fontSize: 12, color: t.ink3 }}>{sub}</Text> : null}
      </View>
      {direita}
      {onFechar ? (
        <Pressable
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel={rotuloFechar}
          testID={(testID || "cabecalho-compacto") + "-fechar"}
          style={{ width: ALVO_DE_TOQUE, height: ALVO_DE_TOQUE, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={20} color={t.ink2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Mais opções": o que quase ninguém usa fica recolhido e abre ao toque. */
export function MaisOpcoes({
  t, aberto, onAlternar, rotulo = "Mais opções", testID = "mais-opcoes", children,
}: {
  t: StudioPalette; aberto: boolean; onAlternar: () => void; rotulo?: string; testID?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        aria-expanded={aberto}
        testID={testID}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: ALVO_DE_TOQUE, alignSelf: "flex-start" }}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: t.primary }}>{rotulo}</Text>
        <View style={{ transform: [{ rotate: aberto ? "180deg" : "0deg" }] }}>
          <Icon name="chevron_down" size={14} color={t.primary} />
        </View>
      </Pressable>
      {aberto ? children : null}
    </View>
  );
}
