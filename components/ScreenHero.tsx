// ============================================================
// AURA. — ScreenHero + ScreenTabs (29/08/2026)
//
// QA de coerencia: /estoque abria com cabecalho editorial, /clientes
// com um titulo sem-serifa de 22px e /vendas com um terceiro padrao —
// tres alturas de cabecalho, tres tratamentos de titulo e dois
// componentes de aba diferentes. Navegando entre as tres telas parecia
// que se tinha trocado de produto.
//
// Este arquivo e a extracao do padrao que ja estava certo
// (components/screens/estoque/EstoqueHero.tsx) num componente
// compartilhado. Cobre:
//   · sobrancelha  — "Aura. · <contexto>" + pill "ao vivo"
//   · titulo display serifado com ponto colorido
//   · linha de subtitulo com metricas em texto corrido
//   · slot de acoes a direita do titulo
//
// 01/09/2026 (QA onda 2) — as outras NOVE abas passaram a usar este
// cabecalho, e /estoque migrou pra ca: o EstoqueHero ficou orfao e foi
// removido. Nesta rodada o componente ganhou a prop `badge` (selo neutro
// na sobrancelha) — ver comentario na prop.
//
// Mockups aprovados:
//   · docs/mockups/cabecalho-unificado-clientes-vendas.html  (29/08/2026)
//   · docs/mockups/cabecalho-unificado-nove-abas.html        (01/09/2026)
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Dimensions } from "react-native";
import { useColors, useThemeStore } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";

const IS_WEB = Platform.OS === "web";
const SCREEN_W = typeof window !== "undefined" && IS_WEB ? window.innerWidth : Dimensions.get("window").width;
const IS_WIDE = SCREEN_W > 768;

// CSS proprio (idempotente) — o hero nao pode depender do CSS injetado
// pela tela de Estoque, senao quebra quando o usuario entra direto em
// /clientes ou /vendas sem passar por /estoque.
function useScreenHeroStyles() {
  useEffect(() => {
    if (!IS_WEB || typeof document === "undefined") return;
    if (document.getElementById("aura-hero-css")) return;
    const st = document.createElement("style");
    st.id = "aura-hero-css";
    st.textContent =
      "@keyframes auraHeroRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }\n" +
      "@keyframes auraHeroRing { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }\n" +
      ".aura-hero-rise { animation: auraHeroRise 0.55s cubic-bezier(0.4,0,0.2,1) both; }\n";
    document.head.appendChild(st);
  }, []);
}

type ScreenHeroProps = {
  /** Contexto da sobrancelha, ex.: "Base de clientes". Sai em caixa alta. */
  eyebrow: string;
  /** Titulo display. O ponto final colorido e adicionado pelo componente. */
  title: string;
  /** Linha de metricas em texto corrido, logo abaixo do titulo. */
  subtitle?: React.ReactNode;
  /** Mostra a pill "ao vivo" na sobrancelha. */
  live?: boolean;
  /**
   * Selo neutro na sobrancelha, depois do "ao vivo" (01/09/2026).
   *
   * Nasceu na onda 2 do QA: tres telas tinham contexto que nao e titulo nem
   * metrica — o regime tributario (/contabilidade), a empresa ou o
   * "Consolidado · N empresas" (/financeiro) e a situacao da loja online
   * (/canal). Cada uma ia inventar seu proprio cantinho no cabecalho; e uma
   * prop de string com o mesmo desenho da pill "ao vivo", em tom neutro, pra
   * nao virar slot livre por tela.
   */
  badge?: string;
  /** Botoes a direita do titulo. */
  actions?: React.ReactNode;
};

