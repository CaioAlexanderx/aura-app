// ============================================================
// Nova condicional, passo 3 e Pronto (C7, 26/11/2026). Mockup aprovado.
//   3. prazo (1, 2, 3, 7 dias ou outra data), vendedora, observação, texto da
//      loja; "Guardar condicional" manda o POST com Idempotency-Key estável;
//   409 COND_SEM_SALDO volta ao passo 2 com a condicional que segura a peça;
//   422 mostra a frase do backend; erro de rede deixa tudo preenchido;
//   Pronto: Imprimir na bobina, Imprimir em A4 e WhatsApp (funções do C8).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/CalendarioDoDia", () => ({ CalendarioDoDia: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1", trade_name: "Loja Centro" }, availableCompanies: [], token: "t" }),
}));
jest.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: [{ id: "c-1", name: "Marina Duarte", phone: "(11) 98888-0142" }], isLoading: false }),
}));
const mockSetQueryData = jest.fn();
let mockEquipe: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(), getQueriesData: () => [], setQueryData: (...a: any[]) => mockSetQueryData(...a) }),
  useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === "condicional-vendedoras" ? { employees: mockEquipe } : null, isLoading: false }),
}));
const mockSalvarSettings = jest.fn();
jest.mock("@/services/api", () => ({
  companiesApi: { createCustomer: jest.fn(), products: jest.fn(), variants: jest.fn() },
  pdvSettingsApi: { save: (...a: any[]) => mockSalvarSettings(...a) },
  request: jest.fn(),
}));
let mockSettings: any = {};
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: mockSettings }) }));
const mockBrinco = { id: "p-brinco", name: "Brinco Argola Luz", code: "BAL", barcode: "111", variantBarcodes: [], coresDasVariantes: [], preco: 69.9, price: 69.9, emPromocao: false, precoEfetivo: null, estoque: 2, temVariantes: false, reserva: { reservadoTotal: 0, reservadoPorVariante: {}, comClienteTotal: 0, comClientePorVariante: {} } };
jest.mock("@/components/screens/vendas/condicionais/nova/usePecasDaLoja", () => ({
  usePecasDaLoja: () => ({ produtos: [mockBrinco], carregando: false, variantesDe: async () => [] }),
}));
jest.mock("@/components/ScannerInput", () => ({
  ScannerInput: require("react").forwardRef((props: any, ref: any) => {
    require("react").useImperativeHandle(ref, () => ({ limpar: () => {}, focar: () => {} }));
    return require("react").createElement("ScannerInputMock", props);
  }),
}));
const mockGuardarApi = jest.fn();
jest.mock("@/components/screens/vendas/condicionais/nova/api", () => {
  const real = jest.requireActual("@/components/screens/vendas/condicionais/nova/api");
  return { ...real, condicionaisApi: { guardar: (...a: any[]) => mockGuardarApi(...a) } };
});
const mockImprimir = jest.fn();
jest.mock("@/services/imprimirCondicional", () => ({ imprimirComprovanteDaCondicional: (...a: any[]) => mockImprimir(...a) }));
const mockWhats = jest.fn();
jest.mock("@/utils/condicionalWhatsapp", () => ({ abrirWhatsappDaCondicional: (...a: any[]) => mockWhats(...a) }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { NovaCondicionalModal } from "@/components/screens/vendas/condicionais/nova/NovaCondicionalModal";
import { TEXTOS_DA_NOVA as T } from "@/components/screens/vendas/condicionais/nova/textos";
import { diaCurto, somarDias, dataDentroDoPrazo, prazoInicial } from "@/components/screens/vendas/condicionais/nova/prazos";

const HOJE = "2026-11-26";
const GUARDADA = {
  id: "cond-31", numero_exibicao: "C-0031", customer_id: "c-1", customer_name: "Marina Duarte", customer_phone: "11988880142",
  seller_name: null, created_at: "2026-11-26T13:42:00Z", due_date: "2026-11-29", terms: null,
  items: [{ id: "i1", product_id: "p-brinco", variant_id: null, product_name: "Brinco Argola Luz", unit_price: 69.9 }],
};

function flat(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flat).join("");
  return flat(node.children);
}
const texto = (t: renderer.ReactTestRenderer) => flat(t.toJSON() as any);
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const um = (t: renderer.ReactTestRenderer, id: string) => {
  const r = porId(t, id);
  if (!r.length) throw new Error("sem testID " + id);
  return r[0];
};
const tem = (t: renderer.ReactTestRenderer, id: string) => porId(t, id).length > 0;
const tocar = async (t: renderer.ReactTestRenderer, id: string) => { await act(async () => { um(t, id).props.onPress(); }); };
const digitar = async (t: renderer.ReactTestRenderer, id: string, v: string) => { await act(async () => { um(t, id).props.onChangeText(v); }); };

function montar() {
  const onCriada = jest.fn();
  const onClose = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<NovaCondicionalModal visible onClose={onClose} onCriada={onCriada} hoje={HOJE} />); });
  return { tree, onCriada, onClose };
}
async function ateOPasso3(t: renderer.ReactTestRenderer) {
  await tocar(t, "nova-cliente-opcao-c-1");
  await tocar(t, "nova-continuar");
  await act(async () => { um(t, "nova-busca-peca").props.onChangeText("brinco"); });
  await tocar(t, "nova-sugestao-p-brinco");
  await tocar(t, "nova-continuar");
}

