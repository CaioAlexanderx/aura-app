// ============================================================
// Cadastro rápido de cliente (Caixa e "Indicado por" do Matcon),
// 25/09/2026: só o nome é obrigatório.
//
// Caso GF Amorim: 25 vendas e nenhum cliente cadastrado, porque o botão
// só acendia com data de nascimento e telefone.
// ============================================================
import { validarCadastroRapido } from "@/utils/cadastroRapidoCliente";

const v = (name: string, birthDate = "", phone = "") => validarCadastroRapido({ name, birthDate, phone });

describe("validarCadastroRapido", () => {
  test("só o nome basta: telefone e nascimento vão como null", () => {
    expect(v("João da Obra")).toEqual({ ok: true, body: { name: "João da Obra", phone: null, birth_date: null } });
  });

  test("sem nome (ou 1 letra) não cadastra", () => {
    expect(v("").ok).toBe(false);
    expect(v("  J ").ok).toBe(false);
  });

  test("nome vai sem espaços nas pontas", () => {
    const r = v("  Maria  ");
    expect(r.ok && r.body.name).toBe("Maria");
  });

  test("telefone e data completos vão formatados", () => {
    expect(v("Ana", "05/03/1990", "(12) 99999-0000")).toEqual({
      ok: true, body: { name: "Ana", phone: "12999990000", birth_date: "1990-03-05" },
    });
  });

  test("telefone começado e não terminado é erro, não some em silêncio", () => {
    const r = v("Ana", "", "(12) 9999");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/Telefone incompleto/);
  });

  test("data começada e não terminada é erro", () => {
    const r = v("Ana", "05/03", "");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/incompleta/);
  });

  test.each(["31/02/1990", "00/01/1990", "15/13/1990", "01/01/1800"])("data inexistente %s é erro", (d) => {
    const r = v("Ana", d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/inválida/);
  });
});
