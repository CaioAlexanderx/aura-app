// ============================================================
// waGuiasVistos — quais guias do WhatsApp cada pessoa já viu (27/11/2026)
//
// Guarda por pessoa (não por loja): o "visto" do guia, a primeira abertura do
// menu de guias e o anúncio do Painel (uma vez só). Fica no navegador, com
// chave por id do usuário; não há rota no servidor para isso ainda. Sem
// storage (janela privada, bloqueio), tudo cai para "não visto" e a tela
// funciona do mesmo jeito, só repete o anúncio.
// ============================================================

export type ChaveVisto = "g1" | "g2" | "g3" | "anuncio" | "menu";
export type Vistos = Partial<Record<ChaveVisto, number>>;

const PREFIXO = "aura:wa-guias:v1:";
const CHAVES: ChaveVisto[] = ["g1", "g2", "g3", "anuncio", "menu"];

function chave(userId: string): string { return PREFIXO + userId; }

export function lerVistos(userId: string | null | undefined): Vistos {
  if (!userId) return {};
  try {
    if (typeof localStorage === "undefined") return {};
    const bruto = localStorage.getItem(chave(userId));
    if (!bruto) return {};
    const o = JSON.parse(bruto);
    if (!o || typeof o !== "object") return {};
    const out: Vistos = {};
    CHAVES.forEach((k) => {
      if (typeof o[k] === "number" && isFinite(o[k])) out[k] = o[k];
    });
    return out;
  } catch { return {}; }
}

export function gravarVistos(userId: string | null | undefined, vistos: Vistos): void {
  if (!userId) return;
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(chave(userId), JSON.stringify(vistos));
  } catch { /* sem storage: segue sem lembrar */ }
}

function diaLocal(ts: number): number {
  const d = new Date(ts);
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}

/** "visto hoje", "visto ontem", "visto há 3 dias", "visto em 05/11". */
export function rotuloVisto(ts: number, agora: number = Date.now()): string {
  const dias = diaLocal(agora) - diaLocal(ts);
  if (dias <= 0) return "visto hoje";
  if (dias === 1) return "visto ontem";
  if (dias < 7) return `visto há ${dias} dias`;
  const d = new Date(ts);
  return `visto em ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * O guia que o menu destaca com "comece aqui": sem número conectado é o 1;
 * conectado, o primeiro dos outros que ainda falta. Nenhum que falte: null.
 */
export function proximoGuia(conectado: boolean, vistos: Vistos, disponiveis: (1 | 2 | 3)[] = [1, 2, 3]): 1 | 2 | 3 | null {
  if (!conectado) return disponiveis.includes(1) ? 1 : null;
  const falta = ([2, 3] as (2 | 3)[]).find((n) => disponiveis.includes(n) && !vistos[("g" + n) as ChaveVisto]);
  return falta ?? null;
}
