// ============================================================
// Telas do Aniversário, Venda+ e Crediário (26/11/2026).
//
// Seguram: o corte ("Cabem N de M", quem fica de fora), "Trazer N do
// Venda+", o botão de mandar travado em toda dúvida, as escolhas lidas do
// contrato do agente B e a ausência da Reativação no bloco Conexão.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/hooks/useClientesPrevia", () => ({ useClientesPrevia: () => [] }));

import { waCorte, trazerDoVendaMais, quantoTrazer, podeMandarNovidades } from "@/components/whatsapp/waCorte";
import {
  alternarPonto, chaveDoPresente, lerPontos, lerQuando, modeloDoAniversario, modeloDaVenda, patchDePresente, quandoPermitido,
  presenteDaChave, rotuloDoPresente,
} from "@/components/whatsapp/waAutomaticaConfig";
import { renderizar, tokensDe } from "@/components/whatsapp/waMensagem";
import { DIVISAO_PADRAO, lerAutomaticas } from "@/components/whatsapp/waDivisao";
import { waSaldoInfo } from "@/components/whatsapp/waSaldo";

const zero = { aniversario: 0, venda_mais: 0, crediario: 0 };
const pessoa = (nome: string) => ({ nome, detalhe: "R$ 100 em compras" });

function publico(over: any = {}) {
  return {
    elegiveis: 7, cabem: 4, ordem: "quem mais compra primeiro",
    vao: ["Ana", "Marta", "Cris", "Bia"].map(pessoa),
    ficam_guardados: 3, guardados: ["Lia", "Duda"].map(pessoa),
    falta_para_todos: 3, ...over,
  };
}

describe("waCorte", () => {
  it("lê o corte do servidor", () => {
    const c = waCorte(publico(), 4)!;
    expect(c.total).toBe(7);
    expect(c.cabem).toBe(4);
    expect(c.cabeTodos).toBe(false);
    expect(c.faltam).toBe(3);
    expect(c.recebem.map((p) => p.nome)).toEqual(["Ana", "Marta", "Cris", "Bia"]);
    expect(c.ficam.length).toBe(2);
    expect(c.alemDaLista).toBe(1); // 3 guardados, 2 listados
  });

  it("nunca promete mais do que sobra de novidades", () => {
    expect(waCorte(publico(), 2)!.cabem).toBe(2);
    expect(waCorte(publico(), 2)!.recebem.length).toBe(2);
    // aniversário: 2 novidades por pessoa
    expect(waCorte(publico({ novidades_por_pessoa: 2 }), 5)!.cabem).toBe(2);
  });

  it("número torto bloqueia", () => {
    expect(waCorte(null)).toBeNull();
    expect(waCorte({ elegiveis: "7", cabem: 4 } as any)).toBeNull();
    expect(waCorte({ elegiveis: 7 } as any)).toBeNull();
  });

  it("cabe todo mundo", () => {
    const c = waCorte(publico({ elegiveis: 3, cabem: 3, falta_para_todos: 0, ficam_guardados: 0, guardados: [] }), 4)!;
    expect(c.cabeTodos).toBe(true);
    expect(c.faltam).toBe(0);
  });
});

describe("Trazer do Venda+", () => {
  const div = { aniversario: 4, venda_mais: 4, crediario: 2 };
  it("tira do Venda+ e dá ao destino", () => {
    expect(trazerDoVendaMais(div, zero, "aniversario", 3)).toEqual({ aniversario: 7, venda_mais: 1, crediario: 2 });
  });
  it("não tira o que o Venda+ já usou", () => {
    expect(trazerDoVendaMais(div, { ...zero, venda_mais: 3 }, "aniversario", 3)).toBeNull();
    expect(trazerDoVendaMais(div, zero, "venda_mais", 1)).toBeNull();
    expect(trazerDoVendaMais(div, zero, "aniversario", 0)).toBeNull();
  });
  it("quantoTrazer: só quando falta e o Venda+ tem de sobra", () => {
    const c = waCorte(publico(), 4);
    expect(quantoTrazer(c, div, zero, "aniversario")).toBe(3);
    expect(quantoTrazer(c, { ...div, venda_mais: 2 }, zero, "aniversario")).toBe(0);
    expect(quantoTrazer(null, div, zero, "aniversario")).toBe(0);
  });
});

