// ============================================================
// Modelos de mensagem do crediário (21/11/2026)
//
// O Cobrar abre a prévia com o modelo padrão da situação da parcela mais
// antiga em aberto (a vencer, vence hoje, em atraso). Aqui mora a regra
// pura, sem tela:
//   - as variáveis que o app sabe preencher (as mesmas do backend,
//     src/services/credit/messageTemplates.js);
//   - os 4 prontos da Aura, embutidos como reserva para quando a rota
//     /credit/message-templates falhar (o Cobrar nunca fica sem texto);
//   - preencher: troca as variáveis e TIRA o parágrafo cuja variável não
//     tem valor (loja sem chave Pix, cliente sem parcela), avisando;
//   - paraModelo: o caminho de volta do "Salvar como modelo" — os dados da
//     cliente viram variáveis, só em palavra inteira ("Ana" não troca
//     dentro de "semana").
// ============================================================

export type Situacao = "a_vencer" | "vence_hoje" | "em_atraso";
export const SITUACOES: Situacao[] = ["a_vencer", "vence_hoje", "em_atraso"];

/** "padrão · a vencer" (lista) */
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  a_vencer: "a vencer",
  vence_hoje: "vence hoje",
  em_atraso: "em atraso",
};
/** "Usar sozinho quando a parcela estiver: …" */
export const ESCOLHA_SITUACAO: Record<Situacao, string> = {
  a_vencer: "A vencer",
  vence_hoje: "Vencendo hoje",
  em_atraso: "Em atraso",
};

export type VariavelDaMensagem = "nome" | "loja" | "valor" | "vencimento" | "parcela" | "dias" | "saldo" | "pix";

export const VARIAVEIS: Array<{ chave: VariavelDaMensagem; rotulo: string }> = [
  { chave: "nome", rotulo: "nome" },
  { chave: "loja", rotulo: "loja" },
  { chave: "valor", rotulo: "valor" },
  { chave: "vencimento", rotulo: "vencimento" },
  { chave: "parcela", rotulo: "parcela" },
  { chave: "dias", rotulo: "dias de atraso" },
  { chave: "saldo", rotulo: "saldo" },
  { chave: "pix", rotulo: "chave Pix" },
];
const CHAVES = VARIAVEIS.map((v) => v.chave) as string[];

export const LIMITE_DE_MODELOS = 10;
export const MAX_LETRAS = 1000;
export const MAX_NOME = 40;

export type ModeloDeMensagem = {
  id: string;
  name: string;
  body: string;
  situation: Situacao | null;
  is_default: boolean;
  origin: "aura" | "loja";
  aura_key?: string;
  sort?: number;
};

export type DadosDaMensagem = Partial<Record<VariavelDaMensagem, string | null>>;

// Os mesmos textos do backend (PRONTOS em services/credit/messageTemplates.js).
export const MODELOS_DA_AURA: ModeloDeMensagem[] = [
  {
    id: "aura:lembrete", aura_key: "lembrete", origin: "aura", name: "Lembrete", situation: "a_vencer", is_default: true, sort: 1,
    body:
      "Oi, {nome}! Tudo bem?\n\n" +
      "Passando só pra lembrar que a parcela {parcela} do seu crediário aqui na {loja}, de {valor}, vence dia {vencimento}.\n\n" +
      "Se quiser pagar por Pix, a chave é {pix}.\n\n" +
      "Qualquer coisa é só me chamar!",
  },
  {
    id: "aura:vence_hoje", aura_key: "vence_hoje", origin: "aura", name: "Vence hoje", situation: "vence_hoje", is_default: true, sort: 2,
    body:
      "Oi, {nome}! Tudo bem?\n\n" +
      "Sua parcela {parcela} de {valor} aqui na {loja} vence hoje.\n\n" +
      "Se for mais fácil, pode pagar por Pix: {pix}. Me avisa quando fizer que eu já dou baixa.",
  },
  {
    id: "aura:passou_do_dia", aura_key: "passou_do_dia", origin: "aura", name: "Passou do dia", situation: "em_atraso", is_default: true, sort: 3,
    body:
      "Oi, {nome}, tudo bem por aí?\n\n" +
      "Vi aqui que a parcela {parcela} de {valor}, que venceu dia {vencimento}, ainda está em aberto. Pode ter passado batido, acontece!\n\n" +
      "Consegue me dizer quando fica bom pra você acertar? Se preferir Pix, a chave é {pix}.",
  },
  {
    id: "aura:vamos_combinar", aura_key: "vamos_combinar", origin: "aura", name: "Vamos combinar", situation: null, is_default: false, sort: 4,
    body:
      "Oi, {nome}, como você está?\n\n" +
      "Queria conversar sobre o seu crediário aqui na {loja}: hoje o valor em aberto é {saldo}.\n\n" +
      "Se estiver apertado, me fala que a gente combina um jeito que caiba pra você. O que acha?",
  },
];

