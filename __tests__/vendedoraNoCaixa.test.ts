// 03/11/2026 — cadastrar vendedora pelo Caixa (utils/vendedoraNoCaixa.ts).
import {
  podeCadastrarVendedora, nomeDaVendedora, vendedoraJaExiste, limiteDaEquipe, textoDoLimite,
} from "@/utils/vendedoraNoCaixa";

const membro = (permissions: any) => ({ is_owner: false, role: "member", permissions });

describe("quem pode cadastrar vendedora no Caixa", () => {
  test("dono, admin e permissions null podem", () => {
    expect(podeCadastrarVendedora(undefined)).toBe(true);
    expect(podeCadastrarVendedora({ is_owner: true })).toBe(true);
    expect(podeCadastrarVendedora({ is_owner: false, role: "admin", permissions: { pdv: true } })).toBe(true);
    expect(podeCadastrarVendedora(membro(null))).toBe(true);
  });

  test("quem cuida da equipe (folha ou configurações) pode", () => {
    expect(podeCadastrarVendedora(membro({ pdv: true, folha: true }))).toBe(true);
    expect(podeCadastrarVendedora(membro({ pdv: true, configuracoes: true }))).toBe(true);
  });

  test("operador(a) de caixa não pode (só usa o nome nesta venda)", () => {
    expect(podeCadastrarVendedora(membro({ painel: true, pdv: true, clientes: true }))).toBe(false);
    expect(podeCadastrarVendedora(membro({ pdv: true, estoque: true, painel: false }))).toBe(false);
  });
});

describe("nome", () => {
  test("limpa espaços e corta em 80", () => {
    expect(nomeDaVendedora("  Ana   Paula ")).toBe("Ana Paula");
    expect(nomeDaVendedora("x".repeat(100))).toHaveLength(80);
  });

  test("acha a mesma pessoa sem acento e sem caixa", () => {
    const equipe = [{ id: "1", name: "Ana Paula" }, { id: "2", name: "Bárbara" }];
    expect(vendedoraJaExiste("ana  paula", equipe)?.id).toBe("1");
    expect(vendedoraJaExiste("BARBARA", equipe)?.id).toBe("2");
    expect(vendedoraJaExiste("Bianca", equipe)).toBeNull();
    expect(vendedoraJaExiste("   ", equipe)).toBeNull();
  });
});

describe("limite do plano (403 do POST /employees)", () => {
  test("403 com limit é limite; sem limit ou outro status não é", () => {
    expect(limiteDaEquipe(403, { limit: 3, current: 3 })).toEqual({ limite: 3, atual: 3 });
    expect(limiteDaEquipe(403, { error: "sem permissão" })).toBeNull();
    expect(limiteDaEquipe(400, { limit: 3 })).toBeNull();
  });

  test("texto", () => {
    expect(textoDoLimite({ limite: 3, atual: 3 })).toBe("Seu plano tem até 3 pessoas ativas na equipe (você tem 3).");
    expect(textoDoLimite({ limite: 1, atual: 1 })).toBe("Seu plano tem até 1 pessoa ativa na equipe (você tem 1).");
  });
});
