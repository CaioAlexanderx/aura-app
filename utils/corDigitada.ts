// ============================================================
// AURA. — Cor digitada no cadastro rápido (CP3 da revisão de cores, 14/11/2026)
//
// Antes, a cor que não virava hex ("Preta", "Caqui", "Off White") aparecia
// como "Preta (?)" e sumia no Salvar: o backend só guardava hex. Agora o
// nome entra em products.color como a lojista escreveu — igual à
// importação por planilha —, e a amostra vem de nameToHex (a tabela de
// sempre e depois a paleta única). Hex digitado segue hex.
// ============================================================
import { nameToHex, hexToName } from "@/utils/colorNames";

const HEX = /^#?[0-9a-fA-F]{6}$/;

export type CorDigitada = {
  /** O que vai para products.color (hex, nome ou null). */
  gravar: string | null;
  /** A amostra para a bolinha, quando dá para ler. */
  hex: string | null;
  /** O que a prévia mostra. */
  nome: string;
};

/**
 * @param texto o que ela digitou na coluna Cor
 * Tudo minúsculo ganha a primeira letra maiúscula ("azul" → "Azul", que é
 * como a etiqueta já mostrava "azul" lido como hex); o resto fica como ela
 * escreveu ("Off White", "Preta").
 */
export function corDigitada(texto: string | null | undefined): CorDigitada {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (!t) return { gravar: null, hex: null, nome: "" };
  if (HEX.test(t)) {
    const hex = t.startsWith("#") ? t : "#" + t;
    return { gravar: hex, hex, nome: hexToName(hex) || hex };
  }
  const nome = t === t.toLocaleLowerCase("pt-BR") ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t;
  return { gravar: nome.slice(0, 60), hex: nameToHex(t), nome };
}
