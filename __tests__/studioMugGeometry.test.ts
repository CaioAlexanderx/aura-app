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

// ── Orientação da alça ───────────────────────────────────────
// Bug encontrado olhando a loja no ar: a alça de coração era criada com
// `rotation.y = Math.PI / 2`, o que a deixava de PERFIL para a câmera —
// um risco vertical em vez de uma alça.
//
// O motivo é geométrico: `THREE.Shape` + `ExtrudeGeometry` produz a face
// no plano XY, extrudada em Z. É a MESMA orientação do `TorusGeometry`,
// que também é XY. O corpo é um cilindro em Y e a câmera olha de +Z, então
// a alça só aparece de frente se ficar em XY. Nenhuma das duas formas
// pode ser girada.
describe("heartPath — a curva nasce no plano XY", () => {
  it("varia em X e em Y, que é o plano onde a alça precisa ficar", () => {
    const p = heartPath(1) as any[];
    const xs = p.flatMap((c) => [c.x, c.c1x, c.c2x]).filter((n) => n !== undefined);
    const ys = p.flatMap((c) => [c.y, c.c1y, c.c2y]).filter((n) => n !== undefined);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0);
  });

  it("a ponta do coração fica embaixo — o bico aponta para a base da caneca", () => {
    const p = heartPath(1) as any[];
    const ys = p.flatMap((c) => [c.y, c.c1y, c.c2y]).filter((n) => n !== undefined);
    expect((p[0] as any).y).toBe(Math.min(...ys));
  });
});

// ============================================================
// S11 — cor e material do MODELO, não da escolha do cliente
//
// Até aqui a cor vinha toda de `garmentColor`, que é a escolha do
// CLIENTE, e pintava corpo, alça, borda e fundo de uma vez. Isso apaga o
// produto: a ALÇA COLORIDA é branca com alça e interior coloridos (foto
// da lojista), a CHOPP é vidro translúcido, a IMPERIAL é dourada
// metálica inteira, e a VINTAGE é branca com faixa ocre no topo.
// ============================================================
import {
  readMugMaterials, applyCustomerColor, readMugAccessories,
  MUG_MATERIALS_PADRAO,
} from "@/components/studio/visualEngine/mugGeometry";

describe("readMugMaterials — compatibilidade primeiro", () => {
  it("spec sem materiais devolve a louça de antes do S11", () => {
    expect(readMugMaterials({ model: { kind: "procedural-mug" } })).toEqual(MUG_MATERIALS_PADRAO);
    expect(readMugMaterials(null)).toEqual(MUG_MATERIALS_PADRAO);
  });

  // Caneca de uma cor só é o caso comum; repetir a cor em dois lugares
  // convida a divergirem no cadastro.
  it("accent herda do body quando não é declarado", () => {
    const m = readMugMaterials({ model: { materials: { body: { color: "#FFFFFF" } } } });
    expect(m.accent.color).toBe("#FFFFFF");
  });

  it("cor inválida cai no padrão em vez de quebrar a cena", () => {
    const m = readMugMaterials({ model: { materials: { body: { color: "dourado" } } } });
    expect(m.body.color).toBe(MUG_MATERIALS_PADRAO.body.color);
  });

  it("roughness/metalness fora de 0–1 caem no padrão", () => {
    const m = readMugMaterials({ model: { materials: { body: { roughness: 7, metalness: -1 } } } });
    expect(m.body.roughness).toBe(MUG_MATERIALS_PADRAO.body.roughness);
    expect(m.body.metalness).toBe(MUG_MATERIALS_PADRAO.body.metalness);
  });

  it("vidro é opacidade menor que 1 — o que liga transparência no material", () => {
    const m = readMugMaterials({ model: { materials: { body: { opacity: 0.35 } } } });
    expect(m.body.opacity).toBe(0.35);
  });
});

describe("faixa no topo — a assinatura da Vintage Fosca", () => {
  it("lê cor e altura", () => {
    const m = readMugMaterials({
      model: { materials: { body: { top_band: { color: "#D9A441", height: 0.22 } } } },
    });
    expect(m.body.topBand).toEqual({ color: "#D9A441", height: 0.22 });
  });

  it("faixa sem cor, alta demais ou negativa é ignorada", () => {
    const alta = readMugMaterials({ model: { materials: { body: { top_band: { color: "#000", height: 0.9 } } } } });
    const semCor = readMugMaterials({ model: { materials: { body: { top_band: { height: 0.2 } } } } });
    expect(alta.body.topBand).toBeNull();
    expect(semCor.body.topBand).toBeNull();
  });

  it("sem faixa declarada é null, não undefined", () => {
    expect(readMugMaterials({ model: { materials: { body: {} } } }).body.topBand).toBeNull();
  });
});

describe("applyCustomerColor — onde a escolha do cliente incide", () => {
  const branca = {
    model: { materials: { body: { color: "#FFFFFF" }, customer_color_target: "accent" } },
  };

  // Foto da lojista: corpo branco, alça e interior coloridos.
  it("alvo accent pinta alça e interior, e NÃO o corpo", () => {
    const m = applyCustomerColor(readMugMaterials(branca), "#E11D48");
    expect(m.accent.color).toBe("#E11D48");
    expect(m.interior.color).toBe("#E11D48");
    expect(m.body.color).toBe("#FFFFFF");
  });

  it("alvo body pinta o corpo e deixa a alça", () => {
    const spec = { model: { materials: { body: { color: "#FFF" }, accent: { color: "#000" }, customer_color_target: "body" } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#E11D48");
    expect(m.body.color).toBe("#E11D48");
    expect(m.accent.color).toBe("#000");
  });

  // Modelo de cor fixa — Imperial dourada, Alça de coração Preta.
  it("alvo none ignora a escolha", () => {
    const spec = { model: { materials: { body: { color: "#D4AF37" }, customer_color_target: "none" } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#E11D48");
    expect(m.body.color).toBe("#D4AF37");
    expect(m.accent.color).toBe("#D4AF37");
  });

  it("sem escolha, ou escolha inválida, o modelo fica como cadastrado", () => {
    const base = readMugMaterials(branca);
    expect(applyCustomerColor(base, null).accent.color).toBe("#FFFFFF");
    expect(applyCustomerColor(base, "azul").accent.color).toBe("#FFFFFF");
  });
});

describe("acessórios", () => {
  it("colher e pires só existem quando declarados", () => {
    expect(readMugAccessories({ model: { accessories: { spoon: true } } }))
      .toEqual({ spoon: true, saucer: false });
    expect(readMugAccessories({ model: { accessories: { saucer: true } } }))
      .toEqual({ spoon: false, saucer: true });
    expect(readMugAccessories({})).toEqual({ spoon: false, saucer: false });
  });
});
