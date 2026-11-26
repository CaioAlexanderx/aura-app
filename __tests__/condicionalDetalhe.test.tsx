// ============================================================
// Vendas › Condicionais: detalhe e decisão por peça (C10, 26/11/2026)
//
// Com o hook de verdade (react-query) e só o `request` falso:
//   1. render: peças, resumo "N peças com ela: R$ X", sem "Cobrar no Caixa"
//      (C12 fora) e sem botão enquanto nada foi marcado;
//   2. Voltou numa peça → "1 peça voltou" e "Salvar devolução" manda PATCH
//      /itens com Idempotency-Key e atualiza a lista;
//   3. defeito: caixa, nota e a mensagem "1 peça foi para Peças para resolver";
//   4. Ficou: "Ela leva…" ao vivo, sem botão (C12 fora);
//   5. tudo voltou: "Tudo devolvido" chama POST /tudo-devolvido (e com defeito
//      vai pelo PATCH, que leva a nota);
//   6. 409 de peça cobrada: frase do servidor e o detalhe é recarregado;
//      falha de rede repete a MESMA chave;
//   7. Nova data: PATCH /prazo;
//   8. bipar marca Voltou; Falta cobrar com peças travadas; cancelar só sem decisão.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRequest = jest.fn();
const mockScan = jest.fn();
const mockToastSuccess = jest.fn();
let mockOnScan: ((r: { code: string }) => void) | null = null;

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/Toast", () => ({ toast: { info: jest.fn(), error: jest.fn(), success: (...a: any[]) => mockToastSuccess(...a) } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null) }));
jest.mock("@/components/JanelaEmpilhada", () => ({ JanelaEmpilhada: ({ children }: any) => children }));
jest.mock("@/components/ScannerInput", () => {
  const R = require("react");
  return { ScannerInput: R.forwardRef((p: any, _r: any) => { mockOnScan = p.onScan; return R.createElement("ScannerInput", { testID: p.testID }); }) };
});
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
const mockBrincoD = { id: "p-brinco", name: "Brinco Argola Luz", code: "BAL", barcode: "111", variantBarcodes: [], coresDasVariantes: [], preco: 69.9, price: 69.9, emPromocao: false, precoEfetivo: null, estoque: 2, temVariantes: false, reserva: { reservadoTotal: 0, reservadoPorVariante: {}, comClienteTotal: 0, comClientePorVariante: {}, resolverTotal: 0, resolverPorVariante: {} } };
jest.mock("@/components/screens/vendas/condicionais/nova/usePecasDaLoja", () => ({
  usePecasDaLoja: () => ({ produtos: [mockBrincoD], carregando: false, variantesDe: async () => [], acharNoServidor: async () => null }),
}));
jest.mock("@/services/pdvApi", () => ({ pdvApi: { scan: (...a: any[]) => mockScan(...a) } }));
jest.mock("@/services/imprimirCondicional", () => ({ imprimirComprovanteDaCondicional: jest.fn(() => Promise.resolve({ ok: true })) }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = { user: { id: "u1" }, token: "t", company: { id: "c1", name: "Loja Centro" }, consolidatedView: false };
    return typeof sel === "function" ? sel(st) : st;
  },
}));

import { GavetaDaCondicional } from "@/components/screens/vendas/condicionais/detalhe/GavetaDaCondicional";
import { hojeEmSaoPaulo, somarDias } from "@/components/screens/vendas/pedidos/regrasDosPedidos";

const HOJE = hojeEmSaoPaulo();

function peca(id: string, nome: string, preco: number, over: any = {}) {
  return {
    id, product_id: "p-" + id, variant_id: "v-" + id, product_name: nome, variant_label: "Off-white · P",
    color_name: "Off-white", size_label: "P", unit_price: preco, preco_hoje: preco, preco_mudou: false,
    situacao: "com_cliente", defect_note: null, decided_at: null, sale_id: null, added_at: "2026-11-25T13:42:00Z",
    resolved_at: null, ...over,
  };
}