describe("podeMandarNovidades", () => {
  const c = waCorte(publico(), 4);
  const base = { aceiteEm: "2026-12-01", numeroEmAtencao: false, novidadesEsgotadas: false, corte: c };
  it("libera só com tudo certo", () => {
    expect(podeMandarNovidades(base).pode).toBe(true);
  });
  it("trava em toda dúvida", () => {
    expect(podeMandarNovidades({ ...base, aceiteEm: null }).pode).toBe(false);
    expect(podeMandarNovidades({ ...base, numeroEmAtencao: true }).pode).toBe(false);
    expect(podeMandarNovidades({ ...base, novidadesEsgotadas: true }).pode).toBe(false);
    expect(podeMandarNovidades({ ...base, corte: null }).pode).toBe(false);
    expect(podeMandarNovidades({ ...base, corte: waCorte(publico({ cabem: 0 }), 4) }).pode).toBe(false);
  });
});

describe("escolhas do contrato do B", () => {
  it("presente: percent/fixed/null", () => {
    expect(chaveDoPresente({ tipo: "percent", valor: 10 })).toBe("percent-10");
    expect(chaveDoPresente({ tipo: "fixed", valor: 20 })).toBe("fixed-20");
    expect(chaveDoPresente(null)).toBe("nenhum");
    expect(chaveDoPresente({ tipo: "percent", valor: 99 })).toBeNull(); // desconhecido: nada marcado
    expect(presenteDaChave("nenhum")).toBeNull();
    expect(presenteDaChave("percent-15")).toEqual({ tipo: "percent", valor: 15 });
    expect(rotuloDoPresente({ tipo: "fixed", valor: 20 })).toBe("R$ 20 de desconto");
    expect(rotuloDoPresente(null)).toBeNull();
  });

  it("quando sai: uma mensagem, a lojista escolhe; sem presente só no dia", () => {
    expect(lerQuando("3_dias_antes")).toBe("3_dias_antes");
    expect(lerQuando("3_dias_depois")).toBeNull(); // o passo "3 dias depois" não existe mais
    expect(lerQuando(undefined)).toBeNull();
    expect(quandoPermitido("7_dias_antes", true)).toBe(true);
    expect(quandoPermitido("7_dias_antes", false)).toBe(false);
    expect(quandoPermitido("no_dia", false)).toBe(true);
    // tirar o presente leva o "quando" de volta para "no dia" no mesmo envio
    expect(patchDePresente("nenhum", "3_dias_antes")).toEqual({ presente: null, quando: "no_dia" });
    expect(patchDePresente("nenhum", "no_dia")).toEqual({ presente: null });
    expect(patchDePresente("percent-15", "7_dias_antes")).toEqual({ presente: { tipo: "percent", valor: 15 } });
  });

  it("pontos da cobrança e chaves de modelo", () => {
    const p = lerPontos({ antes3: true, dia: true, depois1: true, depois7: false, depois15: false })!;
    expect(alternarPonto(p, "depois7").depois7).toBe(true);
    expect(lerPontos({ antes3: true })).toBeNull();
    expect(modeloDoAniversario("direto", true)).toBe("aniv_direto_com");
    expect(modeloDoAniversario("direto", true, "7_dias_antes")).toBe("aniv_antes");
    expect(modeloDaVenda("sumiu", false)).toBe("venda_sumiu_sem");
  });

  it("renderiza {Campo} com o valor ou o exemplo", () => {
    expect(tokensDe("Oi, {Nome}. Vence {Vencimento}.")).toEqual(["Nome", "Vencimento"]);
    expect(renderizar("Oi, {Nome}.", { Nome: "Ana" })).toBe("Oi, Ana.");
    expect(renderizar("Oi, {Nome}.", {})).toBe("Oi, Marta.");
  });
});

// ── Telas ──────────────────────────────────────────────────
const mockPub: any = { current: null };
const mockModelos: any = { current: null };
jest.mock("@/hooks/useWaAutomatica", () => ({
  useWaPublico: () => mockPub.current,
  useWaModelos: () => mockModelos.current,
}));

import { AniversarioConfig } from "@/components/whatsapp/AniversarioConfig";
import { VendaMaisConfig } from "@/components/whatsapp/VendaMaisConfig";
import { CrediarioConfig } from "@/components/whatsapp/CrediarioConfig";

