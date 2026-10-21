// ============================================================
// Saudações vivas da porta de entrada (tq-67, 21/10/2026)
//
// Segura o porte da greeting() do mockup "Porta de entrada v4": caixa de
// hora, data especial, dia da semana, com e sem nome, e a regGreeting() da
// etapa 1 do cadastro (usada no tq-68). O aleatório é injetado: `seq`
// devolve os valores na ordem em que a função sorteia (frase da hora,
// subtítulo da hora, pitada do dia, "de novo").
// Datas: outubro de 2026 — 19 é segunda, 21 quarta, 23 sexta, 24 sábado,
// 25 domingo. Fuso fixo em America/Sao_Paulo (jest.config.js).
// ============================================================
import { greeting, regGreeting, primeiroNome, falaEmTexto } from "@/utils/saudacao";
import { palcoEstatico } from "@/utils/palcoMovimento";
import { lerPrimeiroNome, guardarPrimeiroNome, CHAVE_PRIMEIRO_NOME } from "@/utils/primeiroNomeNoAparelho";

const zero = () => 0;
function seq(...vals: number[]) { let i = 0; return () => (i < vals.length ? vals[i++] : 0); }
const dia = (d: number, h: number, m = 0, mes = 9, ano = 2026) => new Date(ano, mes, d, h, m);
const texto = (d: Date, nome?: string | null, rand: () => number = zero) => {
  const g = greeting(d, nome, rand);
  return { say: falaEmTexto(g.say), sub: g.sub, em: g.say.filter((p) => p.em).map((p) => p.text) };
};

describe("caixa de hora (quarta, sem data especial)", () => {
  test("5h–12h: bom dia", () => {
    expect(texto(dia(21, 9), "Caio")).toEqual({ say: "Bom dia, Caio.", sub: "Vamos abrir a loja.", em: ["Caio"] });
    expect(texto(dia(21, 9), "Caio", seq(0.6, 0.5)).say).toBe("Bom dia, Caio. Café na mão?");
    expect(texto(dia(21, 9), "Caio", seq(0, 0.99)).sub).toBe("Primeiro o caixa, depois o resto.");
  });
  test("12h–18h: boa tarde", () => {
    expect(texto(dia(21, 14), "Caio")).toEqual({ say: "Boa tarde, Caio.", sub: "Hora de ver o que já saiu.", em: ["Caio"] });
    expect(texto(dia(21, 14), "Caio", seq(0.6, 0.5)).say).toBe("Boa tarde, Caio. Como vão as vendas?");
    expect(texto(dia(21, 14), "Caio", seq(0, 0.5)).sub).toBe("Continue de onde parou.");
  });
  test("18h–23h: boa noite", () => {
    expect(texto(dia(21, 19), "Caio")).toEqual({ say: "Boa noite, Caio.", sub: "Vamos conferir o caixa.", em: ["Caio"] });
    expect(texto(dia(21, 19), "Caio", seq(0.6, 0.5)).say).toBe("Boa noite, Caio. Fechando o dia?");
  });
  test("resto: madrugada", () => {
    expect(texto(dia(21, 2), "Caio")).toEqual({ say: "Ainda por aqui, Caio?", sub: "Vamos ser rápidos.", em: ["Caio"] });
    expect(texto(dia(21, 23, 40), "Caio", seq(0.6, 0.6)).say).toBe("Madrugada produtiva, Caio.");
    expect(texto(dia(21, 23, 40), "Caio", seq(0.6, 0.6)).sub).toBe("Entra que o resto a gente simplifica.");
  });
  test("limites das caixas", () => {
    expect(texto(dia(21, 4, 59), "Ana").say).toBe("Ainda por aqui, Ana?");
    expect(texto(dia(21, 5), "Ana").say).toBe("Bom dia, Ana.");
    expect(texto(dia(21, 11, 59), "Ana").say).toBe("Bom dia, Ana.");
    expect(texto(dia(21, 12), "Ana").say).toBe("Boa tarde, Ana.");
    expect(texto(dia(21, 18), "Ana").say).toBe("Boa noite, Ana.");
    expect(texto(dia(21, 23), "Ana").say).toBe("Ainda por aqui, Ana?");
  });
});

