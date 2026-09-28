// ============================================================
// components/studio/orcamentoVideo/envioNoWhatsApp.ts
//
// Como o vídeo chega ao WhatsApp do cliente (orçamento em vídeo 3D,
// 28/09/2026). O vídeo vai EMBUTIDO na mensagem — sem link, sem página
// pública (decisão do PO).
//
// 1. Onde existe compartilhamento de arquivo (`navigator.canShare({files})`)
//    — celular E computador (Chrome/Edge no Windows, Safari/Chrome no
//    macOS abrem a folha do sistema, e o WhatsApp Desktop aparece como
//    destino): `navigator.share({ files: [mp4], text })`. A lojista escolhe
//    a conversa do cliente.
// 2. Onde não existe: baixa o MP4, copia o texto e abre a conversa do
//    cliente (wa.me/<número>?text=), com a instrução de arrastar o vídeo.
//
// O `navigator.share` exige um toque RECENTE: o vídeo já tem de estar
// pronto na memória quando a lojista toca em "Compartilhar" (a gravação
// acontece antes, no passo 3).
//
// Nunca manda nada sozinho: quem toca em enviar no WhatsApp é a lojista.
// ============================================================

export type CaminhoDeEnvio = "compartilhar" | "whatsapp";

/** Só dígitos, com DDI 55 quando vier só DDD + número. Null se não parece telefone. */
export function telefoneDoCliente(telefone: string | null | undefined): string | null {
  const d = String(telefone || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

/** wa.me para o NÚMERO DO CLIENTE com o texto pronto. O telefone vai só no destino. */
export function linkDaConversa(telefone: string | null | undefined, texto: string): string | null {
  const numero = telefoneDoCliente(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "orcamento-atelie-lume-mariana.mp4" — sem acento, sem espaço, curto. */
export function nomeDoArquivo(loja: string | null | undefined, cliente: string | null | undefined, ext: string): string {
  const partes = ["orcamento", loja, String(cliente || "").trim().split(/\s+/)[0]]
    .map((p) => semAcento(String(p || "")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return partes.join("-").slice(0, 60) + "." + ext;
}

type NavegadorComShare = {
  canShare?: (data: { files?: File[]; text?: string }) => boolean;
  share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>;
};

function navegador(): NavegadorComShare | null {
  return typeof navigator !== "undefined" ? (navigator as unknown as NavegadorComShare) : null;
}

/** O aparelho abre a folha de compartilhamento com arquivo? */
export function podeCompartilharArquivo(arquivo: File | null): boolean {
  const n = navegador();
  if (!arquivo || !n || typeof n.share !== "function" || typeof n.canShare !== "function") return false;
  try {
    return !!n.canShare({ files: [arquivo] });
  } catch {
    return false;
  }
}

export type ResultadoDoEnvio = "enviado" | "cancelado" | "falhou";

/**
 * Abre a folha de compartilhamento com o arquivo e o texto. "cancelado"
 * quando a lojista fecha a folha (AbortError) — aí nada é marcado.
 */
export async function compartilharArquivo(arquivo: File, texto: string): Promise<ResultadoDoEnvio> {
  const n = navegador();
  if (!n || typeof n.share !== "function") return "falhou";
  try {
    await n.share({ files: [arquivo], text: texto });
    return "enviado";
  } catch (e: any) {
    // AbortError: a lojista fechou a folha. O resto (NotAllowedError por
    // toque vencido, tipo não aceito) é falha e cai no caminho do wa.me.
    return e && e.name === "AbortError" ? "cancelado" : "falhou";
  }
}

/** Baixa o arquivo pelo navegador (link temporário). */
export function baixarArquivo(arquivo: Blob, nome: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Abre a conversa do cliente numa aba nova (WhatsApp Web ou app). */
export function abrirConversa(link: string): void {
  if (typeof window === "undefined") return;
  window.open(link, "_blank", "noopener");
}
