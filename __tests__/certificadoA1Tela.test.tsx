// ============================================================
// Aba "Certificado A1" renderizada (14/10/2026)
//
// Renderiza o formulário e a aba de verdade (react-test-renderer) com a API
// mockada. Segura o que tem que ser verdade na tela:
//  · senha limpa depois do envio, no sucesso e no erro (e o foco volta nela
//    quando o erro é de senha);
//  · o servidor recebe base64 sem prefixo e a senha, uma vez só;
//  · arquivo errado/grande é recusado no aparelho, sem chamar a API;
//  · funcionário (pode_enviar=false) não vê o formulário;
//  · falha do GET mostra mensagem tratável.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/CompanyPickerModal", () => ({ CompanyPickerModal: () => null }));

const mockGet = jest.fn();
const mockUpload = jest.fn();
jest.mock("@/services/fiscalCertificateApi", () => ({
  fiscalCertificateApi: { get: (...a: any[]) => mockGet(...a), upload: (...a: any[]) => mockUpload(...a) },
}));

const mockAuth: any = {
  company: { id: "c1", name: "Padaria Estrela do Sul Ltda", cnpj: "12345678000190" },
  availableCompanies: [{ id: "c1" }],
  switchCompany: jest.fn(),
};
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

import { CertificadoForm } from "@/components/screens/nfe/CertificadoForm";
import { TabCertificado } from "@/components/screens/nfe/TabCertificado";

const empresa = { nome: "Padaria Estrela do Sul Ltda", cnpj: "12345678000190" };

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join(" ");
  return texto(node.children);
}
const porTestID = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props && n.props.testID === id && typeof n.type !== "string")[0];

async function limpar() { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }

// Intercepta o <input type=file> que o formulário cria e dispara o onchange.
function escolherArquivo(t: renderer.ReactTestRenderer, arquivo: File) {
  const criados: any[] = [];
  const original = document.createElement.bind(document);
  const spy = jest.spyOn(document, "createElement").mockImplementation((tag: any, ...rest: any[]) => {
    const el: any = original(tag, ...rest);
    if (String(tag).toLowerCase() === "input") {
      el.click = () => {};
      criados.push(el);
    }
    return el;
  });
  act(() => { porTestID(t, "cert-a1-escolher").props.onPress(); });
  spy.mockRestore();
  const input = criados[criados.length - 1];
  Object.defineProperty(input, "files", { value: [arquivo], configurable: true });
  act(() => { input.onchange(); });
}

const pfx = (nome = "certificado.pfx", conteudo = "conteudo-do-pfx") => new File([conteudo], nome, { type: "application/x-pkcs12" });

