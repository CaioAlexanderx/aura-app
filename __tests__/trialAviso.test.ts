// ============================================================
// Aviso do trial lê company.trial (card t2-05, 14/10/2026).
//
// O aviso mostrava 15 dias (o teto) e, na primeira venda, caía para 7 sem
// explicação. O backend já devolve o bloco `trial`; o app passa a usar:
//   · antes da primeira venda: "Teste grátis de 7 dias", sem contador e sem
//     jamais citar o teto;
//   · depois da primeira venda: contador com dias_restantes do servidor;
//   · modo fixo (código de acesso, cupom, extensão): contador de sempre;
//   · sem bloco (backend antigo): comportamento de antes.
// Nenhuma data é recalculada no cliente.
// ============================================================
import fs from "fs";
import path from "path";
import {
  avisoDoTrial, diasLegado, lerTrial, DIAS_URGENTE, TEXTOS_TRIAL, type TrialInfo,
} from "@/utils/trialAviso";

function bloco(extra: Partial<TrialInfo> = {}): TrialInfo {
  return {
    mode: "primeira_venda",
    ends_at: "2026-10-29T12:00:00.000Z",
    started_by_sale_at: null,
    dias_restantes: 15,
    teto_em: "2026-10-29T12:00:00.000Z",
    aguardando_primeira_venda: true,
    dias_apos_primeira_venda: 7,
    ...extra,
  };
}

const PLANO = "Negócio";

describe("lerTrial", () => {
  test("lê o bloco do backend", () => {
    expect(lerTrial(bloco())).toEqual(bloco());
  });

  test("ausente, nulo ou fora do formato vira null (cai no legado)", () => {
    expect(lerTrial(undefined)).toBeNull();
    expect(lerTrial(null)).toBeNull();
    expect(lerTrial("primeira_venda")).toBeNull();
    expect(lerTrial({})).toBeNull();
    expect(lerTrial({ mode: "qualquer" })).toBeNull();
  });

  test("campos ruins não quebram: dias inválidos viram null e o prazo cai em 7", () => {
    const t = lerTrial({ mode: "fixo", dias_restantes: "x", dias_apos_primeira_venda: 0, ends_at: 5 });
    expect(t).toMatchObject({ mode: "fixo", dias_restantes: null, ends_at: null, dias_apos_primeira_venda: 7 });
  });
});

