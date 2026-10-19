// ============================================================
// AURA. — Regras do check-in de entrada (14/10/2026, cartão t1-12 parte 2)
//
// Funções puras: quando a tela aparece, quais opções cada plano vê, o corpo
// do PUT parcial e o "Vamos abrir com" (a resposta imediata da tela, tirada
// do mockup aprovado). Sem React, sem rede.
//
// Regra de ouro: o check-in NUNCA bloqueia a entrada no app. Qualquer dúvida
// (rota ausente, erro de rede, resposta fora do formato) = não mostrar.
// ============================================================
import {
  MAX_RESPOSTA, PERGUNTAS_CHECKIN,
  type ChaveResposta, type OpcaoCheckin, type PerguntaCheckin,
} from "@/constants/checkin";
import type { CheckinEstado, CheckinPutBody, CheckinRespostas } from "@/services/checkinApi";
import { PLANOS_COM_STUDIO, SEGMENTOS } from "@/constants/primeirosPassos";
import type { Segmento } from "@/services/primeirosPassosApi";
import { TEXTO_CONVITE_PLANILHA, caminhoDoEstoque } from "@/utils/checkinDestino";

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_RESPOSTA ? v : null;
}

/**
 * Lê a resposta do GET com defesa. Fora do formato (ou sem `habilitado`)
 * vira null, e null significa "não mostrar".
 */
export function lerCheckin(raw: unknown): CheckinEstado | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.habilitado !== "boolean") return null;
  const bruto = r.respostas && typeof r.respostas === "object" ? (r.respostas as Record<string, unknown>) : {};
  const respostas: CheckinRespostas = {};
  for (const p of PERGUNTAS_CHECKIN) {
    const v = texto(bruto[p.chave]);
    if (v) respostas[p.chave] = v;
  }
  return {
    habilitado: r.habilitado,
    respondido: r.respondido === true,
    pulou: r.pulou === true,
    versao: typeof r.versao === "number" ? r.versao : null,
    respostas,
  };
}

export type ContextoDoCheckin = {
  temEmpresa: boolean;
  isStaff: boolean;
  isDemo: boolean;
  /** Visão consolidada (multi-CNPJ): a pergunta é de UMA loja, não da soma. */
  consolidado: boolean;
  /** Papel na empresa: só dono/admin é perguntado ("monta a loja"). */
  papel: string | null | undefined;
  /** A chave de módulo da tela está visível (plano, override e permissão). */
  moduloVisivel: boolean;
};

/** A tela aparece? Só com `habilitado` e sem ter respondido nem pulado. */
export function deveMostrarCheckin(
  estado: CheckinEstado | null | undefined,
  ctx: ContextoDoCheckin,
): boolean {
  if (!estado || !estado.habilitado) return false;
  if (estado.respondido || estado.pulou) return false;
  if (!ctx.temEmpresa || ctx.isStaff || ctx.isDemo || ctx.consolidado || !ctx.moduloVisivel) return false;
  const papel = String(ctx.papel || "owner").toLowerCase();
  return papel === "owner" || papel === "admin";
}

/**
 * Opções que o plano/permissão da loja enxerga. O que não está visível some
 * (premissa de 16/09): nada de opção desabilitada nem "faça upgrade".
 */
export function opcoesVisiveis(pergunta: PerguntaCheckin, modulosVisiveis: ReadonlySet<string>): OpcaoCheckin[] {
  return pergunta.opcoes.filter((o) => !o.mod || modulosVisiveis.has(o.mod));
}

/** Corpo do PUT parcial para uma resposta; null se o valor não é uma opção. */
export function corpoDaResposta(chave: ChaveResposta, valor: string): CheckinPutBody | null {
  const pergunta = PERGUNTAS_CHECKIN.find((p) => p.chave === chave);
  if (!pergunta || valor.length > MAX_RESPOSTA) return null;
  if (!pergunta.opcoes.some((o) => o.valor === valor)) return null;
  return { [chave]: valor } as CheckinPutBody;
}

/** Corpo do PUT de quem pula: só `pulou`, nenhuma resposta. */
export function corpoDoPular(): CheckinPutBody {
  return { pulou: true };
}

/** Corpo com tudo o que está marcado (reenvio no "Continuar" se um PUT falhou). */
export function corpoCompleto(respostas: CheckinRespostas): CheckinPutBody {
  const corpo: Record<string, string> = {};
  for (const p of PERGUNTAS_CHECKIN) {
    const v = respostas[p.chave];
    if (v && corpoDaResposta(p.chave, v)) corpo[p.chave] = v;
  }
  return corpo as CheckinPutBody;
}

// ── Pergunta da frente (tq-33) ──────────────────────────────

/**
 * A conta não tem frente gravada? Só então o check-in pergunta "O que a sua
 * loja vende?". Empresa com vertical ativa (Studio antigo sem segment,
 * odonto, food…) já tem a frente dita pela vertical: não pergunta.
 */
export function precisaPerguntarFrente(company: unknown): boolean {
  if (!company || typeof company !== "object") return false;
  const c = company as Record<string, unknown>;
  const segment = typeof c.segment === "string" ? c.segment.trim() : "";
  const vertical = typeof c.vertical_active === "string" ? c.vertical_active.trim() : "";
  return !segment && !vertical;
}

