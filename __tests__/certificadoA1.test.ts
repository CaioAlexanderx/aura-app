// ============================================================
// Certificado A1 pelo cliente — regras puras (14/10/2026)
//
// O que este arquivo segura (utils/certificadoA1.ts):
//  1. estado do certificado: sem, válido, vencendo (< 30 dias), vencido;
//  2. texto do prazo e da validade (dd/mm/aaaa no fuso do lojista);
//  3. cada `code` do servidor vira a mensagem do mockup, no campo certo
//     (senha incorreta destaca a senha; CNPJ diferente cita a empresa);
//  4. link do WhatsApp com texto codificado, sem arquivo e sem senha;
//  5. validação do arquivo (.pfx/.p12, até 256 KB) antes de enviar;
//  6. o contrato do cliente de API (rota, retry 0, timeout 20 s).
// ============================================================
import {
  DIAS_PARA_AVISAR, TAMANHO_MAX_BYTES, WHATSAPP_AURA,
  base64DoDataUrl, erroDeEnvio, estadoDoCertificado, extensaoValida, formatarCnpj, formatarData,
  linkDeAjuda, mensagemDeAjuda, periodoDeValidade, pontoDaAba, textoDoPrazo, textoErroDeCarregamento,
  titularLegivel, validarArquivo, type CertInfo,
} from "@/utils/certificadoA1";

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

const cert = (dias: number | null, extra: Partial<CertInfo> = {}): CertInfo => ({
  subject_cn: "PADARIA ESTRELA DO SUL LTDA:12345678000190",
  not_before: "2026-03-12T12:00:00.000Z",
  not_after: "2027-03-12T12:00:00.000Z",
  days_left: dias,
  updated_at: null,
  ...extra,
});

describe("estadoDoCertificado", () => {
  it("sem certificado", () => {
    expect(estadoDoCertificado(null)).toBe("sem");
    expect(estadoDoCertificado(undefined)).toBe("sem");
  });

  it("válido a partir de 30 dias", () => {
    expect(estadoDoCertificado(cert(290))).toBe("valido");
    expect(estadoDoCertificado(cert(DIAS_PARA_AVISAR))).toBe("valido");
  });

  it("vencendo com menos de 30 dias (inclui vence hoje)", () => {
    expect(estadoDoCertificado(cert(DIAS_PARA_AVISAR - 1))).toBe("vencendo");
    expect(estadoDoCertificado(cert(19))).toBe("vencendo");
    expect(estadoDoCertificado(cert(0))).toBe("vencendo");
  });

  it("vencido com dias negativos", () => {
    expect(estadoDoCertificado(cert(-1))).toBe("vencido");
    expect(estadoDoCertificado(cert(-32))).toBe("vencido");
  });

  it("sem days_left cai na data de validade", () => {
    const agora = new Date("2026-10-14T12:00:00Z");
    expect(estadoDoCertificado(cert(null, { not_after: "2027-03-12T12:00:00Z" }), agora)).toBe("valido");
    expect(estadoDoCertificado(cert(null, { not_after: "2026-10-30T12:00:00Z" }), agora)).toBe("vencendo");
    expect(estadoDoCertificado(cert(null, { not_after: "2026-09-12T12:00:00Z" }), agora)).toBe("vencido");
  });

  it("sem prazo legível não alarma", () => {
    expect(estadoDoCertificado(cert(null, { not_after: "" }))).toBe("valido");
  });
});

describe("pontoDaAba", () => {
  it("espelha o estado: verde, âmbar, vermelho", () => {
    expect(pontoDaAba("valido")).toBe("ok");
    expect(pontoDaAba("sem")).toBe("aviso");
    expect(pontoDaAba("vencendo")).toBe("aviso");
    expect(pontoDaAba("vencido")).toBe("erro");
  });
});

describe("prazo e validade", () => {
  it("textoDoPrazo", () => {
    expect(textoDoPrazo(290)).toBe("faltam 290 dias");
    expect(textoDoPrazo(1)).toBe("falta 1 dia");
    expect(textoDoPrazo(0)).toBe("vence hoje");
    expect(textoDoPrazo(-1)).toBe("venceu há 1 dia");
    expect(textoDoPrazo(-32)).toBe("venceu há 32 dias");
    expect(textoDoPrazo(null)).toBe("");
  });

  it("formatarData em dd/mm/aaaa, no fuso de São Paulo", () => {
    expect(formatarData("2027-03-12T12:00:00.000Z")).toBe("12/03/2027");
    // 01:00 UTC ainda é o dia anterior em São Paulo
    expect(formatarData("2026-09-13T01:00:00.000Z")).toBe("12/09/2026");
    expect(formatarData("lixo")).toBe("");
    expect(formatarData(null)).toBe("");
  });

  it("periodoDeValidade", () => {
    expect(periodoDeValidade({ not_before: "2026-03-12T12:00:00Z", not_after: "2027-03-12T12:00:00Z" }))
      .toBe("Válido de 12/03/2026 a 12/03/2027");
    expect(periodoDeValidade({ not_before: null, not_after: "2027-03-12T12:00:00Z" })).toBe("Válido até 12/03/2027");
  });

  it("titularLegivel tira o CNPJ colado no CN do e-CNPJ", () => {
    expect(titularLegivel("PADARIA ESTRELA DO SUL LTDA:12345678000190")).toBe("PADARIA ESTRELA DO SUL LTDA");
    expect(titularLegivel("Padaria Estrela")).toBe("Padaria Estrela");
    expect(titularLegivel(null)).toBe("");
  });

  it("formatarCnpj", () => {
    expect(formatarCnpj("12345678000190")).toBe("12.345.678/0001-90");
    expect(formatarCnpj("12.345.678/0001-90")).toBe("12.345.678/0001-90");
    expect(formatarCnpj(null)).toBe("");
  });
});

