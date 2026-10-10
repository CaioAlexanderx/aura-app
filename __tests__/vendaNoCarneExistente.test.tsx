// ============================================================
// Caixa · venda no crediário e carnês por compra (10/10/2026, Aura-backend#803)
//
//   - sem escolha, o POST /pdv/sale NÃO manda credit_account_id: o backend
//     cria o carnê da venda;
//   - quando a lojista escolhe juntar a um carnê existente, o campo vai —
//     mesmo com installments=1 (o /unify monta o cronograma depois);
//   - venda sem parte no crediário nunca manda o campo;
//   - os dois 422 novos viram mensagem clara, dizendo que a venda não entrou;
//   - o hook do Caixa manda o carnê E continua chamando o /unify.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" }, isDemo: false }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));

const mockBodies: any[] = [];
let mockFalha: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (body: any, cb: any) => {
      mockBodies.push(body);
      if (mockFalha) cb?.onError?.(mockFalha);
      else cb?.onSuccess?.({ sale: { id: "venda-1", sale_number: 9 }, credit: { account_id: "c1", account_name: "Compra de 10/10", account_created: true } });
    },
  }),
}));

import { toast } from "@/components/Toast";
import { useCart } from "@/hooks/useCart";
import { mensagemErroCarneDaVenda } from "@/utils/crediarioCarne";

let api: ReturnType<typeof useCart>;
function Harness() { api = useCart(); return null; }

/** O body que foi para o POST (o mutate recebe { companyId, body } ou o body). */
function saleBody(): any {
  const b = mockBodies[mockBodies.length - 1];
  return b?.body ?? b?.data ?? b;
}

function carrinhoNoCrediario() {
  act(() => { renderer.create(<Harness />); });
  act(() => { api.addToCart({ id: "tenis", name: "Vans Hylane", price: 220 }); });
  act(() => { api.selectCustomer("cli-1", "Alexander", null); api.setPayment("crediario"); });
}

beforeEach(() => { mockBodies.length = 0; mockFalha = null; jest.clearAllMocks(); });

describe("POST /pdv/sale e o carnê da venda", () => {
  test("padrão (sem escolha): não manda credit_account_id", () => {
    carrinhoNoCrediario();
    act(() => { api.finalizeSale(undefined, { installments: 3, first_due_date: "2026-11-10" }); });
    const body = saleBody();
    expect(body.installments).toBe(3);
    expect("credit_account_id" in body).toBe(false);
  });

  test("juntar a um carnê existente: manda o carnê, mesmo em 1x", () => {
    carrinhoNoCrediario();
    act(() => { api.finalizeSale(undefined, { installments: 1, first_due_date: "2026-11-10", credit_account_id: "carne-9" }); });
    const body = saleBody();
    expect(body.credit_account_id).toBe("carne-9");
    expect("installments" in body).toBe(false);
  });

  test("venda sem crediário nunca manda carnê", () => {
    act(() => { renderer.create(<Harness />); });
    act(() => { api.addToCart({ id: "tenis", name: "Vans Hylane", price: 220 }); });
    act(() => { api.finalizeSale(undefined, { installments: 1, first_due_date: "2026-11-10", credit_account_id: "carne-9" }); });
    expect("credit_account_id" in saleBody()).toBe(false);
  });

  test.each(["CREDIT_ACCOUNT_NOT_FOUND", "CREDIT_ACCOUNT_CLOSED"])("422 %s: mensagem clara, venda não entra", (code) => {
    mockFalha = { status: 422, data: { code, error: code } };
    carrinhoNoCrediario();
    act(() => { api.finalizeSale(undefined, { installments: 1, first_due_date: "2026-11-10", credit_account_id: "carne-9" }); });
    expect(toast.error).toHaveBeenCalledWith(mensagemErroCarneDaVenda(code));
    expect(api.lastSale).toBeNull();
    expect(api.cart).toHaveLength(1);
  });
});

describe("mensagemErroCarneDaVenda", () => {
  test("diz que a venda não foi registrada e o que fazer", () => {
    expect(mensagemErroCarneDaVenda("CREDIT_ACCOUNT_NOT_FOUND")).toMatch(/não foi registrada.*não existe mais/);
    expect(mensagemErroCarneDaVenda("CREDIT_ACCOUNT_CLOSED")).toMatch(/não foi registrada.*quitado ou encerrado/);
  });
  test("outros códigos seguem o tratamento normal da venda", () => {
    expect(mensagemErroCarneDaVenda("CREDIARIO_REQUIRES_CUSTOMER")).toBeNull();
    expect(mensagemErroCarneDaVenda(undefined)).toBeNull();
  });
});

describe("usePdvState: juntar a venda a um carnê", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", "hooks", "usePdvState.ts"), "utf8");

  test("manda o carnê na venda E continua chamando o /unify", () => {
    expect(fonte).toMatch(/finalizeSale\(undefined, \{\s*installments: 1,\s*first_due_date: payload\.first_due_date,\s*credit_account_id: payload\.unify\.account_id,\s*\}\)/);
    expect(fonte).toContain("creditApi.applyUnify(compId, custId, account_id, {");
  });

  test("o fluxo sem escolha não manda carnê e limpa unificação pendurada", () => {
    expect(fonte).toMatch(/pendingUnifyRef\.current = null;\s*finalizeSale\(undefined, payload\);/);
  });
});

describe("CriarLancamentoModal: o padrão é carnê novo", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "components", "crediario", "CriarLancamentoModal.tsx"), "utf8");

  test("abre e reabre em 'Novo carnê'", () => {
    expect(fonte).toContain('useState<AccountMode>("new")');
    expect(fonte).toContain('setAccountMode("new");');
    expect(fonte).not.toContain('setAccountMode("general");');
  });

  test("manda new_account: true e o nome só quando preenchido", () => {
    expect(fonte).toContain('new_account:      accountMode === "new" ? true : undefined,');
    expect(fonte).toContain('new_account_name: accountMode === "new" ? (newAccountName.trim() || undefined) : undefined,');
    expect(fonte).not.toContain("Informe o nome do novo carnê");
  });

  test("Carnê existente e Conta geral continuam como opções", () => {
    expect(fonte).toContain('["existing", "Carnê existente"]');
    expect(fonte).toContain('["general", "Conta geral"]');
  });
});
