// Ficha do crediário (F1, 23/11/2026): um aviso por vez no cabeçalho, o mais
// grave primeiro — contas que não batem, parcelas a conferir, costuma atrasar.
// E as Movimentações recarregam depois de receber, renegociar e mudar o
// vencimento (o botão Atualizar saiu).
import fs from "fs";
import path from "path";
import { avisoDaFicha } from "@/utils/crediarioAvisoDaFicha";

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");
const base = { divergencia: false, somaDasParcelas: 0, saldoDaConta: 0, aConferir: 0, costumaAtrasar: false, fmt };

describe("avisoDaFicha", () => {
  test("nada a avisar: nenhum aviso", () => {
    expect(avisoDaFicha(base)).toBeNull();
  });
  test("tudo junto: só as contas que não batem", () => {
    const a = avisoDaFicha({ ...base, divergencia: true, somaDasParcelas: 410.66, saldoDaConta: 380, aConferir: 2, costumaAtrasar: true });
    expect(a?.tipo).toBe("divergencia");
    expect(a?.texto).toBe("As parcelas somam R$ 410,66, mas a conta dela mostra R$ 380,00. Veja os lançamentos em Movimentações.");
  });
  test("a conferir vem antes do costuma atrasar", () => {
    expect(avisoDaFicha({ ...base, aConferir: 1, costumaAtrasar: true })?.texto)
      .toBe("1 parcela venceu antes de o carnê ser cadastrado. Confira se já foi paga.");
    expect(avisoDaFicha({ ...base, aConferir: 3 })?.texto)
      .toBe("3 parcelas venceram antes de o carnê ser cadastrado. Confira se já foram pagas.");
  });
  test("só o score", () => {
    expect(avisoDaFicha({ ...base, costumaAtrasar: true })?.texto)
      .toBe("Esta cliente costuma atrasar. Você pode vender normalmente: é só um aviso.");
  });
});

describe("Movimentações recarrega depois de mexer no dinheiro", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
  /** Corpo de uma função/bloco a partir do marcador até o próximo `catch`. */
  function trechoDeSucesso(marcador: string): string {
    const i = fonte.indexOf(marcador);
    expect(i).toBeGreaterThan(-1);
    const fim = fonte.indexOf("catch", i);
    return fonte.slice(i, fim > i ? fim : undefined);
  }
  test("receber pagamento", () => {
    expect(trechoDeSucesso("async function confirmFreePayment()")).toContain("setHistLoaded(false);");
  });
  test("mudar as parcelas (renegociar)", () => {
    expect(trechoDeSucesso("async function confirmRenegociar()")).toContain("setHistLoaded(false);");
  });
  test("mudar o vencimento", () => {
    const i = fonte.indexOf("const editDueDateMut = useMutation({");
    const bloco = fonte.slice(i, fonte.indexOf("onError", i));
    expect(bloco).toContain("setHistLoaded(false);");
  });
  test("a aba recarrega quando volta a ficar desatualizada", () => {
    expect(fonte).toMatch(/if \(tab === "historico" && !histLoaded && visible && !!customerId\) \{\s*loadHistory\(\);/);
  });
});
