// ============================================================
// Gestão Aura › Hoje › Receita › Extrato bancário (13/10/2026)
//
// Aura-backend #810: o OFX da conta da Aura é conciliado com os repasses da
// Asaas. A seção mora no detalhe do bloco Receita: anexar o arquivo (mês no
// seletor), tabela por mês (Asaas × banco × diferença × situação) e, ao
// tocar num mês, o detalhe com conciliar / ignorar / reabrir e apagar.
// A API é mockada com as formas do contrato (ofx-conciliacao-contrato).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Line: stub("Line"), Text: stub("SvgText"),
  };
});
// O Modal do react-native-web usa portal, que o test renderer não monta.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return Object.setPrototypeOf({ Modal: ({ visible, children }: any) => (visible ? children : null) }, RN);
});
jest.mock("@/components/admin/painel/arquivoOfx", () => ({
  escolherArquivoOfx: jest.fn(),
  lerOfxDisponivel: () => true,
  pareceOfx: () => true,
}));
jest.mock("@/services/adminApi", () => ({
  adminApi: {
    painel: {
      hoje: jest.fn(), bloco: jest.fn(), ficha: jest.fn(), layout: jest.fn(), salvarLayout: jest.fn(), recalcular: jest.fn(),
      ofx: {
        extratos: jest.fn(), detalhe: jest.fn(), importar: jest.fn(),
        conciliar: jest.fn(), ignorar: jest.fn(), reabrir: jest.fn(), apagar: jest.fn(),
      },
    },
  },
}));

import { PainelHoje } from "@/components/admin/painel/PainelHoje";
import { PAINEL_FALLBACK_DEV } from "@/components/admin/painel/usePainelHoje";
import { adminApi } from "@/services/adminApi";
import { escolherArquivoOfx } from "@/components/admin/painel/arquivoOfx";
import { toast } from "@/components/Toast";

const api = (adminApi as any).painel as Record<string, jest.Mock>;
const ofx = (adminApi as any).painel.ofx as Record<string, jest.Mock>;
const escolher = escolherArquivoOfx as jest.Mock;
const fx = (nome: string) => JSON.parse(JSON.stringify(require("../__fixtures__/painel/" + nome + ".json")));

const MESES = () => ({
  dia: "2026-10-13",
  meses: [
    {
      mes: "2026-10", rotulo: "Out/2026", asaas: 1250.5, pagamentos: 9, banco: null, diferenca: null,
      status: "sem extrato", detalhe: null, conciliado: null, pendentes: null, sem_credito: null, extratos: [],
    },
    {
      mes: "2026-09", rotulo: "Set/2026", asaas: 2340, pagamentos: 14, banco: 2200, diferenca: -140,
      status: "pendências", detalhe: "2 créditos sem pagamento na Asaas",
      conciliado: { n: 12, valor: 2200 }, pendentes: { n: 2, valor: 140 }, sem_credito: { n: 0, valor: 0 },
      extratos: [{ id: "55", nome_arquivo: "extrato-setembro.ofx", importado_em: "2026-10-02T13:00:00Z", total_creditos: 2340, linhas: 16 }],
    },
    {
      mes: "2026-08", rotulo: "Ago/2026", asaas: 1800, pagamentos: 10, banco: 1800, diferenca: 0,
      status: "conciliado", detalhe: null,
      conciliado: { n: 10, valor: 1800 }, pendentes: { n: 0, valor: 0 }, sem_credito: { n: 0, valor: 0 },
      extratos: [{ id: "41", nome_arquivo: "extrato-agosto.ofx", importado_em: "2026-09-02T13:00:00Z", total_creditos: 1800, linhas: 11 }],
    },
  ],
});

