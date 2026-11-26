// ============================================================
// waMensagem — o texto das mensagens: campos {Nome} e prévia
//
// Espelha a parte pura do servidor (Aura-backend,
// src/services/waAutomaticas/modelos.js, #1128): campos entre chaves
// simples, exemplos de cada campo e a troca de {Campo} pelo valor. A
// validação do Editor também mora aqui (acrescentada no PR do Editor).
// ============================================================

/** Exemplo de cada campo (os mesmos que a Meta exige ao criar o template). */
export const EXEMPLOS: Record<string, string> = {
  "Nome": "Marta",
  "Nome da loja": "Lume Moda",
  "Presente": "10% de desconto",
  "Validade": "27/12",
  "Código": "PARABENS-MARTA",
  "Parcela": "2 de 4",
  "Valor": "R$ 120,00",
  "Vencimento": "no sábado, 30/11",
  "Pix da loja": "pix@lumemoda.com.br",
  "Link da loja": "lumemoda.com.br",
  "Total de parcelas": "4",
  "Última compra": "Vestido Verde",
  "Mês da última compra": "agosto",
  "Limite livre": "R$ 480,00",
};

const TOKEN_RE = /\{([^{}]+)\}/g;

/** Campos usados no texto, na ordem em que aparecem. */
export function tokensDe(texto: string): string[] {
  const out: string[] = [];
  String(texto || "").replace(TOKEN_RE, (_m, nome: string) => { out.push(nome.trim()); return ""; });
  return out;
}

/** Troca {Campo} pelo valor; sem valor, usa o exemplo do campo (ou o próprio nome). */
export function renderizar(texto: string, valores: Record<string, string | null | undefined> = EXEMPLOS): string {
  return String(texto || "").replace(TOKEN_RE, (_m, nome: string) => {
    const n = nome.trim();
    const v = valores[n];
    return v === undefined || v === null || v === "" ? EXEMPLOS[n] || n : String(v);
  });
}
