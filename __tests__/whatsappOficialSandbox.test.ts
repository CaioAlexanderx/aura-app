// A empresa de teste (is_sandbox) vê a tela do WhatsApp oficial; a real, sem
// número e sem ser equipe, continua sem ver. No consolidado a flag não conta.
import { empresaSandbox, whatsappOficialLiberadoPara, whatsappOficialVisivel } from "@/utils/whatsappOficialLiberado";

describe("WhatsApp oficial: empresa sandbox", () => {
  it("empresaSandbox lê só is_sandbox === true da empresa atual", () => {
    expect(empresaSandbox({ is_sandbox: true })).toBe(true);
    expect(empresaSandbox({ is_sandbox: false })).toBe(false);
    expect(empresaSandbox({ is_sandbox: "true" })).toBe(false);
    expect(empresaSandbox({})).toBe(false);
    expect(empresaSandbox(null)).toBe(false);
  });

  it("no consolidado a flag não conta", () => {
    expect(empresaSandbox({ is_sandbox: true }, true)).toBe(false);
  });

  it("sandbox vê, sem número e sem ser equipe", () => {
    const user = { is_staff: false };
    expect(whatsappOficialVisivel(null, user, false, true)).toBe(true);
    expect(whatsappOficialLiberadoPara(user, false, true)).toBe(true);
  });

  it("empresa real sem número e sem ser equipe continua sem ver", () => {
    const user = { is_staff: false };
    expect(whatsappOficialVisivel(null, user, false, empresaSandbox({ is_sandbox: false }))).toBe(false);
    expect(whatsappOficialVisivel({ connected: false }, user, false)).toBe(false);
    expect(whatsappOficialLiberadoPara(user, false)).toBe(false);
  });
});
