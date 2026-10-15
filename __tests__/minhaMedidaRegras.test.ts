// ============================================================================
// AURA. — Etiquetas: regras do wizard "Minha medida" (15/10/2026)
//
// Direção → ajuste (0,5 mm por toque, sentido contrário ao erro), ajuste
// fino, limite de ±8 mm, leitura dos campos (vírgula, erro de limite) e os
// rótulos dos passos, conforme o mockup aprovado.
// ============================================================================
import {
  corrigirDirecao, ajusteFino, mensagemMovimento, sinalMm, textoAjuste, textoColunas, textoEspacos, espacosNoPadrao,
  lerCampoMm, medidaDosCampos, textosDaMedida, desenhoDoRolo, ATALHOS_MEDIDA, ROTULO_DIRECAO, PASSO_TOQUE_MM, PASSO_FINO_MM,
} from "@/components/screens/estoque/labels/minhaMedidaRegras";

const base = { id: "m1", larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0 };

describe("direção → ajuste", () => {
  test("cada toque corrige 0,5 mm no sentido contrário ao erro relatado", () => {
    expect(PASSO_TOQUE_MM).toBe(0.5);
    expect(corrigirDirecao({ x: 0, y: 0 }, "esquerda")).toEqual({ ajuste: { x: 0.5, y: 0 }, noLimite: false });
    expect(corrigirDirecao({ x: 0, y: 0 }, "direita")).toEqual({ ajuste: { x: -0.5, y: 0 }, noLimite: false });
    expect(corrigirDirecao({ x: 0, y: 0 }, "cima")).toEqual({ ajuste: { x: 0, y: 0.5 }, noLimite: false });
    expect(corrigirDirecao({ x: 0, y: 0 }, "baixo")).toEqual({ ajuste: { x: 0, y: -0.5 }, noLimite: false });
  });

  test("acumula em décimos sem dízima e para em ±8 mm avisando", () => {
    let a = { x: 0, y: 0 };
    for (let i = 0; i < 3; i++) a = corrigirDirecao(a, "esquerda").ajuste;
    expect(a.x).toBe(1.5);
    expect(corrigirDirecao({ x: 7.8, y: 0 }, "esquerda")).toEqual({ ajuste: { x: 8, y: 0 }, noLimite: true });
    expect(corrigirDirecao({ x: 8, y: 0 }, "esquerda")).toEqual({ ajuste: { x: 8, y: 0 }, noLimite: true });
    expect(corrigirDirecao({ x: 0, y: -8 }, "baixo")).toEqual({ ajuste: { x: 0, y: -8 }, noLimite: true });
    expect(corrigirDirecao({ x: 0, y: 7.5 }, "cima")).toEqual({ ajuste: { x: 0, y: 8 }, noLimite: false });
  });

  test("ajuste fino de 0,1 mm, com o mesmo limite e sem -0", () => {
    expect(PASSO_FINO_MM).toBe(0.1);
    expect(ajusteFino({ x: 0.2, y: 0 }, "x", 0.1)).toEqual({ ajuste: { x: 0.3, y: 0 }, noLimite: false });
    expect(ajusteFino({ x: 0, y: 0.1 }, "y", -0.1).ajuste.y).toBe(0);
    expect(Object.is(ajusteFino({ x: 0, y: 0.1 }, "y", -0.1).ajuste.y, -0)).toBe(false);
    expect(ajusteFino({ x: -8, y: 0 }, "x", -0.1)).toEqual({ ajuste: { x: -8, y: 0 }, noLimite: true });
  });

  test("mensagem diz para onde a moldura andou", () => {
    expect(mensagemMovimento("esquerda")).toBe("Movi a moldura 0,5 mm para a direita. Ainda não está no meio? Toque de novo.");
    expect(mensagemMovimento("cima")).toBe("Movi a moldura 0,5 mm para baixo. Ainda não está no meio? Toque de novo.");
    expect(ROTULO_DIRECAO).toEqual({ cima: "Saiu para cima", baixo: "Saiu para baixo", esquerda: "Saiu para a esquerda", direita: "Saiu para a direita" });
  });
});

describe("rótulos", () => {
  test("sinal e vírgula", () => {
    expect(sinalMm(0.5)).toBe("+0,5");
    expect(sinalMm(-1)).toBe("−1,0");
    expect(sinalMm(0)).toBe("0,0");
    expect(textoAjuste({ x: 1, y: -0.5 })).toBe("Horizontal +1,0 mm · Vertical −0,5 mm");
  });

  test("rolo e espaços", () => {
    expect(textoColunas(1)).toBe("Uma etiqueta por linha");
    expect(textoColunas(3)).toBe("3 etiquetas lado a lado");
    expect(textoEspacos(base)).toBe("2 mm de cima para baixo (padrão)");
    expect(textoEspacos({ ...base, colunas: 3, espacoLadoMm: 2.5 })).toBe("2,5 mm lado a lado · 2 mm de cima para baixo");
    expect(espacosNoPadrao({ colunas: 1, espacoLadoMm: 9, espacoLinhaMm: 2 })).toBe(true);
    expect(espacosNoPadrao({ colunas: 2, espacoLadoMm: 9, espacoLinhaMm: 2 })).toBe(false);
  });

  test("atalhos do passo 1", () => {
    expect(ATALHOS_MEDIDA).toEqual([[40, 25], [30, 25], [50, 30], [60, 40], [105, 21]]);
  });
});

