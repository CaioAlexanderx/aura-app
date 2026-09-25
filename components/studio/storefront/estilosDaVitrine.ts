// ============================================================
// Vitrine Studio · estilos compartilhados, derivados do tema da loja
//
// `types.ts` exportava `chip`, `chipActive`, `chipTxt` e `sectionLabel`
// como objetos soltos de módulo, calculados a partir da paleta antiga
// cravada (azul-marinho #1E3A8A e texto branco fixo). Como eram
// constantes, não tinham como saber a cor da loja: uma loja amarela
// ganhava botões de opção azuis no produto e no checkout (D5 da jornada).
//
// Aqui eles viram FUNÇÃO do tema e da tipografia, com a mesma regra do
// kit visual (docs/mockups/studio-vitrine-00-kit.html, `.chip`):
//   - repouso: cartão branco, borda neutra, tinta comum;
//   - escolhido: borda e texto na marca legível (`marcaTexto`) sobre o
//     wash da marca — nunca preenchimento cheio com texto branco, que é
//     o que quebrava no amarelo.
// Alvo mínimo de 44 px: são as opções que o dedo mais toca na vitrine.
// ============================================================
import { useMemo } from "react";
import type { ParTipografico } from "@/constants/fonts";
import type { VitrineTema } from "./theme";
import { useTemaDaVitrine } from "./TemaDaVitrine";
import { useTipografia, estiloNumero } from "./TipografiaVitrine";

export function estilosDaVitrine(tema: VitrineTema, par: ParTipografico) {
  return {
    /** Rótulo de seção em caixa alta — a voz dos números (Bricolage). */
    rotulo: {
      ...estiloNumero(par),
      fontSize: 10.5, fontWeight: "600" as const, letterSpacing: 1.2,
      textTransform: "uppercase" as const, color: tema.ink3, marginTop: 6,
    },
    chip: {
      minHeight: 44, paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 12, borderWidth: 1, borderColor: tema.border,
      backgroundColor: tema.bg2, justifyContent: "center" as const,
    },
    // Borda de 2 px no escolhido (o kit usa 1 px + sombra interna): o
    // padding cai 1 px para o chip não mudar de tamanho ao ser tocado.
    chipAtivo: {
      borderWidth: 2, paddingHorizontal: 13, paddingVertical: 7,
      borderColor: tema.marcaTexto, backgroundColor: tema.marcaWash,
    },
    chipTexto: { color: tema.ink, fontSize: 13.5, fontWeight: "600" as const },
    chipTextoAtivo: { color: tema.marcaTexto, fontWeight: "700" as const },
  };
}

export type EstilosDaVitrine = ReturnType<typeof estilosDaVitrine>;

/** Os estilos da loja atual (tema + tipografia do contexto). */
export function useEstilosDaVitrine(): EstilosDaVitrine {
  const tema = useTemaDaVitrine();
  const par = useTipografia();
  return useMemo(() => estilosDaVitrine(tema, par), [tema, par]);
}
