// ============================================================
// AURA. — Impressão por quadro oculto (p-160, 17/11/2026)
//
// A impressão automática do cupom não pode usar a janela pop-up do botão
// (services/printWindow.ts): o pop-up só é liberado dentro do clique, e a
// venda responde 3 a 5 s depois do "Finalizar". Aqui o cupom vai para um
// <iframe> invisível dentro da própria página do Caixa. O HTML do
// /print/receipt/:id/preview já traz o autoPrintScript (espera as imagens e
// chama window.print() de dentro do quadro), então o diálogo de impressão
// abre com o cupom e só o cupom.
//
// Como no printWindow, o conteúdo NAVEGA para uma blob URL (nunca
// document.write no conteúdo que imprime — ver o cabeçalho de printWindow).
// O quadro sai da página depois de imprimir (afterprint) ou em 2 min.
// ============================================================

const TETO_MS = 120_000;

export type ResultadoDoQuadro = "ok" | "sem_janela" | "erro";

export function imprimirNoQuadro(html: string, docDoTeste?: Document | null): ResultadoDoQuadro {
  const doc = docDoTeste === undefined ? (typeof document !== "undefined" ? document : null) : docDoTeste;
  if (!doc || !doc.body || typeof URL === "undefined" || typeof Blob === "undefined") return "sem_janela";
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([html || ""], { type: "text/html" }));
    const quadro = doc.createElement("iframe");
    quadro.setAttribute("aria-hidden", "true");
    quadro.setAttribute("tabindex", "-1");
    quadro.setAttribute("data-testid", "quadro-do-cupom");
    // Fora da vista, mas com tamanho: quadro com display:none não imprime em
    // todo navegador.
    quadro.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
    let removido = false;
    const urlFinal = url;
    const remover = () => {
      if (removido) return;
      removido = true;
      try { quadro.remove(); } catch { /* já saiu */ }
      try { URL.revokeObjectURL(urlFinal); } catch { /* nada */ }
    };
    quadro.addEventListener("load", () => {
      try {
        const w = quadro.contentWindow;
        if (w) w.addEventListener("afterprint", () => setTimeout(remover, 500));
      } catch { /* sem acesso: sai pelo teto */ }
    });
    setTimeout(remover, TETO_MS);
    doc.body.appendChild(quadro);
    quadro.src = urlFinal;
    return "ok";
  } catch {
    if (url) { try { URL.revokeObjectURL(url); } catch { /* nada */ } }
    return "erro";
  }
}

// Uma vez por venda nesta aba: voltar à tela final (re-render, troca de
// layout) não imprime de novo.
const impressas = new Set<string>();

export function jaImprimiuSozinho(saleId: string): boolean {
  return impressas.has(saleId);
}

export function marcarImpressaSozinha(saleId: string): void {
  impressas.add(saleId);
  if (impressas.size > 500) {
    const primeira = impressas.values().next().value;
    if (primeira !== undefined) impressas.delete(primeira);
  }
}

export function __zerarImpressoesParaTestes(): void {
  impressas.clear();
}

/** Venda registrada no servidor (UUID). A venda do modo demonstração tem um id curto. */
export function ehVendaDoServidor(saleId: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(saleId || ""));
}
