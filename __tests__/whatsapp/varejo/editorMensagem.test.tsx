// ============================================================
// Editor da lojista (26/11/2026): a validação é a MESMA do servidor
// (Aura-backend #1128, modelos.js) e mora numa função pura; aqui ela é
// testada caso a caso, junto com o fluxo de aprovação e os limites de edição.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockEnviar = jest.fn();
const mockRestaurar = jest.fn();
jest.mock("@/services/waConfigApi", () => {
  const actual = jest.requireActual("@/services/waConfigApi");
  return {
    ...actual,
    waConfigApi: {
      ...actual.waConfigApi,
      enviarModelo: (...a: any[]) => mockEnviar(...a),
      restaurarModelo: (...a: any[]) => mockRestaurar(...a),
    },
  };
});

import { EditorMensagem, limiteDeEdicao } from "@/components/whatsapp/EditorMensagem";
import { aplicarCorrecao, inserirCampo, milhar, renderizar, segmentos, trechoDeOferta, validar } from "@/components/whatsapp/waMensagem";
import { brl, clientesDasParcelas, vencimentoTexto } from "@/components/whatsapp/waPreviaClientes";

const CAMPOS_CRED = ["Nome", "Parcela", "Vencimento", "Valor", "Nome da loja", "Pix da loja", "Link da loja", "Total de parcelas"];
const AVISO = { campos: CAMPOS_CRED, categoria: "UTILITY" };
const NOVIDADE = { campos: ["Nome", "Nome da loja", "Presente", "Validade", "Código"], categoria: "MARKETING" };
const ids = (v: any, ok: boolean) => v.checks.filter((c: any) => c.ok === ok).map((c: any) => c.id);

