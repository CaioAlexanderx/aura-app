// Tom das mensagens (24/10/2026): nenhum texto novo cita código HTTP,
// "servidor" nem manda a pessoa "verificar a internet" dela.
import { request, ApiError } from "@/services/api";
import * as M from "@/utils/mensagensDoApp";
import { TEXTO_ESCOPO_IMPORTACAO, TEXTO_ARQUIVO_VAZIO, textoDaImportacao, motivosDasLinhas } from "@/utils/importacaoLancamentos";
import { TEXTOS_TRIAL } from "@/utils/trialAviso";
import { TEXTOS_DO_MURO } from "@/utils/muroDeAssinatura";
import { fetchWeeklyReport } from "@/services/weeklyReportApi";
import { waAura } from "@/constants/suporteAura";
import { COMO_FUNCIONA_INDICACAO_BLACK_FRIDAY, MENSAGEM_INDICACAO_BLACK_FRIDAY, DESCRICAO_INDICACAO_BLACK_FRIDAY } from "@/utils/indicacaoCampanha";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

function resp(status: number, body: any) {
  return jest.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body }) as any;
}

const todos: string[] = [
  ...M.MENSAGENS_DO_APP,
  TEXTO_ESCOPO_IMPORTACAO,
  TEXTO_ARQUIVO_VAZIO,
  ...[
    textoDaImportacao({ saved: 12, error_count: 3, errors: [{ index: 4, errors: ["Linha 5: valor invalido 'x'"] }] }),
    textoDaImportacao({ saved: 0, error_count: 2, errors: [] }),
    textoDaImportacao({ saved: 0 }),
    textoDaImportacao({ saved: 1 }),
  ].flatMap((t) => [t.titulo, t.resumo]),
];

// 25/10/2026 (itens 8 a 12 e extras): fim do teste, muro, estados vazios e
// "Como funciona" da indicação.
const VAZIOS: M.EstadoVazio[] = [
  M.VAZIO_CUPONS,
  M.VAZIO_ATIVIDADES,
  M.vazioDeVendas({ periodo: "all", filtrando: false }),
  M.vazioDeVendas({ periodo: "month", mes: "outubro de 2026", filtrando: false }),
  M.vazioDeVendas({ periodo: "today", filtrando: false }),
  M.vazioDeVendas({ periodo: "week", filtrando: false }),
  M.vazioDeVendas({ periodo: "custom", filtrando: false }),
  M.vazioDeVendas({ periodo: "month", mes: "outubro de 2026", filtrando: true }),
];
const novos: string[] = [
  TEXTOS_TRIAL.urgente,
  TEXTOS_TRIAL.urgenteCaixaVivo,
  TEXTOS_TRIAL.semVendaFimCorpo,
  TEXTOS_TRIAL.semVendaFimTitulo(0),
  TEXTOS_TRIAL.semVendaFimTitulo(1),
  TEXTOS_TRIAL.semVendaFimTitulo(2),
  ...Object.values(TEXTOS_DO_MURO),
  ...VAZIOS.flatMap((v) => [v.titulo, v.texto, v.botao]),
  ...M.COMO_FUNCIONA_INDICACAO,
  ...COMO_FUNCIONA_INDICACAO_BLACK_FRIDAY,
  MENSAGEM_INDICACAO_BLACK_FRIDAY,
  DESCRICAO_INDICACAO_BLACK_FRIDAY,
];
todos.push(...novos);

describe("textos novos", () => {
  it.each(todos.map((t) => [t]))("sem HTTP, servidor nem 'Verifique sua internet': %s", (texto) => {
    expect(texto).not.toMatch(/HTTP/i);
    expect(texto).not.toMatch(/servidor/i);
    expect(texto).not.toMatch(/Verifique sua internet/i);
  });

  it("sem gênero na frase do acesso", () => {
    expect(M.MSG_SEM_CONEXAO_NA_SESSAO).toContain("você continua com acesso");
    expect(M.MSG_SEM_CONEXAO_NA_SESSAO).not.toMatch(/conectada|conectado/);
  });

  it("nunca promete 'para sempre' e o número do WhatsApp não vai solto no texto", () => {
    for (const t of [...M.MENSAGENS_DO_APP, ...novos]) {
      expect(t).not.toMatch(/para sempre/i);
      expect(t).not.toMatch(/\d{10,}/);
    }
  });
});

