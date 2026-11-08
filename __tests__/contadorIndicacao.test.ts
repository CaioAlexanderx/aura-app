// ============================================================================
// Contadores do banner de indicação (08/11/2026, card b-mk-30)
//
// Vista e clique vão ao backend uma vez por sessão por banner; banner que não
// é de indicação, ou sem empresa, não chama nada; falha de rede libera tentar
// de novo.
// ============================================================================
jest.mock("@/services/notificationsApi", () => ({
  notificationsApi: { registrarIndicacao: jest.fn(() => Promise.resolve({ registrado: true })) },
}));

import { notificationsApi } from "@/services/notificationsApi";
import {
  registrarEventoDoBanner,
  ehBannerDaCampanhaDeIndicacao,
  _limparContadorIndicacao,
} from "@/utils/contadorIndicacao";

const registrar = notificationsApi.registrarIndicacao as jest.Mock;
const espera = () => new Promise((r) => setTimeout(r, 0));

const indicacao = { id: "b1", campanha: "indicacao" as const };
const comum: { id: string; campanha?: "indicacao" } = { id: "b2" };

beforeEach(() => {
  _limparContadorIndicacao();
  registrar.mockClear();
  registrar.mockImplementation(() => Promise.resolve({ registrado: true }));
});

test("reconhece só o banner da campanha de indicação", () => {
  expect(ehBannerDaCampanhaDeIndicacao(indicacao)).toBe(true);
  expect(ehBannerDaCampanhaDeIndicacao(comum)).toBe(false);
  expect(ehBannerDaCampanhaDeIndicacao(null)).toBe(false);
});

test("vista e clique chamam o backend uma vez por sessão", async () => {
  expect(registrarEventoDoBanner("c1", indicacao, "vista")).toBe(true);
  expect(registrarEventoDoBanner("c1", indicacao, "vista")).toBe(false);
  expect(registrarEventoDoBanner("c1", indicacao, "clique")).toBe(true);
  await espera();
  expect(registrar).toHaveBeenCalledTimes(2);
  expect(registrar).toHaveBeenNthCalledWith(1, "c1", "b1", "vista");
  expect(registrar).toHaveBeenNthCalledWith(2, "c1", "b1", "clique");
});

test("banner comum ou sem empresa não chama nada", async () => {
  expect(registrarEventoDoBanner("c1", comum, "vista")).toBe(false);
  expect(registrarEventoDoBanner(undefined, indicacao, "vista")).toBe(false);
  await espera();
  expect(registrar).not.toHaveBeenCalled();
});

test("falha de rede não quebra e deixa tentar de novo", async () => {
  registrar.mockImplementationOnce(() => Promise.reject(new Error("offline")));
  expect(registrarEventoDoBanner("c1", indicacao, "vista")).toBe(true);
  await espera();
  expect(registrarEventoDoBanner("c1", indicacao, "vista")).toBe(true);
  await espera();
  expect(registrar).toHaveBeenCalledTimes(2);
});
