// QA odonto (16/09/2026): telefone colado do WhatsApp vem com codigo do pais
// na frente ("5599999990004") — a mascara tratava "55" como DDD e truncava em
// 11 digitos, perdendo o ultimo digito real do numero.
import { maskPhone } from "../utils/mask";

describe("maskPhone — codigo do pais colado", () => {
  it("remove o 55 colado sem espaco (13 digitos) e mascara os 11 nacionais", () => {
    expect(maskPhone("5599999990004")).toBe("(99) 99999-0004");
  });

  it("remove +55 com espacos/parenteses e mascara os 11 nacionais", () => {
    expect(maskPhone("+55 (11) 98765-4321")).toBe("(11) 98765-4321");
  });

  it("numero nacional de 11 digitos sem codigo do pais continua normal", () => {
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("numero fixo de 10 digitos sem codigo do pais continua normal", () => {
    expect(maskPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("DDD 55 legitimo (Santa Maria/RS) com 11 digitos nao e tratado como codigo do pais", () => {
    expect(maskPhone("55987654321")).toBe("(55) 98765-4321");
  });

  it("DDD 55 legitimo com 10 digitos (fixo) nao e tratado como codigo do pais", () => {
    expect(maskPhone("5533334444")).toBe("(55) 3333-4444");
  });

  it("e idempotente: aplicar de novo no resultado ja mascarado nao muda nada", () => {
    const once = maskPhone("5599999990004");
    expect(maskPhone(once)).toBe(once);
  });

  it("string vazia continua vazia", () => {
    expect(maskPhone("")).toBe("");
  });
});
