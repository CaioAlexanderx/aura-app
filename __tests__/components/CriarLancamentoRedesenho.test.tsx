// ============================================================
// Novo lançamento do crediário · redesenho (12/10/2026)
//
// Mockup aprovado: docs/mockups/crediario-lancamento-manual.html. Cobre:
//   - "Recentes" aparecem antes de digitar, com o chip de cada cliente;
//   - chip de parcelas atualiza "Nx de R$" ao vivo;
//   - atalho "em 30 dias" no 1º vencimento;
//   - carnê novo é o padrão, o CTA diz "Lançar e criar carnê" e o payload
//     manda new_account: true;
//   - os carnês do cliente só são buscados ao tocar "alterar";
//   - tela Pronto depois do sucesso, com imprimir/WhatsApp/lançar outro;
//   - "Lançar outro" volta ao passo 1 com o formulário limpo.
// Mesmo padrão de mocks do CriarLancamentoModalDescarte.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/anim", () => ({
  Collapsible: ({ open, children }: any) => (open ? children : null),
}));

let mockSheet: any = null;
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: (props: any) => {
    mockSheet = props;
    return props.visible ? props.children : null;
  },
}));

const mockCreate = jest.fn();
const mockHistory = jest.fn();
const mockSearch = jest.fn();
const mockPrint = jest.fn();
jest.mock("@/services/creditApi", () => ({
  MAX_INSTALLMENTS_CEILING: 500,
  printCarne: (...a: any[]) => mockPrint(...a),
  creditApi: {
    createManualEntry: (...a: any[]) => mockCreate(...a),
    searchCustomers: (...a: any[]) => mockSearch(...a),
    getCustomerHistory: (...a: any[]) => mockHistory(...a),
  },
}));
const mockOpenWhatsApp = jest.fn();
jest.mock("@/utils/whatsapp", () => ({
  ...jest.requireActual("@/utils/whatsapp"),
  openWhatsApp: (...a: any[]) => mockOpenWhatsApp(...a),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "emp-1" } }),
}));
const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";

