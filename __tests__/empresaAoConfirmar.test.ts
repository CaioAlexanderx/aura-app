// tq-113: ao confirmar o e-mail, a sessão sem empresa renova o token e relê o /me.
import { precisaRecarregarEmpresa, recarregarEmpresaAoConfirmar } from "../utils/empresaAoConfirmar";

function sessao(inicial: { token: string | null; company: unknown; consolidatedView: boolean }, empresaDepois: unknown = { id: "c1" }) {
  const estado: any = { ...inicial };
  estado.refreshMe = jest.fn(async () => { estado.company = empresaDepois; });
  return { getState: () => estado, estado };
}

describe("precisaRecarregarEmpresa", () => {
  it("só a sessão logada, sem empresa e fora do consolidado", () => {
    expect(precisaRecarregarEmpresa({ token: "t", company: null, consolidatedView: false })).toBe(true);
    expect(precisaRecarregarEmpresa({ token: "t", company: { id: "c1" }, consolidatedView: false })).toBe(false);
    expect(precisaRecarregarEmpresa({ token: "t", company: null, consolidatedView: true })).toBe(false);
    expect(precisaRecarregarEmpresa({ token: null, company: null, consolidatedView: false })).toBe(false);
    expect(precisaRecarregarEmpresa(null)).toBe(false);
  });
});

describe("recarregarEmpresaAoConfirmar", () => {
  it("empresa reaberta: renova o token, relê o /me e devolve true", async () => {
    const s = sessao({ token: "t", company: null, consolidatedView: false });
    const renovarToken = jest.fn(async () => ({ status: "ok" }));
    await expect(recarregarEmpresaAoConfirmar({ getState: s.getState, renovarToken })).resolves.toBe(true);
    expect(renovarToken).toHaveBeenCalledTimes(1);
    expect(s.estado.refreshMe).toHaveBeenCalledTimes(1);
  });

  it("conta comum (empresa já na sessão): não chama nada", async () => {
    const s = sessao({ token: "t", company: { id: "c1" }, consolidatedView: false });
    const renovarToken = jest.fn(async () => ({ status: "ok" }));
    await expect(recarregarEmpresaAoConfirmar({ getState: s.getState, renovarToken })).resolves.toBe(false);
    expect(renovarToken).not.toHaveBeenCalled();
    expect(s.estado.refreshMe).not.toHaveBeenCalled();
  });

  it("renovação falhou: não relê o /me e não lança", async () => {
    const s = sessao({ token: "t", company: null, consolidatedView: false });
    const renovarToken = jest.fn(async () => ({ status: "network_error" }));
    await expect(recarregarEmpresaAoConfirmar({ getState: s.getState, renovarToken })).resolves.toBe(false);
    expect(s.estado.refreshMe).not.toHaveBeenCalled();
  });

  it("erro inesperado vira false (a confirmação segue)", async () => {
    const s = sessao({ token: "t", company: null, consolidatedView: false });
    const renovarToken = jest.fn(async () => { throw new Error("boom"); });
    await expect(recarregarEmpresaAoConfirmar({ getState: s.getState, renovarToken })).resolves.toBe(false);
  });

  it("sem empresa ativa mesmo depois do /me: devolve false", async () => {
    const s = sessao({ token: "t", company: null, consolidatedView: false }, null);
    const renovarToken = jest.fn(async () => ({ status: "ok" }));
    await expect(recarregarEmpresaAoConfirmar({ getState: s.getState, renovarToken })).resolves.toBe(false);
  });
});
