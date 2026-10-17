// 17/10/2026 (tq-15): pdvApi.createSale põe o Idempotency-Key só quando o
// Caixa manda a chave. Sem ela, a requisição é a de sempre (sem cabeçalho).
jest.mock("@/services/api", () => ({ request: jest.fn(() => Promise.resolve({})) }));

import { request } from "@/services/api";
import { pdvApi } from "@/services/pdvApi";

const req = request as unknown as jest.Mock;

beforeEach(() => req.mockClear());

test("com chave: cabeçalho Idempotency-Key, body intacto", async () => {
  await pdvApi.createSale("empresa-1", { items: [] }, { idempotencyKey: "5f0c1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b" });
  const [path, opts] = req.mock.calls[0];
  expect(path).toBe("/companies/empresa-1/pdv/sale");
  expect(opts.method).toBe("POST");
  expect(opts.headers).toEqual({ "Idempotency-Key": "5f0c1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b" });
  expect(opts.body).toEqual({ items: [] });
});

test("sem chave (Studio, Ótica, Financeiro): sem cabeçalho", async () => {
  await pdvApi.createSale("empresa-1", { items: [] });
  expect(req.mock.calls[0][1].headers).toBeUndefined();
  await pdvApi.createSale("empresa-1", { items: [] }, { idempotencyKey: null });
  expect(req.mock.calls[1][1].headers).toBeUndefined();
});
