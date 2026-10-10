// ============================================================
// Crediário · impressão do carnê: formato e escopo (10/10/2026)
//
//   - a URL sem opções é a de sempre (backend antigo não pode notar diferença);
//   - bobina não manda `format`; A4 manda `format=a4`;
//   - um carnê só: `account=<uuid>`; grupo sem carnê: `account=none`;
//   - a última escolha fica lembrada; storage quebrado não derruba nada.
// ============================================================
import {
  carnePrintPath, lerFormatoCarne, salvarFormatoCarne, FORMATO_PADRAO,
  chavePixDoQr, ROTA_DA_CHAVE_PIX_DO_QR,
} from "@/utils/crediarioCarne";

const EMP = "emp-1";
const CLI = "cli-1";
const BASE = `/companies/${EMP}/print/credit/${CLI}/carne`;

describe("carnePrintPath", () => {
  it("sem opções, a URL é a de antes", () => {
    expect(carnePrintPath(EMP, CLI)).toBe(BASE);
    expect(carnePrintPath(EMP, CLI, {})).toBe(BASE);
  });

  it("bobina é o padrão do backend: não manda format", () => {
    expect(carnePrintPath(EMP, CLI, { format: "bobina" })).toBe(BASE);
  });

  it("A4 manda format=a4", () => {
    expect(carnePrintPath(EMP, CLI, { format: "a4" })).toBe(BASE + "?format=a4");
  });

  it("um carnê só manda account=<id>", () => {
    expect(carnePrintPath(EMP, CLI, { accountId: "acc-9" })).toBe(BASE + "?account=acc-9");
    expect(carnePrintPath(EMP, CLI, { format: "a4", accountId: "acc-9" })).toBe(BASE + "?format=a4&account=acc-9");
  });

  it("grupo sem carnê manda account=none; todos não manda account", () => {
    expect(carnePrintPath(EMP, CLI, { accountId: null })).toBe(BASE + "?account=none");
    expect(carnePrintPath(EMP, CLI, { format: "a4", accountId: undefined })).toBe(BASE + "?format=a4");
  });
});

// 10/10/2026 (correção): o aviso "sem chave Pix" olha a chave que o QR usa
// (digital_channel_config.pix_key), não a pix_key da régua de cobrança.
describe("chavePixDoQr", () => {
  it("com chave no canal digital, devolve a chave", () => {
    expect(chavePixDoQr({ isSuccess: true, data: { pix_key: " loja@pix.com " } })).toBe("loja@pix.com");
  });
  it("config carregada sem chave: null (mostra o aviso)", () => {
    expect(chavePixDoQr({ isSuccess: true, data: { pix_key: null } })).toBeNull();
    expect(chavePixDoQr({ isSuccess: true, data: { pix_key: "   " } })).toBeNull();
    expect(chavePixDoQr({ isSuccess: true, data: {} })).toBeNull();
  });
  it("carregando ou com erro: undefined (não acusa o que não conferiu)", () => {
    expect(chavePixDoQr({ isSuccess: false, data: undefined })).toBeUndefined();
    expect(chavePixDoQr({ isSuccess: false, data: { pix_key: null } })).toBeUndefined();
    expect(chavePixDoQr({ isSuccess: true, data: null })).toBeUndefined();
    expect(chavePixDoQr(undefined)).toBeUndefined();
  });
  it("a tela do crediário lê o canal digital, não a régua, e o atalho vai para o Meu Site", () => {
    const fonte = require("fs").readFileSync(
      require("path").join(__dirname, "..", "app", "(tabs)", "crediario.tsx"), "utf8");
    expect(fonte).toContain("pixKey={chavePixDoQr(canalQ)}");
    expect(fonte).toContain("/digital-channel`");
    expect(fonte).toContain("router.push(ROTA_DA_CHAVE_PIX_DO_QR as any)");
    expect(ROTA_DA_CHAVE_PIX_DO_QR).toBe("/canal?tab=site");
  });
});

describe("formato lembrado no aparelho", () => {
  function fakeStorage(inicial: Record<string, string> = {}) {
    const dados = { ...inicial };
    return {
      dados,
      getItem: (k: string) => (k in dados ? dados[k] : null),
      setItem: (k: string, v: string) => { dados[k] = v; },
    };
  }

  it("quem nunca escolheu começa na bobina", () => {
    expect(FORMATO_PADRAO).toBe("bobina");
    expect(lerFormatoCarne(fakeStorage())).toBe("bobina");
    expect(lerFormatoCarne(null)).toBe("bobina");
  });

  it("lembra a última escolha", () => {
    const st = fakeStorage();
    salvarFormatoCarne("a4", st);
    expect(lerFormatoCarne(st)).toBe("a4");
    salvarFormatoCarne("bobina", st);
    expect(lerFormatoCarne(st)).toBe("bobina");
  });

  it("valor estranho no storage volta para a bobina", () => {
    expect(lerFormatoCarne(fakeStorage({ "aura.crediario.carne.formato": "a3" }))).toBe("bobina");
  });

  it("storage que lança não derruba a tela", () => {
    const quebrado = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceeded"); },
    };
    expect(lerFormatoCarne(quebrado)).toBe("bobina");
    expect(() => salvarFormatoCarne("a4", quebrado)).not.toThrow();
  });
});
