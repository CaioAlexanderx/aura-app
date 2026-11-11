// p-108 (entrega C): contexto das telas de resultado da conferência.
// Refetch do /auth/me ao abrir, quem edita, e as lojas da transferência
// pelo mesmo critério do Estoque (lojasDaTransferencia).
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockAuth: any;
let mockPerm: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => mockPerm }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

import { useConferenciaContexto, type ContextoConferencia } from "@/hooks/useConferenciaResultado";

let ultimo: ContextoConferencia;
function Sonda({ loja }: { loja?: string | null }) { ultimo = useConferenciaContexto(loja); return null; }
function montar(loja?: string | null) { act(() => { renderer.create(<Sonda loja={loja} />); }); return ultimo; }

const LOJAS = [{ id: "c1", trade_name: "Loja Centro" }, { id: "c2", name: "Loja Shopping" }];

beforeEach(() => {
  mockAuth = { company: { id: "c1", name: "Loja Centro", member_role: "owner" }, token: "t", consolidatedView: false, availableCompanies: LOJAS, isDemo: false, refreshMe: jest.fn(() => Promise.resolve()) };
  mockPerm = { data: { is_owner: true }, isLoading: false };
});

it("revalida o /auth/me ao abrir", () => {
  montar();
  expect(mockAuth.refreshMe).toHaveBeenCalledTimes(1);
});

it("dono com 2 lojas: edita e transfere da loja ativa", () => {
  const c = montar();
  expect(c.companyId).toBe("c1");
  expect(c.podeEditar).toBe(true);
  expect(c.lojasTransferencia && c.lojasTransferencia.destinos).toEqual([{ id: "c2", nome: "Loja Shopping" }]);
});

it("uma loja só, ou só consulta: sem transferir", () => {
  mockAuth.availableCompanies = [LOJAS[0]];
  expect(montar().lojasTransferencia).toBeNull();
  mockAuth.availableCompanies = LOJAS;
  mockAuth.company.member_role = "member";
  mockPerm = { data: { role: "member", permissions: { estoque_consulta: true } }, isLoading: false };
  const c = montar();
  expect(c.lojasTransferencia).toBeNull();
  expect(c.podeEditar).toBe(false);
  expect(c.semCusto).toBe(true);
});

it("funcionário com estoque edita; enquanto a permissão carrega, não", () => {
  mockAuth.company.member_role = "member";
  mockPerm = { data: { role: "member", permissions: { estoque: true } }, isLoading: false };
  expect(montar().podeEditar).toBe(true);
  mockPerm = { data: undefined, isLoading: true };
  expect(montar().podeEditar).toBe(false);
});

it("consolidado: sem loja da rota não há loja; com ?loja= usa ela", () => {
  mockAuth.consolidatedView = true;
  mockAuth.company = null;
  const c = montar();
  expect(c.companyId).toBeNull();
  expect(c.lojasParaEscolher.map((l) => l.id)).toEqual(["c1", "c2"]);
  const d = montar("c2");
  expect(d.companyId).toBe("c2");
  expect(d.nomeDaLoja).toBe("Loja Shopping");
  // mesmo critério do Estoque: nunca transfere no consolidado
  expect(d.lojasTransferencia).toBeNull();
});
