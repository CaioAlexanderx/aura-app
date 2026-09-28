// ============================================================
// QA final da vitrine Studio (28/09/2026) — rodada 3: ciclo de vida do pedido
//
// LJ-33   pedido cancelado é "Cancelado" no painel (etapa, ações, quadro)
// LJ-33   motivo e "Cancelar pedido" no bloco do pagamento
// CL-46   a cliente lê o motivo certo do cancelamento
// LJ-34   Pix vencido que não cancelou diz por quê no cartão
// LJ-29   o sino resolve o aviso que o pedido já resolveu
// LJ-30   "1 item" (contagem que chega como texto)
// LJ-31   prévia do painel na composição da vitrine; rótulo da arte enviada;
//         "Aprovar arte" só no hub
// CL-44   "Fazer um novo" não volta no F5; aviso reconhece o "Já paguei"
// LJ-36   upload do motor: limite na hora, espera proporcional, tipo sem acento
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/" }));

import { etapaDoPedido, comEtapaDoPedido, pedidoEncerrado } from "@/components/studio/etapaDoPedido";
import { rotuloDeItens } from "@/components/studio/rotuloDeItens";
import {
  situacaoDoPagamento, podeCancelarOPedido, avisoDoCancelamento, motivoCurtoDoPixVencido,
} from "@/components/studio/pagamentoDoPedido";
import { textoDoCancelamento } from "@/components/studio/storefront/textoDoCancelamento";
import { lerPedidoPublico } from "@/components/studio/storefront/pedidoPorToken";
import {
  guardarPedidoPendente, lerPedidoPendente, dispensarPedidoPendente, jaAvisouQuePagou,
} from "@/components/studio/storefront/pedidoGuardado";
import { rotuloDaChave, ehEnvioDaCliente } from "@/components/studio/customizationConfig";
import { buildFeed, seloDoCard } from "@/components/notificationEventModel";
import { layoutDaArte } from "@/components/studio/PersonalizationPreview";
import { prepararUpload } from "@/services/studioUploadApi";
import { shouldShow } from "@/components/studio/FloatingApprovalButton";

describe("LJ-33 · a etapa do pedido cancelado", () => {
  test("status do pedido cancelado vence a etapa em que ele parou", () => {
    expect(etapaDoPedido({ status: "cancelled", studio_production_status: "pending_art" })).toBe("cancelled");
    expect(etapaDoPedido({ order_status: "cancelled", studio_production_status: "pending_art" })).toBe("cancelled");
    expect(etapaDoPedido({ status: "confirmed", studio_production_status: "approved" })).toBe("approved");
    expect(etapaDoPedido({ status: "pending_payment", studio_production_status: null })).toBeNull();
  });

  test("o quadro recebe o pedido na coluna Cancelados; o resto intocado", () => {
    const o = { id: "1", status: "cancelled", studio_production_status: "pending_art" as any };
    expect(comEtapaDoPedido(o).studio_production_status).toBe("cancelled");
    const ativo = { id: "2", status: "confirmed", studio_production_status: "approved" as any };
    expect(comEtapaDoPedido(ativo)).toBe(ativo);
  });

  test("entregue e cancelado estão encerrados", () => {
    expect(pedidoEncerrado({ status: "cancelled", studio_production_status: "pending_art" })).toBe(true);
    expect(pedidoEncerrado({ studio_production_status: "delivered" })).toBe(true);
    expect(pedidoEncerrado({ studio_production_status: "pending_art" })).toBe(false);
  });
});

describe("LJ-33 (P2) · bloco do pagamento cancelado", () => {
  const base = { source: "digital", payment_method: "pix", status: "cancelled", payment_status: "cancelled" };

  test("recusa mostra quem e o motivo", () => {
    const s = situacaoDoPagamento({ ...base, cancelamento: { tipo: "pagamento_recusado", motivo: "O Pix não caiu" } });
    expect(s.rotulo).toBe("Cancelado");
    expect(s.detalhe).toBe('Você recusou o pagamento e o pedido foi cancelado. Motivo: "O Pix não caiu".');
  });

  test("cancelado pela loja, sem motivo", () => {
    expect(situacaoDoPagamento({ ...base, cancelamento: { tipo: "cancelado_pela_loja", motivo: null } }).detalhe)
      .toBe("Você cancelou este pedido.");
  });

  test("Pix vencido pelo tipo novo ou pelo payment_status antigo", () => {
    expect(situacaoDoPagamento({ ...base, cancelamento: { tipo: "pix_expirado", motivo: null } }).chave).toBe("vencido");
    expect(situacaoDoPagamento({ ...base, payment_status: "expired" }).chave).toBe("vencido");
    // Backend antigo, recusa: o genérico de sempre.
    expect(situacaoDoPagamento(base).detalhe).toBe("Pedido cancelado.");
  });

  test('"Cancelar pedido" existe quando o Pix já entrou (o 409 da recusa manda usar)', () => {
    const pago = { source: "digital", payment_method: "pix", status: "confirmed", payment_status: "confirmed" };
    expect(podeCancelarOPedido(pago)).toBe(true);
    expect(avisoDoCancelamento(pago)).toMatch(/combine a devolução/);
    // Esperando conferência: o caminho é "Recusar pagamento".
    expect(podeCancelarOPedido({ ...pago, status: "awaiting_approval", payment_status: "pending" })).toBe(false);
    expect(podeCancelarOPedido({ ...pago, status: "cancelled" })).toBe(false);
    expect(podeCancelarOPedido({ ...pago, status: "delivered" })).toBe(false);
    // PDV / sem pagamento da vitrine: nada.
    expect(podeCancelarOPedido({ source: "pdv", status: "confirmed" })).toBe(false);
  });
});