describe("modo primeira_venda, ainda sem venda", () => {
  test("título 'Teste grátis de 7 dias', sem contador, mesmo com 15 dias de teto", () => {
    const a = avisoDoTrial(bloco(), { plano: PLANO, legadoDias: 15 });
    expect(a.estado).toBe("sem_venda");
    expect(a.titulo).toBe("Teste grátis de 7 dias");
    expect(a.corpo).toBe("Os 7 dias começam na sua primeira venda no Caixa.");
    expect(a.dias).toBeNull();
    expect(a.urgente).toBe(false);
  });

  test("nunca cita 15 nem o teto, em nenhum ponto do ciclo", () => {
    for (let d = 15; d >= 0; d--) {
      const a = avisoDoTrial(bloco({ dias_restantes: d }), { plano: PLANO, legadoDias: d });
      expect(a.titulo + " " + a.corpo).not.toMatch(/15|teto/i);
    }
  });

  test("o prazo vem do servidor (dias_apos_primeira_venda), não de um 7 fixo", () => {
    const a = avisoDoTrial(bloco({ dias_apos_primeira_venda: 10 }), { plano: PLANO, legadoDias: 15 });
    expect(a.titulo).toBe("Teste grátis de 10 dias");
  });

  // 14/10/2026 (decisão da Nina): no fim do teto, sem venda, o aviso diz o
  // que falta em vez de repetir "Os 7 dias começam na sua primeira venda".
  // 25/10/2026 (item 9, aprovado pelo Caio): sem "você ainda não fez" nem
  // "Assine para não perder o acesso"; diz quando termina e oferece ajuda.
  test("sem venda e 2 dias ou menos: quando termina e a oferta de ajuda, em vermelho", () => {
    const a = avisoDoTrial(bloco({ dias_restantes: DIAS_URGENTE }), { plano: PLANO, legadoDias: 2 });
    expect(a.estado).toBe("sem_venda");
    expect(`${a.titulo} ${a.corpo}`).toBe(
      "Seu teste termina em 2 dias. Se alguma coisa travou na primeira venda, a gente ajuda agora.",
    );
    expect(a.urgente).toBe(true);
    expect(a.dias).toBe(2);
    expect(a.ajuda).toBe(true);
  });

  test("sem venda: 1 dia é 'amanhã' e 0 é 'hoje' (mesma conta de dias_restantes)", () => {
    const um = avisoDoTrial(bloco({ dias_restantes: 1 }), { plano: PLANO, legadoDias: 1 });
    expect(`${um.titulo} ${um.corpo}`).toBe(
      "Seu teste termina amanhã. Se alguma coisa travou na primeira venda, a gente ajuda agora.",
    );
    expect(um.ajuda).toBe(true);
    const zero = avisoDoTrial(bloco({ dias_restantes: 0 }), { plano: PLANO, legadoDias: 0 });
    expect(`${zero.titulo} ${zero.corpo}`).toBe(
      "Seu teste termina hoje. Se alguma coisa travou na primeira venda, a gente ajuda agora.",
    );
    expect(zero.urgente).toBe(true);
  });

  test("sem venda no fim: nunca 'você ainda não fez' nem 'não perder o acesso'", () => {
    for (const d of [0, 1, 2]) {
      const a = avisoDoTrial(bloco({ dias_restantes: d }), { plano: PLANO, legadoDias: d });
      expect(a.titulo + " " + a.corpo).not.toMatch(/ainda não fez|não perder/);
    }
  });

  test("sem venda: nunca mais diz que os 7 dias começam na primeira venda quando o fim está perto", () => {
    for (const d of [0, 1, 2]) {
      const a = avisoDoTrial(bloco({ dias_restantes: d }), { plano: PLANO, legadoDias: d });
      expect(a.titulo + " " + a.corpo).not.toContain("começam na sua primeira venda");
      expect(a.titulo).not.toContain("Teste grátis");
    }
  });

  test("com 3 dias ainda é o texto sem contador", () => {
    const a = avisoDoTrial(bloco({ dias_restantes: DIAS_URGENTE + 1 }), { plano: PLANO, legadoDias: 3 });
    expect(a.dias).toBeNull();
    expect(a.estado).toBe("sem_venda");
    expect(a.ajuda).toBe(false);
  });
});

describe("modo primeira_venda, depois da primeira venda", () => {
  const vendeu = bloco({
    aguardando_primeira_venda: false,
    started_by_sale_at: "2026-10-16T12:00:00.000Z",
    ends_at: "2026-10-23T12:00:00.000Z",
    dias_restantes: 5,
  });

  test("contador com os dias do servidor e a explicação de onde vieram", () => {
    const a = avisoDoTrial(vendeu, { plano: PLANO, legadoDias: 99 });
    expect(a.estado).toBe("em_curso");
    expect(a.titulo).toBe("Teste grátis · 5 dias restantes");
    expect(a.corpo).toBe("Seus 7 dias começaram na sua primeira venda. Plano Negócio.");
    expect(a.dias).toBe(5);
    expect(a.urgente).toBe(false);
  });

  test("não recalcula: legadoDias é ignorado quando o servidor mandou dias_restantes", () => {
    expect(avisoDoTrial(vendeu, { plano: PLANO, legadoDias: 1 }).dias).toBe(5);
  });

  test("urgente nos últimos dias", () => {
    const a = avisoDoTrial({ ...vendeu, dias_restantes: 1 }, { plano: PLANO, legadoDias: 1 });
    expect(a.urgente).toBe(true);
    expect(a.corpo).toBe(TEXTOS_TRIAL.urgente);
    expect(a.ajuda).toBe(false);
  });

  // 25/10/2026 (item 8): "o Caixa continua com você" só no shell Negócio.
  test("urgente: sem ameaça; o Caixa só entra com caixaVivo", () => {
    const fora = avisoDoTrial({ ...vendeu, dias_restantes: 1 }, { plano: PLANO, legadoDias: 1 });
    expect(fora.corpo).toBe("Seu teste está acabando. Se estiver gostando, é só escolher o plano.");
    expect(fora.corpo).not.toMatch(/Caixa/);
    const varejo = avisoDoTrial({ ...vendeu, dias_restantes: 1 }, { plano: PLANO, legadoDias: 1, caixaVivo: true });
    expect(varejo.corpo).toBe(
      "Seu teste está acabando. Se estiver gostando, é só escolher o plano. O Caixa continua com você de qualquer jeito.",
    );
    for (const t of [fora.corpo, varejo.corpo]) expect(t).not.toMatch(/não perder|para sempre/);
  });
});