export function ScreenHero({ eyebrow, title, subtitle, live, badge, actions }: ScreenHeroProps) {
  const C = useColors();
  useScreenHeroStyles();
  const accent = C.violet;

  // ── Native ────────────────────────────────────────────────
  // Sem serifada de 64px no celular nativo: mesma hierarquia, escala
  // menor. (No web estreito o titulo tambem encolhe, ver titleSize.)
  if (!IS_WEB) {
    return (
      <View style={n.wrap}>
        <Text style={[n.eyebrow, { color: C.ink3 }]}>
          {("Aura. · " + eyebrow + (badge ? " · " + badge : "")).toUpperCase()}
        </Text>
        <View style={n.titleRow}>
          <Text style={[n.title, { color: C.ink }]} numberOfLines={1}>
            {title}<Text style={{ color: accent }}>.</Text>
          </Text>
          {!!actions && <View style={n.actions}>{actions}</View>}
        </View>
        {!!subtitle && <Text style={[n.sub, { color: C.ink3 }]}>{subtitle}</Text>}
      </View>
    );
  }

  // ── Web ───────────────────────────────────────────────────
  const titleSize = IS_WIDE ? 64 : 38;
  return (
    <div className="aura-hero-rise" style={{ padding: IS_WIDE ? "16px 4px 18px" : "8px 2px 14px" } as any}>
      {/* Sobrancelha com o glyph da Aura */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
        color: C.ink3,
      } as any}>
        <svg width={14} height={14} viewBox="0 0 24 24" style={{ display: "inline-block", flexShrink: 0 } as any}>
          <defs>
            <radialGradient id="auraHeroGlyph" cx="50%" cy="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="none" stroke={accent} strokeOpacity="0.3"
            style={{ transformOrigin: "12px 12px", animation: "auraHeroRing 2.4s ease-out infinite" } as any} />
          <circle cx="12" cy="12" r="10" fill="url(#auraHeroGlyph)" />
          <circle cx="12" cy="12" r="3.2" fill={accent} />
        </svg>
        <span>Aura<span style={{ color: accent } as any}>.</span> · {eyebrow}</span>
        {live && (
          <span style={{
            padding: "3px 8px", borderRadius: 999,
            background: accent + "14", color: accent,
            fontSize: 10, letterSpacing: "0.08em",
          } as any}>ao vivo</span>
        )}
        {!!badge && (
          <span style={{
            padding: "3px 8px", borderRadius: 999,
            background: C.bg3, color: C.ink3,
            border: "1px solid " + C.border,
            fontSize: 10, letterSpacing: "0.08em",
          } as any}>{badge}</span>
        )}
      </div>

      {/* Titulo display + acoes */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" } as any}>
        <div style={{
          fontFamily: Fonts.heading, fontSize: titleSize, lineHeight: 0.95,
          color: C.ink, letterSpacing: "-0.025em", fontWeight: 400,
          flex: 1, minWidth: 0,
        } as any}>
          {title}<span style={{ color: accent } as any}>.</span>
        </div>
        {!!actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6, flexWrap: "wrap" } as any}>
            {actions}
          </div>
        )}
      </div>

      {/* Linha de metricas.
          01/09/2026: era um <div> cru. Virou <Text> porque as telas da onda 2
          precisam colorir UM pedaco da frase (o alerta em ambar, o vencido em
          vermelho) — e um <Text> aninhado dentro de <div> nao herda o contexto
          de texto do react-native-web, entao vira bloco e quebra a linha no
          meio. Dentro de um <Text>, o aninhado sai inline nas duas
          plataformas. Frase em string pura continua funcionando igual. */}
      {!!subtitle && (
        <Text style={{ fontSize: 14, color: C.ink3, marginTop: 10, maxWidth: 720, lineHeight: 21 }}>
          {subtitle}
        </Text>
      )}
    </div>
  );
}

// ============================================================
// ScreenTabs — abas em pilula, o padrao que /estoque e /clientes ja
// usavam. /vendas usava sublinhado; convergiu pra ca (29/08/2026).
// Motivo da escolha: era o padrao majoritario, aguenta melhor o scroll
// horizontal no mobile e nao cria uma segunda linha de base brigando
// com o ponto final do titulo editorial.
// ============================================================
export type ScreenTabItem = { key: string; label: string; locked?: boolean };

type ScreenTabsProps = {
  tabs: ScreenTabItem[];
  active: string;
  onSelect: (key: string) => void;
};

export function ScreenTabs({ tabs, active, onSelect }: ScreenTabsProps) {
  const C = useColors();
  const { isDark } = useThemeStore();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginBottom: 16 }}
      contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}
    >
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              tb.tab,
              { backgroundColor: isDark ? C.bg3 : C.bg3, borderColor: C.border },
              on && { backgroundColor: C.violet, borderColor: C.violet },
            ]}
          >
            <Text style={[tb.text, { color: C.ink3 }, on && { color: "#fff", fontWeight: "600" }]}>{t.label}</Text>
            {t.locked && <Icon name="lock" size={10} color={on ? "#fff" : C.ink3} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const tb = StyleSheet.create({
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  text: { fontSize: 13, fontWeight: "500" },
});

const n = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 14, gap: 6 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sub: { fontSize: 13, lineHeight: 19 },
});

export default ScreenHero;
