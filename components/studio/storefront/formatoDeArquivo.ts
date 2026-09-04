// ============================================================
// components/studio/storefront/formatoDeArquivo.ts
//
// O arquivo que o cliente escolheu serve para este campo?
//
// A lojista configura os formatos aceitos e, na prática, eles chegam de
// dois jeitos: como MIME ("image/png") ou como extensão solta ("png").
// O navegador, por sua vez, entrega o arquivo com `file.type` em MIME.
// A comparação era `formats.includes(file.type)` — e numa loja com
// `["png","jpg","jpeg","pdf"]` TODO upload era recusado com "Formato
// inválido", inclusive um PNG perfeito. Visto na CANECA BRANCA da Sheid
// em 04/09/2026: a cliente não tinha como mandar a foto.
//
// Aqui os dois lados são normalizados para extensão antes de comparar,
// e o nome do arquivo serve de segunda chance quando o navegador não
// informa o tipo (acontece com arquivos vindos de apps de mensagem).
// ============================================================

const MIME_PARA_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/** "jpeg" e "jpg" são o mesmo formato para quem escolhe o arquivo. */
function canonica(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, "");
  return e === "jpeg" ? "jpg" : e;
}

/** A extensão de um formato configurado, seja ele MIME ou extensão solta. */
export function extensaoDoFormato(f: unknown): string | null {
  const s = typeof f === "string" ? f.trim() : "";
  if (!s) return null;
  if (s.includes("/")) {
    const porTabela = MIME_PARA_EXT[s.toLowerCase()];
    if (porTabela) return porTabela;
    const parte = s.split("/")[1] || "";
    return parte ? canonica(parte) : null;
  }
  return canonica(s) || null;
}

/** A extensão de um nome de arquivo ("foto.PNG" → "png"). */
export function extensaoDoNome(nome: unknown): string | null {
  const s = typeof nome === "string" ? nome.trim() : "";
  const m = s.match(/\.([a-z0-9]+)$/i);
  return m ? canonica(m[1]) : null;
}

/**
 * Decide se o arquivo entra.
 *
 * Aceita quando o tipo informado pelo navegador OU a extensão do nome
 * bate com algum formato configurado. Lista vazia não bloqueia nada — a
 * regra de "sem formato configurado" é do chamador (que usa o padrão).
 */
export function formatoAceito(
  formatos: unknown[] | null | undefined,
  tipoDoArquivo: string | null | undefined,
  nomeDoArquivo?: string | null,
): boolean {
  const aceitos = new Set(
    (formatos || []).map(extensaoDoFormato).filter((e): e is string => !!e),
  );
  if (aceitos.size === 0) return true;
  const porTipo = extensaoDoFormato(tipoDoArquivo || "");
  if (porTipo && aceitos.has(porTipo)) return true;
  const porNome = extensaoDoNome(nomeDoArquivo || "");
  return !!porNome && aceitos.has(porNome);
}
