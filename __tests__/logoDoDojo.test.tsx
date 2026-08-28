// ============================================================
// A sidebar do dojô mostrava a marca da FEDERAÇÃO.
//
// QA de 27/08/2026, véspera da liberação do Sensei Ivan: na visão do dojô o
// bloco da entidade abria com a FpktLogo — a logo da FPKT em cima do nome do
// dojô. A federação ocupando a identidade de quem entrou.
//
// A coluna já existia (companies.karate_logo_url, migration 147): a federação
// escrevia nela e o portal Canal B já a lia. O que faltava era o /dojo/me
// devolver, o dojô poder subir a própria, e o app desenhar.
//
// Estes testes guardam as três metades que quebram calado:
//   1. a normalização aceita o campo nos DOIS nomes do fio (o portal manda
//      karate_logo_url cru; o /dojo/me manda logo_url)
//   2. sem logo o slot vira MONOGRAMA, nunca um quadro vazio
//   3. a sidebar e o Painel não voltam a renderizar a FpktLogo
//
// Icon é mockado porque react-native-svg não passa pelo transformIgnorePatterns
// do projeto (mesma razão dos outros testes de render da casa).
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { DojoLogo, dojoInitials } from "@/components/karate/DojoLogo";
import { normalizeDojoMe } from "@/services/karateDojoInfoApi";

const raiz = path.join(__dirname, "..");
const lerFonte = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");

// O jest.config mapeia react-native → react-native-web, então TUDO na árvore
// vira <div>: procurar por type "Image"/"Text" não acha nada (e o teste
// passaria vazio). A identidade vem do testID, que o RNW emite como
// data-testid — por isso DojoLogo marca os dois estados.
function nos(arvore: any): any[] {
  const out: any[] = [];
  const anda = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(anda);
    out.push(n);
    if (n.children) anda(n.children);
  };
  anda(arvore);
  return out;
}

const porTestId = (arvore: any, id: string) =>
  nos(arvore).filter((n) => n.props && n.props["data-testid"] === id);

// Achata o texto (o React quebra interpolação em nós separados).
function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return textoDe(node.children);
}

// ============================================================
// 1) O campo chega pelos dois nomes do fio
// ============================================================
describe("normalizeDojoMe — logo do dojô", () => {
  test("lê logo_url do /dojo/me autenticado", () => {
    const me = normalizeDojoMe({ dojo: { id: "d1", logo_url: "https://r2/logo.png?v=7" } });
    expect(me.logo_url).toBe("https://r2/logo.png?v=7");
  });

  test("lê karate_logo_url — o nome cru que o portal Canal B devolve", () => {
    // Sem este fallback o portal mostraria monograma para um dojô que TEM
    // logo, e ninguém desconfiaria: monograma é um estado legítimo.
    const me = normalizeDojoMe({ id: "d1", karate_logo_url: "https://r2/portal.png" });
    expect(me.logo_url).toBe("https://r2/portal.png");
  });

  test("logo_url tem prioridade quando os dois vierem", () => {
    const me = normalizeDojoMe({ logo_url: "https://r2/novo.png", karate_logo_url: "https://r2/velho.png" });
    expect(me.logo_url).toBe("https://r2/novo.png");
  });

  test("ausente vira null, não undefined — o shell testa o valor direto", () => {
    expect(normalizeDojoMe({ id: "d1" }).logo_url).toBeNull();
    expect(normalizeDojoMe({ logo_url: "" }).logo_url).toBeNull();
  });

  test("o resto do contrato não regrediu com o campo novo", () => {
    const me = normalizeDojoMe({
      dojo: { id: "d1", name: "Dojô Shotokan", practitioners_count: 37, linked: true },
    });
    expect(me.name).toBe("Dojô Shotokan");
    expect(me.practitioners_count).toBe(37);
    expect(me.linked).toBe(true);
  });
});

