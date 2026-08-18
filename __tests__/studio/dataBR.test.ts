// ============================================================
// AURA STUDIO · Campo de data no formato brasileiro (PDV)
//
// A lojista lê e digita DD/MM/AAAA; o backend valida AAAA-MM-DD. Toda a
// tradução mora entre isoParaBr e brDateToIso, e é o ida-e-volta entre as
// duas que estes testes travam.
//
// O risco clássico: usar new Date(iso) pra formatar. 'AAAA-MM-DD' é data
// pura e vira meia-noite UTC — em São Paulo isso volta um dia, e o campo
// mostraria uma data diferente da que a lojista combinou.
// ============================================================
import { isoParaBr } from "../../components/studio/pdv/DataBR";
import { maskDateBr, brDateToIso } from "../../utils/masks";

describe("isoParaBr — o que a lojista lê", () => {
  test("converte ISO para o formato brasileiro", () => {
    expect(isoParaBr("2026-08-25")).toBe("25/08/2026");
    expect(isoParaBr("2026-01-05")).toBe("05/01/2026");
  });

  test("aceita timestamp completo, usando só a data", () => {
    expect(isoParaBr("2026-08-25T23:30:00Z")).toBe("25/08/2026");
  });

  test("vazio ou inválido não imprime lixo no campo", () => {
    expect(isoParaBr(null)).toBe("");
    expect(isoParaBr(undefined)).toBe("");
    expect(isoParaBr("")).toBe("");
    expect(isoParaBr("qualquer coisa")).toBe("");
  });

  // A armadilha que este componente existe pra evitar.
  test("não volta um dia por causa de fuso", () => {
    for (const iso of ["2026-01-01", "2026-03-15", "2026-08-25", "2026-12-31"]) {
      const dia = iso.slice(8, 10);
      expect(isoParaBr(iso).slice(0, 2)).toBe(dia);
    }
  });
});

describe("ida e volta: ISO → BR → ISO", () => {
  test("a data sobrevive à viagem completa", () => {
    for (const iso of ["2026-08-25", "2026-01-01", "2026-12-31", "2028-02-29"]) {
      expect(brDateToIso(isoParaBr(iso))).toBe(iso);
    }
  });

  test("digitar só números produz a data certa", () => {
    // é assim que a lojista digita: 25082026, sem barras
    expect(maskDateBr("25082026")).toBe("25/08/2026");
    expect(brDateToIso(maskDateBr("25082026"))).toBe("2026-08-25");
  });
});

describe("o que o campo NÃO deve propagar", () => {
  // Enquanto ela digita, o valor fica incompleto — propagar isso mandaria
  // data quebrada pro backend a cada tecla.
  test("data pela metade não vira ISO", () => {
    for (const parcial of ["2", "25", "25/0", "25/08", "25/08/20"]) {
      expect(brDateToIso(parcial)).toBeNull();
    }
  });

  test("data impossível é recusada", () => {
    expect(brDateToIso("31/02/2026")).toBeNull();  // fevereiro não tem 31
    expect(brDateToIso("00/08/2026")).toBeNull();
    expect(brDateToIso("25/13/2026")).toBeNull();
    expect(brDateToIso("29/02/2027")).toBeNull();  // 2027 não é bissexto
  });

  test("29/02 passa em ano bissexto", () => {
    expect(brDateToIso("29/02/2028")).toBe("2028-02-29");
  });
});

describe("máscara enquanto digita", () => {
  test("as barras entram sozinhas", () => {
    expect(maskDateBr("2")).toBe("2");
    expect(maskDateBr("25")).toBe("25");
    expect(maskDateBr("250")).toBe("25/0");
    expect(maskDateBr("2508")).toBe("25/08");
    expect(maskDateBr("250820")).toBe("25/08/20");
    expect(maskDateBr("25082026")).toBe("25/08/2026");
  });

  test("ignora o que não é número e não passa de 8 dígitos", () => {
    expect(maskDateBr("25a08b2026")).toBe("25/08/2026");
    expect(maskDateBr("250820269999")).toBe("25/08/2026");
  });
});
