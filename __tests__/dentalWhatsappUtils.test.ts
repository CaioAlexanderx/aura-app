// ============================================================
// AURA. — utils/whatsapp (odonto QA, 2026-09-16)
//
// O que estes testes provam:
//   1. normalizeBrPhone cobre os 3 formatos que aparecem no cadastro real
//      (só DDD+número, já com 55, lixo) sem duplicar nem inventar DDI.
//   2. buildWhatsAppUrl/buildTelUrl nunca produzem "wa.me/55undefined" —
//      o bug que motivou essa troca.
//   3. openWhatsApp abre o pop-up de forma SÍNCRONA no clique (web) — se
//      isso regredir pra dentro de um .then/async, o browser bloqueia.
//   4. Os textos-modelo batem com a redação aprovada (nome curto, sem
//      clínica quando não informada, data/hora em pt-BR).
// ============================================================
import { Platform } from "react-native";
import {
  normalizeBrPhone,
  buildWhatsAppUrl,
  buildTelUrl,
  openWhatsApp,
  confirmationText,
  genericText,
} from "@/utils/whatsapp";

describe("normalizeBrPhone", () => {
  it("prefixa 55 em numero de 11 digitos (DDD + celular)", () => {
    expect(normalizeBrPhone("11987654321")).toBe("5511987654321");
  });

  it("prefixa 55 em numero de 10 digitos (DDD + fixo)", () => {
    expect(normalizeBrPhone("1132654321")).toBe("551132654321");
  });

  it("mantem numero que ja vem com 55 (13 digitos)", () => {
    expect(normalizeBrPhone("5511987654321")).toBe("5511987654321");
  });

  it("mantem numero que ja vem com 55 (12 digitos)", () => {
    expect(normalizeBrPhone("551132654321")).toBe("551132654321");
  });

  it("ignora formatacao (parenteses, hifen, espaco)", () => {
    expect(normalizeBrPhone("(11) 98765-4321")).toBe("5511987654321");
  });

  it("retorna null pra telefone vazio ou ausente", () => {
    expect(normalizeBrPhone("")).toBeNull();
    expect(normalizeBrPhone(null)).toBeNull();
    expect(normalizeBrPhone(undefined)).toBeNull();
  });

  it("retorna null pra tamanho invalido (nao 10/11 nem 12/13 com 55)", () => {
    expect(normalizeBrPhone("123")).toBeNull();
    expect(normalizeBrPhone("123456789012345")).toBeNull();
  });

  it("retorna null pra 12/13 digitos que nao comecam com 55 (DDI diferente)", () => {
    expect(normalizeBrPhone("12312345678901")).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("monta a URL com numero normalizado e texto codificado", () => {
    const url = buildWhatsAppUrl("11987654321", "Olá!");
    expect(url).toBe("https://wa.me/5511987654321?text=Ol%C3%A1!");
  });

  it("monta a URL sem query quando nao ha texto", () => {
    expect(buildWhatsAppUrl("11987654321")).toBe("https://wa.me/5511987654321");
  });

  it("nao duplica o 55 quando o cadastro ja tem DDI", () => {
    const url = buildWhatsAppUrl("5511987654321");
    expect(url).toBe("https://wa.me/5511987654321");
  });

  it("retorna null sem telefone — nunca wa.me/55undefined", () => {
    expect(buildWhatsAppUrl(undefined)).toBeNull();
    expect(buildWhatsAppUrl(null)).toBeNull();
    expect(buildWhatsAppUrl("")).toBeNull();
  });
});

describe("buildTelUrl", () => {
  it("monta tel:+55... com numero normalizado", () => {
    expect(buildTelUrl("(11) 98765-4321")).toBe("tel:+5511987654321");
  });

  it("retorna null sem telefone", () => {
    expect(buildTelUrl(undefined)).toBeNull();
  });
});

describe("openWhatsApp", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    (Platform as any).OS = originalOS;
    jest.restoreAllMocks();
  });

  it("no web, chama window.open de forma SINCRONA (sem await) e retorna true", () => {
    (Platform as any).OS = "web";
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

    const result = openWhatsApp("11987654321", "Oi");

    // Sincrono: o spy ja foi chamado antes mesmo de qualquer microtask rodar.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://wa.me/5511987654321?text=Oi",
      "_blank",
      "noopener"
    );
    expect(result).toBe(true);
  });

  it("retorna false e nao chama window.open sem telefone", () => {
    (Platform as any).OS = "web";
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

    const result = openWhatsApp(undefined, "Oi");

    expect(openSpy).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

describe("confirmationText", () => {
  it("monta o texto de confirmacao com clinica", () => {
    // quinta-feira 17/09/2026, 09:00 local
    const when = new Date(2026, 8, 17, 9, 0);
    const text = confirmationText({ patientName: "Ana Souza", clinicName: "Clínica Sorriso", when });
    expect(text).toBe(
      "Olá, Ana! Aqui é da Clínica Sorriso. Confirmando sua consulta quinta, 17/09 às 09:00. Responda SIM para confirmar ou me avise se precisar remarcar."
    );
  });

  it("omite o trecho da clinica quando nao informada", () => {
    const when = new Date(2026, 8, 17, 9, 0);
    const text = confirmationText({ patientName: "Ana Souza", when });
    expect(text).toBe(
      "Olá, Ana! Confirmando sua consulta quinta, 17/09 às 09:00. Responda SIM para confirmar ou me avise se precisar remarcar."
    );
  });

  it("usa so o primeiro nome do paciente", () => {
    const when = new Date(2026, 8, 17, 9, 0);
    const text = confirmationText({ patientName: "João da Silva Pereira", when });
    expect(text.startsWith("Olá, João!")).toBe(true);
  });
});

describe("genericText", () => {
  it("saudacao curta com o primeiro nome", () => {
    expect(genericText({ patientName: "Ana Souza" })).toBe("Olá, Ana!");
  });
});