beforeEach(() => {
  mockEquipe = [];
  mockSettings = {};
  mockGuardarApi.mockReset();
  mockImprimir.mockReset();
  mockImprimir.mockResolvedValue("ok");
  mockWhats.mockReset();
  mockWhats.mockReturnValue(true);
  mockSalvarSettings.mockReset();
  mockSetQueryData.mockReset();
});

describe("Passo 3 · Prazo e conferência", () => {
  it("mostra os textos do mockup, o prazo padrão de 3 dias e o rodapé com a conta", async () => {
    const { tree } = montar();
    await ateOPasso3(tree);
    const t = texto(tree);
    expect(t).toContain(T.ateQuandoDevolve);
    expect(t).toContain("1 dia");
    expect(t).toContain("7 dias");
    expect(t).toContain(T.outraData);
    expect(t).toContain(T.observacao);
    expect(t).toContain(T.textoDaLoja);
    expect(um(tree, "nova-prazo-3").props.accessibilityState.selected).toBe(true);
    expect(texto(tree)).toContain(T.rodapePasso3(1, "R$ 69,90", diaCurto(somarDias(HOJE, 3))));
    expect(texto(tree)).toContain(T.guardar);
  });

  it("o prazo padrão da loja vira o chip certo", async () => {
    mockSettings = { condicional_prazo_padrao: 7 };
    const { tree } = montar();
    await ateOPasso3(tree);
    expect(um(tree, "nova-prazo-7").props.accessibilityState.selected).toBe(true);
  });

  it("sem texto da loja: explica e oferece escrever; com texto: mostra e deixa editar e salvar para a loja", async () => {
    const { tree } = montar();
    await ateOPasso3(tree);
    expect(texto(tree)).toContain(T.semTermos);
    expect(tem(tree, "nova-termos-escrever")).toBe(true);
    mockSalvarSettings.mockResolvedValue({ settings: { condicional_termos: "Devolver sem uso." } });
    await tocar(tree, "nova-termos-escrever");
    await digitar(tree, "nova-termos-texto", "Devolver sem uso.");
    await tocar(tree, "nova-termos-salvar");
    expect(mockSalvarSettings).toHaveBeenCalledWith("loja-1", { condicional_termos: "Devolver sem uso." });
    expect(texto(tree)).toContain("Devolver sem uso.");
    expect(tem(tree, "nova-termos-editar")).toBe(true);
  });

  it("mostra o texto da loja que já existe", async () => {
    mockSettings = { condicional_termos: "As peças devem voltar com etiqueta." };
    const { tree } = montar();
    await ateOPasso3(tree);
    expect(texto(tree)).toContain("As peças devem voltar com etiqueta.");
  });

  it("guarda com Idempotency-Key, prazo, vendedora e observação; vai para o Pronto", async () => {
    mockEquipe = [{ id: "e-1", name: "Jéssica", status: "active" }];
    mockGuardarApi.mockResolvedValue({ condicional: GUARDADA, avisos: [] });
    const { tree, onCriada } = montar();
    await ateOPasso3(tree);
    await tocar(tree, "nova-prazo-7");
    await tocar(tree, "nova-vendedora-e-1");
    await digitar(tree, "nova-obs", "Vai provar para o casamento");
    await tocar(tree, "nova-guardar");
    expect(mockGuardarApi).toHaveBeenCalledTimes(1);
    const [loja, corpo, chave] = mockGuardarApi.mock.calls[0];
    expect(loja).toBe("loja-1");
    expect(corpo).toEqual({
      customer_id: "c-1",
      items: [{ product_id: "p-brinco" }],
      due_date: "2026-12-03",
      employee_id: "e-1",
      seller_name: "Jéssica",
      notes: "Vai provar para o casamento",
    });
    expect(typeof chave).toBe("string");
    expect(chave.length).toBeGreaterThan(8);
    expect(onCriada).toHaveBeenCalledWith(GUARDADA);
    expect(tem(tree, "nova-pronto")).toBe(true);
  });

  it("erro de rede: tudo continua preenchido e o 'Tentar de novo' manda a MESMA chave; corpo novo, chave nova", async () => {
    mockGuardarApi.mockRejectedValueOnce({ isNetworkError: true, message: "x" }).mockRejectedValueOnce({ isNetworkError: true }).mockResolvedValue({ condicional: GUARDADA });
    const { tree } = montar();
    await ateOPasso3(tree);
    await tocar(tree, "nova-guardar");
    expect(texto(tree)).toContain(T.erroDeRedeTitulo);
    expect(texto(tree)).toContain(T.tentarDeNovo);
    expect(tem(tree, "nova-passo-3")).toBe(true);
    await tocar(tree, "nova-guardar");
    await digitar(tree, "nova-obs", "mudou");
    await tocar(tree, "nova-guardar");
    const chaves = mockGuardarApi.mock.calls.map((c) => c[2]);
    expect(chaves[0]).toBe(chaves[1]);
    expect(chaves[2]).not.toBe(chaves[1]);
  });

  it("422: mostra a mensagem do backend e continua no passo", async () => {
    mockGuardarApi.mockRejectedValue({ status: 422, data: { code: "COND_DATA", error: "A data de devolução já passou. Escolha hoje ou um dia depois." } });
    const { tree } = montar();
    await ateOPasso3(tree);
    await tocar(tree, "nova-guardar");
    expect(texto(tree)).toContain("A data de devolução já passou. Escolha hoje ou um dia depois.");
    expect(tem(tree, "nova-passo-3")).toBe(true);
  });

  it("409 COND_SEM_SALDO: volta às peças com a condicional que segura a peça", async () => {
    mockGuardarApi.mockRejectedValue({
      status: 409,
      data: { code: "COND_SEM_SALDO", faltas: [{ product_id: "p-brinco", variant_id: null, nome: "Brinco Argola Luz", condicionais: [{ id: "cond-29", numero_exibicao: "C-0029", customer_name: "Tainá Moraes", due_date: "2026-11-28" }] }] },
    });
    const { tree } = montar();
    await ateOPasso3(tree);
    await tocar(tree, "nova-guardar");
    expect(tem(tree, "nova-passo-2")).toBe(true);
    const t = texto(tree);
    expect(t).toContain(T.faltaTitulo("Brinco Argola Luz"));
    expect(t).toContain("C-0029");
    expect(t).toContain("Tainá Moraes");
    expect(um(tree, "nova-continuar").props.disabled).toBe(true);
    await tocar(tree, "nova-falta-tirar");
    expect(texto(tree)).toContain(T.nenhumaPeca);
  });
});