describe("modo fixo e backend sem o bloco", () => {
  test("fixo: contador do servidor e o texto de sempre", () => {
    const a = avisoDoTrial(
      bloco({ mode: "fixo", aguardando_primeira_venda: false, dias_restantes: 6, teto_em: null }),
      { plano: PLANO, legadoDias: 6 },
    );
    expect(a.estado).toBe("fixo");
    expect(a.titulo).toBe("Teste grátis · 6 dias restantes");
    expect(a.corpo).toBe("Você está no período de teste do plano Negócio.");
  });

  test("sem bloco: idêntico ao aviso antigo, contando de trial_ends_at", () => {
    const a = avisoDoTrial(null, { plano: PLANO, legadoDias: 4 });
    expect(a.estado).toBe("legado");
    expect(a.titulo).toBe("Teste grátis · 4 dias restantes");
    expect(a.corpo).toBe("Você está no período de teste do plano Negócio.");
    const u = avisoDoTrial(undefined, { plano: PLANO, legadoDias: 2 });
    expect(u.urgente).toBe(true);
    expect(u.corpo).toBe("Seu teste está acabando. Se estiver gostando, é só escolher o plano.");
  });

  test("bloco sem dias_restantes usa o legado", () => {
    const a = avisoDoTrial(bloco({ mode: "fixo", aguardando_primeira_venda: false, dias_restantes: null }),
      { plano: PLANO, legadoDias: 3 });
    expect(a.dias).toBe(3);
  });
});

describe("diasLegado", () => {
  const agora = Date.parse("2026-10-14T12:00:00Z");
  test("arredonda para cima e nunca é negativo", () => {
    expect(diasLegado("2026-10-21T12:00:00Z", agora)).toBe(7);
    expect(diasLegado("2026-10-14T13:00:00Z", agora)).toBe(1);
    expect(diasLegado("2026-10-10T12:00:00Z", agora)).toBe(0);
    expect(diasLegado(null, agora)).toBe(0);
    expect(diasLegado("lixo", agora)).toBe(0);
  });
});

describe("fonte: o banner usa o bloco", () => {
  const SRC = fs.readFileSync(path.join(__dirname, "..", "components/TrialBanner.tsx"), "utf8");

  test("lê company.trial pelo utilitário e não conta dias na mão", () => {
    expect(SRC).toContain('from "@/utils/trialAviso"');
    expect(SRC).toContain("lerTrial((company as any)?.trial)");
    expect(SRC).toContain("avisoDoTrial(");
    expect(SRC).not.toMatch(/86400000/);
  });

  test("o título vem do aviso, sem frase de contador escrita no componente", () => {
    expect(SRC).toContain("{aviso.titulo}");
    expect(SRC).not.toContain("Teste grátis");
    expect(SRC).not.toContain("período de teste do plano");
  });
});
