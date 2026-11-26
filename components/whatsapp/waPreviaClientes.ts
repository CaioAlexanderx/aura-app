// ============================================================
// waPreviaClientes — três clientes reais para a prévia do Editor
//
// "Como chega para Marta / Cris / João": o texto da lojista renderizado
// com o nome, a parcela e o valor de clientes DA LOJA (parcelas em aberto
// no Crediário; nas novidades, os primeiros do corte). Campo que a loja
// não tem à mão (Pix da loja, Link da loja) fica "[Pix da loja]" na prévia:
// nada de dado inventado passando por real.
// ============================================================
import type { CreditInstallment } from "@/services/creditApi";
import type { WaPessoaRaw } from "@/services/waConfigApi";

export interface ClientePrevia {
  /** Primeiro nome, para o botão de troca. */
  nome: string;
  valores: Record<string, string>;
}

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function dataLocal(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "no sábado, 30/11", "amanhã, 27/11", "hoje". Data torta = null. */
export function vencimentoTexto(iso: string | null | undefined, hoje: Date = new Date()): string | null {
  const d = dataLocal(iso);
  if (!d) return null;
  const h0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((d.getTime() - h0.getTime()) / 86400000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (dias === 0) return "hoje";
  if (dias === 1) return `amanhã, ${dd}/${mm}`;
  if (dias === -1) return `ontem, ${dd}/${mm}`;
  const dia = SEMANA[d.getDay()];
  const artigo = d.getDay() === 0 || d.getDay() === 6 ? "no" : "na";
  return `${artigo} ${dia}, ${dd}/${mm}`;
}

export function brl(n: number | string | null | undefined): string | null {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const [int, dec] = v.toFixed(2).split(".");
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

function primeiroNome(nome: string | null | undefined): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

/** Até 3 clientes de parcelas em aberto, uma por cliente. */
export function clientesDasParcelas(parcelas: CreditInstallment[] | null | undefined, lojaNome: string, hoje: Date = new Date()): ClientePrevia[] {
  const vistos = new Set<string>();
  const out: ClientePrevia[] = [];
  for (const p of Array.isArray(parcelas) ? parcelas : []) {
    const nome = primeiroNome(p?.customer_name);
    if (!nome || vistos.has(p.customer_id)) continue;
    vistos.add(p.customer_id);
    const valores: Record<string, string> = { "Nome": nome };
    if (lojaNome) valores["Nome da loja"] = lojaNome;
    if (p.installment_number && p.total_installments) {
      valores["Parcela"] = `${p.installment_number} de ${p.total_installments}`;
      valores["Total de parcelas"] = String(p.total_installments);
    }
    const valor = brl(typeof p.remaining === "number" ? p.remaining : p.amount_due);
    if (valor) valores["Valor"] = valor;
    const venc = vencimentoTexto(p.due_date, hoje);
    if (venc) valores["Vencimento"] = venc;
    out.push({ nome, valores });
    if (out.length === 3) break;
  }
  return out;
}

/** Até 3 clientes do corte das novidades (só o nome é conhecido). */
export function clientesDoCorte(pessoas: WaPessoaRaw[] | null | undefined, lojaNome: string): ClientePrevia[] {
  const out: ClientePrevia[] = [];
  for (const p of Array.isArray(pessoas) ? pessoas : []) {
    const nome = primeiroNome(p?.nome);
    if (!nome) continue;
    const valores: Record<string, string> = { "Nome": nome };
    if (lojaNome) valores["Nome da loja"] = lojaNome;
    out.push({ nome, valores });
    if (out.length === 3) break;
  }
  return out;
}
