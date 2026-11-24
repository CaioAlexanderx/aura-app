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
  if (outros.length) out.push("Faltou um dado do cadastro: tirei essa parte do texto.");
  return out;
}

const LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;

const DIGITO = /\p{N}/u;
const COLA_NUMERO = /[,./]/;
const NUMERO_CURTO = /^\d{1,2}$/;

/** O valor encostado neste ponto faz parte de outra palavra ou outro número? */
function colado(s: string, ini: number, fim: number, valor: string): boolean {
  const antes = ini > 0 ? s[ini - 1] : "";
  const depois = s[fim] || "";
  const primeiro = valor[0];
  const ultimo = valor[valor.length - 1];
  if (antes && LETRA_OU_NUMERO.test(antes) && LETRA_OU_NUMERO.test(primeiro)) return true;
  if (depois && LETRA_OU_NUMERO.test(depois) && LETRA_OU_NUMERO.test(ultimo)) return true;
  // "R$ 3,00", "10/12", "1.500": vírgula, ponto e barra entre dígitos são
  // parte do número, não fronteira.
  if (DIGITO.test(primeiro) && COLA_NUMERO.test(antes) && ini > 1 && DIGITO.test(s[ini - 2])) return true;
  if (DIGITO.test(ultimo) && COLA_NUMERO.test(depois) && DIGITO.test(s[fim + 1] || "")) return true;
  return false;
}

/**
 * "Salvar como modelo": o texto que a lojista editou, com os dados desta
 * cliente trocados pelas variáveis.
 *   - valor mais longo primeiro ("R$ 153,40" antes de "153"), só em palavra
 *     ou número inteiro ("3" não troca dentro de "R$ 3,00");
 *   - cada valor segue a ordem em que as variáveis daquele valor aparecem no
 *     modelo de onde ela partiu (`base`): com parcela "10/12" = vencimento
 *     "10/12", o primeiro "10/12" volta para a variável que vinha primeiro
 *     lá; com valor = saldo, fica a que o modelo usava;
 *   - número de 1 ou 2 dígitos solto ({dias}, às vezes {parcela}) só troca
 *     onde o modelo de base tinha a variável (e quantas vezes tinha);
 *   - sem base, o empate fica na ordem de VARIAVEIS.
 */
export function paraModelo(texto: string, dados: DadosDaMensagem, base?: string | null): string {
  const porValor = new Map<string, VariavelDaMensagem[]>();
  VARIAVEIS.forEach((v) => {
    const valor = String(dados[v.chave] ?? "").trim();
    if (!valor) return;
    porValor.set(valor, [...(porValor.get(valor) || []), v.chave]);
  });
  // Fila por valor: as variáveis daquele valor na ordem em que o modelo de
  // base as usa.
  const fila = new Map<string, VariavelDaMensagem[]>();
  const re = /\{([a-z_]+)\}/g;
  let m: RegExpExecArray | null;
  const b = String(base || "");
  while ((m = re.exec(b))) {
    const k = m[1] as VariavelDaMensagem;
    const valor = String(dados[k] ?? "").trim();
    if (!valor || !(porValor.get(valor) || []).includes(k)) continue;
    fila.set(valor, [...(fila.get(valor) || []), k]);
  }
  const valores = Array.from(porValor.keys()).sort((x, y) => y.length - x.length);
  const s = String(texto || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    let feito = false;
    for (const valor of valores) {
      if (!s.startsWith(valor, i) || colado(s, i, i + valor.length, valor)) continue;
      const daFila = (fila.get(valor) || []).shift();
      const chave = daFila || (NUMERO_CURTO.test(valor) ? null : (porValor.get(valor) as VariavelDaMensagem[])[0]);
      if (!chave) continue;
      out += "{" + chave + "}";
      i += valor.length;
      feito = true;
      break;
    }
    if (!feito) { out += s[i]; i += 1; }
  }
  return out;
}

/**
 * O modelo com que a prévia abre. Cliente sem parcela aberta (só saldo,
 * fiado) abre no modelo que fala do {saldo} sem citar parcela. Modelo que
 * ficaria vazio depois de tirar os parágrafos sem dado não serve: cai no
 * primeiro que dá texto (de preferência o do saldo). null = nenhum da lista
 * dá texto; quem chama usa o "Vamos combinar" da Aura.
 */
export function modeloInicial(
  modelos: ModeloDeMensagem[], situacao: Situacao | null | undefined, dados: DadosDaMensagem,
): ModeloDeMensagem | null {
  const daTexto = (m: ModeloDeMensagem | null | undefined) => !!m && preencher(m.body, dados).texto.trim() !== "";
  const semParcela = !temValor(dados.parcela);
  const doSaldo = modelos.filter((m) => m.body.includes("{saldo}") && !PARTE_DA_PARCELA.some((k) => m.body.includes("{" + k + "}")));
  const primeiro = semParcela
    ? (doSaldo.find((m) => m.is_default) || doSaldo[0] || modeloPadrao(modelos, situacao))
    : modeloPadrao(modelos, situacao);
  if (daTexto(primeiro)) return primeiro;
  return doSaldo.find(daTexto) || modelos.find(daTexto) || null;
}

/** O "Vamos combinar" da Aura: reserva final para nunca abrir com texto vazio. */
export const MODELO_DE_RESERVA = MODELOS_DA_AURA[3];

/**
 * A chave Pix que entra no {pix}: a do canal digital (a mesma do código
 * copia e cola e do QR) quando existe; senão a da régua. Uma fonte só por
 * cobrança — o texto não pode dizer uma chave e o código pagar outra.
 */
export function chavePixDaMensagem(chaveDoCanal: string | null | undefined, chaveDaRegua: string | null | undefined): string | null {
  const canal = String(chaveDoCanal || "").trim();
  if (canal) return canal;
  const regua = String(chaveDaRegua || "").trim();
  return regua || null;
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
