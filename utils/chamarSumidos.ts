// ============================================================
// AURA. — "Chamar" quem sumiu com um toque (wa.me), 14/10/2026 (card t3-06)
//
// Decisão do Caio (13/10): a Reativação volta ao menu e o Essencial a usa SEM
// conectar o número da Meta. Cada cliente sumido ganha um botão "Chamar" que
// abre o WhatsApp da própria loja com a mensagem pronta (wa.me, grátis, o
// mesmo padrão da cobrança do Crediário). O disparo em massa pela API da Meta
// continua sendo a versão paga, só no Negócio, só com o número conectado.
//
// Aqui fica só o que é função pura: quem entra na lista, o texto da mensagem
// e a marca "chamado em". O texto passa pela aprovação do Caio (mockup da
// ação 9), por isso mora numa constante só.
//
// A marca "chamado em" é LOCAL (neste aparelho/navegador): o backend ainda
// não tem rota para gravar "chamado por wa.me". Quando tiver, troca-se o
// armazenamento em `criarMarcasDeChamado` sem mexer na tela.
// ============================================================
import { diasSemComprar } from "@/components/screens/clientes/diasSemComprar";
import { normalizeBrPhone } from "@/utils/whatsapp";

export type ClienteSumido = {
  id: string;
  name: string;
  phone: string;
  lastPurchase: string;
  totalSpent: number;
};

export type SumidoParaChamar = {
  id: string;
  nome: string;
  /** Telefone válido (DDI 55) ou null quando o cadastro não tem. */
  telefone: string | null;
  dias: number;
  gasto: number;
};

/** Primeiro nome, para a mensagem soar como a dona da loja escrevendo. */
export function primeiroNome(nome: string | null | undefined): string {
  const t = String(nome || "").trim();
  return t ? t.split(/\s+/)[0] : "";
}

/**
 * Quem entra na lista: sem comprar há `corteDias` dias ou mais, ordenado por
 * quanto já gastou (quem mais valeu para a loja vem primeiro). Quem nunca
 * comprou não é "sumido" e não entra.
 */
export function listarSumidos(
  clientes: ClienteSumido[],
  corteDias: number,
  agora: number = Date.now(),
): SumidoParaChamar[] {
  const saida: SumidoParaChamar[] = [];
  for (const c of clientes || []) {
    const dias = diasSemComprar(c?.lastPurchase, agora);
    if (dias == null || dias < corteDias) continue;
    saida.push({
      id: c.id,
      nome: c.name || "Cliente",
      telefone: normalizeBrPhone(c.phone),
      dias,
      gasto: Number(c.totalSpent) || 0,
    });
  }
  saida.sort((a, b) => b.gasto - a.gasto || b.dias - a.dias);
  return saida;
}

export const TEXTOS_CHAMAR = {
  mensagem: (nome: string, loja: string) => {
    const oi = nome ? `Oi, ${nome}!` : "Oi!";
    const quem = loja ? ` Aqui é da ${loja}.` : "";
    return `${oi}${quem} Faz um tempo que você não passa por aqui e sentimos sua falta. Posso te mostrar o que chegou de novo?`;
  },
} as const;

/** Mensagem pronta do botão "Chamar". */
export function mensagemDeChamado(nomeCompleto: string, loja?: string | null): string {
  return TEXTOS_CHAMAR.mensagem(primeiroNome(nomeCompleto), String(loja || "").trim());
}

// ── marca "chamado em" ─────────────────────────────────────────

export type ArmazemSimples = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
};

export type MarcasDeChamado = {
  /** id do cliente → timestamp (ms) do último "Chamar". */
  ler: () => Record<string, number>;
  marcar: (clienteId: string, quando?: number) => Record<string, number>;
};

/** Armazém do navegador, ou null quando não há (nativo, modo privado). */
export function armazemDoNavegador(): ArmazemSimples | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* sem acesso */ }
  return null;
}

/**
 * Marcas por empresa. Sem armazém, vale só na sessão (memória). Nunca lança:
 * a marca é conforto, não pode atrapalhar o toque que abre o WhatsApp.
 */
export function criarMarcasDeChamado(
  empresaId: string,
  armazem: ArmazemSimples | null = armazemDoNavegador(),
): MarcasDeChamado {
  const chave = `aura_chamados_${empresaId || "sem-empresa"}`;
  let memoria: Record<string, number> = {};

  function ler(): Record<string, number> {
    if (!armazem) return { ...memoria };
    try {
      const bruto = armazem.getItem(chave);
      const obj = bruto ? JSON.parse(bruto) : {};
      return obj && typeof obj === "object" ? (obj as Record<string, number>) : {};
    } catch {
      return { ...memoria };
    }
  }

  return {
    ler,
    marcar(clienteId, quando = Date.now()) {
      const novo = { ...ler(), [clienteId]: quando };
      memoria = novo;
      if (armazem) {
        try { armazem.setItem(chave, JSON.stringify(novo)); } catch { /* segue em memória */ }
      }
      return novo;
    },
  };
}

/** "dd/mm" a partir do timestamp, no fuso do aparelho. */
export function diaMesBR(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
