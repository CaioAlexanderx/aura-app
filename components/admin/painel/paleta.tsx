// Cores do painel Hoje, a partir dos tokens do app. O teal é a segunda série
// dos gráficos; âmbar, vermelho e verde são estados.
import { Text } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import type { Tom } from "./tipos";

export var Paleta = {
  accent: IS_DARK_MODE ? Colors.violet3 : Colors.violet,
  accentClaro: IS_DARK_MODE ? "#6d4fd1" : "#c4b5fd",
  accentTexto: Colors.violet3,
  accentSuave: Colors.violetD,
  teal: IS_DARK_MODE ? "#2dd4bf" : "#0d9488",
  tealSuave: IS_DARK_MODE ? "rgba(45,212,191,0.12)" : "rgba(13,148,136,0.10)",
  trilho: Colors.bg4,
  grade: Colors.border,
};

// Cor cheia: barra, linha, fatia.
export function corDoTom(tom?: Tom): string {
  switch (tom) {
    case "teal": return Paleta.teal;
    case "claro": return Paleta.accentClaro;
    case "alerta": return Colors.amber;
    case "desce": return Colors.red;
    case "sobe": return Colors.green;
    case "mudo": return Colors.ink3;
    default: return Paleta.accent;
  }
}

// Par fundo/texto: pill e etiqueta.
export function coresDaEtiqueta(tom?: Tom): { bg: string; fg: string } {
  switch (tom) {
    case "sobe": return { bg: Colors.greenD, fg: Colors.green };
    case "desce": return { bg: Colors.redD, fg: Colors.red };
    case "alerta": return { bg: Colors.amberD, fg: Colors.amber };
    case "teal": return { bg: Paleta.tealSuave, fg: Paleta.teal };
    case "mudo": return { bg: Colors.bg4, fg: Colors.ink3 };
    default: return { bg: Paleta.accentSuave, fg: Paleta.accentTexto };
  }
}

// "**13 de 29** nunca cadastraram" → o trecho entre ** sai em destaque.
export function TextoRico(props: { texto: string; style?: any; corDestaque?: string; numberOfLines?: number }) {
  var partes = props.texto.split("**");
  return (
    <Text style={props.style} numberOfLines={props.numberOfLines}>
      {partes.map(function(p, i) {
        if (i % 2 === 0) return p;
        return <Text key={i} style={{ fontWeight: "700", color: props.corDestaque || Colors.ink }}>{p}</Text>;
      })}
    </Text>
  );
}
