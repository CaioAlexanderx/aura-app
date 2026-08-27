// ============================================================================
// AURA. — Sugestão de NCM a partir do nome (e da categoria) do produto
//
// Este módulo existia duplicado e divergente em dois lugares (AddProductForm e
// DanfeImportModal), cada um com seu próprio dicionário. Agora é um só.
//
// POR QUE A REESCRITA (medido no catálogo real da Finesse, 1302 produtos):
//   - 1183 (91%) não recebiam sugestão nenhuma: só havia regra pra calçado e
//     acessório, e a loja é de roupa feminina.
//   - das 119 que recebiam, 55 (46%) estavam ERRADAS.
//
// O padrão do erro era sempre o mesmo: a regra casava com um acessório ou um
// detalhe CITADO no nome, não com o que o produto É.
//   /(bota|coturn)/i           casa com "botão"  → "bermuda jens botao dourado"
//   /(sapato|scarpin|social)/i casa com "social" → "blusa social"
//   /(...|cinto)/i             casa com a peça que VEM com cinto
//   \b(meia)\b                 casa com "meia taça"
// E um quarto, que ninguém tinha visto: \b não funciona depois de letra
// acentuada em JS, então /\b(boné)\b/ NUNCA casava com "boné" (só com "bone").
//
// AS TRÊS DEFESAS, em ordem de força:
//   1. TOKEN INTEIRO, sem acento. "botao" != "bota". Fim da classe inteira de
//      falso positivo por substring, e o problema do \b + acento some junto.
//   2. SUBSTANTIVO-NÚCLEO. Em nome de produto em português o tipo vem primeiro:
//      "Bermuda jeans com cinto corda" é bermuda, não cinto. Ganha o match de
//      menor índice; e um match logo depois de conectivo ("com", "e", "sem") é
//      descartado — ali o termo é detalhe, não o produto.
//   3. CATEGORIA COMO VETO. A lojista escolhe a categoria no mesmo formulário e
//      ela é muito mais confiável que o nome livre. Se a categoria diz calçado e
//      o nome sugere bolsa, não sugerimos nada. Veto e desempate, nunca fonte:
//      categoria sozinha é grossa demais pra apontar um NCM de 8 dígitos.
//
// A regra que rege tudo: NCM errado vai pra nota fiscal. Não sugerir é sempre
// melhor que sugerir errado.
// ============================================================================

export type NcmGroup =
  | 'calcado'
  | 'bolsa'
  | 'acessorio'
  | 'meia'
  | 'vestuario'
  | 'lingerie';

export type NcmFabric = 'malha' | 'plano' | 'assumido';

export type NcmSuggestion = {
  ncm: string;
  label: string;
  family: string;
  group: NcmGroup;
  /** Token do nome que disparou a regra — útil pra depurar/medir. */
  matchedTerm: string;
  /** 'assumido' = o nome não disse se é malha ou tecido plano; family avisa. */
  fabric: NcmFabric;
};

type NcmPick = { ncm: string; label: string; family: string };

type NcmRule = {
  id: string;
  group: NcmGroup;
  /** Termos que identificam o TIPO do produto. Sempre sem acento, minúsculo. */
  terms: string[];
  /**
   * Marcas e modelos. Só valem se nenhum termo de tipo casou em nenhuma regra —
   * "Nike blusa dry fit" é blusa, não tênis, mesmo com a marca vindo primeiro.
   */
  brands?: string[];
  /**
   * Abreviações do catálogo antigo ("SAP. FEM. PRETO", "TAM. SALTO 37"). Só
   * valem no INÍCIO do nome: a tokenização come o ponto, e sem ele "tam" casaria
   * com o tamanho em "Blusa tam 38".
   */
  abbrevs?: string[];
  /** Peça com uma classificação só. */
  pick?: NcmPick;
  /** Peça que muda de capítulo conforme a construção do tecido. */
  malha?: NcmPick;
  plano?: NcmPick;
  /** Qual assumir quando o nome não diz. */
  fallback?: 'malha' | 'plano';
};

const CAP_61 = 'Capítulo 61 — vestuário de malha';
const CAP_62 = 'Capítulo 62 — vestuário de tecido plano';
const CAP_64_COURO = 'Capítulo 64 — calçado de couro';
const CAP_64_PLAST = 'Capítulo 64 — calçado plástico/borracha';
const CAP_64_TEXTIL = 'Capítulo 64 — calçado têxtil';

