// ============================================================
// AURA. — Cadastro de item · PERFIL DE CADASTRO por subvertical
//
// 22/09/2026 — mockup aprovado: docs/mockups/matcon-cadastro-produto.html
// (nota: docs/mockups/matcon-cadastro-produto.md).
//
// O modal continua UM só (mesmo shell, um Salvar, fila de fotos, aviso de
// duplicata, rodapé). O que muda é um PERFIL: só dados — textos, exemplos,
// ordem das seções e quais perguntas aparecem. As seções recebem o perfil
// como prop OPCIONAL, com default PERFIL_PADRAO.
//
// ZERO IMPACTO. Loja sem Matcon recebe PERFIL_PADRAO — o MESMO objeto,
// sempre (teste com toBe, igual ao unitsForProduct) — e cada texto dele é
// o texto de hoje. Com ele, o modal renderiza exatamente como antes.
//
// DESEMPATE (decisão do Caio, 22/09/2026): loja com Matcon e Ótica ligados
// usa o perfil Matcon no cadastro de produto — a Ótica não customiza este
// modal. Serviço usa sempre o padrão (o perfil é de produto).
// ============================================================
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";

/** Campos da ficha técnica. `brand` é a marca; `cuidados` é a coluna que o
 *  Matcon rotula "Onde usar e rendimento" (decisão do Caio: sem coluna nova). */
export type CampoDaFicha = "brand" | "material" | "medidas" | "cuidados";

export type LinhaDaFicha = {
  campo: CampoDaFicha;
  /** Rótulo na prévia da loja e, com `subRotulo`, acima do campo. */
  rotulo: string;
  placeholder: string;
};

export type PerfilDoCadastro = {
  id: "padrao" | "matcon";
  /** Etiqueta ao lado do título do modal. null = nenhuma. */
  etiqueta: string | null;
  item: {
    exemploDoNome: string;
    dicaDoNome: string | null;
    /** "outra cor ou tamanho" / "outra cor ou medida" no aviso de repetido. */
    eixoDaDuplicata: string;
    /** Sugestões do ramo na folha de categoria, quando a loja ainda não tem nenhuma. */
    categoriasSugeridas: readonly string[];
  };
  /** "Vendo por" antes do preço, preço "por m²" e "Como chega do fornecedor"
   *  no mesmo card. false = unidade no Estoque, como hoje. */
  vendoPorNoPreco: boolean;
  estoque: {
    /** Frase "Tenho [x] m² em estoque, e me avise abaixo de [y] m²." em
     *  qualquer unidade (inteira ou com vírgula). */
    fraseDoEstoque: boolean;
    rotuloDaGrade: string;
    rotuloDosTamanhos: string;
    botaoDeTamanho: string;
    exemploDeTamanho: string;
    abreviacaoDoTamanho: string;
    /** "Por lote e tonalidade" em m²/m³ quando a loja liga o lote. */
    lotes: boolean;
  };
  /** Card "Entrega" com o peso (weight_kg). */
  entrega: boolean;
  /** "Nota fiscal" no topo da coluna direita e "Códigos" num card próprio. */
  notaFiscalSeparada: boolean;
  fotos: {
    /** true = os textos de hoje ("Vai para a sua loja online…", "Tem
     *  cores?"). false = o `aviso` neutro e a `dica` no lugar do "Tem cores?". */
    lojaOnline: boolean;
    aviso: string | null;
    dica: string | null;
  };
  descricao: {
    placeholder: string;
    ficha: readonly LinhaDaFicha[];
    /** Rótulo acima de cada campo (Matcon) ou só placeholder (hoje). */
    subRotulos: boolean;
    dicaDaFicha: string | null;
    /** Caixa e peso na prévia, calculados da compra e da entrega. */
    fichaAutomatica: boolean;
  };
  /** "Salvar e cadastrar outro" mantém categoria, unidade, "compro por" e as
   *  respostas fiscais do produto anterior (decisão do Caio, 22/09/2026). */
  manterNoProximo: boolean;
};

export const PERFIL_PADRAO: PerfilDoCadastro = {
  id: "padrao",
  etiqueta: null,
  item: {
    exemploDoNome: "Ex.: Vestido midi floral",
    dicaDoNome: null,
    eixoDaDuplicata: "cor ou tamanho",
    categoriasSugeridas: [],
  },
  vendoPorNoPreco: false,
  estoque: {
    fraseDoEstoque: false,
    rotuloDaGrade: "Por cor e tamanho",
    rotuloDosTamanhos: "Tamanhos",
    botaoDeTamanho: "+ Tamanho",
    exemploDeTamanho: "P, M, G, 38, 500ml…",
    abreviacaoDoTamanho: "tam.",
    lotes: false,
  },
  entrega: false,
  notaFiscalSeparada: false,
  fotos: {
    lojaOnline: true,
    aviso: null,
    dica: null,
  },
  descricao: {
    placeholder: "Do que é feito, como veste, como cuidar.",
    ficha: [
      { campo: "material", rotulo: "Material", placeholder: "Material" },
      { campo: "medidas", rotulo: "Medidas", placeholder: "Medidas" },
      { campo: "cuidados", rotulo: "Cuidados", placeholder: "Cuidados" },
    ],
    subRotulos: false,
    dicaDaFicha: null,
    fichaAutomatica: false,
  },
  manterNoProximo: false,
};

