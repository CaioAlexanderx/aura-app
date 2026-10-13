// ============================================================
// useRegistroDeTelas — o elo entre rota, sessão e registro.
//
// O QUE ESTES TESTES GUARDAM:
//
// 1. Uma entrada na tela conta UMA vez — re-render não conta de novo,
//    mudar de rota conta a nova.
// 2. Sem sessão (token nulo) e nas telas de autenticação não conta nem
//    envia nada.
// 3. Trocar de empresa (token novo) manda o lote da anterior, com o
//    token da anterior, antes da nova sessão acumular.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({
  BASE_URL: "http://api.test/v1",
  request: (...a: any[]) => mockRequest(...a),
}));

let mockSegments: string[] = ["(tabs)", "pdv"];
jest.mock("expo-router", () => ({ useSegments: () => mockSegments }));

let mockToken: string | null = "tk-A";
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel: (s: any) => any) => sel({ token: mockToken }),
}));

import { useRegistroDeTelas } from "@/hooks/useRegistroDeTelas";
import { INTERVALO_DO_LOTE_MS } from "@/services/registroDeTelas";

function Sonda() {
  useRegistroDeTelas();
  return null;
}

function montar() {
  let arvore!: renderer.ReactTestRenderer;
  act(() => {
    arvore = renderer.create(<Sonda />);
  });
  return {
    refazer: () => act(() => arvore.update(<Sonda />)),
    desmontar: () => act(() => arvore.unmount()),
  };
}

function telasEnviadas(chamada: number) {
  return mockRequest.mock.calls[chamada][1].body.views.map((v: any) => [v.screen, v.count]);
}

describe("useRegistroDeTelas", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRequest.mockReset().mockResolvedValue({});
    mockSegments = ["(tabs)", "pdv"];
    mockToken = "tk-A";
    jest.spyOn(console, "debug").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("re-render não conta de novo; rota nova conta", () => {
    const m = montar();
    m.refazer();
    m.refazer();
    mockSegments = ["(tabs)", "estoque"];
    m.refazer();
    mockSegments = ["(tabs)", "pdv"];
    m.refazer();

    act(() => {
      jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(telasEnviadas(0)).toEqual([["pdv", 2], ["estoque", 1]]);
    m.desmontar();
  });

  test("mesma tela com parâmetro diferente é a mesma entrada", () => {
    mockSegments = ["(tabs)", "clientes", "[id]"];
    const m = montar();
    mockSegments = ["(tabs)", "clientes", "[id]"];
    m.refazer();
    act(() => {
      jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    });
    expect(telasEnviadas(0)).toEqual([["clientes", 1]]);
    m.desmontar();
  });

  test("sem sessão não conta nem envia", () => {
    mockToken = null;
    const m = montar();
    mockSegments = ["(tabs)", "estoque"];
    m.refazer();
    act(() => {
      jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS * 2);
    });
    m.desmontar();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test("tela de autenticação não conta", () => {
    mockSegments = ["(auth)", "login"];
    const m = montar();
    act(() => {
      jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    });
    m.desmontar();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  test("entrar na sessão com a tela já aberta conta essa tela", () => {
    mockToken = null;
    const m = montar();
    mockToken = "tk-A";
    m.refazer();
    act(() => {
      jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    });
    expect(telasEnviadas(0)).toEqual([["pdv", 1]]);
    m.desmontar();
  });

  test("trocar de empresa manda o lote anterior com o token anterior", () => {
    const m = montar(); // pdv sob tk-A
    mockToken = "tk-B";
    mockSegments = ["(tabs)", "estoque"];
    m.refazer();

    // saiu na hora, sem esperar os 60 s, e com o token da empresa A
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][1].token).toBe("tk-A");
    expect(telasEnviadas(0)).toEqual([["pdv", 1]]);

    act(() => {
      jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
    });
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][1].token).toBe("tk-B");
    expect(telasEnviadas(1)).toEqual([["estoque", 1]]);
    m.desmontar();
  });

  test("404 do backend não derruba nada", async () => {
    mockRequest.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    const m = montar();
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(INTERVALO_DO_LOTE_MS);
      });
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    m.desmontar();
  });
});
