// ============================================================
// PWA 2b.1 — instalar o Aura Karatê no celular.
//
// O bug que isto fecha: a Fase 1 pôs o convite de instalar no Painel e em
// Configurações das ABAS. Dojô e federação têm shell próprio e não passam
// por lá, então quem só usa o Karatê nunca via o convite — e no iPhone o
// Web Push só funciona com o app instalado, então o Karatê ficou sem o
// ganho todo. Três coisas precisam continuar verdadeiras:
//
//   1. o card está montado nos DOIS shells do Karatê, e em Configurações
//      do dojô como porta permanente;
//   2. ele NÃO aparece no portal público (subdomínio de federação): lá o
//      mesmo site é servido em outro endereço, e instalar criaria um
//      segundo app com o nome do painel. Trava explícita por subdomínio;
//   3. a lógica é a MESMA da Fase 1 (useInstalarApp / instalarApp), sem
//      uma segunda detecção de plataforma nem uma segunda regra de
//      dispensa — o convite é do aparelho, não do produto.
//
// Mais a correção da barra de status, que o manifesto declara escura.
//
// Como em __tests__/pwaManifest.test.ts, os encaixes são conferidos pelo
// fonte: importar os shells puxaria expo-router, react-native-web e o
// contexto de federação inteiros para medir uma linha de JSX.
// ============================================================
import fs from "fs";
import path from "path";

const RAIZ = path.join(__dirname, "..");
const ler = (...p: string[]) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");

const CARD = ler("components", "karate", "InstalarKarateCard.tsx");
const GUIA = ler("components", "karate", "GuiaInstalarKarate.tsx");
const CFG_CARD = ler("components", "karate", "AuraNoCelularKarateCard.tsx");
const DOJO_SHELL = ler("components", "karate", "DojoShell.tsx");
const FED_SHELL = ler("components", "karate", "KarateShell.tsx");
const DOJO_CFG = ler("app", "karate", "(dojo)", "configuracoes.tsx");
const HOOK_BARRA = ler("hooks", "useCorDaBarraDeStatus.ts");
const MANIFESTO = JSON.parse(ler("public", "manifest.webmanifest"));
const KARATE_TEMA = ler("constants", "karateTheme.ts");

describe("o convite chega aos dois shells do Karatê", () => {
  test("DojoShell monta o card, no caminho mobile, depois do aviso de trial", () => {
    expect(DOJO_SHELL).toMatch(/import \{ InstalarKarateCard \} from "@\/components\/karate\/InstalarKarateCard";/);
    expect(DOJO_SHELL).toMatch(/<InstalarKarateCard contexto="dojo" \/>/);
    // A pilha de avisos: trial primeiro, convite depois, conteúdo em seguida.
    const trial = DOJO_SHELL.lastIndexOf("<TrialBanner />");
    const card = DOJO_SHELL.indexOf('<InstalarKarateCard contexto="dojo" />');
    const conteudo = DOJO_SHELL.indexOf("<BottomTabNav />");
    expect(trial).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(trial);
    expect(card).toBeLessThan(conteudo);
  });

  test("KarateShell (federação) monta o card com o texto da federação", () => {
    expect(FED_SHELL).toMatch(/import \{ InstalarKarateCard \} from "@\/components\/karate\/InstalarKarateCard";/);
    expect(FED_SHELL).toMatch(/<InstalarKarateCard contexto="federacao" \/>/);
    const card = FED_SHELL.indexOf('<InstalarKarateCard contexto="federacao" />');
    expect(card).toBeLessThan(FED_SHELL.indexOf("<BottomTabNav />"));
  });

  test("Configurações do dojô tem a porta permanente", () => {
    expect(DOJO_CFG).toMatch(/import \{ AuraNoCelularKarateCard \} from "@\/components\/karate\/AuraNoCelularKarateCard";/);
    expect(DOJO_CFG).toMatch(/<AuraNoCelularKarateCard \/>/);
  });
});

