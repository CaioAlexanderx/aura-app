// ============================================================
// Vendas › Condicionais: a lista (C5, 26/11/2026)
//
// O que o mockup aprovado em 25/11 (tela 1) pede da lista:
//   1. totalizador "Com clientes agora" com o valor e "em N peças com M
//      clientes. Ainda são da loja.", Vencem hoje e Atrasadas;
//   2. chips Em aberto (padrão) · Vence hoje · Atrasadas · Concluídas com as
//      contagens; trocar de chip e buscar pedem o filtro e o q certos;
//   3. atrasada em vermelho com os dias e "Lembrar" (WhatsApp manual, texto
//      do mockup, aberto dentro do clique);
//   4. "Falta cobrar" com "R$ X para cobrar" e "nada mais com ela";
//   5. selo "Com a cliente" tracejado e "Parcial";
//   6. consolidado: /me/condicionais, chips das lojas e selo da loja na linha;
//   7. vazio, erro com "Tentar de novo", carregando, sem resultado na busca;
//   8. celular: cartões, só o cartão "Com clientes agora".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockLargura = 1280;
let mockConsolidado = false;
const mockRequest = jest.fn();
const mockOpenWhatsApp = jest.fn((..._a: any[]) => true);
const mockToastInfo = jest.fn();

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/Toast", () => ({ toast: { info: (...a: any[]) => mockToastInfo(...a), success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/JanelaEmpilhada", () => ({ JanelaEmpilhada: ({ children }: any) => children }));
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/utils/whatsapp", () => {
  const real = jest.requireActual("@/utils/whatsapp");
  return { ...real, openWhatsApp: (...a: any[]) => mockOpenWhatsApp(...a) };
});
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = {
      user: { id: "u1", is_staff: true }, token: "t", isHydrated: true,
      company: mockConsolidado ? null : { id: "comp-1", plan: "essencial" },
      consolidatedView: mockConsolidado,
    };
    return typeof sel === "function" ? sel(st) : st;
  },
}));
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return new Proxy(rn, {
    get(alvo: any, k: string) {
      if (k === "useWindowDimensions") return () => ({ width: mockLargura, height: 900, scale: 1, fontScale: 1 });
      return alvo[k];
    },
  });
});

import { AbaCondicionais } from "@/components/screens/vendas/condicionais/AbaCondicionais";
import { textoDoLembrete } from "@/components/screens/vendas/condicionais/regrasDasCondicionais";
import { parametrosDaLista } from "@/hooks/useCondicionais";
import { CondicionalCoresLight, CondicionalCoresDark } from "@/constants/colors";

const HOJE = "2026-11-25";

function linha(over: any = {}) {
  return {
    id: "k1", company_id: "comp-1", company_name: "Loja Centro", numero: 31, numero_exibicao: "C-0031",
    status: "aberta", situacao: "com_cliente", parcial: false, dias_de_atraso: 0,
    customer_id: "cu1", customer_name: "Marina Duarte", customer_phone: "(11) 98888-0101", seller_name: "Jéssica",
    due_date: "2026-11-28", notes: null, pecas: 3, pecas_com_cliente: 3, pecas_ficou: 0, pecas_a_cobrar: 0,
    pecas_voltou: 0, valor_total: 389.7, valor_com_cliente: 389.7, valor_a_cobrar: 0,
    primeira_peca: "Vestido Midi Lívia", created_at: "2026-11-25T13:00:00Z", closed_at: null, cancelled_at: null,
    ...over,
  };
}

