// Valor pago e data do pagamento (28/09/2026) — regras do cadastro e do texto
// da diferença (juros/desconto), sem calcular juros nem porcentagem.
import { camposDaSituacao, diferencaPaga, textoDaDiferenca, rotulosDaSituacao } from "@/utils/lancamentoPago";

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");

describe("camposDaSituacao", () => {
  it("vou pagar: só pendente, ignora data e valor pagos", () => {
    expect(camposDaSituacao({ situacao: "aberto", valor: 180, pagoEm: "2026-09-20", valorPago: 186.4 })).toEqual({ status: "pending" });
  });
  it("já paguei com juros: data e valor pagos", () => {
    expect(camposDaSituacao({ situacao: "pago", valor: 180, pagoEm: "2026-09-20", valorPago: 186.4 }))
      .toEqual({ status: "confirmed", paid_at: "2026-09-20", paid_amount: 186.4 });
  });
  it("já paguei o valor exato (ou sem digitar): não manda paid_amount", () => {
    expect(camposDaSituacao({ situacao: "pago", valor: 180, pagoEm: "2026-09-20", valorPago: 180 })).toEqual({ status: "confirmed", paid_at: "2026-09-20" });
    expect(camposDaSituacao({ situacao: "pago", valor: 180, valorPago: null })).toEqual({ status: "confirmed" });
  });
});

describe("diferencaPaga / textoDaDiferenca", () => {
  it("juros, desconto e sem diferença", () => {
    expect(diferencaPaga(186.4, 180)).toEqual({ valor: 6.4, sentido: "mais" });
    expect(diferencaPaga(175, 180)).toEqual({ valor: 5, sentido: "menos" });
    expect(diferencaPaga(180, 180)).toBeNull();
    expect(diferencaPaga(180, null)).toBeNull();
  });
  it("texto por tipo", () => {
    expect(textoDaDiferenca({ valor: 6.4, sentido: "mais" }, "expense", fmt)).toBe("R$ 6,40 a mais (juros ou multa)");
    expect(textoDaDiferenca({ valor: 6.4, sentido: "mais" }, "income", fmt)).toBe("R$ 6,40 a mais");
    expect(textoDaDiferenca({ valor: 5, sentido: "menos" }, "expense", fmt)).toBe("R$ 5,00 a menos (desconto)");
  });
  it("rótulos da escolha", () => {
    expect(rotulosDaSituacao("expense")).toMatchObject({ pago: "Já paguei", aberto: "Vou pagar", data: "Pago em" });
    expect(rotulosDaSituacao("income")).toMatchObject({ pago: "Já recebi", aberto: "Vou receber", data: "Recebido em" });
  });
});
