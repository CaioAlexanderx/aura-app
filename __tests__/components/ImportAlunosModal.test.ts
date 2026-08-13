// ============================================================
// ImportAlunosModal — de-para de colunas e prévia do import de alunos
//
// Este arquivo nasceu do achado de produção de 12/08/2026: a planilha real
// do dojô Areikan (484 alunos, 15 colunas) entrava com 10 colunas
// IGNORADAS e "0 com responsável", porque o front fazia lookup EXATO em
// HEADER_MAP ("Graduação KYU" → "graduacao kyu" não bate com "graduacao")
// e a interface DojoImportRow só tipava 7 campos. O backend já aceitava as
// 15 desde o Aura-backend#480 (F12).
//
// Só as funções puras são exercitadas (rowsToImport/parseCsv/resumoPrevia/
// responsavelDerivado/matchHeaderLoose/pareceInativo) — elas já eram
// exportadas justamente para isso. Os módulos de UI/rede são mockados por
// nome: nada aqui depende de React, QueryClient, tema ou request().
// ============================================================

jest.mock("react-native", () => ({
  Modal: "Modal",
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  Platform: { OS: "web" },
  StyleSheet: { create: (s: any) => s },
}));

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/KarateButton", () => ({ KarateButton: "KarateButton" }));
jest.mock("@/components/karate/Stepper", () => ({ Stepper: "Stepper" }));

// Sem rede: DojoImportRow é só tipo (apagado na compilação); o único valor
// realmente usado em runtime é DOJO_IMPORT_MAX_ROWS.
jest.mock("@/services/karateDojoStudentsApi", () => ({
  karateDojoStudentsApi: { importStudents: jest.fn() },
  DOJO_IMPORT_MAX_ROWS: 500,
}));

jest.mock("@/constants/karateTheme", () => ({
  KarateColors: {
    ink: "#111", ink2: "#333", ink3: "#666", ink4: "#999",
    border: "#ddd", border2: "#ccc", surface: "#fff", glass2: "#fafafa",
    bg2: "#eee", primary: "#7c3aed", primaryLine: "#c4b5fd",
    danger: "#c0392b", dangerSoft: "#fdecea", ok: "#2e7d32", warn: "#f59e0b",
  },
  KarateRadius: { sm: 8, md: 12, lg: 16 },
  KarateBelts: {},
  resolveBeltKey: () => null,
}));

import {
  rowsToImport,
  parseCsv,
  matchHeaderLoose,
  resumoPrevia,
  responsavelDerivado,
  pareceInativo,
} from "@/components/karate/dojoAlunos/ImportAlunosModal";

// Idade é relativa a HOJE — 01/01 evita qualquer dúvida de mês/dia.
const ANO = new Date().getFullYear();
const NASC_MENOR = `01/01/${ANO - 10}`;
const NASC_ADULTO = `01/01/${ANO - 30}`;

// Cabeçalho EXATO da planilha do Areikan (15 colunas).
const AREIKAN_HEADER = [
  "Nome", "Graduação KYU", "Academia", "Ativo", "Data Nascimento", "RG", "CPF",
  "Pai", "Mãe", "Telefone", "Endereço", "CEP", "Bairro", "Cidade", "Email",
];

const AREIKAN_ROW = [
  "Davi Souza", "3º Kyu - Marrom", "Areikan Centro", "Sim", "12/03/2014",
  "1234567", "111.111.111-11", "João Souza", "Maria Souza", "(91) 9 8888-7777",
  "Rua das Flores 123", "66000-000", "Umarizal", "Belém", "davi@exemplo.com",
];

describe("rowsToImport — planilha real do Areikan (15 colunas)", () => {
  it("casa TODAS as 15 colunas nas chaves que o backend espera", () => {
    const { rows, unknownHeaders, hasNameCol } = rowsToImport([AREIKAN_HEADER, AREIKAN_ROW]);

    expect(hasNameCol).toBe(true);
    expect(unknownHeaders).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      full_name: "Davi Souza",
      belt_label: "3º Kyu - Marrom",
      academia: "Areikan Centro",
      status: "Sim",
      birth_date: "2014-03-12",
      rg: "1234567",
      cpf: "111.111.111-11",
      father_name: "João Souza",
      mother_name: "Maria Souza",
      phone: "(91) 9 8888-7777",
      address: "Rua das Flores 123",
      zip_code: "66000-000",
      neighborhood: "Umarizal",
      city: "Belém",
      email: "davi@exemplo.com",
    });
  });

  it("reporta os 15 campos reconhecidos, na ordem da planilha", () => {
    const { mappedFields } = rowsToImport([AREIKAN_HEADER, AREIKAN_ROW]);
    expect(mappedFields).toEqual([
      "full_name", "belt_label", "academia", "status", "birth_date", "rg", "cpf",
      "father_name", "mother_name", "phone", "address", "zip_code",
      "neighborhood", "city", "email",
    ]);
  });

  it("NÃO normaliza dado nenhum — telefone, CPF, faixa e endereço vão crus", () => {
    const cru = [...AREIKAN_ROW];
    cru[1] = "Azul Escura";              // grafia que o backend resolve
    cru[6] = "000.000.000-00";           // DV inválido = warning no backend, não bloqueio
    cru[9] = "91 9  8888 7777  ";        // máscara quebrada + espaços
    cru[10] = "Av. Nazaré, 1200 apto 3"; // número grudado no endereço
    const { rows } = rowsToImport([AREIKAN_HEADER, cru]);
    expect(rows[0].belt_label).toBe("Azul Escura");
    expect(rows[0].cpf).toBe("000.000.000-00");
    expect(rows[0].phone).toBe("91 9  8888 7777"); // só o trim das pontas
    expect(rows[0].address).toBe("Av. Nazaré, 1200 apto 3");
  });

  it("célula vazia não vira chave (dado ausente é neutro)", () => {
    const parcial = ["Só o Nome", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    const { rows } = rowsToImport([AREIKAN_HEADER, parcial]);
    expect(rows[0]).toEqual({ full_name: "Só o Nome" });
  });
});

