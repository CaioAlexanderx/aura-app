// ============================================================
// AURA. — components/screens/pdv/EtiquetaDeTecla.tsx (17/11/2026, p-155 / A3)
//
// A etiqueta de tecla dos botões do Caixa: 11 px, no tom do rótulo
// secundário, com borda de tecla (a de baixo mais grossa). Sobre botão
// violeta (`inv`) a etiqueta escurece o fundo em vez de clarear: branco
// sobre violeta clareado não fecha 4,5:1 (decisão 1 do mockup).
//
// A tecla vem de utils/atalhosDoCaixa (ATALHOS_DO_CAIXA ou TECLAS_DE_CAMPO),
// no sistema do aparelho (decisão 4). Só com mouse e teclado
// (hooks/useTemTeclado): no toque não aparece nada.
// ============================================================
import { Text, StyleSheet, Platform, type StyleProp, type TextStyle } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { useSistemaDoTeclado, useTemTeclado } from "@/hooks/useTemTeclado";
import {
  etiquetaDaTeclaDeCampo, etiquetaDoAtalho, type AcaoDoCaixa, type TeclaDeCampo,
} from "@/utils/atalhosDoCaixa";

type Props = {
  /** A ação do mapa (a etiqueta mostra a tecla do sistema do aparelho). */
  acao?: AcaoDoCaixa;
  /** Ou uma tecla que o campo trata sozinho (Enter do troco, da busca). */
  campo?: TeclaDeCampo;
  /** Ou o texto pronto (legenda). */
  texto?: string;
  /** Sobre botão violeta. */
  inv?: boolean;
  /** A legenda mostra sempre (ela só abre com teclado). */
  sempre?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

export function EtiquetaDeTecla({ acao, campo, texto, inv, sempre, style, testID }: Props) {
  const teclado = useTemTeclado();
  const so = useSistemaDoTeclado();
  if (!teclado && !sempre) return null;
  const t = texto ?? (acao ? etiquetaDoAtalho(acao, so) : campo ? etiquetaDaTeclaDeCampo(campo, so) : null);
  if (!t) return null;
  return (
    <Text
      style={[s.k, inv ? s.inv : null, style]}
      testID={testID || "etiqueta-de-tecla"}
      accessibilityElementsHidden
      importantForAccessibility="no"
      {...(Platform.OS === "web" ? ({ "aria-hidden": true } as any) : {})}
    >
      {t}
    </Text>
  );
}

const s = StyleSheet.create({
  k: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    paddingHorizontal: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.18)" : "rgba(109,40,217,0.28)",
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.09)" : "rgba(109,40,217,0.08)",
    color: Colors.ink2,
    letterSpacing: 0.2,
    flexShrink: 0,
    overflow: "hidden",
  },
  inv: {
    backgroundColor: "rgba(10,4,40,0.30)",
    borderColor: "rgba(255,255,255,0.42)",
    color: "#ffffff",
  },
});

export default EtiquetaDeTecla;
