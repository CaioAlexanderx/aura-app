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
  readMugGeometry, heartPath, latheProfile, squarePath, MUG_GEOMETRY_PADRAO,
} from "@/components/studio/visualEngine/mugGeometry";

describe("readMugGeometry — compatibilidade primeiro", () => {
  it("spec sem geometria devolve exatamente os números de antes do S3", () => {
    expect(readMugGeometry({ areas: [], model: { kind: "procedural-mug" } }))
      .toEqual(MUG_GEOMETRY_PADRAO);
  });

  // Os campos que entraram depois (bottomRound, filled, tilt) têm valor
  // neutro: base reta, alça vazada, sem inclinação — o desenho de antes.
  it("os defaults são os literais que estavam no código", () => {
    expect(MUG_GEOMETRY_PADRAO.body).toEqual({ topRadius: 1, bottomRadius: 0.94, height: 2.3, bottomRound: 0 });
    expect(MUG_GEOMETRY_PADRAO.handle).toEqual({
      shape: "ring", radius: 0.52, tube: 0.11, offsetX: 1.02, offsetY: 0, filled: false, tilt: 0,
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
    expect(g.body).toEqual({ topRadius: 1.25, bottomRadius: 0.95, height: 3.1, bottomRound: 0 });
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

// ── 04/09/2026 — alça vazada ou preenchida, inclinada; base arredondada ──
// Requisito do Caio: a alça é diferencial do produto. Uma "orelha" maciça
// e um anel de tubo são canecas diferentes, e o coração das fotos da
// Sheid não fica com o bico reto para baixo — entra no corpo inclinado.
describe("readMugGeometry — alça preenchida, inclinação e base arredondada", () => {
  it("alça é vazada por padrão; `filled: true` a preenche, em anel ou coração", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "heart" } } } }).handle.filled).toBe(false);
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "heart", filled: true } } } }).handle.filled).toBe(true);
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "ring", filled: true } } } }).handle.filled).toBe(true);
  });

  it("só o booleano verdadeiro preenche — 'sim' ou 1 não valem", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { filled: "sim" } } } }).handle.filled).toBe(false);
    expect(readMugGeometry({ model: { geometry: { handle: { filled: 1 } } } }).handle.filled).toBe(false);
  });

  it("inclinação em graus, limitada a ±90; fora disso volta a zero", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { tilt: -45 } } } }).handle.tilt).toBe(-45);
    expect(readMugGeometry({ model: { geometry: { handle: { tilt: 400 } } } }).handle.tilt).toBe(0);
  });

  it("arredondamento da base lido, e limitado ao que ainda é uma base", () => {
    expect(readMugGeometry({ model: { geometry: { body: { bottomRound: 0.25 } } } }).body.bottomRound).toBe(0.25);
    // Maior que o raio da base viraria outra forma: cai em zero.
    expect(readMugGeometry({ model: { geometry: { body: { bottomRadius: 0.5, bottomRound: 0.45 } } } }).body.bottomRound).toBe(0);
  });
});

// A Chopp da foto tem alça em "D", não um anel: cantos arredondados,
// lados retos, mais alta que larga.
describe("squarePath — a alça em D da caneca de chopp", () => {
  it("é aceita como forma de alça", () => {
    expect(readMugGeometry({ model: { geometry: { handle: { shape: "square" } } } }).handle.shape).toBe("square");
  });

  it("é um contorno fechado, mais alto que largo, centrado na origem", () => {
    const p = squarePath(1);
    expect(p[0]).toEqual(p[p.length - 1]);
    const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
    expect(Math.max(...ys)).toBeCloseTo(1, 6);
    expect(Math.min(...ys)).toBeCloseTo(-1, 6);
    expect(Math.max(...xs)).toBeCloseTo(0.7, 6);
    expect(Math.min(...xs)).toBeCloseTo(-0.7, 6);
  });

  it("escala com o raio", () => {
    const g = squarePath(2), pq = squarePath(1);
    expect(Math.max(...g.map((q) => q.y))).toBeCloseTo(2 * Math.max(...pq.map((q) => q.y)), 6);
  });
});

