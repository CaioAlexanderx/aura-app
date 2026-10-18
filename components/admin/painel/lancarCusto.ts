// ============================================================
// Gestão Aura › Lançar custo do mês — regras do formulário (18/10/2026)
//
// Puro (sem React), testado à parte. O modal (LancarCustoModal.tsx) mostra
// uma linha por categoria; só vai no POST a categoria que a pessoa mexeu.
// As mesmas regras valem no backend (Aura-backend, services/custosMensais):
// valor >= 0 com até 2 casas, origem obrigatória, mês até o corrente.
// ============================================================
import type { PainelApiCustoCategoria, PainelApiCustoOrigem, PainelApiCustosCorpo, PainelApiCustosMes } from "@/services/adminApi";

export var MAX_OBSERVACAO = 200;
export var MAX_MOTIVO = 500;
export var VALOR_MAX = 1000000;
var MESES_NO_SELETOR = 6;

var NOMES_DOS_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function mesAtualBRT(agora?: Date): string {
  var d = new Date((agora ? agora.getTime() : Date.now()) - 3 * 3600000);
  return d.toISOString().slice(0, 7);
}

// O mês corrente e os 5 anteriores, do mais novo ao mais antigo.
export function mesesDoSeletor(agora?: Date): string[] {
  var atual = mesAtualBRT(agora).split("-").map(Number);
  var out: string[] = [];
  for (var i = 0; i < MESES_NO_SELETOR; i++) {
    var d = new Date(Date.UTC(atual[0], atual[1] - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

// "2026-10" → "out/2026"
export function rotuloDoMes(mes: string): string {
  var n = parseInt(mes.slice(5, 7), 10);
  return (NOMES_DOS_MESES[n - 1] || mes) + "/" + mes.slice(0, 4);
}

// Texto digitado → número. Aceita "1.234,56", "1234,56", "1234.56" e "550".
// Devolve null quando vazio e NaN quando não é número.
export function lerValor(texto: string): number | null {
  var t = (texto || "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

// 550 → "550,00"; null → ""
export function valorParaTexto(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toFixed(2).replace(".", ",");
}

export type LinhaDoForm = {
  id: PainelApiCustoCategoria;
  rotulo: string;
  ajuda: string;
  texto: string;                      // o que está no campo
  origem: PainelApiCustoOrigem | null;
  observacao: string;
  // como veio do servidor, para saber o que mudou
  original: { texto: string; origem: PainelApiCustoOrigem | null; observacao: string };
  lancado_em: string | null;
};

export function formDoMes(dados: PainelApiCustosMes): LinhaDoForm[] {
  return dados.categorias.map(function(c) {
    var texto = valorParaTexto(c.valor);
    var obs = c.observacao || "";
    return {
      id: c.id, rotulo: c.rotulo, ajuda: c.ajuda,
      texto: texto, origem: c.origem, observacao: obs,
      original: { texto: texto, origem: c.origem, observacao: obs },
      lancado_em: c.lancado_em,
    };
  });
}

export function mudou(l: LinhaDoForm): boolean {
  return l.texto.trim() !== l.original.texto || l.origem !== l.original.origem || l.observacao.trim() !== l.original.observacao;
}

// Erro de uma linha que a pessoa mexeu (ou null).
export function erroDaLinha(l: LinhaDoForm): string | null {
  if (!mudou(l)) return null;
  var v = lerValor(l.texto);
  if (v === null) return "Informe o valor (0 se não houve custo).";
  if (isNaN(v)) return "Valor inválido. Use só números, ex. 180,40.";
  if (v < 0) return "O valor não pode ser negativo.";
  if (v > VALOR_MAX) return "Valor alto demais para um mês.";
  if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return "Use no máximo 2 casas decimais.";
  if (!l.origem) return "Escolha de onde saiu o dinheiro.";
  if (l.observacao.length > MAX_OBSERVACAO) return "Observação passa de " + MAX_OBSERVACAO + " caracteres.";
  return null;
}

export function validar(linhas: LinhaDoForm[]): { ok: boolean; erros: Partial<Record<PainelApiCustoCategoria, string>>; alteradas: number } {
  var erros: Partial<Record<PainelApiCustoCategoria, string>> = {};
  var alteradas = 0;
  linhas.forEach(function(l) {
    if (!mudou(l)) return;
    alteradas += 1;
    var e = erroDaLinha(l);
    if (e) erros[l.id] = e;
  });
  return { ok: alteradas > 0 && Object.keys(erros).length === 0, erros: erros, alteradas: alteradas };
}

// Soma do mês como ficará depois de salvar: as linhas do formulário (as não
// mexidas com o valor do servidor) mais o total sem abertura que não é linha.
export function totalPrevisto(linhas: LinhaDoForm[], semAbertura?: number | null): number {
  var t = linhas.reduce(function(soma, l) {
    var v = lerValor(l.texto);
    return soma + (v == null || isNaN(v) || v < 0 ? 0 : v);
  }, 0);
  var temDemais = linhas.some(function(l) { return l.id === "demais"; });
  if (!temDemais && semAbertura) t += semAbertura;
  return Math.round(t * 100) / 100;
}

export function montarCorpo(mes: string, linhas: LinhaDoForm[], motivo: string): PainelApiCustosCorpo {
  var categorias: PainelApiCustosCorpo["categorias"] = {};
  linhas.forEach(function(l) {
    if (!mudou(l)) return;
    var obs = l.observacao.trim();
    categorias[l.id] = { valor: Math.round((lerValor(l.texto) as number) * 100) / 100, origem: l.origem as PainelApiCustoOrigem, observacao: obs || null };
  });
  var m = motivo.trim();
  return { mes: mes, categorias: categorias, motivo: m || null };
}
