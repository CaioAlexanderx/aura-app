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
  /** Chave do aviso de 20% (uma vez por chave); null se o servidor não mandou. */
  avisoChave: string | null;
  /** ISO "AAAA-MM-DD" de quando volta; null = não volta sozinho (Essencial sem add-on). */
  renovaEm: string | null;
  /** O pacote que a tela oferece comprar (preço e quantidade vêm do servidor). */
  pacote: { qty: number; precoCentavos: number; precoTxt: string; rotulo: string } | null;
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
  /** A oferta "+ R$ 29/mês" só existe com o presente acabado (regra 11 do plano). */
  mostrarOferta: boolean;
  /** O número está em atenção (qualidade/pausa): pausa as novidades. */
  numeroEmAtencao: boolean;
  /** Trava WA_SALDO_ATIVO ligada no servidor (desligada: as guardas antigas valem). */
  ativo: boolean;
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

const ROTULO_PACOTE: Record<BaldeKey, string> = {
  novidades: "novidades",
  avisos: "avisos",
  aurinha: "conversas da Aurinha",
};

/** 6900 -> "R$ 69"; 1990 -> "R$ 19,90". */
export function precoPacote(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const cent = centavos % 100;
  return cent === 0 ? `R$ ${reais}` : `R$ ${reais},${String(cent).padStart(2, "0")}`;
}

/** Mês (nome) de um ISO "AAAA-MM-DD"; torto = null. */
function mesDoIso(iso: string | null | undefined): string | null {
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(String(iso || ""));
  if (!m) return null;
  const i = Number(m[1]) - 1;
  return i >= 0 && i <= 11 ? MESES[i] : null;
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
  // Na dúvida, o mais cauteloso: esgotado se o número OU a flag disserem.
  const esgotado = restante <= 0 || raw.esgotado === true;
  const acabando = !esgotado && ((total > 0 && restante <= total * 0.2) || raw.baixo === true);
  const renovaEm = typeof raw.renova_em === "string" && raw.renova_em ? raw.renova_em : null;
  const mesVolta = mesDoIso(renovaEm) || mes.proximo;

  let textoEsgotado: string | null = null;
  if (esgotado) {
    if (key === "novidades") {
      textoEsgotado = renovaEm
        ? `As ${total} novidades de ${mes.nome} acabaram. Voltam em 1º de ${mesVolta}.`
        : `As ${total} novidades acabaram.`;
    } else if (key === "avisos") {
      textoEsgotado = renovaEm ? `Os ${total} avisos de ${mes.nome} acabaram.` : `Os ${total} avisos acabaram.`;
    } else {
      textoEsgotado = `A Aurinha atendeu as ${total} conversas${renovaEm ? " do mês" : ""}. As novas ficam com você.`;
    }
  }

  const qty = inteiro(raw.pacote?.qty);
  const preco = inteiro(raw.pacote?.preco_centavos);
  const pacote = qty != null && qty > 0 && preco != null && preco > 0
    ? { qty, precoCentavos: preco, precoTxt: precoPacote(preco), rotulo: `Adicionar ${qty} ${ROTULO_PACOTE[key]} por ${precoPacote(preco)}` }
    : null;

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
    avisoChave: typeof raw.aviso_chave === "string" ? raw.aviso_chave : null,
    renovaEm,
    pacote,
  };
}

/**
 * Lê o saldo do servidor. Qualquer um dos três baldes ilegível derruba a
 * leitura inteira (null): metade do saldo é pior que nenhum, porque a
 * tela poderia liberar um botão com base no balde que sobrou.
 */
export function waSaldoInfo(raw: WaSaldoRaw | null | undefined, hoje: Date = new Date()): SaldoInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const mes = waMesDoSaldo(raw.mes, hoje);
  const s = raw.saldos;
  if (!s || typeof s !== "object") return null;
  const novidades = lerBalde("novidades", s.novidades, mes);
  const avisos = lerBalde("avisos", s.avisos, mes);
  const aurinha = lerBalde("aurinha", s.aurinha, mes);
  if (!novidades || !avisos || !aurinha) return null;

  // Sem a informação do plano, não afirma que o saldo "não renova".
  const renova = raw.plano?.renova;
  const presente = renova === false;
  const baldes = [novidades, avisos, aurinha];
  const textoPresente = presente
    ? `Presente de boas-vindas: ${avisos.total} avisos, ${novidades.total} novidades, ${aurinha.total} conversas da Aurinha · não renova`
    : null;

  // Regra 11: a oferta dos R$ 29 só aparece quando o presente acaba
  // (plano que não renova e algum saldo esgotado).
  const mostrarOferta = presente && baldes.some((b) => b.esgotado);

  const numeroEmAtencao = raw.numero?.em_atencao === true;

  return {
    baldes,
    novidades, avisos, aurinha,
    mesNome: mes.nome,
    proximoMesNome: mes.proximo,
    presente,
    textoPresente,
    mostrarOferta,
    numeroEmAtencao,
    ativo: raw.ativo === true,
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
