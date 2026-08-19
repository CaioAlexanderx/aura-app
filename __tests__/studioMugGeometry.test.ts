// ============================================================
// AURA Studio — S3: a forma da caneca sai do código e vai para o spec
//
// A DEC-10 decidiu um template 3D POR MODELO. Isso não era semear 9
// linhas: a geometria estava fixa em compose3dMug.ts e o `spec` só
// carregava áreas UV. Um template não conseguia representar um modelo.
//
// O que estes testes protegem, acima de tudo, é a COMPATIBILIDADE: o
// `caneca-classica` publicado hoje não tem bloco de geometria, e precisa
// renderizar exatamente como renderizava. Um default trocado por engano
// mudaria a caneca de todo mundo em silêncio.
//
// O resultado visual em si não dá para testar aqui — é three.js via CDN,
// só no web. Estes testes cobrem a leitura do spec, que é onde erra.
// ============================================================
import {
  readMugGeometry, heartPath, MUG_GEOMETRY_PADRAO,
} from "@/components/studio/visualEngine/mugGeometry";

describe("readMugGeometry — compatibilidade primeiro", () => {
  it("spec sem geometria devolve exatamente os números de antes do S3", () => {
    expect(readMugGeometry({ areas: [], model: { kind: "procedural-mug" } }))
      .toEqual(MUG_GEOMETRY_PADRAO);
  });

  it("os defaults são os literais que estavam no código", () => {
    expect(MUG_GEOMETRY_PADRAO.body).toEqual({ topRadius: 1, bottomRadius: 0.94, height: 2.3 });
    expect(MUG_GEOMETRY_PADRAO.handle).toEqual({
      shape: "ring", radius: 0.52, tube: 0.11, offsetX: 1.02, offsetY: 0,
    });
  });

  it("spec nulo, vazio ou corrompido não quebra a cena", () => {
    expect(readMugGeometry(null)).toEqual(MUG_GEOMETRY_PADRAO);
    expect(readMugGeometry({})).toEqual(MUG_GEOMETRY_PADRAO);
    expect(readMugGeometry({ model: { geometry: "não é objeto" } })).toEqual(MUG_GEOMETRY_PADRAO);
  });
});

describe("readMugGeometry — o que cada modelo precisa", () => {
  // CANECA CHOPP: maior e mais cônica que a clássica.
  it("aceita corpo maior e mais cônico", () => {
    const g = readMugGeometry({
      model: { geometry: { body: { topRadius: 1.25, bottomRadius: 0.95, height: 3.1 } } },
    });
    expect(g.body).toEqual({ topRadius: 1.25, bottomRadius: 0.95, height: 3.1 });
  });

  // Borda e interior acompanham o corpo quando não declarados: template
  // que muda só o raio não pode deixar um anel flutuando fora da caneca.
  it("borda e interior seguem o corpo quando não são declarados", () => {
    const g = readMugGeometry({ model: { geometry: { body: { topRadius: 1.5 } } } });
    expect(g.rim.radius).toBeCloseTo(1.475, 3);
    expect(g.inner.topRadius).toBeCloseTo(1.46, 3);
    expect(g.handle.offsetX).toBeCloseTo(1.52, 3);
  });

  it("alça de coração é uma forma, não um número", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "heart" } } } }).handle.shape)
      .toBe("heart");
  });

  it("caneca sem alça é caso válido", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "none" } } } }).handle.shape)
      .toBe("none");
  });

  it("forma desconhecida cai no anel, não some a alça", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "banana" } } } }).handle.shape)
      .toBe("ring");
  });
});

describe("readMugGeometry — cadastro errado não deforma a loja", () => {
  // Um raio 0 ou 500 renderizaria algo irreconhecível, e o cliente não
  // tem como saber que o errado é o cadastro.
  it("valor fora de faixa volta para o padrão", () => {
    const g = readMugGeometry({
      model: { geometry: { body: { topRadius: 0, bottomRadius: 900, height: -3 } } },
    });
    expect(g.body).toEqual(MUG_GEOMETRY_PADRAO.body);
  });

  it("texto e nulo em campo numérico caem no padrão", () => {
    const g = readMugGeometry({
      model: { geometry: { body: { height: "alta" }, handle: { tube: null } } },
    });
    expect(g.body.height).toBe(MUG_GEOMETRY_PADRAO.body.height);
    expect(g.handle.tube).toBe(MUG_GEOMETRY_PADRAO.handle.tube);
  });

  it("string numérica é aceita — jsonb às vezes chega assim", () => {
    expect(readMugGeometry({ model: { geometry: { body: { height: "2.8" } } } }).body.height)
      .toBe(2.8);
  });
});

describe("heartPath", () => {
  it("é uma curva fechada: termina onde começou", () => {
    const p = heartPath(0.5);
    const ini = p[0] as any;
    const fim = p[p.length - 1] as any;
    expect([ini.x, ini.y]).toEqual([fim.x, fim.y]);
  });

  it("escala com o raio pedido", () => {
    const pequeno = heartPath(0.5)[0] as any;
    const grande = heartPath(1)[0] as any;
    expect(grande.y).toBeCloseTo(pequeno.y * 2, 5);
  });

  it("começa com moveTo e segue só com béziers", () => {
    const p = heartPath(0.5);
    expect(p[0].op).toBe("moveTo");
    expect(p.slice(1).every((c) => c.op === "bezierCurveTo")).toBe(true);
  });
});
