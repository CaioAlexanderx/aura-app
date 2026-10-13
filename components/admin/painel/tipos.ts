// ============================================================
// Gestão Aura › Hoje — modelo de dados da TELA (13/10/2026)
//
// Estes tipos são o que os componentes consomem. O formato bruto da API
// (Aura-backend #807) está em PainelApi* no services/adminApi.ts e é
// traduzido por adaptadores.ts:
//   GET /admin/painel/hoje                  → PainelHoje
//   GET /admin/painel/blocos/:id            → BlocoDetalhe
//   GET /admin/painel/clientes/:cid/ficha   → FichaCliente
//   GET /admin/painel/layout                → { ativos: BlocoId[], ... }
//
// O que a tela precisa e a API não manda (`legenda`, `destaques`,
// `formato` da lista) é derivado no adaptador ou fica opcional, para a
// tela continuar de pé.
// ============================================================

export type BlocoId =
  | "cadastros" | "trials_degrau" | "pagantes" | "pagantes_sem_venda" | "receita"
  | "plataforma" | "fiscal" | "crediario" | "frentes" | "acesso"
  | "uso_funcionalidade" | "horario" | "adocao" | "telas_visitadas"
  | "contatos"
  // Só no catálogo/mockup por enquanto — o backend ainda não calcula.
  | "etiquetas" | "tempo_primeira_venda" | "aurinha" | "custos" | "nps";

// Estado de um número, de uma barra ou de uma etiqueta.
export type Tom = "sobe" | "desce" | "alerta" | "neutro" | "teal" | "claro" | "mudo";

// Um ponto serve a todos os gráficos: barras (rotulo, valor), linha de duas
// séries (valor, valor2), funil e rosca (texto = "55%", "R$ 1.127") e barras
// horizontais (texto substitui o número, tom pinta a barra).
export type Ponto = {
  rotulo: string;
  valor: number;
  valor2?: number;
  texto?: string;
  tom?: Tom;
};

export type Variacao = { texto: string; tom: Tom };

export type Bloco = {
  id: BlocoId;
  valor: string | number | null;
  legenda?: string;            // texto ao lado do número ("cadastros", "em 7 dias")
  variacao: Variacao | null;
  serie: Ponto[];
  resumo: string;              // rodapé; **negrito** vira destaque
  fonte: string | null;
};

export type Alerta = {
  tipo: "risco" | "atencao" | "bom";
  company_id: string | null;
  titulo: string;
  detalhe: string;
  verbo: string;
  bloco: BlocoId | null;
};

// Faixa do topo. Fora do contrato original: sem ela a tela só esconde a faixa.
export type Destaque = {
  id: string;
  rotulo: string;
  valor: string;
  variacao: Variacao | null;
  nota: string;
  serie: number[];
  tom?: Tom;                   // cor da sparkline
  bloco: BlocoId | null;
};

export type PainelHoje = {
  calculado_em: string;        // ISO
  proximo_calculo: string;     // ISO
  ao_vivo: boolean;
  fontes?: string[];
  destaques?: Destaque[];
  blocos: Bloco[];
  alertas: Alerta[];
};

// ── Detalhe (card expandido) ────────────────────────────────

export type Indicador = { rotulo: string; valor: string; nota?: string; tom?: Tom };

// Célula de lista: texto puro ou objeto quando carrega estado, loja ou ação.
export type Celula =
  | string
  | number
  | {
      texto: string;
      tom?: Tom;
      etiqueta?: boolean;
      company_id?: string;        // torna o nome clicável (abre a ficha)
      telefone?: string | null;   // loja: mostra o telefone com link do WhatsApp
      verbo?: boolean;
      primario?: boolean;
    };

export type Lista = {
  titulo: string;
  // "tabela" (padrão) ou "cartoes": uma coluna de cartões por loja, usada nos
  // degraus do trial. Nos cartões: célula 0 = loja, 1 = detalhe, demais = verbos.
  formato?: "tabela" | "cartoes";
  colunas: string[];
  linhas: Celula[][];
  total?: number;              // número ao lado do título (cartões)
  mais?: string;               // "+ 13 lojas"
  grupo?: string;              // listas do mesmo grupo ficam lado a lado
};

export type TipoGrafico = "barras" | "linha" | "funil" | "rosca" | "barras_h";

export type SerieDetalhe = {
  titulo: string;
  tipo: TipoGrafico;
  pontos: Ponto[];
  max?: number;
  legenda?: [string, string];  // linha de 2 séries (valor, valor2)
};

export type Insight = { texto: string; tom: "neutro" | "alerta" | "risco" };

export type BlocoDetalhe = {
  periodo?: number;            // dias; o seletor 7/30/90 refaz a chamada
  ao_vivo?: boolean;           // calculado na hora (período diferente do gravado)
  calculado_em?: string;       // ISO
  indicadores: Indicador[];
  listas: Lista[];
  series: SerieDetalhe[];
  insight: Insight | null;
};

// ── Ficha do cliente ────────────────────────────────────────

export type FichaCliente = {
  company_id: string;
  nome: string;
  telefone?: string | null;    // verbo WhatsApp
  alertas?: { tom: "neutro" | "alerta" | "risco"; texto: string }[];
  situacao: Variacao | null;
  resumo: string;
  indicadores: Indicador[];
  serie: { titulo: string; pontos: Ponto[] } | null;
  modulos: { nome: string; usa: boolean }[];
  linha_do_tempo: { data: string; texto: string }[];
  fontes: string;
};

// ── Catálogo ────────────────────────────────────────────────

export type ItemCatalogo = {
  id: BlocoId;
  titulo: string;
  fonte: string;
  aviso?: boolean;             // a fonte ainda não existe (texto em âmbar)
  em_construcao?: boolean;     // não dá para ligar
};
