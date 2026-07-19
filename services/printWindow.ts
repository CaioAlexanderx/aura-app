// ============================================================
// printWindow — abertura CONFIÁVEL de janela de impressão (10/07/2026).
//
// PROBLEMA (relato Davi, PDV): "a impressão nem sempre sai". Os fluxos
// faziam `await fetch(...)` e SÓ DEPOIS `window.open(...)`. O Chrome
// consome a "user activation" do clique no gap do await e bloqueia o
// pop-up de forma INTERMITENTE (depende da latência do fetch) — com um
// toast de erro fácil de não ver no balcão.
//
// SOLUÇÃO: abrir a janela SINCRONAMENTE dentro do gesto do clique, com
// um placeholder "Gerando impressão…", e entregar o conteúdo quando o
// fetch terminar. Erro do backend aparece DENTRO da janela (ex.: 409
// "DANFE só pode ser impressa quando autorizada").
//
// 18/07/2026 ("Falha na impressão" nas 2 lojas do Davi): o conteúdo
// final NÃO é mais injetado via document.write — a janela NAVEGA para
// uma blob URL. O print programático disparado durante/logo após a
// troca de documento via document.write morria na CRIAÇÃO do preview:
// o Chrome abortava o job e mostrava "Falha na impressão. Verifique a
// impressora e tente novamente" ancorado na aba do APP, sem job algum
// chegar à impressora (medido em Chrome 150: o window.print() do cupom
// executava reentrante, DENTRO do document.close() chamado pelo
// opener). Navegação real = ciclo de vida normal do documento — o
// mesmo padrão das etiquetas (PrintLabels), único fluxo que nunca
// falhou. document.write continua APENAS no placeholder e em mensagens
// de erro (que não imprimem nada).
//
// USO: chamar openPrintWindow() de forma SÍNCRONA no onPress (nunca
// depois de um await) — o window.open acontece antes do primeiro await.
// ============================================================
import { Platform } from "react-native";

export type PrintFetchResult =
  | { ok: true; html?: string; url?: string }
  | { ok: false; error?: string };

export type PrintOutcome = "ok" | "blocked" | "error";

const PLACEHOLDER = `<!doctype html><html><head><meta charset="utf-8"><title>Imprimindo…</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;color:#666;font-size:15px}</style>
</head><body>Gerando impressão…</body></html>`;

// SÓ para placeholder e mensagens de erro. NUNCA para conteúdo que vai
// imprimir — conteúdo de impressão navega via blob URL (ver header).
function writeDoc(win: Window, html: string) {
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {}
}

export async function openPrintWindow(
  fetchContent: () => Promise<PrintFetchResult>,
  features: string = "width=420,height=700,scrollbars=yes",
): Promise<PrintOutcome> {
  if (Platform.OS !== "web" || typeof window === "undefined") return "error";

  // SÍNCRONO — ainda dentro da user activation do clique.
  const win = window.open("", "_blank", features);
  if (!win) return "blocked"; // bloqueado mesmo no gesto (bloqueio manual do site)
  writeDoc(win, PLACEHOLDER);

  try {
    const r = await fetchContent();
    if (!r.ok) {
      const msg = String(r.error || "Erro ao gerar impressão").replace(/</g, "&lt;");
      writeDoc(win, `<!doctype html><html><head><meta charset="utf-8"><title>Erro</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#b00020;line-height:1.5">${msg}</body></html>`);
      return "error";
    }
    // Navegação real — nunca document.write pro conteúdo que imprime.
    const isBlob = !r.url;
    const url = r.url ?? URL.createObjectURL(new Blob([r.html || ""], { type: "text/html" }));
    try {
      win.location.href = url;
    } catch {
      try { win.close(); } catch {}
      if (isBlob) { try { URL.revokeObjectURL(url); } catch {} }
      return "error";
    }
    if (isBlob) {
      // A navegação consome a blob em ms; 60s é folga p/ máquina lenta.
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60_000);
    }
    return "ok";
  } catch {
    try { win.close(); } catch {}
    return "error";
  }
}

export default openPrintWindow;
