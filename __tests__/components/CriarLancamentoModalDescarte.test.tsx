// ============================================================
// Novo lançamento do crediário · confirmação antes de descartar (12/10/2026)
//
// Relato de cliente: clicar fora do modal fechava e apagava tudo. Cobre:
//   - vazio + fechar (X, fora, Esc/voltar) → fecha direto, sem pergunta;
//   - preenchido + fechar (X, fora, Esc/voltar) → mostra a confirmação e NÃO
//     chama onClose;
//   - "Continuar preenchendo" fecha só a pergunta e mantém os dados;
//   - "Descartar" fecha de verdade e zera o formulário;
//   - salvar com sucesso fecha sem perguntar;
//   - enquanto salva, fora/Esc são ignorados.
// ResponsiveSheet é mockado (expõe onClose e onBackdropPress) no padrão do
// CalculadoraAmbiente.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/anim", () => ({
  Collapsible: ({ open, children }: any) => (open ? children : null),
}));

// O sheet real faz backdrop -> onBackdropPress ?? onClose e Esc -> onClose.
// Aqui o mock guarda as props do último render para o teste "clicar fora".
let mockSheet: any = null;
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: (props: any) => {
    mockSheet = props;
    return props.visible ? props.children : null;
  },
}));

const mockCreate = jest.fn();
jest.mock("@/services/creditApi", () => ({
  MAX_INSTALLMENTS_CEILING: 500,
  creditApi: {
    createManualEntry: (...a: any[]) => mockCreate(...a),
    searchCustomers: jest.fn().mockResolvedValue({ customers: [] }),
    getCustomerHistory: jest.fn().mockResolvedValue({ accounts: [] }),
  },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "emp-1" } }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";

const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const existe = (t: renderer.ReactTestRenderer, id: string) => porId(t, id).length > 0;
const apertar = (t: renderer.ReactTestRenderer, id: string) => act(() => { porId(t, id)[0].props.onPress(); });
const digitar = (t: renderer.ReactTestRenderer, id: string, v: string) => act(() => { porId(t, id)[0].props.onChangeText(v); });
const valorDe = (t: renderer.ReactTestRenderer, id: string) => porId(t, id)[0].props.value;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function montar() {
  const onClose = jest.fn();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<CriarLancamentoModal visible onClose={onClose} />); });
  return { t, onClose };
}

/** Preenche o passo 1 como cliente novo e vai ao passo 2 (detalhes). */
function irParaDetalhes(t: renderer.ReactTestRenderer) {
  apertar(t, "lancamento-novo-cliente");
  digitar(t, "lancamento-novo-nome", "Maria Souza");
  digitar(t, "lancamento-novo-telefone", "11999998888");
  apertar(t, "lancamento-novo-continuar");
}

beforeEach(() => { jest.clearAllMocks(); mockSheet = null; });

describe("CriarLancamentoModal · descartar o que foi preenchido", () => {
  it("o sheet recebe o fechar com a pergunta (fora e Esc/voltar passam por ela)", () => {
    const { t } = montar();
    // Fora e Esc usam a MESMA função: sem onBackdropPress, o sheet cai em onClose.
    expect(mockSheet.onBackdropPress).toBeUndefined();
    expect(typeof mockSheet.onClose).toBe("function");
    t.unmount();
  });

  it("vazio: X fecha direto, sem pergunta", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-fechar");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
  });

  it("vazio: clicar fora / Esc fecha direto", () => {
    const { t, onClose } = montar();
    act(() => { mockSheet.onClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
  });

  it("vazio depois de digitar e apagar: ainda fecha direto", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-novo-cliente");
    digitar(t, "lancamento-novo-nome", "Mar");
    digitar(t, "lancamento-novo-nome", "");
    act(() => { mockSheet.onClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preenchido: clicar fora / Esc mostra a confirmação e NÃO fecha", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-novo-cliente");
    digitar(t, "lancamento-novo-nome", "Maria");
    act(() => { mockSheet.onClose(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(true);
  });

  it("preenchido: o X mostra a confirmação e NÃO fecha", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-novo-cliente");
    digitar(t, "lancamento-novo-nome", "Maria");
    apertar(t, "lancamento-fechar");
    expect(onClose).not.toHaveBeenCalled();
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(true);
  });

  it("'Continuar preenchendo' fecha só a pergunta e mantém os dados", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-novo-cliente");
    digitar(t, "lancamento-novo-nome", "Maria");
    apertar(t, "lancamento-fechar");
    apertar(t, "lancamento-continuar");
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(valorDe(t, "lancamento-novo-nome")).toBe("Maria");
  });

  it("segundo fora/Esc com a pergunta aberta vale como continuar", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-novo-cliente");
    digitar(t, "lancamento-novo-nome", "Maria");
    act(() => { mockSheet.onClose(); });
    act(() => { mockSheet.onClose(); });
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(valorDe(t, "lancamento-novo-nome")).toBe("Maria");
  });

  it("'Descartar' fecha de verdade e zera o formulário", () => {
    const { t, onClose } = montar();
    apertar(t, "lancamento-novo-cliente");
    digitar(t, "lancamento-novo-nome", "Maria");
    apertar(t, "lancamento-fechar");
    apertar(t, "lancamento-descartar");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
    // Reaberto, o formulário está limpo: de volta à busca, e o cadastro novo vazio.
    expect(existe(t, "lancamento-busca")).toBe(true);
    apertar(t, "lancamento-novo-cliente");
    expect(valorDe(t, "lancamento-novo-nome")).toBe("");
  });

  it("valor digitado no passo 2 também pede confirmação", () => {
    const { t, onClose } = montar();
    irParaDetalhes(t);
    expect(existe(t, "lancamento-valor")).toBe(true);
    digitar(t, "lancamento-valor", "15000");
    act(() => { mockSheet.onClose(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(true);
    expect(valorDe(t, "lancamento-valor")).toBe("150,00");
  });

  it("salvar com sucesso fecha sem perguntar", async () => {
    mockCreate.mockResolvedValue({});
    const { t, onClose } = montar();
    irParaDetalhes(t);
    digitar(t, "lancamento-valor", "15000");
    apertar(t, "lancamento-criar");
    await flush();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
  });

  it("falha ao salvar: não fecha e os dados continuam", async () => {
    mockCreate.mockRejectedValue(new Error("rede"));
    const { t, onClose } = montar();
    irParaDetalhes(t);
    digitar(t, "lancamento-valor", "15000");
    apertar(t, "lancamento-criar");
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(valorDe(t, "lancamento-valor")).toBe("150,00");
  });

  it("enquanto salva, fora/Esc são ignorados (fechar zeraria a Idempotency-Key)", async () => {
    let soltar!: (v: any) => void;
    mockCreate.mockReturnValue(new Promise((r) => { soltar = r; }));
    const { t, onClose } = montar();
    irParaDetalhes(t);
    digitar(t, "lancamento-valor", "15000");
    apertar(t, "lancamento-criar");
    await flush();
    act(() => { mockSheet.onClose(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(existe(t, "lancamento-confirmar-descarte")).toBe(false);
    await act(async () => { soltar({}); await Promise.resolve(); await Promise.resolve(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
