// ============================================================
// Etiquetas — medidas e calibração salvas na CONTA, na tela (15/10/2026).
//
// Pedido do Caio: "Podemos salvar a configuração de impressora na conta?
// Para não perder a configuração." Trava, com o backend novo (GET de
// pdv_settings devolve label_custom_specs / label_printer_prefs):
//   - a tela lê da conta e a conta vence o navegador (que vira cache);
//   - salvar, editar o nome e apagar medida e mudar a calibração gravam na
//     conta (debounce curto); falha de rede = aviso discreto e o valor local
//     fica;
//   - migração única do navegador para a conta (com e sem dados locais;
//     conta já preenchida nunca é sobrescrita);
//   - multi-CNPJ: cada empresa ativa com a sua conta e o seu cache;
//   - wizard: "fica salvo na sua conta e vale para todos os computadores",
//     com a dica de duas medidas para duas impressoras;
//   - backend antigo (sem as chaves): comportamento de antes, só navegador.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockEmpresa = "empresa-1";
const mockConta: Record<string, any> = {};

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: mockEmpresa, name: "Loja", trade_name: "Toda Linda" }, token: "t" }) }));
jest.mock("@/services/api", () => ({
  companiesApi: {},
  pdvSettingsApi: {
    get: jest.fn((cid: string) => Promise.resolve({ settings: mockConta[cid] })),
    save: jest.fn(() => Promise.resolve({})),
    saveLabelConfig: jest.fn(() => Promise.resolve({})),
  },
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));

import { PrintLabels } from "@/components/PrintLabels";
import { pdvSettingsApi } from "@/services/api";
import { toast } from "@/components/Toast";

const PRODUTOS: any[] = [
  { id: "p1", name: "Blusa Canelada", code: "001", barcode: "7891033948208", category: "Blusas", price: 59.9, stock: 2, unit: "un", size: "", color: "" },
];
const A = { id: "ma", larguraMm: 40, alturaMm: 25, colunas: 2, espacoLadoMm: 2, espacoLinhaMm: 2.5, ajusteXMm: -1, ajusteYMm: 0.5 };
const B = { id: "mb", larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0 };
const C = { id: "mc", larguraMm: 60, alturaMm: 40, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0, nome: "Gôndola" };

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const aperta = (t: renderer.ReactTestRenderer, id: string) => act(() => { acha(t, id)[0].props.onPress(); });
const texto = (t: renderer.ReactTestRenderer) => flatten(t.toJSON());
const abreMenu = (t: renderer.ReactTestRenderer) => act(() => {
  t.root.findAll((n) => n.props && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Modelo de etiqueta:"), { deep: false })[0].props.onPress();
});
const espera = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const saveLabel = pdvSettingsApi.saveLabelConfig as jest.Mock;
const cacheMedidas = (cid: string) => JSON.parse(window.localStorage.getItem("aura_label_custom_" + cid) || "null");

const BlobDeVerdade = global.Blob;
beforeEach(() => {
  window.localStorage.clear();
  mockEmpresa = "empresa-1";
  Object.keys(mockConta).forEach((k) => delete mockConta[k]);
  (global as any).Blob = function () { return {}; };
  (URL as any).createObjectURL = jest.fn(() => "blob:teste");
  window.open = jest.fn(() => ({} as any));
  saveLabel.mockReset();
  saveLabel.mockImplementation(() => Promise.resolve({}));
  (pdvSettingsApi.save as jest.Mock).mockClear();
  (toast.warning as jest.Mock).mockClear();
});
afterAll(() => { (global as any).Blob = BlobDeVerdade; });

async function monta(modelo?: string) {
  if (modelo) window.localStorage.setItem("aura_label_print_size", modelo);
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={PRODUTOS} selectedIds={["p1"]} onSelectionChange={() => {}} />); });
  await act(async () => {}); // GET de pdv_settings
  return t;
}
function contaCom(cid: string, extra: any) {
  mockConta[cid] = { label_size: null, label_offset_mm: 0, label_custom_specs: null, label_printer_prefs: null, ...extra };
}
function criaMedida40x25(t: renderer.ReactTestRenderer) {
  abreMenu(t);
  aperta(t, "etiquetas-minha-medida");
  aperta(t, "medida-atalho-40x25");
  aperta(t, "medida-continuar");
  aperta(t, "medida-ja-imprimi");
  aperta(t, "medida-dir-esquerda");
  aperta(t, "medida-ficou-certo");
}

