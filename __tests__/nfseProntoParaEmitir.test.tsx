// ============================================================
// "Pronto para emitir NFS-e?" (10/11/2026)
// Mockup aprovado: docs/mockups/nfse-configuracao-loja.html; contratos do
// backend: PR "configuração da loja passo a passo" (migration 441).
//
// O que estes testes seguram:
//   1. regras: 7 passos do backend → 4 cartões; prefeitura só com aviso do
//      gov.br; resumo por loja; Série/Número da DPS de quem já emite;
//   2. a tela: abre o próximo passo; E0084 mostra a prefeitura com o código;
//      loja pronta e produção travada mostra o aviso da Aura e trava a chave;
//      salvar os dados manda os nomes do leiaute; nota de teste chama a rota
//      com chave própria; a Alíquota do ISSQN retido nunca vem preenchida;
//   3. a aba: emissão avulsa travada até emitir; "Todas as lojas" no grupo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/components/screens/nfe/EmitNfseForm", () => ({ EmitNfseForm: () => "FORM-AVULSO" }));

// useQuery responde pela chave; cada teste escolhe as respostas.
let mockRespostas: Record<string, any> = {};
const mockRefetch = jest.fn().mockResolvedValue({});
jest.mock("@tanstack/react-query", () => ({
  useQuery: (o: any) => {
    const k = o.queryKey[0] + ":" + (o.queryKey[1] ?? "");
    const data = o.enabled === false ? undefined : mockRespostas[k];
    return { data, isLoading: false, isError: false, refetch: mockRefetch };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
let mockAuth: any = { company: { id: "c1", trade_name: "Lume Estética", cnpj: "11222333000181" }, availableCompanies: [], switchCompany: jest.fn() };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));
jest.mock("@/hooks/useListaServicosNfse", () => {
  const m = jest.requireActual("@/constants/nfseListaServicos");
  const lista = { linhas: m.LISTA_SERVICOS_NACIONAL, itens: m.ITENS_DA_LISTA };
  return { carregarListaServicosNfse: () => Promise.resolve(lista), useListaServicosNfse: () => ({ lista, erro: false }) };
});

import { ProntoParaEmitirNfse } from "@/components/nfse/ProntoParaEmitirNfse";
import { AbaEmitirNfse } from "@/components/screens/nfe/AbaEmitirNfse";
import {
  estadosDosCartoes, lerPercentual, prefeituraVisivel, problemaDaSerie, proximoCartao, resumoDaLoja,
  serieENumero, situacaoDe, type SituacaoNfse,
} from "@/utils/nfseProntoParaEmitir";

// ── fábrica de situações (forma do backend) ──────────────────
const P = (estado: string, motivo = "motivo " + estado, extra: any = {}) => ({ estado, motivo, ...extra });
function situacao(over: Partial<Record<string, any>> = {}, raiz: any = {}): SituacaoNfse {
  return {
    passos: {
      certificado: P("ok", "Certificado digital A1 enviado.", { vale_ate: "2027-08-12T00:00:00Z" }),
      prefeitura: P("falta"),
      dados_fiscais: P("falta", "Confira o município e a Situação perante o Simples Nacional."),
      codigo_padrao: P("falta"),
      serie: P("falta"),
      teste: P("travado", "Libera quando o certificado e os dados da nota estiverem prontos."),
      ligar: P("travado", "Libera depois que a nota de teste passar."),
      ...over,
    } as any,
    producao_liberada: false,
    sugestao: { cnpj: "11222333000181", nome: "Lume Estética", municipio: "Jacareí", uf: "SP", municipio_ibge: "3524402", op_simp_nac: 3, reg_ap_trib_sn: 1 },
    ...raiz,
  };
}
const BASE_OK = { dados_fiscais: P("ok"), codigo_padrao: P("ok"), serie: P("ok", "Série 1", { serie: "1", proximo_numero: "1" }) };

function texto(tree: any): string { return JSON.stringify(tree.toJSON()); }
function porId(tree: any, id: string): any { return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false })[0]; }
function tem(tree: any, id: string): boolean { return tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false }).length > 0; }
function textoDe(node: any): string {
  return node.findAllByType(Text).map((t: any) => { const c = t.props.children; return Array.isArray(c) ? c.join("") : String(c ?? ""); }).join(" ");
}
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  return tree;
}
const montarPronto = () => montar(
  <ProntoParaEmitirNfse companyId="c1" nomeLoja="Lume Estética" ehLojaAtual onIrParaCertificado={jest.fn()} />
);

