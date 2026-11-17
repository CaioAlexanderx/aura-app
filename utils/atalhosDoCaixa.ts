// ============================================================
// Atalhos do Caixa num mapa só (17/11/2026, p-153 / A1)
//
// Antes cada tecla morava dentro do botão (6 listeners espalhados pela barra
// de ações e pela busca). Quando a barra não estava na tela, a tecla voltava
// a ser do navegador: na tela de venda concluída o F5 recarregava a página.
// E nenhum listener olhava se havia janela aberta: com a Troca aberta, F2/F3
// abriam o seletor por baixo dela.
//
// Agora: esta tabela é a única fonte (o listener lê daqui; etiquetas e
// legenda vão ler também), e `resolverAtalho` decide, sem DOM, o que uma
// tecla faz no estado atual do Caixa. Quem escuta é hooks/useAtalhosDoCaixa.
//
// Regras fixas (decisões do Caio, 17/11):
//   - Teclas fixas; o lojista não escolhe.
//   - F1–F5 e Ctrl/⌘+K ficam como estão; cada ação ganha uma alternativa com
//     Alt (⌥ no Mac), porque no Mac e em muito notebook a tecla F pede Fn.
//   - Nunca tecla solta (letra ou número) fora de campo, nunca Tab, nunca
//     Enter sozinho: são as teclas que o leitor de código de barras manda.
//     Os dois detectores do leitor já ignoram tecla com Ctrl/Alt/Meta, então
//     um atalho daqui nunca dispara no meio de uma rajada.
//   - Alt exige altKey && !ctrlKey: no teclado ABNT2 o AltGr chega como
//     Ctrl+Alt (AltGr+Q é a barra "/").
//   - Alt compara por e.code (posição da tecla): no Mac ⌥+letra muda o
//     e.key ("⌥C" chega como "ç").
// ============================================================

export type AcaoDoCaixa =
  | "codigoManual"
  | "vendedora"
  | "cliente"
  | "cupom"
  | "troca"
  | "busca";

/** Uma combinação de teclas. `code` é o KeyboardEvent.code. */
export type Combinacao =
  /** Tecla de função sozinha (F1…). */
  | { tipo: "funcao"; code: string }
  /** Alt (⌥) + tecla, sem Ctrl. */
  | { tipo: "alt"; code: string }
  /** Ctrl (Windows) ou ⌘ (Mac) + tecla, sem Alt. */
  | { tipo: "ctrlOuCmd"; code: string };

export type AtalhoDoCaixa = {
  acao: AcaoDoCaixa;
  /** A primeira é a principal; as outras, alternativas. */
  teclas: Combinacao[];
  /** O que a ação faz, para leitor de tela, etiqueta e legenda. */
  texto: string;
};

const F = (code: string): Combinacao => ({ tipo: "funcao", code });
const ALT = (code: string): Combinacao => ({ tipo: "alt", code });
const CMD = (code: string): Combinacao => ({ tipo: "ctrlOuCmd", code });

/** Mapa de teclas do Caixa (tabela 1.4 do mapa de 17/11). */
export const ATALHOS_DO_CAIXA: AtalhoDoCaixa[] = [
  { acao: "codigoManual", teclas: [F("F1"), ALT("KeyM")], texto: "Digitar código à mão" },
  { acao: "vendedora",    teclas: [F("F2"), ALT("KeyV")], texto: "Vendedora" },
  { acao: "cliente",      teclas: [F("F3"), ALT("KeyC")], texto: "Cliente" },
  { acao: "cupom",        teclas: [F("F4"), ALT("KeyU")], texto: "Cupom de desconto" },
  { acao: "troca",        teclas: [F("F5"), ALT("KeyT")], texto: "Troca ou devolução" },
  { acao: "busca",        teclas: [CMD("KeyK")],          texto: "Buscar produto" },
];

/** O que o Caixa está mostrando, do ponto de vista dos atalhos. */
export type EstadoDosAtalhos = {
  /** Tela de venda concluída na frente (a barra e a busca não estão montadas). */
  telaFinal: boolean;
  /** Alguma janela por cima do Caixa: Troca, troco, seletor de tamanho,
   *  cadastro rápido, abrir/fechar caixa, comandas, crediário… */
  janelaAberta: boolean;
};

