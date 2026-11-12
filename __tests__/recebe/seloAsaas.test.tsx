// ============================================================
// RA-02 — selo da Asaas e Referrer-Policy.
//
// O playbook da Asaas exige o selo nas telas de subconta e nos termos, em
// três versões, e proíbe Referrer-Policy no-referrer: a Asaas confere pelo
// Referer de onde vem a imagem. Estes testes seguram:
//
// 1. sem o link oficial, o selo mostra um espaço reservado e o texto de
//    responsabilidade — nunca um logo inventado;
// 2. com o link, a imagem é um <img> com referrerPolicy
//    strict-origin-when-cross-origin, e o link abre sem "noreferrer";
// 3. os cabeçalhos do app (public/_headers) mandam
//    strict-origin-when-cross-origin e nada no código manda no-referrer.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

import { SeloAsaas, abrirLinkDoSelo } from "@/components/recebe/SeloAsaas";
import {
  SELO_ASAAS, SELO_ASAAS_TEXTO, SELO_ASAAS_REFERRER_POLICY, RECEBE_NA_AURA_NAME,
  seloAsaasOficialCompleto,
} from "@/constants/recebeNaAura";

const RAIZ = path.resolve(__dirname, "..", "..");
const ORIGINAL = JSON.parse(JSON.stringify(SELO_ASAAS));

function montar(el: React.ReactElement) {
  let tree: any;
  act(() => { tree = renderer.create(el); });
  return tree;
}

afterEach(() => {
  (["v1", "v2", "v3"] as const).forEach((v) => { Object.assign(SELO_ASAAS[v], ORIGINAL[v]); });
});

describe("constantes do Recebe na Aura", () => {
  it("nome do produto num lugar só, sem palavra vetada pelo playbook", () => {
    expect(RECEBE_NA_AURA_NAME).toBe("Recebe na Aura");
    expect(RECEBE_NA_AURA_NAME).not.toMatch(/\b(pay|payments|bank|banco|financeira|wallet)\b/i);
  });

  it("três versões do selo, e nenhuma com link inventado", () => {
    expect(Object.keys(SELO_ASAAS).sort()).toEqual(["v1", "v2", "v3"]);
    // Enquanto o Caio não passar os links do playbook, todas ficam vazias.
    // Quando forem preenchidas, este teste deve ser trocado pelo de baixo.
    for (const v of ["v1", "v2", "v3"] as const) {
      const src = SELO_ASAAS[v].src;
      if (src) expect(src).toMatch(/^https:\/\//);
    }
  });

  it("política do selo nunca é no-referrer", () => {
    expect(SELO_ASAAS_REFERRER_POLICY).toBe("strict-origin-when-cross-origin");
  });
});

describe("SeloAsaas sem o link oficial", () => {
  it("mostra o espaço reservado e o texto de responsabilidade nas três versões", () => {
    expect(seloAsaasOficialCompleto()).toBe(false);
    for (const v of ["v1", "v2", "v3"] as const) {
      const tree = montar(<SeloAsaas versao={v} />);
      expect(tree.root.findAllByProps({ testID: `selo-asaas-${v}-pendente` }, { deep: false }).length).toBe(1);
      expect(JSON.stringify(tree.toJSON())).toContain(SELO_ASAAS_TEXTO);
      // Nenhuma imagem: nada de logo inventado.
      expect(tree.root.findAll((n: any) => n.type === "img").length).toBe(0);
      tree.unmount();
    }
  });

  it("sem texto quando pedido", () => {
    const tree = montar(<SeloAsaas comTexto={false} />);
    expect(JSON.stringify(tree.toJSON())).not.toContain(SELO_ASAAS_TEXTO);
    tree.unmount();
  });
});

describe("SeloAsaas com o link oficial (simulado)", () => {
  it("<img> com referrerPolicy strict-origin-when-cross-origin", () => {
    SELO_ASAAS.v2.src = "https://exemplo.invalid/selo-v2.png";
    const tree = montar(<SeloAsaas versao="v2" />);
    const imgs = tree.root.findAll((n: any) => n.type === "img");
    expect(imgs.length).toBe(1);
    expect(imgs[0].props.src).toBe("https://exemplo.invalid/selo-v2.png");
    expect(imgs[0].props.referrerPolicy).toBe("strict-origin-when-cross-origin");
    expect(tree.root.findAllByProps({ testID: "selo-asaas-v2-pendente" }).length).toBe(0);
    tree.unmount();
  });

  it("link do selo abre com noopener e SEM noreferrer", () => {
    SELO_ASAAS.v1.src = "https://exemplo.invalid/selo-v1.png";
    SELO_ASAAS.v1.href = "https://exemplo.invalid/";
    const tree = montar(<SeloAsaas versao="v1" />);
    const links = tree.root.findAll((n: any) => n.type === "a");
    expect(links.length).toBe(1);
    expect(links[0].props.rel).toBe("noopener");
    expect(String(links[0].props.rel)).not.toContain("noreferrer");
    expect(links[0].props.referrerPolicy).toBe("strict-origin-when-cross-origin");
    tree.unmount();

    const open = jest.fn();
    const antes = window.open;
    (window as any).open = open;
    abrirLinkDoSelo("https://exemplo.invalid/");
    expect(open).toHaveBeenCalledWith("https://exemplo.invalid/", "_blank", "noopener");
    (window as any).open = antes;
  });
});

describe("Referrer-Policy do app", () => {
  it("public/_headers manda strict-origin-when-cross-origin para todas as páginas", () => {
    const h = fs.readFileSync(path.join(RAIZ, "public", "_headers"), "utf8");
    const bloco = h.split(/\r?\n(?=\S)/).find((b) => /^\/\*\s*$/m.test(b.split(/\r?\n/)[0]));
    expect(bloco).toBeTruthy();
    expect(bloco).toMatch(/^\s+Referrer-Policy:\s*strict-origin-when-cross-origin\s*$/m);
    expect(h).not.toMatch(/Referrer-Policy:\s*no-referrer\s*$/im);
  });

  it("nenhuma página do app manda no-referrer por meta ou atributo", () => {
    const achados: string[] = [];
    const pastas = ["app", "components", "public", "hooks", "utils", "constants"];
    const re = /(name=["']referrer["'][^>]*content=["']no-referrer["'])|(referrerPolicy\s*[:=]\s*["']no-referrer["'])/i;
    function varrer(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") varrer(p); continue; }
        if (!/\.(tsx?|jsx?|html)$/.test(e.name)) continue;
        const t = fs.readFileSync(p, "utf8");
        if (re.test(t)) achados.push(path.relative(RAIZ, p));
        // Link para a Asaas aberto com noreferrer esconde a origem dela.
        t.split(/\r?\n/).forEach((linha, i) => {
          if (/asaas\.com/i.test(linha) && /noreferrer/i.test(linha)) achados.push(`${path.relative(RAIZ, p)}:${i + 1}`);
        });
      }
    }
    pastas.forEach((d) => varrer(path.join(RAIZ, d)));
    expect(achados).toEqual([]);
  });
});
