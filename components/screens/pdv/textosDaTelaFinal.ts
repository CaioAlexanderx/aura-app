// ============================================================
// Textos do p-147 (17/11/2026): tela final, faixa da venda anterior e
// "Finalizando a venda…". Todos aqui, para trocar fácil: as palavras ainda
// são proposta do Caio (mockup "Caixa e Troca", seção 2, tabela "Tela final
// (Parte 2)"). Os marcados "sem mockup" foram escritos agora.
// ============================================================
import { pluralize } from "@/utils/plural";

export const TEXTOS_DA_TELA_FINAL = {
  // Tela final, embaixo dos botões.
  podeBipar: "Pode bipar o próximo produto: a venda nova começa sozinha.",
  esperando: (n: number) =>
    n === 1
      ? "1 produto já está esperando na próxima venda."
      : `${pluralize(n, "produto")} já estão esperando na próxima venda.`,
  // Tela final, embaixo do bloco da nota, enquanto envia.
  notaContinua: "A nota continua sendo enviada mesmo que você comece a próxima venda.",

  // Carrinho durante a espera da venda.
  botaoFinalizando: "Finalizando a venda…",
  avisoFinalizandoTitulo: "Finalizando a venda…",
  avisoFinalizando: "Pode atender o próximo cliente: o que for bipado agora entra na próxima venda.",
  guardado: (nomes: string) => `Guardado para a próxima venda: ${nomes}`,

  // Faixa da venda anterior.
  faixaVenda: (rotulo: string) => `Venda ${rotulo}`,
  faixaRegistrada: (total: string) => ` registrada · ${total}`,
  cupomImpresso: "Cupom impresso",
  imprimirCupom: "Imprimir cupom",
  imprimindoCupom: "Imprimindo o cupom…",
  notaEnviando: "Nota fiscal: enviando…",
  notaAutorizada: "Nota fiscal autorizada",
  notaRecusada: "A nota fiscal não foi aceita",
  verMotivo: "Ver o motivo",
  dispensar: "Dispensar o aviso da venda anterior",
  // Sem mockup: a consulta à SEFAZ desistiu com a nota ainda processando.
  notaProcessando: "Nota fiscal: a SEFAZ ainda está processando. Acompanhe em Notas.",
  // Sem mockup: o que "Ver o motivo" abre.
  motivoTitulo: "Por que a nota não foi aceita",
  motivoSemTexto: "A SEFAZ não mandou o motivo. Veja a nota em Notas.",
  campo: (campo: string, detalhe?: string | null) => `Campo: ${campo}${detalhe ? ` — ${detalhe}` : ""}`,
  tentarDeNovo: "Tentar de novo",
};
