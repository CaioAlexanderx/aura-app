// ============================================================
// AURA. — Página Black Friday: quais seções aparecem (13/10/2026)
//
// Regra da casa (Essencial sem features bloqueadas): o que a loja não tem
// SOME — nada de cartão desabilitado, cadeado ou convite a assinar. Cada
// seção tem o seu gate, todos aqui, numa função pura:
//
//   de_por      "Promoção em lote"        módulo `estoque`, e só quando o
//                                         backend tem a rota de promoções
//                                         (`dePorDisponivel`: 404, 403 do
//                                         perfil consulta ou falha = some).
//                                         Primeira porque é a mais urgente
//                                         em novembro (p-86, 08/11/2026).
//   ruptura     "O que vai faltar"        módulo `estoque`
//   assento     "Assento de temporada"    módulo `configuracoes`, por
//                                         empresa (não existe no
//                                         consolidado) e só na janela do
//                                         próprio assento
//   vale_troca  "Vale-troca no cupom"     módulo `configuracoes`, por
//                                         empresa, só até o último dia de
//                                         troca (31/01/2027)
//   placar      "Placar do dia"           módulo `whatsapp` (Negócio+: o
//                                         placar sai pelo WhatsApp da
//                                         loja), por empresa
//
// A ORDEM do array é a ordem na tela.
// ============================================================
import { assentoTemporadaVisivel, hojeBrt } from "@/components/screens/configuracoes/assentoTemporada";
import { VALE_TROCA_PRAZO_ATE } from "@/utils/valeTroca";

export type ChaveDaSecao = "de_por" | "ruptura" | "assento" | "vale_troca" | "placar";

export type SecaoDaPagina = {
  chave: ChaveDaSecao;
  titulo: string;
  /** A linha de "por que agora" que abre o cartão. */
  porQueAgora: string;
};

export const TEXTOS_DAS_SECOES: Record<ChaveDaSecao, SecaoDaPagina> = {
  de_por: {
    chave: "de_por",
    titulo: "Promoção em lote",
    porQueAgora:
      "Na Black Friday o cliente procura o preço riscado: coloque vários produtos em promoção de uma vez, com começo e fim. No fim do prazo, os preços voltam sozinhos.",
  },
  ruptura: {
    chave: "ruptura",
    titulo: "O que vai faltar",
    porQueAgora:
      "Compra de fim de ano se faz em outubro: veja o que acaba antes da data escolhida no ritmo atual de venda e quanto comprar de cada item.",
  },
  assento: {
    chave: "assento",
    titulo: "Assento de temporada",
    porQueAgora:
      "A loja vende mais e precisa de mais gente no balcão: um acesso extra só para a equipe de fim de ano, que expira sozinho.",
  },
  vale_troca: {
    chave: "vale_troca",
    titulo: "Vale-troca no cupom",
    porQueAgora:
      "Janeiro é o mês da troca de presente e quem ganhou raramente vem com o comprador: o cupom sai com um QR e a troca abre com a venda carregada.",
  },
  placar: {
    chave: "placar",
    titulo: "Placar do dia",
    porQueAgora:
      "No movimento da temporada o dono quer saber quanto a loja vendeu sem abrir relatório: ao fim do dia o placar chega no WhatsApp.",
  },
};

export type EntradaDasSecoes = {
  /** Módulos visíveis para a loja/membro (useVisibleModules). */
  visible: Set<string>;
  /** "Todas as empresas": assento e vale-troca são por empresa. */
  consolidatedView: boolean;
  /** "AAAA-MM-DD" de hoje em Brasília; injetável para teste. */
  hoje?: string;
  /** O backend tem as promoções e a pessoa pode criar (não é perfil consulta). */
  dePorDisponivel?: boolean;
};

export function secoesDaPagina(e: EntradaDasSecoes): SecaoDaPagina[] {
  const out: SecaoDaPagina[] = [];
  if (e.dePorDisponivel && e.visible.has("estoque")) out.push(TEXTOS_DAS_SECOES.de_por);
  if (e.visible.has("estoque")) out.push(TEXTOS_DAS_SECOES.ruptura);

  if (!e.consolidatedView && e.visible.has("configuracoes")) {
    const hoje = e.hoje || hojeBrt();
    if (assentoTemporadaVisivel(hoje)) out.push(TEXTOS_DAS_SECOES.assento);
    if (hoje <= VALE_TROCA_PRAZO_ATE) out.push(TEXTOS_DAS_SECOES.vale_troca);
  }
  // O placar sai pelo WhatsApp: plano sem o módulo (Essencial) não vê a seção.
  if (!e.consolidatedView && e.visible.has("whatsapp")) out.push(TEXTOS_DAS_SECOES.placar);
  return out;
}
