// ============================================================
// Crediário — receber sem registrar em dobro (07/10/2026)
//
// Caso real: 19 pares de recebimentos iguais em menos de 10 min, em 5 lojas,
// nenhum retry de rede. E, do outro lado, a Thaina pagando 4 parcelas de
// R$330 em 40 segundos — legítimo. Por isso o aviso avisa e não bloqueia.
//
// A regra vive em utils/crediarioRecebimento.ts (função pura, `now`
// injetado); o modal arrasta react-native-svg e não carrega no jest, então
// a ligação com ele é conferida pela fonte.
// ============================================================
import fs from "fs";
import path from "path";
import {
  recebimentoRecente, mensagemDeRepeticao, novaChaveDeRecebimento, JANELA_DE_REPETICAO_MS,
} from "@/utils/crediarioRecebimento";

const T0 = Date.parse("2026-10-07T12:20:22.000Z");
const iso = (msAgo: number) => new Date(T0 - msAgo).toISOString();
const pagamento = (amount: number, msAgo: number, method = "pix") =>
  ({ type: "payment" as const, amount, payment_method: method, created_at: iso(msAgo) });

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");
const label = (k: string | null) => (k === "pix" ? "Pix" : k === "dinheiro" ? "Dinheiro" : k || "");

describe("recebimentoRecente", () => {
  test("mesmo valor há 25 s no razão: acusa, com a forma e o tempo", () => {
    const r = recebimentoRecente([pagamento(260, 25_000)], null, 260, T0);
    expect(r).toEqual({ amount: 260, method: "pix", segundos: 25 });
  });

  test("razão ainda não recarregou: o último recebimento desta ficha também conta", () => {
    const r = recebimentoRecente([], { amount: 260, method: "dinheiro", at: iso(8_000) }, 260, T0);
    expect(r).toEqual({ amount: 260, method: "dinheiro", segundos: 8 });
  });

  test("entre razão e ficha, devolve o mais recente", () => {
    const r = recebimentoRecente([pagamento(260, 90_000)], { amount: 260, method: "pix", at: iso(5_000) }, 260, T0);
    expect(r?.segundos).toBe(5);
  });

  test("valor diferente, ou fora da janela, ou débito: não acusa", () => {
    expect(recebimentoRecente([pagamento(250, 10_000)], null, 260, T0)).toBeNull();
    expect(recebimentoRecente([pagamento(260, JANELA_DE_REPETICAO_MS + 1000)], null, 260, T0)).toBeNull();
    expect(recebimentoRecente([{ type: "debit", amount: 260, payment_method: null, created_at: iso(10_000) }], null, 260, T0)).toBeNull();
    expect(recebimentoRecente([pagamento(260, 10_000)], null, 0, T0)).toBeNull();
  });

  test("centavos: 49,99 contra 49.99 do JSON casa; 49,98 não", () => {
    expect(recebimentoRecente([pagamento(49.99, 10_000)], null, 49.99, T0)).not.toBeNull();
    expect(recebimentoRecente([pagamento(49.99, 10_000)], null, 49.98, T0)).toBeNull();
  });

  test("recebimento com data futura (relógio do celular adiantado) não acusa", () => {
    expect(recebimentoRecente([pagamento(260, -30_000)], null, 260, T0)).toBeNull();
  });
});

describe("mensagemDeRepeticao", () => {
  test("segundos, com a forma de pagamento", () => {
    expect(mensagemDeRepeticao({ amount: 260, method: "pix", segundos: 25 }, fmt, label))
      .toBe("Você registrou R$ 260,00 em pix há 25 segundos. Registrar outro recebimento de R$ 260,00?");
  });
  test("minutos, sem forma conhecida", () => {
    expect(mensagemDeRepeticao({ amount: 50, method: null, segundos: 95 }, fmt, label))
      .toBe("Você registrou R$ 50,00 há 2 minutos. Registrar outro recebimento de R$ 50,00?");
    expect(mensagemDeRepeticao({ amount: 50, method: null, segundos: 1 }, fmt, label)).toContain("há 1 segundo.");
    expect(mensagemDeRepeticao({ amount: 50, method: null, segundos: 60 }, fmt, label)).toContain("há 1 minuto.");
  });
});

describe("novaChaveDeRecebimento", () => {
  test("mesmo formato de antes (rfp-<loja>-<cliente>-...), e duas chaves nunca coincidem", () => {
    const a = novaChaveDeRecebimento("loja", "cli", T0);
    const b = novaChaveDeRecebimento("loja", "cli", T0);
    expect(a).toMatch(/^rfp-loja-cli-\d+-[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});

describe("ClienteCrediarioModal usa a regra", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
  const api = fs.readFileSync(path.join(__dirname, "..", "services", "creditApi.ts"), "utf8");

  test("manda a MESMA chave de idempotência enquanto o pedido não muda", () => {
    // gerada uma vez e passada ao POST…
    expect(fonte).toMatch(/if \(!freeKeyRef\.current\) freeKeyRef\.current = novaChaveDeRecebimento\(/);
    expect(fonte).toMatch(/receiveFreePayment\(companyId, customerId!, \{[\s\S]*?\}, freeKeyRef\.current\)/);
    // …descartada no sucesso e quando valor/forma/data mudam
    expect(fonte).toContain("freeKeyRef.current = null;\n      setUltimoRecebimento(");
    expect(fonte).toMatch(/useEffect\(\(\) => \{ setReceberGate\(false\); freeKeyRef\.current = null; \}, \[freeAmt, freeMethod, freeDateBr, freeAccountId\]\)/);
    // e o serviço só gera a sua quando não recebe nenhuma
    expect(api).toMatch(/const idempKey = idempotencyKey \|\| \(/);
  });

  test("o gate avisa a repetição em vez de bloquear", () => {
    expect(fonte).toContain("recebimentoRecente(detail?.transactions, ultimoRecebimento, freeAmtValue)");
    expect(fonte).toContain('confirmLabel={repetido ? "Sim, é outro" : undefined}');
    expect(fonte).not.toMatch(/disabled=\{[^}]*repetido/);
  });
});