describe("erroDeEnvio", () => {
  const empresa = { nome: "Padaria Estrela do Sul Ltda", cnpj: "12345678000190" };
  const e = (code: string, status: number, extra: any = {}) => ({ status, data: { code, error: "x" }, ...extra });

  it("senha incorreta destaca o campo da senha", () => {
    const r = erroDeEnvio(e("CERT_SENHA_INCORRETA", 400), empresa);
    expect(r.campo).toBe("senha");
    expect(r.texto).toBe("A senha está incorreta. Confira e tente de novo. Se não lembra, a Aura pode te ajudar.");
  });

  it("vencido, arquivo inválido e ainda não válido caem no campo do arquivo", () => {
    expect(erroDeEnvio(e("CERT_VENCIDO", 422), empresa)).toMatchObject({ campo: "arquivo" });
    expect(erroDeEnvio(e("CERT_VENCIDO", 422), empresa).texto).toMatch(/vencido/);
    expect(erroDeEnvio(e("CERT_ARQUIVO_INVALIDO", 400), empresa).texto)
      .toBe("Não conseguimos ler este arquivo. Escolha o arquivo do certificado A1, que termina em .pfx ou .p12.");
    expect(erroDeEnvio(e("CERT_AINDA_NAO_VALIDO", 422), empresa)).toMatchObject({ campo: "arquivo" });
  });

  it("CNPJ diferente cita a empresa ativa (nome e CNPJ), nunca a mensagem genérica de arquivo", () => {
    const r = erroDeEnvio(e("CERT_CNPJ_DIVERGENTE", 422), empresa);
    expect(r.campo).toBe("arquivo");
    expect(r.texto).toContain("Padaria Estrela do Sul Ltda");
    expect(r.texto).toContain("12.345.678/0001-90");
    expect(r.texto).not.toMatch(/não conseguimos ler/i);
  });

  it("sem CNPJ (e-CPF), só dono, tentativas, indisponível e arquivo grande", () => {
    expect(erroDeEnvio(e("CERT_SEM_CNPJ", 422), empresa).texto).toMatch(/e-CNPJ/);
    expect(erroDeEnvio(e("APENAS_DONO", 403), empresa)).toMatchObject({ campo: "geral" });
    expect(erroDeEnvio(e("APENAS_DONO", 403), empresa).texto).toMatch(/dono/);
    expect(erroDeEnvio(e("CERT_MUITAS_TENTATIVAS", 429), empresa).texto).toMatch(/Aguarde/);
    expect(erroDeEnvio(e("CERT_INDISPONIVEL", 503), empresa).texto).toMatch(/indisponível/);
    expect(erroDeEnvio(e("CERT_GRANDE_DEMAIS", 413), empresa)).toMatchObject({ campo: "arquivo" });
  });

  it("sem code, o status HTTP decide (413, 429, 503, 403)", () => {
    expect(erroDeEnvio({ status: 413, data: {} }, empresa).campo).toBe("arquivo");
    expect(erroDeEnvio({ status: 429, data: {} }, empresa).texto).toMatch(/Muitas tentativas/);
    expect(erroDeEnvio({ status: 503, data: {} }, empresa).texto).toMatch(/indisponível/);
    expect(erroDeEnvio({ status: 403, data: {} }, empresa).texto).toMatch(/dono/);
  });

  it("timeout avisa que pode ter sido cadastrado; rede fora do ar fala de internet", () => {
    const t = erroDeEnvio({ status: 0, code: "timeout", isNetworkError: true, data: null }, empresa);
    expect(t.texto).toMatch(/pode ter sido cadastrado/);
    const r = erroDeEnvio({ status: 0, code: "network", isNetworkError: true, data: null }, empresa);
    expect(r.texto).toMatch(/internet/);
  });

  it("erro 5xx sem code usa o texto genérico (nunca o texto técnico do servidor)", () => {
    const r = erroDeEnvio({ status: 500, message: "ECONNRESET stack trace", data: { error: "ECONNRESET" } }, empresa);
    expect(r.texto).not.toMatch(/ECONNRESET/);
    expect(r.campo).toBe("geral");
  });

  it("nenhuma mensagem contém senha ou base64 (o erro nunca os recebe)", () => {
    const todos = ["CERT_SENHA_INCORRETA", "CERT_VENCIDO", "CERT_ARQUIVO_INVALIDO", "CERT_CNPJ_DIVERGENTE", "CERT_SEM_CNPJ", "APENAS_DONO"]
      .map((code) => erroDeEnvio(e(code, 400), empresa).texto).join(" ");
    expect(todos).not.toMatch(/MIIK|base64|pfx_base64|password/i);
  });
});

