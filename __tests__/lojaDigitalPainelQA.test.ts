// ============================================================
// Loja Digital do Studio · QA do painel (26/09/2026)
//
// As regras puras que a correção tirou das telas: troca de aba, campos do
// Meu Site, cor digitada, tipografia que volta, banner de fábrica,
// entrega sem recebimento, peça sem categoria, temporada fechada pela
// data, texto da política e lado de impressão sem campo.
// ============================================================
jest.mock("react-native-svg", () => ({}));

import { abaDaUrl, trocaDeAba, PERGUNTA_ALTERACOES } from "@/components/screens/studio-loja-digital/abasDaLojaDigital";
import {
  CHAVES_DE_TEXTO, corpoDoMeuSite, formDoMeuSite, formatarPct, lerPct, meuSiteAlterado,
  tecladoDaChavePix, dicaDoPublicado,
} from "@/components/screens/canal/meuSite";
import { lerCorDigitada, hexValido, ERRO_DA_COR } from "@/components/screens/canal/SeletorDeCor";
import { corInicialDaLoja, configChegou, trocarESalvar } from "@/components/screens/canal/designDaVitrineStudio";
import {
  bannersDeFabrica, temBannerDaLojista, montarChecklist, BANNER_DE_FABRICA,
} from "@/components/screens/canal/specsDeImagem";
import {
  semComoReceber, desligarPedeConfirmacao, textosDoPrazo, AVISO_SEM_RECEBIMENTO,
} from "@/components/screens/canal/entrega";
import {
  pecaSemCategoria, textoDoTotal, textoSemCategoria, rotuloDaPosicao, AVISO_SEM_CATEGORIA,
} from "@/components/screens/studio-loja-digital/configuradorDaLoja";
import {
  topoDaTemporada, mostrarCampoDoRecado, formDaConfig,
} from "@/components/screens/studio-loja-digital/pedidosPelaLoja";
import { textoPadraoDaPolitica } from "@/components/screens/studio-loja-digital/textoDaPolitica";
import { ladoSemCampo, AVISO_LADO_SEM_CAMPO } from "@/components/studio/ladoSemCampo";
import { paletaDoStudio, PALETA_DO_NEGOCIO } from "@/components/screens/canal/paletaDoCanal";
import { StudioColors, StudioColorsDark, type StudioPalette } from "@/constants/studio-tokens";

// ── 1 · abas ──────────────────────────────────────────────
describe("abas da Loja Digital", () => {
  test("?tab= desconhecido ou ausente cai em Meu Site", () => {
    expect(abaDaUrl("xyz")).toBe("site");
    expect(abaDaUrl(undefined)).toBe("site");
    expect(abaDaUrl("")).toBe("site");
    expect(abaDaUrl("pedidos_loja")).toBe("pedidos_loja");
    expect(abaDaUrl(["design"])).toBe("design");
  });

  test("com alteração não salva, pergunta; sem, vai; mesma aba, nada", () => {
    expect(trocaDeAba({ atual: "site", proxima: "design", alteradas: { site: true } })).toBe("perguntar");
    expect(trocaDeAba({ atual: "site", proxima: "design", alteradas: { delivery: true } })).toBe("ir");
    expect(trocaDeAba({ atual: "site", proxima: "site", alteradas: { site: true } })).toBe("nada");
  });

  test("a pergunta é a combinada com o PO", () => {
    expect(PERGUNTA_ALTERACOES).toBe("Você tem alterações não salvas. Sair sem salvar?");
  });
});

