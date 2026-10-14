// ============================================================
// Gestão Aura › Hoje — adaptadores API → modelo da tela.
//
// As entradas são as respostas reais do backend (Aura-backend #807),
// copiadas de tests/fixtures/painel em __tests__/__fixtures__/painel.
// ============================================================
import {
  adaptarContato, adaptarDetalhe, adaptarFicha, adaptarHoje, adaptarLayout, adaptarPontos,
  brl, corpoDoLayout, dataCurta, dataHora, formatarTelefone, montarCatalogo,
} from "@/components/admin/painel/adaptadores";
import { DEFINICOES } from "@/components/admin/painel/blocos";

const fx = (nome: string) => JSON.parse(JSON.stringify(require("../__fixtures__/painel/" + nome + ".json")));

const IDS: string[] = [
  "trials_degrau", "receita", "cadastros", "pagantes", "pagantes_sem_venda", "acesso", "uso_funcionalidade",
  "horario", "plataforma", "adocao", "telas_visitadas", "fiscal", "crediario", "contatos", "frentes",
];

// O layout do backend (GET /layout) já traz o bloco Check-in (backend #835), que
// o hoje.json gravado ainda não tem.
const IDS_LAYOUT: string[] = IDS.slice(0, 5).concat(["checkin"], IDS.slice(5));

describe("formatação", () => {
  it("reais, datas, telefone", () => {
    expect(brl(553)).toBe("R$ 553");
    expect(brl(140.83)).toBe("R$ 140,83");
    expect(brl(9690.7, true)).toBe("R$ 9.690,70");
    expect(brl(169, true)).toBe("R$ 169,00");
    expect(dataCurta("2026-10-14")).toBe("14/10");
    expect(dataCurta(null)).toBe("—");
    // 17:20Z = 14:20 em Brasília
    expect(dataHora("2026-10-11T17:20:00.000Z")).toBe("11/10 14:20");
    expect(formatarTelefone("11999900002")).toBe("(11) 99990-0002");
    expect(formatarTelefone("1133334444")).toBe("(11) 3333-4444");
  });
});