/** O pedaço do KeyboardEvent que importa (dá para testar sem DOM). */
export type TeclaDoCaixa = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  /** O foco está num campo de texto (input, textarea, select, contenteditable). */
  emCampo?: boolean;
};

export type DecisaoDoAtalho = {
  /** A ação a executar agora (null = nenhuma). */
  acao: AcaoDoCaixa | null;
  /** Segurar a tecla (preventDefault): é do Caixa, mesmo sem ação agora. */
  segurar: boolean;
};

const NADA: DecisaoDoAtalho = { acao: null, segurar: false };

/** A letra/dígito que a tecla física `code` produz sem modificador. */
function caractereDoCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return null;
}

/** e.code às vezes falta (teclado virtual, navegador antigo): cai no e.key. */
function codeDaTecla(t: TeclaDoCaixa): string {
  if (t.code) return t.code;
  const k = t.key || "";
  if (/^F([1-9]|1[0-2])$/.test(k)) return k;
  if (/^[a-z]$/i.test(k)) return "Key" + k.toUpperCase();
  if (/^[0-9]$/.test(k)) return "Digit" + k;
  return k;
}

function casa(c: Combinacao, t: TeclaDoCaixa): boolean {
  const code = codeDaTecla(t);
  const ctrl = !!t.ctrlKey, alt = !!t.altKey, meta = !!t.metaKey;
  if (c.tipo === "funcao") {
    return !ctrl && !alt && !meta && (code === c.code || t.key === c.code);
  }
  if (c.tipo === "alt") {
    // AltGr = Ctrl+Alt no Windows: nunca é atalho.
    if (!alt || ctrl || meta || code !== c.code) return false;
    // Dentro de um campo, ⌥+letra no Mac escreve um caractere ("⌥C" = "ç"):
    // aí a tecla é do texto, não do Caixa. No Windows o Alt não escreve nada
    // e o e.key é a própria letra.
    const base = caractereDoCode(c.code);
    if (t.emCampo && base && (t.key || "").length === 1 && t.key.toLowerCase() !== base) return false;
    return true;
  }
  // Ctrl/⌘: compara pela letra que saiu (layout do teclado) ou pela posição.
  if (!(ctrl || meta) || alt) return false;
  const base = caractereDoCode(c.code);
  return code === c.code || (!!base && (t.key || "").toLowerCase() === base);
}

/** O atalho da tabela que esta tecla aciona, ou null. */
export function atalhoDaTecla(t: TeclaDoCaixa, mapa: AtalhoDoCaixa[] = ATALHOS_DO_CAIXA): { atalho: AtalhoDoCaixa; combinacao: Combinacao } | null {
  for (const a of mapa) {
    for (const c of a.teclas) {
      if (casa(c, t)) return { atalho: a, combinacao: c };
    }
  }
  return null;
}

/**
 * O que a tecla faz no estado atual do Caixa.
 *
 * - Tecla de função do mapa: sempre segurada no Caixa (inclusive na tela
 *   final e com janela aberta — o F5 não recarrega mais a página no meio da
 *   venda). Só age com o Caixa livre.
 * - Alt e Ctrl/⌘: só seguram quando agem. Com janela aberta a tecla segue
 *   para quem estiver nela.
 * - Tecla segurada (repeat): segura e não repete a ação.
 */
export function resolverAtalho(t: TeclaDoCaixa, estado: EstadoDosAtalhos, mapa: AtalhoDoCaixa[] = ATALHOS_DO_CAIXA): DecisaoDoAtalho {
  const achado = atalhoDaTecla(t, mapa);
  if (!achado) return NADA;
  const funcao = achado.combinacao.tipo === "funcao";
  const livre = !estado.telaFinal && !estado.janelaAberta;
  if (!livre) return funcao ? { acao: null, segurar: true } : NADA;
  if (t.repeat) return { acao: null, segurar: true };
  return { acao: achado.atalho.acao, segurar: true };
}

/** Foco num campo de texto? (input, textarea, select, contenteditable) */
export function focoEmCampo(alvo: EventTarget | null | undefined): boolean {
  const el = alvo as HTMLElement | null | undefined;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
}