// ── 2 · Meu Site ──────────────────────────────────────────
describe("Meu Site: o corpo do salvar", () => {
  const cheia = formDoMeuSite({
    exists: true, site_name: "Ateliê", tagline: "Feito à mão", description: "Canecas",
    phone: "1233330000", whatsapp: "12999990000", instagram: "@a", tiktok: "@b", facebook: "@c",
    address: "Rua 1", pix_key: "a@b.com", pix_key_type: "EMAIL", pix_holder_name: "Helena",
    pix_holder_city: "Jacareí", politica_troca: "7 dias", pix_discount_pct: 5,
  });

  test("TODAS as chaves de texto vão sempre, mesmo vazias", () => {
    const vazio = corpoDoMeuSite(formDoMeuSite({}));
    for (const k of CHAVES_DE_TEXTO) expect(Object.prototype.hasOwnProperty.call(vazio, k)).toBe(true);
  });

  test("campo apagado vai como null (= apagar no servidor)", () => {
    const apagado = corpoDoMeuSite({ ...cheia, tagline: "   ", instagram: "", address: "" });
    expect(apagado.tagline).toBeNull();
    expect(apagado.instagram).toBeNull();
    expect(apagado.address).toBeNull();
    expect(apagado.site_name).toBe("Ateliê");
  });

  test("política igual à sugerida salva vazia", () => {
    expect(corpoDoMeuSite({ ...cheia, politica: "Padrão" }, "Padrão").politica_troca).toBeNull();
    expect(corpoDoMeuSite({ ...cheia, politica: "Minha regra" }, "Padrão").politica_troca).toBe("Minha regra");
  });

  test("tipo da chave só vai com chave", () => {
    expect(corpoDoMeuSite({ ...cheia, pixKey: "" }).pix_key_type).toBeNull();
    expect(corpoDoMeuSite(cheia).pix_key_type).toBe("EMAIL");
  });

  test("alteração: igual ao salvo não é alteração", () => {
    expect(meuSiteAlterado(cheia, cheia)).toBe(false);
    expect(meuSiteAlterado({ ...cheia, tagline: "outra" }, cheia)).toBe(true);
    expect(meuSiteAlterado({ ...cheia, published: true }, cheia)).toBe(true);
  });

  test("nome vazio usa o nome da empresa dos dois lados (não nasce alterado)", () => {
    const a = formDoMeuSite({ exists: true, site_name: null }, "Ateliê Helena");
    expect(a.siteName).toBe("Ateliê Helena");
    expect(meuSiteAlterado(a, formDoMeuSite({ exists: true, site_name: null }, "Ateliê Helena"))).toBe(false);
  });
});

describe("Meu Site: desconto no Pix", () => {
  test("aceita vírgula e apara em 30", () => {
    expect(lerPct("7,5")).toBe(7.5);
    expect(lerPct("35")).toBe(30);
    expect(lerPct("-2")).toBe(0);
    expect(lerPct("abc")).toBe(0);
    expect(lerPct("")).toBe(0);
  });

  test("mostra com vírgula: 7,5 — e o 30 que o servidor gravou", () => {
    expect(formatarPct("7.5")).toBe("7,5");
    expect(formatarPct(7.5)).toBe("7,5");
    expect(formatarPct("30.00")).toBe("30");
    // O servidor devolve a coluna como texto numérico: 35 digitado vira 30.
    expect(formDoMeuSite({ pix_discount_pct: "30.00" }).pixPct).toBe("30");
  });

  test("o corpo manda o número aparado", () => {
    expect(corpoDoMeuSite({ ...formDoMeuSite({}), pixPct: "35" }).pix_discount_pct).toBe(30);
    expect(corpoDoMeuSite({ ...formDoMeuSite({}), pixPct: "7,5" }).pix_discount_pct).toBe(7.5);
  });
});

describe("Meu Site: teclado da chave Pix e dica do publicado", () => {
  test("numérico só para CPF, CNPJ e celular", () => {
    expect(tecladoDaChavePix("CPF").inputMode).toBe("numeric");
    expect(tecladoDaChavePix("CNPJ").inputMode).toBe("numeric");
    expect(tecladoDaChavePix("PHONE").inputMode).toBe("numeric");
    expect(tecladoDaChavePix("EMAIL")).toMatchObject({ inputMode: "email", keyboardType: "email-address" });
    expect(tecladoDaChavePix("RANDOM")).toMatchObject({ inputMode: "text", keyboardType: "default" });
  });

  test("interruptor diferente do salvo avisa", () => {
    expect(dicaDoPublicado(true, true)).toBe("Visível para clientes");
    expect(dicaDoPublicado(false, false)).toBe("Site oculto");
    expect(dicaDoPublicado(false, true)).toContain("alteração não salva");
    expect(dicaDoPublicado(true, false)).toContain("alteração não salva");
  });
});