describe("rowsToImport — cabeçalho com acento e caixa variada", () => {
  it("acento, caixa alta e pontuação não impedem o casamento", () => {
    const header = ["NOME COMPLETO", "graduação kyu", "MÃE", "Endereço", "MUNICÍPIO", "E-mail"];
    const { rows, unknownHeaders } = rowsToImport([
      header,
      ["Ana Lima", "Amarela", "Rita Lima", "Rua A, 1", "Ananindeua", "ana@ex.com"],
    ]);
    expect(unknownHeaders).toEqual([]);
    expect(rows[0]).toEqual({
      full_name: "Ana Lima",
      belt_label: "Amarela",
      mother_name: "Rita Lima",
      address: "Rua A, 1",
      city: "Ananindeua",
      email: "ana@ex.com",
    });
  });
});

describe("rowsToImport — coluna desconhecida continua sendo reportada", () => {
  it("lista as ignoradas com o texto ORIGINAL da planilha, não o normalizado", () => {
    const { rows, unknownHeaders } = rowsToImport([
      ["Nome", "Observações", "Turma", "Peso (kg)"],
      ["Bruno", "chegou em 2024", "Infantil A", "32"],
    ]);
    expect(unknownHeaders).toEqual(["Observações", "Turma", "Peso (kg)"]);
    expect(rows[0]).toEqual({ full_name: "Bruno" });
  });

  it("sem coluna de nome, hasNameCol é false (a tela recusa o arquivo)", () => {
    const { hasNameCol } = rowsToImport([["CPF", "Telefone"], ["111", "999"]]);
    expect(hasNameCol).toBe(false);
  });
});

describe("matchHeaderLoose — tolerante, mas nunca adivinha em silêncio", () => {
  it("casa variações plausíveis de planilha de dojô", () => {
    expect(matchHeaderLoose("Nome da Academia")).toBe("academia");
    expect(matchHeaderLoose("Unidade / Núcleo")).toBe("academia");
    expect(matchHeaderLoose("Data de Nascto")).toBe("birth_date");
    expect(matchHeaderLoose("Bairro/Distrito")).toBe("neighborhood");
    expect(matchHeaderLoose("Cidade/UF")).toBe("city");
    expect(matchHeaderLoose("WhatsApp do Responsável")).toBe("guardian_phone");
  });

  it("cabeçalho AMBÍGUO (2 regras) cai em ignorada, não escolhe uma", () => {
    // "faixa" ativa belt_label e "academia" ativa academia — empate.
    expect(matchHeaderLoose("Faixa da Academia")).toBeNull();
  });

  it("cabeçalho que não bate com regra nenhuma cai em ignorada", () => {
    // telefone DA MÃE não é o telefone do aluno nem o nome da mãe.
    expect(matchHeaderLoose("Celular da Mãe")).toBeNull();
    expect(matchHeaderLoose("Observações")).toBeNull();
    expect(matchHeaderLoose("Turma")).toBeNull();
    expect(matchHeaderLoose("Telefone de Emergência")).toBeNull();
  });

  it("casa por palavra INTEIRA (não por substring solta)", () => {
    // "pais" (país) não pode virar "pai".
    expect(matchHeaderLoose("País")).toBeNull();
  });

  it("o fallback nunca sobrescreve um campo já casado por lookup exato", () => {
    const { rows, unknownHeaders } = rowsToImport([
      ["Nome", "Telefone", "Contato"],
      ["Caio", "91988887777", "nao usar"],
    ]);
    expect(rows[0].phone).toBe("91988887777");
    expect(unknownHeaders).toEqual(["Contato"]);
  });
});