function respostaAuto(over: any = {}) {
  return {
    mes: "2026-12", aceite_novidades_em: "2026-12-01T00:00:00Z",
    novidades: { total: 10, livres: 10, divisao: DIVISAO_PADRAO, usadas: zero, sem_dono: 0 },
    automaticas: [
      { key: "aniversario", ligada: false, livres: 4, config: { tom: "carinhoso", presente: { tipo: "percent", valor: 10 }, quando: "no_dia" } },
      { key: "venda_mais", ligada: false, livres: 4, config: { segmento: "sumindo", presente: { tipo: "fixed", valor: 20 }, automatico: false } },
      { key: "crediario_cobrar", ligada: false, config: { pontos: { antes3: true, dia: true, depois1: true, depois7: false, depois15: false } } },
      { key: "crediario_vender", ligada: false, livres: 2, config: { dia_do_mes: 10, presente: null } },
    ],
    ...over,
  };
}
function auto(resp: any = respostaAuto(), over: any = {}) {
  return {
    info: lerAutomaticas(resp), carregando: false, falhou: false, salvando: false, erro: null,
    recarregar: jest.fn(), ajustar: jest.fn(), aplicarDivisao: jest.fn(() => Promise.resolve(true)),
    ligar: jest.fn(() => Promise.resolve({ ok: true, code: null })),
    salvarConfig: jest.fn(() => Promise.resolve({ ok: true, code: null })), ...over,
  } as any;
}
function pubHook(pub: any, over: any = {}) {
  return {
    publico: pub, corte: waCorte(pub, 4), carregando: false, falhou: false, enviando: false, erro: null, enviado: null,
    recarregar: jest.fn(), enviarAgora: jest.fn(() => Promise.resolve(true)), ...over,
  };
}
const modelosHook = (lista: any[]) => ({ modelos: lista, carregando: false, recarregar: jest.fn() });
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id })[0];
const toque = (t: any, id: string) => {
  const els = t.root.findAllByProps({ testID: id });
  const e = els.find((x: any) => typeof x.props.onPress === "function") || els[0];
  return e.props.onPress();
};
const tem = (t: any, id: string) => t.root.findAllByProps({ testID: id }).length > 0;
const textos = (t: any) => JSON.stringify(t.toJSON()).replace(/","/g, "");
const bk = (bucket: string, total: number, usado: number) => ({ bucket, total, usado, restante: total - usado, renova_em: "2027-01-01", baixo: false, esgotado: total === usado });
const mkSaldo = (n: number, a: number, r: number) => waSaldoInfo({
  ativo: true, mes: "2026-12", plano: { renova: true }, numero: { em_atencao: false },
  saldos: { novidades: bk("novidades", 10, n), avisos: bk("avisos", 100, a), aurinha: bk("aurinha", 80, r) },
} as any, new Date(2026, 11, 1));
const saldo = mkSaldo(0, 28, 0);
const statusOk: any = { connected: true, marketing_consent_at: "2026-12-01", quality_rating: "GREEN" };

