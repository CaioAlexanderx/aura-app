// ============================================================
// Saudações vivas da porta de entrada (tq-67, 21/10/2026)
//
// Porte da função greeting() do mockup aprovado "Porta de entrada v4".
// Regra, na ordem:
//   1. a hora LOCAL dá o cumprimento: 5–12 bom dia, 12–18 boa tarde,
//      18–23 boa noite, o resto é madrugada;
//   2. a data especial manda no tom: 1 a 7/jan, 20 a 24/dez, novembro e o
//      dia 1 de cada mês;
//   3. quando a data não mandou, o dia da semana dá a pitada no subtítulo
//      (segunda, sexta, sábado, domingo);
//   4. quem volta é chamado pelo primeiro nome; sem nome, metade das vezes
//      o cumprimento ganha "de novo".
// Em cada caixa há 2 ou 3 frases e o sorteio escolhe uma, para não repetir
// sempre a mesma. Nada aqui promete feature nem número.
//
// Saída em ESTRUTURA, não em HTML: `say` é uma lista de partes e a parte
// com `em` sai em itálico violeta. A tela monta nós de texto simples (sem
// dangerouslySetInnerHTML), o que também segura a tradução automática do
// Chrome (ver memória "Tradução do Chrome derruba o React").
//
// O aleatório é injetado (`rand`, padrão Math.random) para o teste ser
// determinístico. Função pura: sem rede, sem storage, sem relógio próprio.
// ============================================================

export type ParteDaFala = { text: string; em?: boolean };
export type Saudacao = { say: ParteDaFala[]; sub: string };

type Rand = () => number;

function sortear<T>(lista: T[], rand: Rand): T {
  const i = Math.floor(rand() * lista.length);
  return lista[Math.min(Math.max(i, 0), lista.length - 1)];
}

/** "Caio Pantoja" → "Caio". Vazio, nulo ou só espaço → "". */
export function primeiroNome(nome?: string | null): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

export function greeting(d: Date, firstName?: string | null, rand: Rand = Math.random): Saudacao {
  const h = d.getHours(), wd = d.getDay(), day = d.getDate(), mon = d.getMonth();
  const name = primeiroNome(firstName);
  // ", <em>Nome</em>" do mockup
  const nm: ParteDaFala[] = name ? [{ text: ", " }, { text: name, em: true }] : [];
  const frase = (antes: string, depois: string): ParteDaFala[] => [{ text: antes }, ...nm, { text: depois }];

  // 1) cumprimento pela hora
  let say: ParteDaFala[];
  let sub: string;
  if (h >= 5 && h < 12) {
    say = sortear([frase("Bom dia", "."), frase("Bom dia", ". Café na mão?")], rand);
    sub = sortear(["Vamos abrir a loja.", "Hoje promete.", "Primeiro o caixa, depois o resto."], rand);
  } else if (h >= 12 && h < 18) {
    say = sortear([frase("Boa tarde", "."), frase("Boa tarde", ". Como vão as vendas?")], rand);
    sub = sortear(["Hora de ver o que já saiu.", "Continue de onde parou.", "O movimento da tarde conta igual."], rand);
  } else if (h >= 18 && h < 23) {
    say = sortear([frase("Boa noite", "."), frase("Boa noite", ". Fechando o dia?")], rand);
    sub = sortear(["Vamos conferir o caixa.", "Fecha o dia com tudo no lugar.", "Continue de onde parou."], rand);
  } else {
    say = sortear([frase("Ainda por aqui", "?"), frase("Madrugada produtiva", ".")], rand);
    sub = sortear(["Vamos ser rápidos.", "Entra que o resto a gente simplifica."], rand);
  }

  // 2) a data especial manda no tom
  let dataEspecial = false;
  if (mon === 0 && day <= 7) {
    say = [...frase("Ano novo", ". "), { text: "Loja nova?", em: true }];
    sub = "Primeira semana do ano. Vamos começar pelo que vende.";
    dataEspecial = true;
  } else if (mon === 11 && day >= 20 && day <= 24) {
    say = [...frase("Reta final", ". "), { text: "Natal chegando.", em: true }];
    sub = "Dias de loja cheia. Entra que a gente segura o caixa.";
    dataEspecial = true;
  } else if (mon === 10) {
    sub = "Novembro é mês de mexer no preço. " + sub;
  } else if (day === 1) {
    say = [...frase("Dia 1", ". "), { text: "Mês novo.", em: true }];
    sub = "Fecha o que passou e abre o que vem.";
    dataEspecial = true;
  }
  // 3) o dia da semana dá uma pitada, quando a data não mandou
  else if (wd === 1) sub = sortear(["Semana nova, estoque em dia?", "Segunda é de arrumar a casa."], rand);
  else if (wd === 5) sub = sortear(["Sexta! Fim de semana é dia de vender.", "Sexta. Deixa tudo pronto para o sábado."], rand);
  else if (wd === 6) sub = "Sábado é de loja cheia.";
  else if (wd === 0) sub = sortear(["Domingo também conta.", "Domingo. Um olho no caixa, outro no descanso."], rand);

  // 4) quem nunca entrou neste aparelho vê o genérico com "de novo".
  // Fora das datas especiais: no mockup a regra tirava o ponto final do
  // texto e, nas frases que terminam em itálico ("Mês novo."), saía
  // "Mês novo., de novo." — a data especial já é o tom do dia.
  if (!name && !dataEspecial && h >= 5 && h < 23 && rand() < 0.5) {
    const ultima = say[say.length - 1];
    say = [...say.slice(0, -1), { ...ultima, text: ultima.text.replace(/\.$|\?$/, "") }, { text: ", " }, { text: "de novo", em: true }, { text: "." }];
  }
  return { say: say.filter((p) => p.text !== ""), sub };
}

/** Saudação da etapa 1 do cadastro ("Bom dia! Como a gente te chama?"). Usada no tq-68. */
export function regGreeting(d: Date): ParteDaFala[] {
  const h = d.getHours();
  const p = h >= 5 && h < 12 ? "Bom dia!" : h >= 12 && h < 18 ? "Boa tarde!" : h >= 18 && h < 23 ? "Boa noite!" : "Ainda por aí?";
  return [{ text: p + " Como a gente " }, { text: "te chama", em: true }, { text: "?" }];
}

/** A fala como texto corrido (leitores de tela, testes, logs). */
export function falaEmTexto(say: ParteDaFala[]): string {
  return say.map((p) => p.text).join("");
}
