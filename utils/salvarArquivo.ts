// ============================================================
// AURA. — salvarArquivo: entregar um arquivo gerado no navegador
//
// Criado: 22/09/2026 (PWA Fase 2)
//
// Havia quatro cópias quase iguais de "cria um <a download>, clica,
// revoga a URL" espalhadas pelo app (utils/csv.ts, abcShared, saúde da
// rede do karatê, estúdio). Todas com o mesmo furo: no iPhone com a Aura
// INSTALADA, o <a download> não tem para onde ir — não existe pasta de
// downloads no app instalado, o arquivo abre numa tela sem saída.
//
// Aqui o caminho se divide uma vez só:
//   · iPhone instalado, com Web Share de arquivos → folha de compartilhar
//     do iPhone (Salvar em Arquivos, WhatsApp, Mail). É o que a pessoa
//     esperaria de um app.
//   · todo o resto (computador, Android, Safari não instalado) → o
//     download de sempre, sem mudança de comportamento.
//
// Sem `react-native` de propósito (testável em jsdom; web-only por
// natureza). Quem chama decide o que fazer com o resultado — em geral,
// nada: "compartilhado" e "baixado" são sucesso, "cancelado" é a pessoa
// fechando a folha, "indisponivel" é fora do web.
// ============================================================
import { ehIos, estaInstalado } from "@/services/instalarApp";

export type ResultadoDeSalvar = "compartilhado" | "baixado" | "cancelado" | "indisponivel";

function temJanela(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** iPhone/iPad com a Aura instalada e um navegador que compartilha arquivos. */
export function deveCompartilhar(arquivo: File, nav: any = temJanela() ? navigator : undefined, w: any = temJanela() ? window : undefined): boolean {
  if (!nav || !w) return false;
  if (!ehIos(nav.userAgent || "", nav.maxTouchPoints || 0, nav.platform || "")) return false;
  if (!estaInstalado(w)) return false;
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try { return nav.canShare({ files: [arquivo] }) === true; } catch { return false; }
}

/** O download de sempre: <a download>, clique, revoga a URL. */
export function baixarBlob(blob: Blob, nome: string, doc: Document = document, urlApi: typeof URL = URL): void {
  const url = urlApi.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  // Alguns navegadores só começam o download no próximo tick; revogar na
  // hora perde o arquivo (visto no Safari). 4s é folga.
  setTimeout(() => { try { urlApi.revokeObjectURL(url); } catch { /* já revogada */ } }, 4000);
}

/**
 * Entrega o arquivo do jeito que o aparelho aguenta. Nunca lança: erro de
 * compartilhamento cai para o download; download fora do web é
 * "indisponivel".
 */
export async function salvarBlob(blob: Blob, nome: string, deps?: { nav?: any; w?: any; doc?: Document }): Promise<ResultadoDeSalvar> {
  // Quem passa `deps` manda no ambiente inteiro, inclusive quando passa
  // undefined de propósito (teste de "fora do web"). Sem `deps`, é a janela.
  const w = deps && "w" in deps ? deps.w : (temJanela() ? window : undefined);
  const doc = deps && "doc" in deps ? deps.doc : (temJanela() ? document : undefined);
  const nav = deps && "nav" in deps ? deps.nav : (temJanela() ? navigator : undefined);
  if (!w || !doc) return "indisponivel";

  const tipo = blob.type || "application/octet-stream";
  let arquivo: File | null = null;
  try { arquivo = new File([blob], nome, { type: tipo }); } catch { arquivo = null; }

  if (arquivo && deveCompartilhar(arquivo, nav, w)) {
    try {
      await nav.share({ files: [arquivo], title: nome });
      return "compartilhado";
    } catch (err: any) {
      // A pessoa fechou a folha: não é erro, e não vale forçar um download
      // que ela não pediu.
      if (err && (err.name === "AbortError" || err.code === 20)) return "cancelado";
      // Qualquer outra falha do share: o download é o melhor que resta.
    }
  }

  baixarBlob(blob, nome, doc);
  return "baixado";
}

/** Atalho para texto (CSV, JSON, TXT). Põe o BOM que o Excel precisa para ler acento em CSV. */
export function salvarTexto(conteudo: string, nome: string, mime: string = "text/plain;charset=utf-8", comBom: boolean = /csv/i.test(mime) || /\.csv$/i.test(nome)): Promise<ResultadoDeSalvar> {
  const corpo = comBom && !conteudo.startsWith("﻿") ? "﻿" + conteudo : conteudo;
  return salvarBlob(new Blob([corpo], { type: mime }), nome);
}