describe("adaptarHoje", () => {
  const hoje = adaptarHoje(fx("hoje"));
  const bloco = (id: string) => hoje.blocos.find((b) => b.id === id)!;

  it("traz os 15 blocos e todos têm definição de apresentação", () => {
    expect(hoje.blocos.map((b) => b.id).sort()).toEqual(IDS.slice().sort());
    const defs = DEFINICOES.map((d) => d.id as string);
    for (const b of hoje.blocos) expect(defs).toContain(b.id);
  });

  it("valor + unidade viram número e legenda", () => {
    expect(bloco("receita").valor).toBe("R$ 553");
    expect(bloco("receita").legenda).toBe("por mês");
    expect(bloco("pagantes").valor).toBe(5);
    expect(bloco("pagantes").legenda).toBe("ativos");
    expect(bloco("horario").valor).toBe("16h");
    expect(bloco("horario").legenda).toBeUndefined();
  });

  it("variação d7/d30 vira pill; null some; menor é melhor inverte a cor", () => {
    expect(bloco("receita").variacao).toEqual({ texto: "+R$ 73,34 · 7d", tom: "sobe" });
    expect(bloco("pagantes").variacao).toEqual({ texto: "+1 · 7d", tom: "sobe" });
    expect(bloco("cadastros").variacao).toBeNull();

    const cru = fx("hoje");
    cru.blocos.find((b: any) => b.id === "crediario").variacao = { d7: 12, d30: null };
    cru.blocos.find((b: any) => b.id === "cadastros").variacao = { d7: null, d30: -2 };
    const h = adaptarHoje(cru);
    expect(h.blocos.find((b) => b.id === "crediario")!.variacao).toEqual({ texto: "+12 · 7d", tom: "desce" });
    expect(h.blocos.find((b) => b.id === "cadastros")!.variacao).toEqual({ texto: "−2 · 30d", tom: "desce" });
  });

  it("séries: valor2 do acesso, texto do funil, fatias da rosca, 'nunca' apagado", () => {
    const acesso = bloco("acesso").serie;
    expect(acesso[acesso.length - 1]).toMatchObject({ rotulo: "12/10", valor: 5, valor2: 3 });

    const funil = bloco("trials_degrau").serie;
    expect(funil[0].texto).toBeUndefined();
    expect(funil[1]).toMatchObject({ rotulo: "Com produtos", valor: 3, texto: "75%" });
    expect(funil[funil.length - 1].tom).toBe("teal");

    const rosca = bloco("pagantes").serie;
    expect(rosca.map((p) => p.tom)).toEqual(["neutro", "teal"]);
    expect(rosca[0].texto).toBe("1 anual");

    const sem = bloco("pagantes_sem_venda").serie;
    expect(sem[0]).toMatchObject({ rotulo: "Loja Aurora", valor: 22, texto: "22 d", tom: "desce" });
    expect(sem[1]).toMatchObject({ rotulo: "Dojô Central", valor: 90, texto: "nunca", tom: "mudo" });

    const fiscal = bloco("fiscal").serie;
    expect(fiscal.filter((p) => p.tom === "desce").map((p) => p.rotulo)).toEqual(["10/10"]);

    expect(bloco("frentes").serie[0].texto).toBe("1 pag · 0 trial");
    expect(bloco("telas_visitadas").serie[0].texto).toBe("2 lojas · 735 vis.");
  });

  it("a faixa do topo sai dos blocos", () => {
    expect(hoje.destaques!.map((d) => d.id)).toEqual(["receita", "pagantes", "acesso", "plataforma"]);
    const mrr = hoje.destaques![0];
    expect(mrr).toMatchObject({ rotulo: "MRR real · Asaas", valor: "R$ 553", nota: "por mês", bloco: "receita" });
    expect(mrr.serie).toEqual([140.83, 310.83, 553]);
    expect(hoje.destaques![1].serie).toEqual([]);   // sem série temporal na API
  });

  it("alertas: tipo de domínio vira risco/atenção/bom; detalhe e verbo nulos têm padrão", () => {
    expect(hoje.alertas.map((a) => a.tipo)).toEqual(["risco", "atencao", "bom", "atencao"]);
    expect(hoje.alertas[0]).toMatchObject({ titulo: "Loja Aurora vence amanhã", verbo: "Ligar", bloco: "pagantes_sem_venda" });
    expect(hoje.alertas[2].company_id).toBeNull();

    const cru = fx("hoje");
    cru.alertas = [{ tipo: "novo_tipo", company_id: null, titulo: "x", detalhe: null, verbo: null, bloco: null }];
    expect(adaptarHoje(cru).alertas[0]).toMatchObject({ tipo: "atencao", detalhe: "", verbo: "Ver", bloco: null });
  });

  it("ao_vivo e horários passam como vieram", () => {
    expect(hoje.ao_vivo).toBe(false);
    expect(hoje.calculado_em).toBe("2026-10-13T09:00:04.000Z");
    const cru = fx("hoje");
    cru.ao_vivo = true;
    expect(adaptarHoje(cru).ao_vivo).toBe(true);
  });
});

