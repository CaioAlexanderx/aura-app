// ============================================================
// p-207 (23/11/2026): termos da venda por loja em Ótica › Configurações.
//
// O que este arquivo trava:
//   1. Servidor sem a chave sale_terms: a tela não desenha o campo e o
//      salvar não manda a chave (backend antigo, nada muda).
//   2. Servidor com a chave: o campo aparece com o texto da loja e o
//      salvar manda o texto normalizado (quebras de linha ficam).
//   3. Texto acima de 4000 letras: não salva e avisa.
//   4. As regras de normalização batem com as do servidor.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockToastError = jest.fn();
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: (...a: any[]) => mockToastError(...a) },
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "otica-1" } }) }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: { otica_enabled: true } }) }));

// O mesmo objeto a cada render, como o react-query: um objeto novo por
// render dispararia o useEffect([sData]) da tela sem parar.
let mockSettingsQuery: any = { data: { settings: {} }, isLoading: false };
const mockLabsQuery = { data: { labs: [] } };
const mockVazio = { data: undefined };
function definirSettings(settings: any) { mockSettingsQuery = { data: { settings }, isLoading: false }; }
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: (cfg: any) => {
    const k = cfg.queryKey?.[0];
    if (k === "otica-settings") return mockSettingsQuery;
    if (k === "otica-labs") return mockLabsQuery;
    return mockVazio;
  },
}));
const mockSave = jest.fn((_cid: string, _body: any) => Promise.resolve({ settings: {} }));
jest.mock("@/services/oticaApi", () => {
  const actual = jest.requireActual("@/services/oticaApi");
  return { ...actual, oticaApi: { ...actual.oticaApi, saveSettings: (cid: string, body: any) => mockSave(cid, body) } };
});

import OticaConfigScreen from "@/app/(tabs)/otica/config";
import { normalizarTermos, termosAceitos, termosLongos, TERMOS_MAX } from "@/utils/oticaTermos";

const BASE = {
  prescription_validity_months: 12, adaptation_warranty_days: 90, default_lab_id: null,
  rt_name: "", rt_registry: "", sanitary_license: "",
  wa_ready_auto: false, wa_adaptation_auto: false, wa_revision_auto: false,
};

function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
async function montar() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<OticaConfigScreen />); });
  return tree;
}
async function salvar(tree: renderer.ReactTestRenderer) {
  await act(async () => { porTestID(tree, "otica-cfg-salvar")[0].props.onPress(); });
}

beforeEach(() => { mockSave.mockClear(); mockToastError.mockClear(); });

describe("tela de configurações da ótica", () => {
  it("servidor sem sale_terms: sem campo e sem a chave no salvar", async () => {
    definirSettings({ ...BASE });
    const tree = await montar();
    expect(porTestID(tree, "otica-cfg-termos")).toHaveLength(0);
    await act(async () => { porTestID(tree, "otica-cfg-validade")[0].props.onChangeText("6"); });
    await salvar(tree);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect("sale_terms" in (mockSave.mock.calls[0][1] as any)).toBe(false);
  });

  it("servidor com sale_terms: mostra o texto e salva normalizado", async () => {
    definirSettings({ ...BASE, sale_terms: "Prazo: 7 dias." });
    const tree = await montar();
    const campo = porTestID(tree, "otica-cfg-termos");
    expect(campo).toHaveLength(1);
    expect(campo[0].props.value).toBe("Prazo: 7 dias.");
    await act(async () => { campo[0].props.onChangeText("Prazo: 7 dias.\r\n\r\n\r\nSem troca de lente.  "); });
    await salvar(tree);
    expect((mockSave.mock.calls[0][1] as any).sale_terms).toBe("Prazo: 7 dias.\n\nSem troca de lente.");
  });

  it("texto acima do limite não salva", async () => {
    definirSettings({ ...BASE, sale_terms: "" });
    const tree = await montar();
    await act(async () => { porTestID(tree, "otica-cfg-termos")[0].props.onChangeText("a".repeat(TERMOS_MAX + 1)); });
    await salvar(tree);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });
});

describe("utils/oticaTermos", () => {
  it("termosAceitos só com a chave em texto", () => {
    expect(termosAceitos(null)).toBe(false);
    expect(termosAceitos({})).toBe(false);
    expect(termosAceitos({ sale_terms: "" })).toBe(true);
  });
  it("normaliza como o servidor", () => {
    expect(normalizarTermos("  a  \r\nb\r\n\r\n\r\n\r\nc ")).toBe("a\nb\n\nc");
    expect(normalizarTermos(null)).toBe("");
  });
  it("limite de 4000 letras depois de normalizar", () => {
    expect(termosLongos("a".repeat(4000))).toBe(false);
    expect(termosLongos("a".repeat(4001))).toBe(true);
    expect(termosLongos("  " + "a".repeat(4000) + "  ")).toBe(false);
  });
});