describe("campos do passo 1", () => {
  test("aceita vírgula e ponto, arredonda a décimos", () => {
    expect(lerCampoMm("33,5", "largura")).toEqual({ ok: true, v: 33.5 });
    expect(lerCampoMm(" 40.27 ", "largura")).toEqual({ ok: true, v: 40.3 });
    expect(lerCampoMm("2,", "espacoLinha")).toEqual({ ok: true, v: 2 });
  });

  test("mensagens de erro sem travar a digitação", () => {
    expect(lerCampoMm("", "largura")).toEqual({ ok: false, msg: "Digite um número" });
    expect(lerCampoMm("5x", "largura")).toEqual({ ok: false, msg: "Use só números. Exemplo: 50 ou 2,5" });
    expect(lerCampoMm("-2", "espacoLinha")).toEqual({ ok: false, msg: "Use só números. Exemplo: 50 ou 2,5" });
    expect(lerCampoMm("140", "largura")).toEqual({ ok: false, msg: "Use um valor entre 15 e 110 mm" });
    expect(lerCampoMm("9", "altura")).toEqual({ ok: false, msg: "Use um valor entre 10 e 80 mm" });
    expect(lerCampoMm("11", "espacoLado")).toEqual({ ok: false, msg: "Use um valor entre 0 e 10 mm" });
  });

  test("com 1 coluna o espaço lado a lado não trava; com 2 trava", () => {
    const txt = { ...textosDaMedida(base), espacoLado: "abc" };
    const um = medidaDosCampos(base, txt, 1);
    expect(um.erros).toEqual({});
    expect(um.spec).toMatchObject({ larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3 });
    const dois = medidaDosCampos(base, txt, 2);
    expect(dois.spec).toBeNull();
    expect(dois.erros.espacoLado).toBe("Use só números. Exemplo: 50 ou 2,5");
  });

  test("o spec montado preserva id e ajuste", () => {
    const r = medidaDosCampos({ ...base, ajusteXMm: 1.5 }, { largura: "33", altura: "21", espacoLado: "3", espacoLinha: "2,5" }, 3);
    expect(r.spec).toEqual({ id: "m1", larguraMm: 33, alturaMm: 21, colunas: 3, espacoLadoMm: 3, espacoLinhaMm: 2.5, ajusteXMm: 1.5, ajusteYMm: 0 });
  });
});

describe("desenho do rolo", () => {
  test("em escala, com cotas e etiquetas de conteúdo", () => {
    const svg = desenhoDoRolo({ ...base, cotas: true, linhas: 2 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(">50 mm</text>");
    expect(svg).toContain(">30 mm</text>");
    expect(svg).toContain(">2 mm</text>");
    expect((svg.match(/fill="#fff" stroke="#cfc9e4"/g) || []).length).toBe(2);
    expect(svg).toContain("Camiseta Algodão Básica");
  });

  test("3 lado a lado mostram o espaço entre colunas", () => {
    const svg = desenhoDoRolo({ ...base, larguraMm: 33, alturaMm: 21, colunas: 3, espacoLadoMm: 3, cotas: true, linhas: 2 });
    expect((svg.match(/fill="#fff" stroke="#cfc9e4"/g) || []).length).toBe(6);
    expect(svg).toContain(">3 mm</text>");
  });

  test("modo teste: moldura deslocada (ilustrativa), fantasma verde e verde quando certo", () => {
    const torta = desenhoDoRolo({ ...base, modo: "teste", dx: -2, dy: -1, fantasma: true });
    expect(torta).toContain('transform="translate(-2 -1)"');
    expect(torta).toContain('stroke-dasharray="1.2 .9"');
    expect(torta).toContain('fill="#7c3aed" stroke="#7c3aed"');
    expect(torta).not.toContain("Camiseta");
    expect(desenhoDoRolo({ ...base, modo: "teste", certo: true })).toContain('fill="#16a34a" stroke="#16a34a"');
  });

  test("produto de verdade na ilustração (texto escapado)", () => {
    const svg = desenhoDoRolo({ ...base, exemplo: { nome: "Meia <Arrastão> & Cia", variacao: "", preco: "R$ 9,90", codigo: "123" } });
    expect(svg).toContain("Meia &lt;Arrastão> &amp; Cia");
  });
});
