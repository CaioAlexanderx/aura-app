// ============================================================
// Telefone: normalizador único (utils/telefone), 10/11/2026.
//
// Caso real: "5566992384539" (o +55 digitado) era cortado em 11 dígitos e
// gravado como "55669923845". Aqui: o 55 do país sai quando sobra dígito,
// o limite de tamanho vale depois de normalizar e nada é cortado em silêncio.
// ============================================================
import {
  normalizarTelefone, formatarTelefone, erroDoTelefone, telefoneParaEnviar,
  ERRO_TELEFONE_LONGO, TELEFONE_MAX_CARACTERES,
} from "../utils/telefone";
import { maskPhone } from "../utils/masks";
import { maskPhone as maskPhoneOdonto } from "../utils/mask";
import { fmtPhone } from "../components/crediario/lancamento/calculos";
import { mascaraDoZap, conferirZap, dicaDoZap } from "../utils/whatsappDoCadastro";
import { validarCadastroRapido } from "../utils/cadastroRapidoCliente";
import { validatePhone } from "../components/screens/configuracoes/shared";

describe("normalizarTelefone — casos do pedido", () => {
  it.each([
    ["+55 (66) 99238-4539", "66992384539", "(66) 99238-4539"],
    ["5566992384539", "66992384539", "(66) 99238-4539"],
    ["66992384539", "66992384539", "(66) 99238-4539"],
    ["(66) 9238-4539", "6692384539", "(66) 9238-4539"], // fixo, 10 dígitos
  ])("%s → %s → %s", (entrada, digitos, mascara) => {
    expect(normalizarTelefone(entrada)).toEqual({ digitos, erro: null });
    expect(formatarTelefone(entrada)).toBe(mascara);
    expect(telefoneParaEnviar(entrada)).toBe(digitos);
  });

  it("colado com espaços (e o maxLength comporta o colar)", () => {
    const colado = "  +55  66  99238  4539 ";
    expect(formatarTelefone(colado)).toBe("(66) 99238-4539");
    expect("+55 (66) 99238-4539".length).toBeLessThanOrEqual(TELEFONE_MAX_CARACTERES);
    expect(colado.length).toBeLessThanOrEqual(TELEFONE_MAX_CARACTERES);
  });

  it("dígitos a mais: erro gentil e NENHUM dígito cortado", () => {
    const r = normalizarTelefone("669923845391");
    expect(r.erro).toBe(ERRO_TELEFONE_LONGO);
    expect(r.digitos).toBe("669923845391");
    expect(formatarTelefone("669923845391")).toBe("669923845391");
    // 55 + 12 dígitos: tirar o 55 não basta; volta tudo, sem corte.
    expect(normalizarTelefone("+55 66 99238-45391")).toEqual({ digitos: "5566992384539" + "1", erro: ERRO_TELEFONE_LONGO });
    expect(erroDoTelefone("5566992384539")).toBeNull();
  });

  it("digitando o +55 tecla a tecla, nada se perde no fim", () => {
    let valor = "";
    for (const tecla of "5566992384539") valor = formatarTelefone(valor + tecla);
    expect(valor).toBe("(66) 99238-4539");
  });

  it("DDD 55 (RS) legítimo com 10 ou 11 dígitos fica intacto", () => {
    expect(formatarTelefone("55987654321")).toBe("(55) 98765-4321");
    expect(formatarTelefone("5533334444")).toBe("(55) 3333-4444");
  });

  it("00 internacional e 0 de longa distância saem quando sobram dígitos", () => {
    expect(formatarTelefone("0055 66 99238-4539")).toBe("(66) 99238-4539");
    expect(formatarTelefone("066992384539")).toBe("(66) 99238-4539");
    expect(formatarTelefone("0 15 66 99238-4539")).toBe("(66) 99238-4539");
  });

  it("idempotente e vazio continua vazio", () => {
    for (const v of ["5566992384539", "669923845391", "(66) 9238-4539", ""]) {
      expect(formatarTelefone(formatarTelefone(v))).toBe(formatarTelefone(v));
    }
    expect(formatarTelefone("")).toBe("");
    expect(formatarTelefone(null)).toBe("");
  });
});

describe("as máscaras do app usam o normalizador", () => {
  it.each([[maskPhone], [maskPhoneOdonto], [fmtPhone]])("%p", (fn) => {
    expect(fn("5566992384539")).toBe("(66) 99238-4539");
    expect(fn("+55 (66) 99238-4539")).toBe("(66) 99238-4539");
    expect(fn("(66) 9238-4539")).toBe("(66) 9238-4539");
    expect(fn("669923845391")).toBe("669923845391");
  });
});

describe("cadastro (porta de entrada): WhatsApp", () => {
  it("+55 colado vira o celular inteiro, com a máscara do mockup", () => {
    expect(mascaraDoZap("5566992384539")).toBe("(66) 9 9238-4539");
    expect(mascaraDoZap("+55 (38) 99948-5059")).toBe("(38) 9 9948-5059");
    expect(conferirZap("5566992384539")).toEqual({ ok: true, tipo: "ok" });
  });

  it("dígito a mais: dica de erro, nada cortado e conta não sai", () => {
    expect(mascaraDoZap("669923845391")).toBe("669923845391");
    const c = conferirZap("669923845391");
    expect(c).toEqual({ ok: false, tipo: "longo" });
    expect(dicaDoZap(c)).toEqual({ kind: "err", texto: ERRO_TELEFONE_LONGO });
  });
});

describe("validações dos formulários", () => {
  it("cadastro rápido de cliente manda DDD + número, sem o 55", () => {
    const r = validarCadastroRapido({ name: "Ana", birthDate: "", phone: "+55 (66) 99238-4539" });
    expect(r).toEqual({ ok: true, body: { name: "Ana", phone: "66992384539", birth_date: null } });
    expect(validarCadastroRapido({ name: "Ana", birthDate: "", phone: "669923845391" })).toEqual({ ok: false, erro: ERRO_TELEFONE_LONGO });
  });

  it("Configurações: +55 vale; dígito a mais tem a mensagem gentil", () => {
    expect(validatePhone("+55 (66) 99238-4539")).toBeNull();
    expect(validatePhone("(66) 9238-4539")).toBeNull();
    expect(validatePhone("669923845391")).toBe(ERRO_TELEFONE_LONGO);
    expect(validatePhone("6699")).toBe("Telefone inválido");
  });
});