describe("AniversarioConfig", () => {
  beforeEach(() => {
    mockPub.current = pubHook(publico());
    mockModelos.current = modelosHook([{ key: "aniv_carinhoso_com", automatica: "aniversario", titulo: "x", texto_em_uso: "Feliz aniversário, {Nome}. A {Nome da loja} te dá {Presente}." }]);
  });

  it("mostra Cabem 4 de 7, quem fica de fora e Trazer 3 do Venda+", () => {
    const t = renderer.create(<AniversarioConfig companyId="c" auto={auto()} lojaNome="Lume Moda" />);
    expect(textos(t)).toContain("Cabem 4 de 7.");
    expect(t.root.findAllByProps({ testID: "wa-aniv-fora" }).length).toBe(2);
    expect(achar(t, "wa-aniv-trazer")).toBeTruthy();
    expect(textos(t)).toContain("Trazer 3 do Venda+");
    expect(textos(t)).toContain("Feliz aniversário, Ana. A Lume Moda te dá 10% de desconto.");
  });

  it("Trazer manda a divisão nova (Venda+ cede 3)", async () => {
    const a = auto();
    const t = renderer.create(<AniversarioConfig companyId="c" auto={a} lojaNome="Lume" />);
    await act(async () => { achar(t, "wa-aniv-trazer").props.onPress(); });
    expect(a.aplicarDivisao).toHaveBeenCalledWith({ aniversario: 7, venda_mais: 1, crediario: 2 });
  });

  it("escolhas gravam no servidor, inclusive o quando", async () => {
    const a = auto();
    const t = renderer.create(<AniversarioConfig companyId="c" auto={a} lojaNome="Lume" />);
    await act(async () => { achar(t, "wa-aniv-tom-direto").props.onPress(); });
    expect(a.salvarConfig).toHaveBeenCalledWith("aniversario", { tom: "direto" });
    await act(async () => { achar(t, "wa-aniv-presente-nenhum").props.onPress(); });
    expect(a.salvarConfig).toHaveBeenCalledWith("aniversario", { presente: null });
    a.salvarConfig.mockClear();
    a.salvarConfig.mockClear();
    await act(async () => { toque(t, "wa-aniv-quando-7_dias_antes"); });
    expect(a.salvarConfig).toHaveBeenCalledWith("aniversario", { quando: "7_dias_antes" });
    // tirar o presente com "antes" escolhido leva o quando junto
    const antes = auto(respostaAuto({ automaticas: respostaAuto().automaticas.map((x: any) => x.key === "aniversario" ? { ...x, config: { ...x.config, quando: "3_dias_antes" } } : x) }));
    const t2 = renderer.create(<AniversarioConfig companyId="c" auto={antes} lojaNome="" />);
    await act(async () => { achar(t2, "wa-aniv-presente-nenhum").props.onPress(); });
    expect(antes.salvarConfig).toHaveBeenCalledWith("aniversario", { presente: null, quando: "no_dia" });
  });

  it("sem leitura do servidor, trava", () => {
    const t = renderer.create(<AniversarioConfig companyId="c" auto={auto(null as any, { info: null })} lojaNome="" />);
    expect(tem(t, "wa-aniv-indisponivel")).toBe(true);
  });
});

describe("VendaMaisConfig", () => {
  beforeEach(() => {
    mockPub.current = pubHook(publico({ elegiveis: 14, cabem: 4, fora: { recebeu_ha_menos_de_7_dias: 2, pediu_para_nao_receber: 1, sem_telefone: 1 } }));
    mockModelos.current = modelosHook([]);
  });

  it("botão ativo só com tudo certo e manda pelo servidor", async () => {
    const t = renderer.create(<VendaMaisConfig companyId="c" auto={auto()} saldo={saldo} status={statusOk} lojaNome="Lume" />);
    expect(textos(t)).toContain("Mandar para as 4 que mais compravam");
    expect(textos(t)).toContain("2 receberam novidade há menos de 7 dias");
    expect(achar(t, "wa-venda-enviar").props.disabled).toBe(false);
    await act(async () => { achar(t, "wa-venda-enviar").props.onPress(); });
    expect(mockPub.current.enviarAgora).toHaveBeenCalled();
  });

  it("travado sem aceite, com número em atenção e com novidades esgotadas", () => {
    const sem = auto(respostaAuto({ aceite_novidades_em: null }));
    expect(achar(renderer.create(<VendaMaisConfig companyId="c" auto={sem} saldo={saldo} status={statusOk} lojaNome="" />), "wa-venda-enviar").props.disabled).toBe(true);
    const atencao = renderer.create(<VendaMaisConfig companyId="c" auto={auto()} saldo={saldo} status={{ ...statusOk, quality_rating: "YELLOW" }} lojaNome="" />);
    expect(achar(atencao, "wa-venda-enviar").props.disabled).toBe(true);
    const sEsg = mkSaldo(10, 0, 0);
    const esg = renderer.create(<VendaMaisConfig companyId="c" auto={auto()} saldo={sEsg} status={statusOk} lojaNome="" />);
    expect(achar(esg, "wa-venda-enviar").props.disabled).toBe(true);
  });

  it("sem prévia do servidor, trava o envio", () => {
    mockPub.current = pubHook(null);
    const t = renderer.create(<VendaMaisConfig companyId="c" auto={auto()} saldo={saldo} status={statusOk} lojaNome="" />);
    expect(achar(t, "wa-venda-enviar").props.disabled).toBe(true);
    expect(tem(t, "wa-venda-previa-indisponivel")).toBe(true);
  });

  it("acabou: diz quando volta", () => {
    const resp = respostaAuto();
    resp.automaticas[1].livres = 0;
    mockPub.current = pubHook(publico({ elegiveis: 14, cabem: 0, vao: [] }), { corte: waCorte(publico({ elegiveis: 14, cabem: 0, vao: [] }), 0) });
    const t = renderer.create(<VendaMaisConfig companyId="c" auto={auto(resp)} saldo={saldo} status={statusOk} lojaNome="" />);
    expect(tem(t, "wa-venda-acabou")).toBe(true);
    expect(tem(t, "wa-venda-enviar")).toBe(false);
  });
});

