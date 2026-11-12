// ============================================================
// RA-03 — termos do Recebe na Aura (rascunho) e canais da Asaas.
//
// Seguram:
// 1. o texto é RASCUNHO PARA REVISÃO JURÍDICA e a tela diz isso sempre;
// 2. as três cláusulas do p-97 estão lá, com o nome vindo de fora;
// 3. a cláusula modelo da Asaas é um marcador, nunca texto inventado;
// 4. só os canais oficiais confirmados (0800 009 0037 e
//    contato@asaas.com.br), sem link de WhatsApp inventado;
// 5. nenhuma tela do app usa os termos ainda (nada aparece para lojista).
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import {
  TERMOS_RECEBE_STATUS, CLAUSULA_MODELO_ASAAS, CLAUSULA_MODELO_ASAAS_PENDENTE,
  CANAIS_ASAAS, CANAIS_ASAAS_FONTE, termosRecebeNaAura, avisoOperacaoAsaas,
  termosRecebeProntosParaRevisaoFinal,
} from "@/constants/termosRecebeNaAura";
import { TermosRecebeNaAura } from "@/components/recebe/TermosRecebeNaAura";
import { CanaisAsaas } from "@/components/recebe/CanaisAsaas";

const RAIZ = path.resolve(__dirname, "..", "..");

function montar(el: React.ReactElement) {
  let tree: any;
  act(() => { tree = renderer.create(el); });
  return tree;
}

function porTestId(tree: any, id: string) {
  return tree.root.findAllByProps({ testID: id }, { deep: false });
}

describe("rascunho dos termos", () => {
  it("é rascunho para revisão jurídica e ainda não está pronto", () => {
    expect(TERMOS_RECEBE_STATUS).toBe("RASCUNHO_PARA_REVISAO_JURIDICA");
    expect(CLAUSULA_MODELO_ASAAS).toBeNull();
    expect(termosRecebeProntosParaRevisaoFinal()).toBe(false);
    const fonte = fs.readFileSync(path.join(RAIZ, "constants", "termosRecebeNaAura.ts"), "utf8");
    expect(fonte).toContain("RASCUNHO PARA REVISÃO JURÍDICA");
  });

  it("três cláusulas do p-97, com o nome do produto vindo de fora", () => {
    const c = termosRecebeNaAura("Nome Teste");
    const porId = Object.fromEntries(c.map((x) => [x.id, x]));
    expect(porId.plataforma.texto).toContain("Nome Teste");
    expect(porId.plataforma.texto).toMatch(/Aura fornece a plataforma tecnológica/);
    expect(porId.plataforma.texto).toMatch(/infraestrutura financeira/);
    expect(porId.plataforma.texto).toMatch(/prestado pela Asaas/);
    expect(porId.decisao.texto).toMatch(/Toda decisão financeira é da loja/);
    expect(porId.decisao.texto).toMatch(/não decide nem movimenta dinheiro/);
    expect(porId.remuneracao.texto).toMatch(/remuneração pelo uso da plataforma/);
    expect(porId.remuneracao.texto).toMatch(/separada da tarifa da Asaas/);
    // Nada de nome vetado pelo playbook no texto.
    for (const x of c) expect(x.texto).not.toMatch(/\b(pay|payments|bank|banco|wallet|carteira)\b/i);
  });

  it("cláusula modelo da Asaas é marcador, não texto inventado", () => {
    const modelo = termosRecebeNaAura("X").find((x) => x.id === "clausula_modelo_asaas")!;
    expect(modelo.texto).toBe(CLAUSULA_MODELO_ASAAS_PENDENTE);
    expect(modelo.texto).toBe("[cláusula modelo da Asaas — inserir texto oficial]");
    expect(modelo.pendente).toBe(true);
  });
});

describe("canais da Asaas", () => {
  it("só os dois confirmados na página oficial", () => {
    expect(CANAIS_ASAAS.map((c) => c.valor)).toEqual(["0800 009 0037", "contato@asaas.com.br"]);
    expect(CANAIS_ASAAS_FONTE.url).toBe("https://docs.asaas.com/docs/entre-em-contato");
    // Link do WhatsApp de 0800 não está na página oficial: não inventar.
    expect(CANAIS_ASAAS.find((c) => c.tipo === "whatsapp")!.link).toBeNull();
    expect(CANAIS_ASAAS.find((c) => c.tipo === "email")!.link).toBe("mailto:contato@asaas.com.br");
    expect(avisoOperacaoAsaas()).toBe(
      "A operação financeira é da Asaas. Dúvidas sobre saldo, saque e tarifa: 0800 009 0037 ou contato@asaas.com.br."
    );
  });

  it("a caixa mostra os dois canais", () => {
    const tree = montar(<CanaisAsaas />);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("A operação financeira é da Asaas.");
    expect(txt).toContain("0800 009 0037");
    expect(txt).toContain("contato@asaas.com.br");
    expect(porTestId(tree, "canais-asaas-whatsapp").length).toBe(1);
    expect(porTestId(tree, "canais-asaas-email").length).toBe(1);
    tree.unmount();
  });
});

describe("TermosRecebeNaAura", () => {
  it("mostra a faixa de rascunho, as cláusulas, o marcador e os canais", () => {
    const tree = montar(<TermosRecebeNaAura nomeDoProduto="Recebe na Aura" />);
    expect(porTestId(tree, "termos-recebe-rascunho").length).toBe(1);
    expect(porTestId(tree, "termos-recebe-clausula_modelo_asaas-pendente").length).toBe(1);
    expect(porTestId(tree, "termos-recebe-canais-asaas").length).toBe(1);
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("RASCUNHO PARA REVISÃO JURÍDICA");
    expect(txt).toContain("[cláusula modelo da Asaas — inserir texto oficial]");
    expect(txt).toContain("Recebe na Aura");
    tree.unmount();
  });
});

describe("nada aparece para lojista", () => {
  it("nenhuma rota do app importa os termos do Recebe na Aura (entram no RA-06, atrás da flag)", () => {
    const achados: string[] = [];
    function varrer(dir: string) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { varrer(p); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        const t = fs.readFileSync(p, "utf8");
        if (/termosRecebeNaAura|TermosRecebeNaAura|CanaisAsaas/.test(t)) achados.push(path.relative(RAIZ, p));
      }
    }
    varrer(path.join(RAIZ, "app"));
    expect(achados).toEqual([]);
  });
});
