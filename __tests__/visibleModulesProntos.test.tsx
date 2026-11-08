// ============================================================
// useVisibleModulesProntos (QA De/Por, 08/11/2026)
//
// Recarregar /black-friday derrubava o app: a porta da rota decidia "sem
// acesso" no primeiro render, com a sessão ainda hidratando, e navegava antes
// do layout raiz montar. O hook diz quando o conjunto de useVisibleModules
// já serve para decidir: sessão hidratada, com token, e /auth/my-permissions
// respondido (ou falhado). Antes disso, e sem sessão, é false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

import { useVisibleModulesProntos } from "@/hooks/useVisibleModules";

const CID = "aaaaaaaa-0000-4000-8000-000000000001";
let visto: boolean[];

function Sonda() {
  visto.push(useVisibleModulesProntos());
  return null;
}

function montar(qc: QueryClient) {
  let r!: renderer.ReactTestRenderer;
  act(() => { r = renderer.create(<QueryClientProvider client={qc}><Sonda /></QueryClientProvider>); });
  return r;
}

function novoCliente() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function esperar(ms = 0) {
  await act(async () => { await new Promise((ok) => setTimeout(ok, ms)); });
}

beforeEach(() => {
  visto = [];
  mockRequest.mockReset();
  mockAuth = { company: { id: CID, plan: "negocio" }, consolidatedView: false, token: "t", isHydrated: true };
});

describe("useVisibleModulesProntos", () => {
  it("antes de hidratar a sessão: false", () => {
    mockAuth = { company: null, consolidatedView: false, token: null, isHydrated: false };
    const r = montar(novoCliente());
    expect(visto[visto.length - 1]).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
    r.unmount();
  });

  it("hidratada sem sessão (deslogado): false — quem leva ao login é o AuthGuard", () => {
    mockAuth = { company: null, consolidatedView: false, token: null, isHydrated: true };
    const r = montar(novoCliente());
    expect(visto[visto.length - 1]).toBe(false);
    r.unmount();
  });

  it("com sessão: false enquanto as permissões chegam, true quando chegam", async () => {
    let responder!: (v: any) => void;
    mockRequest.mockReturnValue(new Promise((ok) => { responder = ok; }));
    const r = montar(novoCliente());
    expect(visto[visto.length - 1]).toBe(false);
    expect(mockRequest).toHaveBeenCalledWith("/auth/my-permissions");
    await act(async () => { responder({ is_owner: true }); });
    await esperar();
    expect(visto[visto.length - 1]).toBe(true);
    r.unmount();
  });

  it("permissões falharam: true (decide pelo plano, como o menu)", async () => {
    mockRequest.mockRejectedValue(new Error("fora do ar"));
    const r = montar(novoCliente());
    // O hook tenta de novo uma vez (retry: 1, ~1 s de espera do React Query).
    await esperar(1600);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(visto[visto.length - 1]).toBe(true);
    r.unmount();
  });
});
