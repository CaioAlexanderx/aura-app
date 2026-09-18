// E-mail de notificação de empresa específica (18/09/2026) — regras do painel.
import {
  EMPTY_DRAFT, EmailDraft, parseValorBRL, parseDataBR, buildSendBody, subjectOf, sourceLabel,
} from "@/components/admin/bannerEmail";

const PIX = "00020101021226800014br.gov.bcb.pix2558pix.asaas.com/qr/cobv/2f87d4d0";
const base: EmailDraft = { ...EMPTY_DRAFT, enabled: true, selected: ["contato@fpkt.org.br"] };

describe("parseValorBRL", () => {
  test("formatos de digitação", () => {
    expect(parseValorBRL("169,00")).toBe(169);
    expect(parseValorBRL("1.169,90")).toBe(1169.9);
    expect(parseValorBRL("R$ 169")).toBe(169);
    expect(parseValorBRL("169.5")).toBe(169.5);
    expect(parseValorBRL("")).toBeNull();
    expect(parseValorBRL("abc")).toBeNaN();
  });
});

describe("parseDataBR", () => {
  test("converte e recusa data inexistente", () => {
    expect(parseDataBR("18/09/2026")).toBe("2026-09-18");
    expect(parseDataBR("")).toBeNull();
    expect(parseDataBR("31/02/2026")).toBeUndefined();
    expect(parseDataBR("2026-09-18")).toBeUndefined();
  });
});

describe("buildSendBody", () => {
  test("sem destinatário não envia", () => {
    expect(buildSendBody({ ...base, selected: [] }, "T").error).toMatch(/destinatário/);
  });
  test("sem PIX: só destinatários e assunto (= título até editar)", () => {
    expect(buildSendBody(base, "Lembrete").body).toEqual({ recipients: ["contato@fpkt.org.br"], subject: "Lembrete", pix: null });
    expect(subjectOf({ ...base, subjectTouched: true, subject: "Outro" }, "Lembrete")).toBe("Outro");
  });
  test("com PIX: valor e data convertidos", () => {
    const r = buildSendBody({ ...base, pixCode: " " + PIX + " ", pixAmount: "169,00", pixDue: "18/09/2026" }, "T");
    expect(r.body!.pix).toEqual({ code: PIX, amount: 169, due_date: "2026-09-18" });
  });
  test("PIX incompleto ou inválido", () => {
    expect(buildSendBody({ ...base, pixAmount: "169,00" }, "T").error).toMatch(/copia e cola/);
    expect(buildSendBody({ ...base, pixCode: "abc" }, "T").error).toMatch(/000201/);
    expect(buildSendBody({ ...base, pixCode: PIX, pixAmount: "x" }, "T").error).toMatch(/Valor/);
    expect(buildSendBody({ ...base, pixCode: PIX, pixDue: "31/02/2026" }, "T").error).toMatch(/Vencimento/);
  });
});

test("rótulo da origem do e-mail", () => {
  expect(sourceLabel({ email: "a", sources: ["owner", "company"], name: null, selected: true })).toBe("responsável e empresa");
  expect(sourceLabel({ email: "a", sources: ["member"], name: null, selected: false })).toBe("equipe");
});
