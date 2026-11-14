// ============================================================================
// AURA. — Página Black Friday · "Black Friday na loja online" (p-120)
//
// Textos e regras puras da seção (testáveis sem tela). Mockup aprovado pelo
// Caio (14/11/2026): https://claude.ai/artifact/2vZuoRKQpbpYfjxShbqTtL
// O estado vem pronto do servidor (p-118): quantas promoções, "até N%", as
// datas. Aqui só se escolhe a frase.
// ============================================================================
import { ApiError } from "@/services/api";
import type { EstadoDaCampanha, MotivoForaDaLoja } from "@/services/campanhaLojaApi";

/** Onde se escolhe o que aparece na loja online: Canal Digital › Vitrine. */
export const ROTA_VITRINE_DA_LOJA = "/canal?tab=vitrine";

/** O selo da peça que a loja online não mostra (assistente da loja online). */
export function rotuloForaDaLoja(motivo: MotivoForaDaLoja | undefined): string {
  if (motivo === "sem_foto") return "não aparece na loja online · sem foto";
  if (motivo === "sem_estoque") return "não aparece na loja online · sem estoque";
  return "não aparece na loja online · fora da vitrine";
}

/** Quantos dos escolhidos a loja não mostra, em frase; null se nenhum. */
export function avisoDosEscolhidosForaDaLoja(ids: string[], fora: Record<string, MotivoForaDaLoja> | undefined): string | null {
  if (!fora) return null;
  var n = ids.filter(function (id) { return !!fora[id]; }).length;
  if (n <= 0) return null;
  var todos = n === ids.length;
  var quem = todos
    ? (n === 1 ? "O produto escolhido não aparece" : "Nenhum dos " + n + " produtos escolhidos aparece")
    : (n === 1 ? "1 dos produtos escolhidos não aparece" : n + " dos produtos escolhidos não aparecem");
  return quem + " na loja online (fora da vitrine, sem foto ou sem estoque). O desconto vale no Caixa, mas a cliente da loja não vê.";
}

/**
 * Promoção só em peça que a loja online não mostra (QA 14/11: a Promoção em
 * lote dizia "3 itens no ar" e esta seção, "nenhum produto"). null quando
 * não há o que avisar.
 */
export function avisoForaDaLoja(e: EstadoDaCampanha): { texto: string; nenhumaNaLoja: boolean } | null {
  var n = Number(e.promocoes.fora_da_loja) || 0;
  if (n <= 0) return null;
  var motivo = n === 1 ? " (está fora da vitrine ou sem foto)." : " (estão fora da vitrine ou sem foto).";
  var naLoja = e.promocoes.no_ar + e.promocoes.agendadas;
  if (naLoja <= 0) {
    return {
      nenhumaNaLoja: true,
      texto: "Você tem " + (n === 1 ? "1 produto em promoção, mas ele não aparece" : n + " produtos em promoção, mas nenhum aparece")
        + " na loja online" + motivo,
    };
  }
  return {
    nenhumaNaLoja: false,
    texto: (n === 1 ? "Mais 1 produto em promoção não aparece" : "Mais " + n + " produtos em promoção não aparecem")
      + " na loja online" + motivo,
  };
}

/** "AAAA-MM-DD" -> "DD/MM"; outro formato, "". */
export function diaMes(iso: string | null | undefined): string {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? m[3] + "/" + m[2] : "";
}

function plural(n: number, um: string, varios: string): string {
  return n + " " + (n === 1 ? um : varios);
}

export type Selo = { texto: string; tom: "no_ar" | "agendada" | "neutro" };

/** O selo ao lado do título da seção. */
export function seloDaCampanha(e: EstadoDaCampanha): Selo {
  if (e.no_ar) return { texto: "No ar", tom: "no_ar" };
  if (e.agendada) {
    var d = diaMes(e.promocoes.comeca_em);
    return { texto: "Agendada" + (d ? " · a faixa aparece em " + d : ""), tom: "agendada" };
  }
  if (e.ativa) return { texto: "Ligada · sem promoção no ar", tom: "neutro" };
  return { texto: "Campanha desligada", tom: "neutro" };
}

/** A linha do passo "Descontos". */
export function textoDosDescontos(e: EstadoDaCampanha): string {
  var p = e.promocoes;
  var partes: string[] = [];
  if (p.no_ar > 0) {
    var ate = diaMes(p.ate_data);
    partes.push(plural(p.no_ar, "produto em promoção", "produtos em promoção")
      + (p.ate_pct > 0 ? " · até " + p.ate_pct + "%" : "")
      + (ate ? " · no ar até " + ate : ""));
  }
  if (p.agendadas > 0) {
    var comeca = diaMes(p.comeca_em);
    partes.push(plural(p.agendadas, "produto com promoção agendada", "produtos com promoção agendada")
      + (comeca ? " · começa em " + comeca : ""));
  }
  // p-123a: promoção só em peça que a loja não mostra não é "nenhum ainda".
  var vazio = (Number(p.fora_da_loja) || 0) > 0 ? "Nenhum produto em promoção na loja online." : "Nenhum produto em promoção ainda.";
  var base = partes.length ? partes.join("; ") + "." : vazio;
  return base + " O preço promocional vale no Caixa e na loja online.";
}

/** A linha do passo "Faixa preta na loja". */
export function textoDaFaixa(e: EstadoDaCampanha): string {
  if (e.promocoes.ate_pct > 0) {
    return "Escolha o título da faixa. O “Até " + e.promocoes.ate_pct + "% OFF” é calculado pelos seus descontos e não se edita.";
  }
  return "Escolha o título da faixa. O desconto que ela anuncia é calculado pelos descontos no ar e não se edita.";
}

/** A linha embaixo da chave. */
export function textoDaChave(e: EstadoDaCampanha): string {
  if (e.pode_ligar) return "A faixa e o botão Ver ofertas aparecem enquanto houver promoção no ar.";
  if ((Number(e.promocoes.fora_da_loja) || 0) > 0) {
    return "Para ligar, pelo menos um produto em promoção precisa aparecer na loja online.";
  }
  return "Disponível depois de montar pelo menos um desconto.";
}

/** O aviso da campanha ligada e agendada, ou null. */
export function avisoDeAgendada(e: EstadoDaCampanha): string | null {
  if (!e.agendada) return null;
  var d = diaMes(e.promocoes.comeca_em);
  return "A campanha está ligada e agendada: a loja continua como hoje" + (d ? " até " + d : "")
    + ", e a faixa aparece sozinha quando a primeira promoção começar.";
}

/** Mensagem para o erro de gravar a campanha. */
export function mensagemErroCampanha(err: any): string {
  var codigo = err && err.data && err.data.code;
  if (codigo === "BF_SEM_PROMOCAO") {
    return (err.data && err.data.error) || "Para ligar a campanha, monte antes pelo menos um desconto.";
  }
  if (codigo === "SEM_LOJA_ONLINE") return "Configure a loja online antes de ligar a campanha.";
  if (codigo === "MIGRATION_PENDING" || (err instanceof ApiError && err.status === 503)) {
    return "Esta função ainda está sendo ligada na sua conta. Tente de novo daqui a pouco.";
  }
  if (err instanceof ApiError && err.status === 403) return "Só quem cuida da loja online pode ligar a campanha.";
  if (err && err.isNetworkError) return "Sem conexão agora. Confira a internet e tente de novo.";
  return "Não conseguimos salvar agora. Tente de novo em instantes.";
}
