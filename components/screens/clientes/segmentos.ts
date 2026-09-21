// ============================================================
// segmentos — Fase 1 (C1.2): segmentos prontos em português, uma tag por
// cliente.
//
// Antes deste arquivo a lista de clientes calculava até 3 tags fixas ao
// mesmo tempo (getStatus em ./types.ts: Devendo, VIP ≥ R$ 2.000, Frequente
// ≥ 10 visitas, Novo ≤ 3, Inativo), e a linha do cliente mostrava as duas
// primeiras — o mesmo cliente podia estampar "VIP" e "Devendo" juntos sem
// dizer qual das duas é a informação que importa agora.
//
// Aqui cada cliente recebe UM segmento só, escolhido por prioridade: o
// que o lojista mais precisa saber (que o cliente deve, ou sumiu) vence o
// que é só um reconhecimento (que ele é VIP). `classificarCliente` devolve
// também o `motivo` em português — a frase que explica a tag, usada como
// accessibilityLabel na linha (CustomerRow.tsx).
//
// Módulo puro: nada de rede, nada de React. `diasSemComprar.ts` continua
// dono dos limiares de dias (0–30 ativo, 31–60 em risco, 61–120 inativo,
// 121+ perdido) — este arquivo só lê de lá, nunca redefine um limiar.
//
// PRIORIDADE da tag única (maior prioridade primeiro):
//   1. Devendo             — saldo de crediário em aberto > 0
//   2. Pronto pra comprar  — quitou o crediário recentemente
//   3. Perdido             — 121+ dias sem comprar (régua única)
//   4. Sumido              — 61–120 dias (o "inativo" da régua única;
//                            rótulo visível trocou de "Inativo" pra
//                            "Sumido", chave interna da régua é a mesma)
//   5. Em risco            — 31–60 dias OU passou de 1,5x o intervalo
//                            habitual do próprio cliente (3+ compras)
//   6. VIP                 — top 10% da própria loja por gasto (top 20%
//                            em bases com menos de 20 clientes), piso de
//                            2 compras
//   7. Recorrente          — 3+ compras e ativo (0–30 dias)
//   8. Novo                — primeira compra/cadastro ≤30 dias e ≤2 compras
//   9. Comprou uma vez     — exatamente 1 compra, fora de Novo
//   (Aniversariante do mês é segmento de FILTRO, não disputa a tag única
//    — ver `ehAniversarianteDoMes` no fim do arquivo.)
//
// Dois segmentos de fallback, fora da lista acima, garantem que
// `classificarCliente` sempre devolve algo (nenhum cliente fica sem tag):
//   - "ativo"       — comprou nos últimos 30 dias mas não é VIP, Recorrente
//                     (menos de 3 compras) nem Novo (cadastro > 30 dias).
//   - "sem_compras" — nunca comprou e o cadastro já passou de 30 dias
//                     (sem isso ele não cairia em faixa de dias nenhuma
//                     nem em "Novo").
// ============================================================
import {
  diasSemComprar,
  classificarDias,
  type FaixaDias,
} from "./diasSemComprar";

export type SegmentoId =
  | "devendo"
  | "pronto_pra_comprar"
  | "perdido"
  | "sumido"
  | "em_risco"
  | "vip"
  | "recorrente"
  | "novo"
  | "comprou_uma_vez"
  | "ativo"
  | "sem_compras";

/** Formato mínimo que `classificarCliente` precisa — não é o `Customer`
 *  inteiro de ./types.ts de propósito: mantém o módulo desacoplado (o
 *  `Customer` inteiro continua estruturalmente compatível, então passar
 *  um Customer normal funciona sem nenhum cast). */
export type ClienteSegmentavel = {
  totalSpent: number;
  visits: number;
  lastPurchase?: string | null;
  /** "Primeira visita" — usada como data de cadastro/primeira compra pra
   *  decidir "Novo" e pra estimar o intervalo habitual de compra. */
  firstVisit?: string | null;
  creditBalance?: number | null;
  /** Defensivo: mapApiCustomer (hooks/useCustomers.ts) não expõe hoje uma
   *  data de quitação do crediário. Quando o backend mandar esse campo,
   *  "Pronto pra comprar" passa a calcular sozinho — sem mudar mais nada
   *  aqui. Até lá o segmento fica definido (rótulo, cor) mas nunca sai. */
  creditPaidOffAt?: string | null;
};