// ── 3 · Design ────────────────────────────────────────────
describe("Design: a cor digitada", () => {
  test("#12 não salva e avisa ao sair do campo", () => {
    expect(lerCorDigitada("#12", false)).toEqual({ hex: null, erro: null });
    expect(lerCorDigitada("#12", true)).toEqual({ hex: null, erro: ERRO_DA_COR });
  });

  test("#rrggbb salva já enquanto digita; #rgb só ao sair", () => {
    expect(lerCorDigitada("#1E3A8A", false).hex).toBe("#1e3a8a");
    expect(lerCorDigitada("#abc", false).hex).toBeNull();
    expect(lerCorDigitada("#abc", true).hex).toBe("#aabbcc");
  });

  test("sem o # também serve; letra fora do hexadecimal avisa na hora", () => {
    expect(lerCorDigitada("ec4899", false).hex).toBe("#ec4899");
    expect(lerCorDigitada("#12345g", false).erro).toBe(ERRO_DA_COR);
    expect(lerCorDigitada("#1234567", false).erro).toBe(ERRO_DA_COR);
    expect(lerCorDigitada("", true)).toEqual({ hex: null, erro: null });
  });

  test("o aviso é o combinado", () => {
    expect(ERRO_DA_COR).toBe("Use 6 letras ou números depois do #");
    expect(hexValido("#ABC")).toBe("#aabbcc");
  });
});

describe("Design: a cor antes da configuração chegar", () => {
  test("sem config, vazio (nada de #7c3aed piscando)", () => {
    expect(corInicialDaLoja({})).toBe("");
    expect(corInicialDaLoja(null)).toBe("");
    expect(configChegou({})).toBe(false);
  });

  test("com config, a cor salva — ou o padrão do banco", () => {
    expect(corInicialDaLoja({ exists: true, primary_color: "#1e3a8a" })).toBe("#1e3a8a");
    expect(corInicialDaLoja({ exists: false })).toBe("#7c3aed");
    expect(configChegou({ exists: false })).toBe(true);
  });
});

describe("Design: tipografia recusada pelo servidor volta", () => {
  test("400 → a tela volta para a escolha anterior", async () => {
    const telas: string[] = [];
    const ok = await trocarESalvar({
      antes: "classic", depois: "editorial",
      mostrar: (v) => telas.push(v),
      salvar: () => Promise.reject(Object.assign(new Error("400"), { status: 400 })),
    });
    expect(ok).toBe(false);
    expect(telas).toEqual(["editorial", "classic"]);
  });

  test("salvou → fica a nova", async () => {
    const telas: string[] = [];
    const ok = await trocarESalvar({ antes: "classic", depois: "modern", mostrar: (v) => telas.push(v), salvar: () => Promise.resolve({}) });
    expect(ok).toBe(true);
    expect(telas).toEqual(["modern"]);
  });
});

// ── 4 · banner de fábrica ─────────────────────────────────
describe("banner de fábrica não conta como banner no ar", () => {
  const fabricaBackend = [{ kicker: "", headline: BANNER_DE_FABRICA.titulo, body: "Peças escolhidas a dedo pra você.", cta: "Ver produtos", image_url: null, enabled: true }];
  const fabricaPainel = [
    { kicker: "", headline: "Bem-vindo à nossa loja", body: "", cta: "Ver produtos", image_url: null, enabled: true },
    { kicker: "", headline: "", body: "", cta: "", image_url: null, enabled: false },
    { kicker: "", headline: "", body: "", cta: "", image_url: null, enabled: false },
  ];

  test("o campo do backend manda quando vem", () => {
    expect(bannersDeFabrica([{ headline: "Coleção" }], true)).toBe(true);
    expect(bannersDeFabrica(fabricaBackend, false)).toBe(false);
  });

  test("sem o campo, a leitura: texto de fábrica e nenhuma imagem", () => {
    expect(bannersDeFabrica(fabricaBackend)).toBe(true);
    expect(bannersDeFabrica(fabricaPainel)).toBe(true);
    expect(bannersDeFabrica([{ ...fabricaBackend[0], image_url: "https://x/b.jpg" }])).toBe(false);
    expect(bannersDeFabrica([{ ...fabricaBackend[0], headline: "Dia das Mães" }])).toBe(false);
    expect(bannersDeFabrica([])).toBe(false);
  });

  test("checklist: banner de fábrica fica pendente, com a ação de enviar", () => {
    const item = montarChecklist({ banners: fabricaPainel }).find((i) => i.chave === "banner")!;
    expect(item.feito).toBe(false);
    expect(item.acao).toContain("Envie um banner com sua campanha");
    const comServidor = montarChecklist({ banners: [{ headline: "Coleção", image_url: "x" }], bannersAutomaticos: true }).find((i) => i.chave === "banner")!;
    expect(comServidor.feito).toBe(false);
  });

  test("banner da lojista ligado conta", () => {
    expect(temBannerDaLojista([{ headline: "Coleção de verão", enabled: true }])).toBe(true);
    expect(temBannerDaLojista([{ headline: "Coleção de verão", enabled: false }])).toBe(false);
    const item = montarChecklist({ banners: [{ image_url: "https://x/b.jpg", enabled: true }] }).find((i) => i.chave === "banner")!;
    expect(item.feito).toBe(true);
  });
});

