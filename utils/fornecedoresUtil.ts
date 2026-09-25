// ============================================================
// AURA. — Tela de Fornecedores (/fornecedores), 25/09/2026
//
// A antiga "Compras" do Matcon agrupava a reposição pelo fornecedor da
// última nota (XML) e não conhecia o cadastro de fornecedores; o app nem
// tinha tela de cadastro. Agora a página é organizada POR FORNECEDOR: o
// cadastro é a espinha, e reposição e pedidos de compra (Matcon)
// penduram em cada um.
//
// Casamento entre as três fontes (cadastro, sugestão, pedido), nesta ordem:
//   1. CNPJ igual (só dígitos);
//   2. senão, nome igual (sem acento, caixa ou espaços extras).
// O que vem da nota/pedido e não casa com nenhum cadastro vira uma linha
// "da nota" com o botão Cadastrar — é assim que o cadastro enche sozinho.
// Função pura, fora do componente: o Icon quebra o Jest (ver memória
// testar-render-no-aura-app).
// ============================================================
import type { Supplier, SupplierBody } from "@/services/suppliersApi";
import type { PurchaseOrder } from "@/services/matconApi";
import type { FornecedorSugestoes } from "@/components/matcon/comprasUtil";

export type OrigemLinha = "cadastro" | "nota" | "sem";

export type LinhaFornecedor = {
  key: string;
  origem: OrigemLinha;
  supplier: Supplier | null;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  contato: string | null;
  produtos: number | null;
  reposicao: FornecedorSugestoes | null;
  rascunhos: PurchaseOrder[];
  enviados: PurchaseOrder[];
  recebidos: PurchaseOrder[];
};

const soDigitos = (v: string | null | undefined) => (v || "").replace(/\D/g, "");