export interface ClassificacaoSegmento {
  segmento: SegmentoId;
  /** Frase curta em português que explica a tag (accessibilityLabel). */
  motivo: string;
}

export interface ContextoDaBase {
  totalClientes: number;
  /** 0.1 (top 10%) em bases com 20+ clientes, 0.2 (top 20%) abaixo disso. */
  percentualVip: number;
  /** Gasto mínimo pra entrar no top — cliente precisa de totalSpent >=
   *  limiarVip E 2+ compras. `Infinity` quando a base está vazia (ninguém
   *  vira VIP). */
  limiarVip: number;
}

export interface InfoSegmento {
  rotulo: string;
  /** Cores no mesmo formato do Tag() de CustomerRow.tsx: fundo (b) e
   *  texto (f). Reaproveita os tokens que o app já usa nas tags atuais
   *  (Colors.violet/green/amber/red + o laranja de "Devendo", que nunca
   *  entrou em constants/colors.ts e continua um literal aqui, como já
   *  era em CustomerRow.tsx). */
  cor: { bVar: TokenCor; fVar: TokenCor };
}

/** Nome do token em constants/colors.ts (ou o literal laranja do
 *  crediário) — resolvido pra cor real por `corDoSegmento`, que é quem
 *  importa Colors. Indireção só pra este módulo continuar sem depender
 *  de React Native / tema. */
export type TokenCor =
  | "violetD" | "violet3" | "greenD" | "green" | "amberD" | "amber"
  | "redD" | "red" | "bg4" | "ink3" | "laranjaBg" | "laranjaFg";

/** Ordem de exibição — a mesma ordem de prioridade da tag única, com os
 *  dois fallbacks ("ativo", "sem_compras") no fim. Usada por
 *  `resumoDosSegmentos` pra devolver sempre os segmentos na mesma ordem. */
export const ORDEM_SEGMENTOS: SegmentoId[] = [
  "devendo", "pronto_pra_comprar", "perdido", "sumido", "em_risco",
  "vip", "recorrente", "novo", "comprou_uma_vez", "ativo", "sem_compras",
];

export const SEGMENTOS: Record<SegmentoId, InfoSegmento> = {
  devendo:             { rotulo: "Devendo",           cor: { bVar: "laranjaBg", fVar: "laranjaFg" } },
  pronto_pra_comprar:  { rotulo: "Pronto pra comprar", cor: { bVar: "greenD",   fVar: "green" } },
  perdido:             { rotulo: "Perdido",            cor: { bVar: "redD",     fVar: "red" } },
  // Rótulo visível trocou de "Inativo" pra "Sumido" (I1.2); a chave da
  // régua única continua "inativo" (diasSemComprar.ts) — ver LIMIARES.
  sumido:              { rotulo: "Sumido",             cor: { bVar: "redD",     fVar: "red" } },
  em_risco:            { rotulo: "Em risco",           cor: { bVar: "amberD",   fVar: "amber" } },
  vip:                 { rotulo: "VIP",                cor: { bVar: "violetD",  fVar: "violet3" } },
  recorrente:          { rotulo: "Recorrente",         cor: { bVar: "greenD",   fVar: "green" } },
  novo:                { rotulo: "Novo",               cor: { bVar: "amberD",   fVar: "amber" } },
  comprou_uma_vez:     { rotulo: "Comprou uma vez",    cor: { bVar: "bg4",      fVar: "ink3" } },
  ativo:               { rotulo: "Ativo",              cor: { bVar: "greenD",   fVar: "green" } },
  sem_compras:         { rotulo: "Sem compras",        cor: { bVar: "bg4",      fVar: "ink3" } },
};

export function rotuloDoSegmento(segmento: SegmentoId): string {
  return SEGMENTOS[segmento].rotulo;
}

// "Recentemente" pro crediário quitado — mesma ordem de grandeza do corte
// de "Novo" (30 dias), mas mais curto porque "acabei de quitar" perde
// força como gatilho de recompra depois de duas semanas.
const DIAS_QUITOU_RECENTE = 14;

/**
 * Contexto da base inteira — hoje só o limiar de gasto do VIP relativo.
 * `contextoDaBase` é O(n log n) (um sort); calcular uma vez por render da
 * lista e reaproveitar pra cada `classificarCliente` (não recalcular por
 * linha).
 */