/**
 * Avisa a lojista que o capítulo foi assumido. Ela confirma no "Usar" — e o
 * texto da família fica visível embaixo da sugestão, no formulário.
 */
const AVISO_MALHA = ' · confira se é malha (61) ou tecido plano (62)';

// ─── Regras ──────────────────────────────────────────────────────────────────
// A ordem importa só pra desempate quando dois termos casam no MESMO índice.
// O mais específico vem antes do mais genérico.

const NCM_RULES: NcmRule[] = [
  // ── Vestuário (capítulos 61 e 62) ──────────────────────────────────────────
  // Os códigos abaixo assumem fibras sintéticas, que é o que domina confecção
  // feminina. São sugestão: a lojista confirma, e o contador ajusta a subposição
  // por composição quando for o caso.
  {
    id: 'vestido', group: 'vestuario', fallback: 'plano',
    terms: ['vestido', 'chemise', 'chemisier'],
    plano: { ncm: '62044300', label: 'Vestido (tecido plano)', family: CAP_62 },
    malha: { ncm: '61044300', label: 'Vestido (malha)', family: CAP_61 },
  },
  {
    id: 'saia', group: 'vestuario', fallback: 'plano',
    terms: ['saia', 'saia-shorts', 'shortsaia'],
    plano: { ncm: '62045300', label: 'Saia (tecido plano)', family: CAP_62 },
    malha: { ncm: '61045300', label: 'Saia (malha)', family: CAP_61 },
  },
  {
    id: 'conjunto', group: 'vestuario', fallback: 'plano',
    terms: ['conjunto', 'conjuntinho', 'twinset'],
    plano: { ncm: '62042300', label: 'Conjunto (tecido plano)', family: CAP_62 },
    malha: { ncm: '61042300', label: 'Conjunto (malha)', family: CAP_61 },
  },
  {
    id: 'macacao', group: 'vestuario', fallback: 'plano',
    terms: ['macacao', 'macaquinho', 'jardineira'],
    plano: { ncm: '62046300', label: 'Macacão (tecido plano)', family: CAP_62 },
    malha: { ncm: '61046300', label: 'Macacão (malha)', family: CAP_61 },
  },
  {
    id: 'calca', group: 'vestuario', fallback: 'plano',
    terms: ['calca', 'pantalona', 'legging', 'jogger'],
    plano: { ncm: '62046300', label: 'Calça (tecido plano)', family: CAP_62 },
    malha: { ncm: '61046300', label: 'Calça (malha)', family: CAP_61 },
  },
  {
    id: 'short', group: 'vestuario', fallback: 'plano',
    terms: ['short', 'shorts', 'bermuda', 'ciclista'],
    plano: { ncm: '62046300', label: 'Short/bermuda (tecido plano)', family: CAP_62 },
    malha: { ncm: '61046300', label: 'Short/bermuda (malha)', family: CAP_61 },
  },
  {
    id: 'blazer', group: 'vestuario', fallback: 'plano',
    terms: ['blazer', 'terninho'],
    plano: { ncm: '62043300', label: 'Blazer (tecido plano)', family: CAP_62 },
    malha: { ncm: '61043300', label: 'Blazer (malha)', family: CAP_61 },
  },
  {
    id: 'colete', group: 'vestuario', fallback: 'plano',
    terms: ['colete'],
    plano: { ncm: '62114300', label: 'Colete (tecido plano)', family: CAP_62 },
    malha: { ncm: '61103000', label: 'Colete (malha)', family: CAP_61 },
  },
  {
    id: 'jaqueta', group: 'vestuario', fallback: 'plano',
    terms: ['jaqueta', 'parka', 'casaco', 'sobretudo', 'trench'],
    plano: { ncm: '62029300', label: 'Jaqueta/casaco (tecido plano)', family: CAP_62 },
    malha: { ncm: '61023000', label: 'Jaqueta/casaco (malha)', family: CAP_61 },
  },
  {
    id: 'tricot', group: 'vestuario',
    terms: ['moletom', 'sueter', 'suéter', 'cardiga', 'cardigan', 'pulover', 'blusao'],
    pick: { ncm: '61103000', label: 'Moletom/suéter (malha)', family: CAP_61 },
  },
  {
    id: 'camiseta', group: 'vestuario',
    terms: ['camiseta', 'cropped', 'croped', 'regata', 'top', 't-shirt', 'tshirt', 'baby look'],
    pick: { ncm: '61091000', label: 'Camiseta/cropped (malha)', family: CAP_61 },
  },
  {
    id: 'blusa', group: 'vestuario', fallback: 'malha',
    terms: ['blusa', 'camisa', 'bata', 'cropped-blusa'],
    plano: { ncm: '62064000', label: 'Blusa/camisa (tecido plano)', family: CAP_62 },
    malha: { ncm: '61062000', label: 'Blusa/camisa (malha)', family: CAP_61 },
  },
  {
    id: 'body', group: 'vestuario',
    terms: ['body', 'bodysuit'],
    pick: { ncm: '61143000', label: 'Body (malha)', family: CAP_61 },
  },
  {
    id: 'praia', group: 'vestuario',
    terms: ['biquini', 'maio', 'sunga', 'cortininha'],
    pick: { ncm: '61124100', label: 'Biquíni/maiô (malha)', family: 'Capítulo 61 — moda praia de malha' },
  },

  // ── Lingerie e modeladores (posição 6212 / 6108) ───────────────────────────
  {
    id: 'sutia', group: 'lingerie',
    terms: ['sutia', 'top-sutia'],
    pick: { ncm: '62121000', label: 'Sutiã', family: 'Capítulo 62 — lingerie e modeladores' },
  },
  {
    id: 'modelador', group: 'lingerie',
    terms: ['corselet', 'corselete', 'espartilho', 'cinta', 'modelador', 'modeladora'],
    pick: { ncm: '62129000', label: 'Corselet/modelador', family: 'Capítulo 62 — lingerie e modeladores' },
  },
  {
    id: 'calcinha', group: 'lingerie',
    terms: ['calcinha', 'tanga', 'fio dental'],
    pick: { ncm: '61082200', label: 'Calcinha (malha)', family: 'Capítulo 61 — roupa íntima de malha' },
  },
  {
    id: 'pijama', group: 'lingerie',
    terms: ['pijama', 'camisola', 'robe'],
    pick: { ncm: '61083200', label: 'Pijama/camisola (malha)', family: 'Capítulo 61 — roupa íntima de malha' },
  },

  // ── Meias ──────────────────────────────────────────────────────────────────
  // "meia" é sempre risco: casa com "meia taça", "meia manga", "meia estação".
  // Hoje o substantivo-núcleo resolve — "Vestido midi tricot meia taça" tem
  // "vestido" no índice 0 e vestido ganha.
  {
    id: 'meia', group: 'meia',
    terms: ['meia', 'meiao', 'soquete'],
    pick: { ncm: '61159500', label: 'Meia', family: 'Capítulo 61 — meias de algodão' },
  },

  // ── Bolsas e acessórios (capítulo 42 / 65) ─────────────────────────────────
  {
    id: 'bolsa', group: 'bolsa',
    terms: ['bolsa', 'mochila', 'necessaire', 'carteira', 'pochete', 'clutch', 'bolsinha'],
    pick: { ncm: '42029220', label: 'Bolsa/acessório', family: 'Capítulo 42 — bolsas e similares' },
  },
  {
    // Estava junto da bolsa, com o NCM da bolsa. Cinto tem posição própria.
    id: 'cinto', group: 'acessorio',
    terms: ['cinto'],
    pick: { ncm: '42033000', label: 'Cinto', family: 'Capítulo 42 — cintos de couro' },
  },
  {
    id: 'chapeu', group: 'acessorio',
    terms: ['bone', 'boné', 'chapeu', 'chapéu', 'gorro', 'viseira'],
    pick: { ncm: '65050090', label: 'Boné/chapéu', family: 'Capítulo 65 — acessórios de cabeça' },
  },

  // ── Calçados (capítulo 64) ─────────────────────────────────────────────────
  // Removidos daqui: "social", "casual", "flat", "esportivo". São adjetivos —
  // descrevem "blusa social", "conjunto esportivo", e não o tipo do calçado.
  {
    id: 'tenis', group: 'calcado',
    terms: ['tenis', 'chuteira', 'sneaker'],
    brands: ['jordan', 'nike', 'adidas', 'olympikus', 'asics', 'mizuno', 'wave prophecy',
             'mizuno wave', 'all star', 'allstar', 'airwalk'],
    pick: { ncm: '64041100', label: 'Tênis/calçado esportivo', family: 'Capítulo 64 — calçado têxtil esportivo' },
  },
  {
    id: 'chinelo', group: 'calcado',
    terms: ['chinelo', 'rasteira', 'rasteirinha', 'papete', 'patete', 'babuche', 'slide', 'slip'],
    abbrevs: ['chin'],
    brands: ['havaianas', 'havaiana', 'ipanema', 'kenner', 'crocs', 'rider', 'mormaii'],
    pick: { ncm: '64022000', label: 'Chinelo/sandália de tiras', family: CAP_64_PLAST },
  },
  {
    id: 'bota', group: 'calcado',
    terms: ['bota', 'botina', 'coturno'],
    pick: { ncm: '64039190', label: 'Bota', family: CAP_64_COURO },
  },
  {
    id: 'tamanco', group: 'calcado',
    terms: ['tamanco', 'anabela', 'plataforma'],
    abbrevs: ['tam'],
    pick: { ncm: '64029990', label: 'Tamanco/anabela', family: CAP_64_PLAST },
  },
  {
    id: 'sapatilha', group: 'calcado',
    terms: ['sapatilha', 'sapatinha', 'bailarina', 'mule', 'loafer', 'mocassim'],
    pick: { ncm: '64041900', label: 'Sapatilha/mule', family: CAP_64_TEXTIL },
  },
  {
    id: 'sapato', group: 'calcado',
    terms: ['sapato', 'scarpin', 'peep toe', 'peep-toe'],
    abbrevs: ['sap'],
    pick: { ncm: '64039900', label: 'Sapato fechado', family: CAP_64_COURO },
  },
  {
    id: 'sandalia', group: 'calcado',
    terms: ['sandalia'],
    abbrevs: ['sand', 'san'],
    brands: ['zaxy', 'azaleia'],
    pick: { ncm: '64029990', label: 'Sandália', family: CAP_64_PLAST },
  },
  {
    id: 'calcado-generico', group: 'calcado',
    terms: ['calcado', 'palmilha', 'cadarco', 'solado'],
    pick: { ncm: '64069000', label: 'Calçado/acessório de calçado', family: CAP_64_TEXTIL },
  },
];