describe("Pronto", () => {
  async function guardarEIrAoPronto() {
    mockGuardarApi.mockResolvedValue({ condicional: GUARDADA });
    const m = montar();
    await ateOPasso3(m.tree);
    await tocar(m.tree, "nova-guardar");
    return m;
  }

  it("mostra o texto do mockup: guardada, com quem, até quando, nada cobrado", async () => {
    const { tree } = await guardarEIrAoPronto();
    const t = texto(tree);
    expect(t).toContain("Condicional C-0031 guardada");
    expect(t).toContain("Marina Duarte");
    expect(t).toContain("domingo, 29/11");
    expect(t).toContain("Nada foi cobrado");
    expect(t).toContain(T.imprimirBobina);
    expect(t).toContain(T.imprimirA4);
    expect(t).toContain(T.enviarWhatsapp);
    expect(t).toContain(T.novaCondicional);
    expect(t).toContain(T.verNaLista);
  });

  it("imprime na bobina e em A4 pela loja e pela condicional guardada", async () => {
    const { tree } = await guardarEIrAoPronto();
    await tocar(tree, "nova-imprimir-bobina");
    await tocar(tree, "nova-imprimir-a4");
    expect(mockImprimir).toHaveBeenNthCalledWith(1, "loja-1", "cond-31", "bobina");
    expect(mockImprimir).toHaveBeenNthCalledWith(2, "loja-1", "cond-31", "a4");
  });

  it("impressão bloqueada avisa", async () => {
    mockImprimir.mockResolvedValue("blocked");
    const { tree } = await guardarEIrAoPronto();
    await tocar(tree, "nova-imprimir-a4");
    expect(texto(tree)).toContain(T.impressaoBloqueada);
  });

  it("WhatsApp abre com a condicional e o nome da loja; sem telefone válido avisa", async () => {
    const { tree } = await guardarEIrAoPronto();
    await tocar(tree, "nova-whatsapp");
    expect(mockWhats).toHaveBeenCalledWith(GUARDADA, "Loja Centro");
    mockWhats.mockReturnValue(false);
    await tocar(tree, "nova-whatsapp");
    expect(texto(tree)).toContain(T.semWhatsapp);
  });

  it("Ver na lista fecha; Nova condicional recomeça no passo 1", async () => {
    const { tree, onClose } = await guardarEIrAoPronto();
    await tocar(tree, "nova-nova-condicional");
    expect(tem(tree, "nova-passo-1")).toBe(true);
    expect(texto(tree)).toContain(T.rodapeSemCliente);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("prazos (funções puras)", () => {
  it("datas dos chips e limites", () => {
    expect(diaCurto("2026-11-26")).toBe("qui., 26/11");
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(dataDentroDoPrazo("2026-11-26", HOJE)).toBe(true);
    expect(dataDentroDoPrazo("2026-11-25", HOJE)).toBe(false);
    expect(dataDentroDoPrazo("2026-12-26", HOJE)).toBe(true);
    expect(dataDentroDoPrazo("2026-12-27", HOJE)).toBe(false);
    expect(prazoInicial(HOJE, undefined)).toEqual({ dias: 3, data: "2026-11-29" });
    expect(prazoInicial(HOJE, 5)).toEqual({ dias: 0, data: "2026-12-01" });
    expect(prazoInicial(HOJE, 99).dias).toBe(3);
  });
});
