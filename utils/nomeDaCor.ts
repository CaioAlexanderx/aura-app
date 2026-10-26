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

/**
 * Nome da cor para mostrar: o próprio quando existe, senão o da paleta.
 * `attrs` é o attributes da variante ([{attribute, value}]).
 */
export function nomeDaCorDaVariante(
  v: {
    sku_suffix?: string | null;
    color_name?: string | null;
    attributes?: Array<{ attribute?: string; name?: string; value?: string }> | null;
  },
  hex: string,
): string {
  const gravado = typeof v.color_name === "string" ? v.color_name.trim() : "";
  if (gravado && !HEX_SEM_CERQUILHA.test(gravado)) return gravado;
  let tamanho: string | null = null;
  for (const a of v.attributes || []) {
    const nome = String((a && (a.attribute || a.name)) || "").trim().toLowerCase();
    if ((nome === "tamanho" || nome === "size") && a.value) { tamanho = String(a.value); break; }
  }
  return nomeProprioDaCor(v.sku_suffix, hex, tamanho) || hexToName(hex);
}
