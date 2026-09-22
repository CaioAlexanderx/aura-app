// ============================================================
// PWA Fase 1 — o que faz o celular enxergar o painel como app.
//
// Este teste lê arquivos, não código: manifesto, ícones, index.html e o
// service worker. É o tipo de coisa que quebra em silêncio — um ícone
// apagado, um `sizes` errado, uma meta tag perdida num merge — e que o
// Chrome só reporta na aba Application do DevTools, onde ninguém olha.
//
// Também trava DUAS decisões:
//   · o sw.js continua sem cache offline (decisão de 10/09: bundle velho
//     depois do deploy é pior que dinossauro do Chrome);
//   · o convite do Chrome é guardado pelo index.html ANTES do JS do app,
//     senão o botão "Instalar" depende de o React ganhar a corrida.
//
// Como em __tests__/moduloReativacaoNoMenu.test.ts, os encaixes nas telas
// são conferidos pelo fonte: importar _layout/index/configuracoes puxaria
// expo-router e react-native-web inteiros.
// ============================================================
import fs from "fs";
import path from "path";

const RAIZ = path.join(__dirname, "..");
const PUBLIC = path.join(RAIZ, "public");
const ler = (...p: string[]) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");

/** Largura e altura de um PNG, pelo cabeçalho (IHDR), sem biblioteca. */
function dimensoesPng(caminho: string): { w: number; h: number } {
  const b = fs.readFileSync(caminho);
  expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // assinatura PNG
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const manifesto = JSON.parse(ler("public", "manifest.webmanifest"));

describe("manifest.webmanifest", () => {
  test("campos que o Chrome exige para oferecer instalação", () => {
    expect(manifesto.name).toBe("Aura.");
    expect(manifesto.short_name).toBe("Aura");
    expect(manifesto.start_url).toBe("/");
    expect(manifesto.scope).toBe("/");
    expect(manifesto.id).toBe("/");
    expect(manifesto.display).toBe("standalone");
    expect(manifesto.lang).toBe("pt-BR");
  });

  test("cores: fundo da tela de abertura e barra de status iguais ao bg do tema escuro", () => {
    // constants/colors.ts, Dark.bg. A tela de abertura do Android nasce
    // deste background_color; se divergir do app, pisca ao abrir.
    expect(manifesto.background_color).toBe("#060816");
    expect(manifesto.theme_color).toBe("#060816");
  });

  test("ícones: 192 e 512 'any' e um 512 'maskable', todos existentes e do tamanho declarado", () => {
    const porChave = new Map<string, any>();
    for (const ic of manifesto.icons) porChave.set(`${ic.sizes}/${ic.purpose}`, ic);
    expect(porChave.has("192x192/any")).toBe(true);
    expect(porChave.has("512x512/any")).toBe(true);
    expect(porChave.has("512x512/maskable")).toBe(true);

    for (const ic of manifesto.icons) {
      expect(ic.type).toBe("image/png");
      expect(ic.src.startsWith("/")).toBe(true);
      const arquivo = path.join(PUBLIC, ic.src.replace(/^\//, ""));
      expect(fs.existsSync(arquivo)).toBe(true);
      const [w, h] = ic.sizes.split("x").map(Number);
      expect(dimensoesPng(arquivo)).toEqual({ w, h });
    }
  });

  test("os ícones não se repetem por (sizes, purpose)", () => {
    const chaves = manifesto.icons.map((i: any) => `${i.sizes}/${i.purpose}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("ícone do iPhone (apple-touch-icon)", () => {
  test("existe em 180x180", () => {
    expect(dimensoesPng(path.join(PUBLIC, "aura-icone-180.png"))).toEqual({ w: 180, h: 180 });
  });
});

describe("index.html", () => {
  const html = ler("public", "index.html");

  test("aponta para o manifesto", () => {
    expect(html).toMatch(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"\s*\/?>/);
  });

  test("meta tags de app: cor do tema, iPhone em tela cheia, nome curto, ícone do iPhone", () => {
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#060816"/);
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"/);
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-title"\s+content="Aura"/);
    expect(html).toMatch(/<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="black"/);
    expect(html).toMatch(/<link\s+rel="apple-touch-icon"\s+href="\/aura-icone-180\.png"/);
  });

  test("guarda o convite do Chrome antes do JS do app (window.__auraConvite)", () => {
    expect(html).toMatch(/addEventListener\(\s*['"]beforeinstallprompt['"]/);
    expect(html).toMatch(/preventDefault\(\)/);
    expect(html).toMatch(/window\.__auraConvite\s*=/);
  });

  test("viewport segue como estava: sem viewport-fit=cover, o app não trata safe areas", () => {
    expect(html).toMatch(/<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1, shrink-to-fit=no"/);
    expect(html).not.toMatch(/viewport-fit/);
  });
});

// ------------------------------------------------------------
// Fase 2 (22/09/2026): o sw.js ganhou a página "sem conexão", e SÓ ela. A
// decisão de 10/09 (nada do painel em cache) continua, agora com o
// contorno exato travado aqui: o handler de fetch só olha navegações, só
// age quando a rede falha, e o cache contém exatamente dois arquivos.
// ------------------------------------------------------------
describe("sw.js: Web Push + página offline, e nada do painel em cache", () => {
  const sw = ler("public", "sw.js");

  test("os handlers de push que já existiam seguem lá", () => {
    for (const ev of ["install", "activate", "push", "notificationclick", "fetch"]) {
      expect(sw).toMatch(new RegExp(`addEventListener\\(\\s*['"]${ev}['"]`));
    }
  });

  test("o cache tem exatamente a página offline e o ícone, e os dois existem", () => {
    const m = sw.match(/var ARQUIVOS_OFFLINE = \[([^\]]+)\]/);
    expect(m).not.toBeNull();
    const lista = Array.from(m![1].matchAll(/'([^']+)'/g)).map((x) => x[1]).sort();
    expect(lista).toEqual(["/aura-icone-192.png", "/offline.html"]);
    for (const a of lista) expect(fs.existsSync(path.join(PUBLIC, a.replace(/^\//, "")))).toBe(true);
  });

  test("o fetch só olha navegação e só responde do cache quando a rede FALHA", () => {
    const i = sw.indexOf("addEventListener('fetch'");
    const corpo = sw.slice(i, sw.indexOf("addEventListener('push'"));
    expect(corpo).toMatch(/if \(event\.request\.mode !== 'navigate'\) return;/);
    expect(corpo).toMatch(/fetch\(event\.request\)\.catch\(/);
    expect(corpo).toMatch(/caches\.match\('\/offline\.html'\)/);
    // Nunca serve o painel do cache nem guarda nada em runtime.
    expect(corpo).not.toMatch(/caches\.match\(event\.request/);
    expect(sw).not.toMatch(/cache\.put\(/);
    expect(sw).not.toMatch(/_expo/);
  });

  test("a versão do cache tem prefixo próprio e a ativação só limpa os deste worker", () => {
    expect(sw).toMatch(/var CACHE_OFFLINE = 'aura-offline-v\d+'/);
    expect(sw).toMatch(/k\.indexOf\('aura-offline-'\) === 0 && k !== CACHE_OFFLINE/);
  });
});

describe("offline.html", () => {
  const html = ler("public", "offline.html");

  test("é autossuficiente: nenhum recurso externo, só o ícone local", () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toMatch(/src="\/aura-icone-192\.png"/);
    expect(html).not.toMatch(/<link\s[^>]*rel="stylesheet"/);
  });

  test("tem o botão, tenta reconectar sozinha e volta para onde a pessoa estava", () => {
    expect(html).toMatch(/Tentar de novo/);
    expect(html).toMatch(/method: 'HEAD', cache: 'no-store'/);
    expect(html).toMatch(/addEventListener\('online'/);
    expect(html).toMatch(/get\('de'\)/);
  });

  test("sem 'verificando a conexão' piscando (pedido de 22/09)", () => {
    expect(html).not.toMatch(/Verificando/);
  });
});

describe("Fase 2: nova versão, iPhone instalado e medição", () => {
  test("GlobalOverlays monta a barra de nova versão e a folha de impressão do iPhone", () => {
    const g = ler("components", "GlobalOverlays.tsx");
    expect(g).toMatch(/<NovaVersaoBanner \/>/);
    expect(g).toMatch(/<ImpressaoNoIphoneSheet \/>/);
    const layout = ler("app", "(tabs)", "_layout.tsx");
    expect((layout.match(/<GlobalOverlays \/>/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test("openPrintWindow desvia para o aviso no iPhone instalado, antes de abrir janela", () => {
    const p = ler("services", "printWindow.ts");
    expect(p).toMatch(/if \(ehIphoneInstalado\(\)\) \{ avisarImpressaoNoIphone\(\); return "iphone_app"; \}/);
    expect(p.indexOf("ehIphoneInstalado()")).toBeLessThan(p.indexOf('window.open("", "_blank", features)'));
    expect(p).toMatch(/"iphone_app"/);
  });

  test("etiquetas (PrintLabels) fazem o mesmo desvio", () => {
    const l = ler("components", "PrintLabels.tsx");
    expect(l).toMatch(/if \(ehIphoneInstalado\(\)\) \{ avisarImpressaoNoIphone\(\); return; \}/);
    expect(l.indexOf("ehIphoneInstalado()")).toBeLessThan(l.indexOf('window.open(url, "_blank")'));
  });

  test("download: os quatro pontos antigos passaram a usar utils/salvarArquivo", () => {
    const arquivos = [
      ["utils", "csv.ts"],
      ["components", "screens", "financeiro", "v2", "abcShared.tsx"],
      ["components", "karate", "saude-rede", "shared.tsx"],
      ["components", "studio", "baixarArquivo.ts"],
    ];
    for (const a of arquivos) {
      const src = ler(...a);
      expect(src).toMatch(/from "@\/utils\/salvarArquivo"/);
      expect(src).not.toMatch(/createObjectURL/);
    }
  });

  test("api.ts manda X-Aura-App só quando instalado", () => {
    const api = ler("services", "api.ts");
    expect(api).toMatch(/if \(estaInstalado\(\)\) \(headers as Record<string, string>\)\["X-Aura-App"\] = "standalone";/);
  });
});

describe("encaixe nas telas", () => {
  test("Painel: InstallBanner na pilha de avisos, junto de ProfileBanner e VerifyEmailBanner", () => {
    const painel = ler("app", "(tabs)", "index.tsx");
    expect(painel).toMatch(/import \{ InstallBanner \} from "@\/components\/InstallBanner";/);
    const posProfile = painel.indexOf("<ProfileBanner />");
    const posInstall = painel.indexOf("<InstallBanner />");
    const posSkeleton = painel.indexOf("<SkeletonDashboard />");
    expect(posProfile).toBeGreaterThan(-1);
    expect(posInstall).toBeGreaterThan(posProfile);
    expect(posInstall).toBeLessThan(posSkeleton);
  });

  test("Configurações: seção 'Aura no celular' entre 'Minha conta' e 'Aparencia'", () => {
    const cfg = ler("app", "(tabs)", "configuracoes.tsx");
    expect(cfg).toMatch(/import \{ AuraNoCelularCard \} from "@\/components\/screens\/configuracoes\/AuraNoCelularCard";/);
    const conta = cfg.indexOf('<SectionTitle title="Minha conta" />');
    const celular = cfg.indexOf('<SectionTitle title="Aura no celular" />');
    const aparencia = cfg.indexOf('<SectionTitle title="Aparencia" />');
    expect(conta).toBeGreaterThan(-1);
    expect(celular).toBeGreaterThan(conta);
    expect(celular).toBeLessThan(aparencia);
    expect(cfg.indexOf("<AuraNoCelularCard />")).toBeGreaterThan(celular);
  });

  test("nenhuma tela nova, então nenhuma chave mod nova no NAV (regra 3 não se aplica)", () => {
    const layout = ler("app", "(tabs)", "_layout.tsx");
    expect(layout).not.toMatch(/mod: "(pwa|instalar|celular)/);
  });
});