beforeEach(() => {
  mockRequest.mockReset();
  mockRespostas = { "nfse-automatica-config:c1": { ligada_no_servidor: true, emissao_automatica: false } };
});

// ── 1. regras ────────────────────────────────────────────────
describe("regras do passo a passo", () => {
  test("7 passos do backend viram 4 cartões; dados junta município, código e série", () => {
    const s = situacao({ dados_fiscais: P("ok"), codigo_padrao: P("ok"), serie: P("falta") });
    expect(estadosDosCartoes(s)).toEqual({ certificado: "ok", dados: "falta", teste: "travado", ligar: "travado" });
    expect(proximoCartao(estadosDosCartoes(s))).toBe("dados");
    expect(estadosDosCartoes(situacao({ ...BASE_OK, codigo_padrao: P("problema") })).dados).toBe("problema");
  });

  test("a prefeitura só aparece com aviso do gov.br (passo em problema)", () => {
    expect(prefeituraVisivel(situacao())).toBe(false);
    expect(prefeituraVisivel(situacao({ prefeitura: P("problema", "x", { codigo: "E0084" }) }))).toBe(true);
  });

  test("resumo por loja: emitindo, aguardando a Aura, E0084, certificado de outro CNPJ, faltando", () => {
    expect(resumoDaLoja(situacao({ ligar: P("ok") }, { emitindo: true }), true)).toEqual({ tom: "ok", texto: "Emitindo · automática" });
    expect(resumoDaLoja(situacao({ ligar: P("travado", "x", { aguardando_aura: true }) })).texto).toMatch(/Aura está liberando/);
    expect(resumoDaLoja(situacao({ prefeitura: P("problema", "x", { codigo: "E0084" }) }))).toEqual({ tom: "erro", texto: "A prefeitura ainda não liberou (E0084)" });
    expect(resumoDaLoja(situacao({ certificado: P("problema", "x", { cnpj_do_certificado: "11444777000161" }) })).texto).toBe("Certificado de outro CNPJ");
    expect(resumoDaLoja(situacao()).texto).toBe("Faltam 3 passos");
    expect(JSON.stringify(resumoDaLoja(situacao({ prefeitura: P("problema") })))).not.toMatch(/não atendid/i);
  });

  test("situação vem de config.nacional ou da raiz (loja sem config)", () => {
    const s = situacao();
    expect(situacaoDe({ config: { nacional: s } })).toBe(s);
    expect(situacaoDe({ config: null, has_config: false, nacional: s })).toBe(s);
  });

  test("Série/Número da DPS de quem já emite pelo Emissor Nacional (faixas do Anexo I)", () => {
    const base = { serie: "", ultimo: "", continuaNoOutro: false, serieDaAura: "" };
    expect(serieENumero("", base)).toHaveProperty("erro");
    expect(serieENumero("nao", base)).toEqual({ serie: "1" });
    expect(serieENumero("gov", base)).toEqual({ serie: "1" }); // site/app do gov.br: outra faixa
    expect(serieENumero("outro", { ...base, serie: "1", ultimo: "212" })).toEqual({ serie: "1", next_dps_number: 213 });
    expect(serieENumero("outro", { ...base, serie: "1", ultimo: "" })).toHaveProperty("erro");
    expect(serieENumero("outro", { ...base, serie: "1", continuaNoOutro: true, serieDaAura: "1" })).toHaveProperty("erro");
    expect(serieENumero("outro", { ...base, serie: "1", continuaNoOutro: true, serieDaAura: "2" })).toEqual({ serie: "2" });
    expect(problemaDaSerie("70001")).toMatch(/site ou do app do gov\.br/);
    expect(problemaDaSerie("49999")).toMatch(/reservada/);
    expect(problemaDaSerie("900")).toBeNull();
  });

  test("percentual digitado com vírgula", () => {
    expect(lerPercentual("6,54")).toBe(6.54);
    expect(lerPercentual("2.79%")).toBe(2.79);
    expect(lerPercentual("")).toBeNull();
    expect(lerPercentual("abc")).toBeNull();
  });
});

