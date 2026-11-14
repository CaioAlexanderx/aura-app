// ============================================================
// Caixa — abrir o caixa escolhendo o responsável (14/11/2026).
// Pedido do Caio: a vendedora cadastrada no Caixa (F2, sem login) pode ser a
// responsável pela abertura, para dono e para funcionário logado. Sem
// ninguém cadastrado, abre em nome de quem está logado (antes travava com
// "Cadastre em Equipe", tela que o Essencial nem tem).
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
let mockAuth: any = { user: { id: "u1", name: "Dona Lúcia" }, isStaff: false, company: { id: "empresa-1", member_role: "member" } };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/services/api", () => ({ employeesApi: { list: jest.fn() } }));
jest.mock("@/utils/cashClosePdf", () => ({ openCashClosePdf: jest.fn() }));
const mockAbrir = jest.fn();
jest.mock("@/services/caixaApi", () => ({
  caixaApi: { abrir: (...a: any[]) => mockAbrir(...a), fechar: jest.fn(), movimentos: { list: jest.fn(), registrar: jest.fn(), remover: jest.fn() } },
}));
let mockEmployees: any = { employees: [] };
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    const key = String(opts.queryKey?.[0] || "");
    if (key === "employees") return { data: opts.enabled ? mockEmployees : undefined, isFetching: false };
    return { data: undefined, isFetching: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { OpenCloseCashModal } from "@/components/screens/pdv/OpenCloseCashModal";

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function textoDe(n: any): string {
  return n.findAll((c: any) => typeof c.props?.children === "string").map((c: any) => c.props.children).join(" ");
}
function botaoComTexto(tree: renderer.ReactTestRenderer, txt: RegExp) {
  // O fundo do modal também tem onPress e contém todo o texto: vale o botão
  // mais interno cujo texto é exatamente o procurado.
  const achados = tree.root.findAll((n) => n.props && typeof n.props.onPress === "function").filter((n) => txt.test(textoDe(n).trim()) && textoDe(n).trim().length < 30);
  return achados[achados.length - 1];
}
async function abrirCom(tree: renderer.ReactTestRenderer) {
  await act(async () => { botaoComTexto(tree, /Avancar/)!.props.onPress(); });
  await act(async () => { botaoComTexto(tree, /Avancar/)!.props.onPress(); });
  await act(async () => { botaoComTexto(tree, /^Abrir caixa( Abrir caixa)?$/)!.props.onPress(); });
}
function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<OpenCloseCashModal visible companyId="empresa-1" companyName="Loja" companyCnpj={null} sessaoAtiva={null} onClose={jest.fn()} onSuccess={jest.fn()} />);
  });
  return tree;
}

beforeEach(() => { mockAbrir.mockReset(); mockAbrir.mockResolvedValue({ sessao: {} }); });

describe("Abrir caixa: responsável", () => {
  it("funcionário logado vê a vendedora cadastrada e abre em nome dela", async () => {
    mockAuth = { user: { id: "u2", name: "Marina" }, isStaff: false, company: { id: "empresa-1", member_role: "member" } };
    mockEmployees = { employees: [{ id: "emp-rayza", name: "Rayza", role: "Vendedora", user_id: null }] };
    const tree = montar();
    expect(porTestID(tree, "caixa-abrir-voce")).toHaveLength(1);
    expect(porTestID(tree, "caixa-abrir-pessoa-emp-rayza")).toHaveLength(1);
    await act(async () => { porTestID(tree, "caixa-abrir-pessoa-emp-rayza")[0].props.onPress(); });
    await abrirCom(tree);
    expect(mockAbrir).toHaveBeenCalledWith("empresa-1", 0, "emp-rayza");
  });
  it("dono sem ninguém cadastrado abre em nome próprio (não trava)", async () => {
    mockAuth = { user: { id: "u1", name: "Dona Lúcia" }, isStaff: false, company: { id: "empresa-1", member_role: "owner" } };
    mockEmployees = { employees: [] };
    const tree = montar();
    expect(porTestID(tree, "caixa-abrir-voce")).toHaveLength(1);
    await abrirCom(tree);
    expect(mockAbrir).toHaveBeenCalledWith("empresa-1", 0, null);
  });
  it("a ficha ligada a quem está logado não aparece duas vezes", () => {
    mockAuth = { user: { id: "u1", name: "Dona Lúcia" }, isStaff: false, company: { id: "empresa-1", member_role: "owner" } };
    mockEmployees = { employees: [{ id: "emp-lucia", name: "Dona Lúcia", role: null, user_id: "u1" }, { id: "emp-ana", name: "Ana", role: null, user_id: null }] };
    const tree = montar();
    expect(porTestID(tree, "caixa-abrir-pessoa-emp-lucia")).toHaveLength(0);
    expect(porTestID(tree, "caixa-abrir-pessoa-emp-ana")).toHaveLength(1);
  });
});
