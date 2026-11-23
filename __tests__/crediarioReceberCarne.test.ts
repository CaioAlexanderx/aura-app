// ============================================================
// Receber com um carnê escolhido (QA 23/11/2026, P1-4)
//
// O servidor (applyPayment com account_id) cobre o carnê e manda a sobra para
// as outras parcelas; a prévia com account_id chamava a sobra de "crédito".
// "Quitar" com carnê = o que falta no carnê; acima disso, prévia e envio vão
// como "todas as compras" (a mesma conta nos dois lados).
// ============================================================
import fs from "fs";
import path from "path";
import { avisoPassaDoCarne, contaParaOValor, valorDeQuitar } from "@/utils/crediarioReceberCarne";
import { fmt } from "@/components/crediario/ficha/fichaHelpers";

describe("valorDeQuitar", () => {
  test("com carnê: o que falta nele, não o total da cliente", () => {
    expect(valorDeQuitar(380, 160.1)).toBe(160.1);
  });
  test("sem carnê (Todos): o total", () => {
    expect(valorDeQuitar(380, null)).toBe(380);
    expect(valorDeQuitar(-20, null)).toBe(0);
  });
});

describe("contaParaOValor", () => {
  test("até o que falta no carnê: vai para o carnê", () => {
    expect(contaParaOValor("k1", 160.1, 160.1)).toBe("k1");
    expect(contaParaOValor("k1", 50, 160.1)).toBe("k1");
  });
  test("acima: vai como todas as compras (prévia e servidor fazem a mesma conta)", () => {
    expect(contaParaOValor("k1", 380, 160.1)).toBeUndefined();
  });
  test("sem carnê: como veio", () => {
    expect(contaParaOValor(undefined, 380, null)).toBeUndefined();
    expect(contaParaOValor(null, 380, null)).toBeNull();
  });
  test("aviso", () => {
    expect(avisoPassaDoCarne("Compra de 19/10", 160.1, fmt))
      .toBe("O valor passa do que falta em Compra de 19/10 (R$ 160,10). Ele vai para todas as compras, da parcela mais antiga para a mais nova.");
  });
});

describe("a ficha usa a regra na prévia, no envio e no Quitar", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
  test("prévia e envio", () => {
    expect(fonte).toContain("const conta = contaParaOValor(accountId, amt, faltaDoCarneRef.current(accountId));");
    expect(fonte).toContain("account_id: conta,");
    expect(fonte).toContain("account_id: contaParaOValor(freeAccountId, amt, faltaDoCarneRef.current(freeAccountId)),");
  });
  test("Quitar", () => {
    expect(fonte).toContain("onPress={() => prefill(valorDeQuitar(totalBalance, faltaDoCarneRef.current(freeAccountId)))}");
    expect(fonte).not.toContain("onPress={() => prefill(totalBalance)}");
  });
});