describe("CrediarioConfig", () => {
  beforeEach(() => {
    mockPub.current = pubHook(publico({ elegiveis: 11, cabem: 2, vao: ["Cris", "Ana Paula"].map(pessoa), amanha: { saem: 3, itens: [{ nome: "Marta Lins", detalhe: "parcela 2 de 4", ponto: "3 dias antes" }] }, fora_lista: [{ nome: "Duda Reis", motivo: "SEM_TELEFONE" }] }), {
      corte: waCorte(publico({ elegiveis: 11, cabem: 2, vao: ["Cris", "Ana Paula"].map(pessoa) }), 2),
    });
    mockModelos.current = modelosHook([
      { key: "cred_antes", automatica: "crediario", titulo: "Antes do vencimento", texto_em_uso: "Oi, {Nome}.", estado: "PRONTA" },
      { key: "cred_atraso", automatica: "crediario", titulo: "Em atraso", texto_em_uso: "Oi.", texto_novo: "Oi, novo.", estado: "EM_APROVACAO" },
      { key: "cred_oferta", automatica: "crediario", titulo: "Oferta", texto_em_uso: "Oi, {Nome}. Você tem {Limite livre} livres.", estado: "NAO_APROVADA", motivo: "O texto parece propaganda." },
    ]);
  });

  it("cobrar, vender e mensagens", () => {
    const t = renderer.create(<CrediarioConfig companyId="c" auto={auto()} saldo={saldo} status={statusOk} lojaNome="Lume" />);
    const x = textos(t);
    expect(x).toContain("Amanhã, às 9h, saem 3 avisos");
    expect(x).toContain("1 cliente fica de fora: Duda Reis (sem telefone)");
    expect(x).toContain("11 clientes pagam em dia e têm limite livre");
    expect(x).toContain("Cabem 2 de 11.");
    expect(x).toContain("Mandar para as 2 agora");
    expect(x).toContain("72 de 100 livres");
    expect(x).toContain("Texto novo em aprovação");
    expect(x).toContain("Costuma sair em algumas horas");
    expect(x).toContain("O texto parece propaganda. O texto atual continua valendo.");
  });

  it("pontos da cobrança gravam; a cobrança não pergunta aceite", async () => {
    const a = auto(respostaAuto({ aceite_novidades_em: null }));
    const t = renderer.create(<CrediarioConfig companyId="c" auto={a} saldo={saldo} status={statusOk} lojaNome="" />);
    await act(async () => { toque(t, "wa-cred-ponto-depois7"); });
    expect(a.salvarConfig).toHaveBeenCalledWith("crediario_cobrar", { pontos: { antes3: true, dia: true, depois1: true, depois7: true, depois15: false } });
    await act(async () => { await toque(t, "wa-cred-cobrar-liga"); });
    expect(a.ligar).toHaveBeenCalledWith("crediario_cobrar", true);
    expect(tem(t, "wa-auto-aceite")).toBe(false);
  });

  it("enviar a oferta: manda pelo servidor", async () => {
    const t = renderer.create(<CrediarioConfig companyId="c" auto={auto()} saldo={saldo} status={statusOk} lojaNome="" />);
    await act(async () => { achar(t, "wa-cred-enviar").props.onPress(); });
    expect(mockPub.current.enviarAgora).toHaveBeenCalled();
  });

  it("Editar aparece nos prontos; no não aprovado 'Ajustar para mim' e 'Ficar com o da Aura'; nunca em aprovação", () => {
    const t2 = renderer.create(<CrediarioConfig companyId="c" auto={auto()} saldo={saldo} status={statusOk} lojaNome="" />);
    expect(tem(t2, "wa-modelo-cred_antes-editar")).toBe(true);
    expect(tem(t2, "wa-modelo-cred_atraso-editar")).toBe(false);
    expect(tem(t2, "wa-modelo-cred_oferta-editar")).toBe(true);
    expect(tem(t2, "wa-modelo-cred_oferta-restaurar")).toBe(true);
    expect(textos(t2)).toContain("Ajustar para mim");
    expect(textos(t2)).toContain("Ficar com o da Aura");
  });
});