describe("LJ-34 · por que o Pix vencido não cancelou (cartão da Produção)", () => {
  test("produção andou", () => {
    expect(motivoCurtoDoPixVencido({ pix_cancelamento: { vencido: true, motivo: "producao" } }))
      .toBe("Não cancela sozinho: a produção já andou");
    expect(motivoCurtoDoPixVencido({ pix_cancelamento: { vencido: false, motivo: null } })).toBeNull();
    expect(motivoCurtoDoPixVencido({})).toBeNull();
  });
});

describe("LJ-33/CL-46 · o que a cliente lê", () => {
  test("recusa da loja: título, texto e recado", () => {
    const c = textoDoCancelamento({ tipo: "pagamento_recusado", motivo: " O Pix não caiu " }, { loja: "Aura QA" });
    expect(c.titulo).toBe("A loja não confirmou o seu Pix");
    expect(c.texto).toMatch(/^Aura QA não encontrou o seu pagamento/);
    expect(c.texto).not.toMatch(/72 horas/);
    expect(c.motivo).toBe("O Pix não caiu");
  });

  test("72 h só para o Pix vencido", () => {
    expect(textoDoCancelamento({ tipo: "pix_expirado", motivo: "x" }, { loja: "L" }).texto).toMatch(/72 horas/);
    expect(textoDoCancelamento({ tipo: "pix_expirado", motivo: "x" }, { loja: "L" }).motivo).toBeNull();
    expect(textoDoCancelamento(null, { loja: "L", paymentStatus: "expired" }).texto).toMatch(/72 horas/);
    expect(textoDoCancelamento(null, { loja: "L", paymentStatus: "cancelled" }).texto).not.toMatch(/72 horas/);
  });

  test("a página do pedido lê o campo novo (e sobrevive sem ele)", () => {
    const p = lerPedidoPublico({ status: "cancelled", cancelamento: { tipo: "pagamento_recusado", motivo: "x" } });
    expect(p?.cancelamento).toEqual({ tipo: "pagamento_recusado", motivo: "x" });
    expect(lerPedidoPublico({ status: "cancelled" })?.cancelamento).toBeNull();
  });
});

describe("CL-44 · a Tela 8 no checkout", () => {
  const armazem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
    };
  };
  const pedido = {
    id: "o1", token: "t".repeat(20), order_number: "00004", payment_method: "pix",
    total: 85.32, pecas: 2, imagens: [], card_init_point: null,
  };

  test('"Fazer um novo" fica gravado: o F5 não reabre a pergunta', () => {
    const s = armazem();
    guardarPedidoPendente("aura-qa", pedido, s);
    expect(lerPedidoPendente("aura-qa", s)?.dispensado).toBe(false);
    dispensarPedidoPendente("aura-qa", s);
    const lido = lerPedidoPendente("aura-qa", s);
    expect(lido?.dispensado).toBe(true);
    expect(lido?.id).toBe("o1");
    // Pedido novo substitui e volta a perguntar.
    guardarPedidoPendente("aura-qa", { ...pedido, id: "o2" }, s);
    expect(lerPedidoPendente("aura-qa", s)?.dispensado).toBe(false);
  });

  test('"Já paguei" ou comprovante: o aviso não diz que o Pix não entrou', () => {
    expect(jaAvisouQuePagou({ status: "awaiting_approval" })).toBe(true);
    expect(jaAvisouQuePagou({ status: "pending_payment", comprovante_enviado: true })).toBe(true);
    expect(jaAvisouQuePagou({ status: "pending_payment", comprovante_enviado: false })).toBe(false);
  });
});

describe("LJ-30 · plural", () => {
  test('contagem do Postgres chega como texto: "1" é "1 item"', () => {
    expect(rotuloDeItens("1")).toBe("1 item");
    expect(rotuloDeItens(1)).toBe("1 item");
    expect(rotuloDeItens("2")).toBe("2 itens");
    expect(rotuloDeItens(null)).toBe("0 itens");
  });
});

