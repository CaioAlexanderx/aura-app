// 14/11/2026 — o app anota as falhas de conexão (pedido que nem chegou ao
// servidor) e manda o lote quando a conexão volta.
import {
  anotarFalhaDeConexao, enviarFalhasPendentes, falhasPendentes, caminhoSemIds,
  __reiniciarFalhasDeConexao, MAX_NA_FILA, INTERVALO_ENTRE_ENVIOS_MS,
} from "@/services/falhasDeConexao";

const T0 = Date.parse("2026-11-14T17:10:00.000Z");
const UUID = "d3ad5b0c-4730-4af9-8fa5-3b19f0c3e71e";

beforeEach(() => __reiniciarFalhasDeConexao());

describe("anotarFalhaDeConexao", () => {
  test("guarda quando, chamada (sem ids nem query), código e tentativas", () => {
    anotarFalhaDeConexao({ method: "post", path: `/companies/${UUID}/products?x=1`, code: "network", attempts: 3 }, T0);
    const [f] = falhasPendentes();
    expect(f).toMatchObject({ at: "2026-11-14T17:10:00.000Z", method: "POST", path: "/companies/:id/products", code: "network", attempts: 3 });
    expect(typeof f.id).toBe("string");
  });

  test("a fila guarda no máximo 50 (as mais antigas saem)", () => {
    for (let i = 0; i < MAX_NA_FILA + 5; i++) anotarFalhaDeConexao({ path: "/p" + i, code: "timeout" }, T0 + i);
    const fila = falhasPendentes();
    expect(fila).toHaveLength(MAX_NA_FILA);
    expect(fila[0].path).toBe("/p5");
  });

  test("caminhoSemIds troca qualquer uuid por :id", () => {
    expect(caminhoSemIds(`/companies/${UUID}/products/${UUID}/suppliers`)).toBe("/companies/:id/products/:id/suppliers");
  });
});

describe("enviarFalhasPendentes", () => {
  test("servidor aceitou: as enviadas saem da fila", async () => {
    anotarFalhaDeConexao({ path: "/a", code: "network" }, T0);
    anotarFalhaDeConexao({ path: "/b", code: "network" }, T0 + 1);
    const enviar = jest.fn().mockResolvedValue(true);
    expect(await enviarFalhasPendentes(enviar, T0 + 60000)).toBe(2);
    expect(enviar.mock.calls[0][0].map((f: any) => f.path)).toEqual(["/a", "/b"]);
    expect(falhasPendentes()).toHaveLength(0);
  });

  test("servidor recusou ou rede caiu: a fila fica para depois", async () => {
    anotarFalhaDeConexao({ path: "/a", code: "network" }, T0);
    expect(await enviarFalhasPendentes(jest.fn().mockResolvedValue(false), T0 + 60000)).toBe(0);
    expect(await enviarFalhasPendentes(jest.fn().mockRejectedValue(new Error("x")), T0 + 200000)).toBe(0);
    expect(falhasPendentes()).toHaveLength(1);
  });

  test("no máximo um envio a cada 30 s; fila vazia não chama o servidor", async () => {
    const enviar = jest.fn().mockResolvedValue(true);
    expect(await enviarFalhasPendentes(enviar, T0)).toBe(0);
    expect(enviar).not.toHaveBeenCalled();
    anotarFalhaDeConexao({ path: "/a", code: "network" }, T0);
    await enviarFalhasPendentes(enviar, T0 + 60000);
    anotarFalhaDeConexao({ path: "/b", code: "network" }, T0 + 61000);
    expect(await enviarFalhasPendentes(enviar, T0 + 60000 + INTERVALO_ENTRE_ENVIOS_MS - 1)).toBe(0);
    expect(await enviarFalhasPendentes(enviar, T0 + 60000 + INTERVALO_ENTRE_ENVIOS_MS)).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(2);
  });
});