export function normalizarNome(v: string | null | undefined): string {
  return (v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const SEM_FORNECEDOR = "sem-fornecedor";
const DIA = 86400000;

type Entrada = {
  suppliers: Supplier[];
  reposicao?: FornecedorSugestoes[];
  pedidos?: PurchaseOrder[];
  /** Para "recebido nos últimos N dias". Injetável nos testes. */
  agora?: number;
  diasRecebido?: number;
};

export function montarLinhas({ suppliers, reposicao = [], pedidos = [], agora = Date.now(), diasRecebido = 7 }: Entrada): LinhaFornecedor[] {
  const linhas: LinhaFornecedor[] = [];
  const porCnpj = new Map<string, LinhaFornecedor>();
  const porNome = new Map<string, LinhaFornecedor>();

  function indexar(l: LinhaFornecedor) {
    if (l.cnpj) porCnpj.set(l.cnpj, l);
    const n = normalizarNome(l.nome);
    if (n && !porNome.has(n)) porNome.set(n, l);
  }

  function achar(cnpj: string | null | undefined, nome: string | null | undefined): LinhaFornecedor | null {
    const c = soDigitos(cnpj);
    if (c && porCnpj.has(c)) return porCnpj.get(c)!;
    const n = normalizarNome(nome);
    if (n && porNome.has(n)) return porNome.get(n)!;
    return null;
  }

  function daNota(cnpj: string | null | undefined, nome: string | null | undefined, telefone: string | null | undefined): LinhaFornecedor {
    const c = soDigitos(cnpj) || null;
    const l: LinhaFornecedor = {
      key: "nota:" + (c || normalizarNome(nome)),
      origem: "nota", supplier: null,
      nome: (nome || "").trim() || "Fornecedor sem nome", cnpj: c, telefone: telefone || null, contato: null,
      produtos: null, reposicao: null, rascunhos: [], enviados: [], recebidos: [],
    };
    linhas.push(l);
    indexar(l);
    return l;
  }

  for (const s of suppliers || []) {
    const l: LinhaFornecedor = {
      key: s.id, origem: "cadastro", supplier: s,
      nome: s.name, cnpj: soDigitos(s.cnpj) || null, telefone: s.phone || null, contato: s.contact_name || null,
      produtos: typeof s.product_count === "number" ? s.product_count : Number(s.product_count) || 0,
      reposicao: null, rascunhos: [], enviados: [], recebidos: [],
    };
    linhas.push(l);
    indexar(l);
  }

  let semFornecedor: LinhaFornecedor | null = null;
  for (const g of reposicao || []) {
    if (g.key === SEM_FORNECEDOR) {
      semFornecedor = {
        key: SEM_FORNECEDOR, origem: "sem", supplier: null, nome: "Sem fornecedor identificado",
        cnpj: null, telefone: null, contato: null, produtos: null,
        reposicao: g, rascunhos: [], enviados: [], recebidos: [],
      };
      continue;
    }
    const l = achar(g.supplier_cnpj, g.supplier_name) || daNota(g.supplier_cnpj, g.supplier_name, g.supplier_phone);
    l.reposicao = g;
    // A nota traz telefone que o cadastro às vezes não tem.
    if (!l.telefone && g.supplier_phone) l.telefone = g.supplier_phone;
  }

  for (const o of pedidos || []) {
    if (o.status === "cancelled") continue;
    const recebidoRecente = o.status === "received" && !!o.received_at &&
      (agora - new Date(o.received_at).getTime()) / DIA <= diasRecebido;
    if (o.status === "received" && !recebidoRecente) continue;
    const l = achar(o.supplier_cnpj, o.supplier_name)
      || (o.supplier_name || o.supplier_cnpj ? daNota(o.supplier_cnpj, o.supplier_name, o.supplier_phone) : null);
    if (!l) continue;
    if (o.status === "draft") l.rascunhos.push(o);
    else if (o.status === "sent") l.enviados.push(o);
    else l.recebidos.push(o);
  }

  // Ordem: onde há dinheiro para decidir hoje (reposição/rascunho) primeiro,
  // do maior para o menor; depois quem tem pedido a caminho; o resto em
  // ordem alfabética. "Sem fornecedor identificado" fecha a parte de cima.
  const peso = (l: LinhaFornecedor) =>
    (l.reposicao ? l.reposicao.total_est : 0) + l.rascunhos.reduce((a, o) => a + (Number(o.total_est) || 0), 0);
  const grupo = (l: LinhaFornecedor) => (peso(l) > 0 ? 0 : l.enviados.length > 0 ? 1 : 2);

  linhas.sort((a, b) =>
    grupo(a) - grupo(b)
    || peso(b) - peso(a)
    || a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

  if (semFornecedor) {
    const fimDoTopo = linhas.findIndex((l) => grupo(l) > 0);
    linhas.splice(fimDoTopo === -1 ? linhas.length : fimDoTopo, 0, semFornecedor);
  }
  return linhas;
}

export function filtrarLinhas(linhas: LinhaFornecedor[], busca: string): LinhaFornecedor[] {
  const q = normalizarNome(busca);
  if (!q) return linhas;
  const qd = soDigitos(busca);
  return linhas.filter((l) =>
    normalizarNome(l.nome).includes(q)
    || normalizarNome(l.contato).includes(q)
    || (qd.length >= 3 && (l.cnpj || "").includes(qd))
    || (qd.length >= 3 && soDigitos(l.telefone).includes(qd)));
}

// ── Formulário ─────────────────────────────────────────────

export type FormFornecedor = { name: string; cnpj: string; phone: string; contact_name: string; email: string; notes: string };

export const FORM_VAZIO: FormFornecedor = { name: "", cnpj: "", phone: "", contact_name: "", email: "", notes: "" };

/** Dígito verificador do CNPJ (mesma conta do backend, utils/cnpj.js). */
export function cnpjValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const s = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`);
}

export type ValidacaoFornecedor =
  | { ok: true; body: SupplierBody }
  | { ok: false; campo: keyof FormFornecedor; erro: string };

/** Só o nome é obrigatório. O que foi começado precisa estar certo. */
export function validarFornecedor(f: FormFornecedor): ValidacaoFornecedor {
  const name = f.name.trim();
  if (name.length < 2) return { ok: false, campo: "name", erro: "Informe o nome do fornecedor" };

  const cnpj = soDigitos(f.cnpj);
  if (cnpj && !cnpjValido(cnpj)) return { ok: false, campo: "cnpj", erro: "CNPJ inválido. Confira os números ou apague o campo." };

  const tel = soDigitos(f.phone);
  if (tel && tel.length < 10) return { ok: false, campo: "phone", erro: "WhatsApp incompleto. Coloque o DDD ou apague o campo." };

  const email = f.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, campo: "email", erro: "E-mail inválido" };

  const vazio = (s: string) => (s.trim() ? s.trim() : null);
  return {
    ok: true,
    body: {
      name, cnpj: cnpj || null, phone: tel || null,
      contact_name: vazio(f.contact_name), email: email || null, notes: vazio(f.notes),
    },
  };
}

/** Formulário a partir de um cadastro (editar) ou de uma linha da nota (cadastrar com o que já se sabe). */
export function formDaLinha(l: Pick<LinhaFornecedor, "nome" | "cnpj" | "telefone" | "contato" | "supplier">): FormFornecedor {
  const s = l.supplier;
  return {
    name: s ? s.name : l.nome,
    cnpj: (s ? s.cnpj : l.cnpj) || "",
    phone: (s ? s.phone : l.telefone) || "",
    contact_name: (s ? s.contact_name : l.contato) || "",
    email: (s && s.email) || "",
    notes: (s && s.notes) || "",
  };
}
