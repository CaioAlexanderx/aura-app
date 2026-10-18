// ============================================================
// Aviso de NCM inexistente no cadastro (18/10/2026, t3-05)
//
// 3 de 3 rejeições de NFC-e em 30 dias foram a 778 (NCM inexistente). O
// cadastro agora AVISA, sem bloquear, quando o NCM de 8 números não existe na
// tabela da Receita. Aqui se trava:
//  · NCM que não existe -> aparece o texto proposto;
//  · NCM que existe, incompleto (< 8) ou vazio -> nada aparece e nem consulta;
//  · falha da consulta -> nada aparece (calar é melhor que acusar NCM bom);
//  · mesmo código não é consultado duas vezes;
//  · trocar o NCM tira o aviso do código anterior.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

const mockNcm = jest.fn();
jest.mock("@/services/fiscalApi", () => ({
  fiscalApi: { ncm: (...a: any[]) => mockNcm(...a) },
}));

import { AvisoDeNcm } from "@/components/screens/estoque/item-form/AvisoDeNcm";
import { AVISO_NCM_INEXISTENTE, __limparCacheDeNcm } from "@/hooks/useAvisoDeNcm";

const TEXTO = "Este NCM não existe na tabela da Receita. A nota fiscal com ele é recusada. Confira o código na nota do fornecedor.";

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join(" ");
  return texto(node.children);
}
const aviso = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => n.props && n.props.testID === "aviso-ncm-inexistente" && typeof n.type !== "string")[0];

async function montar(ncm: string) {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<AvisoDeNcm ncm={ncm} />); });
  return t;
}
async function passar(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockNcm.mockReset();
  __limparCacheDeNcm();
});
afterEach(() => jest.useRealTimers());

describe("AvisoDeNcm", () => {
  test("o texto proposto é exatamente o combinado", () => {
    expect(AVISO_NCM_INEXISTENTE).toBe(TEXTO);
  });

  test("NCM que não existe: mostra o aviso depois de 400 ms", async () => {
    mockNcm.mockResolvedValue({ ncm: "12345678", formato_ok: true, existe: false, descricao: null, mensagem: TEXTO, tabela: null });
    const t = await montar("12345678");
    expect(aviso(t)).toBeUndefined();
    await passar(400);
    expect(mockNcm).toHaveBeenCalledWith("12345678");
    expect(texto(aviso(t))).toBe(TEXTO);
  });

  test("usa o texto do servidor quando ele manda", async () => {
    mockNcm.mockResolvedValue({ ncm: "12345679", formato_ok: true, existe: false, descricao: null, mensagem: "Texto do servidor", tabela: null });
    const t = await montar("12345679");
    await passar(400);
    expect(texto(aviso(t))).toBe("Texto do servidor");
  });

  test("NCM que existe: sem aviso", async () => {
    mockNcm.mockResolvedValue({ ncm: "61091000", formato_ok: true, existe: true, descricao: "Camisetas", mensagem: null, tabela: null });
    const t = await montar("61091000");
    await passar(400);
    expect(mockNcm).toHaveBeenCalledTimes(1);
    expect(aviso(t)).toBeUndefined();
  });

  test("servidor sem certeza (existe=null): sem aviso", async () => {
    mockNcm.mockResolvedValue({ ncm: "61091000", formato_ok: true, existe: null, descricao: null, mensagem: null, tabela: null });
    const t = await montar("61091000");
    await passar(400);
    expect(aviso(t)).toBeUndefined();
  });

  test.each(["", "6109", "6109100"])("campo %p (incompleto ou vazio): não consulta nem avisa", async (v) => {
    const t = await montar(v);
    await passar(1000);
    expect(mockNcm).not.toHaveBeenCalled();
    expect(aviso(t)).toBeUndefined();
  });

  test("aceita pontuação: só os números contam", async () => {
    mockNcm.mockResolvedValue({ ncm: "61091000", formato_ok: true, existe: true, descricao: "x", mensagem: null, tabela: null });
    await montar("6109.10.00");
    await passar(400);
    expect(mockNcm).toHaveBeenCalledWith("61091000");
  });

  test("falha da consulta: nada aparece", async () => {
    mockNcm.mockRejectedValue(new Error("rede"));
    const t = await montar("12345670");
    await passar(400);
    expect(mockNcm).toHaveBeenCalledTimes(1);
    expect(aviso(t)).toBeUndefined();
  });

  test("resposta fora do esperado (mock sem retorno): não derruba nem avisa", async () => {
    mockNcm.mockReturnValue(undefined);
    const t = await montar("12345674");
    await passar(400);
    expect(aviso(t)).toBeUndefined();
  });

  test("o mesmo código não é consultado de novo", async () => {
    mockNcm.mockResolvedValue({ ncm: "12345671", formato_ok: true, existe: false, descricao: null, mensagem: TEXTO, tabela: null });
    const a = await montar("12345671");
    await passar(400);
    a.unmount();
    const b = await montar("12345671");
    await passar(400);
    expect(mockNcm).toHaveBeenCalledTimes(1);
    expect(texto(aviso(b))).toBe(TEXTO);
  });

  test("trocar para um NCM bom tira o aviso", async () => {
    mockNcm.mockImplementation((c: string) => Promise.resolve(
      c === "12345672"
        ? { ncm: c, formato_ok: true, existe: false, descricao: null, mensagem: TEXTO, tabela: null }
        : { ncm: c, formato_ok: true, existe: true, descricao: "Camisetas", mensagem: null, tabela: null }));
    const t = await montar("12345672");
    await passar(400);
    expect(aviso(t)).toBeDefined();
    await act(async () => { t.update(<AvisoDeNcm ncm="61091000" />); });
    await passar(400);
    expect(aviso(t)).toBeUndefined();
  });

  test("apagar um dígito tira o aviso na hora, sem consultar", async () => {
    mockNcm.mockResolvedValue({ ncm: "12345673", formato_ok: true, existe: false, descricao: null, mensagem: TEXTO, tabela: null });
    const t = await montar("12345673");
    await passar(400);
    expect(aviso(t)).toBeDefined();
    await act(async () => { t.update(<AvisoDeNcm ncm="1234567" />); });
    expect(aviso(t)).toBeUndefined();
    expect(mockNcm).toHaveBeenCalledTimes(1);
  });
});
