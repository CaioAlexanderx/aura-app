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
export function renderizar(
  texto: string,
  valores: Record<string, string | null | undefined> = EXEMPLOS,
  /** false = campo sem valor vira "[Campo]" em vez do exemplo (prévia com cliente real). */
  usarExemplos: boolean = true,
): string {
  return String(texto || "").replace(TOKEN_RE, (_m, nome: string) => {
    const n = nome.trim();
    const v = valores[n];
    if (v !== undefined && v !== null && v !== "") return String(v);
    return usarExemplos ? EXEMPLOS[n] || n : `[${n}]`;
  });
}

// ── Validação do Editor (espelho de `validar` do servidor) ────────────
// A mesma regra roda no servidor ao salvar (PUT /modelos/:key, 422
// TEXTO_INVALIDO): o servidor nunca confia no app. Aqui ela serve para a
// conferência ao vivo e para o botão "Mandar para aprovação" só abrir
// quando tudo está certo. Ids e frases são os do contrato (Aura-backend
// #1128, src/services/waAutomaticas/modelos.js).

export const LIMITE_CARACTERES = 1024;

export type CorrecaoId = "PONTO_FINAL" | "SEPARAR" | "TIRAR_OFERTA";

export interface Check {
  id: string;
  ok: boolean;
  texto: string;
  correcao?: CorrecaoId;
  /** TIRAR_OFERTA: a frase a retirar. */
  trecho?: string;
  usado?: number;
  limite?: number;
  desconhecidos?: string[];
}

export interface Validacao { ok: boolean; checks: Check[]; previa: string }

/** Recorte do modelo que a validação usa. */
export interface ModeloParaValidar {
  campos: string[];
  categoria: string;
  /** Botões do modelo (ex.: "Quero o Pix" nos avisos do Crediário); o servidor manda em `botoes`. */
  botoes?: { tipo?: string | null; texto: string }[] | null;
}

// Palavras que fazem a Meta tratar o texto como propaganda.
const OFERTA_RE = /(desconto|promo[cç][aã]o|promocional|oferta|cupom|gr[aá]tis|brinde|ganhe|aproveite|liquida[cç][aã]o|black friday|\d+\s*%|%\s*off|\boff\b)/i;

/** Primeira frase com cara de oferta (só as palavras da lojista contam, não o valor dos campos). */
export function trechoDeOferta(texto: string): string | null {
  const sentencas = String(texto || "").split(/(?<=[.!?])\s+/);
  const achada = sentencas.find((s) => OFERTA_RE.test(s.replace(TOKEN_RE, " ")));
  return achada || null;
}