describe("adaptarDetalhe", () => {
  it("todo bloco adapta sem lançar e mantém período, ao_vivo e insight", () => {
    for (const id of IDS) {
      const d = adaptarDetalhe(id, fx("blocos." + id));
      expect(d.periodo).toBeGreaterThan(0);
      expect(d.ao_vivo).toBe(false);
      expect(Array.isArray(d.indicadores)).toBe(true);
      expect(d.series.length + d.listas.length).toBeGreaterThan(0);
    }
    expect(adaptarDetalhe("fiscal", fx("blocos.fiscal")).periodo).toBe(7);
    expect(adaptarDetalhe("plataforma", fx("blocos.plataforma")).periodo).toBe(14);
    // Contatos: quem está esperando resposta pede atenção (âmbar).
    expect(adaptarDetalhe("contatos", fx("blocos.contatos")).insight).toEqual({
      texto: "3 contatos aguardam resposta (1 já falou com a Aurinha).", tom: "alerta",
    });
    expect(adaptarDetalhe("pagantes_sem_venda", fx("blocos.pagantes_sem_venda")).insight).toMatchObject({ tom: "alerta" });
    expect(adaptarDetalhe("cadastros", fx("blocos.cadastros")).insight).toMatchObject({ tom: "neutro" });
  });

  it("indicadores: reais só onde a API não tipa mas o bloco é de dinheiro", () => {
    const rec = adaptarDetalhe("receita", fx("blocos.receita")).indicadores;
    expect(rec[0]).toEqual({ rotulo: "Recebido · Set", valor: "R$ 479,66", nota: "3 pagamentos" });
    const cred = adaptarDetalhe("crediario", fx("blocos.crediario")).indicadores;
    expect(cred[0].valor).toBe("123");
    expect(cred[1].valor).toBe("R$ 9.690,70");
    const fis = adaptarDetalhe("fiscal", fx("blocos.fiscal")).indicadores;
    expect(fis[2].valor).toBe("97%");     // texto pronto passa direto
    expect(adaptarDetalhe("adocao", fx("blocos.adocao")).indicadores[0].nota).toBeUndefined();   // null some
  });

  it("listas: células por tipo de coluna", () => {
    const cred = adaptarDetalhe("crediario", fx("blocos.crediario")).listas[0];
    expect(cred.colunas).toEqual(["Loja", "Parcelas", "Clientes", "Valor", "Mais antiga"]);
    expect(cred.linhas[0]).toEqual([
      { texto: "Mercado Bela Vista", company_id: "aaaaaaaa-0000-4000-8000-000000000002", telefone: "11999900002" },
      107, 41, "R$ 8.450,50", "10/06",
    ]);

    const acesso = adaptarDetalhe("acesso", fx("blocos.acesso")).listas;
    expect(acesso[1].linhas[0][0]).toMatchObject({ texto: "Dojô Central", telefone: null });   // sem telefone

    // Contatos (Aura-backend#815): WhatsApp da Aura + site.
    const contatos = adaptarDetalhe("contatos", fx("blocos.contatos")).listas[0];
    expect(contatos.colunas).toEqual([
      "Quando", "Quem", "Telefone", "Cidade", "Canal", "Primeira resposta", "Demorou", "Situação", "Empresa",
    ]);
    // WhatsApp sem nome: o telefone mascarado vira o nome, abre a conversa e não é link
    expect(contatos.linhas[0][0]).toBe("13/10 08:50");
    expect(contatos.linhas[0][1]).toEqual({ texto: "+55 11 *****-0004", conversa_id: "dddddddd-0000-4000-8000-000000000004" });
    expect(contatos.linhas[0][2]).toBe("+55 11 *****-0004");
    expect(contatos.linhas[0][7]).toMatchObject({ texto: "Sem resposta", etiqueta: true, tom: "desce" });
    expect(contatos.linhas[1][7]).toMatchObject({ texto: "Aurinha", tom: "alerta" });
    // WhatsApp com nome, resposta e empresa: nome abre a conversa, empresa abre a ficha
    expect(contatos.linhas[2][1]).toEqual({ texto: "Renata Lima", conversa_id: "dddddddd-0000-4000-8000-000000000001" });
    expect(contatos.linhas[2][5]).toBe("13/10 08:10");
    expect(contatos.linhas[2][6]).toBe("8 h 30 min");
    expect(contatos.linhas[2][7]).toMatchObject({ texto: "Caio", tom: "sobe" });
    expect(contatos.linhas[2][8]).toEqual({ texto: "Mercado Bela Vista", company_id: "aaaaaaaa-0000-4000-8000-000000000002" });
    // Site: como antes (sem conversa, telefone inteiro com link)
    expect(contatos.linhas[3][0]).toBe("11/10 14:20");
    expect(contatos.linhas[3][1]).toBe("Marina Prado");
    expect(contatos.linhas[3][2]).toEqual({ texto: "(11) 98888-0001", telefone: "11988880001" });
    expect(contatos.linhas[3][7]).toMatchObject({ texto: "Contatado", etiqueta: true });
    expect(contatos.linhas[5][7]).toMatchObject({ texto: "Novo", tom: "alerta" });

    const adocao = adaptarDetalhe("adocao", fx("blocos.adocao")).listas[1];
    expect(adocao.linhas.length).toBe(80);
    expect(adocao.linhas[0][2]).toMatchObject({ texto: "Sim", etiqueta: true });

    const receita = adaptarDetalhe("receita", fx("blocos.receita")).listas;
    const eventos = receita[3];
    expect(eventos.linhas[0][1]).toEqual({ texto: "Sem loja vinculada", tom: "alerta" });   // company_id null: sem link
    expect(eventos.linhas[0][3]).toBe("R$ 140,83");
  });

  it("trials_degrau: uma coluna de cartões por degrau com WhatsApp e +7 dias", () => {
    const d = adaptarDetalhe("trials_degrau", fx("blocos.trials_degrau"));
    expect(d.listas.map((l) => l.titulo)).toEqual(["Só cadastro", "Com produtos", "Venderam", "Viram checkout", "Assinaram"]);
    expect(d.listas.every((l) => l.formato === "cartoes")).toBe(true);
    expect(d.listas[0].total).toBe(0);

    const checkout = d.listas[3];
    expect(checkout.total).toBe(1);
    const [loja, detalhe, ...verbos] = checkout.linhas[0];
    expect(loja).toMatchObject({ texto: "Tech Assist", company_id: "aaaaaaaa-0000-4000-8000-000000000007" });
    expect(detalhe).toEqual({ texto: "0 produtos · 0 vendas · venceu 08/10", tom: "desce" });
    expect(verbos).toEqual([
      { texto: "WhatsApp", verbo: true, primario: true, telefone: "11999900007" },
      { texto: "+7 dias", verbo: true },
    ]);

    const assinaram = d.listas[4].linhas[0];
    expect(assinaram[1]).toEqual({ texto: "Negócio mensal", tom: undefined });
    expect(assinaram.slice(2).map((c: any) => c.texto)).toEqual(["WhatsApp"]);   // quem assinou não ganha +7 dias
  });

  it("checkin: indicadores, regra de parada, lista de cadastros e importação assistida", () => {
    const d = adaptarDetalhe("checkin", fx("blocos.checkin"));
    expect(d.indicadores.map((i) => i.rotulo)).toEqual([
      "Cadastros desde a subida", "Produto em 24 h", "Venda em 7 dias", "Produto em 24 h · só quem viu a tela",
      "Tempo até o 5º produto (mediana)", "Regra de parada", "Importação assistida",
    ]);
    expect(d.listas.map((l) => l.titulo)).toEqual(["Cadastros desde a subida", "Importação assistida"]);
    const cadastros = d.listas[0];
    expect(cadastros.colunas).toContain("Viu a tela");
    expect(cadastros.colunas).toContain("Horas até o 5º produto");
    expect(cadastros.linhas.length).toBe(3);
    expect(d.series.map((s) => s.titulo)).toContain("Tela do check-in");
  });

  it("séries do detalhe: tipo mantido, legenda da linha de duas séries", () => {
    const a = adaptarDetalhe("acesso", fx("blocos.acesso")).series;
    expect(a[0]).toMatchObject({ tipo: "linha", legenda: ["Todas as lojas", "Pagantes"] });
    expect(a[0].pontos[a[0].pontos.length - 1].valor2).toBe(3);
    expect(a[1].tipo).toBe("barras_h");
    expect(adaptarDetalhe("receita", fx("blocos.receita")).series[1].pontos[0].texto).toBe("R$ 338");
  });

  it("adaptarPontos aceita ponto sem extras", () => {
    expect(adaptarPontos("cadastros", [{ rotulo: "31/08", valor: 0 }], "barras")).toEqual([{ rotulo: "31/08", valor: 0 }]);
  });
});