describe("não aparece no portal público (subdomínio de federação)", () => {
  test("card e Configurações travam por isMicrositeHost, antes de qualquer outra decisão", () => {
    for (const [nome, src] of [["card", CARD], ["configurações", CFG_CARD]] as const) {
      expect(src).toMatch(/import \{ isMicrositeHost \} from "@\/utils\/microsite";/);
      expect(src).toMatch(/if \(isMicrositeHost\(\)\) return null;/);
      // Antes de olhar largura/estado: o portal não deve nem calcular.
      const trava = src.indexOf("isMicrositeHost()");
      const usoDeEstado = src.search(/if \((instalado|width)/);
      expect(trava).toBeGreaterThan(-1);
      if (usoDeEstado > -1) expect(trava).toBeLessThan(usoDeEstado);
      expect(nome).toBeTruthy();
    }
  });

  test("o layout do portal não monta shell nenhum do Karatê", () => {
    const portal = ler("app", "karate", "[slug]", "_layout.tsx");
    expect(portal).not.toMatch(/^import .*(KarateShell|DojoShell)/m);
    expect(portal).not.toMatch(/<(KarateShell|DojoShell)/);
  });
});

describe("a lógica é a da Fase 1, sem segunda cópia", () => {
  test("o card lê useInstalarApp e não redetecta plataforma", () => {
    expect(CARD).toMatch(/import \{ useInstalarApp \} from "@\/hooks\/useInstalarApp";/);
    expect(CARD).not.toMatch(/userAgent|maxTouchPoints|display-mode|beforeinstallprompt/);
  });

  test("Configurações do Karatê reaproveita o mesmo hook e o mesmo Web Push", () => {
    expect(CFG_CARD).toMatch(/import \{ useInstalarApp \} from "@\/hooks\/useInstalarApp";/);
    expect(CFG_CARD).toMatch(/from "@\/services\/webPush"/);
    expect(CFG_CARD).not.toMatch(/pushManager|applicationServerKey/);
  });

  test("a dispensa é a do painel: nenhuma chave nova de 14 dias", () => {
    for (const src of [CARD, CFG_CARD, GUIA]) {
      expect(src).not.toMatch(/localStorage|aura\.instalarApp/);
    }
    expect(CARD).toMatch(/dispensar/);
  });

  test("só a roupa muda: Shoji nos três, nunca os tokens violeta do painel", () => {
    for (const src of [CARD, GUIA, CFG_CARD]) {
      expect(src).toMatch(/from "@\/constants\/karateTheme"/);
      expect(src).not.toMatch(/from "@\/constants\/colors"/);
    }
  });

  test("o botão primário é sumi (tinta), não o vermelhão de carimbo", () => {
    // Regra da casa no Karatê: o vermelho é acento RARO (karateTheme.ts).
    expect(KARATE_TEMA).toMatch(/bot[aã]o PRIM[ÁA]RIO Shoji = sumi \(ink\), n[aã]o red/i);
    for (const src of [CARD, GUIA, CFG_CARD]) {
      expect(src).toMatch(/backgroundColor: ShojiPalette\.ink/);
    }
  });
});

describe("barra de status: papel no Karatê, escuro no resto", () => {
  test("os dois shells pintam a barra com o papel enquanto montados", () => {
    for (const shell of [DOJO_SHELL, FED_SHELL]) {
      expect(shell).toMatch(/import \{ useCorDaBarraDeStatus \} from "@\/hooks\/useCorDaBarraDeStatus";/);
      expect(shell).toMatch(/useCorDaBarraDeStatus\(ShojiPalette\.paperWarm\)/);
    }
  });

  test("o hook devolve a cor anterior ao desmontar, e o padrão bate com o manifesto", () => {
    expect(HOOK_BARRA).toMatch(/return \(\) => \{ meta\.setAttribute\("content", anterior\); \};/);
    expect(HOOK_BARRA).toMatch(/export const COR_PADRAO = "#060816";/);
    expect(MANIFESTO.theme_color).toBe("#060816");
  });

  test("o papel usado é o token, e é opaco (barra de status não aceita alfa)", () => {
    const m = KARATE_TEMA.match(/paperWarm:\s*"(#[0-9a-fA-F]{6})"/);
    expect(m).not.toBeNull();
    expect(m![1].toLowerCase()).toBe("#f6f1e7");
  });
});