const ATRASADA = linha({
  id: "k28", numero: 28, numero_exibicao: "C-0028", situacao: "atrasada", dias_de_atraso: 4,
  customer_name: "Bianca Reis", customer_phone: "(11) 97777-0155", seller_name: "Paula",
  due_date: "2026-11-21", pecas: 4, pecas_com_cliente: 4, valor_total: 579.6, valor_com_cliente: 579.6,
  primeira_peca: "Calça Wide Lara", created_at: "2026-11-18T15:00:00Z",
});
const A_COBRAR = linha({
  id: "k32", numero: 32, numero_exibicao: "C-0032", situacao: "a_cobrar", parcial: true,
  customer_name: "Rafaela Souza", due_date: "2026-11-26", pecas: 3, pecas_com_cliente: 0, pecas_ficou: 1,
  pecas_a_cobrar: 1, pecas_voltou: 2, valor_total: 489.6, valor_com_cliente: 0, valor_a_cobrar: 259.8,
});
const HOJE_LINHA = linha({
  id: "k30", numero: 30, numero_exibicao: "C-0030", situacao: "vence_hoje", customer_name: "Helena Prado",
  due_date: HOJE, pecas: 2, pecas_com_cliente: 2, valor_total: 259.8, valor_com_cliente: 259.8,
});
const PARCIAL = linha({
  id: "k29", numero: 29, numero_exibicao: "C-0029", company_id: "comp-2", company_name: "Loja Shopping",
  situacao: "com_cliente", parcial: true, customer_name: "Tainá Moraes", due_date: "2026-11-26",
  pecas: 3, pecas_com_cliente: 1, pecas_voltou: 2, valor_com_cliente: 149.9,
});
const ABERTA = linha();

function resposta(over: any = {}) {
  return {
    condicionais: [ATRASADA, A_COBRAR, HOJE_LINHA, PARCIAL, ABERTA],
    filtro: "em_aberto", hoje: HOJE,
    totalizador: { valor: 1379, pecas: 10, clientes: 4, texto: "R$ 1.379,00 em 10 peças com 4 clientes" },
    valor_a_cobrar: 259.8,
    counts: { em_aberto: 5, com_cliente: 4, vence_hoje: 1, atrasadas: 1, a_cobrar: 1, concluidas: 2, canceladas: 0, todas: 7 },
    pagination: { page: 1, limit: 100, total: 5, pages: 1 },
    ...over,
  };
}

async function montar(el: React.ReactElement = <AbaCondicionais />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

function textos(tree: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.children) n.children.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join("");
}
function um(tree: any, id: string) {
  const a = tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
  if (!a.length) throw new Error("sem testID " + id);
  return a[0];
}
/** O Pressable com o testID (estado de acessibilidade e estilo). */
function nativo(tree: any, id: string) {
  const a = tree.root.findAll((n: any) => n.props && n.props.testID === id && n.props.accessibilityState !== undefined);
  if (!a.length) throw new Error("sem nativo " + id);
  return a[0];
}
/** O nó tocável (com onPress) com o testID. */
function tocavel(tree: any, id: string) {
  const a = tree.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onPress === "function");
  if (!a.length) throw new Error("sem tocável " + id);
  return a[0];
}
function tocavelLongo(tree: any, id: string) {
  const a = tree.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onLongPress === "function");
  if (!a.length) throw new Error("sem toque longo " + id);
  return a[0];
}
function tem(tree: any, id: string) {
  return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false }).length > 0;
}
function textoDe(no: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === "string" || typeof n === "number") { out.push(String(n)); return; }
    (n.children || []).forEach(walk);
  };
  walk(no);
  return out.join("");
}

beforeEach(() => {
  mockLargura = 1280;
  mockConsolidado = false;
  mockRequest.mockReset();
  mockOpenWhatsApp.mockClear();
  mockToastInfo.mockClear();
  mockRequest.mockImplementation(() => Promise.resolve(resposta()));
});

describe("cores e parâmetros", () => {
  it("azul-petróleo do mockup no claro e no escuro", () => {
    expect(CondicionalCoresLight.cd).toBe("#0e7490");
    expect(CondicionalCoresDark.cdInk).toBe("#67e8f9");
    expect(CondicionalCoresDark.cd).toBe("#22d3ee");
  });
  it("filtro, busca e loja na query", () => {
    expect(parametrosDaLista("em_aberto", "")).toBe("filtro=em_aberto&limit=100");
    expect(parametrosDaLista("atrasadas", " Bia ", "comp-2")).toBe("filtro=atrasadas&q=Bia&company_id=comp-2&limit=100");
  });
});