const DETALHE = () => ({
  extrato: { id: "55", mes: "2026-09", nome_arquivo: "extrato-setembro.ofx", importado_em: "2026-10-02T13:00:00Z", importado_por: "u1", total_creditos: 2340, linhas: 16 },
  resumo: {
    creditos: 14, total_creditos: 2340, debitos: 2,
    conciliados: { n: 12, valor: 2200, com_taxa: 3 },
    pendentes: { n: 2, valor: 140 }, ignorados: { n: 2, valor: -80 },
  },
  lancamentos: [
    { id: "901", data: "2026-09-05", valor: 140.83, descricao: "CREDITO ASAAS PIX", fitid: "F-901", tipo: "credito", status: "pendente", conciliado_com: null, com_taxa: false },
    { id: "902", data: "2026-09-08", valor: 99.9, descricao: "CREDITO ASAAS CARTAO", fitid: "F-902", tipo: "credito", status: "conciliado", conciliado_com: "pay_aaa", com_taxa: true },
    { id: "903", data: "2026-09-09", valor: 30, descricao: "TRANSFERENCIA RECEBIDA", fitid: "F-903", tipo: "credito", status: "ignorado", conciliado_com: null, com_taxa: false },
    { id: "904", data: "2026-09-10", valor: -80, descricao: "TARIFA BANCARIA", fitid: "F-904", tipo: "debito", status: "ignorado", conciliado_com: null, com_taxa: false },
  ],
  pagamentos_disponiveis: [
    { pagamento_id: "pay_far", log_id: "7", company_id: null, valor: 300, liquido: 290, data: "2026-09-25" },
    { pagamento_id: "pay_igual", log_id: "8", company_id: "c1", valor: 140.83, liquido: 137.2, data: "2026-09-04" },
  ],
});

jest.setTimeout(30000);

let dateNow: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  PAINEL_FALLBACK_DEV.dadosDeExemplo = false;
  delete (global as any).__DEV__;
  // 13/10/2026 12:00 em Brasília: o mês anterior é setembro.
  dateNow = jest.spyOn(Date, "now").mockReturnValue(new Date("2026-10-13T15:00:00Z").getTime());
  api.hoje.mockImplementation(async () => fx("hoje"));
  api.bloco.mockImplementation(async (id: string) => {
    const d = fx("blocos." + id);
    if (id === "receita") {
      d.listas.splice(3, 0, {
        titulo: "Conferência com o extrato",
        colunas: [
          { chave: "mes_rotulo", rotulo: "Mês", tipo: "texto" }, { chave: "asaas", rotulo: "Asaas", tipo: "moeda" },
          { chave: "banco", rotulo: "Banco", tipo: "moeda" }, { chave: "diferenca", rotulo: "Diferença", tipo: "moeda" },
          { chave: "status", rotulo: "Situação", tipo: "texto" },
        ],
        linhas: [{ mes_rotulo: "Set/2026", asaas: 2340, banco: 2200, diferenca: -140, status: "pendências", mes: "2026-09", detalhe: null, extrato_id: "55" }],
      });
    }
    return d;
  });
  api.ficha.mockImplementation(async () => fx("clientes.ficha"));
  api.layout.mockImplementation(async () => fx("layout.get"));
  api.recalcular.mockImplementation(async () => fx("recalcular"));
  ofx.extratos.mockImplementation(async () => MESES());
  ofx.detalhe.mockImplementation(async () => DETALHE());
  ofx.importar.mockResolvedValue({
    ok: true, duplicado: false, extrato: { id: "60", mes: "2026-09", nome_arquivo: "extrato.ofx" },
    importados: 12, duplicados: 0, creditos: 11, conciliados: 9, com_taxa: 2, pendentes: 2,
  });
  ofx.conciliar.mockResolvedValue({ ok: true, lancamento: {} });
  ofx.ignorar.mockResolvedValue({ ok: true, lancamento: {} });
  ofx.reabrir.mockResolvedValue({ ok: true, lancamento: {} });
  ofx.apagar.mockResolvedValue({ ok: true, id: "55", lancamentos_removidos: 16 });
  escolher.mockResolvedValue({ nome: "extrato.ofx", texto: "OFXHEADER:100\n<OFX><STMTTRN></STMTTRN></OFX>" });
});

afterEach(() => { dateNow.mockRestore(); });

