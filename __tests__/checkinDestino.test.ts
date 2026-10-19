// ============================================================
// Para onde o Continuar do check-in leva (19/10/2026, card tq-31).
//
// Tabela aprovada no mockup "O primeiro minuto de quem acabou de criar a
// conta" (claude.ai/artifact/WjWnEitYY49kPCapdY4hcV). Uma linha por
// resposta; os valores são os códigos reais de constants/checkin.ts.
// ============================================================
import fs from "fs";
import path from "path";

// O hook importa stores/auth (expo-secure-store não carrega no jest).
jest.mock("@/stores/auth", () => ({ useAuthStore: Object.assign(() => ({}), { getState: () => ({}) }) }));

import { computeVisibleModules } from "@/hooks/useVisibleModules";
import { AURA_WHATSAPP_NUMERO } from "@/constants/suporteAura";
import { PERGUNTAS_CHECKIN } from "@/constants/checkin";
import {
  ROTA_CAIXA, ROTA_CANAL, ROTA_CERTIFICADO, ROTA_NOVO_FIADO, ROTA_NOVO_PRODUTO, ROTA_NOVO_PRODUTO_E_CAIXA,
  ROTA_PAINEL, ROTA_REATIVACAO, ROTA_IMPORTAR_PLANILHA,
  caminhoDoEstoque, depoisVaiAoCaixa, destinoDaPrimeiraVenda, destinoDoCheckin, destinoDoEstoqueMedio,
  mensagemImportacaoAssistida, querAbaCertificado, querImportarPlanilha, querNovoFiado, querNovoProduto,
  temProdutoNaResposta,
} from "@/utils/checkinDestino";
import { abrirCom } from "@/utils/checkinRegras";
import { MOD_TRAZER_PRODUTOS, ROTA_TRAZER_PRODUTOS } from "@/constants/trazerProdutos";

const raiz = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const NEGOCIO = computeVisibleModules("negocio", null, { is_owner: true, permissions: null });
const ESSENCIAL = computeVisibleModules("essencial", null, undefined);
const ctx = (over: Partial<Parameters<typeof destinoDoCheckin>[1]> = {}) => ({
  modulos: NEGOCIO, temProduto: false, loja: "Loja da Lu", ...over,
});

describe("uma linha por resposta (plano Negócio, loja sem produto)", () => {
  test.each([
    ["Vender no caixa, sem produto", { comeco: "caixa" }, ROTA_NOVO_PRODUTO_E_CAIXA, "primeiro_produto_e_caixa"],
    ["Organizar meu estoque, até 50", { comeco: "estoque", produtos_faixa: "ate_50" }, ROTA_NOVO_PRODUTO, "cadastro_um_por_um"],
    ["Organizar meu estoque, 51 a 300", { comeco: "estoque", produtos_faixa: "de_51_a_300" }, ROTA_TRAZER_PRODUTOS, "trazer_produtos"],
    ["Organizar meu estoque, Caderno", { comeco: "estoque", onde_anota: "caderno" }, ROTA_TRAZER_PRODUTOS, "trazer_produtos"],
    ["Organizar meu estoque, Ainda não anoto", { comeco: "estoque", onde_anota: "nao_anoto" }, ROTA_TRAZER_PRODUTOS, "trazer_produtos"],
    ["Organizar meu estoque, Planilha até 300", { comeco: "estoque", onde_anota: "planilha", produtos_faixa: "de_51_a_300" }, ROTA_IMPORTAR_PLANILHA, "importar_planilha"],
    ["Organizar meu estoque, Planilha sem faixa", { comeco: "estoque", onde_anota: "planilha" }, ROTA_IMPORTAR_PLANILHA, "importar_planilha"],
    ["Organizar meu estoque, Planilha com mais de 300", { comeco: "estoque", onde_anota: "planilha", produtos_faixa: "de_301_a_1000" }, ROTA_NOVO_PRODUTO, "importacao_assistida"],
    ["Organizar meu estoque, 301 a 1.000", { comeco: "estoque", produtos_faixa: "de_301_a_1000" }, ROTA_NOVO_PRODUTO, "importacao_assistida"],
    ["Organizar meu estoque, mais de 1.000", { comeco: "estoque", produtos_faixa: "mais_de_1000" }, ROTA_NOVO_PRODUTO, "importacao_assistida"],
    ["Organizar meu estoque, Outro sistema", { comeco: "estoque", onde_anota: "outro_sistema" }, ROTA_NOVO_PRODUTO, "importacao_assistida"],
    ["Controlar fiado", { comeco: "fiado" }, ROTA_NOVO_FIADO, "novo_fiado"],
    ["Emitir nota fiscal", { comeco: "nota_fiscal" }, ROTA_CERTIFICADO, "certificado_a1"],
    ["Vender pela internet", { comeco: "loja_online" }, ROTA_CANAL, "canal_digital"],
    ["Chamar clientes que sumiram", { comeco: "sumidos" }, ROTA_REATIVACAO, "reativacao"],
    ["Outra coisa", { comeco: "outra" }, ROTA_PAINEL, "painel"],
    ["nada respondido (Pular)", {}, ROTA_PAINEL, "painel"],
  ])("%s", (_nome, respostas, rota, motivo) => {
    const d = destinoDoCheckin(respostas, ctx());
    expect(d.rota).toBe(rota);
    expect(d.motivo).toBe(motivo);
    expect(!!d.whatsapp).toBe(motivo === "importacao_assistida");
  });
});