describe("responsavelDerivado — mesma regra do backend", () => {
  const menor = { full_name: "X", birth_date: `${ANO - 10}-01-01` };
  const adulto = { full_name: "X", birth_date: `${ANO - 30}-01-01` };

  it("menor só com mãe usa a mãe", () => {
    expect(responsavelDerivado({ ...menor, mother_name: "Maria" })).toBe("Maria");
  });

  it("menor só com pai usa o pai", () => {
    expect(responsavelDerivado({ ...menor, father_name: "José" })).toBe("José");
  });

  it("menor com mãe E pai usa a MÃE (pai é o fallback)", () => {
    expect(responsavelDerivado({ ...menor, mother_name: "Ana", father_name: "Carlos" })).toBe("Ana");
  });

  it("menor sem nenhum dos dois não tem responsável", () => {
    expect(responsavelDerivado(menor)).toBeNull();
  });

  it("sem birth_date o backend trata como ADULTO — não deriva de mãe/pai", () => {
    expect(responsavelDerivado({ full_name: "X", mother_name: "Rita" })).toBeNull();
  });

  it("adulto não deriva responsável de mãe/pai", () => {
    expect(responsavelDerivado({ ...adulto, mother_name: "Lúcia" })).toBeNull();
  });

  it("guardian_name explícito vence sempre (inclusive em adulto)", () => {
    expect(responsavelDerivado({ ...adulto, guardian_name: "Tutor" })).toBe("Tutor");
    expect(
      responsavelDerivado({ ...menor, guardian_name: "Tutor", mother_name: "Maria" })
    ).toBe("Tutor");
  });
});

describe("resumoPrevia — o que a prévia promete tem que bater com o import", () => {
  const HEADER = ["Nome", "Data Nascimento", "Mãe", "Pai", "Responsável"];
  const MATRIX = [
    HEADER,
    ["Menor Só Mãe", NASC_MENOR, "Maria", "", ""],
    ["Menor Só Pai", NASC_MENOR, "", "José", ""],
    ["Menor Com Ambos", NASC_MENOR, "Ana", "Carlos", ""],
    ["Menor Sem Ninguém", NASC_MENOR, "", "", ""],
    ["Sem Data Com Mãe", "", "Rita", "", ""],
    ["Adulto Com Mãe", NASC_ADULTO, "Lúcia", "", ""],
    ["Adulto Com Resp", NASC_ADULTO, "", "", "Tutor"],
  ];

  it("conta o responsável DERIVADO — era aqui que a prévia dizia '0 com responsável'", () => {
    const { rows } = rowsToImport(MATRIX);
    const r = resumoPrevia(rows);
    expect(r.total).toBe(7);
    // mãe + pai + ambos + responsável explícito
    expect(r.comResp).toBe(4);
    expect(r.menores).toBe(4);
    expect(r.menoresSemResp).toBe(1);
    expect(r.comNasc).toBe(6);
    expect(r.semNome).toBe(0);
  });

  it("conta inativos e as tags de academia distintas", () => {
    const { rows } = rowsToImport([
      ["Nome", "Ativo", "Academia"],
      ["A", "Sim", "Areikan Centro"],
      ["B", "Não", "Areikan Centro"],
      ["C", "Inativo", "Areikan Sul"],
      ["D", "", ""],
      ["E", "talvez", "Areikan Sul"],
    ]);
    const r = resumoPrevia(rows);
    expect(r.total).toBe(5);
    expect(r.inativos).toBe(2); // B e C — "talvez" não é chute nosso
    expect(r.academias.sort()).toEqual(["Areikan Centro", "Areikan Sul"]);
  });

  it("linha sem nome é contada como pulada", () => {
    const { rows } = rowsToImport([["Nome", "CPF"], ["", "111"], ["Tem Nome", "222"]]);
    expect(resumoPrevia(rows).semNome).toBe(1);
  });
});

describe("pareceInativo — só conta o que reconhecemos", () => {
  it.each(["Não", "NAO", "n", "0", "Inativo", "inativa", "Desligado", "false"])(
    "%s conta como inativo",
    (v) => expect(pareceInativo(v)).toBe(true)
  );

  it.each(["Sim", "S", "1", "Ativo", "talvez", "", null, undefined])(
    "%s NÃO conta como inativo",
    (v) => expect(pareceInativo(v)).toBe(false)
  );
});

describe("parseCsv", () => {
  it("detecta o delimitador ; e respeita aspas", () => {
    const csv = 'Nome;Graduação KYU;Endereço\nDavi;"1º Kyu - Marrom";"Rua A, 123"\n';
    expect(parseCsv(csv)).toEqual([
      ["Nome", "Graduação KYU", "Endereço"],
      ["Davi", "1º Kyu - Marrom", "Rua A, 123"],
    ]);
  });

  it("colar direto da planilha (TAB) também funciona ponta a ponta", () => {
    const colado = "Nome\tMãe\tAtivo\nDavi\tMaria\tNão\n";
    const { rows } = rowsToImport(parseCsv(colado));
    expect(rows[0]).toEqual({ full_name: "Davi", mother_name: "Maria", status: "Não" });
  });

  it("ignora linhas totalmente vazias", () => {
    expect(parseCsv("Nome;CPF\n\nDavi;111\n\n")).toEqual([
      ["Nome", "CPF"],
      ["Davi", "111"],
    ]);
  });
});
