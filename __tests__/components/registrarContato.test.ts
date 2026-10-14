// ============================================================
// Registrar contato (Gestão Aura): regras puras do formulário.
//
// Opções iguais aos enums do backend (migration 383), atalhos de data,
// validação (resultado, canal e frase; motivo quando "não quer") e o corpo do
// POST /admin/painel/contatos. A tela está em PainelHoje.test.tsx.
// ============================================================
import fs from "fs";
import path from "path";
import {
  ATALHOS_DE_DATA, CANAIS, COMO_CHEGOU, MARCADORES, MAX_FRASE, MOTIVOS, RESULTADOS,
  ehVerboDeContato, ehVerboDeTrial, formVazio, hojeBRT, montarCorpo, rotuloDaData,
  rotuloDoCanal, rotuloDoMotivo, rotuloDoResultado, somarDias, validar,
} from "@/components/admin/painel/registrarContato";
import type { FormContato } from "@/components/admin/painel/registrarContato";

const CID = "aaaaaaaa-0000-4000-8000-000000000001";
const preenchido = (extra: Partial<FormContato> = {}): FormContato => ({
  ...formVazio(), resultado: "pediu_tempo", frase: "Pediu até sexta", ...extra,
});

describe("opções (mesmos enums do backend)", () => {
  it("6 resultados, 4 canais, 9 motivos, 2 marcadores, 8 formas de chegar", () => {
    expect(RESULTADOS.map((o) => o.id)).toEqual([
      "respondeu", "sem_resposta", "pediu_tempo", "combinou_ligacao", "quer_assinar", "nao_quer",
    ]);
    expect(CANAIS.map((o) => o.id)).toEqual(["whatsapp", "ligacao", "email", "presencial"]);
    expect(MOTIVOS.map((o) => o.id)).toEqual([
      "estoque_na_entrada", "preco_plano", "fiscal", "atrito_produto", "funcionalidade",
      "frente_errada", "ritmo_do_cliente", "concorrente", "elogio",
    ]);
    expect(MARCADORES.map((o) => o.id)).toEqual(["importacao_assistida_pedida", "importacao_assistida_entregue"]);
    expect(COMO_CHEGOU.map((o) => o.id)).toEqual([
      "indicacao", "botao_whatsapp_site", "cadastro_direto", "ia", "google", "instagram", "prospeccao_caio", "outro",
    ]);
    expect(ATALHOS_DE_DATA).toEqual([1, 3, 7]);
  });

  it("rótulos", () => {
    expect(rotuloDoResultado("nao_quer")).toBe("Não quer");
    expect(rotuloDoCanal("ligacao")).toBe("Ligação");
    expect(rotuloDoMotivo("preco_plano")).toBe("Preço do plano");
    expect(rotuloDoResultado(null)).toBe("");
  });
});

describe("datas (Brasília)", () => {
  it("hoje em BRT: 02h UTC ainda é o dia anterior", () => {
    expect(hojeBRT(Date.parse("2026-10-14T02:59:00Z"))).toBe("2026-10-13");
    expect(hojeBRT(Date.parse("2026-10-14T03:00:00Z"))).toBe("2026-10-14");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-10-13", 3)).toBe("2026-10-16");
    expect(somarDias("2026-10-30", 7)).toBe("2026-11-06");
    expect(somarDias("2026-12-29", 3)).toBe("2027-01-01");
  });

  it("rótulo com o dia da semana", () => {
    expect(rotuloDaData("2026-10-16")).toBe("sexta, 16/10");
    expect(rotuloDaData("2026-10-18")).toBe("domingo, 18/10");
  });
});

describe("validar", () => {
  it("formulário vazio: faltam resultado e frase; canal já vem em WhatsApp", () => {
    const f = formVazio();
    expect(f.canal).toBe("whatsapp");
    const v = validar(f);
    expect(v.ok).toBe(false);
    expect(Object.keys(v.erros).sort()).toEqual(["frase", "resultado"]);
  });

  it("resultado + frase bastam", () => {
    expect(validar(preenchido()).ok).toBe(true);
  });

  it("frase só com espaços não vale; acima de 500 não vale", () => {
    expect(validar(preenchido({ frase: "   " })).erros.frase).toBeTruthy();
    expect(validar(preenchido({ frase: "x".repeat(MAX_FRASE) })).ok).toBe(true);
    expect(validar(preenchido({ frase: "x".repeat(MAX_FRASE + 1) })).erros.frase).toBeTruthy();
  });

  it("'Não quer' exige o motivo (o que pesou)", () => {
    const sem = validar(preenchido({ resultado: "nao_quer" }));
    expect(sem.ok).toBe(false);
    expect(sem.erros.motivo).toBe("Diga o que pesou.");
    expect(validar(preenchido({ resultado: "nao_quer", motivo: "preco_plano" })).ok).toBe(true);
    // outro resultado não pede motivo
    expect(validar(preenchido({ resultado: "respondeu" })).ok).toBe(true);
  });

  it("próximo passo acima de 120 não vale", () => {
    expect(validar(preenchido({ proximoPasso: "x".repeat(121) })).erros.proximoPasso).toBeTruthy();
  });
});