describe("validar (igual ao servidor)", () => {
  it("texto do cred_antes passa em tudo", () => {
    const v = validar(AVISO, "Oi, {Nome}. A parcela {Parcela} do seu crediário na {Nome da loja} vence {Vencimento}: {Valor}. O Pix vai logo abaixo; se preferir, dá para pagar na loja.");
    expect(v.ok).toBe(true);
    expect(v.checks.map((c) => c.id)).toEqual(["campos", "comeca", "termina", "colados", "oferta", "tamanho"]);
    expect(v.checks.find((c) => c.id === "tamanho")!.texto).toMatch(/^Cabe numa mensagem: \d+ de 1\.024 letras\.$/);
  });

  it("vazio", () => {
    const v = validar(AVISO, "   ");
    expect(v.ok).toBe(false);
    expect(v.checks[0]).toMatchObject({ id: "vazio", ok: false, texto: "Escreva a mensagem antes de mandar para aprovação." });
  });

  it("termina em campo: correção PONTO_FINAL", () => {
    const v = validar(AVISO, "Oi, {Nome}. Sua parcela é {Valor}");
    expect(ids(v, false)).toEqual(["termina"]);
    const c = v.checks.find((x) => x.id === "termina")!;
    expect(c).toMatchObject({ correcao: "PONTO_FINAL", texto: "O texto não pode terminar num campo roxo." });
    expect(aplicarCorrecao("Oi {Nome}. Vale {Valor}", c)).toBe("Oi {Nome}. Vale {Valor}.");
  });

  it("começa em campo", () => {
    expect(ids(validar(AVISO, "{Nome}, sua parcela chegou."), false)).toEqual(["comeca"]);
  });

  it("campos colados: correção SEPARAR", () => {
    const v = validar(AVISO, "Oi, {Nome}{Valor} e pronto.");
    expect(ids(v, false)).toEqual(["colados"]);
    expect(aplicarCorrecao("Oi, {Nome}{Valor} e pronto.", v.checks.find((x) => x.id === "colados")!)).toBe("Oi, {Nome}, {Valor} e pronto.");
  });

  it("oferta em aviso (UTILITY): TIRAR_OFERTA devolve o trecho; em novidade não confere", () => {
    const texto = "Oi, {Nome}. A parcela {Parcela} vence {Vencimento}. Pagando hoje, 5% de desconto no Pix.";
    const v = validar(AVISO, texto);
    const c = v.checks.find((x) => x.id === "oferta")!;
    expect(c.ok).toBe(false);
    expect(c.correcao).toBe("TIRAR_OFERTA");
    expect(c.trecho).toBe("Pagando hoje, 5% de desconto no Pix.");
    expect(c.texto).toBe("Aviso não pode ter oferta: o WhatsApp passa a cobrar como novidade.");
    expect(validar(AVISO, aplicarCorrecao(texto, c)).ok).toBe(true);
    expect(validar(NOVIDADE, "Oi, {Nome}. Ganhe {Presente} até {Validade}.").checks.some((x) => x.id === "oferta")).toBe(false);
  });

  it("o valor de um campo não conta como oferta (só as palavras dela)", () => {
    expect(trechoDeOferta("Oi, {Presente} para você.")).toBeNull();
    expect(trechoDeOferta("Oi. Temos promoção hoje.")).toBe("Temos promoção hoje.");
  });

  it("campo desconhecido e chave solta", () => {
    const v = validar(AVISO, "Oi, {Apelido}. Vale {Valor}.");
    expect(v.checks.find((c) => c.id === "campos")).toMatchObject({ ok: false, desconhecidos: ["Apelido"], texto: 'Campo que a Aura não preenche aqui: "Apelido".' });
    expect(validar(AVISO, "Oi, {Nome. Vale {Valor}.").checks.some((c) => c.id === "chaves" && !c.ok)).toBe(true);
  });

  it("botão do modelo (Quero o Pix): o texto precisa citá-lo, igual ao servidor", () => {
    const PIX = { ...AVISO, botoes: [{ tipo: "QUICK_REPLY", texto: "Quero o Pix" }] };
    const com = validar(PIX, "Oi, {Nome}. A parcela {Parcela} vence {Vencimento}: {Valor}. Toque em 'Quero o Pix' que eu te mando o código.");
    expect(com.ok).toBe(true);
    expect(com.checks.find((c) => c.id === "botao")).toMatchObject({ ok: true, texto: 'O texto avisa do botão "Quero o Pix".' });
    // sem a frase (maiúsculas não importam), o texto não passa e não há correção de um toque (o servidor também não tem)
    const sem = validar(PIX, "Oi, {Nome}. A parcela {Parcela} vence {Vencimento}: {Valor}. Se preferir, pague na loja.");
    const b = sem.checks.find((c) => c.id === "botao")!;
    expect(b).toMatchObject({ ok: false, texto: 'Mantenha no texto a frase que fala do botão "Quero o Pix".' });
    expect(b.correcao).toBeUndefined();
    expect(sem.ok).toBe(false);
    expect(validar(PIX, "oi, {Nome}. QUERO O PIX é o botão. Valor {Valor}.").checks.find((c) => c.id === "botao")!.ok).toBe(true);
    // modelo sem botão: a regra não existe (ordem dos itens: oferta, botão, tamanho)
    expect(validar(AVISO, "Oi, {Nome}. Vale {Valor}.").checks.some((c) => c.id === "botao")).toBe(false);
    expect(com.checks.map((c) => c.id)).toEqual(["campos", "comeca", "termina", "colados", "oferta", "botao", "tamanho"]);
  });

  it("1.024 letras", () => {
    const longo = "Oi, {Nome}. " + "a".repeat(1100) + ".";
    const t = validar(AVISO, longo).checks.find((c) => c.id === "tamanho")!;
    expect(t.ok).toBe(false);
    expect(t.texto).toMatch(/^Passou do limite: 1\.\d{3} de 1\.024 letras\.$/);
    expect(validar(AVISO, "Oi, {Nome}. " + "a".repeat(1000) + ".").ok).toBe(true);
  });

  it("inserirCampo no cursor, com espaços", () => {
    expect(inserirCampo("Oi, .", "Nome", 4, 4)).toEqual({ texto: "Oi, {Nome}.", cursor: 10 });
    expect(inserirCampo("Oi,", "Nome", 3, 3).texto).toBe("Oi, {Nome}");
    expect(inserirCampo("", "Nome", 0, 0).texto).toBe("{Nome}");
  });

  it("segmentos e renderizar", () => {
    expect(segmentos("Oi, {Nome}.")).toEqual([{ campo: false, v: "Oi, " }, { campo: true, v: "Nome" }, { campo: false, v: "." }]);
    expect(renderizar("Oi, {Pix da loja}.", { Nome: "A" }, false)).toBe("Oi, [Pix da loja].");
    expect(milhar(1024)).toBe("1.024");
  });
});