/** Cliente de mentira do "Para outra cliente, sairia assim". */
export const DADOS_DE_EXEMPLO: DadosDaMensagem = {
  nome: "Joana", loja: "sua loja", valor: "R$ 80,00", vencimento: "05/11", parcela: "1/4",
  dias: "16", saldo: "R$ 240,00", pix: "sua chave Pix",
};

/** Letras como o backend conta (pontos de código; emoji é uma). */
export function letras(s: string): number {
  return Array.from(String(s || "")).length;
}

/** Hoje em America/Sao_Paulo, YYYY-MM-DD. */
export function hojeSP(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function dia(iso: string): string {
  return String(iso || "").slice(0, 10);
}

export function diasDeAtraso(vencimento: string | null | undefined, hoje: string = hojeSP()): number {
  if (!vencimento) return 0;
  const d = dia(vencimento);
  if (d >= hoje) return 0;
  const a = new Date(d + "T00:00:00Z").getTime();
  const b = new Date(hoje + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Sem parcela (só saldo) conta como "a vencer": o lembrete é o tom certo. */
export function situacaoDaParcela(vencimento: string | null | undefined, hoje: string = hojeSP()): Situacao {
  if (!vencimento) return "a_vencer";
  const d = dia(vencimento);
  if (d === hoje) return "vence_hoje";
  return d < hoje ? "em_atraso" : "a_vencer";
}

export function primeiroNome(nome: string | null | undefined): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

/** O padrão da situação; sem padrão, o pronto daquela situação; sem nada, o primeiro. */
export function modeloPadrao(modelos: ModeloDeMensagem[], situacao: Situacao | null | undefined): ModeloDeMensagem | null {
  if (!modelos.length) return null;
  if (situacao) {
    const p = modelos.find((m) => m.is_default && m.situation === situacao)
      || modelos.find((m) => m.situation === situacao);
    if (p) return p;
  }
  return modelos[0];
}

function temValor(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== "";
}

export type Preenchido = { texto: string; faltando: VariavelDaMensagem[] };

/**
 * Troca as variáveis. Parágrafo (bloco separado por linha em branco) com uma
 * variável sem valor sai inteiro: "a chave é ." é pior que não falar da chave.
 * Chave desconhecida fica como está.
 */
export function preencher(body: string, dados: DadosDaMensagem): Preenchido {
  const faltando = new Set<VariavelDaMensagem>();
  const paragrafos = String(body || "").replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  const saida: string[] = [];
  for (const p of paragrafos) {
    let falta = false;
    const texto = p.replace(/\{([a-z_]+)\}/g, (inteiro, k: string) => {
      if (!CHAVES.includes(k)) return inteiro;
      const v = dados[k as VariavelDaMensagem];
      if (!temValor(v)) { falta = true; faltando.add(k as VariavelDaMensagem); return ""; }
      return String(v);
    });
    if (!falta) saida.push(texto);
  }
  return { texto: saida.join("\n\n").trim(), faltando: Array.from(faltando) };
}

const PARTE_DA_PARCELA: VariavelDaMensagem[] = ["valor", "vencimento", "parcela"];

/** Uma linha por motivo, no tom do mockup. */
export function avisosDoQueFaltou(faltando: VariavelDaMensagem[]): string[] {
  const out: string[] = [];
  if (faltando.includes("pix")) out.push("Sem chave Pix cadastrada: tirei essa parte do texto.");
  if (faltando.some((k) => PARTE_DA_PARCELA.includes(k))) out.push("Sem parcela em aberto: tirei a parte da parcela do texto.");
  if (faltando.includes("dias")) out.push("A parcela não está em atraso: tirei a parte dos dias de atraso.");
  const outros = faltando.filter((k) => k !== "pix" && k !== "dias" && !PARTE_DA_PARCELA.includes(k));
  if (outros.length) out.push("Faltou um dado da cliente: tirei essa parte do texto.");
  return out;
}

const LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;

/**
 * "Salvar como modelo": o texto que a lojista editou, com os dados desta
 * cliente trocados pelas variáveis. Valor mais longo primeiro ("R$ 153,40"
 * antes de "153"), só em palavra inteira, empate na ordem de VARIAVEIS
 * (valor antes de saldo quando os dois são iguais).
 */
export function paraModelo(texto: string, dados: DadosDaMensagem): string {
  const candidatos = VARIAVEIS
    .map((v, ordem) => ({ chave: v.chave, valor: String(dados[v.chave] ?? "").trim(), ordem }))
    .filter((c) => c.valor.length > 0)
    .sort((a, b) => (b.valor.length - a.valor.length) || (a.ordem - b.ordem));
  const s = String(texto || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    let achou: { chave: string; valor: string } | null = null;
    for (const c of candidatos) {
      if (!s.startsWith(c.valor, i)) continue;
      const antes = i > 0 ? s[i - 1] : "";
      const depois = s[i + c.valor.length] || "";
      const colaAntes = !!antes && LETRA_OU_NUMERO.test(antes) && LETRA_OU_NUMERO.test(c.valor[0]);
      const colaDepois = !!depois && LETRA_OU_NUMERO.test(depois) && LETRA_OU_NUMERO.test(c.valor[c.valor.length - 1]);
      if (colaAntes || colaDepois) continue;
      achou = c;
      break;
    }
    if (achou) { out += "{" + achou.chave + "}"; i += achou.valor.length; }
    else { out += s[i]; i += 1; }
  }
  return out;
}

export type ParteDoModelo = { tipo: "texto" | "variavel"; valor: string };

/** Para desenhar o modelo com as variáveis destacadas. */
export function partesDoModelo(body: string): ParteDoModelo[] {
  const out: ParteDoModelo[] = [];
  const re = /\{([a-z_]+)\}/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  const s = String(body || "");
  while ((m = re.exec(s))) {
    if (!CHAVES.includes(m[1])) continue;
    if (m.index > ultimo) out.push({ tipo: "texto", valor: s.slice(ultimo, m.index) });
    out.push({ tipo: "variavel", valor: m[1] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) out.push({ tipo: "texto", valor: s.slice(ultimo) });
  return out;
}

export function variaveisDesconhecidas(body: string): string[] {
  const out = new Set<string>();
  String(body || "").replace(/\{([^{}\s]*)\}/g, (inteiro, k: string) => {
    if (!CHAVES.includes(k)) out.add("{" + k + "}");
    return inteiro;
  });
  return Array.from(out);
}

/** Erro de validação do modelo, no texto que a tela mostra; null = ok. */
export function erroDoModelo(nome: string, body: string): string | null {
  if (!String(nome || "").trim()) return "Dê um nome ao modelo.";
  if (letras(String(nome).trim()) > MAX_NOME) return "O nome passa de 40 letras.";
  if (!String(body || "").trim()) return "Escreva o texto do modelo.";
  if (letras(String(body).trim()) > MAX_LETRAS) return "O texto passa de 1.000 letras.";
  const fora = variaveisDesconhecidas(body);
  if (fora.length) return `O app não conhece ${fora.join(", ")}. Use os botões de variável.`;
  return null;
}

/** Insere {chave} onde está o cursor (ou no lugar da seleção). */
export function inserirVariavel(
  texto: string, selecao: { start: number; end: number } | null | undefined, chave: VariavelDaMensagem,
): { texto: string; cursor: number } {
  const s = String(texto || "");
  const ini = Math.max(0, Math.min(selecao?.start ?? s.length, s.length));
  const fim = Math.max(ini, Math.min(selecao?.end ?? ini, s.length));
  const v = "{" + chave + "}";
  return { texto: s.slice(0, ini) + v + s.slice(fim), cursor: ini + v.length };
}

/**
 * A parcela que o Cobrar cita: a mais antiga em aberto. Com `carne` (o Cobrar
 * do cartão de um carnê), só as parcelas DAQUELE carnê; id null = o grupo
 * sem carnê. Antes do 21/11 o cartão cobrava a mais antiga da cliente, de
 * qualquer carnê.
 */
export function parcelaDaCobranca<T extends { due_date: string; account_id?: string | null }>(
  abertas: T[] | null | undefined, carne?: { id: string | null } | null,
): T | undefined {
  return (abertas || [])
    .filter((i) => !carne || (i.account_id || null) === (carne.id || null))
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
}
