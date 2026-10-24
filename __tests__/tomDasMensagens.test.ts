// Tom das mensagens (24/10/2026): nenhum texto novo cita código HTTP,
// "servidor" nem manda a pessoa "verificar a internet" dela.
import { request, ApiError } from "@/services/api";
import * as M from "@/utils/mensagensDoApp";
import { TEXTO_ESCOPO_IMPORTACAO, TEXTO_ARQUIVO_VAZIO, textoDaImportacao, motivosDasLinhas } from "@/utils/importacaoLancamentos";

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
    for (const t of M.MENSAGENS_DO_APP) {
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