// ─── Sinais auxiliares ───────────────────────────────────────────────────────

/**
 * Depois de conectivo o termo é detalhe, não produto: "bermuda COM cinto",
 * "vestido COM bolso". Descartamos o match.
 */
const CONECTIVOS = new Set([
  'com', 'sem', 'detalhe', 'detalhes', 'estampa', 'estampado',
  'estampada', 'forro', 'forrado', 'aplicacao', 'bordado', 'bordada',
]);
// "e" ficou de fora de propósito: em "Kit bolsa e cinto" é enumeração, e os
// dois itens são produtos de verdade. Quem resolve esse caso é o
// substantivo-núcleo (ganha o primeiro) e, se houver, a categoria.

const TERMOS_MALHA = new Set([
  'malha', 'tricot', 'trico', 'moletom', 'moletinho', 'ribana', 'canelado',
  'canelada', 'jersey', 'suplex', 'viscolycra', 'cotton',
]);

const TERMOS_PLANO = new Set([
  'jeans', 'jean', 'sarja', 'alfaiataria', 'alfaiate', 'linho', 'tricoline',
  'chiffon', 'cetim', 'popeline', 'brim', 'tafeta', 'organza',
]);

/** Categoria → grupo. Casado por token, mesma normalização do nome. */
const CATEGORIA_PARA_GRUPO: Array<{ tokens: string[]; group: NcmGroup }> = [
  { group: 'calcado', tokens: ['calcado', 'calcados', 'sapato', 'sapatos', 'tenis',
      'bota', 'botas', 'sandalia', 'sandalias', 'chinelo', 'chinelos', 'rasteirinha'] },
  { group: 'bolsa', tokens: ['bolsa', 'bolsas', 'mochila', 'mochilas'] },
  { group: 'meia', tokens: ['meia', 'meias'] },
  { group: 'lingerie', tokens: ['lingerie', 'intimo', 'intima', 'pijama', 'pijamas'] },
  { group: 'acessorio', tokens: ['acessorio', 'acessorios', 'cinto', 'cintos',
      'bijuteria', 'bijuterias', 'chapeu', 'oculos'] },
  { group: 'vestuario', tokens: ['roupa', 'roupas', 'vestuario', 'confeccao', 'moda',
      'vestido', 'vestidos', 'blusa', 'blusas', 'camisa', 'camisas', 'camiseta',
      'camisetas', 'saia', 'saias', 'calca', 'calcas', 'short', 'shorts', 'bermuda',
      'bermudas', 'conjunto', 'conjuntos', 'macacao', 'macacoes', 'blazer', 'blazers',
      'jaqueta', 'jaquetas', 'casaco', 'casacos', 'tricot', 'body', 'cropped',
      'praia', 'biquini', 'biquinis', 'maio'] },
];

