// ============================================================
// components/studio/storefront/compartilhar.ts
//
// Onda 1B: o "Compartilhar" da página da peça (mockup da Fase 1, Tela 2).
//
// No celular abre a folha nativa (navigator.share) — é onde o WhatsApp
// está. No computador o mesmo botão copia o link direto e avisa "Link da
// peça copiado": a folha do sistema no desktop lista apps que ninguém
// usa para mandar uma caneca (nota do mockup). Sem folha nenhuma, copia.
//
// A decisão fica aqui, com o navegador injetado, para ter teste; a tela
// (BotaoCompartilhar) só chama e mostra o aviso.
// ============================================================

export type ResultadoDoCompartilhar = "compartilhado" | "copiado" | "cancelado" | "falhou";

export type AmbienteDeCompartilhar = {
  /** navigator.share, quando existe. */
  share?: (dados: { title?: string; text?: string; url: string }) => Promise<void>;
  canShare?: (dados: { url: string }) => boolean;
  /** Toque é o jeito principal de apontar (celular, tablet)? */
  toque?: boolean;
  /** Copia um texto; rejeita quando não conseguiu. */
  copiar?: (texto: string) => Promise<void>;
};

export async function compartilharOuCopiar(
  dados: { titulo: string; url: string },
  amb: AmbienteDeCompartilhar,
): Promise<ResultadoDoCompartilhar> {
  const payload = { title: dados.titulo, url: dados.url };
  let podeFolha = false;
  try { podeFolha = !!amb.share && !!amb.toque && (amb.canShare ? amb.canShare(payload) : true); }
  catch { podeFolha = false; }
  if (podeFolha) {
    try {
      await amb.share!(payload);
      return "compartilhado";
    } catch (e: any) {
      // Fechar a folha sem escolher nada não é erro, e copiar por cima
      // seria fazer uma coisa que a cliente não pediu.
      if (e && e.name === "AbortError") return "cancelado";
      // Qualquer outra falha (permissão, iframe): cai para copiar.
    }
  }
  if (amb.copiar) {
    try {
      await amb.copiar(dados.url);
      return "copiado";
    } catch { /* sem área de transferência */ }
  }
  return "falhou";
}

/** O ambiente do navegador de verdade. Nada aqui lança. */
export function ambienteDoNavegador(): AmbienteDeCompartilhar {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};
  const nav: any = navigator;
  let toque = false;
  try { toque = !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch { toque = false; }
  return {
    share: typeof nav.share === "function" ? (d) => nav.share(d) : undefined,
    canShare: typeof nav.canShare === "function" ? (d) => nav.canShare(d) : undefined,
    toque,
    copiar: async (texto: string) => {
      if (nav.clipboard && typeof nav.clipboard.writeText === "function") {
        try { await nav.clipboard.writeText(texto); return; } catch { /* tenta o jeito antigo */ }
      }
      // Fora de contexto seguro (http, iframe sem permissão) a API nova
      // não existe: o textarea escondido ainda funciona na maioria.
      if (typeof document === "undefined") throw new Error("sem documento");
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } finally { document.body.removeChild(campo); }
      if (!ok) throw new Error("copiar falhou");
    },
  };
}