describe("regras de cada linha", () => {
  test("Vender no caixa com produto: direto ao Caixa", () => {
    expect(destinoDoCheckin({ comeco: "caixa" }, ctx({ temProduto: true })).rota).toBe(ROTA_CAIXA);
  });

  test("Vender no caixa sem saber se tem produto (rede): cadastro, que segue ao Caixa", () => {
    expect(destinoDoCheckin({ comeco: "caixa" }, ctx({ temProduto: null })).rota).toBe(ROTA_NOVO_PRODUTO_E_CAIXA);
  });

  test("o maior vence: Caderno com mais de 1.000 produtos é importação assistida", () => {
    const d = destinoDoCheckin({ comeco: "estoque", onde_anota: "caderno", produtos_faixa: "mais_de_1000" }, ctx());
    expect(d.motivo).toBe("importacao_assistida");
  });

  test("51 a 300, Caderno e Ainda não anoto vão à tela do tq-34 (Como você quer trazer seus produtos?)", () => {
    expect(ROTA_TRAZER_PRODUTOS).toBe("/trazer-produtos");
    expect(destinoDoEstoqueMedio(ctx())).toEqual({ rota: ROTA_TRAZER_PRODUTOS, motivo: "trazer_produtos" });
    expect(caminhoDoEstoque({ produtos_faixa: "de_51_a_300" })).toBe("medio");
    expect(caminhoDoEstoque({ onde_anota: "caderno" })).toBe("medio");
    expect(caminhoDoEstoque({ onde_anota: "nao_anoto" })).toBe("medio");
    const src = raiz("utils/checkinDestino.ts");
    expect(src).not.toContain("TODO(tq-34)");
    expect(src).toMatch(/case "medio":\s*return destinoDoEstoqueMedio\(ctx\);/);
    expect(fs.existsSync(path.join(__dirname, "..", "app/trazer-produtos.tsx"))).toBe(true);
  });

  test("Essencial vai à tela; com a chave da tela escondida, o um por um de antes", () => {
    expect(destinoDoCheckin({ comeco: "estoque", onde_anota: "caderno" }, ctx({ modulos: ESSENCIAL })).rota).toBe(ROTA_TRAZER_PRODUTOS);
    const semTela = computeVisibleModules("essencial", { [MOD_TRAZER_PRODUTOS]: false }, undefined);
    expect(destinoDoCheckin({ comeco: "estoque", onde_anota: "caderno" }, ctx({ modulos: semTela }))).toEqual({
      rota: ROTA_NOVO_PRODUTO, motivo: "cadastro_um_por_um",
    });
    // sem Estoque, nem a tela: Painel (a regra do estoque vem antes)
    expect(destinoDoCheckin({ comeco: "estoque", onde_anota: "caderno" }, ctx({ modulos: new Set([MOD_TRAZER_PRODUTOS]) })).rota).toBe(ROTA_PAINEL);
  });

  test("o texto do 'Vamos abrir com' segue o mesmo caminho do destino", () => {
    const casos: any[] = [
      [{ comeco: "estoque", onde_anota: "planilha" }, "Importar sua planilha", "importar_planilha"],
      [{ comeco: "estoque", onde_anota: "outro_sistema" }, "Trazer seus produtos com a nossa ajuda", "importacao_assistida"],
      [{ comeco: "estoque", onde_anota: "caderno" }, "Trazer seus produtos do seu jeito", "trazer_produtos"],
      [{ comeco: "estoque", produtos_faixa: "de_51_a_300" }, "Trazer seus produtos do seu jeito", "trazer_produtos"],
      [{ comeco: "estoque", produtos_faixa: "ate_50" }, "Cadastrar seus primeiros produtos", "cadastro_um_por_um"],
      [{ comeco: "caixa" }, "Cadastrar um produto e fazer a primeira venda", "primeiro_produto_e_caixa"],
      [{ comeco: "outra" }, "Ver o seu Painel", "painel"],
    ];
    for (const [r, titulo, motivo] of casos) {
      expect(abrirCom(r, { temProduto: false })?.titulo).toBe(titulo);
      expect(destinoDoCheckin(r, ctx()).motivo).toBe(motivo);
    }
    expect(abrirCom({ comeco: "caixa" }, { temProduto: true })?.titulo).toBe("Fazer a primeira venda no Caixa");
    expect(destinoDoCheckin({ comeco: "caixa" }, ctx({ temProduto: true })).rota).toBe(ROTA_CAIXA);
  });

  test("importação assistida: wa.me da Aura com a mensagem pronta (mesmo número do app#1092)", () => {
    const d = destinoDoCheckin({ comeco: "estoque", onde_anota: "outro_sistema", produtos_faixa: "mais_de_1000" }, ctx());
    expect(d.whatsapp).toBe(
      "https://wa.me/" + AURA_WHATSAPP_NUMERO + "?text="
      + encodeURIComponent("Oi! Acabei de criar a conta da Loja da Lu na Aura e quero ajuda para trazer meus produtos (tenho mais de 1.000 produtos e hoje uso outro sistema)."),
    );
    expect(mensagemImportacaoAssistida(null, {})).toBe(
      "Oi! Acabei de criar a conta da minha loja na Aura e quero ajuda para trazer meus produtos.",
    );
    expect(raiz("utils/checkinDestino.ts")).toContain('import { waAura } from "@/constants/suporteAura";');
  });

  test("sem 'por onde começar', mas com as outras: a regra do estoque", () => {
    expect(destinoDoCheckin({ produtos_faixa: "ate_50" }, ctx()).rota).toBe(ROTA_NOVO_PRODUTO);
    expect(destinoDoCheckin({ onde_anota: "outro_sistema" }, ctx()).motivo).toBe("importacao_assistida");
  });

  test("valor desconhecido em 'por onde começar': Painel", () => {
    expect(destinoDoCheckin({ comeco: "algo_novo" }, ctx()).rota).toBe(ROTA_PAINEL);
  });

  test("a tabela cobre todas as opções de 'por onde começar'", () => {
    const valores = PERGUNTAS_CHECKIN[0].opcoes.map((o) => o.valor);
    expect(valores).toEqual(["estoque", "caixa", "fiado", "nota_fiscal", "loja_online", "sumidos", "outra"]);
  });
});

