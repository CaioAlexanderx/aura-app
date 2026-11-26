// ============================================================
// Imprimir o comprovante da condicional (C8, 25/11/2026)
//
// Duas folhas do backend: bobina de 80 mm e A4
// (GET /companies/:id/print/condicional/:cid[/a4]). Mesmo caminho do cupom:
// janela aberta dentro do clique (printWindow) e o HTML navega por blob URL.
// Chamar SEMPRE direto do onPress, antes de qualquer await.
// ============================================================
import { BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { openPrintWindow, type PrintOutcome } from "@/services/printWindow";

export type FormatoDoComprovante = "bobina" | "a4";

export function urlDoComprovanteDaCondicional(
  companyId: string,
  condicionalId: string,
  formato: FormatoDoComprovante,
  base: string = BASE_URL,
): string {
  return `${base}/companies/${companyId}/print/condicional/${condicionalId}${formato === "a4" ? "/a4" : ""}?autoprint=1`;
}

export async function imprimirComprovanteDaCondicional(
  companyId: string,
  condicionalId: string,
  formato: FormatoDoComprovante,
): Promise<PrintOutcome> {
  const url = urlDoComprovanteDaCondicional(companyId, condicionalId, formato);
  const token = useAuthStore.getState().token;
  return openPrintWindow(
    async () => {
      const resp = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {} });
      if (!resp.ok) return { ok: false as const, error: "Não deu para carregar o comprovante (" + resp.status + ")." };
      return { ok: true as const, html: await resp.text() };
    },
    formato === "a4" ? "width=900,height=800,scrollbars=yes" : "width=420,height=700,scrollbars=yes",
  );
}
