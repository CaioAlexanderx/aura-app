import { acharClienteRepetido, clientesDoCache, nomeParaComparar } from "@/utils/clienteRepetido";
import { QueryClient } from "@tanstack/react-query";

const ana = { id: "c1", name: "Ana Souza", phone: "(11) 98888-7777" };
const bia = { id: "c2", name: "Bia Lima", phone: "" };

describe("acharClienteRepetido (p-168)", () => {
  test("acha pelo telefone, mesmo com mascara diferente", () => {
    expect(acharClienteRepetido([{ customers: [ana, bia] }], "Outra", "11988887777")).toEqual(ana);
  });
  test("acha pelo nome exato, sem diferenciar maiusculas e espacos", () => {
    expect(acharClienteRepetido([[ana, bia]], "  bia lima ", "")).toEqual({ ...bia, phone: "" });
  });
  // 17/11/2026 (p-167): "+ Novo cliente" da troca compara o nome sem acento.
  test("acha pelo nome sem acento, nos dois sentidos", () => {
    const joao = { id: "c3", name: "João Simões", phone: "" };
    expect(acharClienteRepetido([[joao]], "joao simoes", "")).toEqual(joao);
    expect(acharClienteRepetido([[{ ...joao, name: "Joao  Simoes" }]], "JOÃO SIMÕES", "")?.id).toBe("c3");
    expect(nomeParaComparar("  Ângela   Côrtes ")).toBe("angela cortes");
    expect(acharClienteRepetido([[joao]], "João Simão", "")).toBeNull();
  });
  test("telefone curto nao conta; nome diferente nao acha", () => {
    expect(acharClienteRepetido([{ rows: [ana] }], "Carla", "1198")).toBeNull();
  });
  test("cache vazio ou em formato desconhecido", () => {
    expect(acharClienteRepetido([undefined, null, { outra: 1 }], "Ana Souza", "")).toBeNull();
    expect(clientesDoCache({ customers: [ana] })).toEqual([ana]);
  });
  test("le a lista guardada com a chave do useCustomers (com o sort no fim)", () => {
    const qc = new QueryClient();
    qc.setQueryData(["customers", "emp-1", "recent"], { customers: [ana] });
    // a leitura antiga, pela chave exata, nao achava nada
    expect(qc.getQueryData(["customers", "emp-1"])).toBeUndefined();
    const listas = qc.getQueriesData<any>({ queryKey: ["customers"] }).map(([, d]) => d);
    expect(acharClienteRepetido(listas, "ana souza", "")).toEqual(ana);
  });
});