describe("leitura da conta", () => {
  test("a lista vem da conta, vira cache no navegador e o texto diz 'na conta'", async () => {
    contaCom("empresa-1", { label_custom_specs: [A, C], label_printer_prefs: {} });
    const t = await monta();
    abreMenu(t);
    const tx = texto(t);
    expect(tx).toContain("Minha etiqueta 40 x 25 mm");
    expect(tx).toContain("Gôndola");
    expect(tx).toContain("60 x 40 mm · ajuste salvo na conta");
    expect(tx).toContain("2 lado a lado · ajuste salvo na conta");
    expect(cacheMedidas("empresa-1").medidas).toEqual([A, C]);
    expect(saveLabel).not.toHaveBeenCalled();
    t.unmount();
  });

  test("a conta vence o navegador; a medida escolhida neste computador continua se existir na conta", async () => {
    window.localStorage.setItem("aura_label_custom_empresa-1", JSON.stringify({ medidas: [B, { ...A, larguraMm: 45 }], escolhida: "ma" }));
    contaCom("empresa-1", { label_custom_specs: [A] });
    const t = await monta();
    expect(texto(t)).toContain("Etiquetas Minha etiqueta 40 x 25 mm — Padrão EAN-13");
    abreMenu(t);
    expect(acha(t, "etiquetas-medida-mb")).toHaveLength(0);
    expect(cacheMedidas("empresa-1")).toEqual({ medidas: [A], escolhida: "ma" });
    expect(saveLabel).not.toHaveBeenCalled();
    t.unmount();
  });

  test("calibração da conta vale na tela e vira cache", async () => {
    contaCom("empresa-1", { label_custom_specs: [], label_printer_prefs: { "105x21": { continuous: true, rowPitchMm: 23.3, offsetYMm: 0.1 } } });
    const t = await monta("105x21");
    expect(acha(t, "etiquetas-modo-continuo")[0].props.accessibilityState).toEqual({ checked: true });
    expect(flatten(acha(t, "etiquetas-passo-valor")[0].props.children)).toBe("23,3 mm");
    expect(texto(t)).toContain("Esses ajustes ficam salvos na sua conta e valem para todos os computadores da loja.");
    expect(JSON.parse(window.localStorage.getItem("aura_label_printer_empresa-1")!)).toEqual({ "105x21": { continuous: true, rowPitchMm: 23.3, offsetYMm: 0.1 } });
    t.unmount();
  });
});