export function contextoDaBase(clientes: Pick<ClienteSegmentavel, "totalSpent">[]): ContextoDaBase {
  const totalClientes = clientes.length;
  // Bases pequenas não têm 10% que forme um grupo com sentido — 3 clientes
  // e "top 10%" seria 0 ou 1 pessoa por acaso de arredondamento.
  const percentualVip = totalClientes > 0 && totalClientes < 20 ? 0.2 : 0.1;
  if (totalClientes === 0) return { totalClientes, percentualVip, limiarVip: Infinity };

  const ordenado = [...clientes].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  const posicao = Math.max(1, Math.ceil(totalClientes * percentualVip));
  const limiarVip = ordenado[posicao - 1].totalSpent || 0;
  return { totalClientes, percentualVip, limiarVip };
}

/**
 * Intervalo médio, em dias, entre as compras do próprio cliente — usado
 * só pelo "Em risco" relativo. Estimativa a partir do que a lista já tem
 * (sem histórico de compra por item): (última compra − primeira visita)
 * dividido pelo número de intervalos entre as N compras. `null` quando
 * não dá pra calcular (menos de 3 compras, datas ausentes/inválidas, ou
 * primeira visita não anterior à última compra).
 */
export function intervaloHabitualDias(c: ClienteSegmentavel, agora: number = Date.now()): number | null {
  if ((c.visits || 0) < 3) return null;
  const diasDesdeInicio = diasSemComprar(c.firstVisit, agora);
  const diasDesdeUltima = diasSemComprar(c.lastPurchase, agora);
  if (diasDesdeInicio == null || diasDesdeUltima == null) return null;
  const diasTotais = diasDesdeInicio - diasDesdeUltima; // tempo entre 1ª e última compra
  const intervalos = c.visits - 1;
  if (diasTotais <= 0 || intervalos <= 0) return null;
  return diasTotais / intervalos;
}

/** `true` quando o cliente passou de 1,5x o próprio intervalo habitual. */
function emRiscoPorIntervalo(c: ClienteSegmentavel, agora: number): { risco: boolean; intervalo: number | null } {
  const intervalo = intervaloHabitualDias(c, agora);
  if (intervalo == null || intervalo <= 0) return { risco: false, intervalo: null };
  const dias = diasSemComprar(c.lastPurchase, agora);
  if (dias == null) return { risco: false, intervalo };
  return { risco: dias > intervalo * 1.5, intervalo };
}

const CONTEXTO_VAZIO: ContextoDaBase = { totalClientes: 0, percentualVip: 0.1, limiarVip: Infinity };

/**
 * Classifica UM cliente num segmento só, na ordem de prioridade descrita
 * no topo do arquivo. `contexto` vem de `contextoDaBase(clientes)` — sem
 * ele (chamada avulsa, ex.: teste isolado) ninguém vira VIP, porque VIP é
 * relativo à base inteira e não dá pra calcular sem ela.
 */
