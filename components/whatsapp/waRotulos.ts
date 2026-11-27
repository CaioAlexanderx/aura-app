// ============================================================
// waRotulos — frases da tela de Configurações do WhatsApp
//
// Singular e plural certos (pluralize do app), nomes dos pontos da régua
// (o servidor manda "depois1", a lojista lê "1 dia depois"), o mês por
// extenso e o texto do modelo sem o trecho de um campo que a Aura não tem.
// ============================================================
import { pluralize } from "@/utils/plural";

/** "depois1" -> "1 dia depois", "antes3" -> "3 dias antes", "dia" -> "no dia". Qualquer número. */
export function nomeDoPonto(codigo: string | null | undefined): string {
  const c = String(codigo || "").trim();
  if (!c) return "";
  if (/^(dia|no_dia|no dia)$/i.test(c)) return "no dia";
  const m = /^(antes|depois)[_\s-]?(\d+)$/i.exec(c);
  if (m) return `${pluralize(Number(m[2]), "dia")} ${m[1].toLowerCase()}`;
  // Já é uma frase legível (ou um código que não conhecemos): não mostra "depois1" cru.
  return /\d/.test(c) && /^[a-z_]+\d+$/i.test(c) ? "" : c;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-08-12" / "2026-08" / "agosto" -> "agosto". Nunca devolve a data ISO. */
export function mesPorExtenso(v: string | null | undefined): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(s);
  if (iso) {
    const i = Number(iso[2]) - 1;
    return i >= 0 && i <= 11 ? MESES[i] : null;
  }
  const baixo = s.toLowerCase();
  return MESES.includes(baixo) ? baixo : null;
}

/** Tira do texto um campo sem valor, junto com a pontuação que o puxa ("...na loja: {Campo}." -> "...na loja."). */
export function textoSemCampo(texto: string, campo: string): string {
  const esc = campo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(texto || "")
    .replace(new RegExp(`\\s*[:,]\\s*\\{${esc}\\}`, "g"), "")
    .replace(new RegExp(`\\s*\\{${esc}\\}`, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1");
}

/** "aniversariantes" -> "aniversariante" (para o singular de uma lista). */
export function singularDe(plural: string): string {
  return plural.replace(/s$/i, "");
}

export const umOuN = (n: number, sing: string, plur?: string) => pluralize(n, sing, plur);
