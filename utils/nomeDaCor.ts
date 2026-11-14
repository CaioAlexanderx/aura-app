// ============================================================
// AURA. — Nome que a lojista deu à cor, lido do sku_suffix (tq-55, 26/10/2026)
//
// Medido na importação do Leibert (19/10): o nome da cor (ColorEntry.name:
// "Passion", "Uva", "Off", "Militar") só fica gravado em
// product_variants.sku_suffix, montado pelo backend em
// productsVariations.skuSuffixFromAttrs:
//
//   NOME.toUpperCase().slice(0, 10) + ("-" + TAMANHO.toUpperCase().slice(0, 10))
//
// O Caixa mostrava hexToName(hex), uma paleta fixa: duas cores diferentes do
// mesmo produto podiam sair com o mesmo nome (Off e Branco viravam "Branco").
//
// Este módulo devolve o nome próprio quando dá para ler sem chutar, e null em
// qualquer outro caso (quem chama segue com hexToName, como sempre):
//   · a variante tem cor em hex e o sufixo tem o formato acima;
//   · o nome tem menos de 10 letras (com 10 pode ter sido cortado);
//   · nada de dígitos (sufixo sem nome é o hex, "FF0000"; o lote antigo de
//     variants.js grava 5 dígitos do hex, "FFFFF"; "V3" é fallback);
//   · o nome difere do nome da paleta (BRANCO numa cor branca = "Branco").
// O texto sai em caixa de frase ("PASSION" → "Passion"), como a paleta.
//
// O nome inteiro, com a grafia da lojista e sem o corte de 10, depende de o
// backend gravar o nome da cor (ver o PR do tq-55).
//
// tq-55b (26/10/2026): o backend grava (migration 414,
// product_variants.color_name) e o GET /products/:pid/variants devolve.
// Ordem do nome mostrado: color_name como a lojista digitou → o lido do
// sku_suffix (regras acima) → a paleta (hexToName). Variante gravada antes
// da 414 vem com color_name null e segue como antes.
// ============================================================
import { hexToName } from "@/utils/colorNames";

const HEX = /^#[0-9a-fA-F]{6}$/;
/** color_name que é só o hex (com ou sem #) não é nome: cai no sufixo/paleta. */
const HEX_SEM_CERQUILHA = /^#?[0-9a-fA-F]{6}$/;
/** Maiúsculas (com acento), espaço, hífen e apóstrofo: o que o backend grava. */
const NOME_EM_MAIUSCULAS = /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ' -]*$/;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function emCaixaDeFrase(s: string): string {
  const baixo = s.toLocaleLowerCase("pt-BR");
  return baixo.charAt(0).toLocaleUpperCase("pt-BR") + baixo.slice(1);
}

/**
 * Nome próprio da cor gravado no sku_suffix, ou null.
 * @param skuSuffix product_variants.sku_suffix
 * @param hex       valor do atributo Cor (#RRGGBB)
 * @param tamanho   valor do atributo Tamanho, quando a variante tem
 */
export function nomeProprioDaCor(
  skuSuffix: string | null | undefined,
  hex: string | null | undefined,
  tamanho?: string | null,
): string | null {
  if (!skuSuffix || !hex || !HEX.test(hex)) return null;
  let s = String(skuSuffix).trim();
  const tam = tamanho ? String(tamanho).trim().toUpperCase().slice(0, 10) : "";
  if (tam) {
    if (!s.endsWith("-" + tam)) return null; // outro formato: não adivinha
    s = s.slice(0, s.length - tam.length - 1);
  }
  if (!s || s.length >= 10) return null;
  if (/[0-9]/.test(s) || !NOME_EM_MAIUSCULAS.test(s)) return null;
  const digitos = hex.slice(1).toUpperCase();
  if (/^[A-F]{5,6}$/.test(s) && digitos.startsWith(s)) return null; // hex só com letras
  if (semAcento(s) === semAcento(hexToName(hex))) return null;
  return emCaixaDeFrase(s);
}