// ============================================================
// 2) Iniciais — o fallback tem que ser legível, não literal
// ============================================================
describe("dojoInitials", () => {
  test("duas palavras viram primeira + última", () => {
    expect(dojoInitials("Dojô Shotokan Belém")).toBe("DB");
  });

  test("uma palavra vira as duas primeiras letras", () => {
    expect(dojoInitials("Shotokan")).toBe("SH");
  });

  test("pontuação nunca vira inicial", () => {
    // "Dojô Shotokan — Belém" tem o travessão como última 'palavra' se a
    // limpeza não acontecer: o monograma sairia "D—".
    expect(dojoInitials("Dojô Shotokan — Belém")).toBe("DB");
    expect(dojoInitials("A.C.M. Karatê")).toBe("AK");
  });

  test("acento é letra e conta como inicial", () => {
    expect(dojoInitials("Ácora Ébano")).toBe("ÁÉ");
  });

  test("nome vazio não quebra nem vira string vazia", () => {
    expect(dojoInitials("")).toBe("··");
    expect(dojoInitials("   ")).toBe("··");
    expect(dojoInitials("!!!")).toBe("··");
  });
});

// ============================================================
// 3) O componente: imagem quando há logo, monograma quando não há
// ============================================================
describe("DojoLogo", () => {
  test("com logo renderiza a imagem e não o monograma", () => {
    const t = renderer.create(<DojoLogo name="Dojô Shotokan Belém" logoUrl="https://r2/logo.png?v=3" />);
    expect(porTestId(t.toJSON(), "dojo-logo-image")).toHaveLength(1);
    expect(porTestId(t.toJSON(), "dojo-logo-monogram")).toHaveLength(0);
    expect(textoDe(t.toJSON())).toBe("");
  });

  test("sem logo renderiza o monograma, nunca um quadro vazio", () => {
    const t = renderer.create(<DojoLogo name="Dojô Shotokan Belém" logoUrl={null} />);
    expect(porTestId(t.toJSON(), "dojo-logo-image")).toHaveLength(0);
    expect(textoDe(t.toJSON())).toBe("DB");
  });

  test("string vazia conta como sem logo", () => {
    const t = renderer.create(<DojoLogo name="Dojô Shotokan Belém" logoUrl="" />);
    expect(porTestId(t.toJSON(), "dojo-logo-image")).toHaveLength(0);
    expect(textoDe(t.toJSON())).toBe("DB");
  });

  test("URL quebrada (404 no R2) cai no monograma em vez de deixar o quadro vazio", () => {
    // O objeto pode sumir do R2 (logo removida, deploy fora de ordem). Sem o
    // onError o sensei veria um retângulo vazio no lugar da marca.
    // create DENTRO de act: fora dele o efeito de mount (o reset de `failed`
    // quando a URL muda) fica pendente e só roda no PRIMEIRO act — desfazendo
    // o erro que acabamos de disparar. O teste passaria a mentir.
    let t: any;
    renderer.act(() => {
      t = renderer.create(<DojoLogo name="Dojô Shotokan Belém" logoUrl="https://r2/sumiu.png" />);
    });
    // O testID aparece em vários nós depois que o RNW expande o Image; o
    // NOSSO elemento é o único que tem source E onError juntos.
    const img = t.root.findAll((n: any) => !!(n.props?.source && n.props?.onError))[0];
    renderer.act(() => { img.props.onError(); });
    expect(porTestId(t.toJSON(), "dojo-logo-image")).toHaveLength(0);
    expect(textoDe(t.toJSON())).toBe("DB");
  });

  test("a marca é anunciada para leitor de tela nos dois estados", () => {
    const comLogo = renderer.create(<DojoLogo name="Dojô Shotokan Belém" logoUrl="https://r2/l.png" />).toJSON();
    const semLogo = renderer.create(<DojoLogo name="Dojô Shotokan Belém" logoUrl={null} />).toJSON();
    expect(porTestId(comLogo, "dojo-logo-image")[0].props["aria-label"]).toBe("Logo do Dojô Shotokan Belém");
    expect(porTestId(semLogo, "dojo-logo-monogram")[0].props["aria-label"]).toBe("Dojô Shotokan Belém");
  });

  test("o tamanho manda no quadro (o Painel usa grande)", () => {
    const t = renderer.create(<DojoLogo name="Aura Karatê" size={76} />).toJSON();
    const quadro = porTestId(t, "dojo-logo-monogram")[0];
    expect(quadro.props.style.width).toBe("76px");
    expect(quadro.props.style.height).toBe("76px");
  });
});

