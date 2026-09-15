// ============================================================
// AURA. — Som de pedido novo no painel
// Criado: 10/09/2026 (decisão do Caio: ligado, com opção de desligar)
//
// Dois toques curtos em WebAudio — nenhum arquivo de áudio para baixar,
// mesmo caminho que o KDS do Food já usa (app/food/kds.tsx).
//
// O navegador só libera áudio depois de um gesto na página. O primeiro
// clique ou tecla destrava o contexto (instalarDesbloqueioDoSom); o uso
// normal do painel já cobre isso.
//
// A preferência é POR NAVEGADOR (localStorage), não da empresa: o som do
// computador do balcão não é o som do celular da dona.
// ============================================================

const CHAVE = "aura:som-pedido-v1";
// Três pedidos no mesmo segundo tocam uma vez, não três.
const INTERVALO_MINIMO_MS = 3000;

let _contexto: any = null;
let _ultimoToque = -Infinity;
let _desbloqueioInstalado = false;

function temJanela(): boolean {
  return typeof window !== "undefined";
}

export function somLigado(): boolean {
  try {
    if (!temJanela() || !window.localStorage) return true;
    return window.localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

export function definirSom(ligado: boolean): void {
  try {
    if (temJanela() && window.localStorage) window.localStorage.setItem(CHAVE, ligado ? "1" : "0");
  } catch { /* storage indisponível */ }
}

function contextoDeAudio(): any {
  if (!temJanela()) return null;
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!_contexto) {
    try { _contexto = new Ctx(); } catch { return null; }
  }
  return _contexto;
}

export function instalarDesbloqueioDoSom(): void {
  if (!temJanela() || _desbloqueioInstalado) return;
  _desbloqueioInstalado = true;
  const destravar = () => {
    const ctx = contextoDeAudio();
    if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", destravar, { passive: true } as any);
  window.addEventListener("keydown", destravar);
}

/** Toca o aviso. Devolve se tocou. `agora` é injetável para o teste. */
export function tocarAvisoDePedido(agora: number = Date.now()): boolean {
  if (!somLigado()) return false;
  if (agora - _ultimoToque < INTERVALO_MINIMO_MS) return false;
  const ctx = contextoDeAudio();
  if (!ctx) return false;
  _ultimoToque = agora;
  try {
    if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume().catch(() => {});
    const inicio = (ctx.currentTime || 0) + 0.02;
    // Mi e lá: sobe, chama atenção sem assustar.
    const notas: [number, number][] = [[659.25, 0], [880, 0.16]];
    for (const [frequencia, atraso] of notas) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequencia;
      osc.connect(ganho);
      ganho.connect(ctx.destination);
      const t0 = inicio + atraso;
      ganho.gain.setValueAtTime(0.0001, t0);
      ganho.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    }
    return true;
  } catch {
    return false;
  }
}

/** Só para teste. */
export function _resetSom(): void {
  _contexto = null;
  _ultimoToque = -Infinity;
  _desbloqueioInstalado = false;
}