// ============================================================
// 14/11/2026 (CP2b da revisão de cores): UMA regra do nome da cor para
// todas as telas — a gêmea de src/services/nomeDaCor.js do backend, que já
// serve o cupom, o pedido online, a vitrine, os relatórios e o estoque. Os
// casos em comum estão em __tests__/fixtures/nomeDaCor.casos.json (o mesmo
// arquivo nos dois repositórios).
//
// Ordem:
//   1. color_name como a lojista escreveu; todo maiúsculo em caixa de frase;
//      o MAIÚSCULO de 10+ letras (o corte do sku_suffix, "AZUL ESCUR") nunca
//      aparece — cai na paleta até a lojista confirmar o nome (decisão do
//      Caio, 14/11); hex (5 ou 6 dígitos) não é nome;
//   2. o nome legível do sku_suffix (nomeProprioDaCor, tq-55);
//   3. a paleta do app (hexToName), a mesma da etiqueta.
// A etiqueta continua com nomeGravadoParaEtiqueta (abaixo), intocada.
// Funções puras: o Studio chama nomeDaCor({ hex, colorName }) com o rótulo
// da amostra, sem mudança.
// ============================================================

/** Hex que não é nome: 6 dígitos, ou 5 (o lote antigo de variants.js). */
const SO_HEX = /^#?[0-9a-fA-F]{5,6}$/;
const ATRIBUTOS_DE_COR = new Set(["cor", "color", "colour", "cores"]);
const ATRIBUTOS_DE_TAMANHO = new Set(["tamanho", "size", "tam", "tam.", "numero", "numeracao", "medida"]);

type Atributo = {
  attribute?: string | null;
  attribute_name?: string | null;
  name?: string | null;
  a?: string | null;
  value?: string | null;
  v?: string | null;
};
type VarianteComCor = {
  sku_suffix?: string | null;
  color_name?: string | null;
  attributes?: Atributo[] | null;
};

/** color_name que pode aparecer na tela, ou null (vazio, hex, cortado). */
export function nomeGravadoQueAparece(colorName: string | null | undefined): string | null {
  const t = typeof colorName === "string" ? colorName.trim() : "";
  if (!t || SO_HEX.test(t)) return null;
  const tudoMaiusculo = t === t.toLocaleUpperCase("pt-BR") && t !== t.toLocaleLowerCase("pt-BR");
  if (tudoMaiusculo && t.length >= 10) return null;
  return tudoMaiusculo ? emCaixaDeFrase(t) : t;
}

/**
 * O nome da cor para mostrar. null só quando o hex é inválido e não há nome.
 */
export function nomeDaCor(o: {
  hex: string | null | undefined;
  colorName?: string | null;
  skuSuffix?: string | null;
  tamanho?: string | null;
}): string | null {
  const paleta = o.hex && HEX.test(o.hex) ? hexToName(o.hex) : "";
  return nomeGravadoQueAparece(o.colorName)
    || nomeProprioDaCor(o.skuSuffix, o.hex, o.tamanho)
    || paleta
    || null;
}

function nomeDoAtributo(a: Atributo | null | undefined): string {
  const n = a ? (a.attribute ?? a.attribute_name ?? a.name ?? a.a) : "";
  return semAcento(String(n ?? ""));
}
function valorDoAtributo(a: Atributo | null | undefined): string {
  const v = a ? (a.value ?? a.v) : "";
  return v == null ? "" : String(v).trim();
}
function ehAtributoDeCor(a: Atributo): boolean {
  return ATRIBUTOS_DE_COR.has(nomeDoAtributo(a)) || HEX.test(valorDoAtributo(a));
}
function ordemDoAtributo(a: Atributo): number {
  if (ehAtributoDeCor(a)) return 0;
  if (ATRIBUTOS_DE_TAMANHO.has(nomeDoAtributo(a))) return 1;
  return 2;
}

/**
 * Nome da cor de uma variante pelos atributos dela. Cor gravada como hex →
 * nomeDaCor; como nome ("Marrom", "Azul (#0000FF)") → o nome, sem o hex.
 * Sem atributo de cor → null.
 */