describe("prévia com clientes reais", () => {
  const hoje = new Date(2026, 10, 26); // quinta, 26/11
  it("vencimento em português", () => {
    expect(vencimentoTexto("2026-11-26", hoje)).toBe("hoje");
    expect(vencimentoTexto("2026-11-27", hoje)).toBe("amanhã, 27/11");
    expect(vencimentoTexto("2026-11-30T00:00:00Z", hoje)).toBe("na segunda, 30/11");
    expect(vencimentoTexto("2026-11-28", hoje)).toBe("no sábado, 28/11");
    expect(vencimentoTexto("xx", hoje)).toBeNull();
    expect(brl(1234.5)).toBe("R$ 1.234,50");
  });

  it("3 clientes, uma parcela por cliente, com nome, parcela e valor", () => {
    const p = (id: string, nome: string, n: number, tot: number, v: number, d: string) =>
      ({ id: id + n, customer_id: id, customer_name: nome, installment_number: n, total_installments: tot, amount_due: v, due_date: d } as any);
    const lista = clientesDasParcelas([
      p("a", "Marta Lins", 2, 4, 120, "2026-11-30"), p("a", "Marta Lins", 3, 4, 120, "2026-12-30"),
      p("b", "Cris Alves", 1, 3, 45, "2026-11-27"), p("c", "João Pedro", 4, 5, 89.9, "2026-12-02"), p("d", "Duda", 1, 2, 10, "2026-12-03"),
    ], "Lume Moda", hoje);
    expect(lista.map((c) => c.nome)).toEqual(["Marta", "Cris", "João"]);
    expect(lista[0].valores).toMatchObject({ "Nome": "Marta", "Parcela": "2 de 4", "Valor": "R$ 120,00", "Vencimento": "na segunda, 30/11", "Nome da loja": "Lume Moda" });
  });
});

// ── Componente ───────────────────────────────────────────────
const modelo: any = {
  key: "cred_antes", automatica: "crediario", titulo: "Antes do vencimento", categoria: "UTILITY", campos: CAMPOS_CRED,
  texto_padrao: "Oi, {Nome}. A parcela {Parcela} vence {Vencimento}: {Valor}. O Pix vai abaixo.",
  texto_em_uso: "Oi, {Nome}. A parcela {Parcela} vence {Vencimento}: {Valor}. O Pix vai abaixo.",
  texto_novo: null, estado: "PRONTA", edicao: { pode: true, proxima_em: null, restam_30_dias: 10 },
};
const clientes = [
  { nome: "Marta", valores: { Nome: "Marta", Parcela: "2 de 4", Valor: "R$ 120,00", Vencimento: "no sábado, 30/11" } },
  { nome: "Cris", valores: { Nome: "Cris", Parcela: "1 de 3", Valor: "R$ 45,00", Vencimento: "amanhã, 27/11" } },
];
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id })[0];
const tem = (t: any, id: string) => t.root.findAllByProps({ testID: id }).length > 0;
const textos = (t: any) => JSON.stringify(t.toJSON()).replace(/","/g, "");
async function digitar(t: any, texto: string) { await act(async () => { achar(t, "wa-editor-texto").props.onChangeText(texto); }); }
const montar = (m: any = modelo, extra: any = {}) =>
  renderer.create(<EditorMensagem companyId="c" modelo={m} clientes={clientes} onFechar={jest.fn()} onMudou={jest.fn()} {...extra} />);

