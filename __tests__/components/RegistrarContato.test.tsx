// ============================================================
// Gestão Aura › Registrar contato (14/10/2026)
//
// O botão da ficha e o verbo dos alertas do Painel abrem o formulário; o
// corpo vai para POST /admin/painel/contatos (backend #836). A ficha mostra
// os contatos da equipe e dá "+7 dias de teste" (rota extend-trial, com
// confirmação). Mesmos dados reais do PainelHoje.test.tsx
// (__tests__/__fixtures__/painel, cópia de Aura-backend tests/fixtures/painel).
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
jest.mock("@/services/adminApi", () => ({
  adminApi: {
    painel: {
      hoje: jest.fn(), bloco: jest.fn(), ficha: jest.fn(), layout: jest.fn(), salvarLayout: jest.fn(), recalcular: jest.fn(),
      ofx: { extratos: jest.fn(), detalhe: jest.fn() },
      contatos: { registrar: jest.fn() },
    },
    extendTrial: jest.fn(),
  },
}));

import { PainelHoje } from "@/components/admin/painel/PainelHoje";
import { hojeBRT, rotuloDaData, somarDias } from "@/components/admin/painel/registrarContato";
import { adminApi } from "@/services/adminApi";
import { toast } from "@/components/Toast";

const api = (adminApi as any).painel as Record<string, jest.Mock>;
const registrar = (adminApi as any).painel.contatos.registrar as jest.Mock;
const extendTrial = (adminApi as any).extendTrial as jest.Mock;
const fx = (nome: string) => JSON.parse(JSON.stringify(require("../__fixtures__/painel/" + nome + ".json")));

const LOJA_AURORA = "aaaaaaaa-0000-4000-8000-000000000001";
const OTICA = "aaaaaaaa-0000-4000-8000-000000000005";

beforeEach(() => {
  jest.clearAllMocks();
  api.hoje.mockImplementation(async () => fx("hoje"));
  api.bloco.mockImplementation(async (id: string) => fx("blocos." + id));
  api.ficha.mockImplementation(async () => fx("clientes.ficha"));
  api.layout.mockImplementation(async () => fx("layout.get"));
  api.recalcular.mockImplementation(async () => fx("recalcular"));
  (api as any).ofx.extratos.mockImplementation(async () => ({ meses: [] }));
  registrar.mockResolvedValue({ id: 41, created_at: "2026-10-14T12:00:00.000Z" });
  extendTrial.mockResolvedValue({ trial_ends_at: "2026-10-23T12:00:00.000Z", previous_trial_ends_at: "2026-10-16T12:00:00.000Z", days_added: 7 });
});

async function flush(vezes = 3) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(width = 1200) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje /></QueryClientProvider>);
  });
  await flush();
  await act(async () => {
    tree!.root.findAllByProps({ testID: "painel-hoje" }, { deep: false })[0].props.onLayout({ nativeEvent: { layout: { width } } });
  });
  return tree!;
}

const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { byTestId(tree, id)[0].props.onPress(); });
  await flush();
}
async function escrever(tree: renderer.ReactTestRenderer, id: string, valor: string) {
  await act(async () => { byTestId(tree, id)[0].props.onChangeText(valor); });
}
const desabilitado = (tree: renderer.ReactTestRenderer, id: string) => !!byTestId(tree, id)[0].props.disabled;

