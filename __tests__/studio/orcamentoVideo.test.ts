// ============================================================
// Orçamento em vídeo 3D pelo WhatsApp (28/09/2026)
//
// Regras que os testes seguram (decisões do PO):
//   - desconto só o que a lojista definiu no orçamento; vazio = nada;
//   - Pix pela regra canônica em centavos (mesma do backend);
//   - a mensagem leva valores e condições por extenso, SEM link;
//   - o envio usa o arquivo onde há compartilhamento; senão wa.me para o
//     número do cliente; o telefone nunca vai para outra URL.
// ============================================================
import {
  valoresDasCondicoes, precoNoPixDoOrcamento, erroDasCondicoes, lerNumero, reais, pct,
  CONDICOES_VAZIAS,
} from "@/components/studio/orcamentoVideo/condicoesDoOrcamento";
import { mensagemDoOrcamento, primeiroNome } from "@/components/studio/orcamentoVideo/mensagemDoOrcamento";
import {
  telefoneDoCliente, linkDaConversa, nomeDoArquivo, podeCompartilharArquivo, compartilharArquivo,
} from "@/components/studio/orcamentoVideo/envioNoWhatsApp";
import { anguloDoQuadro, mimeDoGravador, blobDoDataUrl, FPS, DURACAO_S } from "@/components/studio/orcamentoVideo/gravarGiro";
import { coresDaPeca, arteDoItem, customizacaoComArte, motorDaArte, tem3d, temFoto } from "@/components/studio/orcamentoVideo/pecaDoOrcamento";

jest.mock("@/services/studioApi", () => ({ studioApi: {} }));
jest.mock("@/services/studioVisualApi", () => ({ studioVisualApi: {} }));
jest.mock("@/components/studio/visualEngine/compose3dMug", () => ({ createModelViewer: jest.fn() }));
jest.mock("@/components/studio/visualEngine/compose2d", () => ({ exportPng: jest.fn() }));
jest.mock("@/components/studio/visualEngine/specDaFotoDoProduto", () => ({ specDaFotoDoProdutoMedida: jest.fn() }));

const orc = (extra: any = {}) => ({ total: 532.8, deposit_pct: null, deposit_amount: null, condicoes: null, ...extra });

describe("condições da lojista", () => {
  test("vazias = nenhuma condição, nada pré-preenchido", () => {
    expect(valoresDasCondicoes(orc())).toEqual({});
    expect(valoresDasCondicoes(orc({ condicoes: CONDICOES_VAZIAS }))).toEqual({});
  });

  test("Pix pela regra canônica em centavos (igual ao backend)", () => {
    expect(precoNoPixDoOrcamento(532.8, 5)).toBe(506.16);
    expect(precoNoPixDoOrcamento(49.9, 5)).toBe(47.41);
    expect(precoNoPixDoOrcamento(100, 0)).toBe(100);
  });

  test("valores de todas as condições", () => {
    const v = valoresDasCondicoes(orc({
      deposit_pct: 50, deposit_amount: 266.4,
      condicoes: { pix_desconto_pct: 5, parcelas: 6, prazo_dias_uteis: 5, observacao: " Frete por conta da cliente " },
    }));
    expect(v).toEqual({
      pix: { pct: 5, valor: 506.16 },
      cartao: { parcelas: 6, valor: 88.8 },
      sinal: { pct: 50, valor: 266.4 },
      prazo: { dias_uteis: 5 },
      observacao: "Frete por conta da cliente",
    });
  });

  test("validação espelha o servidor", () => {
    const base = { ...CONDICOES_VAZIAS };
    expect(erroDasCondicoes(base)).toBeNull();
    expect(erroDasCondicoes({ ...base, pix_desconto_pct: 0 })).toMatch(/Pix/);
    expect(erroDasCondicoes({ ...base, pix_desconto_pct: 51 })).toMatch(/Pix/);
    expect(erroDasCondicoes({ ...base, parcelas: 1 })).toMatch(/Parcelas/);
    expect(erroDasCondicoes({ ...base, parcelas: 2.5 })).toMatch(/Parcelas/);
    expect(erroDasCondicoes({ ...base, prazo_dias_uteis: 0 })).toMatch(/Prazo/);
  });

  test("leitura e formatação em pt-BR", () => {
    expect(lerNumero("5,5")).toBe(5.5);
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("abc")).toBeNull();
    expect(reais(1234.5)).toBe("R$ 1.234,50");
    expect(pct(2.5)).toBe("2,5");
  });
});