describe("adaptarFicha", () => {
  const ficha = adaptarFicha(fx("clientes.ficha"));

  it("cabeçalho, situação e telefone", () => {
    expect(ficha).toMatchObject({ company_id: "aaaaaaaa-0000-4000-8000-000000000001", nome: "Loja Aurora", telefone: "11999900001" });
    expect(ficha.situacao).toEqual({ texto: "Pagante", tom: "sobe" });
    expect(ficha.resumo).toBe("Negócio anual · cliente desde 06/06 · Helena Duarte");
  });

  it("indicadores, módulos, série, linha do tempo e alertas", () => {
    expect(ficha.indicadores.map((i) => i.rotulo)).toEqual(["Saúde", "Logins · 30d", "Último acesso", "Vendas", "Asaas"]);
    expect(ficha.indicadores[0]).toMatchObject({ valor: "45/100", nota: "atenção", tom: "alerta" });
    expect(ficha.indicadores[1]).toMatchObject({ valor: "3", nota: "3 dias ativos" });
    expect(ficha.indicadores[4]).toMatchObject({ valor: "cobrança apagada", nota: "21/09 · R$ 140,83" });
    expect(ficha.modulos).toEqual([
      { nome: "Caixa", usa: true },
      { nome: "Studio pedidos", usa: true },
      { nome: "Estoque", usa: false },
    ]);
    expect(ficha.serie!.titulo).toBe("Vendas por semana");
    expect(ficha.serie!.pontos.length).toBe(12);
    expect(ficha.linha_do_tempo.find((e) => e.texto.startsWith("Cobrança apagada"))).toEqual({ data: "21/09", texto: "Cobrança apagada na Asaas · R$ 140,83" });
    expect(ficha.alertas).toEqual([{ tom: "risco", texto: "Loja Aurora vence amanhã — Anual · sem venda há 22 dias" }]);
  });

  it("contatos da equipe entram na linha do tempo (mais recente primeiro) e na lista própria", () => {
    expect(ficha.linha_do_tempo[0]).toEqual({
      data: "12/10", texto: "Contato por WhatsApp: Pediu um tempo — Pediu até sexta para ver o preço do anual",
    });
    expect(ficha.linha_do_tempo.map((e) => e.data)).toEqual(["12/10", "08/10", "02/10", "21/09", "21/09", "21/09", "14/09"]);
    expect(ficha.contatos!.map((c) => [c.id, c.titulo, c.texto, c.proximo, c.motivo])).toEqual([
      [7, "Contato por WhatsApp: Pediu um tempo", "Pediu até sexta para ver o preço do anual", "Ligar de novo · sexta, 16/10", null],
      [3, "Contato por Ligação: Respondeu", "Importação da planilha pedida", null, null],
    ]);
    expect(ficha.checkin).toEqual({ como_chegou: "indicacao", fiado: "sim", quem_decide: "dono" });
    expect(ficha.em_trial).toBe(false);
  });

  it("próximo passo com data passada fica atrasado; motivo vira rótulo", () => {
    const raw = fx("clientes.ficha");
    const c = raw.contatos[0];
    expect(adaptarContato(c, "2026-10-16").atrasado).toBe(false);
    expect(adaptarContato(c, "2026-10-17").atrasado).toBe(true);
    expect(adaptarContato({ ...c, proximo_passo_em: null, proximo_passo: null }, "2026-10-17")).toMatchObject({ proximo: null, atrasado: false });
    expect(adaptarContato({ ...c, resultado: "nao_quer", motivo: "preco_plano" }).motivo).toBe("Preço do plano");
  });

  it("ficha de antes do backend #836 (sem contatos nem checkin) segue igual", () => {
    const raw = fx("clientes.ficha");
    delete raw.contatos;
    delete raw.checkin;
    raw.linha_do_tempo = raw.linha_do_tempo.filter((e: any) => e.tipo !== "contato");
    const f = adaptarFicha(raw);
    expect(f.contatos).toEqual([]);
    expect(f.checkin).toBeNull();
    expect(f.linha_do_tempo.length).toBe(5);
  });

  it("em trial: libera o +7 dias de teste", () => {
    const raw = fx("clientes.ficha");
    raw.cliente.stage = "trial";
    expect(adaptarFicha(raw).em_trial).toBe(true);
  });

  it("sem health nem módulos detalhados não quebra", () => {
    const cru = fx("clientes.ficha");
    cru.health = null;
    cru.modulos_detalhe = [];
    cru.cliente.stage = "trial";
    cru.cliente.trial_days_left = 3;
    const f = adaptarFicha(cru);
    expect(f.indicadores[0]).toMatchObject({ valor: "—", nota: "sem cálculo" });
    expect(f.modulos).toEqual([{ nome: "Caixa", usa: true }, { nome: "Studio pedidos", usa: true }, { nome: "Estoque", usa: true }]);
    expect(f.situacao).toEqual({ texto: "Trial · 3 d", tom: "alerta" });
  });
});