describe("gravação na conta", () => {
  test("salvar medida, dar nome e apagar gravam a lista inteira na conta", async () => {
    contaCom("empresa-1", { label_custom_specs: [], label_printer_prefs: {} });
    const t = await monta();
    criaMedida40x25(t);
    const tx = texto(t);
    expect(tx).toContain("Sua etiqueta 40 x 25 mm está salva na sua conta");
    expect(tx).toContain("A medida e o ajuste ficam salvos na sua conta e valem para todos os computadores da loja.");
    expect(tx).toContain("crie duas medidas, uma para cada (ex.: “40x25 balcão” e “40x25 estoque”)");
    expect(tx).not.toContain("O ajuste fica neste computador");
    await espera(700);
    expect(saveLabel).toHaveBeenCalledTimes(1);
    const [cid, patch] = saveLabel.mock.calls[0];
    expect(cid).toBe("empresa-1");
    expect(patch.label_custom_specs).toHaveLength(1);
    expect(patch.label_custom_specs[0]).toMatchObject({ larguraMm: 40, alturaMm: 25, ajusteXMm: 0.5 });
    expect(patch.label_printer_prefs).toBeUndefined();
    const id = patch.label_custom_specs[0].id;

    // nome opcional: grava ao sair do campo e aparece na lista
    act(() => { acha(t, "medida-nome")[0].props.onChangeText("40x25 balcão"); });
    act(() => { acha(t, "medida-nome")[0].props.onBlur(); });
    expect(texto(t)).toContain("Ela já aparece na lista de modelos como “40x25 balcão”.");
    aperta(t, "medida-fechar");
    await espera(700);
    expect(saveLabel).toHaveBeenCalledTimes(2);
    expect(saveLabel.mock.calls[1][1].label_custom_specs).toEqual([expect.objectContaining({ id: id, nome: "40x25 balcão" })]);
    expect(texto(t)).toContain("Etiquetas 40x25 balcão — Padrão EAN-13");

    // apagar: confirmação fala da conta; grava a lista vazia
    abreMenu(t);
    aperta(t, "etiquetas-medida-apagar-" + id);
    expect(texto(t)).toContain("Apagar “40x25 balcão” da conta? Some em todos os computadores da loja.");
    aperta(t, "etiquetas-medida-apagar-sim");
    await espera(700);
    expect(saveLabel).toHaveBeenCalledTimes(3);
    expect(saveLabel.mock.calls[2][1]).toEqual({ label_custom_specs: [] });
    // o save genérico (objeto inteiro) não é usado para isso
    expect(pdvSettingsApi.save).not.toHaveBeenCalled();
    t.unmount();
  });

  test("calibração: toques seguidos viram uma gravação só, com o mapa inteiro", async () => {
    contaCom("empresa-1", { label_custom_specs: [], label_printer_prefs: { "30x25": { continuous: true, rowPitchMm: 27, offsetYMm: 0 } } });
    const t = await monta("105x21");
    aperta(t, "etiquetas-modo-continuo");
    aperta(t, "etiquetas-passo-menos");
    aperta(t, "etiquetas-passo-menos");
    aperta(t, "etiquetas-desloc-vertical-mais");
    await espera(700);
    expect(saveLabel).toHaveBeenCalledTimes(1);
    expect(saveLabel.mock.calls[0][1]).toEqual({ label_printer_prefs: {
      "30x25": { continuous: true, rowPitchMm: 27, offsetYMm: 0 },
      "105x21": { continuous: true, rowPitchMm: 23.3, offsetYMm: 0.1 },
    } });
    aperta(t, "etiquetas-calibracao-restaurar");
    await espera(700);
    expect(saveLabel.mock.calls[1][1]).toEqual({ label_printer_prefs: { "30x25": { continuous: true, rowPitchMm: 27, offsetYMm: 0 } } });
    t.unmount();
  });

  test("falha de rede: aviso discreto e o valor local fica", async () => {
    contaCom("empresa-1", { label_custom_specs: [], label_printer_prefs: {} });
    saveLabel.mockImplementation(() => Promise.reject(new Error("offline")));
    const t = await monta();
    criaMedida40x25(t);
    aperta(t, "medida-fechar");
    await espera(700);
    expect(toast.warning).toHaveBeenCalledWith("Não deu para salvar na conta, tente de novo");
    expect(cacheMedidas("empresa-1").medidas).toHaveLength(1);
    expect(texto(t)).toContain("Etiquetas Minha etiqueta 40 x 25 mm — Padrão EAN-13");
    t.unmount();
  });

  test("limite de 20 medidas na conta: avisa em vez de abrir o wizard", async () => {
    contaCom("empresa-1", { label_custom_specs: Array.from({ length: 20 }, (_, i) => ({ ...B, id: "m" + i })) });
    const t = await monta();
    abreMenu(t);
    aperta(t, "etiquetas-minha-medida");
    expect(acha(t, "medida-wizard")).toHaveLength(0);
    expect(toast.warning).toHaveBeenCalledWith("A conta guarda até 20 medidas. Apague uma que não usa para criar outra.");
    t.unmount();
  });
});