type T = renderer.ReactTestRenderer;
const porId = (t: T, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const existe = (t: T, id: string) => porId(t, id).length > 0;
const apertar = (t: T, id: string) => act(() => { porId(t, id)[0].props.onPress(); });
const digitar = (t: T, id: string, v: string) => act(() => { porId(t, id)[0].props.onChangeText(v); });
const valorDe = (t: T, id: string) => porId(t, id)[0].props.value;
/** Todo o texto visível dentro de um nó (ou da tela inteira). */
const textoEm = (t: T, id?: string) => {
  const raiz = id ? porId(t, id)[0] : t.root;
  return raiz.findAllByType(Text).map((n) => [].concat(n.props.children).filter((c) => typeof c === "string" || typeof c === "number").join("")).join(" | ");
};
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

/** dd/mm/aaaa de hoje (SP) + n dias, calculado aqui sem os helpers do modal. */
function hojeMais(n: number): { br: string; iso: string } {
  const iso0 = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const d = new Date(iso0 + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  const iso = d.toISOString().slice(0, 10);
  const [y, m, dd] = iso.split("-");
  return { br: `${dd}/${m}/${y}`, iso };
}

const RECENTES = [
  { id: "c1", name: "Maria Souza", phone: "(66) 99645-6351", balance: 280, overdue: false, last_activity_at: "2026-10-10T12:00:00Z" },
  { id: "c2", name: "Alexander Olivier", phone: "(66) 99811-2040", balance: 745, overdue: true, oldest_overdue_date: hojeMais(-5).iso, last_activity_at: "2026-10-01T12:00:00Z" },
  { id: "c3", name: "Joana Ribeiro", phone: null, balance: 0, overdue: false, last_activity_at: "2026-09-01T12:00:00Z" },
];

function montar() {
  const onClose = jest.fn();
  let t!: T;
  act(() => { t = renderer.create(<CriarLancamentoModal visible onClose={onClose} recentes={RECENTES} />); });
  return { t, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSheet = null;
  mockSearch.mockResolvedValue({ customers: [] });
  mockHistory.mockResolvedValue({ accounts: [] });
});

describe("Novo lançamento · redesenho", () => {
  it("passo 1: recentes aparecem antes de digitar, com saldo e chip; somem ao buscar", () => {
    const { t } = montar();
    expect(textoEm(t)).toContain("Para quem?");
    expect(existe(t, "lancamento-recente-c1")).toBe(true);
    expect(existe(t, "lancamento-recente-c2")).toBe(true);
    expect(existe(t, "lancamento-recente-c3")).toBe(true);
    const tela = textoEm(t);
    expect(tela).toContain("Recentes");
    expect(tela).toContain("Em dia");
    expect(tela).toContain("Atraso 5d");
    expect(tela).toContain("Quitada");
    expect(textoEm(t, "lancamento-recente-c1")).toContain("R$ 280,00 em aberto");
    // "Cadastrar novo cliente" continua na lista.
    expect(existe(t, "lancamento-novo-cliente")).toBe(true);

    digitar(t, "lancamento-busca", "Ma");
    expect(existe(t, "lancamento-recente-c1")).toBe(false);
    expect(existe(t, "lancamento-novo-cliente")).toBe(true);
    t.unmount();
  });

  it("escolher um recente vai ao passo 2 com o nome e 'trocar' no cabeçalho", () => {
    const { t } = montar();
    apertar(t, "lancamento-recente-c1");
    expect(existe(t, "lancamento-valor")).toBe(true);
    expect(textoEm(t)).toContain("Maria Souza");
    digitar(t, "lancamento-valor", "42000");
    // trocar: volta ao passo 1 sem perder o que foi digitado
    apertar(t, "lancamento-trocar");
    expect(existe(t, "lancamento-busca")).toBe(true);
    apertar(t, "lancamento-recente-c1");
    expect(valorDe(t, "lancamento-valor")).toBe("420,00");
  });

  it("chip de parcelas atualiza 'Nx de R$' ao vivo", () => {
    const { t } = montar();
    apertar(t, "lancamento-recente-c1");
    digitar(t, "lancamento-valor", "42000");
    expect(textoEm(t, "lancamento-por-parcela")).toBe("1x de R$ 420,00");
    apertar(t, "lancamento-parcelas-3");
    expect(textoEm(t, "lancamento-por-parcela")).toBe("3x de R$ 140,00");
    // "outro" abre o número livre
    apertar(t, "lancamento-parcelas-outro");
    digitar(t, "lancamento-parcelas-numero", "7");
    expect(textoEm(t, "lancamento-por-parcela")).toBe("7x de R$ 60,00");
  });

  it("atalho 'em 30 dias' preenche o 1º vencimento", () => {
    const { t } = montar();
    apertar(t, "lancamento-recente-c1");
    apertar(t, "lancamento-venc-30d");
    expect(valorDe(t, "lancamento-vencimento")).toBe(hojeMais(30).br);
  });

  it("carnê novo é o padrão: CTA 'Lançar e criar carnê' e payload com new_account", async () => {
    mockCreate.mockResolvedValue({});
    const { t } = montar();
    apertar(t, "lancamento-recente-c1");
    expect(textoEm(t)).toContain("Vai para um carnê novo");
    expect(textoEm(t, "lancamento-criar")).toContain("Lançar e criar carnê");
    digitar(t, "lancamento-valor", "42000");
    apertar(t, "lancamento-parcelas-3");
    apertar(t, "lancamento-criar");
    await flush();
    const payload = mockCreate.mock.calls[0][1];
    expect(payload).toMatchObject({ customer_id: "c1", amount: 420, installments: 3, new_account: true, period_unit: "month", period_count: 1 });
    expect(payload.account_id).toBeUndefined();
    expect(payload.new_account_name).toBeUndefined();
  });

  it("os carnês só são buscados ao tocar 'alterar' (uma vez por cliente)", async () => {
    mockHistory.mockResolvedValue({
      accounts: [{ id: "acc-1", name: "Compra de 13/09", status: "open", balance: 140, open_count: 1, overdue: false }],
    });
    const { t } = montar();
    apertar(t, "lancamento-recente-c1");
    await flush();
    expect(mockHistory).not.toHaveBeenCalled();

    apertar(t, "lancamento-carne-alterar");
    await flush();
    expect(mockHistory).toHaveBeenCalledTimes(1);
    expect(mockHistory).toHaveBeenCalledWith("emp-1", "c1");

    apertar(t, "lancamento-carne-existing");
    expect(existe(t, "lancamento-carne-conta-acc-1")).toBe(true);
    apertar(t, "lancamento-carne-conta-acc-1");
    expect(textoEm(t, "lancamento-criar")).toContain("Lançar no carnê");
    apertar(t, "lancamento-carne-general");
    expect(textoEm(t, "lancamento-criar")).toContain("Lançar na conta");

    // fechar e abrir de novo não busca outra vez
    apertar(t, "lancamento-carne-alterar");
    apertar(t, "lancamento-carne-alterar");
    await flush();
    expect(mockHistory).toHaveBeenCalledTimes(1);
  });

  it("depois do sucesso mostra Pronto com imprimir, WhatsApp, lançar outro e fechar", async () => {
    mockCreate.mockResolvedValue({
      customer: { id: "c1", name: "Maria Souza" },
      installments: [],
      new_balance: 700,
      account_id: "acc-9",
    });
    const { t, onClose } = montar();
    apertar(t, "lancamento-recente-c1");
    digitar(t, "lancamento-valor", "42000");
    apertar(t, "lancamento-parcelas-3");
    apertar(t, "lancamento-criar");
    await flush();

    expect(existe(t, "lancamento-pronto")).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    // as invalidações de cache continuam no sucesso
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["credit-balances", "emp-1"] });
    const pronto = textoEm(t, "lancamento-pronto");
    expect(pronto).toContain("Lançado no crediário");
    expect(pronto).toContain("Saldo em aberto agora: R$ 700,00");
    expect(pronto).toContain("3x de R$ 140,00 · mensal");
    for (const id of ["lancamento-imprimir-a4", "lancamento-imprimir-bobina", "lancamento-whatsapp", "lancamento-outro", "lancamento-pronto-fechar"]) {
      expect(existe(t, id)).toBe(true);
    }

    apertar(t, "lancamento-imprimir-a4");
    expect(mockPrint).toHaveBeenCalledWith("emp-1", "c1", { format: "a4", accountId: "acc-9" });
    apertar(t, "lancamento-imprimir-bobina");
    expect(mockPrint).toHaveBeenLastCalledWith("emp-1", "c1", { format: "bobina", accountId: "acc-9" });

    apertar(t, "lancamento-whatsapp");
    expect(mockOpenWhatsApp).toHaveBeenCalledTimes(1);
    const [fone, msg] = mockOpenWhatsApp.mock.calls[0];
    expect(fone).toBe("(66) 99645-6351");
    expect(msg).toMatch(/^Olá Maria, lançamos sua compra de R\$ 420,00 em 3x de R\$ 140,00 no crediário\. 1ª parcela em \d{2}\/\d{2}\.$/);

    apertar(t, "lancamento-pronto-fechar");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cliente sem telefone: Pronto esconde o WhatsApp", async () => {
    mockCreate.mockResolvedValue({ customer: { id: "c3", name: "Joana Ribeiro" }, new_balance: 50, account_id: null });
    const { t } = montar();
    apertar(t, "lancamento-recente-c3");
    digitar(t, "lancamento-valor", "5000");
    apertar(t, "lancamento-criar");
    await flush();
    expect(existe(t, "lancamento-pronto")).toBe(true);
    expect(existe(t, "lancamento-whatsapp")).toBe(false);
    expect(existe(t, "lancamento-imprimir-a4")).toBe(true);
  });

  it("'Lançar outro' volta ao passo 1 com o formulário limpo, sem fechar", async () => {
    mockCreate.mockResolvedValue({ customer: { id: "c1", name: "Maria Souza" }, new_balance: 700, account_id: "acc-9" });
    const { t, onClose } = montar();
    apertar(t, "lancamento-recente-c1");
    digitar(t, "lancamento-valor", "42000");
    apertar(t, "lancamento-criar");
    await flush();
    const chave1 = mockCreate.mock.calls[0][2];

    apertar(t, "lancamento-outro");
    expect(onClose).not.toHaveBeenCalled();
    expect(existe(t, "lancamento-busca")).toBe(true);
    expect(existe(t, "lancamento-recente-c1")).toBe(true);
    expect(textoEm(t)).toContain("Para quem?");

    // segundo lançamento: formulário limpo e Idempotency-Key nova
    apertar(t, "lancamento-recente-c2");
    expect(valorDe(t, "lancamento-valor")).toBe("");
    digitar(t, "lancamento-valor", "1000");
    apertar(t, "lancamento-criar");
    await flush();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][2]).not.toBe(chave1);
  });
});