describe("request() no tom novo", () => {
  it("sem rede", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as any;
    const err: any = await request("/x", { retry: 0, token: null }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe(M.MSG_SEM_CONEXAO);
  });

  it("erro 500 sem texto assume a culpa, sem 'servidor'", async () => {
    global.fetch = resp(500, {});
    const err: any = await request("/x", { retry: 0, token: null }).catch((e) => e);
    expect(err.message).toBe(M.MSG_ERRO_NOSSO);
    expect(err.status).toBe(500);
  });

  it("erro 400 sem texto: sem código na mensagem, código só no ApiError e no console", async () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    global.fetch = resp(400, {});
    const err: any = await request("/x", { retry: 0, token: null }).catch((e) => e);
    expect(err.message).toBe(M.MSG_ERRO_SEM_EXPLICACAO);
    expect(err.message).not.toMatch(/400|HTTP/);
    expect(err.status).toBe(400);
    expect(aviso).toHaveBeenCalled();
  });

  it("mensagem do backend continua tendo prioridade", async () => {
    global.fetch = resp(422, { error: "CPF já cadastrado" });
    const err: any = await request("/x", { retry: 0, token: null }).catch((e) => e);
    expect(err.message).toBe("CPF já cadastrado");
  });

  it("tempo esgotado", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    global.fetch = jest.fn().mockRejectedValue(abort) as any;
    const err: any = await request("/x", { retry: 0, token: null }).catch((e) => e);
    expect(err.message).toBe(M.MSG_DEMOROU_DEMAIS);
    expect(err.code).toBe("timeout");
  });
});

describe("resultado da importação de lançamentos", () => {
  it("importou e deixou linhas de fora: resumo e motivos do backend", () => {
    const t = textoDaImportacao({
      saved: 12, error_count: 3,
      errors: [
        { index: 1, errors: ["Linha 2: tipo invalido 'x' (use 'income' ou 'expense')", "Linha 2: valor invalido ''"] },
        { index: 7, error: "duplicate key value violates unique constraint" },
        { index: 9, errors: ["Linha 10: data invalida 'abc' (use YYYY-MM-DD ou DD/MM/YYYY)"] },
      ],
    });
    expect(t.resumo).toBe("Importei 12 lançamentos. 3 linhas ficaram de fora, e aqui estão as primeiras com o motivo.");
    expect(t.motivos).toEqual([
      "Linha 2: tipo invalido 'x' (use 'income' ou 'expense')",
      "Linha 8: não conseguimos salvar esta linha",
      "Linha 10: data invalida 'abc' (use YYYY-MM-DD ou DD/MM/YYYY)",
    ]);
    expect(t.motivos.join(" ")).not.toMatch(/duplicate key/);
    expect(t.oferecerAjuda).toBe(true);
  });

  it("só mostra as primeiras linhas", () => {
    const errors = Array.from({ length: 20 }, (_, i) => ({ index: i, errors: ["Linha " + (i + 1) + ": valor invalido"] }));
    expect(motivosDasLinhas(errors)).toHaveLength(5);
  });

  it("tudo certo: só o resumo, sem convite", () => {
    const t = textoDaImportacao({ saved: 1, error_count: 0, errors: [] });
    expect(t.resumo).toBe("Importei 1 lançamento.");
    expect(t.motivos).toEqual([]);
    expect(t.oferecerAjuda).toBe(false);
  });

  it("0 válidos oferece ajuda", () => {
    const t = textoDaImportacao({ saved: 0, error_count: 4, errors: [{ index: 0, errors: ["Linha 1: tipo invalido 'x' (use 'income' ou 'expense')"] }] });
    expect(t.resumo).toContain("Não consegui importar nenhuma linha");
    expect(t.motivos).toHaveLength(1);
    expect(t.oferecerAjuda).toBe(true);
  });
});

describe("fim do teste e muro (itens 8 a 10)", () => {
  it.each(novos.map((t) => [t]))("sem ameaça nem cobrança: %s", (texto) => {
    expect(texto).not.toMatch(/não perder|bloquead|regularizad|ainda não fez|você não pagou/i);
  });

  it("o Caixa só aparece nos textos marcados para o shell Negócio", () => {
    expect(TEXTOS_TRIAL.urgente).not.toMatch(/Caixa/);
    expect(TEXTOS_TRIAL.urgenteCaixaVivo).toContain("O Caixa continua com você de qualquer jeito.");
    expect(TEXTOS_DO_MURO.teste).not.toMatch(/Caixa/);
    expect(TEXTOS_DO_MURO.inativa).not.toMatch(/Caixa/);
    expect(TEXTOS_DO_MURO.testeCaixaVivo).toContain("O Caixa segue liberado para você vender.");
    expect(TEXTOS_DO_MURO.inativaCaixaVivo).toContain("O Caixa segue liberado");
  });

  it("teste terminando sem venda: amanhã e a oferta de ajuda", () => {
    expect(TEXTOS_TRIAL.semVendaFimTitulo(1) + " " + TEXTOS_TRIAL.semVendaFimCorpo)
      .toBe("Seu teste termina amanhã. Se alguma coisa travou na primeira venda, a gente ajuda agora.");
  });
});