describe("Registrar contato", () => {
  it("pela ficha: preenche em poucos toques e manda o corpo certo para a loja", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);

    await press(tree, "ficha-registrar-contato");
    expect(byTestId(tree, "registrar-contato")).toHaveLength(1);
    // A ficha em cache dá o nome e o telefone no cabeçalho do formulário.
    expect(text(tree)).toContain("Loja Aurora");
    // Nada preenchido: Salvar travado, WhatsApp já marcado.
    expect(desabilitado(tree, "contato-salvar")).toBe(true);
    expect(byTestId(tree, "contato-canal-whatsapp")[0].props.accessibilityState.selected).toBe(true);

    await press(tree, "contato-resultado-pediu_tempo");
    expect(desabilitado(tree, "contato-salvar")).toBe(true);          // falta a frase
    await escrever(tree, "contato-frase", "Pediu até sexta para ver o preço do anual");
    expect(desabilitado(tree, "contato-salvar")).toBe(false);

    await escrever(tree, "contato-proximo", "Ligar de novo");
    await press(tree, "contato-data-3");
    // O atalho mostra o dia da semana para não marcar o retorno no domingo sem ver.
    expect(byTestId(tree, "contato-quando")[0].props.children).toBe(rotuloDaData(somarDias(hojeBRT(), 3)));
    await press(tree, "contato-canal-ligacao");
    await press(tree, "contato-marcador-importacao_assistida_pedida");
    await press(tree, "contato-checkin-toggle");
    await press(tree, "contato-comochegou-indicacao");
    await press(tree, "contato-fiado-sim");
    await press(tree, "contato-quemdecide-dono");

    await press(tree, "contato-salvar");
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith({
      company_id: LOJA_AURORA,
      canal: "ligacao",
      resultado: "pediu_tempo",
      body: "Pediu até sexta para ver o preço do anual",
      proximo_passo: "Ligar de novo",
      proximo_passo_em: somarDias(hojeBRT(), 3),
      marcador: "importacao_assistida_pedida",
      checkin: { como_chegou: "indicacao", fiado: "sim", quem_decide: "dono" },
    });
    expect((toast.success as jest.Mock).mock.calls.pop()[0]).toBe("Contato registrado.");
    // Fecha e a ficha (por baixo) é buscada de novo: a linha do tempo mostra o contato.
    expect(byTestId(tree, "registrar-contato")).toHaveLength(0);
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    expect(api.ficha.mock.calls.length).toBeGreaterThanOrEqual(2);
    tree.unmount();
  });

  it("'Não quer' pede o motivo e só libera o Salvar com ele", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-registrar-contato");
    expect(byTestId(tree, "contato-bloco-motivo")).toHaveLength(0);

    await press(tree, "contato-resultado-nao_quer");
    expect(byTestId(tree, "contato-bloco-motivo")).toHaveLength(1);
    await escrever(tree, "contato-frase", "Achou caro para o tamanho da loja");
    expect(desabilitado(tree, "contato-salvar")).toBe(true);

    await press(tree, "contato-motivo-preco_plano");
    expect(desabilitado(tree, "contato-salvar")).toBe(false);
    await press(tree, "contato-salvar");
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      company_id: LOJA_AURORA, resultado: "nao_quer", motivo: "preco_plano", canal: "whatsapp",
    }));
    tree.unmount();
  });

  it("trocar para outro resultado descarta o motivo escolhido", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-registrar-contato");
    await press(tree, "contato-resultado-nao_quer");
    await press(tree, "contato-motivo-fiscal");
    await press(tree, "contato-resultado-respondeu");
    await escrever(tree, "contato-frase", "Voltou atrás");
    await press(tree, "contato-salvar");
    expect(registrar.mock.calls[0][0]).not.toHaveProperty("motivo");
    tree.unmount();
  });

  it("erro do backend aparece no formulário e nada se perde", async () => {
    registrar.mockRejectedValueOnce(new Error("motivo é obrigatório quando o resultado é nao_quer."));
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-registrar-contato");
    await press(tree, "contato-resultado-respondeu");
    await escrever(tree, "contato-frase", "Mandou o catálogo");
    await press(tree, "contato-salvar");

    expect(byTestId(tree, "contato-erro")).toHaveLength(1);
    expect(text(tree)).toContain("motivo é obrigatório");
    expect(byTestId(tree, "registrar-contato")).toHaveLength(1);       // segue aberto
    expect(byTestId(tree, "contato-frase")[0].props.value).toBe("Mandou o catálogo");
    expect(toast.success).not.toHaveBeenCalled();

    // Tentar de novo funciona e limpa o erro.
    await press(tree, "contato-salvar");
    expect(registrar).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "registrar-contato")).toHaveLength(0);
    tree.unmount();
  });

  it("dois toques em Salvar mandam um contato só", async () => {
    let soltar: (v: any) => void = () => {};
    registrar.mockImplementation(() => new Promise((res) => { soltar = res; }));
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-registrar-contato");
    await press(tree, "contato-resultado-respondeu");
    await escrever(tree, "contato-frase", "Respondeu na hora");

    await act(async () => { byTestId(tree, "contato-salvar")[0].props.onPress(); });
    await act(async () => { byTestId(tree, "contato-salvar")[0].props.onPress(); });
    expect(registrar).toHaveBeenCalledTimes(1);
    await act(async () => { soltar({ id: 5, created_at: "2026-10-14T12:00:00.000Z" }); });
    await flush();
    expect(byTestId(tree, "registrar-contato")).toHaveLength(0);
    tree.unmount();
  });

  it("cancelar fecha sem gravar e reabrir começa limpo", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-registrar-contato");
    await press(tree, "contato-resultado-respondeu");
    await escrever(tree, "contato-frase", "rascunho");
    await press(tree, "contato-cancelar");
    expect(byTestId(tree, "registrar-contato")).toHaveLength(0);
    expect(registrar).not.toHaveBeenCalled();

    await press(tree, "ficha-registrar-contato");
    expect(byTestId(tree, "contato-frase")[0].props.value).toBe("");
    expect(desabilitado(tree, "contato-salvar")).toBe(true);
    tree.unmount();
  });

  it("como_chegou já registrado aparece como aviso: a primeira gravação fica", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-registrar-contato");
    await press(tree, "contato-checkin-toggle");
    expect(text(tree)).toContain("Já registrado: Indicação");
    tree.unmount();
  });
});

