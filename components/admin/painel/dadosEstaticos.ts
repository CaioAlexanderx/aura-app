// ============================================================
// Gestão Aura › Hoje — dados estáticos (banco de 13/10/2026)
//
// Mesmos números do mockup aprovado (docs/mockups/gestao-aura-painel.html),
// no modelo da tela (tipos.ts). Só entram como fallback de desenvolvimento,
// atrás de PAINEL_FALLBACK_DEV em usePainelHoje.ts — nunca em produção.
// ============================================================
import type { BlocoDetalhe, BlocoId, FichaCliente, PainelHoje, Ponto } from "./tipos";

function pontos(rotulos: string[], valores: number[]): Ponto[] {
  return valores.map(function(v, i) { return { rotulo: rotulos[i] || "", valor: v }; });
}

// Única loja com ficha nos dados de exemplo.
export var SHEID = "sheid-mania";

export var PAINEL_HOJE: PainelHoje = {
  calculado_em: "2026-10-13T06:00:00-03:00",
  proximo_calculo: "2026-10-13T12:00:00-03:00",
  ao_vivo: false,
  fontes: ["banco Aura", "Asaas", "site"],
  destaques: [
    { id: "mrr", rotulo: "MRR real · Asaas", valor: "R$ 1.651", variacao: { texto: "+16%", tom: "sobe" }, nota: "em 30 dias", serie: [234, 516, 685, 826, 1417, 1651], bloco: "receita" },
    { id: "pagantes", rotulo: "Pagantes", valor: "18", variacao: { texto: "+2", tom: "sobe" }, nota: "Qbonita, Luciano", serie: [11, 12, 13, 14, 16, 18], bloco: "pagantes" },
    { id: "ativas", rotulo: "Lojas ativas na semana", valor: "28", variacao: { texto: "+3", tom: "sobe" }, nota: "15 de 18 pagantes", serie: [13, 12, 11, 11, 16, 19, 25, 28], tom: "teal", bloco: "acesso" },
    { id: "vendas", rotulo: "Vendas · 7 dias", valor: "259", variacao: { texto: "−4%", tom: "desce" }, nota: "vs semana anterior", serie: [229, 258, 270, 259], bloco: "plataforma" },
  ],
  alertas: [
    { tipo: "risco", company_id: SHEID, titulo: "Sheid Mania vence amanhã", detalhe: "Anual · sem venda há 22 dias · 3 logins no mês", verbo: "Ligar", bloco: "pagantes_sem_venda" },
    { tipo: "atencao", company_id: null, titulo: "3 trials com venda vencem em 48h", detalhe: "Vitor Matheus · Ana Lourdes · Luís Henrique", verbo: "Oferecer", bloco: "trials_degrau" },
    { tipo: "bom", company_id: null, titulo: "R$ 140,83 recebido ontem", detalhe: "Asaas · sem loja vinculada", verbo: "Vincular", bloco: "receita" },
  ],
  blocos: [
    {
      id: "trials_degrau", valor: 29, legenda: "cadastros", variacao: { texto: "6 vencidos", tom: "alerta" },
      serie: [
        { rotulo: "Cadastraram", valor: 29 },
        { rotulo: "Com produtos", valor: 16, texto: "55%" },
        { rotulo: "Venderam", valor: 7, texto: "24%" },
        { rotulo: "Viram checkout", valor: 0, texto: "desde hoje" },
        { rotulo: "Assinaram", valor: 2, texto: "7%", tom: "teal" },
      ],
      resumo: "Checkout instrumentado em **13/10**", fonte: "clients-360",
    },
    {
      id: "receita", valor: "R$ 1.651", legenda: "em 30 dias", variacao: { texto: "+R$ 234", tom: "sobe" },
      serie: pontos(["Mai", "Jun", "Jul", "Ago", "Set", "Out"], [234, 516, 685, 826, 1417, 1651]),
      resumo: "Recebido em outubro **R$ 281,66** · método antigo: R$ 2.872", fonte: "Asaas",
    },
    {
      id: "cadastros", valor: 11, legenda: "em 7 dias", variacao: { texto: "+2", tom: "sobe" },
      serie: pontos(["31/08", "07/09", "14/09", "21/09", "28/09", "05/10", "12/10"], [1, 1, 15, 4, 9, 9, 3]),
      resumo: "**9** self-service · **2** por código", fonte: null,
    },
    {
      id: "pagantes", valor: 18, legenda: "ativos", variacao: { texto: "+2 · 30d", tom: "sobe" },
      serie: [
        { rotulo: "Negócio", valor: 12, texto: "10 anual" },
        { rotulo: "Essencial", valor: 5, texto: "2 anual", tom: "teal" },
        { rotulo: "Expansão", valor: 1, texto: "interno", tom: "claro" },
      ],
      resumo: "Vencem esta semana: **Sheid, Jenniffer**", fonte: null,
    },
    {
      id: "pagantes_sem_venda", valor: 7, legenda: "de 18, há mais de 7 dias", variacao: null,
      serie: [
        { rotulo: "Fernanda Rangel", valor: 56, texto: "56 d", tom: "desce" },
        { rotulo: "Sheid Mania", valor: 22, texto: "22 d", tom: "desce" },
        { rotulo: "Federação Paulista", valor: 90, texto: "nunca", tom: "claro" },
        { rotulo: "3 dojôs JKA", valor: 90, texto: "nunca", tom: "claro" },
      ],
      resumo: "Dojôs e Federação não usam o Caixa", fonte: null,
    },
    {
      id: "acesso", valor: "15/18", legenda: "pagantes entraram em 30 dias", variacao: { texto: "3 nunca entraram", tom: "alerta" },
      serie: [
        { rotulo: "17/08", valor: 13, valor2: 11 }, { rotulo: "", valor: 12, valor2: 10 },
        { rotulo: "31/08", valor: 11, valor2: 10 }, { rotulo: "", valor: 11, valor2: 10 },
        { rotulo: "14/09", valor: 16, valor2: 12 }, { rotulo: "", valor: 19, valor2: 14 },
        { rotulo: "28/09", valor: 25, valor2: 15 }, { rotulo: "05/10", valor: 28, valor2: 15 },
      ],
      resumo: "Lojas com login na semana", fonte: "audit_log",
    },
    {
      id: "uso_funcionalidade", valor: 4, legenda: "módulos com uso amplo · 10 de nicho", variacao: null,
      serie: [
        { rotulo: "Estoque", valor: 22 }, { rotulo: "Clientes", valor: 22 },
        { rotulo: "Caixa", valor: 17 }, { rotulo: "Crediário", valor: 14 },
        { rotulo: "Abertura de caixa", valor: 9, tom: "claro" }, { rotulo: "Importação", valor: 4, tom: "claro" },
        { rotulo: "Aura Notas", valor: 3, tom: "claro" }, { rotulo: "Ordens de serviço", valor: 3, tom: "claro" },
      ],
      resumo: "Base: **40** lojas com login no período", fonte: "tabelas por módulo",
    },
    {
      id: "horario", valor: "16h", legenda: "pico · 123 vendas", variacao: null,
      serie: pontos(
        ["8", "", "10", "", "12", "", "14", "", "16", "", "18", "", "20", "", "22"],
        [4, 16, 59, 82, 70, 75, 93, 76, 123, 104, 73, 50, 8, 2, 11],
      ).map(function(p) { return p.valor === 123 ? { ...p, tom: "teal" as const } : p; }),
      resumo: "Janela segura para deploy: **antes das 9h**", fonte: null,
    },
    {
      id: "plataforma", valor: 17, legenda: "vendas ontem", variacao: { texto: "canary ok", tom: "sobe" },
      serie: pontos(
        ["29", "", "1/10", "", "", "", "5", "", "", "", "", "10", "", "12"],
        [32, 29, 43, 38, 38, 1, 32, 17, 57, 48, 41, 76, 3, 17],
      ).map(function(p, i) { return i === 13 ? { ...p, tom: "teal" as const } : p; }),
      resumo: "Recorde: **76** na sexta 10/10", fonte: null,
    },
    {
      id: "adocao", valor: null, variacao: null,
      serie: [
        { rotulo: "Caixa", valor: 14, texto: "14/18" }, { rotulo: "Estoque", valor: 14, texto: "14/18" },
        { rotulo: "Clientes", valor: 13, texto: "13/18" }, { rotulo: "Crediário", valor: 10, texto: "10/18" },
        { rotulo: "Aura Notas", valor: 3, texto: "3/18", tom: "alerta" },
        { rotulo: "Relatórios", valor: 3, texto: "3/18", tom: "alerta" },
        { rotulo: "Vitrine", valor: 2, texto: "2/18", tom: "desce" },
      ],
      resumo: "NFC-e: **3** lojas emitem, **15** não", fonte: null,
    },
    {
      id: "fiscal", valor: 1, legenda: "rejeitada de 53 emitidas", variacao: { texto: "98%", tom: "sobe" },
      serie: pontos(["ter", "qua", "qui", "sex", "sáb", "dom", "seg"], [6, 9, 7, 11, 8, 0, 12])
        .map(function(p) { return { ...p, tom: "teal" as const }; }),
      resumo: "Certificados a vencer em 30 dias: **0**", fonte: null,
    },
    {
      id: "crediario", valor: 361, legenda: "parcelas em 11 lojas", variacao: null,
      serie: [
        { rotulo: "Jenniffer Rocha", valor: 107 }, { rotulo: "Maria Eduarda", valor: 80 },
        { rotulo: "Valen Eletrônicos", valor: 63 }, { rotulo: "Fernanda Rangel", valor: 31 },
        { rotulo: "Finesse", valor: 28 }, { rotulo: "outras 6", valor: 52, tom: "claro" },
      ],
      resumo: "Argumento para a **régua de cobrança**", fonte: null,
    },
    {
      id: "contatos", valor: 2, legenda: "na semana", variacao: { texto: "0 sem resposta", tom: "sobe" },
      serie: pontos(["31/08", "", "", "", "", "", "12/10"], [1, 0, 2, 1, 0, 3, 2]),
      resumo: "Último: **sáb 11/10**, formulário do site", fonte: null,
    },
    {
      id: "frentes", valor: null, variacao: null,
      serie: [
        { rotulo: "Varejo", valor: 3, texto: "3 trials" }, { rotulo: "Matcon", valor: 3, texto: "2 pag · 1" },
        { rotulo: "Karatê", valor: 9, texto: "9 dojôs", tom: "teal" }, { rotulo: "Ótica", valor: 1, texto: "1 trial" },
        { rotulo: "Assistência", valor: 1, texto: "1 trial" }, { rotulo: "Studio", valor: 1, texto: "1 pag" },
      ],
      resumo: "**29** trials sem frente atribuída", fonte: null,
    },
  ],
};