describe("pedido de ajuda no WhatsApp (itens 9 e 11)", () => {
  it("abre o WhatsApp da Aura pela constante central, com a mensagem pronta", () => {
    expect(M.MSG_PEDIDO_DE_AJUDA).toBe("Oi, preciso de ajuda com a minha conta da Aura.");
    expect(M.linkPedidoDeAjuda()).toBe(waAura(M.MSG_PEDIDO_DE_AJUDA));
    expect(M.linkPedidoDeAjuda()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });
});

describe("estados vazios (item 12)", () => {
  it.each(VAZIOS.map((v) => [v.titulo, v]))("uma frase que reconhece, uma que diz o que fazer e um botão: %s", (_t, v) => {
    const e = v as M.EstadoVazio;
    expect(e.titulo).toMatch(/[.?!]$/);
    expect(e.texto).toMatch(/[.?!]$/);
    expect(e.botao.length).toBeGreaterThan(0);
    expect(e.titulo).not.toMatch(/^Nenhum/);
  });

  it("cupom: o exemplo aprovado", () => {
    expect(M.VAZIO_CUPONS).toEqual({
      titulo: "Você ainda não criou nenhum cupom.",
      texto: "Que tal começar por um de boas-vindas?",
      botao: "Criar cupom",
    });
  });

  it("vendas: o botão segue o que está filtrando", () => {
    expect(M.vazioDeVendas({ periodo: "all", filtrando: false }).acao).toBe("caixa");
    expect(M.vazioDeVendas({ periodo: "month", mes: "outubro de 2026", filtrando: false })).toMatchObject({
      titulo: "Ainda não há vendas em outubro de 2026.", acao: "todas",
    });
    expect(M.vazioDeVendas({ periodo: "today", filtrando: false }).titulo).toBe("Ainda não há vendas hoje.");
    expect(M.vazioDeVendas({ periodo: "all", filtrando: true }).acao).toBe("limpar");
  });

  it("as telas usam os textos centrais", () => {
    const fs = jest.requireActual("fs");
    const p = jest.requireActual("path");
    const ler = (...a: string[]) => fs.readFileSync(p.join(__dirname, "..", ...a), "utf8");
    expect(ler("app", "(tabs)", "cupons.tsx")).toContain("title={VAZIO_CUPONS.titulo}");
    expect(ler("app", "(tabs)", "agentes.tsx")).toContain("title={VAZIO_ATIVIDADES.titulo}");
    expect(ler("app", "(tabs)", "vendas.tsx")).toContain("vazioDeVendas({");
    for (const f of ["cupons.tsx", "agentes.tsx", "vendas.tsx"]) {
      expect(ler("app", "(tabs)", f)).not.toMatch(/"Nenhum cupom criado"|"Nenhuma atividade ainda"|"Nenhuma venda encontrada"/);
    }
  });
});

describe("relatório da semana sem rede (extra 1)", () => {
  it("usa MSG_SEM_CONEXAO", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as any;
    const r = await fetchWeeklyReport("tok");
    expect(r).toEqual({ ok: false, error: { code: "network", message: M.MSG_SEM_CONEXAO } });
  });
});

describe("indicação: Como funciona (extra 2)", () => {
  it("as regras que o backend aplica hoje", () => {
    expect(M.COMO_FUNCIONA_INDICACAO).toEqual([
      "O mês grátis vale quando o lojista que você indicou paga a primeira mensalidade.",
      "Se você já assina a Aura, a sua próxima mensalidade a vencer sai por conta da Aura.",
      "Se você ainda está no teste, o mês grátis fica reservado por 60 dias a partir desse pagamento. Assinando nesse prazo, a sua segunda mensalidade sai por conta da Aura.",
      "Vale para até 3 indicações por ano, com a sua mensalidade em dia.",
    ]);
  });
});
