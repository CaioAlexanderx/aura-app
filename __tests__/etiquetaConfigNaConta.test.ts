// ============================================================
// Etiquetas — configuração de impressão salva na CONTA (15/10/2026).
//
// Pedido do Caio: "Podemos salvar a configuração de impressora na conta?
// Para não perder a configuração." Funções puras de labelAccountSync.ts:
// leitura da conta, migração única (com e sem dados locais, conta já
// preenchida nunca é sobrescrita), backend antigo (fallback no navegador),
// gravação com debounce e falha de rede; e o save genérico de pdv_settings
// que não leva mais as chaves de etiqueta (cópia velha não apaga nada).
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn(() => Promise.resolve({ settings: {} })) }));

import {
  planoDaConta, contaGuardaEtiquetas, medidasDaConta, calibracaoDaConta, medidasParaConta,
  criarGravadorDaConta, migracaoFeita, marcarMigracao, MAX_MEDIDAS_NA_CONTA,
} from "@/components/screens/estoque/labels/labelAccountSync";
import { sanitizarMedida, rotuloDaMedida, customLabelPreset, type CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import { substituirMedidas, lerMinhasMedidas, salvarMedida, escolherMedida } from "@/components/screens/estoque/labels/customLabelStorage";
import {
  loadAllLabelPrinterPrefs, saveAllLabelPrinterPrefs, sanitizeLabelPrinterPrefsMap, saveLabelPrinterPrefs, loadLabelPrinterPrefs,
} from "@/components/screens/estoque/labels/labelPrinterPrefs";
import { pdvSettingsApi } from "@/services/authApi";
import { request } from "@/services/api";

const A: CustomLabelSpec = { id: "ma", larguraMm: 40, alturaMm: 25, colunas: 2, espacoLadoMm: 2, espacoLinhaMm: 2.5, ajusteXMm: -1, ajusteYMm: 0.5 };
const B: CustomLabelSpec = { id: "mb", larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0 };
const CAL = { "105x21": { continuous: true, rowPitchMm: 23.3, offsetYMm: 0.1 } };

beforeEach(() => { window.localStorage.clear(); (request as jest.Mock).mockClear(); });

describe("leitura da conta", () => {
  test("backend antigo (GET sem as chaves): segue no navegador", () => {
    expect(contaGuardaEtiquetas({ label_size: "40x25" })).toBe(false);
    expect(contaGuardaEtiquetas(undefined)).toBe(false);
    expect(planoDaConta("e1", { label_size: "40x25" }, { medidas: [A], calibracao: CAL })).toEqual({ modo: "navegador" });
  });

  test("null = nunca salvou; lista/objeto = a conta é a fonte (mesmo vazios)", () => {
    expect(medidasDaConta({ label_custom_specs: null })).toBeNull();
    expect(medidasDaConta({ label_custom_specs: [] })).toEqual([]);
    expect(calibracaoDaConta({ label_printer_prefs: null })).toBeNull();
    expect(calibracaoDaConta({ label_printer_prefs: {} })).toEqual({});
  });

  test("o que vem da conta é saneado: lixo some, faixa e décimos, modelo sem calibração fora", () => {
    const lidas = medidasDaConta({ label_custom_specs: [A, { id: "x" }, 7, { ...B, larguraMm: 500 }, A] });
    expect(lidas).toEqual([A, { ...B, larguraMm: 110 }]);
    expect(calibracaoDaConta({ label_printer_prefs: { ...CAL, "99x21": { continuous: true }, "40x25": { rowPitchMm: 27.5 } } })).toEqual(CAL);
  });

  test("conta preenchida vence o navegador e não sobe nada", () => {
    const p = planoDaConta("e1", { label_custom_specs: [A], label_printer_prefs: CAL }, { medidas: [B], calibracao: { "30x25": { continuous: true, rowPitchMm: 27, offsetYMm: 0 } } });
    expect(p).toEqual({ modo: "conta", medidas: [A], calibracao: CAL, subir: {}, marcarSemSubir: [] });
  });
});

describe("migração única", () => {
  test("conta vazia (null) + navegador com dados: sobe o do navegador", () => {
    const p = planoDaConta("e1", { label_custom_specs: null, label_printer_prefs: null }, { medidas: [B], calibracao: CAL });
    expect(p).toMatchObject({ modo: "conta", medidas: null, calibracao: null, subir: { label_custom_specs: [B], label_printer_prefs: CAL }, marcarSemSubir: [] });
  });

  test("conta vazia + navegador vazio: nada a subir, só marca a migração", () => {
    const p = planoDaConta("e1", { label_custom_specs: null, label_printer_prefs: null }, { medidas: [], calibracao: {} });
    expect(p).toMatchObject({ subir: {}, marcarSemSubir: ["label_custom_specs", "label_printer_prefs"] });
  });

  test("já migrado neste navegador: não sobe de novo", () => {
    marcarMigracao("e1", "label_custom_specs");
    expect(migracaoFeita("e1", "label_custom_specs")).toBe(true);
    expect(migracaoFeita("e2", "label_custom_specs")).toBe(false); // por empresa
    const p = planoDaConta("e1", { label_custom_specs: null, label_printer_prefs: null }, { medidas: [B], calibracao: CAL });
    expect(p).toMatchObject({ subir: { label_printer_prefs: CAL } });
    expect((p as any).subir.label_custom_specs).toBeUndefined();
  });

  test("nunca sobe por cima de uma chave que a conta já tem", () => {
    const p = planoDaConta("e1", { label_custom_specs: [], label_printer_prefs: null }, { medidas: [B], calibracao: {} });
    expect((p as any).subir.label_custom_specs).toBeUndefined();
    expect((p as any).medidas).toEqual([]);
  });

  test("sobe no máximo 20 medidas (limite do backend)", () => {
    const muitas = Array.from({ length: 25 }, (_, i) => ({ ...B, id: "m" + i }));
    expect(medidasParaConta(muitas)).toHaveLength(MAX_MEDIDAS_NA_CONTA);
  });
});

describe("cache do navegador", () => {
  test("substituirMedidas troca a lista pela da conta e mantém a escolhida se ela ainda existe", () => {
    salvarMedida("e1", B);
    escolherMedida("e1", "mb");
    expect(substituirMedidas("e1", [A, B]).escolhida).toBe("mb");
    expect(lerMinhasMedidas("e1").medidas).toEqual([A, B]);
    expect(substituirMedidas("e1", [A])).toEqual({ medidas: [A], escolhida: null });
    expect(substituirMedidas("e1", []).medidas).toEqual([]);
    expect(window.localStorage.getItem("aura_label_custom_e1")).toBeNull();
  });

  test("calibração: mapa inteiro entra e sai do navegador, por empresa", () => {
    saveAllLabelPrinterPrefs("e1", CAL);
    expect(loadAllLabelPrinterPrefs("e1")).toEqual(CAL);
    expect(loadLabelPrinterPrefs("e1", "105x21")).toEqual(CAL["105x21"]);
    expect(loadAllLabelPrinterPrefs("e2")).toEqual({});
    saveLabelPrinterPrefs("e1", "30x25", { continuous: false, rowPitchMm: 26.5, offsetYMm: 0 });
    expect(loadAllLabelPrinterPrefs("e1")).toEqual({ ...CAL, "30x25": { continuous: false, rowPitchMm: 26.5, offsetYMm: 0 } });
    saveAllLabelPrinterPrefs("e1", {});
    expect(window.localStorage.getItem("aura_label_printer_e1")).toBeNull();
    expect(sanitizeLabelPrinterPrefsMap([1, 2])).toEqual({});
  });
});

describe("nome da medida", () => {
  test("opcional, até 40 caracteres; sem nome o spec é o de sempre", () => {
    expect(sanitizarMedida(A)).toEqual(A);
    expect(sanitizarMedida({ ...A, nome: "  " })).toEqual(A);
    expect(sanitizarMedida({ ...A, nome: " 40x25 balcão " })).toEqual({ ...A, nome: "40x25 balcão" });
    expect(sanitizarMedida({ ...A, nome: "n".repeat(50) })!.nome).toHaveLength(40);
    expect(rotuloDaMedida({ ...A, nome: "40x25 balcão" })).toBe("40x25 balcão");
    expect(rotuloDaMedida(A)).toBe("Minha etiqueta 40 x 25 mm");
  });

  test("o nome não entra no preset da impressão", () => {
    expect(customLabelPreset({ ...A, nome: "40x25 balcão" })).toEqual(customLabelPreset(A));
  });
});

describe("gravação com debounce", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("junta toques seguidos e grava o último estado, por empresa", async () => {
    const salvar = jest.fn(() => Promise.resolve({}));
    const g = criarGravadorDaConta({ salvar, atrasoMs: 500 });
    g.agendar("e1", { label_custom_specs: [A] });
    g.agendar("e1", { label_printer_prefs: CAL });
    g.agendar("e1", { label_custom_specs: [A, B] });
    g.agendar("e2", { label_custom_specs: [B] });
    jest.advanceTimersByTime(499);
    expect(salvar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(salvar).toHaveBeenCalledWith("e1", { label_custom_specs: [A, B], label_printer_prefs: CAL });
    expect(salvar).toHaveBeenCalledWith("e2", { label_custom_specs: [B] });
  });

  test("falha de rede chama aoFalhar; descarregar grava o pendente na hora", async () => {
    const salvar = jest.fn(() => Promise.reject(new Error("offline")));
    const aoFalhar = jest.fn();
    const g = criarGravadorDaConta({ salvar, aoFalhar, atrasoMs: 500 });
    g.agendar("e1", { label_custom_specs: [A] });
    g.descarregar();
    expect(salvar).toHaveBeenCalledTimes(1);
    await Promise.resolve(); await Promise.resolve();
    expect(aoFalhar).toHaveBeenCalledWith("e1", expect.any(Error));
    jest.advanceTimersByTime(1000);
    expect(salvar).toHaveBeenCalledTimes(1); // nada pendente
  });
});

describe("pdvSettingsApi", () => {
  test("o save genérico (objeto inteiro de outras telas) nunca leva as chaves de etiqueta", () => {
    pdvSettingsApi.save("e1", { require_customer: true, label_custom_specs: [A], label_printer_prefs: CAL } as any);
    const corpo = (request as jest.Mock).mock.calls[0][1].body;
    expect(corpo).toEqual({ settings: { require_customer: true } });
  });

  test("saveLabelConfig manda só as chaves de etiqueta", () => {
    pdvSettingsApi.saveLabelConfig("e1", { label_custom_specs: [A], extra: 1 } as any);
    const [url, opts] = (request as jest.Mock).mock.calls[0];
    expect(url).toBe("/companies/e1/pdv-settings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toEqual({ settings: { label_custom_specs: [A] } });
  });
});