describe("com e sem nome", () => {
  test("com nome: só o primeiro, em itálico, sem 'de novo'", () => {
    const g = greeting(dia(21, 14), "Caroline Souza", zero);
    expect(g.say).toEqual([{ text: "Boa tarde" }, { text: ", " }, { text: "Caroline", em: true }, { text: "." }]);
  });
  test("sem nome: metade das vezes ganha 'de novo' (em itálico)", () => {
    const g = greeting(dia(21, 14), null, seq(0, 0, 0.2));
    expect(falaEmTexto(g.say)).toBe("Boa tarde, de novo.");
    expect(g.say.filter((p) => p.em)).toEqual([{ text: "de novo", em: true }]);
    expect(falaEmTexto(greeting(dia(21, 14), "", seq(0, 0, 0.7)).say)).toBe("Boa tarde.");
    // regra literal do mockup: tira o ponto de interrogação do fim
    expect(falaEmTexto(greeting(dia(21, 9), undefined, seq(0.6, 0, 0.1)).say)).toBe("Bom dia. Café na mão, de novo.");
  });
  test("sem nome de madrugada: nunca 'de novo'", () => {
    expect(texto(dia(21, 2), null).say).toBe("Ainda por aqui?");
  });
  test("primeiroNome", () => {
    expect(primeiroNome("  Caio   Pantoja ")).toBe("Caio");
    expect(primeiroNome("")).toBe("");
    expect(primeiroNome(null)).toBe("");
    expect(primeiroNome(undefined)).toBe("");
  });
});

describe("data especial manda no tom", () => {
  test("1 a 7 de janeiro: ano novo", () => {
    expect(texto(new Date(2027, 0, 3, 10), "Caio")).toEqual({
      say: "Ano novo, Caio. Loja nova?", sub: "Primeira semana do ano. Vamos começar pelo que vende.", em: ["Caio", "Loja nova?"],
    });
    expect(texto(new Date(2027, 0, 7, 10), null).say).toBe("Ano novo. Loja nova?");
    expect(texto(new Date(2027, 0, 8, 10), "Caio").say).toBe("Bom dia, Caio.");
  });
  test("1/jan cai no ano novo, não no dia 1", () => {
    expect(texto(new Date(2027, 0, 1, 10), "Caio").say).toBe("Ano novo, Caio. Loja nova?");
  });
  test("20 a 24 de dezembro: Natal", () => {
    expect(texto(dia(22, 11, 0, 11), "Caio")).toEqual({
      say: "Reta final, Caio. Natal chegando.", sub: "Dias de loja cheia. Entra que a gente segura o caixa.", em: ["Caio", "Natal chegando."],
    });
    expect(texto(dia(20, 11, 0, 11), "Caio").say).toBe("Reta final, Caio. Natal chegando.");
    expect(texto(dia(24, 11, 0, 11), "Caio").say).toBe("Reta final, Caio. Natal chegando.");
    expect(texto(dia(25, 11, 0, 11), "Caio").say).toBe("Bom dia, Caio.");
  });
  test("novembro: o cumprimento é da hora e o subtítulo ganha o preço", () => {
    // 12/11/2026 é quinta
    expect(texto(dia(12, 15, 0, 10), null, seq(0, 0, 0.9))).toEqual({
      say: "Boa tarde.", sub: "Novembro é mês de mexer no preço. Hora de ver o que já saiu.", em: [],
    });
    // 1/11/2026 é domingo: novembro vence o dia 1 e o domingo
    expect(texto(dia(1, 9, 0, 10), "Caio").sub).toBe("Novembro é mês de mexer no preço. Vamos abrir a loja.");
    expect(texto(dia(1, 9, 0, 10), "Caio").say).toBe("Bom dia, Caio.");
  });
  test("dia 1 do mês", () => {
    // 1/12/2026 é terça
    expect(texto(dia(1, 9, 0, 11), "Caio")).toEqual({
      say: "Dia 1, Caio. Mês novo.", sub: "Fecha o que passou e abre o que vem.", em: ["Caio", "Mês novo."],
    });
  });
  test("data especial sem nome não ganha 'de novo' (evita 'Mês novo., de novo.')", () => {
    expect(texto(dia(1, 9, 0, 11), null, zero).say).toBe("Dia 1. Mês novo.");
    expect(texto(dia(22, 11, 0, 11), null, zero).say).toBe("Reta final. Natal chegando.");
  });
});

