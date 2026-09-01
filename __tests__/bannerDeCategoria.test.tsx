// ============================================================
// Banner da categoria — o campo que faltava para a tira da home sair
// do ladrilho de cor.
//
// O backend já aceitava `?type=categoria&categoria_id=` desde o #636, e a
// tira já está no ar servindo 4 cartões da Finesse. Sem este campo, os
// quatro ficariam com fundo de cor para sempre: não havia por onde subir
// imagem.
//
// O QUE ESTES TESTES GUARDAM:
//
// 1. SÓ AS RAÍZES têm o botão. A tira mostra o primeiro nível e nada
//    mais — oferecer o campo numa subcategoria é pedir trabalho que não
//    aparece em lugar nenhum.
// 2. A MEDIDA vem de specsDeImagem.ts. Escrita de novo aqui, viraria a
//    segunda fonte, e é assim que o painel passa a pedir 1600×900
//    enquanto a loja desenha outra coisa.
// ============================================================
import fs from "fs";
import path from "path";
import { SPECS } from "@/components/screens/canal/specsDeImagem";

const raiz = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("a medida mora num lugar só", () => {
  test("existe spec de categoria, com a medida escrita", () => {
    expect(SPECS.categoria).toBeTruthy();
    expect(SPECS.categoria.resumo).toContain("1600×900");
    expect(SPECS.categoria.detalhes.length).toBeGreaterThan(2);
  });

  test("a spec avisa que só as principais têm banner", () => {
    // É a regra da tira dita na voz da lojista, no momento em que ela vai
    // procurar o campo na subcategoria e não achar.
    const tudo = SPECS.categoria.detalhes.join(" ").toLowerCase();
    expect(tudo).toContain("principais");
  });

  test("e que sem banner a categoria aparece assim mesmo", () => {
    // Decisão de Caio (30/08): entra com fundo de cor, não some. Se a
    // lojista achar que sem imagem a categoria some, ela não sobe nada
    // e a tira fica sem sentido.
    const tudo = SPECS.categoria.detalhes.join(" ").toLowerCase();
    expect(tudo).toMatch(/sem banner/);
  });

  test("a tela lê a spec, não repete a medida", () => {
    const tela = raiz("app/catalogo/organizar.tsx");
    expect(tela).toContain("SPECS.categoria.resumo");
    // Se "1600" aparecer solto na tela, alguém recriou a fonte.
    const semImports = tela.split("\n").filter((l) => !l.trim().startsWith("import")).join("\n");
    expect(semImports).not.toContain("1600");
  });

  test("o hook também não guarda medida própria", () => {
    // Olha o CÓDIGO, não o comentário: a primeira versão deste teste
    // reprovava por causar match no comentário que EXPLICA a regra —
    // exatamente o erro que ele deveria pegar nos outros.
    const linhas = raiz("hooks/useBannerDeCategoria.ts").split(/\r?\n/);
    const codigo = linhas.filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join(" ");
    expect(codigo).not.toContain("LARGURA_IDEAL");
    expect(codigo).not.toMatch(/1600|900/);
  });
});

describe("só o primeiro nível ganha o botão", () => {
  const tela = raiz("app/catalogo/organizar.tsx");

  test("o botão está atrás de nivel === 0", () => {
    const bloco = tela.slice(tela.indexOf("banner-${cat.id}") - 600, tela.indexOf("banner-${cat.id}"));
    expect(bloco).toContain("nivel === 0");
  });

  test("o rótulo diz se já tem banner", () => {
    // "banner ✓" é o único jeito de ela saber, na árvore, quais das
    // quatro já subiu — sem abrir a loja.
    expect(tela).toContain('cat.banner_url ? "banner ✓" : "banner"');
  });
});

describe("o upload fala com a rota certa", () => {
  const hook = raiz("hooks/useBannerDeCategoria.ts");

  test("usa type=categoria e manda o id na query", () => {
    expect(hook).toContain("type=categoria");
    expect(hook).toContain("categoria_id=");
    expect(hook).toContain("encodeURIComponent");
  });

  test("respeita o teto de 5MB antes de ler o arquivo", () => {
    // Ler um arquivo de 40MB em base64 trava a aba antes de o backend
    // ter chance de recusar.
    const antes = hook.slice(0, hook.indexOf("readAsDataURL"));
    expect(antes).toContain("TAMANHO_MAXIMO");
  });

  test("remove o input do DOM em todo caminho de saída", () => {
    // Um input por clique acumulado no DOM faz o próximo change
    // disparar em todos eles.
    const trecho = hook.slice(hook.indexOf("addEventListener"));
    expect(trecho).toContain("removeChild");
  });

  test("invalida a árvore depois de subir", () => {
    // Sem isso a miniatura só apareceria no próximo carregamento.
    expect(hook).toContain("invalidateQueries");
  });
});
