// ============================================================
// components/studio/storefront/posCompra/posCompra.ts
//
// Fase 4 da vitrine Studio — "Pós-compra com a marca" (FASEAMENTO §4,
// JORNADA §2.3, §4.8–4.10). Mockup aprovado e especificação visual:
// docs/mockups/studio-vitrine-04-pos-compra.html.
//
// As regras das páginas de aprovar a arte e de acompanhar o pedido, sem
// React: que visual usar, que estado do pedido mostrar, o aviso de
// revisão paga, os textos com a voz da loja. Testadas em
// __tests__/vitrineStudioPosCompra.test.ts.
//
// A LÓGICA de negócio continua a mesma das páginas de antes
// (app/aprovacao/[token].tsx e app/acompanhar/[token].tsx): etapas e
// nunca horário, Pix do saldo a um toque, aprovar ou pedir ajuste. O que
// muda é a roupa — a da loja — e a próxima ação sempre à vista.
// ============================================================
import type { MarcaDaLoja, PublicApproval, PublicTrack } from "@/services/studioApi";
import { numeroWhatsApp } from "../AncoraWhatsApp";
import { dinheiro } from "../moeda";

// ── Cores das notas (kit da vitrine, studio-vitrine-00-kit.html) ──
// Semânticas: não mudam com a loja. Todas AA sobre o fundo claro delas e
// sobre o papel. Uma cor por intenção, com nome — nada cravado no meio
// de um componente.
export const NOTA = {
  info: { tinta: "#1D4E89", fundo: "#E6EEF8" },
  pix: { tinta: "#0E7A43", fundo: "#E3F4EA" },
  ambar: { tinta: "#8A4B0A", fundo: "#FDF0DA" },
  erro: { tinta: "#B42318", fundo: "#FDE8E6" },
} as const;

/**
 * O verde do botão do WhatsApp (kit: `.btn-wa`). Não é a cor da loja nem
 * a verde oficial do WhatsApp (#25D366 reprova contraste com texto
 * branco): é o tom do kit que passa AA com o branco por cima.
 */
export const TINTA_SOBRE_VERDE = "#FFFFFF";
export const VERDE_WHATSAPP = { fundo: "#1F7A4D", tinta: TINTA_SOBRE_VERDE } as const;

/** O véu atrás da folha de ajuste (kit: `.scene-dim`), quente como o papel. */
export const VEU_DA_FOLHA = "rgba(20,16,12,0.42)";

/** Mockup do motor 3D pode ser um vídeo turntable (.webm/.mp4). */
export function isVideoUrl(v?: string | null): boolean {
  if (!v) return false;
  const p = String(v).split("?")[0].toLowerCase();
  return p.endsWith(".webm") || p.endsWith(".mp4");
}

/**
 * Que visual a página usa.
 *
 * - No endereço da loja (`/<slug>/aprovacao/<token>`), sempre o da loja:
 *   é um endereço novo, só existe para isso — funciona com a chave
 *   ligada ou não.
 * - No endereço antigo (`/aprovacao/<token>`), o da loja só com a chave
 *   `vitrine_v2` ligada. É a chave que decide quando a loja real troca de
 *   cara; links já enviados continuam abrindo, agora vestidos de loja.
 * - Sem marca (empresa sem vitrine, backend de antes): o de sempre.
 */
export function usaVisualDaLoja(
  marca: MarcaDaLoja | null | undefined,
  { noEnderecoDaLoja }: { noEnderecoDaLoja: boolean },
): boolean {
  if (!marca || !marca.slug) return false;
  return noEnderecoDaLoja || marca.vitrine_v2 === true;
}

/**
 * O acompanhamento com a marca só vale para a encomenda do Studio. OS da
 * ótica e entrega do Matcon (`tipo`) têm etapas, DANFE e entrega parcial
 * próprios e seguem na página de sempre.
 */
export function acompanhamentoComMarca(
  dados: Pick<PublicTrack, "marca" | "tipo"> | null | undefined,
  opcoes: { noEnderecoDaLoja: boolean },
): boolean {
  if (!dados || dados.tipo) return false;
  return usaVisualDaLoja(dados.marca, opcoes);
}

/** O nome da loja para a página, com a queda que nunca fica vazia. */
export function nomeDaLoja(marca: MarcaDaLoja | null | undefined, reserva?: string | null): string {
  return String(marca?.nome || reserva || "").trim() || "a loja";
}

export const primeiroNome = (nome?: string | null) =>
  String(nome || "").trim().split(/\s+/)[0] || "";

/** "1ª", "2ª", "3ª" — revisões são femininas. */
const ordinal = (n: number) => `${n}ª`;


