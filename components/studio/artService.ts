// ============================================================
// components/studio/artService.ts
// S4 (19/08/2026) — os TRÊS caminhos da arte.
//
// Eram dois: o cliente manda a arte pronta, ou a lojista cria do zero.
// Falta o do meio, que é o mais frequente: o cliente manda a arte e ela
// precisa ser ajustada para caber no produto e para as cores de
// impressão. Isso acontece na maioria dos pedidos e hoje a lojista
// absorve o custo em silêncio, porque não existe onde cobrar.
//
// O motor de preço já funciona: `art_service` é um campo `type: 'option'`
// e `computeChoicesDelta` (backend e app) soma o `price_delta` da choice
// selecionada. Uma terceira choice entra sem nenhuma mudança de motor —
// o que faltava era o caminho existir.
//
// INTERAÇÃO COM O S0: só `designer` dispensa o cliente de enviar arte.
// Em `adjust` ele MANDA a arte, então o grupo de origem da arte continua
// obrigatório. A validação dos dois lados testa `=== 'designer'`
// explicitamente, e há teste travando isso.
// ============================================================

export const ART_SERVICE_FIELD_ID = "art_service";
export const ART_SERVICE_BRIEF_ID = "art_service_brief";

export const ART_NONE = "none";
export const ART_ADJUST = "adjust";
export const ART_DESIGNER = "designer";

export type ArtServiceChoice = {
  value: string;
  label: string;
  price_delta: number;
};

/**
 * Preço em R$ digitado pela lojista → número.
 *
 * Aceita as duas formas que aparecem num teclado brasileiro: "1.250,50"
 * (ponto de milhar, vírgula decimal) e "30.00" (ponto decimal, colado de
 * outro lugar). A regra é a vírgula: se ela existe, ela é o decimal e o
 * ponto é milhar; se não existe, o ponto é o decimal.
 *
 * Tratar todo ponto como milhar transformava "30.00" em 3000.
 */
export function parseArtPrice(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : 0;
  const txt = String(raw ?? "").trim();
  if (!txt) return 0;
  const limpo = txt.includes(",")
    ? txt.replace(/\./g, "").replace(",", ".")
    : txt;
  const n = parseFloat(limpo.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/**
 * As choices gravadas em `customization_config`.
 *
 * `none` sempre entra: é o caminho de quem já tem arte pronta.
 *
 * `adjust` entra mesmo com preço 0 — "a gente ajusta, por nossa conta" é
 * informação útil para o cliente e sinal útil para a lojista, que passa a
 * saber que aquele pedido precisa de trabalho antes de imprimir. Era
 * justamente esse sinal que não existia.
 */
export function buildArtServiceChoices(
  adjustPrice: string | number | null | undefined,
  designPrice: string | number | null | undefined
): ArtServiceChoice[] {
  return [
    { value: ART_NONE,     label: "Vou enviar minha arte pronta",     price_delta: 0 },
    { value: ART_ADJUST,   label: "Envio minha arte e vocês ajustam", price_delta: parseArtPrice(adjustPrice) },
    { value: ART_DESIGNER, label: "Criem a arte pra mim",             price_delta: parseArtPrice(designPrice) },
  ];
}

/** Legenda de preço de uma choice, ou null quando é sem custo. */
export function priceLabel(delta: number | null | undefined): string | null {
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) return null;
  const abs = Math.abs(d).toFixed(2).replace(".", ",");
  return (d > 0 ? "+R$ " : "-R$ ") + abs;
}

/** Subtítulo de cada caminho na vitrine. */
export function choiceHint(value: string): string {
  switch (value) {
    case ART_NONE:
      return "Seu arquivo já está pronto para impressão (PNG, JPG ou PDF)";
    case ART_ADJUST:
      return "A gente ajusta o tamanho e as cores para ficar perfeito no produto";
    case ART_DESIGNER:
      return "Nossa equipe cria a arte do zero, a partir da sua ideia";
    default:
      return "";
  }
}

/** Só quem contratou a criação não precisa enviar arte. */
export function dispensaEnvioDeArte(value: string | null | undefined): boolean {
  return value === ART_DESIGNER;
}

/** O briefing faz sentido nos dois caminhos pagos, com pedidos diferentes. */
export function briefingFor(value: string | null | undefined): { title: string; hint: string; placeholder: string } | null {
  if (value === ART_DESIGNER) {
    return {
      title: "Descreva sua ideia",
      hint: "Quanto mais detalhes, melhor o resultado. Ex: cores, estilo, texto, referências.",
      placeholder: "Ex: quero uma arte minimalista com meu nome em dourado, fundo preto, estilo moderno...",
    };
  }
  if (value === ART_ADJUST) {
    return {
      title: "O que você quer que a gente ajuste?",
      hint: "Opcional. Se não disser nada, ajustamos o tamanho e as cores para o produto.",
      placeholder: "Ex: deixar o fundo transparente, aumentar o logo, tirar a borda branca...",
    };
  }
  return null;
}
