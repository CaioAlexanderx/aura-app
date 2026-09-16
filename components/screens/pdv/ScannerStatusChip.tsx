// ============================================================
// AURA. -- PDV/Caixa · Chip de estado do leitor de código
//
// 16/09/2026 (Fase 0 · I0.3): o estado do leitor morava num card grande da
// barra de ações, onde o texto truncava ("Escutando · pode b…"). Agora é um
// chip discreto na ponta direita da linha da busca — o lugar onde o lojista
// já está olhando quando vai bipar.
//
// Vocabulário: o aparelho LÊ, não escuta. Nos rótulos visíveis é sempre
// "leitor" / "Lendo"; "scanner" só sobrevive em nome de código e prop.
//
// O último código lido aparece como chip transitório (4s) e volta ao estado
// normal — antes ele ficava ocupando o subtítulo do card pra sempre.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { IS_WEB, webOnly } from "./types";

/** Quanto tempo o código lido fica visível antes do chip voltar ao normal. */
export const CODIGO_VISIVEL_MS = 4000;

export function leitorStatusText(lendo: boolean): string {
  return lendo ? "Lendo · pode bipar" : "Leitor pausado";
}

/** Versão curta, pra mobile — a frase inteira vai no accessibilityLabel. */
export function leitorStatusCurto(lendo: boolean): string {
  return lendo ? "Lendo" : "Pausado";
}

export function leitorStatusA11y(lendo: boolean, ultimoCodigo?: string | null): string {
  const base = lendo
    ? "Leitor de código de barras ligado, pode bipar a qualquer momento"
    : "Leitor de código de barras pausado";
  return ultimoCodigo ? base + ". Último código lido: " + ultimoCodigo : base;
}

type Props = {
  listening?: boolean;
  lastCode?: string | null;
  /** Mobile: mostra só "Lendo" / "Pausado". */
  compact?: boolean;
};

export function ScannerStatusChip({ listening = true, lastCode = null, compact = false }: Props) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const timer = useRef<any>(null);

  // Bipe novo → mostra o código por alguns segundos e volta ao estado normal.
  useEffect(() => {
    if (!lastCode) { setCodigo(null); return; }
    setCodigo(lastCode);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCodigo(null), CODIGO_VISIVEL_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [lastCode]);

  const mostrandoCodigo = !!codigo;
  const texto = mostrandoCodigo
    ? codigo!
    : compact ? leitorStatusCurto(listening) : leitorStatusText(listening);

  const cor = listening ? Colors.green : Colors.ink3;

  const webBox = webOnly({
    background: listening ? "rgba(52,211,153,0.10)" : Glass.lineFaint,
    border: "1px solid " + (listening ? "rgba(52,211,153,0.30)" : Glass.lineBorderCard),
  });

  return (
    <View
      accessibilityLabel={leitorStatusA11y(listening, codigo)}
      style={[
        s.chip,
        Platform.OS === "web"
          ? (webBox as any)
          : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: listening ? "rgba(52,211,153,0.30)" : Colors.border },
      ]}
    >
      <View style={[s.dot, { backgroundColor: cor }]}>
        {IS_WEB && listening && (
          <span aria-hidden style={{
            position: "absolute", inset: -2, borderRadius: "50%",
            background: "rgba(52,211,153,0.45)",
            animation: "caixaPulse 1.8s ease-in-out infinite",
            pointerEvents: "none",
          } as any} />
        )}
      </View>
      <Text numberOfLines={1} style={[s.txt, { color: listening ? Colors.ink : Colors.ink3 }, mostrandoCodigo && s.txtCodigo]}>
        {texto}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexShrink: 0,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    position: "relative",
    flexShrink: 0,
  },
  txt: { fontSize: 11.5, fontWeight: "600" },
  txtCodigo: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    letterSpacing: 0.4,
    color: Colors.ink2,
  },
});

export default ScannerStatusChip;
