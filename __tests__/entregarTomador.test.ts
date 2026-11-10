// ============================================================
// utils/entregarTomador — o CPF/CNPJ do Caixa chega à NFS-e da venda.
// O backend lê o tomador do cadastro do cliente ou do /completar; o app
// manda o documento só quando a nota ficou pendente por falta dele.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn() }));

import { entregarTomadorDaVenda, _esquecerEntregas } from "@/utils/entregarTomador";

const semEspera = () => Promise.resolve();
function sit(estado: string, codigo: string | null = null) {
  return {
    origem: { tipo: "venda", id: "v1" }, estado, acao: "emitir", tem_nota: estado === "emitida",
    notas: estado === "nenhuma" ? [] : [{ id: "r1", estado, motivo_codigo: codigo, nfse_id: estado === "emitida" ? "n1" : null }],
  } as any;
}

beforeEach(() => _esquecerEntregas());

test("pendente por falta do tomador: manda o documento (só números) e o nome", async () => {
  const situacao = jest.fn()
    .mockResolvedValueOnce(sit("nenhuma"))
    .mockResolvedValueOnce(sit("pendente_dados", "SEM_TOMADOR"));
  const completar = jest.fn().mockResolvedValue(sit("emitindo"));
  const r = await entregarTomadorDaVenda(
    { companyId: "co-1", saleId: "v1", tomador: { doc: "529.982.247-25", nome: " Ana Souza " } },
    { api: { situacao, completar } as any, esperar: semEspera },
  );
  expect(completar).toHaveBeenCalledTimes(1);
  expect(completar).toHaveBeenCalledWith("co-1", "venda", "v1", { doc: "52998224725", nome: "Ana Souza" });
  expect(r && r.estado).toBe("emitindo");
});

test("nota já saindo/emitida com o cadastro do cliente: não manda nada", async () => {
  const situacao = jest.fn().mockResolvedValue(sit("emitida"));
  const completar = jest.fn();
  await entregarTomadorDaVenda(
    { companyId: "co-1", saleId: "v2", tomador: { doc: "52998224725" } },
    { api: { situacao, completar } as any, esperar: semEspera },
  );
  expect(completar).not.toHaveBeenCalled();
});

test("uma vez por venda; documento inválido nem consulta", async () => {
  const situacao = jest.fn().mockResolvedValue(sit("pendente_dados", "SEM_TOMADOR"));
  const completar = jest.fn().mockResolvedValue(sit("emitida"));
  const deps = { api: { situacao, completar } as any, esperar: semEspera };
  await entregarTomadorDaVenda({ companyId: "co-1", saleId: "v3", tomador: { doc: "11222333000181" } }, deps);
  await entregarTomadorDaVenda({ companyId: "co-1", saleId: "v3", tomador: { doc: "11222333000181" } }, deps);
  expect(completar).toHaveBeenCalledTimes(1);
  situacao.mockClear();
  await entregarTomadorDaVenda({ companyId: "co-1", saleId: "v4", tomador: { doc: "52998224726" } }, deps);
  expect(situacao).not.toHaveBeenCalled();
});

test("backend sem a rota (404): para em silêncio", async () => {
  const situacao = jest.fn().mockRejectedValue(Object.assign(new Error("nf"), { status: 404 }));
  const completar = jest.fn();
  const r = await entregarTomadorDaVenda(
    { companyId: "co-1", saleId: "v5", tomador: { doc: "52998224725" } },
    { api: { situacao, completar } as any, esperar: semEspera },
  );
  expect(r).toBeNull();
  expect(situacao).toHaveBeenCalledTimes(1);
  expect(completar).not.toHaveBeenCalled();
});
