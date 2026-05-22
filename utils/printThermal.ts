import { Platform } from "react-native";
import { toast } from "@/components/Toast";

// ============================================================
// printThermal.ts — Fase 7 Aura Food
//
// Helper pra disparar window.print() em conteudo HTML servido por
// URL externa, via iframe oculto. Usado pra:
//   - comanda termica 80mm da cozinha (auto-print ao confirmar pedido)
//   - cupom NFC-e termico do cliente (apos fechar mesa)
//
// Web only. Em native (iPad app/Android), mostramos toast informativo
// avisando que auto-print so funciona no navegador desktop.
//
// Implementacao:
//   1. cria iframe (display:none) com src = URL absoluta do backend
//   2. onLoad chama iframe.contentWindow.print()
//   3. remove iframe apos 2s (margem de seguranca pra dialogo abrir)
//
// O iframe carrega HTML com @media print + papel 80mm; o navegador
// abre o dialogo nativo apontando pra impressora padrao do SO.
// ============================================================

export function isThermalPrintSupported(): boolean {
  return Platform.OS === "web" && typeof document !== "undefined";
}

export function printThermalUrl(url: string, opts?: { silent?: boolean }): void {
  if (!isThermalPrintSupported()) {
    if (!opts?.silent) {
      toast.info("Impressao termica disponivel apenas no navegador desktop");
    }
    return;
  }
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = url;

    let printed = false;
    iframe.onload = () => {
      try {
        const w = iframe.contentWindow;
        if (w && !printed) {
          printed = true;
          // pequeno delay pra garantir render de @media print
          setTimeout(() => {
            try { w.focus(); } catch {}
            try { w.print(); } catch {}
          }, 120);
        }
      } catch {
        // cross-origin: o backend deve servir mesmo origin/CORS adequado.
        if (!opts?.silent) toast.error("Falha ao acionar impressao (origem)");
      }
    };
    iframe.onerror = () => {
      if (!opts?.silent) toast.error("Falha ao carregar pagina de impressao");
    };

    document.body.appendChild(iframe);

    // garante remocao mesmo se onLoad nunca disparar
    setTimeout(() => {
      try { iframe.parentNode?.removeChild(iframe); } catch {}
    }, 8000);
  } catch (err) {
    if (!opts?.silent) toast.error("Erro ao iniciar impressao termica");
  }
}

// Constroi URL absoluta pra comanda da cozinha
export function buildComandaUrl(baseUrl: string, companyId: string, orderId: string, token?: string | null): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = base + "/companies/" + companyId + "/food/orders/" + orderId + "/comanda";
  // GET endpoint do backend ja serve HTML com @media print correto.
  // Token vai como query pra autenticar a request do iframe (que nao
  // consegue passar Authorization header).
  return token ? path + "?token=" + encodeURIComponent(token) : path;
}

// Constroi URL absoluta pra cupom termico (NFC-e DANFE simplificado)
export function buildCupomUrl(baseUrl: string, companyId: string, orderId: string, token?: string | null): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = base + "/companies/" + companyId + "/food/orders/" + orderId + "/cupom";
  return token ? path + "?token=" + encodeURIComponent(token) : path;
}
