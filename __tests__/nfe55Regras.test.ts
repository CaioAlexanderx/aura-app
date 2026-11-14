// ============================================================
// NF-e 55 de venda — regras do assistente (utils/nfe55.ts, CP4).
// Faltantes → campo e passo; resposta/erro da emissão → texto da tela;
// NFC-e ou NF-e na venda concluída; espera da emissão automática.
// Dados fictícios.
// ============================================================
import {
  formDaPrevia, corpoDoForm, campoDoFaltante, passoDoFaltante, faltantesPorCampo, faltantesDosItens,
  resumoDosFaltantes, lerErroDaEmissao, lerRespostaDaEmissao, notaSugerida, automaticaEspera,
  fmtDocumento, fmtChave, rotuloDaIe,
} from "@/utils/nfe55";
import type { Previa } from "@/services/nfe55Api";

const PREVIA: Previa = {
  pode_emitir: false,
  bloqueio: null,
  faltantes: [
    { campo: "destinatario.endereco.cep", mensagem: "CEP do endereço do cliente", tipo: "faltando" },
    { campo: "destinatario.ie", mensagem: "A inscrição estadual (IE) do cliente não confere.", tipo: "invalido" },
    { campo: "itens[1].ncm", mensagem: 'NCM do produto "Fita"', tipo: "faltando", product_id: "p2" },
  ],
  nota_existente: null,
  nota_pendente: null,
  ambiente: "homologacao",
  destinatario: {
    documento: "11444777000161", nome: "Construtora Ficticia", ie: "110042490114", ind_ie_dest: 1, email: "compras@exemplo.com",
    endereco: { cep: null, logradouro: "Av. Central", numero: "200", complemento: null, bairro: "Centro", municipio: "Campinas", uf: "sp", codigo_municipio_ibge: null },
    origem: { cadastro: true, ibge: null }, customer_id: "c1",
  },
  operacao: { natureza_operacao: "Venda de mercadoria", uf_emitente: "SP", uf_destino: "SP", id_dest: 1, ind_final: 0, ind_ie_dest: 1, ind_pres: 1 },
  frete: { modalidade: 9, transportadora: null },
};

describe("formulário ↔ corpo", () => {
  it("formDaPrevia pré-preenche do cadastro (UF em maiúscula, salvar ligado quando há cliente)", () => {
    const f = formDaPrevia(PREVIA);
    expect(f).toMatchObject({ documento: "11444777000161", indIeDest: 1, ie: "110042490114", uf: "SP", modFrete: 9, salvarNoCadastro: true, naturezaOperacao: "Venda de mercadoria" });
    expect(formDaPrevia(null)).toMatchObject({ indIeDest: 9, modFrete: 9, salvarNoCadastro: false });
  });

  it("corpoDoForm: só dígitos no documento/CEP, IE só para contribuinte, ISENTO para isenta, vazio não vai", () => {
    const f = { ...formDaPrevia(PREVIA), documento: "11.444.777/0001-61", cep: "13010-000", observacoes: "  " };
    const c = corpoDoForm(f);
    expect(c.destinatario).toMatchObject({ documento: "11444777000161", ind_ie_dest: 1, ie: "110042490114" });
    expect(c.destinatario!.endereco).toMatchObject({ cep: "13010000", uf: "SP" });
    expect(c.destinatario!.endereco!.complemento).toBeUndefined();
    expect(c.observacoes).toBeUndefined();
    expect(c.frete).toEqual({ modalidade: 9 });
    expect(corpoDoForm({ ...f, indIeDest: 2 }).destinatario!.ie).toBe("ISENTO");
    expect(corpoDoForm({ ...f, indIeDest: 9 }).destinatario!.ie).toBeUndefined();
    expect(corpoDoForm({ ...f, modFrete: 1, transportadoraNome: "Transp", transportadoraDocumento: "11.444.777/0001-61" }).frete)
      .toEqual({ modalidade: 1, transportadora: { documento: "11444777000161", nome: "Transp" } });
  });
});

describe("faltantes", () => {
  it("campo e passo de cada faltante do backend", () => {
    expect(campoDoFaltante("destinatario.endereco.codigo_municipio_ibge")).toBe("codigoMunicipioIbge");
    expect(campoDoFaltante("destinatario.documento")).toBe("documento");
    expect(campoDoFaltante("itens[3].ncm")).toBe("itens");
    expect(campoDoFaltante("frete.transportadora.documento")).toBe("transportadoraDocumento");
    expect(campoDoFaltante("desconhecido")).toBeNull();
    expect(passoDoFaltante("destinatario.ie")).toBe(1);
    expect(passoDoFaltante("itens[0].ncm")).toBe(2);
    expect(passoDoFaltante("frete.modalidade")).toBe(2);
  });

  it("mapa por campo (amarelo), itens à parte e resumo do rodapé por passo", () => {
    const m = faltantesPorCampo(PREVIA.faltantes);
    expect(Object.keys(m).sort()).toEqual(["cep", "ie", "itens"]);
    expect(m.ie!.tipo).toBe("invalido");
    expect(faltantesDosItens(PREVIA.faltantes)).toHaveLength(1);
    expect(resumoDosFaltantes(PREVIA.faltantes, 1)).toBe("Faltam 2 informações (marcadas em amarelo)");
    expect(resumoDosFaltantes(PREVIA.faltantes, 2)).toBe('Falta 1 informação: NCM do produto "Fita"');
    expect(resumoDosFaltantes([], 1)).toBe("");
  });
});

