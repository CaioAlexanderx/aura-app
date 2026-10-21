// ============================================================
// Orçamento de desempenho do palco da porta de entrada (tq-67)
//
// Condição do Board e do Caio: o palco (espiral, ondas, luz, orbe, aro)
// fica PARADO — fundo e espiral desenhados uma vez, sem ondas nem
// animações — quando qualquer uma destas vale:
//   - prefers-reduced-motion: reduce
//   - navigator.hardwareConcurrency <= 4
//   - navigator.deviceMemory <= 2
// Campo ausente (Safari e Firefox não expõem deviceMemory) não conta.
// ============================================================

export type SinaisDoAparelho = {
  reducedMotion?: boolean;
  hardwareConcurrency?: number | null;
  deviceMemory?: number | null;
};

export function palcoEstatico(s: SinaisDoAparelho): boolean {
  if (s.reducedMotion) return true;
  if (typeof s.hardwareConcurrency === "number" && s.hardwareConcurrency > 0 && s.hardwareConcurrency <= 4) return true;
  if (typeof s.deviceMemory === "number" && s.deviceMemory > 0 && s.deviceMemory <= 2) return true;
  return false;
}

/** Lê os sinais do navegador. Sem window (SSR, teste sem DOM): estático. */
export function sinaisDoNavegador(): SinaisDoAparelho | null {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined") return null;
    const mm = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      reducedMotion: !!(mm && mm.matches),
      hardwareConcurrency: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
      deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    };
  } catch {
    return null;
  }
}

export function palcoEstaticoNoNavegador(): boolean {
  const s = sinaisDoNavegador();
  return s ? palcoEstatico(s) : true;
}