// ── Detalhes (GET /admin/painel/blocos/:id) ─────────────────

var LOJA_SHEID = { texto: "Sheid Mania", company_id: SHEID };
function tag(texto: string, tom: "sobe" | "desce" | "alerta" | "mudo") { return { texto: texto, tom: tom, etiqueta: true }; }
function verbo(texto: string, primario?: boolean) { return { texto: texto, verbo: true, primario: !!primario }; }
function vencido(texto: string) { return { texto: texto, tom: "desce" as const }; }

export var DETALHES: Partial<Record<BlocoId, BlocoDetalhe>> = {
  trials_degrau: {
    indicadores: [],
    series: [],
    insight: { tom: "neutro", texto: "**13 de 29** nunca cadastraram um produto. É o degrau da importação por planilha e da Aurinha de boas-vindas. Os **5 que venderam** são as ligações de hoje." },
    listas: [
      {
        titulo: "Só cadastro", formato: "cartoes", grupo: "degraus", total: 13, colunas: ["Loja", "Situação"], mais: "+ 9 contas",
        linhas: [
          ["Infortech Group", "há 3 dias · vence 17/10", verbo("WhatsApp"), verbo("+7 dias")],
          ["Rolão Mat. Construção", "matcon · vence 14/10", verbo("WhatsApp")],
          ["Technocell", vencido("vencido 12/10")],
          ["Pefect House", vencido("vencido 05/10 · negociando")],
        ],
      },
      {
        titulo: "Com produtos", formato: "cartoes", grupo: "degraus", total: 9, colunas: ["Loja", "Situação"], mais: "+ 6 contas",
        linhas: [
          ["Nalia Miranda", "152 produtos · vence 15/10", verbo("Chamar para o Caixa")],
          ["Kauinny Santo", "94 produtos · vence hoje", verbo("Ligar"), verbo("+7 dias")],
          ["Jéssica Costa", "152 produtos · vence hoje", verbo("Ligar")],
        ],
      },
      {
        titulo: "Venderam", formato: "cartoes", grupo: "degraus", total: 5, colunas: ["Loja", "Situação"],
        linhas: [
          ["Vitor Matheus", "3 vendas · vence 18/10", verbo("Oferecer plano", true)],
          ["Ana Lourdes · Ótica", "3 vendas · vence 15/10", verbo("Oferecer plano", true)],
          ["Luís Henrique", "11 vendas · vence 14/10", verbo("Oferecer plano", true)],
          ["GF Amorim", vencido("52 vendas · vencido 02/10 · Caixa vivo")],
          ["Vera Modas", vencido("6 vendas · vencido 21/09")],
        ],
      },
      { titulo: "Viram checkout", formato: "cartoes", grupo: "degraus", total: 0, colunas: ["Loja", "Situação"], linhas: [], mais: "Conta a partir de hoje" },
      {
        titulo: "Assinaram", formato: "cartoes", grupo: "degraus", total: 2, colunas: ["Loja", "Situação"],
        linhas: [
          ["Qbonita", "Negócio anual · 57 vendas"],
          ["Luciano Messias", "Essencial anual · matcon"],
        ],
      },
    ],
  },
  receita: {
    indicadores: [
      { rotulo: "Setembro", valor: "R$ 1.227", nota: "9 pagamentos" },
      { rotulo: "Outubro", valor: "R$ 282", nota: "2 até dia 12" },
      { rotulo: "Atrasado", valor: "R$ 0", nota: "30 dias" },
      { rotulo: "Ticket médio", valor: "R$ 138", nota: "por assinatura" },
    ],
    series: [
      {
        titulo: "Movimento do MRR · 30 dias", tipo: "barras_h",
        pontos: [
          { rotulo: "Início 12/09", valor: 1417, texto: "1.417" },
          { rotulo: "Novos", valor: 234, texto: "+234", tom: "teal" },
          { rotulo: "Upgrades", valor: 0, texto: "0" },
          { rotulo: "Cancelados", valor: 0, texto: "0", tom: "desce" },
          { rotulo: "Hoje", valor: 1651, texto: "1.651" },
        ],
      },
      {
        titulo: "Por plano e ciclo", tipo: "rosca",
        pontos: [
          { rotulo: "Negócio anual", valor: 8, texto: "R$ 1.127" },
          { rotulo: "Negócio mensal", valor: 2, texto: "R$ 338", tom: "claro" },
          { rotulo: "Essencial anual", valor: 2, texto: "R$ 186", tom: "teal" },
        ],
      },
    ],
    listas: [
      {
        titulo: "Conciliação com o banco", colunas: ["Mês", "Asaas", "Banco", ""],
        linhas: [
          ["Agosto", 1108, 1108, tag("fechou", "sobe")],
          ["Setembro", 1227, "—", tag("sem extrato", "alerta")],
          ["Outubro", 282, "—", tag("em curso", "mudo")],
        ],
      },
    ],
    insight: { tom: "alerta", texto: "**3 pagamentos sem loja vinculada** (29/09, 03/10, 12/10) e **3 assinaturas** com próximo vencimento no passado. O cálculo mostra, não esconde." },
  },
  cadastros: {
    indicadores: [], listas: [], insight: null,
    series: [
      {
        titulo: "Origem · 30 dias", tipo: "barras_h",
        pontos: [
          { rotulo: "Site (self-service)", valor: 24 },
          { rotulo: "Código de convite", valor: 4, tom: "teal" },
          { rotulo: "Gestão Aura", valor: 1, tom: "claro" },
        ],
      },
      {
        titulo: "Frente escolhida", tipo: "barras_h",
        pontos: [
          { rotulo: "Sem frente", valor: 29, tom: "claro" }, { rotulo: "Varejo", valor: 3 },
          { rotulo: "Outro", valor: 2 }, { rotulo: "Matcon", valor: 1 },
          { rotulo: "Ótica", valor: 1 }, { rotulo: "Assistência", valor: 1 },
        ],
      },
    ],
  },
  pagantes: {
    indicadores: [], series: [], insight: null,
    listas: [
      {
        titulo: "Pagantes por vencimento", colunas: ["Loja", "Plano", "Ciclo", "Vence", "Vendas 30d", "Dias ativos"], mais: "+ 13 lojas",
        linhas: [
          [LOJA_SHEID, "Negócio", "Anual", tag("13/10", "desce"), 9, 3],
          ["Jenniffer Rocha", "Negócio", "Anual", "19/10", 89, 21],
          ["Davi Calçados Matriz", "Negócio", "Anual", "23/10", 43, 23],
          ["Finesse", "Negócio", "Anual", tag("08/08?", "alerta"), 368, 26],
          ["Encanto Presentes", "Essencial", "Anual", tag("15/09?", "alerta"), 75, 26],
        ],
      },
    ],
  },
  pagantes_sem_venda: {
    indicadores: [], series: [], listas: [],
    insight: { tom: "risco", texto: "**Sheid Mania** e **Fernanda Rangel** são anuais sem uso: o churn que dá para evitar antes da renovação." },
  },
  acesso: {
    indicadores: [
      { rotulo: "Logins · 30d", valor: "838", nota: "40 lojas" },
      { rotulo: "Dias ativos · mediana", valor: "19", nota: "pagantes, de 30" },
      { rotulo: "Login falhou", valor: "96", nota: "30 dias" },
      { rotulo: "Trocas de loja", valor: "648", nota: "6 grupos multi-CNPJ" },
    ],
    series: [
      {
        titulo: "Dias ativos por pagante · 30 dias", tipo: "barras_h", max: 30,
        pontos: [
          { rotulo: "Finesse", valor: 26 }, { rotulo: "Valen Eletrônicos", valor: 26 },
          { rotulo: "Encanto Presentes", valor: 26 }, { rotulo: "Maria Eduarda", valor: 24 },
          { rotulo: "Davi Matriz", valor: 23 }, { rotulo: "Jenniffer Rocha", valor: 21 },
          { rotulo: "Fernanda Rangel", valor: 19 }, { rotulo: "MHT Alimentos", valor: 16 },
          { rotulo: "Federação Paulista", valor: 13 }, { rotulo: "Qbonita", valor: 11 },
          { rotulo: "Davi Villa Branca", valor: 8, tom: "alerta" }, { rotulo: "Luciano Messias", valor: 5, tom: "alerta" },
          { rotulo: "Sheid Mania", valor: 3, tom: "desce" }, { rotulo: "3 dojôs JKA", valor: 0, texto: "0", tom: "desce" },
        ],
      },
    ],
    listas: [
      {
        titulo: "Quem não entra", colunas: ["Loja", "Plano", "Último login", ""],
        linhas: [
          ["Shobukan São Paulo", "Essencial", "nunca", tag("dojô", "mudo")],
          ["Bassai Dai Academia", "Essencial", "nunca", tag("dojô", "mudo")],
          ["Kano Dojo", "Essencial", "nunca", tag("dojô", "mudo")],
          [LOJA_SHEID, "Negócio", "08/10", tag("3 dias no mês", "desce")],
          ["Luciano Messias", "Essencial", "12/10", tag("5 dias, novo", "alerta")],
        ],
      },
    ],
    insight: { tom: "neutro", texto: "Os 3 dojôs são contas do Karatê sem Caixa: medir por **atletas cadastrados**, não por login." },
  },
  uso_funcionalidade: {
    indicadores: [],
    series: [
      {
        titulo: "Menos usados · oportunidade ou ruído", tipo: "barras_h", max: 40,
        pontos: [
          { rotulo: "Studio pedidos", valor: 3, tom: "alerta" }, { rotulo: "Relatórios por e-mail", valor: 3, tom: "alerta" },
          { rotulo: "Orçamentos Matcon", valor: 3, tom: "alerta" }, { rotulo: "Vitrine", valor: 2, tom: "alerta" },
          { rotulo: "WhatsApp", valor: 1, tom: "desce" }, { rotulo: "Studio orçamentos", valor: 1, tom: "desce" },
          { rotulo: "Compras Matcon", valor: 1, tom: "desce" }, { rotulo: "Etiquetas", valor: 0, texto: "?", tom: "claro" },
        ],
      },
    ],
    listas: [
      {
        titulo: "Por módulo", colunas: ["Módulo", "Lojas 7d", "Lojas 30d", "Eventos 30d", "Já usaram"],
        linhas: [
          ["Estoque", 15, 22, "5.881", 30], ["Clientes", 14, 22, 824, 27],
          ["Caixa", 14, 17, 854, 18], ["Crediário", 12, 14, "1.174", 16],
          ["Abertura de caixa", 7, 9, 55, 14], ["Importação", 2, 4, 11, 9],
          ["Aura Notas", 3, 3, 55, 3], ["Vitrine", 0, 2, 11, 6],
        ],
      },
    ],
    insight: { tom: "alerta", texto: "Hoje o uso é inferido pelas **tabelas de cada módulo**. Telas só de leitura (Relatórios, Painel, Etiquetas) ficam invisíveis até o app registrar **evento de navegação**." },
  },
  horario: {
    indicadores: [], series: [], listas: [],
    insight: { tom: "neutro", texto: "**86%** das vendas entre 10h e 18h. Deploy, migração e manutenção fora dessa janela." },
  },
  plataforma: {
    indicadores: [
      { rotulo: "Lojas vendendo · 24h", valor: "5" },
      { rotulo: "Venda sintética", valor: "ok", nota: "há 4 min", tom: "sobe" },
      { rotulo: "Erros 5xx · 24h", valor: "0" },
      { rotulo: "Incidentes · 30d", valor: "1", nota: "build mudo 11/10" },
    ],
    series: [], listas: [], insight: null,
  },
  adocao: {
    indicadores: [], series: [], listas: [],
    insight: { tom: "neutro", texto: "**Aura Notas** e **Relatórios por e-mail** têm 3 lojas cada. Ou o recurso não é encontrado, ou não é necessário: a resposta vem da próxima ligação de ativação." },
  },
  fiscal: {
    indicadores: [], series: [], insight: null,
    listas: [
      {
        titulo: "NFC-e por loja", colunas: ["Loja", "Emitidas", "Rejeitadas", "Último motivo"],
        linhas: [
          ["Finesse", 41, 1, "CFOP inválido"],
          ["Encanto", 9, 0, "—"],
          ["Davi Matriz", 3, 0, "—"],
        ],
      },
    ],
  },
  crediario: {
    indicadores: [], series: [], listas: [],
    insight: { tom: "neutro", texto: "Jenniffer e Maria Eduarda somam **52%** do atraso da plataforma. Piloto da régua de WhatsApp começa por elas." },
  },
  contatos: {
    indicadores: [], series: [], insight: null,
    listas: [
      {
        titulo: "Contatos recentes", colunas: ["Quando", "Quem", "Canal", "Status"],
        linhas: [
          ["11/10 14:20", "Talita Franklim", "site", tag("respondido", "sobe")],
          ["08/10 09:05", "Nalia Miranda", "site", tag("respondido", "sobe")],
        ],
      },
    ],
  },
  frentes: {
    indicadores: [], series: [], listas: [],
    insight: { tom: "alerta", texto: "A frente só nasce no cadastro desde 06/10. As contas anteriores precisam de atribuição pela Gestão Aura." },
  },
};

