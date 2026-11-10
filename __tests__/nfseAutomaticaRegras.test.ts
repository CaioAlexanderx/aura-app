// ============================================================
// NFS-e automática — regras puras do app (utils/nfseAutomatica.ts).
// Mockup aprovado docs/mockups/nfse-cadastro-servico.html, telas 3 a 5.
//   - documento: dígito verificador de CPF e CNPJ, máscara, frases;
//   - quando o Caixa exige o documento (serviço + opt-in);
//   - aviso das duas notas;
//   - 2ª via contra Emitir NFS-e nas telas de detalhe;
//   - NFC-e "skipped" (Aura-backend#983) sem sucesso falso.
// ============================================================
import {
  avisoDasNotas, botaoDaNfse, composicaoDaVenda, docValido, ehEstadoFinal, estadoDoDoc, pedeTomador,
  faltaSoONome, faltaTomador, intervaloDoPolling, mascararDoc, mensagemDoDoc, nfcePulada, numerosDasNotas,
  rotaDoEmitir, rotuloDoDoc, semCodigo, textoServicosForaDaNfce, TEXTO_NFCE_SO_SERVICO,
} from "@/utils/nfseAutomatica";
import type { SituacaoNfse, NotaDaOrigemNfse } from "@/services/nfseAutomaticaApi";

const CPF_OK = "529.982.247-25";
const CNPJ_OK = "11.222.333/0001-81";

function nota(p: Partial<NotaDaOrigemNfse>): NotaDaOrigemNfse {
  return {
    id: "r1", origem_tipo: "venda", origem_id: "v1", ctribnac: "060101", estado: "emitida",
    motivo: null, motivo_codigo: null, valor: 80, gatilho: "venda", nfse_id: "n1", nfse_number: "312",
    chave_acesso: null, emitida_em: null, atualizado_em: null, ...p,
  };
}
function sit(p: Partial<SituacaoNfse>): SituacaoNfse {
  return { origem: { tipo: "venda", id: "v1" }, estado: "nenhuma", acao: "emitir", tem_nota: false, notas: [], ...p };
}

describe("documento de quem contratou", () => {
  test("CPF e CNPJ pelo dígito verificador", () => {
    expect(estadoDoDoc("")).toBe("vazio");
    expect(estadoDoDoc("529.982")).toBe("incompleto");
    expect(estadoDoDoc(CPF_OK)).toBe("cpf");
    expect(estadoDoDoc("529.982.247-26")).toBe("invalido");
    expect(estadoDoDoc("111.111.111-11")).toBe("invalido");
    expect(estadoDoDoc("11.222.333/0001")).toBe("incompleto");
    expect(estadoDoDoc(CNPJ_OK)).toBe("cnpj");
    expect(estadoDoDoc("11.222.333/0001-82")).toBe("invalido");
    expect(docValido(CPF_OK)).toBe(true);
    expect(docValido(CNPJ_OK)).toBe(true);
    expect(docValido("52998224726")).toBe(false);
  });

  test("máscara: CPF até 11 números, CNPJ do 12º em diante", () => {
    expect(mascararDoc("52998224725")).toBe(CPF_OK);
    expect(mascararDoc("11222333000181")).toBe(CNPJ_OK);
    expect(mascararDoc("112223330001819999")).toBe(CNPJ_OK);
  });

  test("frases do mockup sob o campo", () => {
    expect(mensagemDoDoc(CPF_OK, { temProduto: true }).texto).toBe("CPF confere. Vai na nota de serviço e no cupom fiscal.");
    expect(mensagemDoDoc(CPF_OK, { temProduto: false }).texto).toBe("CPF confere. Vai na nota de serviço.");
    expect(mensagemDoDoc(CNPJ_OK, { temProduto: false }).texto).toBe("CNPJ confere. A nota sai no nome da empresa.");
    const errado = mensagemDoDoc("52998224726", { temProduto: false });
    expect(errado.tom).toBe("erro");
    expect(errado.texto).toMatch(/^Esse CPF não confere/);
    expect(mensagemDoDoc("5299822472", { temProduto: false }).texto).toBe("Falta 1 número para o CPF.");
    expect(mensagemDoDoc("529982", { temProduto: false }).texto).toBe("Faltam 5 números para o CPF.");
    expect(mensagemDoDoc("", { temProduto: false }).texto).toBe("CPF tem 11 números; CNPJ, 14. Pode digitar só os números.");
  });

  test("rótulo da tela final", () => {
    expect(rotuloDoDoc("11222333000181")).toBe("CNPJ na nota");
    expect(rotuloDoDoc("52998224725")).toBe("CPF na nota");
  });
});