describe("plano: tela que o plano não libera nunca é destino", () => {
  test("Essencial: fiado e loja online vão ao Painel; o resto segue", () => {
    expect(destinoDoCheckin({ comeco: "fiado" }, ctx({ modulos: ESSENCIAL })).rota).toBe(ROTA_PAINEL);
    expect(destinoDoCheckin({ comeco: "loja_online" }, ctx({ modulos: ESSENCIAL })).rota).toBe(ROTA_PAINEL);
    expect(destinoDoCheckin({ comeco: "nota_fiscal" }, ctx({ modulos: ESSENCIAL })).rota).toBe(ROTA_CERTIFICADO);
    expect(destinoDoCheckin({ comeco: "sumidos" }, ctx({ modulos: ESSENCIAL })).rota).toBe(ROTA_REATIVACAO);
    expect(destinoDoCheckin({ comeco: "caixa" }, ctx({ modulos: ESSENCIAL })).rota).toBe(ROTA_NOVO_PRODUTO_E_CAIXA);
  });

  test("override desligando o crediário: Painel", () => {
    const m = computeVisibleModules("negocio", { crediario: false }, undefined);
    expect(destinoDoCheckin({ comeco: "fiado" }, ctx({ modulos: m })).rota).toBe(ROTA_PAINEL);
  });

  test("sem Caixa: Painel; sem Estoque: Caixa direto", () => {
    expect(destinoDaPrimeiraVenda({ modulos: new Set(["estoque"]), temProduto: false }).rota).toBe(ROTA_PAINEL);
    expect(destinoDaPrimeiraVenda({ modulos: new Set(["pdv"]), temProduto: false }).rota).toBe(ROTA_CAIXA);
    expect(destinoDoCheckin({ comeco: "estoque" }, ctx({ modulos: new Set(["pdv"]) })).rota).toBe(ROTA_PAINEL);
  });
});

