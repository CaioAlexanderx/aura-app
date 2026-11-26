// ============================================================
// waSaldo — leitura pura dos três saldos do WhatsApp da loja
//
// O servidor é quem decide; esta função só LÊ o que ele mandou e escolhe
// as palavras da tela. Duas regras:
//
// 1. Número ausente, negativo ou torto = saldo desconhecido = null. Quem
//    recebe null trava (nenhum botão de envio ativo) e diz que não
//    conseguiu ler. Nunca completa com zero nem com "ilimitado".
// 2. Os textos são os de Limites.dc.html, sem inventar.
// ============================================================
import type { WaSaldoBaldeRaw, WaSaldoRaw } from "@/services/waConfigApi";
import type { WaStatus } from "@/services/waApi";

export type BaldeKey = "novidades" | "avisos" | "aurinha";

export interface Balde {
  key: BaldeKey;
  rotulo: string;
  total: number;
  usado: number;
  restante: number;
  /** 0..1 do que JÁ foi gasto (para a barra). */
  gasto: number;
  esgotado: boolean;
  /** Restam 20% do total ou menos (e ainda sobra algum). */
  acabando: boolean;
  /** "Faltam N" quando acabando; null fora disso. */
  faltam: string | null;
  /** "72 de 100 livres". */
  livres: string;
  /** Frase de esgotado; null enquanto sobra. */
  textoEsgotado: string | null;
}

export interface SaldoInfo {
  baldes: Balde[];
  novidades: Balde;
  avisos: Balde;
  aurinha: Balde;
  mesNome: string;
  proximoMesNome: string;
  /** Essencial no presente de boas-vindas: o saldo não renova. */
  presente: boolean;
  textoPresente: string | null;
  /** A oferta "+ R$ 29/mês" só existe com o presente acabado (decisão do Caio, 26/11). */
  mostrarOferta: boolean;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ROTULOS: Record<BaldeKey, string> = {
  novidades: "Novidades",
  avisos: "Avisos e cobranças",
  aurinha: "Conversas da Aurinha",
};

function inteiro(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

/** Mês de referência: "AAAA-MM" do servidor; sem ele, o mês de hoje. */
export function waMesDoSaldo(mesRef: string | null | undefined, hoje: Date = new Date()): { nome: string; proximo: string } {
  let idx = hoje.getMonth();
  const m = /^(\d{4})-(\d{2})$/.exec(String(mesRef || ""));
  if (m) {
    const n = Number(m[2]) - 1;
    if (n >= 0 && n <= 11) idx = n;
  }
  return { nome: MESES[idx], proximo: MESES[(idx + 1) % 12] };
}

function lerBalde(key: BaldeKey, raw: WaSaldoBaldeRaw | null | undefined, mes: { nome: string; proximo: string }): Balde | null {
  if (!raw || typeof raw !== "object") return null;
  const total = inteiro(raw.total);
  if (total == null) return null;
  const usado = inteiro(raw.usado);
  let restante = inteiro(raw.restante);
  if (restante == null && usado != null) restante = Math.max(0, total - usado);
  if (restante == null) return null;
  restante = Math.min(restante, total);
  const gastoN = usado != null ? usado : total - restante;
  const esgotado = restante <= 0;
  const acabando = !esgotado && total > 0 && restante <= total * 0.2;

  let textoEsgotado: string | null = null;
  if (esgotado) {
    if (key === "novidades") {
      textoEsgotado = `As ${total} novidades de ${mes.nome} acabaram. Voltam em 1º de ${mes.proximo}.`;
    } else if (key === "avisos") {
      textoEsgotado = `Os ${total} avisos de ${mes.nome} acabaram.`;
    } else {
      textoEsgotado = `A Aurinha atendeu as ${total} conversas do mês. As novas ficam com você.`;
    }
  }

  return {
    key,
    rotulo: ROTULOS[key],
    total,
    usado: gastoN,
    restante,
    gasto: total > 0 ? Math.min(1, Math.max(0, gastoN / total)) : 1,
    esgotado,
    acabando,
    faltam: acabando ? `Faltam ${restante}` : null,
    livres: `${restante} de ${total} livres`,
    textoEsgotado,
  };
}

/**
 * Lê o saldo do servidor. Qualquer um dos três baldes ilegível derruba a
 * leitura inteira (null): metade do saldo é pior que nenhum, porque a
 * tela poderia liberar um botão com base no balde que sobrou.
 */
export function waSaldoInfo(raw: WaSaldoRaw | null | undefined, hoje: Date = new Date()): SaldoInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const mes = waMesDoSaldo(raw.mes_ref, hoje);
  const novidades = lerBalde("novidades", raw.novidades, mes);
  const avisos = lerBalde("avisos", raw.avisos, mes);
  const aurinha = lerBalde("aurinha", raw.aurinha, mes);
  if (!novidades || !avisos || !aurinha) return null;

  const presente = raw.presente_boas_vindas === true;
  const textoPresente = presente
    ? `Presente de boas-vindas: ${avisos.total} avisos, ${novidades.total} novidades, ${aurinha.total} conversas da Aurinha · não renova`
    : null;

  // A oferta "+ R$ 29/mês" fica ao lado do "WhatsApp do celular", que é o
  // que a loja usa quando os AVISOS acabam. Só então, e só no presente.
  const mostrarOferta = presente && avisos.esgotado;

  return {
    baldes: [novidades, avisos, aurinha],
    novidades, avisos, aurinha,
    mesNome: mes.nome,
    proximoMesNome: mes.proximo,
    presente,
    textoPresente,
    mostrarOferta,
  };
}

/** Texto da oferta do Essencial (franquia mensal do plano de R$ 29). */
export const TEXTO_OFERTA_ESSENCIAL =
  "Ou assine + R$ 29/mês: 100 avisos, 10 novidades e 80 conversas da Aurinha, todo mês.";

/**
 * Número em atenção: a Meta rebaixou a qualidade (amarelo ou vermelho) ou
 * a fila está pausada por qualidade/restrição. Pausa as NOVIDADES; avisos
 * e cobranças continuam. Status ausente = não afirma nada (o bloqueio de
 * quem não leu o status é do waGuards, não deste aviso).
 */
export function waNumeroEmAtencao(status: WaStatus | null | undefined): boolean {
  if (!status) return false;
  const q = String(status.quality_rating || "").toUpperCase();
  if (q === "YELLOW" || q === "RED") return true;
  const p = String(status.paused_reason || "").toUpperCase();
  return p === "QUALIDADE_BAIXA" || p === "CONTA_RESTRITA";
}

export const TEXTO_NUMERO_EM_ATENCAO =
  "O WhatsApp pediu uma pausa nas novidades. Avisos e cobranças continuam.";