describe("Vendas › Condicionais: lista", () => {
  it("1. totalizador e cartões com os textos do mockup", async () => {
    const tree = await montar();
    expect(mockRequest).toHaveBeenCalledWith("/companies/comp-1/condicionais?filtro=em_aberto&limit=100");
    expect(textoDe(um(tree, "kpi-com-clientes-valor"))).toBe("R$ 1.379,00");
    expect(textoDe(um(tree, "kpi-com-clientes-sub"))).toBe("em 10 peças com 4 clientes. Ainda são da loja.");
    expect(um(tree, "kpi-com-clientes").props.accessibilityLabel).toBe("R$ 1.379,00 em 10 peças com 4 clientes");
    const t = textos(tree);
    expect(t).toContain("Com clientes agora");
    expect(textoDe(um(tree, "kpi-vencem-hoje"))).toBe("Vencem hoje1R$ 259,80 em 2 peças");
    expect(textoDe(um(tree, "kpi-atrasadas"))).toBe("Atrasadas1R$ 579,60 em 4 peças");
  });

  it("2. chips com contagem; trocar de chip e buscar pedem o filtro certo", async () => {
    const tree = await montar();
    expect(textoDe(um(tree, "chip-em_aberto"))).toBe("Em aberto5");
    expect(textoDe(um(tree, "chip-vence_hoje"))).toBe("Vence hoje1");
    expect(textoDe(um(tree, "chip-atrasadas"))).toBe("Atrasadas1");
    expect(textoDe(um(tree, "chip-concluidas"))).toBe("Concluídas2");
    expect(nativo(tree, "chip-em_aberto").props.accessibilityState).toEqual({ selected: true });
    expect(tem(tree, "chip-resolver")).toBe(false);

    mockRequest.mockImplementation(() => Promise.resolve(resposta({ condicionais: [ATRASADA], filtro: "atrasadas" })));
    await act(async () => { um(tree, "chip-atrasadas").props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockRequest).toHaveBeenCalledWith("/companies/comp-1/condicionais?filtro=atrasadas&limit=100");
    expect(nativo(tree, "chip-atrasadas").props.accessibilityState).toEqual({ selected: true });

    act(() => { um(tree, "busca-condicionais").props.onChangeText("Bianca"); });
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockRequest).toHaveBeenCalledWith("/companies/comp-1/condicionais?filtro=atrasadas&q=Bianca&limit=100");
    expect(um(tree, "busca-condicionais").props.placeholder).toBe("Cliente, telefone ou número");
  });

  it("3. atrasada em vermelho com os dias; Lembrar abre a prévia e o WhatsApp no clique", async () => {
    const tree = await montar();
    const linhaAtrasada = um(tree, "condicional-k28");
    const t = textoDe(linhaAtrasada);
    expect(t).toContain("C-0028");
    expect(t).toContain("Bianca Reis");
    expect(t).toContain("4 peças: Calça Wide Lara e mais 3 · Paula");
    expect(t).toContain("R$ 579,60");
    expect(textoDe(um(tree, "prazo-k28"))).toBe("era sáb., 21/11atrasada 4 dias");
    expect(textoDe(um(tree, "selo-atrasada"))).toBe("Atrasada");
    // Só a atrasada tem Lembrar.
    expect(tem(tree, "lembrar-k28")).toBe(true);
    expect(tem(tree, "lembrar-k1")).toBe(false);
    expect(tem(tree, "lembrar-k30")).toBe(false);

    await act(async () => { um(tree, "lembrar-k28").props.onPress(); });
    expect(textos(tree)).toContain("Lembrar a Bianca");
    expect(textos(tree)).toContain("Abre o WhatsApp com o texto pronto. Você confere e envia.");
    const esperado = "Oi, Bianca! Tudo bem? Aqui é a Paula, da Loja Centro.\n" +
      "Passando para lembrar das 4 peças em condicional que estão com você desde 18/11. O combinado era até sábado, 21/11.\n\n" +
      "Consegue passar na loja ou me contar com quais vai ficar? Obrigada!";
    expect(textoDe(um(tree, "lembrar-texto"))).toBe(esperado);
    expect(mockOpenWhatsApp).not.toHaveBeenCalled();
    await act(async () => { um(tree, "lembrar-abrir").props.onPress(); });
    expect(mockOpenWhatsApp).toHaveBeenCalledWith("(11) 97777-0155", esperado);
    expect(tem(tree, "lembrar-condicional")).toBe(false);
  });

  it("4. Falta cobrar: R$ X para cobrar, nada mais com ela, selo próprio", async () => {
    const tree = await montar();
    const t = textoDe(um(tree, "condicional-k32"));
    expect(t).toContain("1 peça ficou · 2 voltaram");
    expect(textoDe(um(tree, "prazo-k32"))).toBe("R$ 259,80 para cobrar" + "nada mais com ela");
    expect(textoDe(um(tree, "selo-a_cobrar"))).toBe("Falta cobrar");
    // Ícone de moeda no selo e sem "Parcial" (não tem peça com ela).
    expect(um(tree, "selo-a_cobrar").findAll((n: any) => n.type === "Icon" && n.props.name === "coin").length).toBe(1);
    expect(tem(tree, "parcial-k32")).toBe(false);
  });

  it("5. Com a cliente tracejado com cabide; Vence hoje; Parcial", async () => {
    const tree = await montar();
    const selo = tree.root.findAll((n: any) => n.props && n.props.testID === "selo-com_cliente", { deep: false })[0];
    const estilo = [].concat(...(selo.props.style as any[]).filter(Boolean));
    expect(estilo.some((x: any) => x && x.borderStyle === "dashed")).toBe(true);
    expect(selo.findAll((n: any) => n.type === "Icon" && n.props.name === "hanger").length).toBe(1);
    expect(textoDe(um(tree, "prazo-k30"))).toBe("hoje, 25/11");
    expect(textoDe(um(tree, "prazo-k29"))).toBe("amanhã, 26/11");
    expect(textoDe(um(tree, "prazo-k1"))).toBe("sáb., 28/11");
    expect(tem(tree, "parcial-k29")).toBe(true);
    expect(textoDe(um(tree, "condicional-k29"))).toContain("1 peça com ela · 2 já voltaram");
    // Sem botão de criar, de decidir ou de cobrar nesta fase.
    const t = textos(tree);
    expect(t).not.toContain("Nova condicional");
    expect(t).not.toContain("Decidir");
    expect(t).not.toContain("Cobrar no Caixa");
  });

  it("6. consolidado: /me/condicionais, chips das lojas e selo da loja", async () => {
    mockConsolidado = true;
    mockRequest.mockImplementation(() => Promise.resolve(resposta({
      company_count: 2,
      por_empresa: [
        { company_id: "comp-1", company_name: "Loja Centro", totalizador: { valor: 1229.1, pecas: 9, clientes: 3, texto: "" }, valor_a_cobrar: 259.8, counts: { em_aberto: 4 } },
        { company_id: "comp-2", company_name: "Loja Shopping", totalizador: { valor: 149.9, pecas: 1, clientes: 1, texto: "" }, valor_a_cobrar: 0, counts: { em_aberto: 1 } },
      ],
    })));
    const tree = await montar();
    expect(mockRequest).toHaveBeenCalledWith("/me/condicionais?filtro=em_aberto&limit=100");
    expect(textoDe(um(tree, "kpi-com-clientes-sub"))).toBe("em 10 peças com 4 clientes · Loja Centro 9 · Loja Shopping 1. Ainda são da loja.");
    expect(textoDe(um(tree, "loja-todas"))).toBe("Todas as lojas5");
    expect(textoDe(um(tree, "loja-comp-1"))).toBe("Loja Centro4");
    expect(textoDe(um(tree, "loja-comp-2"))).toBe("Loja Shopping1");
    expect(textoDe(um(tree, "loja-da-linha-k29"))).toBe("Loja Shopping");
    // Uma linha só, reticências no fim; nome inteiro no toque longo.
    const textoDoSelo = um(tree, "loja-da-linha-k29").findAll((n: any) => n.props && n.props.numberOfLines === 1 && n.props.children === "Loja Shopping");
    expect(textoDoSelo.length).toBeGreaterThan(0);
    expect(textoDoSelo[0].props.ellipsizeMode).toBe("tail");
    await act(async () => { tocavelLongo(tree, "loja-da-linha-k29").props.onLongPress(); });
    expect(mockToastInfo).toHaveBeenCalledWith("Loja Shopping");

    await act(async () => { um(tree, "loja-comp-2").props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockRequest).toHaveBeenCalledWith("/me/condicionais?filtro=em_aberto&company_id=comp-2&limit=100");
    // Os chips das lojas continuam todos (vêm da consulta sem loja).
    expect(tem(tree, "loja-comp-1")).toBe(true);
    expect(nativo(tree, "loja-comp-2").props.accessibilityState).toEqual({ selected: true });
  });

  it("7a. vazio, primeira vez: cabide e o texto do mockup, sem cartões nem chips", async () => {
    mockRequest.mockImplementation(() => Promise.resolve(resposta({
      condicionais: [], totalizador: { valor: 0, pecas: 0, clientes: 0, texto: "R$ 0,00 em 0 peças com 0 clientes" },
      counts: { em_aberto: 0, com_cliente: 0, vence_hoje: 0, atrasadas: 0, a_cobrar: 0, concluidas: 0, canceladas: 0, todas: 0 },
    })));
    const tree = await montar();
    expect(tem(tree, "condicionais-vazio")).toBe(true);
    const t = textos(tree);
    expect(t).toContain("Nenhuma condicional por aqui");
    expect(t).toContain("Quando uma cliente quiser levar peças para experimentar em casa, registre aqui. A loja sabe o que saiu, com quem está e até quando volta.");
    expect(um(tree, "condicionais-vazio").findAll((n: any) => n.type === "Icon" && n.props.name === "hanger").length).toBe(1);
    expect(tem(tree, "kpi-com-clientes")).toBe(false);
    expect(tem(tree, "chip-em_aberto")).toBe(false);
  });

  it("7b. erro: texto do mockup e Tentar de novo busca de novo", async () => {
    mockRequest.mockImplementation(() => Promise.reject(new Error("rede")));
    const tree = await montar();
    // A consulta tenta 1 vez a mais (retry: 1) antes de mostrar o erro.
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
    expect(tem(tree, "condicionais-erro")).toBe(true);
    const t = textos(tree);
    expect(t).toContain("Não deu para buscar as condicionais agora.");
    expect(t).toContain("A internet pode ter caído. Nada foi perdido: as peças continuam marcadas com as clientes.");
    expect(t).not.toContain("rede");
    const antes = mockRequest.mock.calls.length;
    mockRequest.mockImplementation(() => Promise.resolve(resposta()));
    await act(async () => { tocavel(tree, "condicionais-tentar").props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockRequest.mock.calls.length).toBeGreaterThan(antes);
    expect(tem(tree, "condicional-k28")).toBe(true);
  });

  it("7c. carregando: skeleton e o texto do mockup", async () => {
    mockRequest.mockImplementation(() => new Promise(() => {}));
    const tree = await montar();
    expect(tem(tree, "condicionais-carregando")).toBe(true);
    expect(tree.root.findAll((n: any) => n.type === "ListSkeleton").length).toBe(1);
    expect(textos(tree)).toContain("Buscando as condicionais…");
  });

  it("7d. busca sem resultado", async () => {
    const tree = await montar();
    mockRequest.mockImplementation((p: string) => Promise.resolve(p.includes("q=") ? resposta({ condicionais: [] }) : resposta()));
    act(() => { um(tree, "busca-condicionais").props.onChangeText("Zuleica"); });
    // A busca sai 300 ms depois da última tecla.
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(tem(tree, "condicionais-sem-resultado-busca")).toBe(true);
    expect(textos(tree)).toContain("Nenhuma condicional com essa busca.");
    // Os cartões do topo continuam (são das abertas, não da busca).
    expect(textoDe(um(tree, "kpi-com-clientes-valor"))).toBe("R$ 1.379,00");
  });

  it("8. celular: cartões, só o cartão Com clientes agora, alvos de 44 px", async () => {
    mockLargura = 375;
    const tree = await montar();
    expect(tem(tree, "condicionais-cartoes")).toBe(true);
    expect(tem(tree, "condicionais-tabela")).toBe(false);
    expect(tem(tree, "kpi-vencem-hoje")).toBe(false);
    expect(tem(tree, "kpi-atrasadas")).toBe(false);
    expect(tem(tree, "kpi-com-clientes")).toBe(true);
    expect(textoDe(um(tree, "prazo-k28"))).toContain("atrasada 4 dias · era 21/11");
    expect(textoDe(um(tree, "prazo-k32"))).toContain("para cobrar · 1 peça ficou");
    expect(textoDe(um(tree, "prazo-k1"))).toContain("volta até sáb., 28/11");
    const chip = nativo(tree, "chip-em_aberto");
    const flat = (x: any): any[] => (Array.isArray(x) ? x.flatMap(flat) : x ? [x] : []);
    const estilo = Object.assign({}, ...flat(chip.props.style));
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("concluída: com venda fica sem valor (nunca \"—\"); tudo devolvido segue o mockup", async () => {
    const VENDIDA = linha({
      id: "k27", numero_exibicao: "C-0027", status: "encerrada", situacao: "concluida", pecas: 2, pecas_com_cliente: 0,
      pecas_ficou: 1, pecas_voltou: 1, valor_com_cliente: 0, closed_at: "2026-11-24T18:00:00Z",
    });
    const DEVOLVIDA = linha({
      id: "k26", numero_exibicao: "C-0026", status: "encerrada", situacao: "concluida", pecas: 3, pecas_com_cliente: 0,
      pecas_ficou: 0, pecas_voltou: 3, valor_com_cliente: 0, closed_at: "2026-11-23T18:00:00Z",
    });
    mockRequest.mockImplementation(() => Promise.resolve(resposta({ condicionais: [VENDIDA, DEVOLVIDA] })));
    let tree = await montar();
    expect(textoDe(um(tree, "valor-k27"))).toBe("");
    expect(textoDe(um(tree, "condicional-k27"))).toContain("Ficou 1 de 2 peças");
    expect(textoDe(um(tree, "valor-k26"))).toBe("—");
    expect(textoDe(um(tree, "prazo-k27"))).toBe("concluída em 24/11");
    mockLargura = 375;
    tree = await montar();
    expect(tem(tree, "valor-k27")).toBe(false);
    expect(textoDe(um(tree, "valor-k26"))).toBe("Sem venda");
  });

  it("selo Cancelada em cinza neutro", async () => {
    mockRequest.mockImplementation(() => Promise.resolve(resposta({ condicionais: [linha({ id: "k9", status: "cancelada", situacao: "cancelada" })] })));
    const tree = await montar();
    expect(textoDe(um(tree, "selo-cancelada"))).toBe("Cancelada");
  });

  it("linha só é tocável com onAbrir (o detalhe é do C10)", async () => {
    const onAbrir = jest.fn();
    const tree = await montar(<AbaCondicionais onAbrir={onAbrir} />);
    await act(async () => { tocavel(tree, "condicional-k1").props.onPress(); });
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: "k1" }));
  });
});

describe("texto do lembrete", () => {
  it("sem vendedora e com 1 peça", () => {
    const t = textoDoLembrete(linha({ seller_name: null, pecas_com_cliente: 1, due_date: "2026-11-21", created_at: "2026-11-18T15:00:00Z" }) as any);
    expect(t.startsWith("Oi, Marina! Tudo bem? Aqui é da Loja Centro.\nPassando para lembrar da 1 peça em condicional que está com você desde 18/11.")).toBe(true);
  });
});