/** 1024 -> "1.024" (sem depender de Intl no celular). */
export function milhar(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function validar(modelo: ModeloParaValidar, texto: string | null | undefined): Validacao {
  const t = String(texto == null ? "" : texto);
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, msgOk: string, msgErro: string, extra: Partial<Check> = {}) =>
    checks.push({ id, ok, texto: ok ? msgOk : msgErro, ...extra });
  const limpo = t.trim();

  if (!limpo) {
    add("vazio", false, "", "Escreva a mensagem antes de mandar para aprovação.");
    return { ok: false, checks, previa: "" };
  }

  const unicos = Array.from(new Set(tokensDe(t).filter((n) => !modelo.campos.includes(n))));
  add("campos", unicos.length === 0, "Só campos que a Aura sabe preencher.",
    `Campo que a Aura não preenche aqui: ${unicos.map((n) => `"${n}"`).join(", ")}.`,
    unicos.length ? { desconhecidos: unicos } : {});

  // Chaves soltas viram texto estranho na mensagem final.
  const semTokens = t.replace(TOKEN_RE, "");
  if (/[{}]/.test(semTokens)) add("chaves", false, "", "Há uma chave { ou } sem par. Use só os campos da lista.");

  const comeca = /^\{[^{}]+\}/.test(limpo);
  const termina = /\{[^{}]+\}$/.test(limpo);
  add("comeca", !comeca, "Começa com palavras suas.", "O texto não pode começar num campo roxo.");
  add("termina", !termina, "Termina com palavras suas.", "O texto não pode terminar num campo roxo.",
    termina ? { correcao: "PONTO_FINAL" } : {});
  const colados = /\}\{/.test(t);
  add("colados", !colados, "Campos separados por palavras.", "Dois campos roxos estão colados.",
    colados ? { correcao: "SEPARAR" } : {});

  if (modelo.categoria === "UTILITY") {
    const trecho = trechoDeOferta(t);
    add("oferta", !trecho, "Sem oferta. Continua sendo aviso.",
      "Aviso não pode ter oferta: o WhatsApp passa a cobrar como novidade.",
      trecho ? { correcao: "TIRAR_OFERTA", trecho } : {});
  }

  // Mesma regra do servidor (modelos.js, check "botao"): o texto precisa citar o botão do modelo.
  if (Array.isArray(modelo.botoes) && modelo.botoes.length && modelo.botoes[0] && typeof modelo.botoes[0].texto === "string") {
    const rotulo = modelo.botoes[0].texto;
    const cita = t.toLowerCase().includes(rotulo.toLowerCase());
    add("botao", cita, `O texto avisa do botão "${rotulo}".`, `Mantenha no texto a frase que fala do botão "${rotulo}".`);
  }

  const previa = renderizar(t);
  const usado = Math.max(previa.length, t.length);
  add("tamanho", usado <= LIMITE_CARACTERES,
    `Cabe numa mensagem: ${milhar(usado)} de 1.024 letras.`,
    `Passou do limite: ${milhar(usado)} de 1.024 letras.`,
    { usado, limite: LIMITE_CARACTERES });

  return { ok: checks.every((c) => c.ok), checks, previa };
}

/** Aplica a correção de um toque de um check (devolve o texto novo). */
export function aplicarCorrecao(texto: string, check: Pick<Check, "correcao" | "trecho">): string {
  const t = String(texto || "");
  if (check.correcao === "PONTO_FINAL") return t.replace(/\s+$/, "") + ".";
  if (check.correcao === "SEPARAR") return t.replace(/\}\{/g, "}, {");
  if (check.correcao === "TIRAR_OFERTA" && check.trecho) {
    return t.replace(check.trecho, "").replace(/[ \t]{2,}/g, " ").trim();
  }
  return t;
}

/** Insere "{Campo}" na posição do cursor, com espaço de cada lado quando preciso. */
export function inserirCampo(texto: string, campo: string, inicio: number, fim: number): { texto: string; cursor: number } {
  const t = String(texto || "");
  const a = Math.max(0, Math.min(inicio, t.length));
  const b = Math.max(a, Math.min(fim, t.length));
  const antes = t.slice(0, a);
  const depois = t.slice(b);
  const espAntes = antes.length > 0 && !/\s$/.test(antes) ? " " : "";
  const espDepois = depois.length > 0 && !/^[\s.,;:!?]/.test(depois) ? " " : "";
  const ins = `${espAntes}{${campo}}${espDepois}`;
  return { texto: antes + ins + depois, cursor: (antes + ins).length - espDepois.length };
}

/** Quebra o texto em pedaços (palavras da lojista e campos), para mostrar os campos como pílulas. */
export function segmentos(texto: string): { campo: boolean; v: string }[] {
  const t = String(texto || "");
  const out: { campo: boolean; v: string }[] = [];
  let ultimo = 0;
  t.replace(TOKEN_RE, (m: string, nome: string, i: number) => {
    if (i > ultimo) out.push({ campo: false, v: t.slice(ultimo, i) });
    out.push({ campo: true, v: nome.trim() });
    ultimo = i + m.length;
    return "";
  });
  if (ultimo < t.length) out.push({ campo: false, v: t.slice(ultimo) });
  return out;
}