// ─── Normalização e tokenização ──────────────────────────────────────────────

// Marcas de acento que o NFD separa da letra (U+0300–U+036F). Montado por
// fromCharCode de propósito: a fonte fica ASCII puro, e o range não depende de
// nenhum editor preservar caractere combinante solto no arquivo.
const DIACRITICOS = new RegExp(
  '[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g'
);

/**
 * Minúsculo, sem acento, pontuação virando separador. É isto que torna o match
 * por token inteiro possível — e de quebra resolve o bug do \b depois de letra
 * acentuada, que fazia /\b(boné)\b/ nunca casar com "boné".
 */
export function normalizeProductName(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(raw: string): string[] {
  const n = normalizeProductName(raw);
  return n ? n.split(' ') : [];
}

/** Match por token inteiro, tolerando plural simples. */
function tokenMatches(token: string, term: string): boolean {
  return token === term || token === term + 's' || token === term + 'es';
}

/**
 * Índice do primeiro token onde `term` (que pode ser frase) casa por inteiro.
 * -1 se não casa.
 */
function indexOfTerm(tokens: string[], term: string): number {
  const parts = normalizeProductName(term).split(' ').filter(Boolean);
  if (parts.length === 0) return -1;
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < parts.length; j++) {
      const ultimo = j === parts.length - 1;
      const casa = ultimo ? tokenMatches(tokens[i + j], parts[j]) : tokens[i + j] === parts[j];
      if (!casa) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

// ─── Núcleo ──────────────────────────────────────────────────────────────────

type Match = {
  rule: NcmRule;
  index: number;
  term: string;
  weak: boolean;
  /** Tokens do termo. Empatou no índice, ganha o mais específico: em
   *  "Top sutiã sem bojo" a frase "top sutia" tem que vencer o "top" solto. */
  size: number;
};

/** Menor índice > frase mais longa > termo forte. Nesta ordem. */
function melhorQue(a: Match, b: Match | null): boolean {
  if (!b) return true;
  if (a.index !== b.index) return a.index < b.index;
  if (a.size !== b.size) return a.size > b.size;
  return !a.weak && b.weak;
}

function coletarMatches(tokens: string[]): Match[] {
  const out: Match[] = [];
  for (const rule of NCM_RULES) {
    let melhor: Match | null = null;
    const candidatos: Array<{ list: string[]; weak: boolean; onlyFirst: boolean }> = [
      { list: rule.terms, weak: false, onlyFirst: false },
      { list: rule.abbrevs || [], weak: false, onlyFirst: true },
      { list: rule.brands || [], weak: true, onlyFirst: false },
    ];
    for (const { list, weak, onlyFirst } of candidatos) {
      for (const term of list) {
        const i = indexOfTerm(tokens, term);
        if (i < 0) continue;
        if (onlyFirst && i !== 0) continue;
        // Defesa 2b: logo depois de conectivo, o termo é detalhe da peça.
        if (i > 0 && CONECTIVOS.has(tokens[i - 1])) continue;
        const candidato: Match = {
          rule, index: i, term, weak,
          size: normalizeProductName(term).split(' ').filter(Boolean).length,
        };
        if (melhorQue(candidato, melhor)) melhor = candidato;
      }
    }
    if (melhor) out.push(melhor);
  }
  return out;
}

/** Marca/modelo só vale se nada identificou o tipo — "Nike blusa" é blusa. */
function escolherMatch(matches: Match[], grupoPreferido: NcmGroup | null): Match | null {
  const fortes = matches.filter(m => !m.weak);
  const pool = fortes.length > 0 ? fortes : matches;
  if (pool.length === 0) return null;

  const doGrupo = grupoPreferido ? pool.filter(m => m.rule.group === grupoPreferido) : [];
  const finalistas = doGrupo.length > 0 ? doGrupo : pool;

  // Defesa 2a: substantivo-núcleo — o tipo do produto vem primeiro no nome.
  let melhor: Match | null = null;
  for (const m of finalistas) {
    if (melhorQue(m, melhor)) melhor = m;
  }
  return melhor;
}

function detectarTecido(tokens: string[], extra?: string | null): NcmFabric {
  const todos = extra ? tokens.concat(tokenize(extra)) : tokens;
  for (const t of todos) {
    if (TERMOS_MALHA.has(t)) return 'malha';
    if (TERMOS_PLANO.has(t)) return 'plano';
  }
  return 'assumido';
}

/**
 * O veto compara BALDES, não grupos. Bolsa guardada em "Acessórios" e biquíni
 * em "Moda praia" são o normal do varejo — vetar por diferença fina só
 * apagaria sugestão certa. O grupo fino continua valendo pra desempate.
 */
const BALDE: Record<NcmGroup, string> = {
  calcado: 'calcado',
  bolsa: 'acessorio',
  acessorio: 'acessorio',
  meia: 'acessorio',
  vestuario: 'vestuario',
  lingerie: 'vestuario',
};

export function groupFromCategory(category?: string | null): NcmGroup | null {
  const tokens = tokenize(category || '');
  if (tokens.length === 0) return null;
  for (const { tokens: alvos, group } of CATEGORIA_PARA_GRUPO) {
    for (const t of tokens) {
      if (alvos.includes(t)) return group;
    }
  }
  return null;
}

export type SuggestNcmOptions = {
  /**
   * Só passe quando a lojista de fato escolheu a categoria. O formulário
   * pré-seleciona a primeira da lista, e categoria pré-selecionada não é
   * escolha — usá-la como sinal transformaria o default num veto errado.
   */
  category?: string | null;
  /** Ficha técnica (migration 305). Ajuda a decidir malha vs. tecido plano. */
  material?: string | null;
};

/**
 * Sugere um NCM a partir do nome. Devolve null quando não tem confiança —
 * o que é o resultado desejado sempre que houver conflito, porque NCM errado
 * vai pra nota fiscal.
 */
export function suggestNcm(name: string, opts: SuggestNcmOptions = {}): NcmSuggestion | null {
  if (!name || name.trim().length < 3) return null;
  const tokens = tokenize(name);
  if (tokens.length === 0) return null;

  const grupoCategoria = groupFromCategory(opts.category);
  const matches = coletarMatches(tokens);
  if (matches.length === 0) return null;

  const escolhido = escolherMatch(matches, grupoCategoria);
  if (!escolhido) return null;

  // Defesa 3: categoria confiável que contradiz o nome → não sugere nada.
  if (grupoCategoria && BALDE[escolhido.rule.group] !== BALDE[grupoCategoria]) return null;

  const rule = escolhido.rule;
  let fabric: NcmFabric = 'assumido';
  let pick: NcmPick | undefined = rule.pick;

  if (!pick) {
    fabric = detectarTecido(tokens, opts.material);
    const efetivo = fabric === 'assumido' ? (rule.fallback || 'plano') : fabric;
    pick = efetivo === 'malha' ? rule.malha : rule.plano;
    if (!pick) return null;
  }

  const precisaAviso = !rule.pick && fabric === 'assumido';
  return {
    ncm: pick.ncm,
    label: pick.label,
    family: precisaAviso ? pick.family + AVISO_MALHA : pick.family,
    group: rule.group,
    matchedTerm: escolhido.term,
    fabric,
  };
}

// ─── Helpers de exibição (usados pelos formulários) ──────────────────────────

/** "64041100" → "6404.11.00" */
export function formatNcmDisplay(ncm: string): string {
  if (!ncm || ncm.length !== 8) return ncm;
  return `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6, 8)}`;
}

/** Família curta pro hint do campo já preenchido. */
export function ncmFamilyByCode(ncm: string): string | null {
  if (!ncm || ncm.length !== 8) return null;
  for (const rule of NCM_RULES) {
    for (const pick of [rule.pick, rule.malha, rule.plano]) {
      if (pick && pick.ncm === ncm) return pick.family;
    }
  }
  return null;
}

export type NcmStatus = 'empty' | 'partial' | 'valid';
export function getNcmStatus(ncm: string): NcmStatus {
  if (!ncm) return 'empty';
  if (ncm.length === 8) return 'valid';
  return 'partial';
}

/** Exportado só pros testes e pra medição contra catálogo real. */
export const __NCM_RULES__ = NCM_RULES;
