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

describe("sw.js continua só com Web Push (decisão de 10/09)", () => {
  const sw = ler("public", "sw.js");

  test("sem handler de fetch e sem Cache Storage", () => {
    expect(sw).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toMatch(/caches\.(open|match|keys|delete)/);
  });

  test("os handlers que já existiam seguem lá", () => {
    for (const ev of ["install", "activate", "push", "notificationclick"]) {
      expect(sw).toMatch(new RegExp(`addEventListener\\(\\s*['"]${ev}['"]`));
    }
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