describe("LJ-31 · o arquivo da cliente e a composição", () => {
  const campos = { template: { label: "Escolher template da galeria", type: "template" } };

  test('arquivo enviado pela cliente não é "Escolher template da galeria"', () => {
    const url = "https://pub-x.r2.dev/studio/storefront/56135b5d/1727540000-ab12.png";
    expect(ehEnvioDaCliente(url)).toBe(true);
    expect(rotuloDaChave("template", campos, url)).toBe("Arte enviada pela cliente");
    // Arte da galeria da lojista mantém o rótulo dela.
    expect(rotuloDaChave("template", campos, "https://pub-x.r2.dev/studio/56135b5d/template/1.png"))
      .toBe("Escolher template da galeria");
  });

  test("arte em cima, texto embaixo — a regra do motor da vitrine", () => {
    const area = { x: 20, y: 20, w: 60, h: 60 };
    const l = layoutDaArte(area, true, "HELENA");
    expect(l.imagem).toEqual({ x: 20, y: 20, w: 60, h: 60 * 0.62 });
    // Texto abaixo da arte, dentro da área.
    expect(l.texto!.y).toBeGreaterThan(20 + 60 * 0.62);
    expect(l.texto!.y).toBeLessThanOrEqual(80);
    expect(l.texto!.x).toBe(50);
    // Só texto: no meio. Só imagem: 90% da altura.
    expect(layoutDaArte(area, false, "HELENA").texto!.y).toBeCloseTo(50 + layoutDaArte(area, false, "HELENA").texto!.fontSize * 0.35);
    expect(layoutDaArte(area, true, "").imagem!.h).toBeCloseTo(54);
    // Texto longo cabe na largura (94%).
    const longo = layoutDaArte(area, true, "MARINA & JOÃO PARA SEMPRE");
    expect("MARINA & JOÃO PARA SEMPRE".length * longo.texto!.fontSize * 0.56).toBeLessThanOrEqual(60 * 0.94 + 1e-9);
  });
});

describe('LJ-31 · "Aprovar arte" só no hub', () => {
  test("rota exata", () => {
    expect(shouldShow("/studio/pedidos")).toBe(true);
    expect(shouldShow("/studio/pedidos/")).toBe(true);
    expect(shouldShow("/studio/pedidos/baa22b9d-0000")).toBe(false);
    expect(shouldShow("/studio/producao")).toBe(false);
  });
});

describe("LJ-29 · sino", () => {
  const ev = (id: string, type: string, created_at: string, extra: any = {}) => ({
    id, type, title: type, created_at, entity_id: "pedido:5", severity: "atencao" as const, ...extra,
  });

  test("pagamento a conferir sai de 'Precisa de você' quando o pedido foi cancelado depois", () => {
    const feed = buildFeed([
      ev("a", "loja_pagamento_a_conferir", "2026-09-28T13:00:00Z"),
      ev("b", "loja_pedido_cancelado", "2026-09-28T13:05:00Z"),
    ], Date.parse("2026-09-28T14:00:00Z"));
    expect(feed.acoes).toHaveLength(0);
    expect(feed.actionCount).toBe(0);
  });

  test("grupo do pedido perde o selo quando nada ali pede mais ação", () => {
    const grupo = {
      event: ev("b", "loja_pedido_cancelado", "2026-09-28T13:05:00Z", { resolved: true, severity: "info" }),
      events: [
        ev("b", "loja_pedido_cancelado", "2026-09-28T13:05:00Z", { resolved: true, severity: "info" }),
        ev("a", "loja_pagamento_a_conferir", "2026-09-28T13:00:00Z", { resolved: true, severity: "info" }),
      ],
      grouped: true,
    };
    expect(seloDoCard(grupo as any)).toBeNull();
    const aberto = { ...grupo, events: [grupo.events[0], ev("c", "loja_comprovante_enviado", "2026-09-28T13:06:00Z")] };
    expect(seloDoCard(aberto as any)).toBe("Ação");
  });
});

describe("LJ-36 · upload do mockup do motor", () => {
  test("acima de 15 MB falha na hora, com o tamanho", () => {
    const grande = "A".repeat(Math.ceil((16 * 1024 * 1024) / 0.75));
    expect(() => prepararUpload({ content_base64: grande, content_type: "image/png" }))
      .toThrow(/tem 16,0 MB e o limite é 15 MB/);
  });

  test("espera cresce com o arquivo, com teto", () => {
    expect(prepararUpload({ content_base64: "AAAA", content_type: "image/png" }).timeout).toBe(31000);
    const oitoMb = "A".repeat(8 * 1024 * 1024);
    const t = prepararUpload({ content_base64: oitoMb, content_type: "image/png" }).timeout;
    expect(t).toBeGreaterThan(30000);
    expect(t).toBeLessThanOrEqual(180000);
  });

  test('"vídeo/webm" vira "video/webm"; prefixo data: sai', () => {
    const r = prepararUpload({ content_base64: "data:video/webm;base64,AAAA", content_type: "vídeo/webm" });
    expect(r.body.content_type).toBe("video/webm");
    expect(r.body.content_base64).toBe("AAAA");
  });
});
