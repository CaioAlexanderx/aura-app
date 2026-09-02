// ============================================================
// Canal digital · o destino do botão do banner
//
// O CTA do banner virou link de verdade no backend (#637): sem destino,
// a loja não desenha botão nenhum. O painel oferecia o campo de TEXTO e
// nenhum campo de link — a lojista escrevia "Ver coleção", salvava, e
// não aparecia nada. Este módulo é a regra do que conta como destino.
//
// POR QUE MÓDULO: a mesma regra vale no painel (para avisar antes de
// salvar) e no backend (que descarta o que não for http(s)). Escrita nos
// dois lugares, um dia o painel aceita o que a loja recusa — e a lojista
// fica olhando um botão que não existe.
// ============================================================

/**
 * O que o backend aceita: http(s), ou uma categoria da propria loja no
 * formato `#cat=/caminho` (redesign 09/2026 — o CTA do hero leva pra
 * "Vestidos" sem sair da pagina). Espelho de destinoDoCta no backend.
 */
export function destinoValido(url: string | null | undefined): boolean {
  const u = String(url || "").trim();
  if (!u) return false;
  if (/^#cat=\/[a-z0-9][a-z0-9\-/]*$/i.test(u)) return true;
  return /^https?:\/\/\S+$/i.test(u);
}

/**
 * O estado do par texto+destino, para a tela dizer o que está faltando.
 *
 * Os quatro casos são diferentes e merecem frases diferentes — um "campo
 * inválido" genérico faria a lojista adivinhar qual dos dois consertar.
 */
export type EstadoDoCta = "vazio" | "so_texto" | "so_destino" | "ok" | "destino_invalido";

export function estadoDoCta(texto: string | null | undefined, destino: string | null | undefined): EstadoDoCta {
  const t = String(texto || "").trim();
  const d = String(destino || "").trim();
  if (!t && !d) return "vazio";
  if (t && !d) return "so_texto";
  if (!t && d) return "so_destino";
  return destinoValido(d) ? "ok" : "destino_invalido";
}

/**
 * O aviso, na voz de quem vai consertar.
 *
 * `null` quando não há nada a dizer — banner sem CTA é uma escolha
 * legítima, e avisar sobre isso seria cobrar trabalho que ninguém pediu.
 */
export function avisoDoCta(estado: EstadoDoCta): string | null {
  switch (estado) {
    case "so_texto":
      return "Sem o link, o botão não aparece na loja. Cole o endereço para onde ele deve levar.";
    case "so_destino":
      return "Falta o texto do botão — sem ele não há o que clicar.";
    case "destino_invalido":
      return "O link precisa começar com https:// — ou ser uma categoria da loja, como #cat=/vestidos";
    default:
      return null;
  }
}

/**
 * Endereço colado do navegador costuma vir sem esquema ("loja.com/x").
 * Completar com https:// é o palpite certo em praticamente todo caso, e
 * a lojista vê o resultado no campo — não é correção escondida.
 */
export function normalizarDestino(url: string): string {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  // Categoria da loja: fica como esta.
  if (u.charAt(0) === "#") return u;
  // Só completa o que PARECE domínio. "abc" vira "https://abc" e não
  // ajuda ninguém; exigir o ponto evita transformar rascunho em link.
  if (/^[\w-]+(\.[\w-]+)+/.test(u)) return "https://" + u;
  return u;
}