describe("Verbo do alerta", () => {
  it("'Ligar' de uma loja abre o formulário direto, com o nome vindo da ficha", async () => {
    const tree = await mount();
    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);
    await press(tree, "verbo-do-alerta-0");
    expect(byTestId(tree, "registrar-contato")).toHaveLength(1);
    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);              // sem passar pela ficha
    expect(api.ficha).toHaveBeenCalledWith(LOJA_AURORA);
    expect(text(tree)).toContain("Loja Aurora");

    await press(tree, "contato-resultado-sem_resposta");
    await escrever(tree, "contato-frase", "Ligou, caixa postal");
    await press(tree, "contato-salvar");
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ company_id: LOJA_AURORA, resultado: "sem_resposta" }));
    tree.unmount();
  });

  it("'Oferecer' também; alerta sem loja (Vincular) e verbo 'Ver' não têm o atalho", async () => {
    const tree = await mount();
    expect(byTestId(tree, "verbo-do-alerta-1")).toHaveLength(1);        // Oferecer · Ótica Visão
    expect(byTestId(tree, "verbo-do-alerta-2")).toHaveLength(0);        // Vincular · sem loja
    expect(byTestId(tree, "verbo-do-alerta-3")).toHaveLength(0);        // Ver
    await press(tree, "verbo-do-alerta-1");
    expect(api.ficha).toHaveBeenCalledWith(OTICA);
    expect(byTestId(tree, "registrar-contato")).toHaveLength(1);
    tree.unmount();
  });

  it("tocar no alerta (fora do verbo) segue abrindo a ficha", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    expect(byTestId(tree, "registrar-contato")).toHaveLength(0);
    tree.unmount();
  });
});

describe("Ficha com contatos e +7 dias de teste", () => {
  it("mostra os contatos da equipe com o próximo passo e a linha do tempo mistura os eventos", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-contatos")).toHaveLength(1);
    const t = text(tree);
    expect(t).toContain("Contato por WhatsApp: Pediu um tempo");
    expect(t).toContain("Pediu até sexta para ver o preço do anual");
    expect(t).toContain("Próximo passo: Ligar de novo · sexta, 16/10");
    expect(byTestId(tree, "ficha-contato-3")).toHaveLength(1);
    tree.unmount();
  });

  it("ficha sem contatos (backend anterior) não mostra a seção", async () => {
    api.ficha.mockImplementation(async () => {
      const f = fx("clientes.ficha");
      delete f.contatos;
      f.linha_do_tempo = f.linha_do_tempo.filter((e: any) => e.tipo !== "contato");
      return f;
    });
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-contatos")).toHaveLength(0);
    expect(byTestId(tree, "ficha-registrar-contato")).toHaveLength(1);
    tree.unmount();
  });

  it("pagante não tem o botão +7 dias de teste", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-estender-trial")).toHaveLength(0);
    tree.unmount();
  });

  it("em trial: confirma, chama extend-trial com 7 dias e avisa até quando vai", async () => {
    api.ficha.mockImplementation(async () => {
      const f = fx("clientes.ficha");
      f.cliente.stage = "trial";
      return f;
    });
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-estender-trial");
    expect(byTestId(tree, "estender-trial")).toHaveLength(1);
    expect(extendTrial).not.toHaveBeenCalled();                          // confirmação primeiro

    await press(tree, "trial-confirmar");
    expect(extendTrial).toHaveBeenCalledTimes(1);
    expect(extendTrial).toHaveBeenCalledWith(LOJA_AURORA, 7, expect.any(String));
    expect((toast.success as jest.Mock).mock.calls.pop()[0]).toContain("23/10");
    expect(byTestId(tree, "estender-trial")).toHaveLength(0);
    tree.unmount();
  });

  it("cancelar a confirmação não estende nada; erro mantém a confirmação aberta", async () => {
    api.ficha.mockImplementation(async () => {
      const f = fx("clientes.ficha");
      f.cliente.stage = "trial";
      return f;
    });
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-estender-trial");
    await press(tree, "trial-cancelar");
    expect(extendTrial).not.toHaveBeenCalled();
    expect(byTestId(tree, "estender-trial")).toHaveLength(0);

    extendTrial.mockRejectedValueOnce(new Error("days deve ser inteiro entre 1 e 365"));
    await press(tree, "ficha-estender-trial");
    await press(tree, "trial-confirmar");
    expect(byTestId(tree, "trial-erro")).toHaveLength(1);
    expect(byTestId(tree, "estender-trial")).toHaveLength(1);
    tree.unmount();
  });
});