describe("resposta e erro da emissão → tela", () => {
  const base = { nfe: { id: "e1", numero: 15, serie: 2, status: "autorizada", chave_acesso: "1", protocolo: "p" }, chave_acesso: "1", protocolo: "p", numero: 15, serie: 2, cStat: "100", motivo: null, ambiente: "homologacao" } as any;

  it("201 autorizada → pronto; 202 (processando/erro) → aguardando, com o aviso de mesmo número", () => {
    expect(lerRespostaDaEmissao({ ...base, status: "autorizada" }).tipo).toBe("pronto");
    const t = lerRespostaDaEmissao({ ...base, status: "processando", error: "A SEFAZ nao respondeu a tempo." });
    expect(t.tipo).toBe("aguardando");
    expect((t as any).texto).toMatch(/mesmo número/);
  });

  it("409 → conflito com a nota existente", () => {
    const t = lerErroDaEmissao({ status: 409, data: { code: "NOTA_DE_PRODUTOS_JA_EXISTE", error: "Esta venda já tem NFC-e.", nota: { id: "n", tipo: "nfce", numero: 1, serie: 1, status: "autorizada", chave_acesso: null } } });
    expect(t).toMatchObject({ tipo: "conflito", titulo: "Esta venda já tem nota fiscal", texto: "Esta venda já tem NFC-e." });
  });

  it("422 faltantes → volta ao passo do primeiro faltante do cliente", () => {
    const t = lerErroDaEmissao({ status: 422, data: { code: "NFE_DADOS_FALTANTES", error: "Faltam alguns dados", faltantes: PREVIA.faltantes } });
    expect(t).toMatchObject({ tipo: "faltantes", passo: 1 });
    const s = lerErroDaEmissao({ status: 422, data: { code: "NFE_DADOS_FALTANTES", faltantes: [PREVIA.faltantes[2]] } });
    expect(s).toMatchObject({ tipo: "faltantes", passo: 2 });
  });

  it("422 rejeitada → título e ação do catálogo, detalhe técnico recolhido", () => {
    const t = lerErroDaEmissao({ status: 422, data: {
      code: "NFE_REJEITADA", cStat: "778", motivo: "Informado NCM inexistente",
      rejeicao_amigavel: { cStat: "778", titulo: "NCM do produto não existe na tabela do governo", acao: "Abra o cadastro do produto e corrija o NCM.", quem: "config", conhecida: true },
    } });
    expect(t).toMatchObject({
      tipo: "rejeicao",
      titulo: "A Sefaz não aceitou a nota, e dá para resolver",
      texto: "NCM do produto não existe na tabela do governo. A venda segue registrada e nada foi cobrado de novo.",
      acao: "Abra o cadastro do produto e corrija o NCM.",
      tecnico: "cStat 778 · Informado NCM inexistente",
      quem: "config",
    });
  });

  it("422 de bloqueio com título humano por código; 503 aguardando; rede aguardando; 502 erro", () => {
    expect(lerErroDaEmissao({ status: 422, data: { code: "NFE_REGIME_NORMAL_FORA_DO_V1", error: "Ainda não emitimos..." } }))
      .toMatchObject({ tipo: "bloqueio", titulo: "Ainda não emitimos NF-e para o regime normal", texto: "Ainda não emitimos..." });
    expect((lerErroDaEmissao({ status: 422, data: { code: "NFE_DIFAL_FORA_DO_V1", error: "x" } }) as any).titulo).toMatch(/cálculo que ainda não fazemos/);
    expect((lerErroDaEmissao({ status: 422, data: { code: "OUTRO", error: "x" } }) as any).titulo).toBe("Não dá para emitir esta NF-e");
    expect(lerErroDaEmissao({ status: 503, data: { code: "NFE_SEFAZ_SEM_RESPOSTA", error: "Ainda sem resposta" } }).tipo).toBe("aguardando");
    expect(lerErroDaEmissao({ status: 0, isNetworkError: true }).tipo).toBe("aguardando");
    expect(lerErroDaEmissao({ status: 502, data: { code: "NFE_ERRO_ENVIO", error: "Certificado" } }).tipo).toBe("erro");
  });
});

describe("venda concluída: NFC-e ou NF-e", () => {
  it("cliente com CNPJ → NF-e; CPF ou sem documento → NFC-e", () => {
    expect(notaSugerida("11.444.777/0001-61")).toBe("nfe");
    expect(notaSugerida("390.533.447-05")).toBe("nfce");
    expect(notaSugerida(null)).toBe("nfce");
  });
  it("a emissão automática da NFC-e espera só quando está ligada e o cliente tem CNPJ", () => {
    expect(automaticaEspera(true, "11444777000161")).toBe(true);
    expect(automaticaEspera(true, "39053344705")).toBe(false);
    expect(automaticaEspera(false, "11444777000161")).toBe(false);
  });
});

describe("formatação", () => {
  it("documento, chave e IE", () => {
    expect(fmtDocumento("11444777000161")).toBe("11.444.777/0001-61");
    expect(fmtDocumento("39053344705")).toBe("390.533.447-05");
    expect(fmtChave("35261111222333000181550020000000151123456786")).toBe("3526 1111 2223 3300 0181 5500 2000 0000 1511 2345 6786");
    expect(rotuloDaIe({ indIeDest: 2, ie: "" })).toBe("Isenta");
    expect(rotuloDaIe({ indIeDest: 1, ie: "110042490114" })).toBe("110042490114 (contribuinte)");
  });
});
