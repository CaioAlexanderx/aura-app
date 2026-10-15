// ============================================================
// Aba "Certificado A1" — teste de fonte (14/10/2026)
//
// Tela que lida com certificado e senha: o que importa aqui é o que NÃO pode
// regredir. Lemos os arquivos e conferimos:
//  1. a aba está em TABS (por último) e o NF-e a renderiza;
//  2. o formulário só aparece com `pode_enviar` (funcionário vê o aviso);
//  3. a senha é limpa depois do envio (sucesso e erro) e ao desmontar, usa
//     secureTextEntry, e o base64 não vai para o estado nem para o cache;
//  4. nada de console.*, storage ou analytics nos arquivos da aba;
//  5. o TabConfig legado e a rota antiga /nfe/certificate não foram tocados;
//  6. não é módulo novo (nada em NAV / MODULE_PLAN_MAP / PERM_TO_MODULES).
// ============================================================
import fs from "fs";
import path from "path";

const raiz = path.resolve(__dirname, "..");
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");

const form = ler("components/screens/nfe/CertificadoForm.tsx");
const aba = ler("components/screens/nfe/TabCertificado.tsx");
const ajuda = ler("components/screens/nfe/CertificadoAjuda.tsx");
const api = ler("services/fiscalCertificateApi.ts");
const util = ler("utils/certificadoA1.ts");
const tela = ler("app/(tabs)/nfe.tsx");

describe("registro da aba", () => {
  it("'Certificado A1' é a última de TABS e as outras mantêm o índice", () => {
    const shared = ler("components/screens/nfe/shared.tsx");
    expect(shared).toMatch(
      /export const TABS = \["Documentos", "Emitir NFS-e", "Emitir NFC-e", "Certificado A1"\];/,
    );
    expect(shared).toMatch(/export const TAB_CERTIFICADO = TABS\.indexOf\("Certificado A1"\);/);
    // setTab(1) = NFS-e e setTab(2) = NFC-e seguem valendo
    expect(tela).toMatch(/setTab\(2\)/);
  });

  it("app/(tabs)/nfe.tsx renderiza TabCertificado na aba, por empresa (key)", () => {
    expect(tela).toMatch(/tab === TAB_CERTIFICADO && company\?\.id/);
    expect(tela).toMatch(/<TabCertificado key=\{company\.id\} companyId=\{company\.id\}/);
  });

  it("não é módulo novo: sem chave em NAV, MODULE_PLAN_MAP ou PERM_TO_MODULES", () => {
    const hook = ler("hooks/useVisibleModules.ts");
    expect(hook).not.toMatch(/nfe[._-]?certificad|certificado[._-]?a1|fiscal[._-]?cert/i);
    expect(aba).not.toMatch(/useVisibleModules|MODULE_PLAN_MAP|PERM_TO_MODULES|\bplan\b/);
  });
});