function detalhe(items: any[], over: any = {}) {
  const sum = (f: (i: any) => boolean) => items.filter(f).length;
  return {
    id: "k1", company_id: "c1", numero: 31, numero_exibicao: "C-0031", status: "aberta", situacao: "com_cliente",
    parcial: false, dias_de_atraso: 0, customer_id: null, customer_name: "Marina Duarte", customer_phone: "(11) 98888-0142",
    seller_name: "Jéssica", due_date: somarDias(HOJE, 3), notes: null, terms: null,
    created_at: "2026-11-25T13:42:00Z", closed_at: null, cancelled_at: null, cancel_reason: null,
    resumo: { pecas: items.length, com_cliente: sum((i) => i.situacao === "com_cliente"), ficou: 0, a_cobrar: 0, voltou: 0, voltou_defeito: 0, valor_total: 0, valor_com_cliente: 0, valor_a_cobrar: 0 },
    items, events: [{ id: "e1", tipo: "criada", item_id: null, dados: null, user_id: null, created_at: "2026-11-25T13:42:00Z" }],
    ...over,
  };
}

const TRES = () => [peca("a", "Vestido Midi", 189.9), peca("b", "Blusa Tricô", 129.9), peca("c", "Brinco Argola", 59.9)];

const linha: any = {
  id: "k1", company_id: "c1", company_name: "Loja Centro", numero: 31, numero_exibicao: "C-0031", status: "aberta",
  situacao: "com_cliente", parcial: false, dias_de_atraso: 0, customer_name: "Marina Duarte", customer_phone: "(11) 98888-0142",
  seller_name: "Jéssica", due_date: somarDias(HOJE, 3), pecas: 3, pecas_com_cliente: 3, created_at: "2026-11-25T13:42:00Z",
};

let mockDetalhe: any;
let mockEscrita: (url: string, opts: any) => any;

function instalarRequest() {
  mockRequest.mockImplementation((url: string, opts: any = {}) => {
    if (!opts.method || opts.method === "GET") return Promise.resolve({ condicional: mockDetalhe });
    return Promise.resolve(mockEscrita(url, opts));
  });
}

/** O servidor passa a devolver este detalhe (na resposta da escrita e no GET seguinte). */
function responder(det: any) {
  mockEscrita = () => { mockDetalhe = det; return { condicional: det }; };
}

async function montar(extra: any = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = jest.spyOn(qc, "invalidateQueries");
  let r: renderer.ReactTestRenderer;
  await act(async () => {
    r = renderer.create(
      <QueryClientProvider client={qc}>
        <GavetaDaCondicional linha={linha} hoje={HOJE} mostrarLoja={false} onClose={() => {}} {...extra} />
      </QueryClientProvider>,
    );
  });
  for (let k = 0; k < 3; k++) await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return { r: r!, spy };
}

function achar(r: renderer.ReactTestRenderer, id: string) {
  const l = r.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onPress === "function");
  return l[0] || null;
}
function existe(r: renderer.ReactTestRenderer, id: string) {
  return r.root.findAll((n: any) => n.props && n.props.testID === id).length > 0;
}
async function tocar(r: renderer.ReactTestRenderer, id: string) {
  const n = achar(r, id);
  if (!n) throw new Error("sem " + id);
  await act(async () => { await n.props.onPress(); });
}
function textos(r: renderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.children) n.children.forEach(walk);
  };
  walk(r.toJSON());
  return out.join("");
}
const escritas = () => mockRequest.mock.calls.filter((c) => c[1] && c[1].method && c[1].method !== "GET");

beforeEach(() => {
  mockRequest.mockReset();
  mockScan.mockReset();
  mockToastSuccess.mockReset();
  mockDetalhe = detalhe(TRES());
  mockEscrita = () => ({ condicional: mockDetalhe });
  instalarRequest();
});

