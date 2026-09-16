// ============================================================
// I0.5 — ficha do cliente: helpers puros dos 3 botões mortos.
//
// customerActions.ts reaproveita normalizeBrPhone/buildWaMeUrl de
// services/messaging (mesma normalização E.164 do fluxo de aniversário).
// Estes testes cobrem:
//   - normalização de telefone (DDI 55 quando falta, formatos com máscara)
//   - texto das duas mensagens (saudação e pedido de avaliação)
//   - null quando o telefone é inválido/ausente (botão deve desabilitar)
// ============================================================
import {
  hasUsablePhone,
  buildGreetingMessage,
  buildReviewRequestMessage,
  buildGreetingWaLink,
  buildReviewRequestWaLink,
  firstName,
} from "@/components/screens/clientes/customerActions";

describe("firstName", () => {
  it("pega só o primeiro nome", () => {
    expect(firstName("Ana Souza Lima")).toBe("Ana");
  });
  it("nome vazio/nulo não quebra", () => {
    expect(firstName("")).toBe("");
    expect(firstName(null as any)).toBe("");
  });
});

describe("hasUsablePhone", () => {
  it("telefone com DDD (10/11 dígitos) é usável mesmo sem DDI", () => {
    expect(hasUsablePhone("11987654321")).toBe(true);
    expect(hasUsablePhone("1187654321")).toBe(true);
  });
  it("telefone já em E.164 BR é usável", () => {
    expect(hasUsablePhone("5511987654321")).toBe(true);
  });
  it("telefone mascarado (parênteses/traço) também é usável", () => {
    expect(hasUsablePhone("(11) 98765-4321")).toBe(true);
  });
  it("sem telefone, vazio ou malformado não é usável", () => {
    expect(hasUsablePhone(null)).toBe(false);
    expect(hasUsablePhone(undefined)).toBe(false);
    expect(hasUsablePhone("")).toBe(false);
    expect(hasUsablePhone("12345")).toBe(false);
  });
});

describe("mensagens", () => {
  it("saudação usa o primeiro nome do cliente e o nome da loja", () => {
    const msg = buildGreetingMessage("Ana Souza", "Loja da Ana");
    expect(msg).toContain("Ana");
    expect(msg).toContain("Loja da Ana");
    expect(msg).not.toContain("Souza");
  });
  it("pedido de avaliação também usa primeiro nome + loja", () => {
    const msg = buildReviewRequestMessage("Carlos Pereira", "Studio Bela");
    expect(msg).toContain("Carlos");
    expect(msg).toContain("Studio Bela");
    expect(msg.toLowerCase()).toContain("avaliação");
  });
});

describe("links wa.me", () => {
  it("com telefone válido, monta a URL com o texto url-encoded", () => {
    const url = buildGreetingWaLink("11987654321", "Ana", "Loja X");
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\/wa\.me\/5511987654321\?text=/);
    expect(decodeURIComponent(url!.split("text=")[1])).toContain("Oi, Ana!");
  });

  it("normaliza DDI 55 quando falta, no pedido de avaliação", () => {
    const url = buildReviewRequestWaLink("(21) 91234-5678", "Bia", "Loja Y");
    expect(url).toContain("https://wa.me/5521912345678");
  });

  it("sem telefone, retorna null (botão deve ficar desabilitado)", () => {
    expect(buildGreetingWaLink(null, "Ana", "Loja X")).toBeNull();
    expect(buildGreetingWaLink("", "Ana", "Loja X")).toBeNull();
    expect(buildReviewRequestWaLink(undefined, "Ana", "Loja X")).toBeNull();
  });

  it("telefone malformado (poucos dígitos) retorna null", () => {
    expect(buildGreetingWaLink("123", "Ana", "Loja X")).toBeNull();
  });
});
