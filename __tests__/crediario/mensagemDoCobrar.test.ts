// ============================================================
// Modelos de mensagem do crediário (21/11/2026) — a regra pura.
//
// 1. preencher troca as variáveis e TIRA o parágrafo da variável sem valor
//    (loja sem chave Pix, cliente sem parcela), com o aviso certo;
// 2. paraModelo (o "Salvar como modelo") devolve os dados da cliente às
//    variáveis só em palavra inteira — "Ana" não troca dentro de "semana";
// 3. a situação da parcela escolhe o padrão, e "vence em" de parcela
//    vencida não existe mais no pronto de atraso;
// 4. o Cobrar do cartão de um carnê cita a parcela daquele carnê.
// ============================================================
import {
  MODELOS_DA_AURA, avisosDoQueFaltou, diasDeAtraso, erroDoModelo, inserirVariavel, letras,
  modeloPadrao, paraModelo, parcelaDaCobranca, partesDoModelo, preencher, primeiroNome, situacaoDaParcela,
  type DadosDaMensagem, type ModeloDeMensagem,
} from "@/utils/crediarioMensagem";

const MARIA: DadosDaMensagem = {
  nome: "Maria", loja: "Boutique Flor de Lis", valor: "R$ 153,40", vencimento: "10/11", parcela: "2/3",
  dias: "11", saldo: "R$ 306,80", pix: "11987654321",
};
const atraso = MODELOS_DA_AURA.find((m) => m.situation === "em_atraso")!;
const lembrete = MODELOS_DA_AURA.find((m) => m.situation === "a_vencer")!;

describe("preencher", () => {
  it("o pronto de atraso sai como no mockup", () => {
    expect(preencher(atraso.body, MARIA)).toEqual({
      texto:
        "Oi, Maria, tudo bem por aí?\n\n" +
        "Vi aqui que a parcela 2/3 de R$ 153,40, que venceu dia 10/11, ainda está em aberto. Pode ter passado batido, acontece!\n\n" +
        "Consegue me dizer quando fica bom pra você acertar? Se preferir Pix, a chave é 11987654321.",
      faltando: [],
    });
  });

  it("sem chave Pix: o parágrafo do Pix some e a prévia avisa", () => {
    const r = preencher(lembrete.body, { ...MARIA, nome: "Joana", pix: "" });
    expect(r.texto).not.toContain("Pix");
    expect(r.texto).toContain("Qualquer coisa é só me chamar!");
    expect(r.faltando).toEqual(["pix"]);
    expect(avisosDoQueFaltou(r.faltando)).toEqual(["Sem chave Pix cadastrada: tirei essa parte do texto."]);
  });

  it("sem parcela aberta: some a parte da parcela, fica o resto", () => {
    const r = preencher(lembrete.body, { nome: "Ana", loja: "Loja", saldo: "R$ 10,00", pix: "x" });
    expect(r.texto).toBe("Oi, Ana! Tudo bem?\n\nSe quiser pagar por Pix, a chave é x.\n\nQualquer coisa é só me chamar!");
    expect(avisosDoQueFaltou(r.faltando)).toEqual(["Sem parcela em aberto: tirei a parte da parcela do texto."]);
  });

  it("chave desconhecida fica como está (nada some por ela)", () => {
    expect(preencher("Oi {nome}, {outra}", MARIA).texto).toBe("Oi Maria, {outra}");
  });
});

describe("paraModelo (Salvar como modelo)", () => {
  it("o texto editado volta a ter as variáveis, inclusive a frase nova", () => {
    const editado = preencher(atraso.body, MARIA).texto + "\n\nAh, e chegou a coleção nova que você tinha perguntado. Passa aqui!";
    expect(paraModelo(editado, MARIA)).toBe(atraso.body + "\n\nAh, e chegou a coleção nova que você tinha perguntado. Passa aqui!");
  });

  it('só palavra inteira: "Ana" não troca dentro de "semana" nem "Mariana"', () => {
    const dados = { nome: "Ana" };
    expect(paraModelo("Oi Ana, nesta semana a Mariana passa aí. Ana!", dados))
      .toBe("Oi {nome}, nesta semana a Mariana passa aí. {nome}!");
  });

  it("valor mais longo primeiro; empate fica com valor (antes de saldo)", () => {
    const dados = { valor: "R$ 50,00", saldo: "R$ 50,00", dias: "50" };
    expect(paraModelo("Deve R$ 50,00 há 50 dias", dados)).toBe("Deve {valor} há {dias} dias");
    // "11" dentro do telefone não vira {dias}.
    expect(paraModelo("Pix 11987654321, 11 dias", { dias: "11" })).toBe("Pix 11987654321, {dias} dias");
  });

  it("partesDoModelo separa as variáveis para destacar", () => {
    expect(partesDoModelo("Oi, {nome}! {x}")).toEqual([
      { tipo: "texto", valor: "Oi, " }, { tipo: "variavel", valor: "nome" }, { tipo: "texto", valor: "! {x}" },
    ]);
  });
});