/** As frentes do cartão "Sua frente": Personalizados só nos planos com Studio. */
export function opcoesDeFrente(plano: string | null | undefined): Segmento[] {
  const comStudio = PLANOS_COM_STUDIO.includes(String(plano || ""));
  return SEGMENTOS.filter((s) => s !== "studio" || comStudio);
}

export function quantasRespostas(respostas: CheckinRespostas): number {
  return PERGUNTAS_CHECKIN.filter((p) => !!respostas[p.chave]).length;
}

// ── "Vamos abrir com" (mockup aprovado) ─────────────────────

/** `sub` vazio = sem subtítulo. */
export type AbrirCom = { titulo: string; sub: string };

// 19/10/2026 (tq-31): textos decididos pela Nina, alinhados ao destino do
// Continuar (utils/checkinDestino.ts). A Aura não cria produto de teste:
// "Com um produto de teste" saiu. Nenhum texto cita o teto do teste.
const TESTE_NA_VENDA = "Sua primeira venda também começa o seu teste.";
const NOME_E_PRECO = "Nome e preço bastam.";

export const TEXTOS_ABRIR_COM = {
  caixaSemProduto: "Cadastrar um produto e fazer a primeira venda",
  caixaComProduto: "Fazer a primeira venda no Caixa",
  fiado: { titulo: "Cadastrar um cliente e lançar o primeiro fiado", sub: "Leva uns 2 minutos." },
  notaFiscal: { titulo: "Configurar a nota fiscal", sub: "Você cadastra o certificado ou a Aura ajuda pelo WhatsApp." },
  lojaOnline: { titulo: "Montar sua loja online", sub: "Os produtos que você cadastrar já aparecem nela." },
  sumidos: { titulo: "Trazer sua lista de clientes", sub: "Depois você vê quem não volta há 60 dias e chama com um toque." },
  painel: { titulo: "Ver o seu Painel", sub: "De lá você faz a primeira venda quando quiser." },
  planilha: { titulo: TEXTO_CONVITE_PLANILHA.titulo, sub: TEXTO_CONVITE_PLANILHA.sub },
  assistida: {
    titulo: "Trazer seus produtos com a nossa ajuda",
    sub: "Você manda a planilha ou o arquivo do outro sistema pelo WhatsApp. Costuma levar de uma hora a um dia.",
  },
  // Até 50 produtos (ou só "Organizar meu estoque"). O caminho "medio" usa
  // TEXTO_ESTOQUE_MEDIO_TQ34 desde o tq-34.
  primeirosProdutos: { titulo: "Cadastrar seus primeiros produtos", sub: "Nome e preço bastam. Os outros você traz depois." },
} as const;

/**
 * Caminho "medio" (Caderno, Ainda não anoto, 51 a 300): o Continuar abre a
 * tela "Como você quer trazer seus produtos?" (tq-34).
 */
export const TEXTO_ESTOQUE_MEDIO_TQ34 = {
  titulo: "Trazer seus produtos do seu jeito",
  sub: "Um por um, por planilha ou com a nossa ajuda.",
} as const;

/**
 * O que a loja vê em destaque depois das respostas. null = nada respondido
 * ("Responda acima, ou pule").
 *
 * @param opts.testeComecaNaVenda true só para conta no modo `primeira_venda`
 *   (company.trial.mode): a frase "sua primeira venda também começa o seu
 *   teste" não vale para conta de código de acesso ou convite (modo fixo).
 * @param opts.temProduto a loja já tem produto (destino do "Vender no
 *   caixa"); null/undefined = não sei, e o texto segue o destino sem produto.
 */
export function abrirCom(
  respostas: CheckinRespostas,
  opts: { testeComecaNaVenda?: boolean; temProduto?: boolean | null } = {},
): AbrirCom | null {
  const a = respostas.comeco || "";
  const c = respostas.onde_anota || "";
  const n = respostas.produtos_faixa || "";
  if (!a && !c && !n) return null;

  switch (a) {
    case "caixa":
      if (opts.temProduto === true) {
        return { titulo: TEXTOS_ABRIR_COM.caixaComProduto, sub: opts.testeComecaNaVenda ? TESTE_NA_VENDA : "" };
      }
      return {
        titulo: TEXTOS_ABRIR_COM.caixaSemProduto,
        sub: opts.testeComecaNaVenda ? NOME_E_PRECO + " " + TESTE_NA_VENDA : NOME_E_PRECO,
      };
    case "fiado":
      return { ...TEXTOS_ABRIR_COM.fiado };
    case "nota_fiscal":
      return { ...TEXTOS_ABRIR_COM.notaFiscal };
    case "loja_online":
      return { ...TEXTOS_ABRIR_COM.lojaOnline };
    case "sumidos":
      return { ...TEXTOS_ABRIR_COM.sumidos };
    case "outra":
      return { ...TEXTOS_ABRIR_COM.painel };
    case "estoque":
    case "":
      break;
    default:
      // Valor desconhecido: o Continuar leva ao Painel.
      return { ...TEXTOS_ABRIR_COM.painel };
  }

  // "Organizar meu estoque" ou só respondeu as outras duas perguntas: a
  // mesma regra do destino.
  switch (caminhoDoEstoque(respostas)) {
    case "assistida":
      return { ...TEXTOS_ABRIR_COM.assistida };
    case "planilha":
      return { ...TEXTOS_ABRIR_COM.planilha };
    case "medio":
      return { ...TEXTO_ESTOQUE_MEDIO_TQ34 };
    default:
      return { ...TEXTOS_ABRIR_COM.primeirosProdutos };
  }
}