describe("mensagem do WhatsApp", () => {
  const entrada = {
    nomeDoCliente: "mariana costa",
    nomeDaLoja: "Ateliê Lume",
    itens: [
      { description: "Caneca de porcelana 325 ml", quantity: 12, unit_price: 39.9 },
      { description: "Embalagem presente kraft", quantity: 12, unit_price: 4.5 },
    ],
    desconto: 0,
    total: 532.8,
    valores: {
      pix: { pct: 5, valor: 506.16 },
      cartao: { parcelas: 6, valor: 88.8 },
      sinal: { pct: 50, valor: 266.4 },
      prazo: { dias_uteis: 5 },
    },
    validaAte: new Date(2026, 9, 5, 12),
    anexo: "video" as const,
  };

  test("texto completo, com valores por extenso e sem link", () => {
    expect(mensagemDoOrcamento(entrada)).toBe([
      "Oi, Mariana! Aqui é da Ateliê Lume.",
      "Fiz um vídeo da peça para você ver como ela fica de todos os lados.",
      "",
      "*Caneca de porcelana 325 ml* · 12 unidades · R$ 478,80",
      "*Embalagem presente kraft* · 12 unidades · R$ 54,00",
      "*Total: R$ 532,80*",
      "• No Pix: *R$ 506,16* (5% de desconto)",
      "• No cartão: até 6x de R$ 88,80 sem juros",
      "• Sinal de 50% (R$ 266,40) para começar a produção",
      "• Prazo: 5 dias úteis depois que você aprovar a arte",
      "Vale até 05/10.",
      "",
      "Posso seguir com o pedido?",
    ].join("\n"));
    expect(mensagemDoOrcamento(entrada)).not.toMatch(/https?:|getaura|wa\.me/);
  });

  test("sem condições: só itens, total e validade", () => {
    const m = mensagemDoOrcamento({ ...entrada, valores: {}, anexo: "foto" });
    expect(m).toContain("Segue uma imagem da peça");
    expect(m).not.toContain("Pix");
    expect(m).not.toContain("cartão");
  });

  test("desconto do orçamento aparece antes do total", () => {
    const m = mensagemDoOrcamento({ ...entrada, desconto: 20, total: 512.8, valores: {} });
    expect(m).toContain("Desconto: R$ 20,00\n*Total: R$ 512,80*");
  });

  test("sem nome do cliente nem da loja não quebra", () => {
    expect(mensagemDoOrcamento({ ...entrada, nomeDoCliente: null, nomeDaLoja: "" }).split("\n")[0]).toBe("Oi!");
    expect(primeiroNome("  joão da silva")).toBe("João");
  });

  test("sem emoji", () => {
    expect(mensagemDoOrcamento(entrada)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("envio no WhatsApp", () => {
  test("telefone do cliente com DDI", () => {
    expect(telefoneDoCliente("(11) 98765-4321")).toBe("5511987654321");
    expect(telefoneDoCliente("5511987654321")).toBe("5511987654321");
    expect(telefoneDoCliente("1133334444")).toBe("551133334444");
    expect(telefoneDoCliente("123")).toBeNull();
    expect(telefoneDoCliente(null)).toBeNull();
  });

  test("wa.me vai para o número do cliente, com o texto codificado", () => {
    expect(linkDaConversa("(11) 98765-4321", "Oi, Mariana!\n*Total*")).toBe(
      "https://wa.me/5511987654321?text=Oi%2C%20Mariana!%0A*Total*"
    );
    expect(linkDaConversa("", "x")).toBeNull();
  });

  test("nome do arquivo sem acento nem espaço", () => {
    expect(nomeDoArquivo("Ateliê Lume", "Mariana Costa", "mp4")).toBe("orcamento-atelie-lume-mariana.mp4");
    expect(nomeDoArquivo("", null, "jpg")).toBe("orcamento.jpg");
  });

  test("compartilhar com arquivo só quando o navegador aceita arquivo", async () => {
    const nav: any = navigator;
    const antes = { canShare: nav.canShare, share: nav.share };
    const arq = new File(["x"], "v.mp4", { type: "video/mp4" });
    try {
      nav.canShare = undefined; nav.share = undefined;
      expect(podeCompartilharArquivo(arq)).toBe(false);

      nav.canShare = jest.fn(() => true);
      nav.share = jest.fn(() => Promise.resolve());
      expect(podeCompartilharArquivo(arq)).toBe(true);
      expect(podeCompartilharArquivo(null)).toBe(false);
      await expect(compartilharArquivo(arq, "texto")).resolves.toBe("enviado");
      expect(nav.share).toHaveBeenCalledWith({ files: [arq], text: "texto" });

      nav.share = jest.fn(() => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" })));
      await expect(compartilharArquivo(arq, "t")).resolves.toBe("cancelado");
      nav.share = jest.fn(() => Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" })));
      await expect(compartilharArquivo(arq, "t")).resolves.toBe("falhou");
    } finally {
      nav.canShare = antes.canShare; nav.share = antes.share;
    }
  });
});

describe("gravação", () => {
  test("giro de velocidade constante: começa de frente e fecha a volta sem repetir o quadro", () => {
    const n = FPS * DURACAO_S;
    expect(n).toBe(210);
    expect(anguloDoQuadro(0, n)).toBe(0);
    expect(anguloDoQuadro(n / 2, n)).toBeCloseTo(Math.PI);
    expect(anguloDoQuadro(n - 1, n)).toBeLessThan(Math.PI * 2);
  });

  test("MediaRecorder prefere MP4 e cai para WebM", () => {
    expect(mimeDoGravador((m) => m.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1.42E01F");
    expect(mimeDoGravador((m) => m === "video/webm")).toBe("video/webm");
    expect(mimeDoGravador(() => false)).toBeNull();
    expect(mimeDoGravador(() => { throw new Error("x"); })).toBeNull();
  });

  test("dataURL vira Blob com o tipo certo", () => {
    const b = blobDoDataUrl("data:image/png;base64,aGVsbG8=")!;
    expect(b.type).toBe("image/png");
    expect(b.size).toBe(5);
    expect(blobDoDataUrl("lixo")).toBeNull();
  });
});

describe("peça e arte", () => {
  const cfg: any = {
    print_area: { width_cm: 20, height_cm: 9 },
    fields: [
      { id: "f_txt", type: "text", label: "Nome", required: false, config: {} },
      { id: "f_img", type: "image", label: "Foto", required: false, config: {} },
      { id: "f_cor", type: "color", label: "Cor", required: false, config: { colors: ["#FFFFFF", "#1F2937", "nada"], choices: [{ value: "#1F2937", label: "Grafite" }] } },
    ],
  };

  test("cores cadastradas no produto, com o nome da lojista quando há", () => {
    const cores = coresDaPeca(cfg);
    expect(cores.map((c) => c.hex)).toEqual(["#FFFFFF", "#1F2937"]);
    expect(cores[1].nome).toBe("Grafite");
    expect(coresDaPeca(null)).toEqual([]);
  });

  test("a arte sai do customization do item e volta pela chave do campo", () => {
    const arte = arteDoItem(cfg, { f_txt: "Mari & Léo", f_img: "https://r2/x.png", f_cor: "#1F2937" });
    expect(arte).toEqual({ texto: "Mari & Léo", imagem: "https://r2/x.png", cor: "#1F2937" });
    const volta = customizacaoComArte(cfg, { outro: 1, f_img: "velha" }, { texto: "Ana", imagem: null, cor: "#FFFFFF" });
    expect(volta).toEqual({ outro: 1, f_txt: "Ana", f_cor: "#FFFFFF" });
  });

  test("produto sem os campos: chaves legíveis para a produção", () => {
    const volta = customizacaoComArte({ fields: [] } as any, {}, { texto: "Ana", imagem: "u", cor: "#000000" });
    expect(volta).toEqual({ texto: "Ana", imagem: "u", cor_da_peca: "#000000" });
    expect(arteDoItem({ fields: [] } as any, volta)).toEqual({ texto: "Ana", imagem: "u", cor: "#000000" });
  });

  test("valores do motor para o viewer", () => {
    const m = motorDaArte(cfg, {}, { texto: "Ana", imagem: "https://r2/a.png", cor: "#1F2937" });
    // As chaves de sempre + a arte pela regra única (29/09/2026): o tamanho
    // da arte tem os seus testes em orcamentoTamanhoDaArte.test.ts.
    expect(m.values).toMatchObject({ text: "Ana", image: "https://r2/a.png" });
    expect(m.values.__arte.imagens[0].url).toBe("https://r2/a.png");
    expect(m.opts.garmentColor).toBe("#1F2937");
  });

  test("3D e foto pelas fontes do produto", () => {
    expect(tem3d({ cfg: null, template: { key: "k", name: "n", kind: "model3d", version: 1, spec: {} as any } })).toBe(true);
    expect(tem3d({ cfg: null, template: null })).toBe(false);
    expect(temFoto({ cfg: { mockup_foto: {} } as any, template: null })).toBe(true);
    expect(temFoto(null)).toBe(false);
  });
});
