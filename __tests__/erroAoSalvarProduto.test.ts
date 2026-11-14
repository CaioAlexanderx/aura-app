// 14/11/2026 — editar produto com código de barras repetido mostra o
// motivo que o servidor mandou (409), não "Erro ao atualizar produto".
import { mensagemDoErroAoSalvar } from "@/utils/erroAoSalvarProduto";
import { ApiError } from "@/services/api";

const PADRAO = "Erro ao atualizar produto";

describe("mensagemDoErroAoSalvar", () => {
  test("409 do código de barras repetido: mostra a explicação do servidor", () => {
    const msg = 'O código de barras 789 já está no produto "Banner". Use outro código, deixe o campo vazio ou edite aquele produto.';
    const err = new ApiError(msg, 409, { error: msg, code: "BARCODE_DUPLICADO" });
    expect(mensagemDoErroAoSalvar(err, PADRAO)).toBe(msg);
  });
  test("400 de validação também mostra o motivo", () => {
    expect(mensagemDoErroAoSalvar(new ApiError("purchase_factor deve ser maior que zero", 400), PADRAO)).toBe("purchase_factor deve ser maior que zero");
  });
  test("5xx, rede e erro sem status seguem com o texto padrão", () => {
    expect(mensagemDoErroAoSalvar(new ApiError("Algo deu errado do nosso lado", 500), PADRAO)).toBe(PADRAO);
    expect(mensagemDoErroAoSalvar(new ApiError("Sem conexão", 0, null, true), PADRAO)).toBe(PADRAO);
    expect(mensagemDoErroAoSalvar(new Error("x"), PADRAO)).toBe(PADRAO);
    expect(mensagemDoErroAoSalvar(null, PADRAO)).toBe(PADRAO);
  });
});
