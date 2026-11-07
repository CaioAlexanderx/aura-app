// ============================================================
// "Últimos reajustes" no Estoque: a entrada só aparece com a lista no
// backend e ao menos um reajuste. 404 (backend antigo), erro, lista vazia
// ou gate desligado (Estoque só consulta, demo, consolidado) = sem entrada.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockLista = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error {
    status: number; data: any;
    constructor(m: string, status: number, data?: any) { super(m); this.status = status; this.data = data; }
  }
  return { request: jest.fn(), ApiError };
});
jest.mock("@/services/priceAdjustmentsApi", () => ({
  priceAdjustmentsApi: { lista: (...a: any[]) => mockLista(...a) },
}));

import { ApiError } from "@/services/api";
import { useUltimosReajustes } from "@/hooks/useUltimosReajustes";

async function visivel(ligado: boolean): Promise<boolean> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let valor = false;
  function Sonda() { valor = useUltimosReajustes("c1", ligado); return null; }
  await act(async () => {
    renderer.create(<QueryClientProvider client={qc}><Sonda /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  qc.clear();
  return valor;
}

beforeEach(() => mockLista.mockReset());

it("aparece com ao menos um reajuste", async () => {
  mockLista.mockResolvedValueOnce({ adjustments: [{ id: "a1" }], total: 3 });
  expect(await visivel(true)).toBe(true);
  expect(mockLista).toHaveBeenCalledWith("c1", 1);
});

it("some sem reajuste, com 404 e com erro", async () => {
  mockLista.mockResolvedValueOnce({ adjustments: [], total: 0 });
  expect(await visivel(true)).toBe(false);
  mockLista.mockRejectedValueOnce(new (ApiError as any)("Não encontrado", 404));
  expect(await visivel(true)).toBe(false);
  mockLista.mockRejectedValueOnce(new (ApiError as any)("Erro", 500));
  expect(await visivel(true)).toBe(false);
});

it("gate desligado (Estoque só consulta, demo, consolidado) nem pergunta", async () => {
  expect(await visivel(false)).toBe(false);
  expect(mockLista).not.toHaveBeenCalled();
});
