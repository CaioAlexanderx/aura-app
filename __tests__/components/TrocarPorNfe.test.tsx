// ============================================================
// "Trocar por NF-e" no detalhe da venda (17/11/2026, card aprovado pelo Caio)
//
//   - dentro do prazo: botão → confirmação clara → cancela a NFC-e pela rota
//     de sempre → só então abre o assistente da NF-e (onCancelada)
//   - SEFAZ recusa: não abre o assistente e mostra o motivo
//   - fora do prazo (do servidor ou vencido com a tela aberta): mensagem gentil
//   - venda sem NFC-e, gateway, loja sem NF-e, falha de rede: nada (tela de hoje)
//   - no detalhe da venda: só na NFC-e autorizada da venda comum, na loja da
//     venda; onCancelada abre o Nfe55Wizard
// Mocks de sempre; testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
const mockSucesso = jest.fn();
jest.mock("@/components/Toast", () => ({ toast: { success: (...a: any[]) => mockSucesso(...a), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/JanelaEmpilhada", () => ({ JanelaEmpilhada: ({ children }: any) => children }));
jest.mock("@/components/Button", () => {
  const R = require("react");
  return { Button: (p: any) => R.createElement("Button", p, p.title) };
});
const mockTrocarNfce = jest.fn();
jest.mock("@/services/nfe55Api", () => ({ nfe55Api: { trocarNfce: (...a: any[]) => mockTrocarNfce(...a) } }));
const mockCancelNfce = jest.fn();
jest.mock("@/services/salesApi", () => ({ salesApi: { cancelNfce: (...a: any[]) => mockCancelNfce(...a) } }));

import { TrocarPorNfe } from "@/components/nfe55/TrocarPorNfe";
import { TEXTOS_TROCAR_POR_NFE as T } from "@/constants/textosTrocarPorNfe";

// NFC-e autorizada 17/11 15:21 em SP; prazo até 15:51 (18:51 UTC).
const ATE = "2026-11-17T18:51:00Z";
const ANTES = Date.parse("2026-11-17T18:40:00Z");
const DEPOIS = Date.parse("2026-11-17T19:10:00Z");
const NFCE = { id: "em-1", numero: 900, serie: 2, authorized_at: "2026-11-17T18:21:00Z", cancelavel_ate: ATE, prazo_minutos: 30, uf: "SP" };
const sit = (situacao: string, extra: any = {}) => ({ situacao, nfce: NFCE, bloqueio: null, ...extra });

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const flush = () => new Promise((r) => setTimeout(r, 0));

async function montar(resposta: any, p: any = {}) {
  if (resposta instanceof Error) mockTrocarNfce.mockRejectedValue(resposta);
  else mockTrocarNfce.mockResolvedValue(resposta);
  const onCancelada = jest.fn();
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(<TrocarPorNfe companyId="loja-b" saleId="v1" nfceId="em-1" onCancelada={onCancelada} agora={() => ANTES} {...p} />);
    await flush();
  });
  return { t, onCancelada };
}

beforeEach(() => jest.clearAllMocks());

describe("TrocarPorNfe", () => {
  it("dentro do prazo: confirma, cancela a NFC-e pela rota de sempre e só então abre o assistente", async () => {
    mockCancelNfce.mockResolvedValue({ nfce: { id: "em-1", status: "cancelada" } });
    const { t, onCancelada } = await montar(sit("pode_trocar"));
    expect(mockTrocarNfce).toHaveBeenCalledWith("loja-b", "v1");
    expect(porId(t, "venda-trocar-nfe")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("Dá para trocar até 15:51.");

    act(() => { porId(t, "venda-trocar-nfe")[0].props.onPress(); });
    expect(texto(porId(t, "venda-trocar-nfe-texto")[0])).toBe("A NFC-e nº 900 será cancelada e você vai emitir a NF-e no lugar.");
    expect(porId(t, "venda-trocar-nfe-motivo")[0].props.value).toBe(T.motivoPadrao);
    expect(mockCancelNfce).not.toHaveBeenCalled();

    await act(async () => { porId(t, "venda-trocar-nfe-confirmar")[0].props.onPress(); await flush(); });
    expect(mockCancelNfce).toHaveBeenCalledWith("loja-b", "em-1", T.motivoPadrao);
    expect(onCancelada).toHaveBeenCalledTimes(1);
    expect(mockSucesso).toHaveBeenCalledWith("NFC-e nº 900 cancelada. Agora é só emitir a NF-e.");
    expect(porId(t, "venda-trocar-nfe-confirmar-janela")).toHaveLength(0);
  });

  it("'Manter a NFC-e' fecha sem cancelar nada", async () => {
    const { t, onCancelada } = await montar(sit("pode_trocar"));
    act(() => { porId(t, "venda-trocar-nfe")[0].props.onPress(); });
    act(() => { porId(t, "venda-trocar-nfe-manter")[0].props.onPress(); });
    expect(porId(t, "venda-trocar-nfe-confirmar-janela")).toHaveLength(0);
    expect(mockCancelNfce).not.toHaveBeenCalled();
    expect(onCancelada).not.toHaveBeenCalled();
  });

  it("SEFAZ recusa: o assistente não abre e o motivo aparece na janela", async () => {
    mockCancelNfce.mockRejectedValue({ data: { error: "SEFAZ-SP recusou o cancelamento: [501] Rejeicao: Prazo de cancelamento superior ao previsto" } });
    const { t, onCancelada } = await montar(sit("pode_trocar"));
    act(() => { porId(t, "venda-trocar-nfe")[0].props.onPress(); });
    await act(async () => { porId(t, "venda-trocar-nfe-confirmar")[0].props.onPress(); await flush(); });
    expect(onCancelada).not.toHaveBeenCalled();
    expect(mockSucesso).not.toHaveBeenCalled();
    const erro = texto(porId(t, "venda-trocar-nfe-erro")[0]);
    expect(erro).toContain("A NFC-e não foi cancelada, então a NF-e não foi aberta.");
    expect(erro).toContain("[501]");
    expect(porId(t, "venda-trocar-nfe-confirmar-janela")).toHaveLength(1);
  });

  it("a rota recusa por prazo (NFCE_PRAZO_CANCELAMENTO_VENCIDO): fecha a janela e mostra a mensagem do prazo", async () => {
    mockCancelNfce.mockRejectedValue({ data: { code: "NFCE_PRAZO_CANCELAMENTO_VENCIDO", error: "O prazo para cancelar esta NFC-e já passou" } });
    const { t, onCancelada } = await montar(sit("pode_trocar"));
    act(() => { porId(t, "venda-trocar-nfe")[0].props.onPress(); });
    await act(async () => { porId(t, "venda-trocar-nfe-confirmar")[0].props.onPress(); await flush(); });
    expect(onCancelada).not.toHaveBeenCalled();
    expect(porId(t, "venda-trocar-nfe-confirmar-janela")).toHaveLength(0);
    expect(porId(t, "venda-trocar-nfe")).toHaveLength(0);
    expect(texto(porId(t, "venda-trocar-nfe-fora")[0])).toBe(T.foraDoPrazo(900, 30));
  });

  it("motivo curto: não vai à SEFAZ", async () => {
    const { t } = await montar(sit("pode_trocar"));
    act(() => { porId(t, "venda-trocar-nfe")[0].props.onPress(); });
    act(() => { porId(t, "venda-trocar-nfe-motivo")[0].props.onChangeText("curto"); });
    await act(async () => { porId(t, "venda-trocar-nfe-confirmar")[0].props.onPress(); await flush(); });
    expect(mockCancelNfce).not.toHaveBeenCalled();
    expect(texto(porId(t, "venda-trocar-nfe-erro")[0])).toBe(T.motivoCurto);
  });

  it("fora do prazo: sem botão; o link abre a mensagem gentil", async () => {
    const { t } = await montar(sit("fora_do_prazo"));
    expect(porId(t, "venda-trocar-nfe")).toHaveLength(0);
    expect(porId(t, "venda-trocar-nfe-fora")).toHaveLength(0);
    act(() => { porId(t, "venda-trocar-nfe-fora-link")[0].props.onPress(); });
    const m = texto(porId(t, "venda-trocar-nfe-fora")[0]);
    expect(m).toBe(T.foraDoPrazo(900, 30));
    expect(m).toContain("até 30 minutos depois da autorização");
    expect(m).toContain("já passou do prazo de cancelamento do estado");
    expect(m).toContain("a NF-e não pode ser emitida para esta venda pela Aura");
    expect(mockCancelNfce).not.toHaveBeenCalled();
  });

  it("o prazo venceu com a tela aberta: vira a mensagem, sem ir à SEFAZ", async () => {
    const { t } = await montar(sit("pode_trocar"), { agora: () => DEPOIS });
    expect(porId(t, "venda-trocar-nfe")).toHaveLength(0);
    expect(porId(t, "venda-trocar-nfe-fora-link")).toHaveLength(1);
  });

  it.each([
    ["sem_nfce", { nfce: null }],
    ["nfce_pendente", {}],
    ["ja_tem_nfe", {}],
    ["fora_da_aura", {}],
    ["nfe_indisponivel", { bloqueio: { code: "NFE55_UF_NAO_HABILITADA", error: "..." } }],
  ])("%s: nada aparece (a tela de hoje)", async (situacao, extra) => {
    const { t } = await montar(sit(situacao, extra));
    expect(t.toJSON()).toBeNull();
  });

  it("falha ao conferir: nada aparece", async () => {
    const { t } = await montar(new Error("rede"));
    expect(t.toJSON()).toBeNull();
  });
});