// ── 2. a tela de uma loja ────────────────────────────────────
describe("ProntoParaEmitirNfse", () => {
  test("tudo pendente: 4 cartões, abre \"Dados da nota\", sem prefeitura e sem \"não atendido\"", async () => {
    mockRespostas["nfse-config:c1"] = { config: null, has_config: false, nacional: situacao() };
    const tree = await montarPronto();
    for (const c of ["certificado", "dados", "teste", "ligar"]) expect(tem(tree, "nfse-pronto-cartao-" + c)).toBe(true);
    expect(textoDe(porId(tree, "nfse-pronto-progresso"))).toMatch(/1 de 4 prontos/);
    expect(tem(tree, "nfse-pronto-salvar-dados")).toBe(true); // "Dados da nota" aberto
    expect(tem(tree, "nfse-pronto-prefeitura")).toBe(false);
    const t = texto(tree);
    for (const rot of ["Situação perante o Simples Nacional", "Código de Tributação Nacional", "Já emite NFS-e pelo Emissor Nacional?", "Optante - ME/EPP", "pela Receita"]) {
      expect(t).toContain(rot);
    }
    expect(t).toContain("Em caso de dúvidas, acione seu contador ou o suporte Aura");
    expect(t).toContain("11 95630-5269");
    expect(t).not.toMatch(/não atendid/i);
  });

  test("salvar os dados: nomes do leiaute, provider nacional, série confirmada", async () => {
    mockRespostas["nfse-config:c1"] = { config: null, has_config: false, nacional: situacao() };
    mockRequest.mockResolvedValue({ ok: true });
    const tree = await montarPronto();
    act(() => { porId(tree, "nfse-padrao-codigo").props.onChangeText("06.02.01"); });
    act(() => { porId(tree, "nfse-pronto-ja-gov").props.onPress(); });
    expect(tem(tree, "nfse-pronto-serie-gov")).toBe(true);
    act(() => { porId(tree, "nfse-pronto-conferi").props.onPress(); });
    await act(async () => { porId(tree, "nfse-pronto-salvar-dados").props.onPress(); });
    const [url, opts] = mockRequest.mock.calls[0];
    expect(url).toBe("/companies/c1/nfse/config");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toMatchObject({
      provider: "nacional", municipio_ibge: "3524402", op_simp_nac: 3, reg_ap_trib_sn: 1,
      ctribnac_padrao: "060201", cnbs_padrao: null, serie: "1", serie_confirmada: true,
    });
    expect(opts.body.next_dps_number).toBeUndefined();
  });

  test("sem conferir e sem código: não salva e mostra o que falta", async () => {
    mockRespostas["nfse-config:c1"] = { config: null, has_config: false, nacional: situacao() };
    const tree = await montarPronto();
    await act(async () => { porId(tree, "nfse-pronto-salvar-dados").props.onPress(); });
    expect(mockRequest).not.toHaveBeenCalled();
    const t = texto(tree);
    expect(t).toContain("Marque a confirmação para seguir.");
    expect(t).toContain("Escolha um Código de Tributação Nacional");
  });

  test("E0084: abre a nota de teste com a explicação da prefeitura e o código pequeno", async () => {
    mockRespostas["nfse-config:c1"] = {
      config: { provider: "nacional", municipio_ibge: "3524402", op_simp_nac: 3, ctribnac_padrao: "060201", ultimo_teste_status: "rejeitado", ultimo_teste_codigo: "E0084" },
      has_config: true,
      nacional: situacao({
        ...BASE_OK,
        prefeitura: P("problema", "A prefeitura ainda não liberou a sua empresa no Emissor Nacional.", { codigo: "E0084" }),
        teste: P("problema", "Quase lá: a prefeitura de Jacareí ainda não liberou a sua empresa no Emissor Nacional.", { codigo: "E0084", em: "2026-11-10T13:00:00Z" }),
      }),
    };
    const tree = await montarPronto();
    expect(tem(tree, "nfse-pronto-prefeitura")).toBe(true);
    expect(textoDe(porId(tree, "nfse-pronto-codigo-aviso"))).toMatch(/E0084/);
    const t = texto(tree);
    expect(t).toContain("Cadastro Nacional de Contribuintes da NFS-e");
    expect(t).toContain("Inscrição Municipal");
    expect(t).toContain("A prefeitura já fez? Testar de novo");
    expect(t).not.toMatch(/não atendid/i);
  });

  test("nota de teste: POST /nfse/teste com chave própria; o mesmo clique depois de \"sem resposta\" reusa a chave", async () => {
    mockRespostas["nfse-config:c1"] = { config: { provider: "nacional" }, has_config: true, nacional: situacao({ ...BASE_OK, teste: P("falta") }) };
    mockRequest.mockResolvedValue({ resultado: { status: "erro", passo: "teste", codigo: null, titulo: "Não conseguimos resposta do gov.br agora.", mensagem: "", caminho: [], aguardando: true }, nota: null });
    const tree = await montarPronto();
    expect(tem(tree, "nfse-pronto-emitir-teste")).toBe(true); // o cartão do teste abriu sozinho
    await act(async () => { porId(tree, "nfse-pronto-emitir-teste").props.onPress(); });
    await act(async () => { porId(tree, "nfse-pronto-emitir-teste").props.onPress(); });
    const testes = mockRequest.mock.calls.filter((c) => c[0] === "/companies/c1/nfse/teste");
    expect(testes).toHaveLength(2);
    expect(testes[0][1]).toMatchObject({ method: "POST" });
    expect(testes[0][1].body.idempotency_key).toMatch(/^app-/);
    expect(testes[1][1].body.idempotency_key).toBe(testes[0][1].body.idempotency_key);
  });

  test("loja pronta e produção travada: aviso da Aura e a chave \"Emitir NFS-e\" travada", async () => {
    mockRespostas["nfse-config:c1"] = {
      config: { provider: "nacional", op_simp_nac: 3, p_tot_trib_sn: 6.54, cliente_retem_iss: false, ultimo_teste_status: "ok" },
      has_config: true,
      nacional: situacao({ ...BASE_OK, prefeitura: P("ok"), teste: P("ok"), ligar: P("travado", "Sua loja está pronta!", { aguardando_aura: true }) }, { pronta_para_ligar: true, producao_liberada: false }),
    };
    const tree = await montarPronto();
    expect(tem(tree, "nfse-pronto-banner-aura")).toBe(true);
    act(() => { porId(tree, "nfse-pronto-abrir-ligar").props.onPress(); });
    expect(porId(tree, "nfse-pronto-chave-ativo").props.disabled).toBe(true);
    expect(porId(tree, "nfse-pronto-chave-auto").props.disabled).toBe(true);
    expect(porId(tree, "nfse-pronto-ptot").props.value).toBe("6,54");
  });

  test("Retenção do ISSQN: a Alíquota aparece só com \"Sim\" e nunca vem preenchida", async () => {
    mockRespostas["nfse-config:c1"] = {
      config: { provider: "nacional", op_simp_nac: 3, default_iss_rate: 2, ultimo_teste_status: "ok" } as any,
      has_config: true,
      nacional: situacao({ ...BASE_OK, teste: P("ok"), ligar: P("falta", "Preencha a alíquota do Simples Nacional") }, { producao_liberada: true }),
    };
    mockRequest.mockResolvedValue({ ok: true });
    const tree = await montarPronto(); // abre sozinho no "Ligar" (o próximo que falta)
    expect(tem(tree, "nfse-pronto-aliq")).toBe(false);
    act(() => { porId(tree, "nfse-pronto-retem-sim").props.onPress(); });
    expect(porId(tree, "nfse-pronto-aliq").props.value).toBe("");
    act(() => { porId(tree, "nfse-pronto-ptot").props.onChangeText("6,54"); });
    act(() => { porId(tree, "nfse-pronto-aliq").props.onChangeText("2,79"); });
    await act(async () => { porId(tree, "nfse-pronto-salvar-simples").props.onPress(); });
    expect(mockRequest.mock.calls[0][1].body).toMatchObject({ provider: "nacional", p_tot_trib_sn: 6.54, cliente_retem_iss: true, aliquota_iss_retencao_sn: 2.79 });
  });

  test("ligar: PUT com is_active e ambiente produção", async () => {
    mockRespostas["nfse-config:c1"] = {
      config: { provider: "nacional", op_simp_nac: 2, ultimo_teste_status: "ok" },
      has_config: true,
      nacional: situacao({ ...BASE_OK, teste: P("ok"), ligar: P("falta", "Falta só ligar a NFS-e.") }, { pronta_para_ligar: true, producao_liberada: true }),
    };
    mockRequest.mockResolvedValue({ ok: true });
    const tree = await montarPronto();
    expect(porId(tree, "nfse-pronto-chave-ativo").props.disabled).toBe(false); // abriu no "Ligar"
    await act(async () => { porId(tree, "nfse-pronto-chave-ativo").props.onPress(); });
    expect(mockRequest.mock.calls[0][1].body).toMatchObject({ provider: "nacional", is_active: true, ambiente: "producao" });
  });

  test("emitindo: \"Sua loja já emite NFS-e\"", async () => {
    mockRespostas["nfse-config:c1"] = {
      config: { provider: "nacional", is_active: true, ambiente: "producao" },
      has_config: true,
      nacional: situacao({ ...BASE_OK, prefeitura: P("ok"), teste: P("ok"), ligar: P("ok") }, { emitindo: true, producao_liberada: true }),
    };
    const tree = await montarPronto();
    expect(texto(tree)).toContain("Sua loja já emite NFS-e");
  });
});

