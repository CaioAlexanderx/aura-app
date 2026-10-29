// Textos e leitura da resposta da importação de lançamentos (Financeiro).
//
// Resposta de POST /companies/:id/transactions/batch?partial=true
// (Aura-backend, src/routes/transactionsBatch.js):
//   { saved, pending, total, error_count, batch_id,
//     reasons: { tipo_invalido: 3687, data_invalida: 2, erro_ao_salvar: 1 }   // linhas por motivo, de TODAS as linhas
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

export const TEXTO_PARECE_CREDIARIO =
  "Esta planilha parece ser de crediário. Aqui entram só as receitas e despesas do dia a dia, então o crediário não vai por esta tela. Se quiser, o Time Aura traz esse arquivo para você, sem trabalho nenhum da sua parte.";

export const ROTULO_BAIXAR_MODELO = "Baixar planilha de exemplo";

// Colunas que o importador de lançamentos entende (o backend aceita estes nomes).
export const COLUNAS_DO_MODELO = ["tipo", "valor", "data", "descricao", "categoria"];
export const LINHAS_DO_MODELO = [
  ["receita", "150,00", "05/11/2026", "Venda de balcão", "Vendas"],
  ["despesa", "89,90", "10/11/2026", "Conta de luz", "Contas fixas"],
];

export type ResultadoImportacao = {
  saved?: number;
  error_count?: number;
  /** Linhas por motivo (código do backend), contadas em todas as linhas e não só nas 20 primeiras. */
  reasons?: Record<string, number>;
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
  /** Quantas linhas caíram em cada motivo, em frase (ex.: "3.687 linhas sem entrada ou saída"). */
  resumoDosMotivos: string[];
  /** A planilha parece de crediário: o aviso gentil troca a lista de erros. */
  parecePlanilhaDeCrediario: boolean;
  /** Oferecer a planilha de exemplo (faltou tipo, valor ou data nas linhas). */
  oferecerModelo: boolean;
};