// ============================================================
// 4) A federação não volta para o lugar do dojô
// ============================================================
describe("a marca da visão do dojô é a do DOJÔ", () => {
  const shell = lerFonte("components/karate/DojoShell.tsx");
  const painel = lerFonte("app/karate/(dojo)/index.tsx");
  const config = lerFonte("app/karate/(dojo)/configuracoes.tsx");

  test("o shell do dojô não renderiza mais a FpktLogo", () => {
    // Só os comentários que explicam a troca podem citar o nome — nenhum
    // JSX <FpktLogo .../> e nenhum import.
    expect(shell).not.toMatch(/<FpktLogo/);
    expect(shell).not.toMatch(/import\s*\{[^}]*FpktLogo/);
  });

  test("sidebar e topbar mobile usam a logo do dojô", () => {
    // Duas superfícies: desktop (sidebar) e mobile (topbar). Trocar só uma
    // deixaria metade dos senseis vendo a federação.
    expect(shell.match(/<DojoLogo/g) || []).toHaveLength(2);
  });

  test("o Painel abre com a logo do dojô em destaque", () => {
    expect(painel).toMatch(/<DojoLogo/);
    // "grande" é o pedido: o slot do Painel é bem maior que o da sidebar (36).
    const m = painel.match(/<DojoLogo[^>]*size=\{(\d+)\}/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(64);
  });

  test("a FpktLogo continua existindo para a federação", () => {
    // A troca é de CONTEXTO, não remoção: o shell da federação é dela.
    expect(lerFonte("components/karate/KarateShell.tsx")).toMatch(/FpktLogo/);
  });
});

// ============================================================
// 5) O upload existe em Configurações e respeita o limite do servidor
// ============================================================
describe("upload da logo em Configurações", () => {
  const config = lerFonte("app/karate/(dojo)/configuracoes.tsx");
  const service = lerFonte("services/karateDojoInfoApi.ts");

  test("o card de logo entra na tela de Configurações", () => {
    expect(config).toMatch(/function LogoDojoCard/);
    expect(config).toMatch(/<LogoDojoCard\s*\/>/);
  });

  test("reusa o picker da casa (web + nativo), sem um segundo caminho", () => {
    expect(config).toMatch(/pickImageBase64/);
    // `new FormData`, não a palavra solta: o comentário do card cita FormData
    // justamente para dizer que NÃO se usa.
    expect(config).not.toMatch(/new FormData/);
  });

  test("o corte de tamanho é o do servidor — 5 MB do express.json", () => {
    // Subir 12 MB e receber um 413 genérico depois da espera não diz ao
    // sensei o que fazer; o corte tem que acontecer antes do upload.
    expect(config).toMatch(/LOGO_MAX_MB\s*=\s*5/);
  });

  test("o service manda base64 puro no campo content", () => {
    expect(service).toMatch(/uploadDojoLogo/);
    expect(service).toMatch(/content:\s*string/);
    expect(service).not.toMatch(/data:image/);
  });

  test("existe caminho para REMOVER a logo (voltar ao monograma)", () => {
    expect(service).toMatch(/removeDojoLogo/);
    expect(service).toMatch(/method:\s*"DELETE"/);
  });
});
