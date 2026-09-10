// ============================================================
// Quando o painel toca o som de pedido (10/09/2026)
//
// O som é ligado por padrão, então o risco é barulho errado: tocar pelos
// pedidos de ontem ao abrir o painel, tocar duas vezes (push + poll) pelo
// mesmo pedido, ou tocar por aviso que não pede nada da lojista.
// ============================================================
import * as fs from "fs";
import * as path from "path";
import {
  avisosNovos, chaveDoAviso, eventosDaResposta, tocaParaPush, urlBase64ParaBytes, TIPOS_QUE_TOCAM,
} from "@/utils/avisosDePedido";
import type { StoreEvent } from "@/services/notificationsApi";

const AGORA = new Date("2026-09-10T15:00:00Z").getTime();
const min = (n: number) => new Date(AGORA - n * 60_000).toISOString();
const ev = (over: Partial<StoreEvent> & { id: string; type: string }): StoreEvent => ({
  title: "Evento", created_at: min(1), ...over,
});

describe("avisosNovos", () => {
  test("a primeira carga só aprende: abrir o painel não toca", () => {
    const r = avisosNovos(new Set(), [ev({ id: "1", type: "loja_pedido_novo", entity_id: "pedido:a" })], { primeiraCarga: true, agora: AGORA });
    expect(r.novos).toEqual([]);
    expect(r.conhecidos.has("loja_pedido_novo|pedido:a")).toBe(true);
  });

  test("pedido que aparece depois toca uma vez; no poll seguinte, não", () => {
    const antes = avisosNovos(new Set(), [], { primeiraCarga: true, agora: AGORA });
    const lista = [ev({ id: "1", type: "loja_pedido_novo", entity_id: "pedido:a" })];
    const r1 = avisosNovos(antes.conhecidos, lista, { primeiraCarga: false, agora: AGORA });
    expect(r1.novos.map((e) => e.id)).toEqual(["1"]);
    const r2 = avisosNovos(r1.conhecidos, lista, { primeiraCarga: false, agora: AGORA });
    expect(r2.novos).toEqual([]);
  });

  test("o push e o poll do mesmo pedido têm a mesma chave", () => {
    const doPush = chaveDoAviso("loja_pedido_novo", "pedido:a");
    const r = avisosNovos(new Set([doPush]), [ev({ id: "srv-9", type: "loja_pedido_novo", entity_id: "pedido:a" })], { primeiraCarga: false, agora: AGORA });
    expect(r.novos).toEqual([]);
  });

  test("pagamento do MESMO pedido é outro aviso e toca", () => {
    const conhecidos = new Set([chaveDoAviso("loja_pedido_novo", "pedido:a")]);
    const r = avisosNovos(conhecidos, [ev({ id: "2", type: "loja_pedido_pago", entity_id: "pedido:a" })], { primeiraCarga: false, agora: AGORA });
    expect(r.novos).toHaveLength(1);
  });

  test("não toca por tipo que não pede a lojista agora, por lido ou por velho", () => {
    const lista = [
      ev({ id: "a", type: "loja_pedido_entregue", entity_id: "pedido:x" }),
      ev({ id: "b", type: "loja_pix_expirado", entity_id: "pedido:y" }),
      ev({ id: "c", type: "loja_pedido_novo", entity_id: "pedido:z", read_at: min(0) }),
      ev({ id: "d", type: "loja_pedido_novo", entity_id: "pedido:w", created_at: min(3 * 60) }),
    ];
    expect(avisosNovos(new Set(), lista, { primeiraCarga: false, agora: AGORA }).novos).toEqual([]);
  });

  test("o conjunto de chaves tem teto", () => {
    const muitos = Array.from({ length: 700 }, (_, i) => ev({ id: String(i), type: "loja_pedido_novo", entity_id: `pedido:${i}` }));
    expect(avisosNovos(new Set(), muitos, { primeiraCarga: true, agora: AGORA }).conhecidos.size).toBe(500);
  });
});

describe("junção igual à do sino", () => {
  test("pedido do feed de 24 h vira evento; se o servidor já tem o evento, não duplica", () => {
    const eventos = eventosDaResposta({
      events: [ev({ id: "srv", type: "loja_pedido_novo", entity_id: "pedido:a" })],
      orders: [
        { id: "a", order_number: "1", total: 10, status: "pending_payment", created_at: min(1), source: "canal_digital" },
        { id: "b", order_number: "2", total: 20, status: "pending_payment", created_at: min(1), source: "canal_digital" },
      ],
    });
    expect(eventos.map((e) => e.entity_id)).toEqual(["pedido:a", "pedido:b"]);
  });
});

describe("push", () => {
  test("toca só pelos três tipos", () => {
    expect([...TIPOS_QUE_TOCAM].sort()).toEqual(["loja_comprovante_enviado", "loja_pedido_novo", "loja_pedido_pago"]);
    expect(tocaParaPush({ type: "loja_pedido_novo" })).toBe(true);
    expect(tocaParaPush({ type: "teste" })).toBe(false);
    expect(tocaParaPush(null)).toBe(false);
  });

  test("chave VAPID base64url vira os 65 bytes da chave pública", () => {
    const chave = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    const bytes = urlBase64ParaBytes(chave);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("service worker (public/sw.js)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");

  test("é JavaScript válido", () => {
    expect(() => new Function(src)).not.toThrow();
  });

  test("mostra o aviso, avisa as abas e abre o pedido no clique", () => {
    expect(src).toContain("addEventListener('push'");
    expect(src).toContain("self.registration.showNotification(titulo, opcoes)");
    expect(src).toContain("tipo: 'aura-push'");
    expect(src).toContain("addEventListener('notificationclick'");
    expect(src).toContain("self.clients.openWindow(destino)");
  });

  test("os ícones que ele cita existem em public/", () => {
    for (const icone of ["aura-icone-192.png", "aura-icone-72.png"]) {
      expect(src).toContain(`/${icone}`);
      expect(fs.existsSync(path.join(__dirname, "..", "public", icone))).toBe(true);
    }
  });
});
