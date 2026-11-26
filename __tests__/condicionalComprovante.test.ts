// C8: mensagem de WhatsApp (texto do mockup, sem termos) e impressão do comprovante.
jest.mock("@/services/api", () => ({ BASE_URL: "https://api.exemplo.test" }));
jest.mock("@/stores/auth", () => ({ useAuthStore: { getState: () => ({ token: "tok" }) } }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/utils/whatsapp", () => ({ openWhatsApp: jest.fn(() => true) }));

import { textoDaCondicional, abrirWhatsappDaCondicional } from "@/utils/condicionalWhatsapp";
import { urlDoComprovanteDaCondicional, imprimirComprovanteDaCondicional } from "@/services/imprimirCondicional";
import { openPrintWindow } from "@/services/printWindow";
import { openWhatsApp } from "@/utils/whatsapp";

const detalhe = {
  numero_exibicao: "C-0031",
  customer_name: "Marina Duarte",
  customer_phone: "11988880142",
  seller_name: "Jéssica",
  created_at: "2026-11-25T13:42:00.000Z",
  due_date: "2026-11-28",
  terms: "TEXTO DOS TERMOS DA LOJA",
  items: [
    { product_name: "Vestido Midi Lívia", color_name: "Verde-oliva", size_label: "M", unit_price: 189.9 },
    { product_name: "Blusa Tricô Nina", color_name: "Off-white", size_label: "P", unit_price: "129.90" },
    { product_name: "Brinco Argola Luz", color_name: "Dourado", size_label: null, unit_price: 69.9 },
  ],
};

const ESPERADO = `Oi, Marina! Aqui é a Jéssica, da Loja Centro.
Estas são as peças que você levou em condicional hoje (25/11):

• Vestido Midi Lívia, verde-oliva, M: R$ 189,90
• Blusa Tricô Nina, off-white, P: R$ 129,90
• Brinco Argola Luz, dourado: R$ 69,90

Total das peças: R$ 389,70
Combinamos a devolução até sábado, 28/11.

É só me contar com quais você vai ficar. Qualquer dúvida, estou por aqui!`;

describe("textoDaCondicional", () => {
  test("é exatamente o texto do mockup e não leva os termos", () => {
    const t = textoDaCondicional(detalhe, "Loja Centro", "2026-11-25");
    expect(t).toBe(ESPERADO);
    expect(t).not.toContain("TERMOS");
  });

  test("retirada em outro dia: 'em dd/mm'", () => {
    expect(textoDaCondicional(detalhe, "Loja Centro", "2026-11-26")).toContain("condicional em 25/11:");
  });

  test("sem vendedora e sem cor/tamanho não sobra vírgula nem 'a'", () => {
    const t = textoDaCondicional(
      { ...detalhe, seller_name: null, items: [{ product_name: "Cinto", unit_price: 79.9 }] },
      "Loja Centro", "2026-11-25",
    );
    expect(t.startsWith("Oi, Marina! Aqui é da Loja Centro.")).toBe(true);
    expect(t).toContain("• Cinto: R$ 79,90");
  });
});

describe("abrirWhatsappDaCondicional", () => {
  test("abre o wa.me da cliente com o texto pronto", () => {
    expect(abrirWhatsappDaCondicional(detalhe, "Loja Centro")).toBe(true);
    const [fone, texto] = (openWhatsApp as jest.Mock).mock.calls[0];
    expect(fone).toBe("11988880142");
    expect(texto).toContain("Total das peças: R$ 389,70");
  });
});

describe("imprimir o comprovante", () => {
  test("URLs da bobina e do A4", () => {
    expect(urlDoComprovanteDaCondicional("L1", "C1", "bobina")).toBe("https://api.exemplo.test/companies/L1/print/condicional/C1?autoprint=1");
    expect(urlDoComprovanteDaCondicional("L1", "C1", "a4")).toBe("https://api.exemplo.test/companies/L1/print/condicional/C1/a4?autoprint=1");
  });

  test("abre a janela já no clique e busca com o token", async () => {
    (openPrintWindow as jest.Mock).mockImplementation(async (fetchContent: any) => { await fetchContent(); return "ok"; });
    (global as any).fetch = jest.fn(async () => ({ ok: true, text: async () => "<html></html>" }));
    expect(await imprimirComprovanteDaCondicional("L1", "C1", "a4")).toBe("ok");
    const [url, init] = (global as any).fetch.mock.calls[0];
    expect(url).toContain("/print/condicional/C1/a4");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect((openPrintWindow as jest.Mock).mock.calls[0][1]).toContain("width=900");
  });

  test("erro do servidor vira mensagem na janela", async () => {
    let r: any;
    (openPrintWindow as jest.Mock).mockImplementation(async (fetchContent: any) => { r = await fetchContent(); return "error"; });
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    await imprimirComprovanteDaCondicional("L1", "C1", "bobina");
    expect(r).toEqual({ ok: false, error: "Não deu para carregar o comprovante (404)." });
  });
});
