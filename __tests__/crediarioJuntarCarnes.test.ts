// ============================================================
// Crediário · juntar carnês: regras puras (10/10/2026, Aura-backend#803)
//
//   - só entra na junção o que tem saldo;
//   - o plano da seleção sai na ordem da lista, com "general" para o grupo
//     sem carnê, e só "pode juntar" de 2 em diante;
//   - o botão diz quantos carnês, quantas parcelas e o valor do preview;
//   - cada código de erro vira uma frase; 404 sem código = ainda indisponível;
//   - a query do preview segue o contrato (ids separados por vírgula).
// ============================================================
import {
  carnesParaJuntar, planoDaSelecao, rotuloDoBotaoDeJuntar, mensagemErroJuncao,
  juncaoIndisponivel, MSG_JUNCAO_INDISPONIVEL, umMesDepois, INTERVALOS_DA_JUNCAO, derivarCarne,
} from "@/utils/crediarioCarne";

jest.mock("@/services/api", () => ({ request: jest.fn(() => Promise.resolve({})) }));
import { request } from "@/services/api";
import { mergeApi, mergePreviewQuery } from "@/services/creditMerge";

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");

const A = derivarCarne({ id: "c1", name: "Compra de 13/09", balance: 140, remaining: 140, total_count: 4, paid_count: 2,
  purchases: [{ description: "Vans", quantity: 1, amount: 120 }, { description: "Slide", quantity: 2, amount: 160 }] }, []);
const B = derivarCarne({ id: "c2", name: "Compra de 14/09", balance: 180, remaining: 180, total_count: 4, paid_count: 1,
  purchases: [{ description: "Sapatênis", quantity: 1, amount: 240 }] }, []);
const GERAL = derivarCarne({ id: null, name: "Conta geral", balance: 85.5, remaining: 85.5, total_count: 0, paid_count: 0, purchases: [] }, []);
const PAGO = derivarCarne({ id: "c3", name: "Compra de 02/08", balance: 0, remaining: 0, total_count: 2, paid_count: 2, purchases: [] }, []);

describe("carnesParaJuntar", () => {
  it("deixa de fora o que não tem saldo", () => {
    expect(carnesParaJuntar([A, PAGO, B, GERAL]).map(c => c.key)).toEqual(["c1", "c2", "general"]);
  });
});

describe("planoDaSelecao", () => {
  const lista = [A, B, GERAL];

  it("nada marcado: não pode juntar", () => {
    expect(planoDaSelecao(lista, [])).toEqual({ accountIds: [], quantidade: 0, total: 0, produtos: 0, podeJuntar: false });
  });

  it("um só: não pode (é caso de Renegociar)", () => {
    const p = planoDaSelecao(lista, ["c2"]);
    expect(p.podeJuntar).toBe(false);
    expect(p.total).toBe(180);
  });

  it("dois ou mais: soma o que falta e conta os produtos", () => {
    const p = planoDaSelecao(lista, ["c1", "c2"]);
    expect(p).toEqual({ accountIds: ["c1", "c2"], quantidade: 2, total: 320, produtos: 3, podeJuntar: true });
  });

  it("grupo sem carnê vai como 'general', e a ordem é a da lista, não a do clique", () => {
    const p = planoDaSelecao(lista, new Set(["general", "c2", "c1"]));
    expect(p.accountIds).toEqual(["c1", "c2", "general"]);
    expect(p.total).toBe(405.5);
  });

  it("chave que não está na lista é ignorada", () => {
    expect(planoDaSelecao(lista, ["c1", "fantasma"]).quantidade).toBe(1);
  });
});

describe("rotuloDoBotaoDeJuntar", () => {
  it("menos de 2 pede para marcar", () => {
    expect(rotuloDoBotaoDeJuntar(1, 4, 80, fmt)).toBe("Marque pelo menos 2 carnês");
  });
  it("com o preview: quantos, em quantas, de quanto", () => {
    expect(rotuloDoBotaoDeJuntar(2, 4, 80, fmt)).toBe("Juntar 2 carnês em 4× de R$ 80,00");
  });
  it("sem o preview ainda: sem valor inventado", () => {
    expect(rotuloDoBotaoDeJuntar(3, 6, null, fmt)).toBe("Juntar 3 carnês em 6×");
  });
});