describe("textoErroDeCarregamento", () => {
  it("rede fora do ar e falha do servidor têm mensagem tratável", () => {
    expect(textoErroDeCarregamento({ status: 0, isNetworkError: true })).toMatch(/internet/);
    expect(textoErroDeCarregamento({ status: 404 })).toMatch(/Não conseguimos carregar/);
    expect(textoErroDeCarregamento(null)).toMatch(/Não conseguimos carregar/);
  });
});

describe("WhatsApp de ajuda", () => {
  const empresa = { nome: "Padaria Estrela do Sul Ltda", cnpj: "12345678000190" };

  it("texto pronto cita empresa e CNPJ", () => {
    expect(mensagemDeAjuda(empresa, "cadastrar")).toBe(
      "Olá! Quero ajuda para cadastrar o certificado digital A1 da minha empresa na Aura. Empresa: Padaria Estrela do Sul Ltda (CNPJ 12.345.678/0001-90).",
    );
    expect(mensagemDeAjuda(empresa, "renovar")).toMatch(/ajuda para renovar o certificado digital A1/);
  });

  it("link: número da Aura e texto codificado", () => {
    const url = linkDeAjuda(empresa, "cadastrar");
    expect(url.startsWith("https://wa.me/" + WHATSAPP_AURA + "?text=")).toBe(true);
    expect(WHATSAPP_AURA).toBe("5511956305269");
    const texto = decodeURIComponent(url.split("?text=")[1]);
    expect(texto).toBe(mensagemDeAjuda(empresa, "cadastrar"));
    expect(url).not.toMatch(/\s/); // espaço e acento codificados
    expect(url).toContain("%20");
  });

  it("não aceita nem leva arquivo ou senha", () => {
    const url = linkDeAjuda(empresa, "renovar");
    expect(decodeURIComponent(url)).not.toMatch(/senha:|password|pfx_base64|\.pfx/i);
  });

  it("sem CNPJ cadastrado, a mensagem segue sem parênteses", () => {
    expect(mensagemDeAjuda({ nome: "Loja", cnpj: null })).toBe(
      "Olá! Quero ajuda para cadastrar o certificado digital A1 da minha empresa na Aura. Empresa: Loja.",
    );
  });
});

describe("arquivo escolhido", () => {
  it("extensão .pfx ou .p12, sem diferenciar maiúscula", () => {
    expect(extensaoValida("certificado.pfx")).toBe(true);
    expect(extensaoValida("CERTIFICADO.P12")).toBe(true);
    expect(extensaoValida("fotos-da-loja.zip")).toBe(false);
    expect(extensaoValida("certificado.pfx.exe")).toBe(false);
    expect(extensaoValida("")).toBe(false);
  });

  it("aceita um .pfx de tamanho normal e recusa o resto", () => {
    expect(validarArquivo({ name: "cert.pfx", size: 4096 })).toEqual({ ok: true });
    expect(validarArquivo({ name: "cert.p12", size: TAMANHO_MAX_BYTES })).toEqual({ ok: true });

    const grande = validarArquivo({ name: "cert.pfx", size: TAMANHO_MAX_BYTES + 1 });
    expect(grande.ok).toBe(false);
    if (!grande.ok) expect(grande.motivo).toMatch(/limite é 256 KB/);

    const zip = validarArquivo({ name: "fotos.zip", size: 1000 });
    expect(zip.ok).toBe(false);
    if (!zip.ok) expect(zip.motivo).toMatch(/\.pfx ou \.p12/);

    expect(validarArquivo({ name: "cert.pfx", size: 0 }).ok).toBe(false);
  });

  it("base64DoDataUrl fica só com o payload", () => {
    expect(base64DoDataUrl("data:application/x-pkcs12;base64,QUJD")).toBe("QUJD");
    expect(base64DoDataUrl("QUJD")).toBe("QUJD");
    expect(base64DoDataUrl(null)).toBe("");
  });
});

describe("fiscalCertificateApi", () => {
  beforeEach(() => mockRequest.mockReset().mockResolvedValue({}));

  it("GET na rota da empresa e POST sem retry, com 20 s", async () => {
    const { fiscalCertificateApi } = require("@/services/fiscalCertificateApi");
    await fiscalCertificateApi.get("c1");
    expect(mockRequest).toHaveBeenCalledWith("/companies/c1/fiscal-certificate");

    await fiscalCertificateApi.upload("c1", { pfx_base64: "QUJD", password: "x" });
    expect(mockRequest).toHaveBeenLastCalledWith("/companies/c1/fiscal-certificate", {
      method: "POST",
      body: { pfx_base64: "QUJD", password: "x" },
      retry: 0,
      timeout: 20000,
    });
  });
});
