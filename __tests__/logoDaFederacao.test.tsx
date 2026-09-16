// ============================================================
// O app dizia "FPKT" para quem não é FPKT.
//
// 16/09/2026: criamos a segunda federação (JKA Teste) e ela expôs o que uma
// federação só nunca mostra. No print do Caio, o breadcrumb do campeonato da
// JKA dizia literalmente "FPKT / Competições / Detalhe", e a sidebar abria
// com o bitmap da pirâmide da FPKT em cima do nome dela.
//
// É o mesmo erro que o DojoShell levou em 27/08/2026 (ver
// __tests__/logoDoDojo.test.tsx), um nível acima: a marca de uma entidade
// carimbada na casa de outra. A diretriz que saiu daí é mais dura que a
// correção pontual — NENHUMA identidade de federação escrita no código, tudo
// derivado do cadastro.
//
// Estes testes guardam as partes que quebram CALADO (a tela continua
// renderizando bonito, só que com a marca errada):
//   1. a identidade normaliza nos dois embrulhos e nos dois nomes de campo
//   2. sem logo o slot vira MONOGRAMA, nunca um quadro vazio
//   3. o shell da federação não volta a renderizar a FpktLogo nem "FPKT"
//   4. as rotas PÚBLICAS (sem JWT) não caem no nome de outra federação
//
// Icon é mockado porque react-native-svg não passa pelo
// transformIgnorePatterns do projeto (mesma razão dos outros testes de
// render da casa).
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { FederationLogo, federationInitials } from "@/components/karate/FederationLogo";
import { normalizeFederationIdentity } from "@/services/karateFederationIdentityApi";

const raiz = path.join(__dirname, "..");
const lerFonte = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");

// O jest.config mapeia react-native → react-native-web, então TUDO na árvore
// vira <div>: procurar por type "Image"/"Text" não acha nada (e o teste
// passaria vazio). A identidade vem do testID, que o RNW emite como
// data-testid — por isso FederationLogo marca os dois estados.
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
// 1) A identidade chega inteira, venha como vier
// ============================================================
describe("normalizeFederationIdentity", () => {
  test("lê o objeto cru", () => {
    const f = normalizeFederationIdentity({
      id: "f1", name: "JKA Teste", slug: "jka-teste", logo_url: "https://r2/jka.png?v=3",
    });
    expect(f.name).toBe("JKA Teste");
    expect(f.logo_url).toBe("https://r2/jka.png?v=3");
  });

  test("lê embrulhado em { federation }", () => {
    // O shape exato da rota nova pode evoluir; a sidebar não pode depender
    // de qual dos dois o backend escolheu no dia.
    const f = normalizeFederationIdentity({ federation: { id: "f1", name: "JKA Teste" } });
    expect(f.id).toBe("f1");
    expect(f.name).toBe("JKA Teste");
  });

  test("aceita karate_logo_url — o nome cru da coluna", () => {
    const f = normalizeFederationIdentity({ karate_logo_url: "https://r2/cru.png" });
    expect(f.logo_url).toBe("https://r2/cru.png");
  });

  test("ausente e vazio viram null, não undefined — o shell testa o valor direto", () => {
    expect(normalizeFederationIdentity({ id: "f1" }).logo_url).toBeNull();
    expect(normalizeFederationIdentity({ logo_url: "" }).logo_url).toBeNull();
    expect(normalizeFederationIdentity(null).name).toBeNull();
  });
});

// ============================================================
// 2) Iniciais — o fallback tem que ser legível, não literal
// ============================================================
describe("federationInitials", () => {
  test("duas ou mais palavras viram primeira + última", () => {
    expect(federationInitials("Federação Paulista de Karatê-Dô Tradicional")).toBe("FT");
    expect(federationInitials("JKA Teste")).toBe("JT");
  });

  test("uma palavra vira as duas primeiras letras", () => {
    expect(federationInitials("Shotokan")).toBe("SH");
  });

  test("pontuação nunca vira inicial", () => {
    // Sem a limpeza, "Federação Paulista — Karatê" sairia com o travessão.
    expect(federationInitials("Federação Paulista — Karatê")).toBe("FK");
    expect(federationInitials("F.P.K.T. Karatê")).toBe("FK");
  });

  test("nome vazio não quebra o monograma", () => {
    expect(federationInitials("")).toBe("··");
    expect(federationInitials("   ")).toBe("··");
  });
});