describe("layout e catálogo", () => {
  it("GET /layout: visíveis na ordem + todos os conhecidos", () => {
    const l = adaptarLayout(fx("layout.get"));
    expect(l.padrao).toBe(true);
    expect(l.ativos).toEqual(IDS_LAYOUT);
    expect(l.conhecidos.length).toBe(16);

    const salvo = adaptarLayout(fx("layout.put").resposta);
    expect(salvo.padrao).toBe(false);
    expect(salvo.ativos.slice(0, 2)).toEqual(["receita", "pagantes"]);
    expect(salvo.ativos).not.toContain("contatos");
    expect(salvo.conhecidos.length).toBe(16);
  });

  it("corpo do PUT: visíveis na ordem, depois os desligados; ids desconhecidos ficam de fora", () => {
    const corpo = corpoDoLayout(["a", "b", "c", "d"] as any, ["c", "nps", "a"] as any);
    expect(corpo).toEqual([
      { id: "c", visivel: true }, { id: "a", visivel: true },
      { id: "b", visivel: false }, { id: "d", visivel: false },
    ]);
  });

  it("catálogo: o que o backend conhece liga; o resto do mockup fica em construção", () => {
    const itens = montarCatalogo(adaptarLayout(fx("layout.get")).conhecidos);
    expect(itens.length).toBe(21);
    expect(itens.filter((i) => !i.em_construcao).length).toBe(16);
    expect(itens.filter((i) => i.em_construcao).map((i) => i.id).sort()).toEqual(
      ["aurinha", "custos", "etiquetas", "nps", "tempo_primeira_venda"]
    );
    expect(itens.find((i) => i.id === "telas_visitadas")!.aviso).toBeUndefined();
  });
});