describe("quando o Caixa pede o documento (sempre opcional)", () => {
  const produto = { unit: "un" };
  const servico = { unit: "srv" };
  test("só com serviço E a loja emitindo NFS-e (automática ou botão)", () => {
    expect(pedeTomador({ temServico: true, nfseAtiva: true, nfseEmite: false })).toBe(true);
    expect(pedeTomador({ temServico: true, nfseAtiva: false, nfseEmite: true })).toBe(true);
    expect(pedeTomador({ temServico: true, nfseAtiva: false, nfseEmite: false })).toBe(false);
    expect(pedeTomador({ temServico: false, nfseAtiva: true, nfseEmite: true })).toBe(false);
  });
  test("composição da venda pela unidade 'srv'", () => {
    expect(composicaoDaVenda([produto])).toEqual({ temServico: false, temProduto: true, mista: false });
    expect(composicaoDaVenda([servico])).toEqual({ temServico: true, temProduto: false, mista: false });
    expect(composicaoDaVenda([produto, { unit: "SRV" }])).toEqual({ temServico: true, temProduto: true, mista: true });
    expect(composicaoDaVenda([{}])).toEqual({ temServico: false, temProduto: true, mista: false });
  });
  test("aviso das duas notas só na venda mista com opt-in", () => {
    expect(avisoDasNotas({ temServico: true, temProduto: true, nfseAtiva: true, nfceAutomatica: true }))
      .toBe("Esta venda sai em duas notas: o cupom fiscal (NFC-e) dos produtos e a nota de serviço (NFS-e) do serviço. As duas saem sozinhas ao finalizar.");
    expect(avisoDasNotas({ temServico: true, temProduto: true, nfseAtiva: true, nfceAutomatica: false })).toMatch(/A nota de serviço sai sozinha ao finalizar\.$/);
    expect(avisoDasNotas({ temServico: true, temProduto: false, nfseAtiva: true, nfceAutomatica: true })).toBe("Ao finalizar, a nota de serviço (NFS-e) sai sozinha.");
    expect(avisoDasNotas({ temServico: true, temProduto: true, nfseAtiva: false, nfceAutomatica: true })).toBeNull();
    expect(avisoDasNotas({ temServico: false, temProduto: true, nfseAtiva: true, nfceAutomatica: true })).toBeNull();
  });
});