// ============================================================
// 3) Sem logo é monograma; com logo é a imagem — nunca um buraco
// ============================================================
describe("FederationLogo", () => {
  test("sem logo desenha o monograma com as iniciais", () => {
    const a = renderer.create(<FederationLogo name="JKA Teste" logoUrl={null} />).toJSON();
    expect(porTestId(a, "federation-logo-monogram")).toHaveLength(1);
    expect(porTestId(a, "federation-logo-image")).toHaveLength(0);
    expect(textoDe(a)).toContain("JT");
  });

  test("string vazia conta como sem logo", () => {
    // O backend pode devolver "" em vez de null; um <Image src=""> renderiza
    // o ícone de imagem quebrada, que é pior que o monograma.
    const a = renderer.create(<FederationLogo name="JKA Teste" logoUrl="" />).toJSON();
    expect(porTestId(a, "federation-logo-monogram")).toHaveLength(1);
  });

  test("com logo desenha a imagem, não o monograma", () => {
    const a = renderer
      .create(<FederationLogo name="JKA Teste" logoUrl="https://r2/jka.png" />)
      .toJSON();
    expect(porTestId(a, "federation-logo-image")).toHaveLength(1);
    expect(porTestId(a, "federation-logo-monogram")).toHaveLength(0);
  });
});

// ============================================================
// 4) A marca do shell da federação é de quem está logado
// ============================================================
describe("o shell da federação não é o shell da FPKT", () => {
  const shell = lerFonte("components/karate/KarateShell.tsx");

  test("o shell não renderiza mais a FpktLogo", () => {
    // Só os comentários que explicam a troca podem citar o nome — nenhum
    // JSX <FpktLogo .../> e nenhum import.
    expect(shell).not.toMatch(/<FpktLogo/);
    expect(shell).not.toMatch(/import\s*\{[^}]*FpktLogo/);
  });

  test("sidebar e topbar mobile usam a logo da federação", () => {
    // Duas superfícies: desktop (sidebar) e mobile (topbar). Trocar só uma
    // deixaria metade dos usuários vendo a federação errada.
    expect(shell.match(/<FederationLogo/g) || []).toHaveLength(2);
  });

  test("o breadcrumb não tem mais a raiz escrita à mão", () => {
    // Era <Text style={styles.crumbRoot}>FPKT</Text> — o print do Caio.
    expect(shell).toMatch(/styles\.crumbRoot[^>]*>\s*\{federationName\}/);
  });

  test("nenhum texto renderizado do shell cita uma federação pelo nome", () => {
    // Comentários explicam a história; JSX e strings não podem carimbar marca.
    expect(semComentarios(shell)).not.toMatch(/FPKT/);
  });
});

// ============================================================
// 5) Rotas PÚBLICAS — sem JWT, o fallback é neutro
//
// Estas telas não têm sessão: o nome vem do payload da própria rota. Quando
// ele ainda não chegou, o fallback tem que ser NEUTRO. Um `|| "FPKT"` aqui é
// o bug original na sua forma mais silenciosa — a página de verificação de
// uma carteirinha da JKA carimbada como FPKT.
// ============================================================
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("telas públicas caem no neutro, nunca em outra federação", () => {
  const publicas = [
    "app/karate/[slug]/index.tsx",
    "app/karate/[slug]/consulta/index.tsx",
    "app/karate/[slug]/inscricao/[eventId].tsx",
    "app/karate/[slug]/p/[publicToken].tsx",
    "app/karate/[slug]/dojo/portal.tsx",
    "app/karate/verify/[token].tsx",
    "app/karate/roster-self/[token].tsx",
  ];

  test.each(publicas)("%s não tem marca de federação no código", (arquivo) => {
    expect(semComentarios(lerFonte(arquivo))).not.toMatch(/FPKT/);
  });
});
