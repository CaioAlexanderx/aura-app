// ============================================================
// Assento de temporada — janela em que o cartão aparece (13/10/2026)
//
// O cartão em Configurações › Plano só existe de 01/10/2026 a 31/01/2027:
// um mês antes de a temporada começar (01/11/2026) até o dia em que ela
// acaba. As datas da própria temporada (validade, o que dá para contratar)
// vêm do backend (GET .../seat-pass → temporada); só a janela de exibição
// mora aqui. Para a temporada seguinte, trocar as duas datas.
// ============================================================
export var JANELA_ASSENTO_TEMPORADA = {
  visivelDe: "2026-10-01",
  visivelAte: "2027-01-31",
};

// Quantidade pedida pela loja. O backend limita por loja (10) e devolve
// `limite_restante`; este é o teto do seletor.
export var MAX_ASSENTOS_POR_PEDIDO = 10;

var FUSO = "America/Sao_Paulo";

// "YYYY-MM-DD" de hoje no fuso de Brasília.
export function hojeBrt(agora?: Date): string {
  var d = agora || new Date(Date.now());
  var p: Record<string, string> = {};
  new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: FUSO })
    .formatToParts(d).forEach(function(x) { p[x.type] = x.value; });
  return p.year + "-" + p.month + "-" + p.day;
}

export function assentoTemporadaVisivel(hoje?: string): boolean {
  var h = hoje || hojeBrt();
  return h >= JANELA_ASSENTO_TEMPORADA.visivelDe && h <= JANELA_ASSENTO_TEMPORADA.visivelAte;
}

// "2026-11-01" → "01/11/2026"
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso);
}

export function reais(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function assentos(n: number): string {
  return n + (n === 1 ? " assento" : " assentos");
}