describe("EditorMensagem", () => {
  beforeEach(() => { mockEnviar.mockReset(); mockRestaurar.mockReset(); });

  it("sem mudança, o envio fica travado; prévia com o cliente real", () => {
    const t = montar();
    expect(achar(t, "wa-editor-enviar").props.disabled).toBe(true);
    expect(textos(t)).toContain("Como chega para Marta");
    expect(textos(t)).toContain("Oi, Marta. A parcela 2 de 4 vence no sábado, 30/11: R$ 120,00.");
  });

  it("troca de cliente na prévia", async () => {
    const t = montar();
    await act(async () => { achar(t, "wa-editor-cliente-1").props.onPress(); });
    expect(textos(t)).toContain("Como chega para Cris");
    expect(textos(t)).toContain("1 de 3");
  });

  it("termina em campo: avisa, trava e corrige em um toque", async () => {
    const t = montar();
    await digitar(t, "Oi, {Nome}. Sua parcela é {Valor}");
    expect(achar(t, "wa-editor-enviar").props.disabled).toBe(true);
    expect(tem(t, "wa-editor-ajuste")).toBe(true);
    await act(async () => { achar(t, "wa-editor-corrigir-termina").props.onPress(); });
    expect(achar(t, "wa-editor-texto").props.value).toBe("Oi, {Nome}. Sua parcela é {Valor}.");
    expect(achar(t, "wa-editor-enviar").props.disabled).toBe(false);
  });

  it("oferta num aviso: tira o trecho amarelo", async () => {
    const t = montar();
    await digitar(t, "Oi, {Nome}. A parcela {Parcela} vence {Vencimento}. Pagando hoje, 5% de desconto no Pix.");
    expect(textos(t)).toContain("Aviso não pode ter oferta");
    await act(async () => { achar(t, "wa-editor-corrigir-oferta").props.onPress(); });
    expect(achar(t, "wa-editor-texto").props.value).toBe("Oi, {Nome}. A parcela {Parcela} vence {Vencimento}.");
  });

  it("botões + Campo colocam o campo no texto", async () => {
    const t = montar();
    await digitar(t, "Oi,");
    await act(async () => { achar(t, "wa-editor-texto").props.onSelectionChange({ nativeEvent: { selection: { start: 3, end: 3 } } }); });
    await act(async () => { achar(t, "wa-editor-campo-Nome").props.onPress(); });
    expect(achar(t, "wa-editor-texto").props.value).toBe("Oi, {Nome}");
  });

  it("manda para aprovação; depois fica 'Enviado' e travado", async () => {
    mockEnviar.mockResolvedValue({ modelo: { estado: "EM_APROVACAO" }, versao: 2 });
    const onMudou = jest.fn();
    const t = montar(modelo, { onMudou });
    await digitar(t, "Oi, {Nome}. Sua parcela {Parcela} vence {Vencimento}: {Valor}. Qualquer coisa me chama.");
    await act(async () => { achar(t, "wa-editor-enviar").props.onPress(); });
    expect(mockEnviar).toHaveBeenCalledWith("c", "cred_antes", "Oi, {Nome}. Sua parcela {Parcela} vence {Vencimento}: {Valor}. Qualquer coisa me chama.");
    expect(onMudou).toHaveBeenCalled();
    expect(textos(t)).toContain("Enviado para aprovação.");
    expect(textos(t)).toContain("A Aura avisa no sino");
    expect(tem(t, "wa-editor-enviar")).toBe(false);
  });

  it("EDICAO_LIMITE_24H e 30D: mostra a frase do servidor e quando poderá editar", async () => {
    for (const code of ["EDICAO_LIMITE_24H", "EDICAO_LIMITE_30D"]) {
      mockEnviar.mockRejectedValue({ status: 429, data: { code, error: "Você já editou este texto hoje.", proxima_em: "2026-11-27T13:00:00" } });
      const t = montar();
      await digitar(t, "Oi, {Nome}. Sua parcela {Parcela} vence {Vencimento}: {Valor}. Beijos.");
      await act(async () => { achar(t, "wa-editor-enviar").props.onPress(); });
      expect(achar(t, "wa-editor-erro").props.children).toContain("Você já editou este texto hoje.");
      expect(achar(t, "wa-editor-erro").props.children).toContain("27/11 às 13:00");
      expect(tem(t, "wa-editor-enviado")).toBe(false);
    }
  });

  it("limite lido do modelo trava antes de tentar", () => {
    const m = { ...modelo, edicao: { pode: false, proxima_em: "2026-11-27T13:00:00", restam_30_dias: 9 } };
    expect(limiteDeEdicao(m)).toContain("27/11 às 13:00");
    expect(limiteDeEdicao({ ...m, edicao: { pode: false, restam_30_dias: 0 } })).toContain("10 edições dos últimos 30 dias");
    expect(limiteDeEdicao(modelo)).toBeNull();
    const t = montar(m);
    expect(tem(t, "wa-editor-limite")).toBe(true);
    expect(achar(t, "wa-editor-enviar").props.disabled).toBe(true);
  });

  it("422 TEXTO_INVALIDO do servidor aparece (o servidor confere de novo)", async () => {
    mockEnviar.mockRejectedValue({ status: 422, data: { code: "TEXTO_INVALIDO", error: "O texto não passou na conferência." } });
    const t = montar();
    await digitar(t, "Oi, {Nome}. Sua parcela {Parcela} vence {Vencimento}: {Valor}. Beijos.");
    await act(async () => { achar(t, "wa-editor-enviar").props.onPress(); });
    expect(achar(t, "wa-editor-erro").props.children).toBe("O texto não passou na conferência.");
  });

  it("'Voltar ao texto da Aura' só quando o texto difere do padrão; restaura no servidor", async () => {
    expect(tem(montar(), "wa-editor-voltar-aura")).toBe(false);
    mockRestaurar.mockResolvedValue({});
    const onFechar = jest.fn();
    const t = montar({ ...modelo, texto_em_uso: "Oi, {Nome}. Texto meu {Valor}." }, { onFechar });
    await act(async () => { achar(t, "wa-editor-voltar-aura").props.onPress(); });
    expect(mockRestaurar).toHaveBeenCalledWith("c", "cred_antes");
    expect(onFechar).toHaveBeenCalled();
  });

  it("sem clientes reais, diz que é exemplo", () => {
    const t = renderer.create(<EditorMensagem companyId="c" modelo={modelo} clientes={[]} onFechar={jest.fn()} onMudou={jest.fn()} />);
    expect(textos(t)).toContain("cliente de exemplo");
  });
});