describe("situação e padrão", () => {
  it("a vencer, vence hoje, em atraso pela data em São Paulo", () => {
    expect(situacaoDaParcela("2026-11-25", "2026-11-21")).toBe("a_vencer");
    expect(situacaoDaParcela("2026-11-21T03:00:00.000Z", "2026-11-21")).toBe("vence_hoje");
    expect(situacaoDaParcela("2026-11-10", "2026-11-21")).toBe("em_atraso");
    expect(situacaoDaParcela(null, "2026-11-21")).toBe("a_vencer");
    expect(diasDeAtraso("2026-11-10", "2026-11-21")).toBe(11);
    expect(diasDeAtraso("2026-11-25", "2026-11-21")).toBe(0);
  });

  it("o padrão da situação; sem padrão, o modelo daquela situação; sem nada, o primeiro", () => {
    expect(modeloPadrao(MODELOS_DA_AURA, "em_atraso")!.name).toBe("Passou do dia");
    const loja: ModeloDeMensagem[] = [
      { id: "a", name: "Livre", body: "x", situation: null, is_default: false, origin: "loja" },
      { id: "b", name: "Atraso", body: "y", situation: "em_atraso", is_default: true, origin: "loja" },
    ];
    expect(modeloPadrao(loja, "em_atraso")!.id).toBe("b");
    expect(modeloPadrao(loja, "vence_hoje")!.id).toBe("a");
    expect(modeloPadrao([], "a_vencer")).toBeNull();
  });

  it('o pronto de atraso não diz "vence em"', () => {
    expect(atraso.body).toContain("que venceu dia {vencimento}");
    expect(MODELOS_DA_AURA.map((m) => m.body).join(" ")).not.toMatch(/vence em|regularize|débito|suspenso/i);
  });

  it("primeiro nome", () => {
    expect(primeiroNome("  Maria Aparecida Souza ")).toBe("Maria");
  });
});

describe("validação e editor", () => {
  it("nome, 1.000 letras e variável desconhecida", () => {
    expect(erroDoModelo("", "x")).toBe("Dê um nome ao modelo.");
    expect(erroDoModelo("a".repeat(41), "x")).toBe("O nome passa de 40 letras.");
    expect(erroDoModelo("ok", "a".repeat(1001))).toBe("O texto passa de 1.000 letras.");
    expect(erroDoModelo("ok", "😀".repeat(1000))).toBeNull();
    expect(letras("😀😀")).toBe(2);
    expect(erroDoModelo("ok", "Oi {cliente}")).toBe("O app não conhece {cliente}. Use os botões de variável.");
  });

  it("inserir variável onde está o cursor (ou no fim)", () => {
    expect(inserirVariavel("Oi, !", { start: 4, end: 4 }, "nome")).toEqual({ texto: "Oi, {nome}!", cursor: 10 });
    expect(inserirVariavel("Oi", null, "loja")).toEqual({ texto: "Oi{loja}", cursor: 8 });
    expect(inserirVariavel("Oi XXX!", { start: 3, end: 6 }, "nome").texto).toBe("Oi {nome}!");
  });
});

describe("parcela do Cobrar no cartão do carnê", () => {
  const abertas = [
    { id: "p-outro", due_date: "2026-10-01", account_id: "carne-A" },
    { id: "p-deste-2", due_date: "2026-12-10", account_id: "carne-B" },
    { id: "p-deste-1", due_date: "2026-11-10", account_id: "carne-B" },
    { id: "p-sem", due_date: "2026-09-01", account_id: null },
  ];
  it("sem carnê: a mais antiga da cliente (o de sempre)", () => {
    expect(parcelaDaCobranca(abertas)!.id).toBe("p-sem");
  });
  it("com carnê: a mais antiga DAQUELE carnê", () => {
    expect(parcelaDaCobranca(abertas, { id: "carne-B" })!.id).toBe("p-deste-1");
  });
  it("grupo sem carnê (id null): só as parcelas sem carnê", () => {
    expect(parcelaDaCobranca(abertas, { id: null })!.id).toBe("p-sem");
    expect(parcelaDaCobranca([{ id: "x", due_date: "2026-01-01", account_id: "c" }], { id: null })).toBeUndefined();
  });
});
