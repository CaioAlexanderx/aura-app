// 03/11/2026 — custo oculto (utils/estoqueConsulta.ts): mesma regra do
// backend (Aura-backend#949, podeVerCusto). Os perfis abaixo são os que
// existem em produção (company_members.permissions).
import { podeVerCusto, custosPorPadrao, estaEmConsulta } from "@/utils/estoqueConsulta";

const membro = (permissions: any) => ({ is_owner: false, role: "member", permissions });
const BALCAO = { pdv: true, painel: false, estoque: true, clientes: true };

describe("podeVerCusto", () => {
  test("dono, admin, sem dados e permissions null veem", () => {
    expect(podeVerCusto(undefined)).toBe(true);
    expect(podeVerCusto({ is_owner: true, permissions: BALCAO })).toBe(true);
    expect(podeVerCusto({ is_owner: false, role: "admin", permissions: BALCAO })).toBe(true);
    expect(podeVerCusto(membro(null))).toBe(true);
  });

  test("Caixa + Estoque sem retaguarda não vê (o perfil de produção)", () => {
    expect(podeVerCusto(membro(BALCAO))).toBe(false);
    expect(podeVerCusto(membro({ pdv: true, folha: false, painel: false, vendas: false, estoque: true, clientes: true, financeiro: false, relatorios: false, configuracoes: false }))).toBe(false);
  });

  test("financeiro, relatórios, configurações ou painel liberam", () => {
    for (const k of ["financeiro", "relatorios", "configuracoes", "painel"]) {
      expect(podeVerCusto(membro({ ...BALCAO, [k]: true }))).toBe(true);
    }
  });

  test("painel ausente conta como ligado (igual ao menu)", () => {
    expect(podeVerCusto(membro({ pdv: true, estoque: true }))).toBe(true);
  });

  test("a chave custos decide quando marcada", () => {
    expect(podeVerCusto(membro({ ...BALCAO, custos: true }))).toBe(true);
    expect(podeVerCusto(membro({ ...BALCAO, financeiro: true, custos: false }))).toBe(false);
  });

  test("estoque só consulta nunca vê", () => {
    const p = membro({ estoque_consulta: true, custos: true });
    expect(estaEmConsulta(p)).toBe(true);
    expect(podeVerCusto(p)).toBe(false);
  });
});

describe("custosPorPadrao (o que o seletor da equipe mostra sem a chave)", () => {
  test("segue a regra, ignorando um custos já gravado", () => {
    expect(custosPorPadrao(BALCAO)).toBe(false);
    expect(custosPorPadrao({ ...BALCAO, financeiro: true })).toBe(true);
    expect(custosPorPadrao({ ...BALCAO, custos: true } as any)).toBe(false);
    expect(custosPorPadrao(null)).toBe(true);
  });
});