// ── Ficha (GET /admin/painel/clientes/:cid/ficha) ───────────

export var FICHAS: Record<string, FichaCliente> = {
  [SHEID]: {
    company_id: SHEID,
    nome: "Sheid Mania Personalizados",
    situacao: { texto: "risco", tom: "desce" },
    resumo: "Negócio anual · pagante desde 06/06 · Studio · vence amanhã",
    indicadores: [
      { rotulo: "Última venda", valor: "21/09", nota: "22 dias" },
      { rotulo: "Dias ativos · 30d", valor: "3", nota: "último login 08/10" },
      { rotulo: "Vendas · 30d", valor: "9", nota: "79 no total" },
      { rotulo: "Asaas", valor: "pago", nota: "14/09 · R$ 140,83" },
    ],
    serie: {
      titulo: "Vendas por semana · 12 semanas",
      pontos: pontos(["jul", "", "", "", "ago", "", "", "", "set", "", "", "out"], [9, 7, 8, 6, 5, 8, 4, 3, 2, 0, 0, 0]),
    },
    modulos: [
      { nome: "Caixa", usa: true }, { nome: "Estoque", usa: true }, { nome: "Studio pedidos", usa: true },
      { nome: "Crediário", usa: false }, { nome: "Aura Notas", usa: false }, { nome: "Vitrine", usa: false },
    ],
    linha_do_tempo: [
      { data: "13/10", texto: "Aparece em **Pagantes sem venda**, **Pagantes · vence** e **Acesso · quem não entra**" },
      { data: "21/09", texto: "Última venda · Asaas apagou 2 cobranças" },
      { data: "14/09", texto: "Pagamento recebido" },
    ],
    fontes: "sales, audit_log, Asaas",
  },
};

// Layout padrão: tudo que tem número hoje (o catálogo mora em blocos.ts).
export var LAYOUT_PADRAO: BlocoId[] = PAINEL_HOJE.blocos.map(function(b) { return b.id; });