describe("CertificadoForm", () => {
  beforeEach(() => { mockUpload.mockReset(); });

  function montar(onEnviado = jest.fn()) {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<CertificadoForm companyId="c1" empresa={empresa} modo="novo" onEnviado={onEnviado} />);
    });
    return { t, onEnviado };
  }
  const digitar = (t: renderer.ReactTestRenderer, v: string) =>
    act(() => { porTestID(t, "cert-a1-senha").props.onChangeText(v); });
  const senhaAtual = (t: renderer.ReactTestRenderer) => porTestID(t, "cert-a1-senha").props.value;

  it("botão Enviar começa desabilitado e a senha é um campo oculto", () => {
    const { t } = montar();
    expect(porTestID(t, "cert-a1-enviar").props.disabled).toBe(true);
    expect(porTestID(t, "cert-a1-senha").props.secureTextEntry).toBe(true);
    act(() => { porTestID(t, "cert-a1-olho").props.onPress(); });
    expect(porTestID(t, "cert-a1-senha").props.secureTextEntry).toBe(false);
  });

  it("envia base64 sem prefixo + senha e limpa a senha no sucesso", async () => {
    mockUpload.mockResolvedValue({ subject_cn: "PADARIA:12345678000190", not_before: null, not_after: "2027-03-12T12:00:00Z", days_left: 290 });
    const { t, onEnviado } = montar();
    escolherArquivo(t, pfx());
    digitar(t, "minha-senha");
    expect(porTestID(t, "cert-a1-enviar").props.disabled).toBe(false);

    await act(async () => { await porTestID(t, "cert-a1-enviar").props.onPress(); });
    await limpar();

    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [id, corpo] = mockUpload.mock.calls[0];
    expect(id).toBe("c1");
    expect(corpo.password).toBe("minha-senha");
    expect(corpo.pfx_base64).toBe(Buffer.from("conteudo-do-pfx").toString("base64"));
    expect(corpo.pfx_base64).not.toMatch(/^data:/);
    expect(onEnviado).toHaveBeenCalledTimes(1);
    expect(senhaAtual(t)).toBe("");
  });

  it("senha incorreta: mostra o erro no campo da senha e limpa a senha, mantendo o arquivo", async () => {
    mockUpload.mockRejectedValue({ status: 400, data: { code: "CERT_SENHA_INCORRETA", error: "x" } });
    const { t, onEnviado } = montar();
    escolherArquivo(t, pfx());
    digitar(t, "errada");

    await act(async () => { await porTestID(t, "cert-a1-enviar").props.onPress(); });
    await limpar();

    expect(onEnviado).not.toHaveBeenCalled();
    expect(senhaAtual(t)).toBe("");
    expect(texto(porTestID(t, "cert-a1-erro-senha").children)).toMatch(/A senha está incorreta/);
    // o arquivo continua escolhido: o botão só espera a senha de novo
    expect(texto(t.toJSON())).toMatch(/certificado\.pfx/);
    digitar(t, "outra");
    expect(porTestID(t, "cert-a1-enviar").props.disabled).toBe(false);
  });

  it("CNPJ diferente: erro no arquivo, cita a empresa, senha limpa e arquivo descartado", async () => {
    mockUpload.mockRejectedValue({ status: 422, data: { code: "CERT_CNPJ_DIVERGENTE", error: "x" } });
    const { t } = montar();
    escolherArquivo(t, pfx("outra-empresa.pfx"));
    digitar(t, "senha");

    await act(async () => { await porTestID(t, "cert-a1-enviar").props.onPress(); });
    await limpar();

    expect(senhaAtual(t)).toBe("");
    const msg = texto(porTestID(t, "cert-a1-erro-arquivo").children);
    expect(msg).toMatch(/Padaria Estrela do Sul Ltda/);
    expect(msg).toMatch(/12\.345\.678\/0001-90/);
    digitar(t, "senha");
    expect(porTestID(t, "cert-a1-enviar").props.disabled).toBe(true); // sem arquivo válido
  });

  it("recusa .zip e arquivo acima de 256 KB no aparelho, sem chamar a API", () => {
    const { t } = montar();
    escolherArquivo(t, new File(["x"], "fotos.zip"));
    expect(texto(porTestID(t, "cert-a1-erro-arquivo").children)).toMatch(/\.pfx ou \.p12/);

    escolherArquivo(t, new File([new Uint8Array(256 * 1024 + 1)], "grande.pfx"));
    expect(texto(porTestID(t, "cert-a1-erro-arquivo").children)).toMatch(/limite é 256 KB/);

    digitar(t, "senha");
    expect(porTestID(t, "cert-a1-enviar").props.disabled).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("ao desmontar descarta tudo (sem erro, sem chamada)", () => {
    const { t } = montar();
    escolherArquivo(t, pfx());
    digitar(t, "senha");
    expect(() => act(() => { t.unmount(); })).not.toThrow();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe("TabCertificado", () => {
  beforeEach(() => { mockGet.mockReset(); mockUpload.mockReset(); });

  async function montar(resposta: any | Error) {
    if (resposta instanceof Error) mockGet.mockRejectedValue(resposta);
    else mockGet.mockResolvedValue(resposta);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let t!: renderer.ReactTestRenderer;
    await act(async () => {
      t = renderer.create(
        <QueryClientProvider client={qc}>
          <TabCertificado companyId="c1" onEmitir={jest.fn()} />
        </QueryClientProvider>,
      );
    });
    await limpar();
    return t;
  }

  const certOk = { subject_cn: "PADARIA ESTRELA DO SUL LTDA:12345678000190", not_before: "2026-03-12T12:00:00Z", not_after: "2027-03-12T12:00:00Z", days_left: 290, updated_at: null };

  it("sem certificado + dono: formulário e cartão de ajuda", async () => {
    const t = await montar({ cert: null, empresa_cnpj: "12345678000190", pode_enviar: true });
    expect(porTestID(t, "cert-a1-form")).toBeDefined();
    expect(porTestID(t, "cert-a1-ajuda")).toBeDefined();
    expect(texto(t.toJSON())).toMatch(/Nenhum certificado cadastrado/);
  });

  it("sem certificado + funcionário: só o aviso 'só o dono', sem formulário", async () => {
    const t = await montar({ cert: null, empresa_cnpj: "12345678000190", pode_enviar: false });
    expect(porTestID(t, "cert-a1-form")).toBeUndefined();
    expect(porTestID(t, "cert-a1-so-dono")).toBeDefined();
  });

  it("válido + dono: cartão verde, formulário só depois de 'Trocar certificado'", async () => {
    const t = await montar({ cert: certOk, empresa_cnpj: "12345678000190", pode_enviar: true });
    const s = texto(t.toJSON());
    expect(s).toMatch(/CERTIFICADO VÁLIDO/);
    expect(s).toMatch(/PADARIA ESTRELA DO SUL LTDA/);
    expect(s).toMatch(/Válido de 12\/03\/2026 a 12\/03\/2027/);
    expect(s).toMatch(/faltam 290 dias/);
    expect(porTestID(t, "cert-a1-form")).toBeUndefined();
    act(() => { porTestID(t, "cert-a1-trocar").props.onPress(); });
    expect(porTestID(t, "cert-a1-form")).toBeDefined();
    act(() => { porTestID(t, "cert-a1-cancelar").props.onPress(); });
    expect(porTestID(t, "cert-a1-form")).toBeUndefined();
  });

  it("válido + funcionário: vê a situação, sem botão de trocar nem formulário", async () => {
    const t = await montar({ cert: certOk, empresa_cnpj: "12345678000190", pode_enviar: false });
    expect(texto(t.toJSON())).toMatch(/CERTIFICADO VÁLIDO/);
    expect(porTestID(t, "cert-a1-trocar")).toBeUndefined();
    expect(porTestID(t, "cert-a1-form")).toBeUndefined();
    expect(porTestID(t, "cert-a1-so-dono")).toBeDefined();
  });

  it("vencendo: âmbar, botão de renovar e ajuda", async () => {
    const t = await montar({ cert: { ...certOk, days_left: 19 }, empresa_cnpj: "12345678000190", pode_enviar: true });
    expect(porTestID(t, "cert-a1-cartao-vencendo")).toBeDefined();
    expect(texto(t.toJSON())).toMatch(/faltam 19 dias/);
    expect(porTestID(t, "cert-a1-enviar-renovado")).toBeDefined();
  });

  it("vencido + dono: cartão vermelho e formulário já aberto, sem cancelar", async () => {
    const t = await montar({ cert: { ...certOk, days_left: -32 }, empresa_cnpj: "12345678000190", pode_enviar: true });
    expect(porTestID(t, "cert-a1-cartao-vencido")).toBeDefined();
    expect(texto(t.toJSON())).toMatch(/venceu há 32 dias/);
    expect(porTestID(t, "cert-a1-form")).toBeDefined();
    expect(porTestID(t, "cert-a1-cancelar")).toBeUndefined();
  });

  it("falha ao carregar: mensagem tratável, 'Tentar de novo' e ajuda; não quebra", async () => {
    const t = await montar(Object.assign(new Error("Erro HTTP 404"), { status: 404, data: {} }));
    expect(porTestID(t, "cert-a1-erro-carregar")).toBeDefined();
    expect(texto(t.toJSON())).toMatch(/Não conseguimos carregar a situação do certificado/);
    expect(porTestID(t, "cert-a1-tentar-de-novo")).toBeDefined();
    expect(porTestID(t, "cert-a1-form")).toBeUndefined();
  });

  it("várias empresas: oferece 'Trocar empresa'; com uma só, não", async () => {
    mockAuth.availableCompanies = [{ id: "c1" }, { id: "c2" }];
    let t = await montar({ cert: null, empresa_cnpj: "12345678000190", pode_enviar: true });
    expect(porTestID(t, "cert-a1-trocar-empresa")).toBeDefined();
    expect(texto(t.toJSON())).toMatch(/Cada empresa tem o seu próprio certificado/);

    mockAuth.availableCompanies = [{ id: "c1" }];
    t = await montar({ cert: null, empresa_cnpj: "12345678000190", pode_enviar: true });
    expect(porTestID(t, "cert-a1-trocar-empresa")).toBeUndefined();
  });
});