describe("montarCorpo", () => {
  it("só o obrigatório: resultado, canal e frase", () => {
    expect(montarCorpo(preenchido(), { company_id: CID }, "2026-10-13")).toEqual({
      company_id: CID, canal: "whatsapp", resultado: "pediu_tempo", body: "Pediu até sexta",
    });
  });

  it("completo: próximo passo, data pelo atalho, motivo, marcador e check-in", () => {
    const corpo = montarCorpo(
      preenchido({
        resultado: "nao_quer", canal: "ligacao", frase: "  Achou caro  ", motivo: "preco_plano",
        proximoPasso: " Ligar em novembro ", dias: 7, marcador: "importacao_assistida_pedida",
        comoChegou: "indicacao", fiado: "sim", quemDecide: "dono",
      }),
      { company_id: CID },
      "2026-10-30"
    );
    expect(corpo).toEqual({
      company_id: CID, canal: "ligacao", resultado: "nao_quer", body: "Achou caro",
      proximo_passo: "Ligar em novembro", proximo_passo_em: "2026-11-06",
      motivo: "preco_plano", marcador: "importacao_assistida_pedida",
      checkin: { como_chegou: "indicacao", fiado: "sim", quem_decide: "dono" },
    });
  });

  it("lead sem conta vai com lead_id; check-in vazio não vai", () => {
    const corpo = montarCorpo(preenchido(), { lead_id: "cccccccc-0000-4000-8000-000000000001" }, "2026-10-13");
    expect(corpo).toMatchObject({ lead_id: "cccccccc-0000-4000-8000-000000000001" });
    expect(corpo).not.toHaveProperty("company_id");
    expect(corpo).not.toHaveProperty("checkin");
    expect(corpo).not.toHaveProperty("proximo_passo_em");
  });

  it("elogio em outro resultado também vai (motivo não é só do 'não quer')", () => {
    expect(montarCorpo(preenchido({ motivo: "elogio" }), { company_id: CID }).motivo).toBe("elogio");
  });
});

describe("verbos do painel", () => {
  it("contato: Ligar, Oferecer…, Chamar…, Registrar contato; WhatsApp e o resto não", () => {
    for (const v of ["Ligar", "ligar", "Oferecer", "Oferecer plano", "Chamar para o Caixa", "Registrar contato"]) {
      expect(ehVerboDeContato(v)).toBe(true);
    }
    for (const v of ["WhatsApp", "Vincular", "Ver", "Responder", "+7 dias", "", null, undefined]) {
      expect(ehVerboDeContato(v as any)).toBe(false);
    }
  });

  it("trial: só '+7 dias'", () => {
    expect(ehVerboDeTrial("+7 dias")).toBe(true);
    expect(ehVerboDeTrial(" +7  dias ")).toBe(true);
    expect(ehVerboDeTrial("+3 dias")).toBe(false);
    expect(ehVerboDeTrial("Ligar")).toBe(false);
  });
});

describe("pontos de entrada", () => {
  const ler = (...partes: string[]) => fs.readFileSync(path.join(__dirname, "..", "..", ...partes), "utf8");

  it("a ficha dos Clientes da Gestão Aura abre o formulário pelo botão ao lado das notas", () => {
    const fonte = ler("components", "admin", "ClientsAdmin.tsx");
    expect(fonte).toContain('import { RegistrarContatoModal } from "./painel/RegistrarContatoModal"');
    expect(fonte).toContain('testID="client-registrar-contato"');
    expect(fonte).toContain("<RegistrarContatoModal");
  });

  it("os modais novos usam a casca sem gráficos (não puxam react-native-svg para fora do painel)", () => {
    for (const arq of ["RegistrarContatoModal.tsx", "EstenderTrialModal.tsx"]) {
      const fonte = ler("components", "admin", "painel", arq);
      expect(fonte).toContain('from "./PainelModal"');
      expect(fonte).not.toContain('from "./PainelModais"');
      expect(fonte).not.toContain("./Graficos");
    }
  });

  it("o painel não avisa mais 'em breve' para o Registrar contato", () => {
    const modais = ler("components", "admin", "painel", "PainelModais.tsx");
    expect(modais).not.toContain('onVerbo("Registrar contato"');
    expect(modais).toContain("onRegistrarContato");
  });
});