export function classificarCliente(
  cliente: ClienteSegmentavel,
  contexto: ContextoDaBase = CONTEXTO_VAZIO,
  agora: number = Date.now(),
): ClassificacaoSegmento {
  const dias = diasSemComprar(cliente.lastPurchase, agora);
  const faixa: FaixaDias | null = classificarDias(dias);

  // 1. Devendo
  if ((cliente.creditBalance || 0) > 0) {
    return { segmento: "devendo", motivo: `deve ${formatoReais(cliente.creditBalance!)} em aberto` };
  }

  // 2. Pronto pra comprar (só calcula onde há dado — ver creditPaidOffAt)
  if (cliente.creditPaidOffAt) {
    const diasQuitou = diasSemComprar(cliente.creditPaidOffAt, agora);
    if (diasQuitou != null && diasQuitou <= DIAS_QUITOU_RECENTE) {
      return { segmento: "pronto_pra_comprar", motivo: `quitou o crediário há ${diasFrase(diasQuitou)}` };
    }
  }

  // 3. Perdido — 121+ dias
  if (faixa === "perdido") {
    return { segmento: "perdido", motivo: `não compra há ${diasFrase(dias!)}` };
  }

  // 4. Sumido — 61 a 120 dias (o "inativo" da régua única)
  if (faixa === "inativo") {
    return { segmento: "sumido", motivo: `sumiu há ${diasFrase(dias!)}` };
  }

  // 5. Em risco — 31 a 60 dias OU 1,5x o intervalo habitual do cliente
  const { risco: riscoPorIntervalo, intervalo } = emRiscoPorIntervalo(cliente, agora);
  if (faixa === "em_risco" || riscoPorIntervalo) {
    const motivo = riscoPorIntervalo && intervalo != null && faixa !== "em_risco"
      ? `costuma comprar a cada ${Math.round(intervalo)} dias, já são ${diasFrase(dias!)}`
      : `não compra há ${diasFrase(dias!)}`;
    return { segmento: "em_risco", motivo };
  }

  // 6. VIP — top X% da própria loja por gasto, piso de 2 compras
  if (
    contexto.limiarVip > 0 &&
    Number.isFinite(contexto.limiarVip) &&
    (cliente.visits || 0) >= 2 &&
    (cliente.totalSpent || 0) >= contexto.limiarVip
  ) {
    const pct = Math.round(contexto.percentualVip * 100);
    return { segmento: "vip", motivo: `top ${pct}% em gasto na loja` };
  }

  // 7. Recorrente — 3+ compras e ativo
  if ((cliente.visits || 0) >= 3 && faixa === "ativo") {
    return { segmento: "recorrente", motivo: `${cliente.visits} compras, ativo` };
  }

  // 8. Novo — primeira compra/cadastro nos últimos 30 dias e ≤2 compras
  const diasCadastro = diasSemComprar(cliente.firstVisit, agora);
  if (diasCadastro != null && diasCadastro <= 30 && (cliente.visits || 0) <= 2) {
    const motivo = (cliente.visits || 0) === 0
      ? `cadastrado há ${diasFrase(diasCadastro)}`
      : `primeira compra há ${diasFrase(diasCadastro)}`;
    return { segmento: "novo", motivo };
  }

  // 9. Comprou uma vez — exatamente 1 compra, fora de Novo
  if ((cliente.visits || 0) === 1) {
    const motivo = dias != null ? `comprou uma vez, há ${diasFrase(dias)}` : "comprou uma vez";
    return { segmento: "comprou_uma_vez", motivo };
  }

  // Fallback — ver comentário no topo do arquivo
  if (dias != null) {
    return { segmento: "ativo", motivo: `comprou há ${diasFrase(dias)}` };
  }
  return { segmento: "sem_compras", motivo: "cadastrado, ainda não comprou" };
}

export interface ResumoSegmento {
  segmento: SegmentoId;
  rotulo: string;
  quantidade: number;
  /** Soma do gasto histórico (totalSpent) dos clientes do segmento — "o
   *  R$ em jogo" nesse grupo. */
  emJogo: number;
}

/**
 * Um cliente conta uma vez só, no segmento que `classificarCliente`
 * escolheu pra ele — inclusive no multi-CNPJ: quem chama passa a lista
 * que a tela já carregou (single ou consolidada), sem duplicar.
 * Devolve todos os segmentos, na ordem de prioridade, mesmo com
 * quantidade zero — pra a faixa de segmentos (I1.2, depois do mockup)
 * não precisar recompor a lista de rótulos sozinha.
 */
export function resumoDosSegmentos(clientes: ClienteSegmentavel[], agora: number = Date.now()): ResumoSegmento[] {
  const contexto = contextoDaBase(clientes);
  const contagem = new Map<SegmentoId, { quantidade: number; emJogo: number }>();

  for (const c of clientes) {
    const { segmento } = classificarCliente(c, contexto, agora);
    const atual = contagem.get(segmento) || { quantidade: 0, emJogo: 0 };
    atual.quantidade += 1;
    atual.emJogo += Number(c.totalSpent) || 0;
    contagem.set(segmento, atual);
  }

  return ORDEM_SEGMENTOS.map((segmento) => {
    const dados = contagem.get(segmento) || { quantidade: 0, emJogo: 0 };
    return { segmento, rotulo: SEGMENTOS[segmento].rotulo, quantidade: dados.quantidade, emJogo: dados.emJogo };
  });
}

/**
 * Aniversariante do mês — segmento de FILTRO (não disputa a tag única,
 * item 10 do plano). `birthday` é "dd/mm" ou "dd/mm/aaaa", do jeito que
 * `Customer.birthday` guarda (ver hooks/useCustomers.ts mapApiCustomer).
 */
export function ehAniversarianteDoMes(birthday: string | null | undefined, agora: number = Date.now()): boolean {
  if (!birthday) return false;
  const partes = String(birthday).trim().split("/");
  if (partes.length < 2) return false;
  const mes = Number(partes[1]);
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return false;
  return mes === new Date(agora).getMonth() + 1;
}

function diasFrase(dias: number): string {
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function formatoReais(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