// ── 5 · Entrega ───────────────────────────────────────────
describe("Entrega: sem retirada nem entrega", () => {
  test("desligar a última forma de receber pede confirmação", () => {
    expect(desligarPedeConfirmacao("pickup_enabled", false, { pickup: true, delivery: false })).toBe(true);
    expect(desligarPedeConfirmacao("delivery_enabled", false, { pickup: false, delivery: true })).toBe(true);
  });

  test("com a outra ligada, ou ligando, não pergunta", () => {
    expect(desligarPedeConfirmacao("pickup_enabled", false, { pickup: true, delivery: true })).toBe(false);
    expect(desligarPedeConfirmacao("pickup_enabled", true, { pickup: false, delivery: false })).toBe(false);
  });

  test("as duas desligadas é a situação do aviso", () => {
    expect(semComoReceber(false, false)).toBe(true);
    expect(semComoReceber(true, false)).toBe(false);
    expect(AVISO_SEM_RECEBIMENTO).toBe("Sem retirada nem entrega, o cliente não tem como receber o pedido.");
  });

  test("no Studio o prazo é em dias úteis, sem horas nem minutos", () => {
    const st = textosDoPrazo("studio");
    expect(st.retiradaPlaceholder).toBe("Ex: Pronta em 3 dias úteis após a aprovação da arte");
    for (const texto of Object.values(st)) {
      expect(texto).not.toMatch(/\b\d+\s*(h|hora|horas|min)\b/i);
      expect(texto).toContain("dias úteis");
    }
  });
});

// ── 7 · Configurador ──────────────────────────────────────
describe("Configurador", () => {
  test("peça sem categoria: pela lista do servidor", () => {
    const orfas = new Set(["p1"]);
    expect(pecaSemCategoria({ id: "p1" }, { semCategoria: orfas })).toBe(true);
    expect(pecaSemCategoria({ id: "p2" }, { semCategoria: orfas })).toBe(false);
    // Sem a lista (a rota falhou): nenhum aviso falso.
    expect(pecaSemCategoria({ id: "p1" }, { semCategoria: null })).toBe(false);
  });

  test("peça sem categoria: pelo category_id, inclusive categoria que não existe mais", () => {
    expect(pecaSemCategoria({ id: "p", category_id: null }, {})).toBe(true);
    expect(pecaSemCategoria({ id: "p", category_id: "c9" }, { categorias: new Set(["c1"]) })).toBe(true);
    expect(pecaSemCategoria({ id: "p", category_id: "c1" }, { categorias: new Set(["c1"]) })).toBe(false);
  });

  test("plural certo (era 'disponívelis')", () => {
    expect(textoDoTotal(35)).toBe("35 produtos disponíveis para o configurador");
    expect(textoDoTotal(1)).toBe("1 produto disponível para o configurador");
    expect(textoSemCategoria(1)).toBe("1 peça sem categoria");
    expect(textoSemCategoria(4)).toBe("4 peças sem categoria");
  });

  test("posição em português", () => {
    expect(rotuloDaPosicao("center")).toBe("Centro");
    expect(rotuloDaPosicao("left")).toBe("Esquerda");
    expect(rotuloDaPosicao("right")).toBe("Direita");
    expect(rotuloDaPosicao(null)).toBeNull();
    expect(AVISO_SEM_CATEGORIA).toContain("Outras peças");
  });
});

