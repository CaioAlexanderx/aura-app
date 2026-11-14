// ============================================================================
// AURA. — Página Black Friday · "Black Friday na loja online" (p-120)
//
// Textos e regras puras da seção (testáveis sem tela). Mockup aprovado pelo
// Caio (14/11/2026): https://claude.ai/artifact/2vZuoRKQpbpYfjxShbqTtL
// O estado vem pronto do servidor (p-118): quantas promoções, "até N%", as
// datas. Aqui só se escolhe a frase.
// ============================================================================
import { ApiError } from "@/services/api";
import type { EstadoDaCampanha } from "@/services/campanhaLojaApi";

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
  var base = partes.length ? partes.join("; ") + "." : "Nenhum produto em promoção ainda.";
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
  return e.pode_ligar
    ? "A faixa e o botão Ver ofertas aparecem enquanto houver promoção no ar."
    : "Disponível depois de montar pelo menos um desconto.";
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