describe("quem vê o formulário", () => {
  it("o formulário só renderiza com pode_enviar; funcionário vê o aviso 'só o dono'", () => {
    expect(aba).toMatch(/const podeEnviar = !!data\.pode_enviar/);
    // sem certificado
    expect(aba).toMatch(/podeEnviar \? \([\s\S]{0,200}<CertificadoForm[\s\S]{0,400}\) : \(\s*<SoODono \/>/);
    // com certificado
    expect(aba).toMatch(/const mostrarForm = podeEnviar && \(formAberto \|\| vencido\)/);
    expect(aba).toMatch(/!podeEnviar && <SoODono \/>/);
    expect(aba).toMatch(/Só o dono da empresa cadastra o certificado/);
  });

  it("não decide dono por conta própria: a autoridade é o servidor", () => {
    expect(aba).not.toMatch(/owner|member_role|\brole\b|isStaff/);
  });

  it("falha do GET mostra mensagem tratável com 'Tentar de novo', sem quebrar a tela", () => {
    expect(aba).toMatch(/isError \|\| !data/);
    expect(aba).toMatch(/textoErroDeCarregamento/);
    expect(aba).toMatch(/Tentar de novo/);
  });
});

describe("segredos (senha e arquivo)", () => {
  it("senha em secureTextEntry, com alternar mostrar/ocultar", () => {
    expect(form).toMatch(/secureTextEntry=\{!mostrar\}/);
    expect(form).toMatch(/Mostrar senha/);
    expect(form).toMatch(/Ocultar senha/);
    expect(form).toMatch(/autoComplete="off"/);
  });

  it("limpa a senha em qualquer resposta (sucesso e erro) e ao desmontar", () => {
    const enviar = form.slice(form.indexOf("async function enviar()"), form.indexOf("const titulo ="));
    // sucesso
    expect(enviar).toMatch(/fiscalCertificateApi\.upload[\s\S]*?setSenha\(""\)[\s\S]*?onEnviado\(resultado\)/);
    // erro
    expect(enviar).toMatch(/catch \(e: any\) \{[\s\S]*?setSenha\(""\)/);
    // desmontar
    expect(form).toMatch(/return \(\) => \{[\s\S]*?montado\.current = false;[\s\S]*?setSenha\(""\);[\s\S]*?setArquivo\(null\);/);
  });

  it("o base64 vive só numa variável local do envio, zerada no finally; nunca em estado", () => {
    expect(form).not.toMatch(/useState[^;]*base64/i);
    expect(form).not.toMatch(/set(Pfx|Base64)/i);
    expect(form).toMatch(/let base64 = ""/);
    expect(form).toMatch(/finally \{\s*base64 = "";/);
  });

  it("envio sem useMutation (o cache do react-query guardaria senha e base64)", () => {
    // comentários podem citar o nome; o que não pode é importar ou chamar
    for (const src of [form, aba, api]) {
      expect(src).not.toMatch(/useMutation\(/);
      expect(src).not.toMatch(/import[^;]*useMutation/);
    }
  });

  it("nada de console.*, storage ou analytics na aba, no cliente de API ou nas regras", () => {
    for (const src of [form, aba, ajuda, api, util]) {
      expect(src).not.toMatch(/console\.(log|warn|error|info|debug)/);
      expect(src).not.toMatch(/localStorage|sessionStorage\.setItem\([^)]*(senha|password|pfx)/i);
      expect(src).not.toMatch(/analytics|track\(|sentry|breadcrumb/i);
    }
    // o único sessionStorage da aba é o redirect pós-troca de empresa (sem segredo)
    expect(aba.match(/sessionStorage\.setItem\([^)]*\)/g)).toEqual(['sessionStorage.setItem("aura_post_switch_redirect", path)']);
  });

  it("a senha nunca vai para toast, link ou mensagem de erro", () => {
    expect(form).not.toMatch(/toast\./);
    expect(form).not.toMatch(/erroDeEnvio\([^)]*senha/);
    expect(ajuda).not.toMatch(/useState|TextInput|\{senha\}|password/i); // o cartão de ajuda nem tem acesso à senha
    expect(util).not.toMatch(/function mensagemDeAjuda\([^)]*(senha|password|pfx)/i);
  });

  it("POST sem retry e com timeout de 20 s", () => {
    expect(api).toMatch(/retry: 0/);
    expect(api).toMatch(/timeout: 20000/);
  });

  it("limite de 256 KB e extensão validados no aparelho antes de enviar", () => {
    expect(form).toMatch(/validarArquivo\(\{ name: f\.name, size: f\.size \}\)/);
    expect(form).toMatch(/validarArquivo\(\{ name: arquivo\.name, size: arquivo\.size \}\)/);
    expect(form).toMatch(/accept = "\.pfx,\.p12"/);
  });
});

describe("não mexe no legado", () => {
  it("TabConfig.tsx e a rota antiga /nfe/certificate seguem como estavam", () => {
    const cfg = ler("components/screens/nfe/TabConfig.tsx");
    expect(cfg).not.toMatch(/fiscal-certificate|fiscalCertificateApi|TabCertificado|CertificadoForm/);
    expect(cfg).toMatch(/RegimeFiscal/);
    const nfeApi = ler("services/nfeApi.ts");
    expect(nfeApi).not.toMatch(/fiscal-certificate/);
    expect(api).not.toMatch(/\/nfe\/certificate/);
    expect(aba + form + ajuda).not.toMatch(/\/nfe\/certificate/);
  });

  it("usa o número e o texto de ajuda aprovados", () => {
    expect(util).toMatch(/5511956305269/);
    expect(util).toMatch(/Olá! Quero ajuda para/);
  });
});