// ── 9 · Pedidos pela loja ─────────────────────────────────
describe("Pedidos pela loja: fechada pela data limite", () => {
  const hoje = new Date(2026, 8, 27);
  const base = formDaConfig({});

  test("data passada: título e interruptor dizem fechada, e travado", () => {
    const topo = topoDaTemporada({ ...base, aceitando: true, ate: "2026-09-20" }, hoje);
    expect(topo.titulo).toBe("Loja fechada pela data limite");
    expect(topo.ligado).toBe(false);
    expect(topo.travado).toBe(true);
    expect(topo.sub).toContain("tire a data");
  });

  test("aberta e fechada na mão continuam como eram", () => {
    expect(topoDaTemporada({ ...base, aceitando: true, ate: "2026-12-20" }, hoje)).toMatchObject({ titulo: "Aceitando pedidos pela loja", ligado: true, travado: false });
    expect(topoDaTemporada({ ...base, aceitando: false }, hoje)).toMatchObject({ titulo: "Loja fechada para pedidos", ligado: false, travado: false });
  });

  test("o recado gravado aparece mesmo com a loja aberta", () => {
    expect(mostrarCampoDoRecado({ ...base, aceitando: true, ate: "", recado: "Volto em janeiro" })).toBe(true);
    expect(mostrarCampoDoRecado({ ...base, aceitando: true, ate: "", recado: "" })).toBe(false);
    expect(mostrarCampoDoRecado({ ...base, aceitando: false, recado: "" })).toBe(true);
  });
});

// ── 10 · Revisões ─────────────────────────────────────────
describe("Revisões: texto automático da política", () => {
  test("sem ':)' e sem travessão", () => {
    for (const t of [textoPadraoDaPolitica(0, 0), textoPadraoDaPolitica(3, 15), textoPadraoDaPolitica(1, 0)]) {
      expect(t).not.toContain(":)");
      expect(t).not.toContain("—");
      expect(t).not.toMatch(/\bpra\b/);
    }
  });

  test("conta certa", () => {
    expect(textoPadraoDaPolitica(3, 15)).toContain("A partir da 4ª revisão, cobramos R$ 15,00");
    expect(textoPadraoDaPolitica(1, 0)).toContain("1 revisão grátis");
  });
});

// ── 8 · verso e meio sem campo ────────────────────────────
describe("Personalização: lado ligado sem campo", () => {
  test("verso ligado e nenhum campo no verso avisa", () => {
    expect(ladoSemCampo({ has_back: true, fields: [{ side: "front" }] }, "back")).toBe(true);
    expect(ladoSemCampo({ has_back: true, fields: [{ side: "back" }] }, "back")).toBe(false);
    expect(ladoSemCampo({ has_back: false, fields: [] }, "back")).toBe(false);
  });

  test("o meio segue a mesma regra, sem confundir com o verso", () => {
    expect(ladoSemCampo({ has_middle: true, fields: [{ side: "back" }] }, "middle")).toBe(true);
    expect(ladoSemCampo({ has_middle: true, fields: [{ side: "middle" }] }, "middle")).toBe(false);
    expect(AVISO_LADO_SEM_CAMPO.back).toBe("Para o verso aparecer na loja, adicione pelo menos um campo com lado 'Verso'.");
  });
});

// ── 6 · tema ──────────────────────────────────────────────
describe("paleta do canal no Studio", () => {
  test("claro: cartão claro e tinta escura (o título não some)", () => {
    const p = paletaDoStudio(StudioColors);
    expect(p.bg3).toBe(StudioColors.paperCard);
    expect(p.ink).toBe(StudioColors.ink);
  });

  test("escuro: segue os tokens escuros", () => {
    const p = paletaDoStudio(StudioColorsDark as unknown as StudioPalette);
    expect(p.bg3).toBe(StudioColorsDark.paperCard);
    expect(p.ink).toBe(StudioColorsDark.ink);
  });

  test("sem provider, o Negócio fica como estava", () => {
    expect(Object.keys(PALETA_DO_NEGOCIO)).toEqual(expect.arrayContaining(["bg3", "bg4", "ink", "ink3", "border"]));
  });
});