describe("dia da semana dá a pitada no subtítulo", () => {
  test("segunda", () => {
    expect(texto(dia(19, 7, 30), "Caio").sub).toBe("Semana nova, estoque em dia?");
    expect(texto(dia(19, 7, 30), "Caio", seq(0, 0, 0.6)).sub).toBe("Segunda é de arrumar a casa.");
  });
  test("sexta", () => {
    expect(texto(dia(23, 19), "Caio").sub).toBe("Sexta! Fim de semana é dia de vender.");
    expect(texto(dia(23, 19), "Caio", seq(0, 0, 0.6)).sub).toBe("Sexta. Deixa tudo pronto para o sábado.");
  });
  test("sábado", () => {
    expect(texto(dia(24, 10), "Caroline").sub).toBe("Sábado é de loja cheia.");
  });
  test("domingo", () => {
    expect(texto(dia(25, 23, 40), null).sub).toBe("Domingo também conta.");
    expect(texto(dia(25, 10), "Caio", seq(0, 0, 0.6)).sub).toBe("Domingo. Um olho no caixa, outro no descanso.");
  });
  test("terça, quarta e quinta: fica o subtítulo da hora", () => {
    expect(texto(dia(20, 14), "Caio").sub).toBe("Hora de ver o que já saiu.");
    expect(texto(dia(21, 14), "Caio").sub).toBe("Hora de ver o que já saiu.");
    expect(texto(dia(22, 14), "Caio").sub).toBe("Hora de ver o que já saiu.");
  });
});

describe("regGreeting (etapa 1 do cadastro, tq-68)", () => {
  test("cumprimento pela hora + 'te chama' em itálico", () => {
    expect(regGreeting(dia(21, 9))).toEqual([{ text: "Bom dia! Como a gente " }, { text: "te chama", em: true }, { text: "?" }]);
    expect(falaEmTexto(regGreeting(dia(21, 14)))).toBe("Boa tarde! Como a gente te chama?");
    expect(falaEmTexto(regGreeting(dia(21, 19)))).toBe("Boa noite! Como a gente te chama?");
    expect(falaEmTexto(regGreeting(dia(21, 2)))).toBe("Ainda por aí? Como a gente te chama?");
    expect(falaEmTexto(regGreeting(dia(21, 23)))).toBe("Ainda por aí? Como a gente te chama?");
  });
});

describe("palco parado (orçamento de desempenho)", () => {
  test("reduzir movimento, até 4 núcleos ou até 2 GB: estático", () => {
    expect(palcoEstatico({ reducedMotion: true, hardwareConcurrency: 16, deviceMemory: 8 })).toBe(true);
    expect(palcoEstatico({ hardwareConcurrency: 4, deviceMemory: 8 })).toBe(true);
    expect(palcoEstatico({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
    expect(palcoEstatico({ hardwareConcurrency: 8, deviceMemory: 4 })).toBe(false);
  });
  test("campo ausente não conta (Safari/Firefox não expõem deviceMemory)", () => {
    expect(palcoEstatico({ hardwareConcurrency: 8, deviceMemory: null })).toBe(false);
    expect(palcoEstatico({})).toBe(false);
  });
});

describe("primeiro nome no aparelho", () => {
  afterEach(() => { localStorage.removeItem(CHAVE_PRIMEIRO_NOME); jest.restoreAllMocks(); });
  test("guarda só o primeiro nome e lê de volta", () => {
    guardarPrimeiroNome("Caio Pantoja");
    expect(localStorage.getItem(CHAVE_PRIMEIRO_NOME)).toBe("Caio");
    expect(lerPrimeiroNome()).toBe("Caio");
  });
  test("nunca guarda e-mail; sem nome apaga o anterior", () => {
    guardarPrimeiroNome("Caio");
    guardarPrimeiroNome("caio@getaura.com.br");
    expect(localStorage.getItem(CHAVE_PRIMEIRO_NOME)).toBeNull();
    guardarPrimeiroNome("Caio");
    guardarPrimeiroNome(undefined);
    expect(lerPrimeiroNome()).toBe("");
  });
  test("storage que explode não quebra o login", () => {
    // No jsdom o localStorage é um Storage de verdade: o espião vai no protótipo.
    const alvo: any = typeof Storage !== "undefined" && localStorage instanceof Storage ? Storage.prototype : localStorage;
    jest.spyOn(alvo, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
    jest.spyOn(alvo, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
    expect(() => guardarPrimeiroNome("Caio")).not.toThrow();
    expect(lerPrimeiroNome()).toBe("");
  });
});
