// Textos e leitura da resposta da importação de lançamentos (Financeiro).
//
// Resposta de POST /companies/:id/transactions/batch?partial=true
// (Aura-backend, src/routes/transactionsBatch.js):
//   { saved, pending, total, error_count, batch_id,
//     errors: [ { index, errors: ["Linha N: motivo", ...], data }      // validação
//             | { index, error: "<mensagem do banco>", data } ] }      // falha ao gravar
// `errors` já vem limitado a 20 pelo backend e ordenado por linha. A validação
// devolve o motivo pronto em português com o número da linha; a falha de banco
// tem texto técnico, que não vai para a tela.

export const TEXTO_ESCOPO_IMPORTACAO =
  "Esta tela importa receitas e despesas. Se o seu arquivo é de crediário ou de clientes, a gente ajuda a trazer.";

export const ROTULO_PEDIR_AJUDA_IMPORTACAO = "Pedir ao Time Aura";

export const TEXTO_ARQUIVO_VAZIO =
  "Não encontramos nenhuma linha neste arquivo. Confira se os dados estão abaixo do cabeçalho e tente de novo.";

export const MAX_LINHAS_COM_MOTIVO = 5;

export type ResultadoImportacao = {
  saved?: number;
  error_count?: number;
  errors?: Array<{ index?: number; errors?: string[]; error?: string }>;
};

export type TextoDaImportacao = {
  titulo: string;
  /** "Importei N lançamentos." / "0 válidos" etc., já no tom novo. */
  resumo: string;
  /** Primeiras linhas que ficaram de fora, cada uma com o motivo. */
  motivos: string[];
  /** Mostrar o convite de ajuda (arquivo que não é de receitas/despesas). */
  oferecerAjuda: boolean;
};

function lancamentos(n: number): string {
  return n === 1 ? "1 lançamento" : n + " lançamentos";
}

/** Motivo de cada linha com erro, só das primeiras `max`. */
export function motivosDasLinhas(errors: ResultadoImportacao["errors"], max: number = MAX_LINHAS_COM_MOTIVO): string[] {
  var lista = Array.isArray(errors) ? errors : [];
  var out: string[] = [];
  for (var i = 0; i < lista.length && out.length < max; i++) {
    var item = lista[i] || {};
    var linha = typeof item.index === "number" ? item.index + 1 : null;
    if (Array.isArray(item.errors) && item.errors.length > 0) {
      out.push(String(item.errors[0]));
    } else {
      out.push((linha ? "Linha " + linha + ": " : "") + "não conseguimos salvar esta linha");
    }
  }
  return out;
}

export function textoDaImportacao(data: ResultadoImportacao): TextoDaImportacao {
  var saved = Number(data.saved) || 0;
  var fora = Number(data.error_count) || 0;
  var motivos = motivosDasLinhas(data.errors);
  if (saved <= 0) {
    return {
      titulo: "Nenhuma linha entrou",
      resumo: fora > 0
        ? "Não consegui importar nenhuma linha desta vez. Aqui estão as primeiras com o motivo."
        : "Não encontrei nenhum lançamento válido neste arquivo.",
      motivos: motivos,
      oferecerAjuda: true,
    };
  }
  if (fora > 0) {
    return {
      titulo: "Importação concluída",
      resumo: "Importei " + lancamentos(saved) + ". "
        + (fora === 1 ? "1 linha ficou de fora, e aqui está a primeira com o motivo." : fora + " linhas ficaram de fora, e aqui estão as primeiras com o motivo."),
      motivos: motivos,
      oferecerAjuda: true,
    };
  }
  return { titulo: "Importação concluída", resumo: "Importei " + lancamentos(saved) + ".", motivos: [], oferecerAjuda: false };
}