describe("mensagemErroJuncao", () => {
  const erro = (status: number, code?: string, error = "x") => ({ status, data: { code, error } });

  it.each([
    ["MERGE_NEEDS_TWO", 400, /pelo menos 2/],
    ["INVALID_INSTALLMENTS", 400, /parcelas/],
    ["INVALID_TOTAL", 400, /maior que zero/],
    ["INVALID_FIRST_DUE_DATE", 400, /primeiro vencimento/],
    ["CUSTOMER_NOT_FOUND", 404, /cliente/i],
    ["CREDIT_ACCOUNT_NOT_FOUND", 404, /não existe mais/],
    ["CREDIT_ACCOUNT_CLOSED", 409, /quitado ou encerrado/],
    ["NOTHING_OPEN", 422, /nada em aberto/],
    ["CREDIARIO_DISABLED", 403, /desligado/],
  ])("%s vira frase própria", (code, status, re) => {
    expect(mensagemErroJuncao(erro(status as number, code as string))).toMatch(re as RegExp);
  });

  it("404 sem código conhecido = backend antigo, função ainda indisponível", () => {
    expect(juncaoIndisponivel({ status: 404, data: { error: "Not found" } })).toBe(true);
    expect(mensagemErroJuncao({ status: 404, data: null })).toBe(MSG_JUNCAO_INDISPONIVEL);
    // 404 COM código é carnê/cliente que sumiu, não rota inexistente.
    expect(juncaoIndisponivel(erro(404, "CREDIT_ACCOUNT_NOT_FOUND"))).toBe(false);
  });

  it("sem conexão manda conferir antes de repetir", () => {
    expect(mensagemErroJuncao({ status: 0, isNetworkError: true })).toMatch(/Sem conexão/);
  });

  it("erro desconhecido usa o texto do servidor, ou o genérico", () => {
    expect(mensagemErroJuncao({ status: 400, data: { error: "Algo específico" } })).toBe("Algo específico");
    expect(mensagemErroJuncao(null)).toMatch(/Não foi possível juntar/);
  });
});

describe("umMesDepois e intervalos", () => {
  it("mesmo dia no mês seguinte; vira o ano; mês curto cai no último dia", () => {
    expect(umMesDepois("2026-10-10")).toBe("2026-11-10");
    expect(umMesDepois("2026-12-15")).toBe("2027-01-15");
    expect(umMesDepois("2027-01-31")).toBe("2027-02-28");
  });
  it("mensal, quinzenal e semanal como nas Configurações do Crediário", () => {
    expect(INTERVALOS_DA_JUNCAO.map(i => [i.key, i.period_unit, i.period_count])).toEqual([
      ["mensal", "month", 1], ["quinzenal", "week", 2], ["semanal", "week", 1],
    ]);
  });
});

describe("mergeApi", () => {
  const OPTS = {
    account_ids: ["c1", "c2", "general"], installments: 3, first_due_date: "2026-11-10",
    period_unit: "month" as const, period_count: 1,
  };
  beforeEach(() => (request as jest.Mock).mockClear());

  it("preview: ids separados por vírgula, sem total quando ninguém ajustou", () => {
    expect(mergePreviewQuery(OPTS)).toBe(
      "account_ids=c1,c2,general&installments=3&first_due_date=2026-11-10&period_unit=month&period_count=1");
    expect(mergePreviewQuery({ ...OPTS, total: 400 })).toContain("&total=400");
    mergeApi.preview("emp", "cli", OPTS);
    expect((request as jest.Mock).mock.calls[0][0]).toBe(
      "/companies/emp/credit/customers/cli/accounts/merge/preview?" + mergePreviewQuery(OPTS));
  });

  it("apply: POST com o corpo do contrato e a Idempotency-Key recebida", () => {
    mergeApi.apply("emp", "cli", { ...OPTS, total: 400 }, "merge-chave-1");
    const [path, o] = (request as jest.Mock).mock.calls[0];
    expect(path).toBe("/companies/emp/credit/customers/cli/accounts/merge");
    expect(o.method).toBe("POST");
    expect(o.body).toEqual({ ...OPTS, total: 400 });
    expect(o.headers).toEqual({ "Idempotency-Key": "merge-chave-1" });
  });

  it("apply sem ajuste não manda total", () => {
    mergeApi.apply("emp", "cli", OPTS, "k");
    expect("total" in (request as jest.Mock).mock.calls[0][1].body).toBe(false);
  });
});