describe("2ª via contra Emitir NFS-e", () => {
  test("nota emitida: só a 2ª via, nunca emitir", () => {
    const s = sit({ estado: "emitida", acao: "imprimir_2a_via", tem_nota: true, notas: [nota({})] });
    expect(botaoDaNfse(s)).toBe("segunda_via");
    expect(numerosDasNotas(s)).toBe("nº 312");
  });
  test("falha ou pendência: Emitir NFS-e (com a rota certa)", () => {
    const erro = sit({ estado: "erro", acao: "tentar_de_novo", notas: [nota({ estado: "erro", nfse_id: null, motivo: "Fora do ar" })] });
    expect(botaoDaNfse(erro)).toBe("emitir");
    expect(rotaDoEmitir(erro)).toBe("tentar_de_novo");
    const pend = sit({ estado: "pendente_dados", acao: "completar_dados", notas: [nota({ estado: "pendente_dados", nfse_id: null, motivo_codigo: "TOMADOR_INVALIDO" })] });
    expect(botaoDaNfse(pend)).toBe("completar_e_emitir");
    expect(rotaDoEmitir(pend)).toBe("emitir");
    expect(faltaTomador(pend)).toBe(true);
    const cancel = sit({ estado: "cancelada", acao: "emitir", notas: [nota({ estado: "cancelada" })] });
    expect(botaoDaNfse(cancel)).toBe("emitir");
    expect(rotaDoEmitir(cancel)).toBe("tentar_de_novo");
  });
  test("serviço sem código: atalho para o cadastro", () => {
    const s = sit({ estado: "erro", acao: "cadastrar_codigo", notas: [nota({ estado: "erro", ctribnac: "000000", motivo_codigo: "SEM_CODIGO", nfse_id: null })] });
    expect(botaoDaNfse(s)).toBe("cadastrar_codigo");
    expect(semCodigo(s)).toBe(true);
    expect(faltaTomador(s)).toBe(false);
  });
  test("saindo: aguardar; nenhuma (sem serviço / loja sem NFS-e): nada", () => {
    expect(botaoDaNfse(sit({ estado: "emitindo", acao: "aguardar" }))).toBe("aguardar");
    expect(botaoDaNfse(sit({ estado: "nenhuma", acao: "emitir" }))).toBe("nada");
    expect(botaoDaNfse(null)).toBe("nada");
  });
  test("o completar só vale para dígito errado ou falta de nome (e ISS retido)", () => {
    const pend = (motivo_codigo: any) => sit({ estado: "pendente_dados", acao: "completar_dados", notas: [nota({ estado: "pendente_dados", nfse_id: null, motivo_codigo })] });
    expect(faltaTomador(pend("SEM_NOME"))).toBe(true);
    expect(faltaTomador(pend("TOMADOR_INVALIDO"))).toBe(true);
    expect(faltaTomador(pend("SEM_TOMADOR"))).toBe(true); // só com ISSQN retido
    expect(faltaTomador(pend(null))).toBe(false);
    expect(faltaTomador(pend("SEM_CODIGO"))).toBe(false);
    expect(faltaTomador(sit({ estado: "emitida", acao: "imprimir_2a_via", tem_nota: true, notas: [nota({})] }))).toBe(false);
  });
  test("só o nome falta", () => {
    const s = sit({ estado: "pendente_dados", acao: "completar_dados", notas: [nota({ estado: "pendente_dados", motivo_codigo: "SEM_NOME", nfse_id: null })] });
    expect(faltaSoONome(s)).toBe(true);
  });
  test("estados finais e o intervalo do polling", () => {
    expect(ehEstadoFinal("emitida")).toBe(true);
    expect(ehEstadoFinal("erro")).toBe(true);
    expect(ehEstadoFinal("pendente_dados")).toBe(true);
    expect(ehEstadoFinal("emitindo")).toBe(false);
    expect(ehEstadoFinal("nenhuma")).toBe(false);
    expect([0, 1, 2, 3, 4, 5, 9].map(intervaloDoPolling)).toEqual([1500, 2000, 3000, 5000, 8000, 12000, 12000]);
  });
});

describe("NFC-e de venda só de serviço (Aura-backend#983)", () => {
  test("skipped não é nota emitida", () => {
    expect(nfcePulada({ skipped: true, reason: "somente_servicos", nfce: null })).toBe(true);
    expect(nfcePulada({ nfce: { id: "x", status: "autorizada" } })).toBe(false);
    expect(nfcePulada(null)).toBe(false);
    expect(TEXTO_NFCE_SO_SERVICO).toBe("Venda só de serviços: a nota de serviço sai separada.");
  });
  test("venda mista: frase dos serviços fora do cupom", () => {
    expect(textoServicosForaDaNfce({ servicos_fora_da_nfce: { itens: 1, total: 80 } })).toBe("O serviço ficou fora do cupom fiscal: sai na nota de serviço (NFS-e).");
    expect(textoServicosForaDaNfce({ servicos_fora_da_nfce: { itens: 2, total: 160 } })).toBe("Os 2 serviços ficaram fora do cupom fiscal: saem na nota de serviço (NFS-e).");
    expect(textoServicosForaDaNfce({ nfce: {} })).toBeNull();
  });
});