describe("tem produto?", () => {
  test("lê o total do servidor; fora do formato é 'não sei'", () => {
    expect(temProdutoNaResposta({ products: [], total: 0 })).toBe(false);
    expect(temProdutoNaResposta({ products: [{}], total: 12 })).toBe(true);
    expect(temProdutoNaResposta({ products: [{}] })).toBe(true);
    expect(temProdutoNaResposta([])).toBe(false);
    expect(temProdutoNaResposta(null)).toBeNull();
    expect(temProdutoNaResposta({ error: "x" })).toBeNull();
  });
});

describe("parâmetros nas telas de destino", () => {
  test("valor exato (setParams undefined vira a string 'undefined')", () => {
    expect(querNovoProduto("produto")).toBe(true);
    expect(querNovoProduto(["produto"])).toBe(true);
    expect(querNovoProduto("undefined")).toBe(false);
    expect(querNovoProduto(undefined)).toBe(false);
    expect(depoisVaiAoCaixa("pdv")).toBe(true);
    expect(depoisVaiAoCaixa("undefined")).toBe(false);
    expect(querNovoFiado("1")).toBe(true);
    expect(querNovoFiado("undefined")).toBe(false);
    expect(querAbaCertificado("certificado")).toBe(true);
    expect(querAbaCertificado("0")).toBe(false);
    expect(querImportarPlanilha("planilha")).toBe(true);
    expect(querImportarPlanilha("undefined")).toBe(false);
  });

  test("Estoque mostra o convite da planilha com ?importar=planilha (o seletor abre no toque)", () => {
    const src = raiz("app/(tabs)/estoque.tsx");
    expect(src).toContain("<ConvitePlanilha");
    expect(src).toContain("importar={params.importar}");
    expect(src).toContain("onEscolher={importPlanilha.escolherArquivo}");
  });

  test("montagem dupla: nenhum parâmetro é limpo no mount; sai da URL só quando a pessoa fecha", () => {
    const estoque = raiz("app/(tabs)/estoque.tsx");
    const efeito = estoque.slice(estoque.indexOf("if (!querNovoProduto(params.novo)"), estoque.indexOf("}, [params.novo]);"));
    expect(efeito).not.toContain("setParams");
    expect(estoque).toMatch(/if \(veioPeloParamRef\.current\) \{\s*veioPeloParamRef\.current = false;\s*try \{ router\.setParams\(\{ novo: undefined, depois: undefined \}/);
    const cred = raiz("app/(tabs)/crediario.tsx");
    const efeitoCred = cred.slice(cred.indexOf("if (!querNovoFiado(params.novo)"), cred.indexOf("function fecharCriar()"));
    expect(efeitoCred).not.toContain("setParams");
    expect(cred).toContain("onClose={fecharCriar}");
  });

  test("Estoque abre o Novo item com ?novo=produto e só vai ao Caixa depois de salvar", () => {
    const src = raiz("app/(tabs)/estoque.tsx");
    expect(src).toContain("querNovoProduto(params.novo)");
    expect(src).toContain('abrirCadastro("product");');
    expect(src).toContain("const irAoCaixa = caixaDepoisRef.current && salvouRef.current;");
    expect(src).toContain("router.push(ROTA_CAIXA as any)");
    expect(src).toMatch(/function aposSalvarItem\(\) \{\s*salvouRef\.current = true;/);
  });

  test("Crediário abre o Novo lançamento com ?novo=1", () => {
    const src = raiz("app/(tabs)/crediario.tsx");
    expect(src).toContain("querNovoFiado(params.novo)");
    expect(src).toMatch(/querNovoFiado\(params\.novo\) \|\| consolidatedView\) return;\s*fiadoPeloParamRef\.current = true;\s*setShowCriar\(true\);/);
  });

  test("Notas fiscais abre a aba Certificado A1 com ?tab=certificado", () => {
    const src = raiz("app/(tabs)/nfe.tsx");
    expect(src).toContain("querAbaCertificado(params.tab) ? TAB_CERTIFICADO : 0");
  });

  test("as rotas existem no app", () => {
    ["app/(tabs)/estoque.tsx", "app/(tabs)/pdv.tsx", "app/(tabs)/crediario.tsx", "app/(tabs)/nfe.tsx",
      "app/(tabs)/canal.tsx", "app/(tabs)/clientes/reativacao.tsx", "app/(tabs)/index.tsx"]
      .forEach((f) => expect(fs.existsSync(path.join(__dirname, "..", f))).toBe(true));
  });
});
