// ============================================================
// Crediário · "o lançamento tem algo preenchido?" (12/10/2026)
//
// A conta pura por trás da confirmação de descarte do CriarLancamentoModal.
// O que precisa valer:
//   - estado igual ao inicial → false (fecha direto, sem perguntar);
//   - qualquer campo digitado/escolhido → true;
//   - digitar e apagar de volta → false de novo;
//   - os defaults que dependem do dia NÃO contam (nem quando o dia virou).
// ============================================================
import { lancamentoPreenchido, type EstadoDoLancamento, type PadroesDoLancamento } from "@/utils/crediarioLancamento";

const PADROES: PadroesDoLancamento = { vencimento: "12/11/2026", hoje: "12/10/2026" };

const VAZIO: EstadoDoLancamento = {
  selectedCustomer: null,
  newName: "", newPhone: "",
  amountRaw: "", installments: "1", interestRate: "",
  firstDueDate: PADROES.vencimento, entryDate: PADROES.hoje,
  periodKind: "mensal", description: "",
  accountMode: "new", selectedAccountId: null, newAccountName: "",
  unifyEnabled: false,
};

const com = (parcial: Partial<EstadoDoLancamento>): EstadoDoLancamento => ({ ...VAZIO, ...parcial });

describe("lancamentoPreenchido", () => {
  it("estado inicial: nada preenchido", () => {
    expect(lancamentoPreenchido(VAZIO, PADROES)).toBe(false);
  });

  it.each<[string, Partial<EstadoDoLancamento>]>([
    ["cliente escolhido", { selectedCustomer: { id: "c1" } }],
    ["nome do cliente novo", { newName: "Maria" }],
    ["telefone do cliente novo", { newPhone: "(11) 9" }],
    ["valor", { amountRaw: "1.200,00" }],
    ["parcelas alteradas", { installments: "6" }],
    ["parcelas apagadas (campo vazio)", { installments: "" }],
    ["juros", { interestRate: "2,5" }],
    ["1º vencimento alterado", { firstDueDate: "15/12/2026" }],
    ["data do lançamento retroativa", { entryDate: "01/10/2026" }],
    ["periodicidade", { periodKind: "semanal" }],
    ["descrição", { description: "Mercadoria de novembro" }],
    ["carnê existente", { accountMode: "existing" }],
    ["conta geral", { accountMode: "general" }],
    ["carnê escolhido", { selectedAccountId: "a1" }],
    ["nome do carnê novo", { newAccountName: "Compra de setembro" }],
    ["unificação ligada", { unifyEnabled: true }],
  ])("%s conta como preenchido", (_nome, parcial) => {
    expect(lancamentoPreenchido(com(parcial), PADROES)).toBe(true);
  });

  it("espaços soltos não contam (descrição, juros, nome, telefone, nome do carnê)", () => {
    expect(lancamentoPreenchido(com({
      description: "   ", interestRate: " ", newName: "  ", newPhone: " ", newAccountName: "  ", amountRaw: " ",
    }), PADROES)).toBe(false);
  });

  it("digitar e apagar de volta volta a não contar", () => {
    const digitado = com({ amountRaw: "50,00", description: "x" });
    expect(lancamentoPreenchido(digitado, PADROES)).toBe(true);
    expect(lancamentoPreenchido(com({ amountRaw: "", description: "" }), PADROES)).toBe(false);
  });

  it("voltar um campo ao padrão (parcelas 1, mensal, carnê novo) não conta", () => {
    expect(lancamentoPreenchido(com({ installments: "1", periodKind: "mensal", accountMode: "new" }), PADROES)).toBe(false);
  });

  it("defaults do dia não contam: comparar com os padrões com que o formulário nasceu", () => {
    // O formulário nasceu em 12/10; passou da meia-noite. Os campos seguem
    // com os valores de nascimento e os padrões guardados também.
    const nasceuOntem: PadroesDoLancamento = { vencimento: "11/11/2026", hoje: "11/10/2026" };
    const estado = com({ firstDueDate: nasceuOntem.vencimento, entryDate: nasceuOntem.hoje });
    expect(lancamentoPreenchido(estado, nasceuOntem)).toBe(false);
    // Já contra o "hoje" de agora pareceria editado — é o erro que evitamos.
    expect(lancamentoPreenchido(estado, PADROES)).toBe(true);
  });
});