export const PERFIL_MATCON: PerfilDoCadastro = {
  id: "matcon",
  etiqueta: "materiais de construção",
  item: {
    exemploDoNome: "Ex.: Porcelanato Bianco 60×60 acetinado",
    dicaDoNome: "Como está na caixa: o quê, marca e medida. É o que o vendedor procura no Caixa.",
    eixoDaDuplicata: "cor ou medida",
    categoriasSugeridas: [
      "Pisos e revestimentos", "Cimento e argamassa", "Tintas", "Elétrica",
      "Hidráulica", "Ferragens", "Telhas e tijolos", "Ferramentas",
    ],
  },
  vendoPorNoPreco: true,
  estoque: {
    fraseDoEstoque: true,
    rotuloDaGrade: "Por cor e medida",
    rotuloDosTamanhos: "Medidas",
    botaoDeTamanho: "+ Medida",
    exemploDeTamanho: "1,5 mm, 2,5 mm, 20 mm, ½\"…",
    abreviacaoDoTamanho: "med.",
    lotes: true,
  },
  entrega: true,
  notaFiscalSeparada: true,
  fotos: {
    lojaOnline: false,
    aviso: "Aparece na lista, no Caixa e no link do produto que você manda. Até 4; duas já resolvem.",
    dica: "Foto da caixa e do piso assentado ajudam o cliente a escolher.",
  },
  descricao: {
    placeholder: "Onde usar, como assentar, o que vem na caixa.",
    ficha: [
      { campo: "brand", rotulo: "Marca", placeholder: "Ex.: Cerâmica Vila Nova" },
      { campo: "medidas", rotulo: "Medidas", placeholder: "Ex.: 60 × 60 cm, 50 kg, 18 L" },
      { campo: "material", rotulo: "Material", placeholder: "Ex.: porcelanato esmaltado" },
      { campo: "cuidados", rotulo: "Onde usar e rendimento", placeholder: "Ex.: piso interno, área molhada" },
    ],
    subRotulos: true,
    // 23/09/2026 (QA em produção): a dica citava a frase "Compro por" mesmo
    // quando ela não está na tela (produto "do mesmo jeito que vendo") — o
    // trecho condicional mora em SecaoDescricao.tsx, que sabe se "Compro
    // por" está visível. Aqui fica só o texto que vale sempre.
    dicaDaFicha: 'Para tinta e argamassa, escreva o rendimento aqui: "rende 250 m² por demão".',
    fichaAutomatica: true,
  },
  manterNoProximo: true,
};

/**
 * O perfil do cadastro de produto da empresa ativa, pelo pdv_settings dela.
 * Sem Matcon devolve PERFIL_PADRAO — o mesmo objeto, nunca uma cópia.
 * `otica_enabled` não entra na conta: com os dois ligados, vale o Matcon.
 */
export function perfilDoCadastro(
  pdvSettings: Partial<MatconSettings> | Record<string, unknown> | null | undefined
): PerfilDoCadastro {
  return readMatconSettings(pdvSettings as Partial<MatconSettings>).matcon_enabled ? PERFIL_MATCON : PERFIL_PADRAO;
}

// ── embalagem de compra ("Compro por cx de 2,32 m²") ─────────
// Nome por extenso da unidade de compra, pra frase do preço da embalagem
// e para a prévia ("R$ 127,37 a caixa"). Fora da lista: "embalagem".
const EMBALAGENS: Record<string, { nome: string; artigo: "a" | "o" }> = {
  cx: { nome: "caixa", artigo: "a" },
  pct: { nome: "pacote", artigo: "o" },
  sc: { nome: "saco", artigo: "o" },
  rolo: { nome: "rolo", artigo: "o" },
  lata: { nome: "lata", artigo: "a" },
  balde: { nome: "balde", artigo: "o" },
  mlh: { nome: "milheiro", artigo: "o" },
  un: { nome: "unidade", artigo: "a" },
};

export function nomeDaEmbalagem(purchaseUnit: string | null | undefined): { nome: string; artigo: "a" | "o" } {
  return EMBALAGENS[String(purchaseUnit || "cx").trim().toLowerCase()] || { nome: "embalagem", artigo: "a" };
}

/** Exemplo do código interno a partir do nome: "Porcelanato…" → "POR-001".
 *  Sem nome (ou sem letra), "CIM-001". Acento some antes (Área → ARE). */
export function exemploDeCodigo(nome: string): string {
  const letras = String(nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return (letras.length === 3 ? letras : "CIM") + "-001";
}