describe("migração única do navegador para a conta", () => {
  test("conta vazia + navegador com medidas e calibração: sobe uma vez e marca", async () => {
    window.localStorage.setItem("aura_label_custom_empresa-1", JSON.stringify({ medidas: [B], escolhida: "mb" }));
    window.localStorage.setItem("aura_label_printer_empresa-1", JSON.stringify({ "40x25": { continuous: false, rowPitchMm: 28, offsetYMm: -1 } }));
    contaCom("empresa-1", {});
    const t = await monta();
    expect(saveLabel).toHaveBeenCalledTimes(1);
    expect(saveLabel).toHaveBeenCalledWith("empresa-1", {
      label_custom_specs: [B],
      label_printer_prefs: { "40x25": { continuous: false, rowPitchMm: 28, offsetYMm: -1 } },
    });
    await act(async () => {});
    expect(JSON.parse(window.localStorage.getItem("aura_label_conta_migrada_empresa-1")!)).toEqual({ label_custom_specs: true, label_printer_prefs: true });
    expect(texto(t)).toContain("Etiquetas Minha etiqueta 50 x 30 mm — Padrão EAN-13"); // nada some
    t.unmount();

    // reabrir com a conta ainda null (ex.: outro deploy): não sobe de novo
    const t2 = await monta();
    expect(saveLabel).toHaveBeenCalledTimes(1);
    t2.unmount();
  });

  test("conta vazia + navegador vazio: nada sobe", async () => {
    contaCom("empresa-1", {});
    const t = await monta();
    expect(saveLabel).not.toHaveBeenCalled();
    t.unmount();
  });

  test("conta já preenchida nunca é sobrescrita pelo navegador", async () => {
    window.localStorage.setItem("aura_label_custom_empresa-1", JSON.stringify({ medidas: [B], escolhida: null }));
    window.localStorage.setItem("aura_label_printer_empresa-1", JSON.stringify({ "40x25": { continuous: true, rowPitchMm: 28, offsetYMm: 0 } }));
    contaCom("empresa-1", { label_custom_specs: [A], label_printer_prefs: {} });
    const t = await monta();
    expect(saveLabel).not.toHaveBeenCalled();
    expect(cacheMedidas("empresa-1").medidas).toEqual([A]);
    expect(window.localStorage.getItem("aura_label_printer_empresa-1")).toBeNull();
    t.unmount();
  });

  test("migração que falha (rede) tenta de novo na próxima visita", async () => {
    window.localStorage.setItem("aura_label_custom_empresa-1", JSON.stringify({ medidas: [B], escolhida: null }));
    contaCom("empresa-1", {});
    saveLabel.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    const t = await monta();
    await act(async () => {});
    // só a calibração (vazia neste navegador, nada a subir) fica marcada
    expect(JSON.parse(window.localStorage.getItem("aura_label_conta_migrada_empresa-1")!)).toEqual({ label_printer_prefs: true });
    t.unmount();
    const t2 = await monta();
    expect(saveLabel).toHaveBeenCalledTimes(2);
    t2.unmount();
  });
});

describe("multi-CNPJ", () => {
  test("cada empresa ativa lê e grava a sua conta e o seu cache", async () => {
    contaCom("empresa-1", { label_custom_specs: [A], label_printer_prefs: {} });
    contaCom("empresa-2", { label_custom_specs: [C], label_printer_prefs: {} });
    const t = await monta();
    abreMenu(t);
    expect(acha(t, "etiquetas-medida-ma")).toHaveLength(1);
    expect(acha(t, "etiquetas-medida-mc")).toHaveLength(0);
    abreMenu(t);

    mockEmpresa = "empresa-2";
    act(() => { t.update(<PrintLabels products={PRODUTOS} selectedIds={["p1"]} onSelectionChange={() => {}} />); });
    await act(async () => {});
    abreMenu(t);
    expect(acha(t, "etiquetas-medida-mc")).toHaveLength(1);
    expect(acha(t, "etiquetas-medida-ma")).toHaveLength(0);
    aperta(t, "etiquetas-medida-apagar-mc");
    aperta(t, "etiquetas-medida-apagar-sim");
    await espera(700);
    expect(saveLabel).toHaveBeenCalledTimes(1);
    expect(saveLabel).toHaveBeenCalledWith("empresa-2", { label_custom_specs: [] });
    expect(cacheMedidas("empresa-1").medidas).toEqual([A]); // a outra empresa não muda
    t.unmount();
  });
});

describe("backend antigo (GET sem as chaves)", () => {
  test("tudo segue só no navegador, como antes, sem chamar a conta", async () => {
    mockConta["empresa-1"] = { label_size: null, label_offset_mm: 0 };
    window.localStorage.setItem("aura_label_custom_empresa-1", JSON.stringify({ medidas: [B], escolhida: null }));
    const t = await monta();
    abreMenu(t);
    expect(texto(t)).toContain("ajuste guardado neste computador");
    abreMenu(t);
    criaMedida40x25(t);
    expect(texto(t)).toContain("Sua etiqueta 40 x 25 mm está salva neste computador");
    expect(texto(t)).toContain("O ajuste fica neste computador");
    aperta(t, "medida-fechar");
    await espera(700);
    expect(saveLabel).not.toHaveBeenCalled();
    expect(cacheMedidas("empresa-1").medidas).toHaveLength(2);
    t.unmount();
  });
});