describe("detalhe da condicional (C10)", () => {
  it("mostra as peças e o resumo, sem Cobrar no Caixa nem botão sem marcação", async () => {
    const { r } = await montar();
    expect(mockRequest.mock.calls[0][0]).toBe("/companies/c1/condicionais/k1");
    const t = textos(r);
    expect(t).toContain("Condicional C-0031");
    expect(t).toContain("Vestido Midi");
    expect(t).toContain("3 peças com ela: R$");
    expect(t).toContain("Marque o que ficou e o que voltou");
    expect(existe(r, "cond-cobrar")).toBe(false);
    expect(existe(r, "cond-salvar")).toBe(false);
    expect(existe(r, "cond-tudo")).toBe(false);
    expect(existe(r, "cond-cancelar")).toBe(true);
  });

  it("Voltou numa peça: resumo ao vivo e Salvar devolução com Idempotency-Key", async () => {
    const { r, spy } = await montar();
    await tocar(r, "cond-voltou-a");
    expect(textos(r)).toContain("1 peça voltou");
    expect(textos(r)).toContain("2 ainda com ela. A condicional segue em aberto.");
    responder(detalhe([peca("a", "Vestido Midi", 189.9, { situacao: "voltou", decided_at: new Date().toISOString() }), peca("b", "Blusa Tricô", 129.9), peca("c", "Brinco Argola", 59.9)], { parcial: true }));
    await tocar(r, "cond-salvar");
    const [url, opts] = escritas()[0];
    expect(url).toBe("/companies/c1/condicionais/k1/itens");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toEqual({ items: [{ item_id: "a", situacao: "voltou" }] });
    expect(opts.headers["Idempotency-Key"]).toBeTruthy();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["condicionais"] });
    expect(mockToastSuccess).toHaveBeenCalledWith("Devolução salva.");
    expect(textos(r)).toContain("Voltou em");
    expect(existe(r, "cond-voltou-a")).toBe(false);
  });

  it("defeito: caixa, nota e a mensagem de Peças para resolver depois de salvar", async () => {
    const { r } = await montar();
    await tocar(r, "cond-voltou-b");
    expect(textos(r)).toContain("Voltou com defeito ou sem etiqueta. Não volta ao estoque sozinha: vai para Peças para resolver.");
    await tocar(r, "cond-defeito-b");
    expect(textos(r)).toContain("Ao salvar, ela sai da condicional e não conta como livre.");
    const campo = r.root.findByProps({ testID: "cond-defeito-nota-b" });
    await act(async () => { campo.props.onChangeText("Fio puxado na manga"); });
    responder(detalhe([peca("a", "Vestido Midi", 189.9), peca("b", "Blusa Tricô", 129.9, { situacao: "voltou_defeito", defect_note: "Fio puxado na manga", decided_at: new Date().toISOString() }), peca("c", "Brinco Argola", 59.9)]));
    await tocar(r, "cond-salvar");
    expect(escritas()[0][1].body).toEqual({ items: [{ item_id: "b", situacao: "voltou_defeito", defect_note: "Fio puxado na manga" }] });
    expect(textos(r)).toContain("1 peça foi para Peças para resolver.");
    expect(textos(r)).toContain("Voltou hoje com defeito · está em Peças para resolver");
    // C16 ainda não existe: sem o link, sem botão morto.
    expect(existe(r, "cond-ver-resolver")).toBe(false);
  });

  it("'Ver a lista' aparece quando a tela de Peças para resolver for ligada", async () => {
    mockDetalhe = detalhe([peca("a", "Vestido Midi", 189.9, { situacao: "voltou_defeito", decided_at: new Date().toISOString() }), peca("c", "Brinco", 59.9)]);
    const ver = jest.fn();
    const { r } = await montar({ onVerPecasParaResolver: ver });
    await tocar(r, "cond-ver-resolver");
    expect(ver).toHaveBeenCalled();
  });

  it("Ficou: 'Ela leva…' ao vivo e nenhum botão enquanto o C12 não existe", async () => {
    const { r } = await montar();
    await tocar(r, "cond-ficou-a");
    expect(textos(r)).toContain("Ela leva 1 peça: R$ 189,90");
    expect(textos(r)).toContain("2 ainda com ela (segue em aberto)");
    expect(existe(r, "cond-cobrar")).toBe(false);
    expect(existe(r, "cond-salvar")).toBe(false);
    expect(escritas()).toHaveLength(0);
  });

  it("tudo voltou: Tudo devolvido chama POST /tudo-devolvido", async () => {
    const { r } = await montar();
    for (const k of ["a", "b", "c"]) await tocar(r, "cond-voltou-" + k);
    expect(textos(r)).toContain("Tudo voltou. Nada a cobrar.");
    responder(detalhe(TRES().map((i) => ({ ...i, situacao: "voltou" })), { status: "encerrada", situacao: "concluida" }));
    await tocar(r, "cond-tudo");
    const [url, opts] = escritas()[0];
    expect(url).toBe("/companies/c1/condicionais/k1/tudo-devolvido");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Idempotency-Key"]).toBeTruthy();
    expect(mockToastSuccess).toHaveBeenCalledWith("Tudo devolvido. A condicional foi encerrada.");
  });

  it("tudo voltou com uma peça com defeito vai pelo PATCH, que leva a nota", async () => {
    const { r } = await montar();
    for (const k of ["a", "b", "c"]) await tocar(r, "cond-voltou-" + k);
    await tocar(r, "cond-defeito-c");
    await tocar(r, "cond-tudo");
    const [url, opts] = escritas()[0];
    expect(url).toBe("/companies/c1/condicionais/k1/itens");
    expect(opts.body.items.map((i: any) => i.situacao)).toEqual(["voltou", "voltou", "voltou_defeito"]);
  });

  it("409 de peça cobrada: mostra a frase do servidor e recarrega o detalhe", async () => {
    const { r } = await montar();
    await tocar(r, "cond-voltou-a");
    const antes = mockRequest.mock.calls.filter((c) => !c[1] || !c[1].method).length;
    mockRequest.mockImplementation((url: string, opts: any = {}) => {
      if (!opts.method || opts.method === "GET") return Promise.resolve({ condicional: mockDetalhe });
      return Promise.reject(Object.assign(new Error("A peça já foi cobrada numa venda."), { status: 409, data: { code: "COND_PECA_COBRADA", item_id: "a" } }));
    });
    await tocar(r, "cond-salvar");
    expect(textos(r)).toContain("A peça já foi cobrada numa venda.");
    const depois = mockRequest.mock.calls.filter((c) => !c[1] || !c[1].method).length;
    expect(depois).toBeGreaterThan(antes);
  });

  it("falha de rede repete a mesma chave; outra marcação ganha chave nova", async () => {
    const { r } = await montar();
    await tocar(r, "cond-voltou-a");
    mockRequest.mockImplementation((url: string, opts: any = {}) => {
      if (!opts.method || opts.method === "GET") return Promise.resolve({ condicional: mockDetalhe });
      return Promise.reject(Object.assign(new Error("Sem conexão."), { status: 0, isNetworkError: true }));
    });
    await tocar(r, "cond-salvar");
    await tocar(r, "cond-salvar");
    const [e1, e2] = escritas();
    expect(e1[1].headers["Idempotency-Key"]).toBe(e2[1].headers["Idempotency-Key"]);
    await tocar(r, "cond-voltou-b");
    await tocar(r, "cond-salvar");
    expect(escritas()[2][1].headers["Idempotency-Key"]).not.toBe(e1[1].headers["Idempotency-Key"]);
  });

  it("Nova data: PATCH /prazo com a data escolhida", async () => {
    const { r } = await montar();
    await tocar(r, "cond-nova-data-abrir");
    await tocar(r, "cond-nova-data-amanha");
    await tocar(r, "cond-nova-data-salvar");
    const [url, opts] = escritas()[0];
    expect(url).toBe("/companies/c1/condicionais/k1/prazo");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toEqual({ due_date: somarDias(HOJE, 1) });
    expect(existe(r, "cond-nova-data")).toBe(false);
  });

  it("bipar marca Voltou na peça do produto", async () => {
    mockScan.mockResolvedValue({ match: "exact", product: { id: "p-b" }, variant_id: "v-b" });
    const { r } = await montar();
    await act(async () => { await mockOnScan!({ code: "789" }); });
    expect(mockScan).toHaveBeenCalledWith("c1", "789");
    expect(textos(r)).toContain("1 peça voltou");
    // bipar de novo uma peça que não está mais disponível avisa
    await act(async () => { await mockOnScan!({ code: "789" }); });
    expect(textos(r)).toContain("Essa peça não está com a cliente nesta condicional.");
  });

  it("Falta cobrar: peças travadas, sem bipe, sem Nova data, sem cancelar", async () => {
    mockDetalhe = detalhe([
      peca("j", "Jaqueta Jeans", 259.8, { situacao: "ficou", decided_at: "2026-11-24T15:00:00Z" }),
      peca("s", "Saia", 99.9, { situacao: "voltou", decided_at: "2026-11-24T15:00:00Z" }),
    ], { situacao: "a_cobrar", parcial: true });
    const { r } = await montar();
    const t = textos(r);
    expect(t).toContain("Falta cobrar: R$ 259,80");
    expect(t).toContain("Ela já decidiu tudo.");
    expect(t).toContain("Ficou em 24/11 · falta cobrar no Caixa");
    expect(t).toContain("Voltou em 24/11 · já está livre no estoque");
    expect(existe(r, "cond-bipe")).toBe(false);
    expect(existe(r, "cond-nova-data-abrir")).toBe(false);
    expect(existe(r, "cond-cancelar")).toBe(false);
    expect(existe(r, "cond-cobrar")).toBe(false);
  });

  it("C5b · Acrescentar peça: escolhe pelo passo de peças e manda POST /itens com Idempotency-Key", async () => {
    const { r } = await montar();
    await tocar(r, "cond-acrescentar-abrir");
    expect(existe(r, "cond-acrescentar")).toBe(true);
    await act(async () => { await mockOnScan!({ code: "111" }); });
    expect(textos(r)).toContain("Brinco Argola Luz");
    responder(detalhe([...TRES(), peca("d", "Brinco Argola Luz", 69.9)]));
    await tocar(r, "cond-acrescentar-confirmar");
    const [url, opts] = escritas()[0];
    expect(url).toBe("/companies/c1/condicionais/k1/itens");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({ items: [{ product_id: "p-brinco" }] });
    expect(typeof opts.headers["Idempotency-Key"]).toBe("string");
    expect(existe(r, "cond-acrescentar")).toBe(false);
    expect(mockToastSuccess).toHaveBeenCalledWith("Peça acrescentada.");
  });

  it("C5b · Acrescentar peça: aviso de quem vende sem estoque vem do servidor", async () => {
    const { r } = await montar();
    await tocar(r, "cond-acrescentar-abrir");
    await act(async () => { await mockOnScan!({ code: "111" }); });
    mockEscrita = () => ({ condicional: mockDetalhe, avisos: [{ mensagem: "Sem unidade livre. Entra mesmo assim porque sua loja vende sem estoque." }] });
    await tocar(r, "cond-acrescentar-confirmar");
    expect(textos(r)).toContain("Sem unidade livre. Entra mesmo assim porque sua loja vende sem estoque.");
  });

  it("C5b · Acrescentar peça: 409 mostra a condicional que segura a peça, com 'Ver a C-0029'", async () => {
    const ver = jest.fn();
    const { r } = await montar({ onVerCondicional: ver });
    await tocar(r, "cond-acrescentar-abrir");
    await act(async () => { await mockOnScan!({ code: "111" }); });
    mockEscrita = () => {
      throw Object.assign(new Error("x"), { status: 409, data: { code: "COND_SEM_SALDO", faltas: [{ product_id: "p-brinco", variant_id: null, nome: "Brinco Argola Luz", condicionais: [{ id: "k29", numero_exibicao: "C-0029", customer_name: "Tainá Moraes" }] }] } });
    };
    await tocar(r, "cond-acrescentar-confirmar");
    expect(textos(r)).toContain("C-0029");
    expect(textos(r)).toContain("Tainá Moraes");
    await tocar(r, "nova-falta-ver");
    expect(ver).toHaveBeenCalledWith("k29", "c1");
  });

  it("C5b · peça já cobrada: mostra a venda quando o backend traz venda_numero, senão só 'já foi cobrada'", async () => {
    mockDetalhe = detalhe([
      peca("j", "Jaqueta Jeans", 259.8, { situacao: "ficou", sale_id: "s1", venda_numero: 4812, decided_at: "2026-11-24T15:00:00Z" }),
      peca("k", "Cinto", 59.9, { situacao: "ficou", sale_id: "s2", decided_at: "2026-11-24T15:00:00Z" }),
    ], { situacao: "concluida", status: "encerrada" });
    const { r } = await montar();
    const t = textos(r);
    expect(t).toContain("Ficou · já foi cobrada na venda #4812 em 24/11");
    expect(t).toContain("Ficou · já foi cobrada em 24/11");
  });

  it("cancelar: pede confirmação e manda POST /cancelar", async () => {
    const fechar = jest.fn();
    responder(detalhe(TRES(), { status: "cancelada", situacao: "cancelada" }));
    const { r } = await montar({ onClose: fechar });
    await tocar(r, "cond-cancelar");
    expect(textos(r)).toContain("Cancelar a condicional C-0031?");
    await tocar(r, "cond-cancelar-sim");
    expect(escritas()[0][0]).toBe("/companies/c1/condicionais/k1/cancelar");
    expect(fechar).toHaveBeenCalled();
  });

  it("preço de hoje ao lado do da retirada", async () => {
    mockDetalhe = detalhe([peca("a", "Vestido Midi", 189.9, { preco_hoje: 209.9, preco_mudou: true }), peca("c", "Brinco", 59.9)]);
    const { r } = await montar();
    expect(textos(r)).toContain("Hoje está R$ 209,90 na loja. Vale o preço do comprovante: R$ 189,90.");
  });

  it("C12 · Cobrar no Caixa: grava o que voltou e leva as que ficaram ao Caixa", async () => {
    const onCobrar = jest.fn();
    const { r } = await montar({ onCobrar });
    await tocar(r, "cond-ficou-a");
    await tocar(r, "cond-voltou-b");
    expect(textos(r)).toContain("Ela leva 1 peça: R$ 189,90");
    responder(detalhe([peca("a", "Vestido Midi", 189.9), peca("b", "Blusa Tricô", 129.9, { situacao: "voltou", decided_at: new Date().toISOString() }), peca("c", "Brinco Argola", 59.9)], { parcial: true }));
    await tocar(r, "cond-cobrar");
    // as que voltaram são gravadas antes de sair; as que ficaram não gravam nada (a venda é que grava)
    expect(escritas()).toHaveLength(1);
    expect(escritas()[0][1].body).toEqual({ items: [{ item_id: "b", situacao: "voltou" }] });
    expect(onCobrar).toHaveBeenCalledTimes(1);
    expect(onCobrar.mock.calls[0][0].id).toBe("k1");
    expect(onCobrar.mock.calls[0][1]).toEqual(["a"]);
    // salvar o que voltou não apaga o "Ficou" marcado na tela
    expect(textos(r)).toContain("Ela leva 1 peça: R$ 189,90");
  });

  it("C12 · Cobrar no Caixa só com o que ficou: sem escrita, vai direto", async () => {
    const onCobrar = jest.fn();
    const { r } = await montar({ onCobrar });
    await tocar(r, "cond-ficou-a");
    await tocar(r, "cond-ficou-c");
    await tocar(r, "cond-cobrar");
    expect(escritas()).toHaveLength(0);
    expect(onCobrar.mock.calls[0][1]).toEqual(["a", "c"]);
  });

  it("C12 · Cobrar no Caixa sem nada marcado fica desligado", async () => {
    const onCobrar = jest.fn();
    const { r } = await montar({ onCobrar });
    await tocar(r, "cond-cobrar");
    expect(onCobrar).not.toHaveBeenCalled();
  });

  it("C12 · Falta cobrar: o botão leva as peças que ficaram sem venda", async () => {
    mockDetalhe = detalhe([
      peca("j", "Jaqueta Jeans", 259.8, { situacao: "ficou", decided_at: "2026-11-24T15:00:00Z" }),
      peca("s", "Saia", 99.9, { situacao: "voltou", decided_at: "2026-11-24T15:00:00Z" }),
    ], { situacao: "a_cobrar", parcial: true });
    const onCobrar = jest.fn();
    const { r } = await montar({ onCobrar });
    expect(textos(r)).toContain("Falta cobrar: R$ 259,80");
    await tocar(r, "cond-cobrar");
    expect(escritas()).toHaveLength(0);
    expect(onCobrar.mock.calls[0][1]).toEqual(["j"]);
  });
});
