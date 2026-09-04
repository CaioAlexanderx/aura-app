// O arquivo da cliente entra quando bate com os formatos da lojista —
// estejam eles gravados como MIME ou como extensão solta.
import {
  formatoAceito, extensaoDoFormato, extensaoDoNome,
} from "@/components/studio/storefront/formatoDeArquivo";

describe("formatoAceito", () => {
  it("aceita PNG numa lista gravada como extensão solta (o caso da Sheid)", () => {
    const formatos = ["png", "jpg", "jpeg", "pdf"];
    expect(formatoAceito(formatos, "image/png", "cachorro.png")).toBe(true);
    expect(formatoAceito(formatos, "image/jpeg", "foto.JPG")).toBe(true);
    expect(formatoAceito(formatos, "application/pdf", "arte.pdf")).toBe(true);
  });

  it("aceita quando a lista está em MIME, como sempre deveria estar", () => {
    const formatos = ["image/png", "image/jpeg", "application/pdf"];
    expect(formatoAceito(formatos, "image/png", "a.png")).toBe(true);
    expect(formatoAceito(formatos, "image/jpg", "a.jpg")).toBe(true);
  });

  it("recusa o que a lojista não aceita", () => {
    expect(formatoAceito(["png", "jpg"], "image/webp", "a.webp")).toBe(false);
    expect(formatoAceito(["image/png"], "application/pdf", "a.pdf")).toBe(false);
    expect(formatoAceito(["png"], "image/svg+xml", "a.svg")).toBe(false);
  });

  it("sem tipo informado pelo navegador, a extensão do nome decide", () => {
    expect(formatoAceito(["png"], "", "foto.png")).toBe(true);
    expect(formatoAceito(["png"], undefined, "foto.gif")).toBe(false);
  });

  it("lista vazia não bloqueia — a regra do padrão é do chamador", () => {
    expect(formatoAceito([], "image/png")).toBe(true);
    expect(formatoAceito(null, "image/png")).toBe(true);
  });

  it("jpeg e jpg são o mesmo formato", () => {
    expect(extensaoDoFormato("image/jpeg")).toBe("jpg");
    expect(extensaoDoFormato("jpeg")).toBe("jpg");
    expect(extensaoDoFormato(".JPG")).toBe("jpg");
    expect(extensaoDoNome("x.jpeg")).toBe("jpg");
  });

  it("ignora entradas que não dá para entender", () => {
    expect(extensaoDoFormato("")).toBeNull();
    expect(extensaoDoFormato(42)).toBeNull();
    expect(extensaoDoNome("semextensao")).toBeNull();
  });
});