/**
 * A loja não limita as revisões? (Achado A3 do QA, decisão do Tech Lead:
 * vale o que o painel diz — "0 = revisões ilimitadas, sem cobrança".)
 *
 * O backend novo manda `ilimitadas: true` com `inclusas: null`; o de antes
 * mandava `inclusas: 0` (loja em 0) ou `null` (nada configurado). Os três
 * são ilimitadas. Sem o placar (backend de antes da Fase 4) não há o que
 * dizer: `false`, e as funções abaixo devolvem null.
 */
export function revisoesIlimitadas(revisoes: PublicApproval["revisoes"] | null | undefined): boolean {
  if (!revisoes) return false;
  if (revisoes.ilimitadas === true) return true;
  return !(Number(revisoes.inclusas) > 0);
}

/**
 * Quantas revisões inclusas ainda restam, para a nota da tela de aprovar.
 * `null` quando não há limite (ilimitadas) ou não há placar: nada a contar.
 */
export function revisoesRestantes(revisoes: PublicApproval["revisoes"] | null | undefined): number | null {
  if (!revisoes || revisoesIlimitadas(revisoes)) return null;
  return Math.max(0, Number(revisoes.inclusas) - (revisoes.usadas || 0));
}

export type AvisoDeAjuste = { tipo: "inclusa" | "paga"; texto: string };

/** O aviso da folha de ajuste quando a loja não limita as revisões. */
export const AJUSTE_ILIMITADO = "Ajuste incluso. Pode pedir quantos precisar.";

/**
 * O aviso da folha de "Pedir ajuste" (mockup, Tela 2): se ESTE ajuste é
 * incluso ou passa a ser cobrado. Hoje o modal não distinguia — a cliente
 * descobria a cobrança pelo WhatsApp. A loja confirma antes de cobrar;
 * a tela só avisa.
 */
export function avisoDoAjuste(revisoes: PublicApproval["revisoes"] | null | undefined): AvisoDeAjuste | null {
  if (!revisoes) return null;
  // Ilimitadas: nunca fala em cobrança. Frase curta, na voz da loja.
  if (revisoesIlimitadas(revisoes)) return { tipo: "inclusa", texto: AJUSTE_ILIMITADO };
  const inclusas = Number(revisoes.inclusas);
  const esta = (revisoes.usadas || 0) + 1;
  if (esta <= inclusas) {
    const depois = inclusas - esta;
    return {
      tipo: "inclusa",
      texto: depois > 0
        ? `Ajuste incluso — você ainda vai ter ${depois} ${depois === 1 ? "revisão grátis" : "revisões grátis"} depois deste.`
        : "Ajuste incluso — é a última revisão grátis deste pedido.",
    };
  }
  if (!(revisoes.valor_extra > 0)) {
    return { tipo: "paga", texto: `Esta seria a ${ordinal(esta)} revisão. A loja confirma com você antes de cobrar.` };
  }
  return {
    tipo: "paga",
    texto: `Esta seria a ${ordinal(esta)} revisão: ${dinheiro(revisoes.valor_extra)}. A loja confirma com você antes de cobrar.`,
  };
}

/**
 * O texto da nota de revisões da tela de aprovar ("Você ainda tem 2
 * revisões..."). Ilimitadas: sem nota — não há o que contar, e a folha de
 * ajuste já diz que o ajuste é incluso.
 */
export function textoDasRevisoes(revisoes: PublicApproval["revisoes"] | null | undefined): string | null {
  const r = revisoesRestantes(revisoes);
  if (r == null) return null;
  if (r === 0) return "As revisões inclusas deste pedido já foram usadas. Um novo ajuste pode ter custo — a loja confirma antes.";
  return `Você ainda tem ${r} ${r === 1 ? "revisão inclusa" : "revisões inclusas"} neste pedido.`;
}

/**
 * O que a página de aprovar mostra, pelo estado do link.
 *   aprovar   → pendente: mockup + Aprovar / Pedir ajuste
 *   aprovada  → já aprovada (agora ou antes): "Arte aprovada"
 *   ajuste    → ajuste pedido: "A loja recebeu seu pedido de ajuste"
 *   expirado  → o link venceu sem resposta
 */
export type TelaDaAprovacao = "aprovar" | "aprovada" | "ajuste" | "expirado";

export function telaDaAprovacao(
  status: PublicApproval["status"] | null | undefined,
  respondido?: "approve" | "request_changes" | null,
): TelaDaAprovacao {
  if (respondido === "approve") return "aprovada";
  if (respondido === "request_changes") return "ajuste";
  if (status === "approved") return "aprovada";
  if (status === "changes_requested") return "ajuste";
  if (status === "expired") return "expirado";
  return "aprovar";
}