describe("latheProfile — o perfil do corpo torneado", () => {
  const reto = { topRadius: 1, bottomRadius: 0.94, height: 2.3, bottomRound: 0 };

  it("sem arredondamento é a reta do cilindro de antes, da base ao topo", () => {
    const p = latheProfile(reto, 5);
    expect(p[0]).toEqual({ x: 0.94, y: -1.15 });
    expect(p[p.length - 1]).toEqual({ x: 1, y: 1.15 });
    // interpolação linear no meio
    expect(p[2].x).toBeCloseTo(0.97, 6);
    expect(p[2].y).toBeCloseTo(0, 6);
  });

  // O V da textura segue o índice do ponto no LatheGeometry; só com
  // altura uniforme ele continua sendo "fração da altura", que é o que
  // as áreas de impressão assumem.
  it("os pontos são igualmente espaçados em altura, com ou sem arredondamento", () => {
    const p = latheProfile({ ...reto, bottomRound: 0.3 }, 24);
    const passo = p[1].y - p[0].y;
    for (let i = 1; i < p.length; i++) expect(p[i].y - p[i - 1].y).toBeCloseTo(passo, 9);
  });

  it("o arredondamento encolhe o raio só perto da base, e o resto fica igual", () => {
    const r = latheProfile({ ...reto, bottomRound: 0.3 }, 47);
    const s = latheProfile(reto, 47);
    expect(r[0].x).toBeCloseTo(0.94 - 0.3, 6);
    for (let i = 0; i < r.length; i++) {
      if (r[i].y + 1.15 >= 0.3) expect(r[i].x).toBeCloseTo(s[i].x, 9);
      else expect(r[i].x).toBeLessThan(s[i].x);
    }
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
  readMugMaterials, applyCustomerColor, readMugAccessories, readCustomerColorTargets,
  MUG_MATERIALS_PADRAO, LEGACY_TARGETS,
} from "@/components/studio/visualEngine/mugGeometry";

describe("readMugMaterials — compatibilidade primeiro", () => {
  it("spec sem materiais devolve a louça de antes do S11", () => {
    expect(readMugMaterials({ model: { kind: "procedural-mug" } })).toEqual(MUG_MATERIALS_PADRAO);
    expect(readMugMaterials(null)).toEqual(MUG_MATERIALS_PADRAO);
  });

  // Caneca de uma cor só é o caso comum; repetir a cor em cinco lugares
  // convida a divergirem no cadastro.
  it("alça, borda e fundo herdam do body quando não são declarados", () => {
    const m = readMugMaterials({ model: { materials: { body: { color: "#FFFFFF" } } } });
    expect(m.handle.color).toBe("#FFFFFF");
    expect(m.rim.color).toBe("#FFFFFF");
    expect(m.bottom.color).toBe("#FFFFFF");
  });

  // As 10 specs publicadas usam `accent` para alça+borda+fundo. Elas
  // precisam continuar rendendo igual sem retoque.
  it("`accent` (bloco antigo) alimenta alça, borda e fundo", () => {
    const m = readMugMaterials({ model: { materials: { body: { color: "#FFFFFF" }, accent: { color: "#D62828", roughness: 0.25 } } } });
    expect(m.handle).toMatchObject({ color: "#D62828", roughness: 0.25 });
    expect(m.rim.color).toBe("#D62828");
    expect(m.bottom.color).toBe("#D62828");
  });

  it("peça declarada por nome vence o `accent`", () => {
    const m = readMugMaterials({
      model: { materials: { body: { color: "#FFFFFF" }, accent: { color: "#D62828" }, bottom: { color: "#FFFFFF" }, rim: { color: "#D9A441", roughness: 0.9 } } },
    });
    expect(m.handle.color).toBe("#D62828");
    expect(m.bottom.color).toBe("#FFFFFF");
    expect(m.rim).toMatchObject({ color: "#D9A441", roughness: 0.9 });
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

// ── O alvo da cor: do campo antigo (um valor) para a lista de peças ──
// Requisito do Caio (04/09): a cor pode estar só por dentro, só na alça,
// nos dois, ou por fora — três lugares independentes. O campo antigo
// continua aceito e vira a lista equivalente.
describe("readCustomerColorTargets — o campo antigo vira lista equivalente", () => {
  it("accent → alça, borda, fundo e interior (o bloco de antes)", () => {
    expect(readCustomerColorTargets({ customer_color_target: "accent" }))
      .toEqual(["handle", "rim", "bottom", "interior"]);
  });

  it("body → só o corpo; none → nada", () => {
    expect(readCustomerColorTargets({ customer_color_target: "body" })).toEqual(["body"]);
    expect(readCustomerColorTargets({ customer_color_target: "none" })).toEqual([]);
  });

  it("sem campo nenhum vale o padrão de antes (accent)", () => {
    expect(readCustomerColorTargets({})).toEqual(LEGACY_TARGETS.accent);
    expect(readCustomerColorTargets({ customer_color_target: "banana" })).toEqual(LEGACY_TARGETS.accent);
    // Nome herdado do protótipo não é um alvo — jsonb pode trazer qualquer texto.
    expect(readCustomerColorTargets({ customer_color_target: "constructor" })).toEqual(LEGACY_TARGETS.accent);
  });

  it("a lista nova manda, mesmo com o campo antigo presente", () => {
    expect(readCustomerColorTargets({ customer_color_target: "accent", customer_color_targets: ["interior"] }))
      .toEqual(["interior"]);
  });

  it("peça desconhecida na lista é ignorada sem derrubar as outras; repetida conta uma vez", () => {
    expect(readCustomerColorTargets({ customer_color_targets: ["handle", "asa", "handle", "interior"] }))
      .toEqual(["handle", "interior"]);
  });

  it("lista vazia é cor fixa do modelo", () => {
    expect(readCustomerColorTargets({ customer_color_targets: [] })).toEqual([]);
  });
});

describe("applyCustomerColor — onde a escolha do cliente incide", () => {
  const branca = {
    model: { materials: { body: { color: "#FFFFFF" }, customer_color_target: "accent" } },
  };

  // Foto da lojista: corpo branco, alça e interior coloridos.
  it("alvo accent (antigo) pinta alça, borda, fundo e interior, e NÃO o corpo", () => {
    const m = applyCustomerColor(readMugMaterials(branca), "#E11D48");
    expect(m.handle.color).toBe("#E11D48");
    expect(m.rim.color).toBe("#E11D48");
    expect(m.bottom.color).toBe("#E11D48");
    expect(m.interior.color).toBe("#E11D48");
    expect(m.body.color).toBe("#FFFFFF");
  });

  it("alvo body pinta o corpo e deixa a alça", () => {
    const spec = { model: { materials: { body: { color: "#FFF" }, accent: { color: "#000" }, customer_color_target: "body" } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#E11D48");
    expect(m.body.color).toBe("#E11D48");
    expect(m.handle.color).toBe("#000");
  });

  // Modelo de cor fixa — Imperial dourada, Alça de coração Preta.
  it("alvo none ignora a escolha", () => {
    const spec = { model: { materials: { body: { color: "#D4AF37" }, customer_color_target: "none" } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#E11D48");
    expect(m.body.color).toBe("#D4AF37");
    expect(m.handle.color).toBe("#D4AF37");
  });

  it("sem escolha, ou escolha inválida, o modelo fica como cadastrado", () => {
    const base = readMugMaterials(branca);
    expect(applyCustomerColor(base, null).handle.color).toBe("#FFFFFF");
    expect(applyCustomerColor(base, "azul").handle.color).toBe("#FFFFFF");
  });

  // Os três lugares independentes do requisito.
  it("só o interior: corpo, alça, borda e fundo ficam como cadastrados", () => {
    const spec = { model: { materials: { body: { color: "#FFFFFF" }, customer_color_targets: ["interior"] } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#2563EB");
    expect(m.interior.color).toBe("#2563EB");
    expect(m.body.color).toBe("#FFFFFF");
    expect(m.handle.color).toBe("#FFFFFF");
    expect(m.rim.color).toBe("#FFFFFF");
    expect(m.bottom.color).toBe("#FFFFFF");
  });

  it("só a alça: o interior não acompanha", () => {
    const spec = { model: { materials: { body: { color: "#FFFFFF" }, interior: { color: "#F0EDE6" }, customer_color_targets: ["handle"] } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#2563EB");
    expect(m.handle.color).toBe("#2563EB");
    expect(m.interior.color).toBe("#F0EDE6");
    expect(m.rim.color).toBe("#FFFFFF");
  });

  // CANECA ALÇA COLORIDA e CANECA COM COLHER nas fotos: alça, borda e
  // interior coloridos, corpo e base brancos.
  it("alça + borda + interior, com a base branca", () => {
    const spec = { model: { materials: { body: { color: "#FFFFFF" }, customer_color_targets: ["handle", "rim", "interior"] } } };
    const m = applyCustomerColor(readMugMaterials(spec), "#A78BFA");
    expect(m.handle.color).toBe("#A78BFA");
    expect(m.rim.color).toBe("#A78BFA");
    expect(m.interior.color).toBe("#A78BFA");
    expect(m.bottom.color).toBe("#FFFFFF");
    expect(m.body.color).toBe("#FFFFFF");
  });

  it("não muda o objeto de entrada", () => {
    const base = readMugMaterials(branca);
    applyCustomerColor(base, "#E11D48");
    expect(base.handle.color).toBe("#FFFFFF");
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

// ── 28/09/2026 — realismo: lábio, interior e raízes da alça ─────────
import {
  larguraDoLabio, perfilDoLabio, perfilDoInterior, curvaDaAlca, juncoesDaAlca,
} from "@/components/studio/visualEngine/mugGeometry";

describe("lábio — a espessura da louça vista de cima", () => {
  it("a caneca padrão (parede de 0.04) ganha o lábio mínimo crível", () => {
    expect(larguraDoLabio(MUG_GEOMETRY_PADRAO)).toBeCloseTo(0.06, 6);
  });

  it("parede declarada mais grossa, ou borda de tubo maior, mandam", () => {
    const grossa = readMugGeometry({ model: { geometry: { inner: { topRadius: 0.85 } } } });
    expect(larguraDoLabio(grossa)).toBeCloseTo(0.15, 6);
    const chopp = readMugGeometry({ model: { geometry: { rim: { tube: 0.06 } } } });
    expect(larguraDoLabio(chopp)).toBeCloseTo(0.12, 6);
  });

  it("o perfil vai da face externa, por cima, até a face interna, no topo do corpo", () => {
    const g = MUG_GEOMETRY_PADRAO;
    const p = perfilDoLabio(g);
    const topo = g.body.height / 2;
    expect(p[0]).toEqual({ x: g.body.topRadius, y: topo });
    expect(p[p.length - 1].x).toBeCloseTo(g.body.topRadius - larguraDoLabio(g), 6);
    expect(p[p.length - 1].y).toBeCloseTo(topo, 6);
    const maisAlto = Math.max(...p.map((q) => q.y));
    expect(maisAlto).toBeCloseTo(topo + larguraDoLabio(g) / 2, 6);
    for (const q of p) expect(q.y).toBeGreaterThanOrEqual(topo - 1e-9);
  });
});

describe("interior — do lábio ao centro do fundo, de cima para baixo", () => {
  it("começa onde o lábio termina, desce sem subir de volta e termina no eixo", () => {
    const g = MUG_GEOMETRY_PADRAO;
    const p = perfilDoInterior(g);
    expect(p[0].x).toBeCloseTo(g.body.topRadius - larguraDoLabio(g), 6);
    expect(p[0].y).toBeCloseTo(g.body.height / 2, 6);
    expect(p[0].profundidade).toBe(0);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].y).toBeLessThanOrEqual(p[i - 1].y + 1e-9);
      expect(p[i].profundidade).toBeGreaterThanOrEqual(p[i - 1].profundidade - 1e-9);
    }
    const fim = p[p.length - 1];
    expect(fim.x).toBe(0);
    expect(fim.y).toBeCloseTo(g.body.height / 2 - g.inner.height, 6);
    expect(fim.profundidade).toBe(1);
  });

  it("o interior nunca atravessa a parede externa", () => {
    for (const spec of [
      {},
      { model: { geometry: { body: { topRadius: 1.06, bottomRadius: 1, bottomRound: 0.22 } } } },
      { model: { geometry: { body: { height: 1.6, topRadius: 1, bottomRadius: 0.7 } } } },
    ]) {
      const g = readMugGeometry(spec);
      for (const q of perfilDoInterior(g)) {
        const t = (q.y + g.body.height / 2) / g.body.height;
        const externo = g.body.bottomRadius + (g.body.topRadius - g.body.bottomRadius) * Math.max(0, Math.min(1, t));
        expect(q.x).toBeLessThan(externo);
      }
    }
  });
});

describe("raízes da alça — onde a curva cruza a parede", () => {
  const parede = (g: ReturnType<typeof readMugGeometry>) => (y: number) => {
    const t = Math.max(0, Math.min(1, (y + g.body.height / 2) / g.body.height));
    return g.body.bottomRadius + (g.body.topRadius - g.body.bottomRadius) * t;
  };

  it("o anel padrão cruza a parede duas vezes, uma acima e uma abaixo do centro, com a tangente para fora", () => {
    const g = MUG_GEOMETRY_PADRAO;
    const j = juncoesDaAlca(curvaDaAlca(g), parede(g));
    expect(j.length).toBe(2);
    const ys = j.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(0);
    expect(ys[1]).toBeGreaterThan(0);
    for (const p of j) {
      expect(p.x).toBeCloseTo(parede(g)(p.y), 6);
      expect(p.tx).toBeGreaterThan(0);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 6);
    }
  });

  it("coração inclinado e alça em D também cruzam duas vezes; sem alça, nada", () => {
    const coracao = readMugGeometry({ model: { geometry: { handle: { shape: "heart", radius: 0.68, tube: 0.1, offsetX: 1.22, tilt: -50 } } } });
    expect(juncoesDaAlca(curvaDaAlca(coracao), parede(coracao)).length).toBe(2);
    const chopp = readMugGeometry({ model: { geometry: { body: { height: 3.3, topRadius: 1.02, bottomRadius: 1.02 }, handle: { shape: "square", radius: 0.95, tube: 0.16, offsetX: 1.35, offsetY: -0.22 } } } });
    expect(juncoesDaAlca(curvaDaAlca(chopp), parede(chopp)).length).toBe(2);
    const sem = readMugGeometry({ model: { geometry: { handle: { shape: "none" } } } });
    expect(curvaDaAlca(sem)).toEqual([]);
    expect(juncoesDaAlca([], parede(sem))).toEqual([]);
  });

  it("alça solta (longe da parede) não tem raiz", () => {
    const solta = readMugGeometry({ model: { geometry: { handle: { offsetX: 3 } } } });
    expect(juncoesDaAlca(curvaDaAlca(solta), parede(solta))).toEqual([]);
  });
});

// ── 28/09/2026 (2ª rodada) — a alça como um tubo só, do corpo ao corpo ──
import {
  arcoExternoDaAlca, malhaDaAlca, raioExternoEm, raioInternoEm,
} from "@/components/studio/visualEngine/mugGeometry";

const ESPECS_COM_ALCA: Array<[string, any]> = [
  ["anel padrão", {}],
  ["alça colorida", { model: { geometry: { body: { height: 2.3, topRadius: 1, bottomRound: 0.07, bottomRadius: 0.95 }, handle: { tube: 0.135, shape: "ring", radius: 0.5 } } } }],
  ["coração inclinado", { model: { geometry: { body: { height: 2.3, topRadius: 1, bottomRound: 0.07, bottomRadius: 0.95 }, handle: { tilt: -50, tube: 0.1, shape: "heart", radius: 0.68, offsetX: 1.22 } } } }],
  ["Chopp (D)", { model: { geometry: { rim: { tube: 0.06 }, body: { height: 3.3, topRadius: 1.02, bottomRound: 0.08, bottomRadius: 1.02 }, handle: { tube: 0.16, shape: "square", radius: 0.95, offsetX: 1.35, offsetY: -0.22 } } } }],
  ["Imperial", { model: { geometry: { rim: { tube: 0.05 }, body: { height: 2.42, topRadius: 1.06, bottomRound: 0.22, bottomRadius: 1 }, handle: { tube: 0.11, shape: "ring", radius: 0.54 } } } }],
  ["xícara cônica", { model: { geometry: { body: { height: 1.6, topRadius: 1, bottomRadius: 0.7 }, handle: { tube: 0.085, shape: "ring", radius: 0.42 } } } }],
];

describe("arcoExternoDaAlca — o trecho da curva fora da parede", () => {
  it("começa e termina na parede, e todos os pontos do meio ficam fora", () => {
    for (const [, spec] of ESPECS_COM_ALCA) {
      const g = readMugGeometry(spec);
      const parede = (y: number) => raioExternoEm(g, y);
      const arco = arcoExternoDaAlca(curvaDaAlca(g, 256), parede)!;
      expect(arco).not.toBeNull();
      const p = arco.pontos;
      expect(p.length).toBeGreaterThan(10);
      expect(p[0].x).toBeCloseTo(parede(p[0].y), 6);
      expect(p[p.length - 1].x).toBeCloseTo(parede(p[p.length - 1].y), 6);
      for (const q of p.slice(1, -1)) expect(q.x).toBeGreaterThan(parede(q.y));
    }
  });

  it("alça solta ou toda dentro: null", () => {
    const solta = readMugGeometry({ model: { geometry: { handle: { offsetX: 3 } } } });
    expect(arcoExternoDaAlca(curvaDaAlca(solta), (y) => raioExternoEm(solta, y))).toBeNull();
    expect(arcoExternoDaAlca(curvaDaAlca(solta), () => 10)).toBeNull();
  });
});

describe("malhaDaAlca — raiz alargada, sem costura e sem atravessar a louça", () => {
  const raioCilindrico = (x: number, z: number) => Math.hypot(x, z);

  it.each(ESPECS_COM_ALCA)("%s: nenhum vértice entra na cavidade; as pontas ficam dentro da louça", (_nome, spec) => {
    const g = readMugGeometry(spec);
    const m = malhaDaAlca(g)!;
    expect(m).not.toBeNull();
    expect(m.indices.length % 3).toBe(0);
    const n = m.positions.length / 3;
    for (const i of m.indices) { expect(i).toBeLessThan(n); }
    // 1. nunca para dentro da cavidade
    for (let i = 0; i < n; i++) {
      const x = m.positions[i * 3], y = m.positions[i * 3 + 1], z = m.positions[i * 3 + 2];
      expect(raioCilindrico(x, z)).toBeGreaterThanOrEqual(raioInternoEm(g, y) - 1e-6);
    }
    // 2. as estações enterradas (e < 0) ficam entre a parede interna e a externa
    m.estacoes.forEach((est, s) => {
      if (est.e >= 0) return;
      for (let k = 0; k < m.segmentos; k++) {
        const i = s * m.segmentos + k;
        const x = m.positions[i * 3], y = m.positions[i * 3 + 1], z = m.positions[i * 3 + 2];
        const r = raioCilindrico(x, z);
        expect(r).toBeLessThanOrEqual(raioExternoEm(g, y) + 1e-6);
        expect(r).toBeGreaterThanOrEqual(raioInternoEm(g, y) - 1e-6);
      }
    });
    // 3. há duas pontas enterradas e o meio está fora do corpo
    const enterradas = m.estacoes.filter((e) => e.e < 0).length;
    expect(enterradas).toBe(4);
    const meio = m.estacoes[Math.floor(m.estacoes.length / 2)];
    expect(meio.e).toBeGreaterThan(0);
  });

  it("a raiz é mais grossa que o tubo e afina até ele com continuidade", () => {
    const g = readMugGeometry({});
    const m = malhaDaAlca(g)!;
    const raios = m.estacoes.map((e) => e.raio);
    const naParede = m.estacoes.find((e) => e.e === 0)!;
    expect(naParede.raio).toBeCloseTo(g.handle.tube * 1.55, 6);
    const meio = m.estacoes[Math.floor(m.estacoes.length / 2)];
    expect(meio.raio).toBeCloseTo(g.handle.tube, 6);
    // do primeiro ponto fora até o meio, o raio nunca cresce
    const i0 = m.estacoes.findIndex((e) => e.e === 0);
    for (let i = i0 + 1; i <= Math.floor(m.estacoes.length / 2); i++) expect(raios[i]).toBeLessThanOrEqual(raios[i - 1] + 1e-9);
  });

  it("a seção na parede cai sobre a parede redonda (elipse para alça inclinada), uns milímetros para dentro", () => {
    const g = readMugGeometry(ESPECS_COM_ALCA[2][1]); // coração a −50°
    const m = malhaDaAlca(g)!;
    const s = m.estacoes.findIndex((e) => e.e === 0);
    for (let k = 0; k < m.segmentos; k++) {
      const i = s * m.segmentos + k;
      const x = m.positions[i * 3], y = m.positions[i * 3 + 1], z = m.positions[i * 3 + 2];
      const folga = raioExternoEm(g, y) - raioCilindrico(x, z);
      expect(folga).toBeGreaterThan(0);      // nunca fora da parede
      expect(folga).toBeLessThan(0.012);     // e nunca mais fundo que a borda afundada
    }
  });

  it("alça preenchida, sem alça ou solta: null (o viewer usa a geometria de antes)", () => {
    expect(malhaDaAlca(readMugGeometry({ model: { geometry: { handle: { filled: true } } } }))).toBeNull();
    expect(malhaDaAlca(readMugGeometry({ model: { geometry: { handle: { shape: "none" } } } }))).toBeNull();
    expect(malhaDaAlca(readMugGeometry({ model: { geometry: { handle: { offsetX: 3 } } } }))).toBeNull();
  });
});