function semAcento(t: string): string {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const COLUNAS_DE_LANCAMENTO = ["tipo", "type", "valor", "amount", "descricao", "description", "categoria", "category"];

/**
 * Cabeçalho que lembra planilha de crediário/carnê (parcela, saldo devedor,
 * cliente) e não tem a coluna Tipo que o lançamento exige. Precisa de dois
 * sinais diferentes, para planilha de despesas com a palavra "cliente" não
 * ser confundida.
 */
export function pareceCrediario(colunas: string[]): boolean {
  var cols = (colunas || []).map(semAcento);
  if (cols.length === 0) return false;
  if (cols.indexOf("tipo") >= 0 || cols.indexOf("type") >= 0) return false;
  var tem = function(termos: string[]) {
    return cols.some(function(c) { return termos.some(function(t) { return c.indexOf(t) >= 0; }); });
  };
  var sinais = [
    tem(["parcela", "carne"]),
    tem(["saldo", "devedor", "em aberto", "restante"]),
    tem(["cliente"]),
    tem(["crediario", "fiado"]),
  ].filter(Boolean).length;
  return sinais >= 2;
}

function planilhaDeLancamentoSemTipo(colunas: string[]): boolean {
  var cols = (colunas || []).map(semAcento);
  return cols.length > 0 && cols.indexOf("tipo") < 0 && cols.indexOf("type") < 0
    && !cols.some(function(c) { return COLUNAS_DE_LANCAMENTO.indexOf(c) >= 0; });
}

function nLinhas(n: number): string {
  return (n === 1 ? "1 linha" : n.toLocaleString("pt-BR") + " linhas");
}

/** Uma frase por motivo, do mais comum para o menos comum. */
export function resumoDosMotivos(reasons: ResultadoImportacao["reasons"]): string[] {
  var frases: Record<string, (n: number) => string> = {
    tipo_invalido: function(n) { return nLinhas(n) + " sem entrada ou saída (coluna Tipo, com receita ou despesa)"; },
    valor_invalido: function(n) { return nLinhas(n) + " com valor que não deu para entender"; },
    data_invalida: function(n) { return nLinhas(n) + " com data que não deu para entender"; },
    descricao_obrigatoria: function(n) { return nLinhas(n) + " sem descrição"; },
    erro_ao_salvar: function(n) { return nLinhas(n) + " que não conseguimos salvar"; },
  };
  var lista = Object.keys(reasons || {})
    .filter(function(k) { return !!frases[k] && Number((reasons as any)[k]) > 0; })
    .sort(function(a, b) { return Number((reasons as any)[b]) - Number((reasons as any)[a]); });
  return lista.map(function(k) { return frases[k](Number((reasons as any)[k])); });
}

function lancamentos(n: number): string {
  return n === 1 ? "1 lançamento" : n + " lançamentos";
}

/**
 * "Linha 2: tipo invalido 'x' (use 'income' ou 'expense')" vira uma frase de
 * gente. Mensagem que não reconhece fica como veio.
 */
export function motivoEmPortugues(mensagem: string, linha: number | null): string {
  var m = /^Linha (\d+):\s*(.*)$/.exec(mensagem);
  var n = m ? m[1] : (linha ? String(linha) : "");
  var resto = m ? m[2] : mensagem;
  var prefixo = n ? "Linha " + n + ": " : "";
  if (/^tipo invalido/i.test(resto)) return prefixo + "falta dizer se é receita ou despesa (coluna Tipo)";
  if (/^valor invalido/i.test(resto)) return prefixo + "o valor não deu para entender";
  if (/^descricao obrigatoria/i.test(resto)) return prefixo + "falta a descrição";
  if (/^data invalida/i.test(resto)) return prefixo + "a data não deu para entender (use dia/mês/ano, como 05/11/2026)";
  return mensagem;
}

/** Motivo de cada linha com erro, só das primeiras `max`. */
export function motivosDasLinhas(errors: ResultadoImportacao["errors"], max: number = MAX_LINHAS_COM_MOTIVO): string[] {
  var lista = Array.isArray(errors) ? errors : [];
  var out: string[] = [];
  for (var i = 0; i < lista.length && out.length < max; i++) {
    var item = lista[i] || {};
    var linha = typeof item.index === "number" ? item.index + 1 : null;
    if (Array.isArray(item.errors) && item.errors.length > 0) {
      out.push(motivoEmPortugues(String(item.errors[0]), linha));
    } else {
      out.push((linha ? "Linha " + linha + ": " : "") + "não conseguimos salvar esta linha");
    }
  }
  return out;
}

export function textoDaImportacao(data: ResultadoImportacao, colunas: string[] = []): TextoDaImportacao {
  var saved = Number(data.saved) || 0;
  var fora = Number(data.error_count) || 0;
  var motivos = motivosDasLinhas(data.errors);
  var porMotivo = resumoDosMotivos(data.reasons);
  var faltouTipo = Number((data.reasons || {}).tipo_invalido) || 0;
  var semDado = { resumoDosMotivos: porMotivo, parecePlanilhaDeCrediario: false, oferecerModelo: false };
  if (saved <= 0) {
    // Nada entrou e o cabeçalho lembra crediário: o problema não são as linhas,
    // é que este não é o lugar. Sem lista de erros, só o aviso e o convite.
    if (fora > 0 && pareceCrediario(colunas)) {
      return {
        titulo: "Parece uma planilha de crediário",
        resumo: TEXTO_PARECE_CREDIARIO,
        motivos: [],
        oferecerAjuda: true,
        resumoDosMotivos: [],
        parecePlanilhaDeCrediario: true,
        oferecerModelo: false,
      };
    }
    return {
      titulo: "Nenhuma linha entrou",
      resumo: fora > 0
        ? "Não consegui importar nenhuma linha desta vez. Aqui estão as primeiras com o motivo."
        : "Não encontrei nenhum lançamento válido neste arquivo.",
      motivos: motivos,
      oferecerAjuda: true,
      resumoDosMotivos: porMotivo,
      parecePlanilhaDeCrediario: false,
      oferecerModelo: fora > 0 && (faltouTipo > 0 || planilhaDeLancamentoSemTipo(colunas)),
    };
  }
  if (fora > 0) {
    return {
      titulo: "Importação concluída",
      resumo: "Importei " + lancamentos(saved) + ". "
        + (fora === 1 ? "1 linha ficou de fora, e aqui está a primeira com o motivo." : fora + " linhas ficaram de fora, e aqui estão as primeiras com o motivo."),
      motivos: motivos,
      oferecerAjuda: true,
      resumoDosMotivos: porMotivo,
      parecePlanilhaDeCrediario: false,
      oferecerModelo: faltouTipo > 0,
    };
  }
  return Object.assign({ titulo: "Importação concluída", resumo: "Importei " + lancamentos(saved) + ".", motivos: [], oferecerAjuda: false }, semDado, { resumoDosMotivos: [] });
}
