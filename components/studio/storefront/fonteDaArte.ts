// ============================================================
// components/studio/storefront/fonteDaArte.ts
//
// A fonte da arte tem de estar CARREGADA antes de o motor desenhar.
//
// QA 28/09 (CL-26): na polo, "HELENA" saía serifada e, quando a cliente
// enviava a arte, virava cursiva em negrito — sem ela ter escolhido fonte.
// A fonte certa sempre foi a primeira da lojista (Pacifico). O que mudava
// era o CARREGAMENTO: o navegador só baixa uma fonte da web quando algo a
// usa, e o canvas do motor (2D e a textura do 3D) desenha na hora com o
// que houver — a Pacifico ainda não tinha chegado, e o texto caía no
// degrau seguinte da pilha (Instrument Serif). O envio da arte redesenhava
// a peça, já com a Pacifico carregada. Para a cliente, a fonte "mudou
// sozinha".
//
// Agora quem desenha no canvas espera a fonte (com um teto curto: fonte
// que não chega não trava a prévia). Sem API de fontes (nativo, teste),
// não há o que esperar.
// ============================================================

/** Teto da espera: depois disto a prévia desenha com o que houver. */
export const ESPERA_DA_FONTE_MS = 2500;

const prontas = new Set<string>();
const esperando = new Map<string, Promise<void>>();

function fontes(): any | null {
  try {
    const d: any = typeof document !== "undefined" ? document : null;
    return d && d.fonts && typeof d.fonts.load === "function" ? d.fonts : null;
  } catch {
    return null;
  }
}

/** A declaração que o motor usa no canvas (peso 600: compose2d e compose3dMug). */
export function declaracaoDaFonte(pilha: string): string {
  return "600 48px " + String(pilha || "").trim();
}

/** A primeira família da pilha, sem aspas ("'Pacifico', Georgia" → "Pacifico"). */
export function primeiraFamilia(pilha: string | null | undefined): string {
  const p = String(pilha || "").split(",")[0] || "";
  return p.trim().replace(/^['"]|['"]$/g, "").trim();
}

/** A folha das fontes da vitrine (PaginaDaVitrine.tsx) ainda está chegando? */
function esperarAFolha(ms: number): Promise<void> {
  try {
    const link: any = typeof document !== "undefined" ? document.getElementById("aura-storefront-fonts") : null;
    if (!link || link.sheet) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const fim = () => resolve();
      link.addEventListener?.("load", fim, { once: true });
      link.addEventListener?.("error", fim, { once: true });
      setTimeout(fim, ms);
    });
  } catch {
    return Promise.resolve();
  }
}

/**
 * Espera a fonte da arte. Devolve `null` quando não há o que esperar (a
 * fonte já veio, ou não há API de fontes) — quem chama desenha na hora,
 * no mesmo passo. Senão, uma promessa que resolve quando a fonte chega
 * ou quando o teto passa (nunca rejeita).
 */
export function esperarFonteDaArte(
  pilha: string | null | undefined,
  teto: number = ESPERA_DA_FONTE_MS,
): Promise<void> | null {
  const f = fontes();
  const familia = primeiraFamilia(pilha);
  if (!f || !familia || !pilha) return null;
  const chave = String(pilha);
  if (prontas.has(chave)) return null;
  const decl = declaracaoDaFonte(chave);
  const ja = esperando.get(chave);
  if (ja) return ja;
  const p = new Promise<void>((resolve) => {
    let feito = false;
    const fim = () => { if (!feito) { feito = true; esperando.delete(chave); resolve(); } };
    setTimeout(fim, teto);
    esperarAFolha(teto)
      .then(() => f.load(decl, "Aa ÃÇÉ"))
      .then(() => {
        // Carregou — ou a família não existe na folha: nos dois casos não
        // há mais o que esperar da próxima vez.
        prontas.add(chave);
        fim();
      }, fim);
  });
  esperando.set(chave, p);
  return p;
}

/** Só para os testes: esquece o que já foi carregado. */
export function esquecerFontesCarregadas(): void {
  prontas.clear();
  esperando.clear();
}
