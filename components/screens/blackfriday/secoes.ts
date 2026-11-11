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
//                                         No CONSOLIDADO a promoção é por
//                                         empresa: a seção vira a variante
//                                         "escolher_empresa" (cartão curto
//                                         com o botão de trocar a empresa
//                                         ativa), sem chamar as promoções.
//                                         Perfil consulta não vê nenhuma.
//   crediario_janeiro                     módulo `crediario` (Negócio+), e
//               "Crediário para janeiro"  só quando o backend respondeu o
//                                         resumo (`crediarioDisponivel`:
//                                         404, 403 do crediário desligado
//                                         ou do plano, falha = some).
//                                         Novembro e dezembro: atalho +
//                                         resumo; janeiro: só o resumo;
//                                         resto do ano: some (p-91,
//                                         09/11/2026). Segunda: vender agora
//                                         e receber em janeiro vem junto de
//                                         baixar o preço.
//   ruptura     "O que vai faltar"        módulo `estoque`
//   assento     "Assento de temporada"    módulo `configuracoes`, por
//                                         empresa (não existe no
//                                         consolidado) e só na janela do
//                                         próprio assento
//   vale_troca  "Vale-troca no cupom"     módulo `configuracoes`, por
//                                         empresa, só até o último dia de
//                                         troca (31/01/2027)
//
// A ORDEM do array é a ordem na tela.
// ============================================================
import { assentoTemporadaVisivel, hojeBrt } from "@/components/screens/configuracoes/assentoTemporada";
import { VALE_TROCA_PRAZO_ATE } from "@/utils/valeTroca";
import { faseCrediarioJaneiro } from "./crediarioJaneiro/regrasCrediarioJaneiro";

export type ChaveDaSecao = "de_por" | "crediario_janeiro" | "ruptura" | "assento" | "vale_troca";

export type SecaoDaPagina = {
  chave: ChaveDaSecao;
  titulo: string;
  /** A linha de "por que agora" que abre o cartão. */
  porQueAgora: string;
  /** "escolher_empresa": a função é por empresa e a página está no
   *  consolidado; o cartão pede para escolher a empresa. */
  variante?: "escolher_empresa";
};

/** O "por que agora" do crediário em janeiro, quando só o resumo aparece. */
export const POR_QUE_CREDIARIO_EM_JANEIRO =
  "Janeiro é o mês de receber o que foi combinado em dezembro: veja quanto vence e de quantos carnês.";

export const TEXTOS_DAS_SECOES: Record<ChaveDaSecao, SecaoDaPagina> = {
  de_por: {
    chave: "de_por",
    titulo: "Promoção em lote",
    porQueAgora:
      "Na Black Friday o cliente procura o preço riscado: coloque vários produtos em promoção de uma vez, com começo e fim. No fim do prazo, os preços voltam sozinhos.",
  },
  crediario_janeiro: {
    chave: "crediario_janeiro",
    titulo: "Crediário para janeiro",
    porQueAgora:
      "Em novembro e dezembro o cliente quer levar o presente agora e pagar só depois do Natal: lance o carnê já com a primeira parcela em janeiro.",
  },
  ruptura: {
    chave: "ruptura",
    titulo: "O que vai faltar",
    porQueAgora:
      "Compra de fim de ano se faz em outubro: veja o que acaba antes da data escolhida no ritmo atual de venda e quanto comprar de cada item.",
  },
  assento: {
    chave: "assento",
    titulo: "Acesso de funcionário para a temporada",
    porQueAgora:
      "A loja vende mais e precisa de mais gente no balcão: um acesso de funcionário adicional só para a equipe de fim de ano, que expira sozinho.",
  },
  vale_troca: {
    chave: "vale_troca",
    titulo: "Vale-troca no cupom",
    porQueAgora:
      "Janeiro é o mês da troca de presente e quem ganhou raramente vem com o comprador: o cupom sai com um QR e a troca abre com a venda carregada.",
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
  /** Perfil Estoque só consulta (ou a permissão ainda carregando): sem promoção. */
  estoqueSoConsulta?: boolean;
  /** O backend respondeu o resumo do crediário (useResumoVencimento). */
  crediarioDisponivel?: boolean;
};

export function secoesDaPagina(e: EntradaDasSecoes): SecaoDaPagina[] {
  const out: SecaoDaPagina[] = [];
  const hoje = e.hoje || hojeBrt();

  if (e.visible.has("estoque")) {
    if (e.consolidatedView) {
      // Promoção é por empresa: no consolidado, o cartão pede a empresa.
      if (!e.estoqueSoConsulta) out.push({ ...TEXTOS_DAS_SECOES.de_por, variante: "escolher_empresa" });
    } else if (e.dePorDisponivel) {
      out.push(TEXTOS_DAS_SECOES.de_por);
    }
  }

  if (e.crediarioDisponivel && e.visible.has("crediario")) {
    const fase = faseCrediarioJaneiro(hoje);
    if (fase === "atalho") out.push(TEXTOS_DAS_SECOES.crediario_janeiro);
    if (fase === "janeiro") out.push({ ...TEXTOS_DAS_SECOES.crediario_janeiro, porQueAgora: POR_QUE_CREDIARIO_EM_JANEIRO });
  }

  if (e.visible.has("estoque")) out.push(TEXTOS_DAS_SECOES.ruptura);

  if (!e.consolidatedView && e.visible.has("configuracoes")) {
    if (assentoTemporadaVisivel(hoje)) out.push(TEXTOS_DAS_SECOES.assento);
    if (hoje <= VALE_TROCA_PRAZO_ATE) out.push(TEXTOS_DAS_SECOES.vale_troca);
  }
  return out;
}
