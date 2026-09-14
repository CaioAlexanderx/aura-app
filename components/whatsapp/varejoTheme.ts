// ============================================================
// varejoTheme — a mesma decisão do dojô, pintada com a paleta do varejo
//
// waGuards devolve `tone` ("ok" | "warn" | …), nunca uma cor. O dojô
// resolve em KarateColors (sépia); o painel do varejo resolve aqui, em
// `Colors` (violeta). Um selo novo em waGuards aparece nos dois lugares
// sem ninguém precisar lembrar de copiar.
// ============================================================
import { Colors } from "@/constants/colors";
import { WaBadgeTone } from "./waGuards";

export interface WaTonePair {
  color: string;
  bg: string;
}

export function waTonePair(tone: WaBadgeTone): WaTonePair {
  switch (tone) {
    case "ok": return { color: Colors.green, bg: Colors.greenD };
    case "warn": return { color: Colors.amber, bg: Colors.amberD };
    case "danger": return { color: Colors.red, bg: Colors.redD };
    case "primary": return { color: Colors.violet3, bg: Colors.violetD };
    default: return { color: Colors.ink3, bg: Colors.bg4 };
  }
}