async function flush(vezes = 4) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function medir(tree: renderer.ReactTestRenderer, width: number) {
  await act(async () => {
    tree.root.findAllByProps({ testID: "painel-hoje" }, { deep: false })[0].props.onLayout({ nativeEvent: { layout: { width } } });
  });
}

const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
// Texto visível da árvore, com os pedaços de cada <Text> juntos.
function plano(no: any): string {
  if (no == null) return "";
  if (typeof no === "string") return no;
  if (Array.isArray(no)) return no.map(plano).join("");
  return plano(no.children);
}
const text = (tree: renderer.ReactTestRenderer) => plano(tree.toJSON());

async function press(tree: renderer.ReactTestRenderer, id: string) {
  const alvo = byTestId(tree, id);
  if (!alvo.length) throw new Error("testID não encontrado: " + id);
  await act(async () => { alvo[0].props.onPress(); });
  await flush();
}

// Painel com o card da Receita aberto (a seção do extrato só existe lá).
async function abrirReceita() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje /></QueryClientProvider>);
  });
  await flush();
  await medir(tree!, 1200);
  await press(tree!, "bloco-expandir-receita");
  return tree!;
}

describe("Receita › Extrato bancário", () => {
  it("mostra a seção só no detalhe da Receita e lista os meses da API", async () => {
    const tree = await abrirReceita();
    expect(ofx.extratos).toHaveBeenCalledWith(6);
    expect(byTestId(tree, "ofx-secao")).toHaveLength(1);
    const out = text(tree);
    for (const t of ["Extrato bancário", "Anexar extrato OFX", "Out/2026", "Set/2026", "Ago/2026", "sem extrato", "pendências", "conciliado"]) {
      expect(out).toContain(t);
    }
    // Diferença do mês com pendência, com sinal e em reais.
    expect(out).toContain("R$ 2.340,00");
    expect(out).toContain("R$ 2.200,00");
    expect(out).toContain("-R$ 140,00");
    expect(out).toContain("2 créditos sem pagamento na Asaas");
    // A lista genérica do backend saiu: a tabela daqui a substitui.
    expect(out).not.toContain("Conferência com o extrato");
    // Os demais blocos não ganham a seção.
    await press(tree, "bloco-expandir-receita");
    await press(tree, "bloco-expandir-pagantes");
    expect(byTestId(tree, "ofx-secao")).toHaveLength(0);
    tree.unmount();
  });

  it("mês sem extrato não abre detalhe", async () => {
    const tree = await abrirReceita();
    expect(byTestId(tree, "ofx-mes-2026-10")[0].props.disabled).toBe(true);
    expect(byTestId(tree, "ofx-mes-2026-09")[0].props.disabled).toBe(false);
    expect(ofx.detalhe).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("anexar: manda o arquivo em JSON com o mês do seletor e mostra o resumo", async () => {
    const tree = await abrirReceita();
    // Padrão: o mês que fechou.
    expect(JSON.stringify(byTestId(tree, "ofx-mes-escolhido")[0].props.children)).toContain("Set/2026");

    await press(tree, "ofx-mes-anterior");
    expect(JSON.stringify(byTestId(tree, "ofx-mes-escolhido")[0].props.children)).toContain("Ago/2026");
    await press(tree, "ofx-mes-seguinte");

    await press(tree, "ofx-anexar");
    expect(ofx.importar).toHaveBeenCalledWith({
      ofx_content: "OFXHEADER:100\n<OFX><STMTTRN></STMTTRN></OFX>",
      mes: "2026-09",
      nome_arquivo: "extrato.ofx",
    });
    const out = text(tree);
    expect(out).toContain("12 lançamentos importados");
    expect(out).toContain("9 conciliados (2 com taxa)");
    expect(out).toContain("2 pendentes");
    expect(toast.success).toHaveBeenCalled();
    // A tabela recarrega depois de importar.
    expect(ofx.extratos.mock.calls.length).toBeGreaterThanOrEqual(2);
    tree.unmount();
  });

  it("reimportar o mesmo arquivo avisa que nada mudou", async () => {
    ofx.importar.mockResolvedValue({ ok: true, duplicado: true, extrato_id: "55", importados: 0, duplicados: 16 });
    const tree = await abrirReceita();
    await press(tree, "ofx-anexar");
    expect(text(tree)).toContain("já tinha sido importado");
    expect(text(tree)).toContain("16 lançamentos repetidos");
    tree.unmount();
  });

  it("fechar o seletor de arquivo sem escolher não chama a API", async () => {
    escolher.mockResolvedValue(null);
    const tree = await abrirReceita();
    await press(tree, "ofx-anexar");
    expect(ofx.importar).not.toHaveBeenCalled();
    expect(byTestId(tree, "ofx-aviso")).toHaveLength(0);
    tree.unmount();
  });

  it("arquivo inválido mostra o motivo sem chamar a API", async () => {
    escolher.mockRejectedValue(new Error("Esse arquivo não parece um extrato OFX."));
    const tree = await abrirReceita();
    await press(tree, "ofx-anexar");
    expect(ofx.importar).not.toHaveBeenCalled();
    expect(text(tree)).toContain("não parece um extrato OFX");
    tree.unmount();
  });

  it("503 ao importar: migration pendente em linguagem clara", async () => {
    ofx.importar.mockRejectedValue(Object.assign(new Error("erro"), { status: 503, data: { code: "MIGRATION_PENDING" } }));
    const tree = await abrirReceita();
    await press(tree, "ofx-anexar");
    expect(text(tree)).toContain("ainda não está disponível no servidor");
    expect(text(tree)).toContain("migration pendente");
    tree.unmount();
  });

  it("422 ao importar: OFX sem transações", async () => {
    ofx.importar.mockRejectedValue(Object.assign(new Error("x"), { status: 422, data: {} }));
    const tree = await abrirReceita();
    await press(tree, "ofx-anexar");
    expect(text(tree)).toContain("não tem nenhuma transação");
    tree.unmount();
  });

  it("503 ao listar: erro na seção, com 'tentar de novo' que refaz a chamada", async () => {
    ofx.extratos.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 503, data: { code: "MIGRATION_PENDING" } }));
    const tree = await abrirReceita();
    expect(byTestId(tree, "ofx-erro")).toHaveLength(1);
    expect(text(tree)).toContain("migration pendente");
    await press(tree, "ofx-tentar-de-novo");
    expect(ofx.extratos).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "ofx-erro")).toHaveLength(0);
    expect(text(tree)).toContain("Set/2026");
    tree.unmount();
  });

  it("tocar num mês abre o detalhe com resumo, lançamentos e status", async () => {
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    expect(ofx.detalhe).toHaveBeenCalledWith("55");
    expect(byTestId(tree, "ofx-detalhe-modal")).toHaveLength(1);
    const out = text(tree);
    for (const t of ["Extrato de Set/2026", "extrato-setembro.ofx", "CREDITO ASAAS PIX", "TARIFA BANCARIA", "conciliado · com taxa", "pendente", "débito", "3 com taxa"]) {
      expect(out).toContain(t);
    }
    // Pendente tem conciliar e ignorar; conciliado e ignorado, reabrir; débito, nada.
    expect(byTestId(tree, "ofx-conciliar-901")).toHaveLength(1);
    expect(byTestId(tree, "ofx-ignorar-901")).toHaveLength(1);
    expect(byTestId(tree, "ofx-reabrir-902")).toHaveLength(1);
    expect(byTestId(tree, "ofx-reabrir-903")).toHaveLength(1);
    expect(byTestId(tree, "ofx-conciliar-904")).toHaveLength(0);
    expect(byTestId(tree, "ofx-reabrir-904")).toHaveLength(0);
    tree.unmount();
  });

  it("conciliar: escolhe o pagamento (o de mesmo valor vem primeiro) e recarrega", async () => {
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    await press(tree, "ofx-conciliar-901");
    expect(byTestId(tree, "ofx-opcoes-901")).toHaveLength(1);
    const opcoes = byTestId(tree, "ofx-opcoes-901")[0];
    const ordem = opcoes.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("ofx-pagamento-") && typeof n.type !== "string")
      .map((n) => n.props.testID).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    expect(ordem).toEqual(["ofx-pagamento-pay_igual", "ofx-pagamento-pay_far"]);

    const antes = ofx.detalhe.mock.calls.length;
    await press(tree, "ofx-pagamento-pay_igual");
    expect(ofx.conciliar).toHaveBeenCalledWith("55", "901", "pay_igual");
    expect(toast.success).toHaveBeenCalledWith("Lançamento conciliado.");
    expect(ofx.detalhe.mock.calls.length).toBeGreaterThan(antes);
    expect(byTestId(tree, "ofx-opcoes-901")).toHaveLength(0);
    tree.unmount();
  });

  it("conciliar com pagamento já casado (409) mostra a mensagem e atualiza a lista", async () => {
    ofx.conciliar.mockRejectedValue(Object.assign(new Error("conflito"), { status: 409, data: {} }));
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    await press(tree, "ofx-conciliar-901");
    const antes = ofx.detalhe.mock.calls.length;
    await press(tree, "ofx-pagamento-pay_far");
    expect(byTestId(tree, "ofx-detalhe-aviso")).toHaveLength(1);
    expect(text(tree)).toContain("já foi casado com outro crédito");
    expect(ofx.detalhe.mock.calls.length).toBeGreaterThan(antes);
    tree.unmount();
  });

  it("sem pagamento disponível a lista de conciliação explica", async () => {
    ofx.detalhe.mockImplementation(async () => ({ ...DETALHE(), pagamentos_disponiveis: [] }));
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    await press(tree, "ofx-conciliar-901");
    expect(text(tree)).toContain("Nenhum pagamento da Asaas disponível neste mês.");
    tree.unmount();
  });

  it("ignorar e reabrir chamam a API do lançamento", async () => {
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    await press(tree, "ofx-ignorar-901");
    expect(ofx.ignorar).toHaveBeenCalledWith("55", "901");
    await press(tree, "ofx-reabrir-902");
    expect(ofx.reabrir).toHaveBeenCalledWith("55", "902");
    tree.unmount();
  });

  it("apagar extrato pede confirmação dentro da tela e só então chama a API", async () => {
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    await press(tree, "ofx-apagar");
    expect(byTestId(tree, "ofx-apagar-confirmacao")).toHaveLength(1);
    expect(text(tree)).toContain("Apagar este extrato?");
    expect(ofx.apagar).not.toHaveBeenCalled();

    // Cancelar volta sem apagar.
    await press(tree, "ofx-apagar-cancelar");
    expect(byTestId(tree, "ofx-apagar-confirmacao")).toHaveLength(0);
    expect(ofx.apagar).not.toHaveBeenCalled();

    await press(tree, "ofx-apagar");
    const antes = ofx.extratos.mock.calls.length;
    await press(tree, "ofx-apagar-confirmar");
    expect(ofx.apagar).toHaveBeenCalledWith("55");
    expect(byTestId(tree, "ofx-detalhe-modal")).toHaveLength(0);
    expect(ofx.extratos.mock.calls.length).toBeGreaterThan(antes);
    tree.unmount();
  });

  it("mês com mais de um extrato deixa escolher qual abrir", async () => {
    const dados: any = MESES();
    dados.meses[1].extratos.push({ id: "56", nome_arquivo: "extrato-setembro-2.ofx", importado_em: "2026-10-03T13:00:00Z", total_creditos: 100, linhas: 3 });
    ofx.extratos.mockImplementation(async () => dados);
    const tree = await abrirReceita();
    await press(tree, "ofx-mes-2026-09");
    expect(byTestId(tree, "ofx-extratos-do-mes")).toHaveLength(1);
    await press(tree, "ofx-extrato-56");
    expect(ofx.detalhe).toHaveBeenLastCalledWith("56");
    tree.unmount();
  });
});