export function nomeDaCorPelosAtributos(v: VarianteComCor): string | null {
  const attrs = Array.isArray(v && v.attributes) ? (v.attributes as Atributo[]) : [];
  const cor = attrs.find((a) => ehAtributoDeCor(a) && valorDoAtributo(a));
  if (!cor) return null;
  const bruto = valorDoAtributo(cor);
  if (HEX.test(bruto)) {
    const tam = attrs.find((a) => ATRIBUTOS_DE_TAMANHO.has(nomeDoAtributo(a)));
    return nomeDaCor({ hex: bruto, colorName: v.color_name, skuSuffix: v.sku_suffix, tamanho: tam ? valorDoAtributo(tam) : null });
  }
  const semHex = bruto.replace(/\(?\s*#[0-9a-fA-F]{6}\s*\)?/g, "").trim();
  return semHex || bruto;
}

/**
 * Rótulo da variante: a cor primeiro (pelo nome), depois o tamanho, depois o
 * resto. Sem atributo, o sku_suffix. Nada legível → null.
 */
export function rotuloDaVariante(v: VarianteComCor, separador: string = " · "): string | null {
  const attrs = (Array.isArray(v && v.attributes) ? (v.attributes as Atributo[]) : [])
    .filter((a) => valorDoAtributo(a))
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (ordemDoAtributo(x.a) - ordemDoAtributo(y.a)) || (x.i - y.i))
    .map((x) => x.a);
  if (!attrs.length) {
    const s = v && v.sku_suffix != null ? String(v.sku_suffix).trim() : "";
    return s || null;
  }
  let corFeita = false;
  const partes: string[] = [];
  for (const a of attrs) {
    if (!corFeita && ehAtributoDeCor(a)) {
      corFeita = true;
      const n = nomeDaCorPelosAtributos({ ...v, attributes: attrs });
      if (n) partes.push(n);
      continue;
    }
    partes.push(valorDoAtributo(a));
  }
  return partes.length ? partes.join(separador) : null;
}

/**
 * Nome da cor para mostrar no Caixa (seletor de variante → carrinho → nota).
 * `attrs` é o attributes da variante ([{attribute, value}]).
 * 14/11/2026: segue a regra única (nomeDaCor). Antes, o color_name saía
 * cru — o cortado "AZUL ESCUR" ia para o carrinho e para o xProd da nota.
 */
export function nomeDaCorDaVariante(v: VarianteComCor, hex: string): string {
  let tamanho: string | null = null;
  for (const a of v.attributes || []) {
    if (ATRIBUTOS_DE_TAMANHO.has(nomeDoAtributo(a)) && valorDoAtributo(a)) { tamanho = valorDoAtributo(a); break; }
  }
  return nomeDaCor({ hex, colorName: v.color_name, skuSuffix: v.sku_suffix, tamanho }) || hexToName(hex);
}

/**
 * 13/11/2026 (etiqueta da Look das Patroas): nome da cor gravado pela
 * lojista (product_variants.color_name) para a ETIQUETA, ou null para a
 * etiqueta seguir como sempre (paleta por hex).
 *
 * Só vale nome de verdade: vazio, hex, e o MAIÚSCULO de 10+ letras (o corte
 * de 10 do sku_suffix, ex. "AZUL ESCUR", gravado pelo preenchimento da 414)
 * ficam de fora. Nome todo em maiúsculas sai em caixa de frase ("AMORA" →
 * "Amora"), como a paleta já sai.
 */
export function nomeGravadoParaEtiqueta(colorName: string | null | undefined): string | null {
  const t = typeof colorName === "string" ? colorName.trim() : "";
  if (!t || HEX_SEM_CERQUILHA.test(t)) return null;
  const tudoMaiusculo = t === t.toLocaleUpperCase("pt-BR") && t !== t.toLocaleLowerCase("pt-BR");
  if (tudoMaiusculo && t.length >= 10) return null;
  return tudoMaiusculo ? emCaixaDeFrase(t) : t;
}
