// ============================================================
// utils/fornecedoresUtil — casamento cadastro × nota × pedido, ordem da
// lista, busca e validação do cadastro de fornecedor (25/09/2026).
// ============================================================
import {
  montarLinhas, filtrarLinhas, validarFornecedor, cnpjValido, formDaLinha, FORM_VAZIO,
} from "@/utils/fornecedoresUtil";

const AGORA = Date.parse("2026-09-25T12:00:00Z");
const sup = (over: any = {}) => ({
  id: "s1", company_id: "c", name: "Cimentos Ipê", cnpj: "11222333000181", contact_name: null,
  phone: null, email: null, notes: null, is_active: true, product_count: 3, ...over,
});
const grupo = (over: any = {}) => ({
  key: "k", supplier_name: "Cimentos Ipê", supplier_cnpj: "11222333000181", supplier_phone: null,
  items: [{ product_id: "p1", est_cost: 100 }], total_est: 100, min_days_to_stockout: null, ...over,
});
const pedido = (over: any = {}) => ({
  id: "o1", number: "C-0001", status: "sent", supplier_name: "Cimentos Ipê", supplier_cnpj: "11222333000181",
  items: [], total_est: 50, created_at: "2026-09-20T00:00:00Z", ...over,
});

describe("montarLinhas", () => {
  test("sugestão casa com o cadastro pelo CNPJ, mesmo com máscara", () => {
    const l = montarLinhas({ suppliers: [sup()], reposicao: [grupo({ supplier_cnpj: "11.222.333/0001-81" }) as any], agora: AGORA });
    expect(l).toHaveLength(1);
    expect(l[0].origem).toBe("cadastro");
    expect(l[0].reposicao?.total_est).toBe(100);
  });

  test("sem CNPJ, casa pelo nome sem acento nem caixa", () => {
    const l = montarLinhas({ suppliers: [sup({ cnpj: null })], reposicao: [grupo({ supplier_cnpj: null, supplier_name: "CIMENTOS  IPE" }) as any], agora: AGORA });
    expect(l).toHaveLength(1);
    expect(l[0].reposicao).not.toBeNull();
  });

  test("nota sem cadastro vira linha 'nota' com o telefone da nota", () => {
    const l = montarLinhas({ suppliers: [], reposicao: [grupo({ supplier_phone: "11999990000" }) as any], agora: AGORA });
    expect(l[0]).toMatchObject({ origem: "nota", nome: "Cimentos Ipê", cnpj: "11222333000181", telefone: "11999990000", supplier: null });
  });

  test("cadastro sem telefone herda o da nota", () => {
    const l = montarLinhas({ suppliers: [sup()], reposicao: [grupo({ supplier_phone: "11999990000" }) as any], agora: AGORA });
    expect(l[0].telefone).toBe("11999990000");
  });

  test("pedidos: rascunho, a caminho, recebido recente entram; cancelado e recebido antigo não", () => {
    const l = montarLinhas({
      suppliers: [sup()],
      pedidos: [
        pedido({ id: "a", status: "draft" }),
        pedido({ id: "b", status: "sent" }),
        pedido({ id: "c", status: "received", received_at: "2026-09-24T00:00:00Z" }),
        pedido({ id: "d", status: "received", received_at: "2026-09-01T00:00:00Z" }),
        pedido({ id: "e", status: "cancelled" }),
      ] as any,
      agora: AGORA,
    });
    expect(l[0].rascunhos.map((o) => o.id)).toEqual(["a"]);
    expect(l[0].enviados.map((o) => o.id)).toEqual(["b"]);
    expect(l[0].recebidos.map((o) => o.id)).toEqual(["c"]);
  });

  test("ordem: dinheiro a decidir primeiro (maior antes), depois a caminho, depois alfabética; 'sem fornecedor' fecha o topo", () => {
    const l = montarLinhas({
      suppliers: [
        sup({ id: "z", name: "Zeta", cnpj: null }),
        sup({ id: "a", name: "Alfa", cnpj: null }),
        sup({ id: "m", name: "Meio", cnpj: null }),
        sup({ id: "g", name: "Grande", cnpj: null }),
        sup({ id: "c", name: "Caminho", cnpj: null }),
      ],
      reposicao: [
        grupo({ key: "1", supplier_cnpj: null, supplier_name: "Meio", total_est: 100 }),
        grupo({ key: "2", supplier_cnpj: null, supplier_name: "Grande", total_est: 900 }),
        grupo({ key: "sem-fornecedor", supplier_cnpj: null, supplier_name: "Sem fornecedor identificado", total_est: 5000 }),
      ] as any,
      pedidos: [pedido({ supplier_cnpj: null, supplier_name: "Caminho" })] as any,
      agora: AGORA,
    });
    expect(l.map((x) => x.nome)).toEqual(["Grande", "Meio", "Sem fornecedor identificado", "Caminho", "Alfa", "Zeta"]);
  });
});

describe("filtrarLinhas", () => {
  const linhas = montarLinhas({ suppliers: [sup({ contact_name: "João", phone: "11940028922" }), sup({ id: "s2", name: "Tintas Sol", cnpj: null })], agora: AGORA });
  test.each([["ipe", 1], ["joao", 1], ["112223", 1], ["4002", 1], ["tintas", 1], ["", 2], ["nada", 0]])("'%s' acha %i", (q, n) => {
    expect(filtrarLinhas(linhas, q as string)).toHaveLength(n as number);
  });
});

describe("validarFornecedor", () => {
  const f = (over: any) => ({ ...FORM_VAZIO, ...over });

  test("só o nome basta; vazios vão como null", () => {
    expect(validarFornecedor(f({ name: " Casa do Cimento " }))).toEqual({
      ok: true, body: { name: "Casa do Cimento", cnpj: null, phone: null, contact_name: null, email: null, notes: null },
    });
  });

  test("sem nome não salva", () => {
    expect(validarFornecedor(f({ cnpj: "11.222.333/0001-81" }))).toMatchObject({ ok: false, campo: "name" });
  });

  test("CNPJ com dígito errado é erro; certo vai só com dígitos", () => {
    expect(validarFornecedor(f({ name: "Loja X", cnpj: "11.222.333/0001-82" }))).toMatchObject({ ok: false, campo: "cnpj" });
    const ok = validarFornecedor(f({ name: "Loja X", cnpj: "11.222.333/0001-81" }));
    expect(ok.ok && ok.body.cnpj).toBe("11222333000181");
  });

  test("WhatsApp incompleto e e-mail inválido são erro", () => {
    expect(validarFornecedor(f({ name: "Loja X", phone: "(11) 9999" }))).toMatchObject({ ok: false, campo: "phone" });
    expect(validarFornecedor(f({ name: "Loja X", email: "vendas@" }))).toMatchObject({ ok: false, campo: "email" });
  });
});

test("cnpjValido rejeita sequência repetida e tamanho errado", () => {
  expect(cnpjValido("11222333000181")).toBe(true);
  expect(cnpjValido("11111111111111")).toBe(false);
  expect(cnpjValido("1122233300018")).toBe(false);
});

test("formDaLinha: da nota leva nome, CNPJ e telefone para o cadastro", () => {
  const [l] = montarLinhas({ suppliers: [], reposicao: [grupo({ supplier_phone: "11999990000" }) as any], agora: AGORA });
  expect(formDaLinha(l)).toEqual({ ...FORM_VAZIO, name: "Cimentos Ipê", cnpj: "11222333000181", phone: "11999990000" });
});