/**
 * O título da aprovação. Um item: "A arte da sua caneca está pronta".
 * Vários, ou sem saber o que é: "A arte do seu pedido está pronta".
 */
export function tituloDaAprovacao(itens: { product_name?: string | null }[] | null | undefined): string {
  const lista = itens || [];
  if (lista.length === 1 && lista[0]?.product_name) {
    const nome = String(lista[0].product_name).trim();
    const tipo = nome.split(/\s+/)[0].toLowerCase();
    // "Caneca Alça Coração" → "da sua caneca". Só para nomes comuns de
    // peça; o resto usa o nome inteiro, que nunca soa errado.
    const PECAS: Record<string, string> = {
      caneca: "da sua caneca", camiseta: "da sua camiseta", copo: "do seu copo", garrafa: "da sua garrafa",
      almofada: "da sua almofada", azulejo: "do seu azulejo", squeeze: "do seu squeeze", ecobag: "da sua ecobag",
      chaveiro: "do seu chaveiro", body: "do seu body", avental: "do seu avental", boné: "do seu boné",
      quadro: "do seu quadro", caderno: "do seu caderno", agenda: "da sua agenda", mousepad: "do seu mousepad",
      taça: "da sua taça", caneco: "do seu caneco",
    };
    return `A arte ${PECAS[tipo] || "de " + nome} está pronta`;
  }
  return "A arte do seu pedido está pronta";
}

// ── Acompanhar ─────────────────────────────────────────────────

/**
 * A próxima ação do acompanhamento (mockup, Tela 4), uma por vez, na
 * ordem em que ela importa para a cliente:
 *   aprovar   → tem arte esperando por ela
 *   saldo     → falta pagar o saldo (Pix a um toque)
 *   entregue  → acabou; "Pedir outro igual"
 *   pronto    → pode buscar
 *   andamento → nada a fazer, só acompanhar
 */
export type AcaoDoAcompanhamento = "aprovar" | "saldo" | "entregue" | "pronto" | "andamento";

export function acaoDoAcompanhamento(
  dados: Pick<PublicTrack, "aprovacao" | "saldo" | "entregue" | "etapa_atual" | "etapas"> | null | undefined,
): AcaoDoAcompanhamento {
  if (!dados) return "andamento";
  if (dados.aprovacao?.token) return "aprovar";
  if (dados.saldo && dados.saldo.valor > 0) return "saldo";
  if (dados.entregue) return "entregue";
  const total = dados.etapas?.length || 0;
  if (total > 0 && (dados.etapa_atual ?? 0) >= total - 1) return "pronto";
  return "andamento";
}

/**
 * O rótulo de cada etapa. A última é "Pronto" no servidor (uma tabela
 * para a confirmação e o acompanhamento); aqui ela diz o que a cliente
 * faz: "Pronto para retirar" quando é retirada, e "Retirado"/"Entregue"
 * depois.
 */
export function rotuloDaEtapa(
  rotulo: string,
  i: number,
  total: number,
  { retirada, entregue }: { retirada: boolean; entregue: boolean },
): string {
  if (i !== total - 1) return rotulo;
  if (entregue) return retirada ? "Retirado" : "Entregue";
  if (retirada && /^pronto$/i.test(String(rotulo).trim())) return "Pronto para retirar";
  return rotulo;
}

/** O subtítulo do topo do acompanhamento. */
export function subtituloDoAcompanhamento(acao: AcaoDoAcompanhamento): string {
  if (acao === "entregue") return "Seu pedido foi entregue.";
  if (acao === "pronto") return "Sua encomenda está pronta.";
  return "Acompanhe sua encomenda por aqui.";
}

/**
 * O link do WhatsApp da loja com a primeira frase escrita — com o número
 * do pedido, que é o que a lojista vai perguntar primeiro. `null` sem
 * número: sem botão, nunca um botão que não leva a lugar nenhum.
 */
export function linkDoWhatsAppDoPedido(
  numero: string | null | undefined,
  pedido?: string | null,
): string | null {
  const num = numeroWhatsApp(numero);
  if (!num) return null;
  const texto = pedido
    ? `Olá! Queria falar sobre o meu pedido #${String(pedido).replace(/^#/, "")}.`
    : "Olá! Queria falar sobre o meu pedido.";
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

/** "Pedido #00123" para o rodapé e o resumo (o número já vem sem #). */
export const rotuloDoPedido = (pedido?: string | null) => (pedido ? `Pedido #${String(pedido).replace(/^#/, "")}` : "Seu pedido");

/** 'YYYY-MM-DD' → '22 de agosto'. Sem new Date(): data pura viraria UTC. */
export function dataPorExtenso(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${d} de ${meses[m - 1]}`;
}