// ── 3. a aba ─────────────────────────────────────────────────
describe("AbaEmitirNfse", () => {
  test("loja sem NFS-e ligada: emissão avulsa travada embaixo", async () => {
    mockAuth = { ...mockAuth, availableCompanies: [] };
    mockRespostas["nfse-config:c1"] = { config: null, has_config: false, nacional: situacao() };
    const tree = await montar(<AbaEmitirNfse companyId="c1" onIrParaCertificado={jest.fn()} />);
    expect(tem(tree, "nfse-avulsa-travada")).toBe(true);
    expect(texto(tree)).not.toContain("FORM-AVULSO");
  });

  test("loja emitindo: o formulário avulso de hoje aparece", async () => {
    mockAuth = { ...mockAuth, availableCompanies: [] };
    mockRespostas["nfse-config:c1"] = { config: { is_active: true, ambiente: "producao" }, has_config: true, nacional: situacao({ ligar: P("ok") }, { emitindo: true }) };
    const tree = await montar(<AbaEmitirNfse companyId="c1" onIrParaCertificado={jest.fn()} />);
    expect(tem(tree, "nfse-avulsa-travada")).toBe(false);
    expect(texto(tree)).toContain("FORM-AVULSO");
  });

  test("grupo: seletor de loja e \"Todas as lojas\" com o estado de cada uma", async () => {
    mockAuth = {
      ...mockAuth,
      availableCompanies: [
        { id: "c1", trade_name: "Lume — Centro", cnpj: "11222333000181" },
        { id: "c2", trade_name: "Lume — Jacareí", cnpj: "11222333000262" },
      ],
    };
    mockRespostas["nfse-config:c1"] = { config: { is_active: true, ambiente: "producao" }, has_config: true, nacional: situacao({ ligar: P("ok") }, { emitindo: true }) };
    mockRespostas["nfse-lojas-do-grupo:c1,c2"] = [
      { id: "c1", nome: "Lume — Centro", cnpj: "11222333000181", automatica: true, erro: false, resposta: mockRespostas["nfse-config:c1"] },
      { id: "c2", nome: "Lume — Jacareí", cnpj: "11222333000262", automatica: false, erro: false, resposta: { config: null, nacional: situacao({ prefeitura: P("problema", "x", { codigo: "E0084" }) }) } },
    ];
    mockRespostas["nfse-config:c2"] = mockRespostas["nfse-lojas-do-grupo:c1,c2"][1].resposta;
    const tree = await montar(<AbaEmitirNfse companyId="c1" onIrParaCertificado={jest.fn()} />);
    expect(tem(tree, "nfse-seletor-loja")).toBe(true);
    act(() => { porId(tree, "nfse-loja-todas").props.onPress(); });
    expect(tem(tree, "nfse-visao-grupo")).toBe(true);
    expect(textoDe(porId(tree, "nfse-grupo-estado-c1"))).toBe("Emitindo · automática");
    expect(textoDe(porId(tree, "nfse-grupo-estado-c2"))).toBe("A prefeitura ainda não liberou (E0084)");
    act(() => { porId(tree, "nfse-grupo-abrir-c2").props.onPress(); });
    expect(tem(tree, "nfse-pronto")).toBe(true);
    expect(tem(tree, "nfse-avulsa-travada")).toBe(false); // avulsa só na loja do login
  });
});
