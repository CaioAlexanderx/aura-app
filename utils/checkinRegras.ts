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

export function quantasRespostas(respostas: CheckinRespostas): number {
  return PERGUNTAS_CHECKIN.filter((p) => !!respostas[p.chave]).length;
}

// ── "Vamos abrir com" (mockup aprovado) ─────────────────────

export type AbrirCom = { titulo: string; sub: string };

function rotuloDe(chave: ChaveResposta, valor: string | null | undefined): string {
  const p = PERGUNTAS_CHECKIN.find((x) => x.chave === chave);
  return p?.opcoes.find((o) => o.valor === valor)?.rotulo || "";
}

/**
 * O que a loja vê em destaque depois das respostas. null = nada respondido
 * ("Responda acima, ou pule").
 *
 * @param opts.testeComecaNaVenda true só para conta no modo `primeira_venda`
 *   (company.trial.mode): a frase "sua primeira venda também começa o seu
 *   teste" não vale para conta de código de acesso ou convite (modo fixo).
 */
export function abrirCom(
  respostas: CheckinRespostas,
  opts: { testeComecaNaVenda?: boolean } = {},
): AbrirCom | null {
  const a = respostas.comeco || "";
  const c = respostas.onde_anota || "";
  const n = respostas.produtos_faixa || "";
  if (!a && !c && !n) return null;

  switch (a) {
    case "caixa":
      return {
        titulo: "Fazer a primeira venda no Caixa",
        sub: opts.testeComecaNaVenda
          ? "Com um produto de teste. Sua primeira venda também começa o seu teste."
          : "Com um produto de teste.",
      };
    case "fiado":
      return { titulo: "Cadastrar um cliente e lançar o primeiro fiado", sub: "Leva uns 2 minutos." };
    case "nota_fiscal":
      return { titulo: "Configurar a nota fiscal", sub: "A Aura te leva passo a passo." };
    case "loja_online":
      return { titulo: "Montar sua loja online", sub: "Os produtos que você cadastrar já aparecem nela." };
    case "sumidos":
      return {
        titulo: "Trazer sua lista de clientes",
        sub: "Depois você vê quem não volta há 60 dias e chama com um toque.",
      };
    case "outra":
      return { titulo: "Cadastrar seus 5 primeiros produtos", sub: "Os outros você cadastra depois." };
    default:
      break;
  }

  // "Organizar meu estoque" ou só respondeu as outras duas perguntas.
  if (c === "planilha" || c === "outro_sistema") {
    const grande = n === "de_301_a_1000" || n === "mais_de_1000";
    return {
      titulo: "Importar sua planilha",
      sub: grande
        ? `Com ${rotuloDe("produtos_faixa", n).toLowerCase()} produtos, a planilha é o caminho mais rápido.`
        : "Você confere tudo antes de gravar.",
    };
  }
  if (c === "caderno" || c === "nao_anoto") {
    return {
      titulo: "Cadastrar seus 5 primeiros produtos",
      sub: "Enter passa para o próximo. Os outros você cadastra depois.",
    };
  }
  return { titulo: "Cadastrar seus produtos", sub: "Um por um ou por planilha." };
}
