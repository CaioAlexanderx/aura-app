// ============================================================
// AURA. — NFS-e no cadastro do serviço: regras puras (10/11/2026)
//
// Mockup aprovado: docs/mockups/nfse-cadastro-servico.html (telas 1 e 2).
// Backend: Aura-backend feat/nfse-campos-do-servico (migration 437,
// src/services/camposNfseDoItem.js). A validação daqui é a MESMA de lá —
// só dígitos, no tamanho certo; vazio vira null (segue o padrão da
// empresa) — para a lojista ver o erro no campo, não um 400 no Salvar.
//
// O que mora aqui:
//   - formatação (06.01.01, 1.1503.10.00) e limpeza (só dígitos);
//   - o estado do código de tributação nacional (vazio, parcial, ok) e o
//     selo da seção;
//   - o que trava o Salvar (código pela metade; vazio não trava, como o NCM);
//   - o corpo que vai para o POST/PATCH (vazio → null);
//   - a busca por palavra na Lista de Serviços Nacional
//     (constants/nfseListaServicos.ts, carregada sob demanda);
//   - o selo "Falta código da NFS-e" da lista do Estoque.
// ============================================================
// Só o TIPO vem do arquivo da lista (apagado na compilação): a lista em si
// chega por hooks/useListaServicosNfse.ts, sob demanda.
import type { LinhaDaLista } from "@/constants/nfseListaServicos";
import { SINONIMOS_NFSE } from "@/constants/nfseSinonimos";
import { vaiNaNfse, type NotaFiscal } from "@/utils/notaDoItem";

/** A lista carregada: as linhas com código e o título de cada item. */
export type ListaNfse = {
  linhas: ReadonlyArray<LinhaDaLista>;
  itens: Record<string, string>;
};

// ── tamanhos (iguais aos do backend) ─────────────────────────
export const DIGITOS_NFSE = {
  ctribnac: 6,
  cnbs: 9,
  ctribmun: 3,
  cst: 3,
  cclasstrib: 6,
  cindop: 6,
} as const;

/** Só os dígitos, até `max`. É o que o campo guarda enquanto se digita. */
export function soDigitos(v: string | null | undefined, max?: number): string {
  const d = String(v ?? "").replace(/\D/g, "");
  return max ? d.slice(0, max) : d;
}

/** 060101 → "06.01.01" (aceita pela metade: "0601" → "06.01"). */
export function fmtCodigoNfse(d: string | null | undefined): string {
  const s = soDigitos(d, 6);
  let o = s.slice(0, 2);
  if (s.length > 2) o += "." + s.slice(2, 4);
  if (s.length > 4) o += "." + s.slice(4, 6);
  return o;
}

/** 115031000 → "1.1503.10.00" (aceita pela metade). */
export function fmtNbs(d: string | null | undefined): string {
  const s = soDigitos(d, 9);
  let o = s.slice(0, 1);
  if (s.length > 1) o += "." + s.slice(1, 5);
  if (s.length > 5) o += "." + s.slice(5, 7);
  if (s.length > 7) o += "." + s.slice(7, 9);
  return o;
}

export type StatusDoCodigo = "vazio" | "parcial" | "ok";

export function statusDoCodigo(codigo: string | null | undefined, tamanho: number = DIGITOS_NFSE.ctribnac): StatusDoCodigo {
  const d = soDigitos(codigo);
  if (!d) return "vazio";
  return d.length === tamanho ? "ok" : "parcial";
}

/** "Falta 1 número" / "Faltam 3 números". */
export function faltamNumeros(atual: string | null | undefined, tamanho: number): string {
  const f = Math.max(0, tamanho - soDigitos(atual).length);
  return (f > 1 ? "Faltam " : "Falta ") + f + (f > 1 ? " números" : " número");
}

// ── selo da seção (cabeçalho) ────────────────────────────────
//
// Pela metade é erro (seria recusado na emissão); com 6 números, pronto;
// vazio é âmbar só para quem emite NFS-e — para o resto, "opcional".
export type SeloNfse = { tom: "" | "ok" | "rec" | "err"; texto: string };

export function seloDaNfse(codigo: string | null | undefined, emiteNfse: boolean): SeloNfse {
  const st = statusDoCodigo(codigo);
  if (st === "parcial") return { tom: "err", texto: "código incompleto" };
  if (st === "ok") return { tom: "ok", texto: "pronta para a nota ✓" };
  return emiteNfse ? { tom: "rec", texto: "falta o código" } : { tom: "", texto: "opcional" };
}

// ── o estado da seção, como vai para o Salvar ────────────────
export type CamposNfseDoForm = {
  ctribnac: string;   // só dígitos
  cnbs: string;       // só dígitos
  descricao: string;  // texto livre (até 2.000)
  cst: string;        // só dígitos
  cclasstrib: string; // só dígitos
  cindop: string;     // só dígitos
  // Alíquota do ISS: o campo existe (estado e gravação), mas NÃO aparece
  // na tela — decisão pendente do dono (ver SecaoNfse, MOSTRAR_ALIQUOTA_ISS).
  aliquotaIss: string;
};

export const NFSE_VAZIO: CamposNfseDoForm = {
  ctribnac: "", cnbs: "", descricao: "", cst: "", cclasstrib: "", cindop: "", aliquotaIss: "",
};

export const DESCRICAO_NFSE_MAX = 2000;

/** Semente do formulário a partir do produto gravado (null → ""). */
export function nfseDoProduto(p: {
  nfseCtribnac?: string | null; nfseCnbs?: string | null; nfseDescricao?: string | null;
  ibscbsCst?: string | null; ibscbsCclasstrib?: string | null; ibscbsCindop?: string | null;
  nfseAliquotaIss?: number | null;
} | null | undefined): CamposNfseDoForm {
  if (!p) return { ...NFSE_VAZIO };
  return {
    ctribnac: soDigitos(p.nfseCtribnac, 6),
    cnbs: soDigitos(p.nfseCnbs, 9),
    descricao: p.nfseDescricao || "",
    cst: soDigitos(p.ibscbsCst, 3),
    cclasstrib: soDigitos(p.ibscbsCclasstrib, 6),
    cindop: soDigitos(p.ibscbsCindop, 6),
    aliquotaIss: p.nfseAliquotaIss == null ? "" : String(p.nfseAliquotaIss).replace(".", ","),
  };
}

/** Aceita "2", "2,5", "2.5" e "2,5%"; null quando vazio ou inválido. */
export function lerAliquotaIss(txt: string | null | undefined): number | null {
  let b = String(txt ?? "").replace(/%/g, "").trim();
  if (!b) return null;
  if (b.includes(",")) b = b.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(b)) return null;
  const n = Number(b);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n * 100) / 100;
}

/**
 * O que trava o Salvar: um código COMEÇADO e parado no meio. Vazio não
 * trava (salvar segue livre, como o NCM hoje — decisão do mockup).
 * Devolve os pedaços no formato de motivosQueBloqueiam ("Falta X para salvar").
 */
export function bloqueiosDaNfse(f: CamposNfseDoForm, comAliquota = false): string[] {
  const out: string[] = [];
  if (statusDoCodigo(f.ctribnac, DIGITOS_NFSE.ctribnac) === "parcial") out.push("o código da nota de serviço com 6 números");
  if (statusDoCodigo(f.cnbs, DIGITOS_NFSE.cnbs) === "parcial") out.push("o NBS com 9 números");
  if (statusDoCodigo(f.cst, DIGITOS_NFSE.cst) === "parcial") out.push("o CST com 3 números");
  if (statusDoCodigo(f.cclasstrib, DIGITOS_NFSE.cclasstrib) === "parcial") out.push("o cClassTrib com 6 números");
  if (statusDoCodigo(f.cindop, DIGITOS_NFSE.cindop) === "parcial") out.push("o indicador de operação com 6 números");
  if (comAliquota && f.aliquotaIss.trim() && lerAliquotaIss(f.aliquotaIss) == null) out.push("a alíquota do ISS entre 0 e 5%");
  return out;
}

export type GravacaoNfse = {
  nfseCtribnac: string | null;
  nfseCnbs: string | null;
  nfseDescricao: string | null;
  ibscbsCst: string | null;
  ibscbsCclasstrib: string | null;
  ibscbsCindop: string | null;
  // undefined = não mexe na coluna (a alíquota não está na tela).
  nfseAliquotaIss?: number | null;
};

/** Vazio → null (volta a seguir o padrão da empresa). Só dígitos completos passam. */
export function gravacaoDaNfse(f: CamposNfseDoForm, comAliquota = false): GravacaoNfse {
  const cod = (v: string, n: number) => {
    const d = soDigitos(v);
    return d.length === n ? d : null;
  };
  const desc = (f.descricao || "").trim();
  const out: GravacaoNfse = {
    nfseCtribnac: cod(f.ctribnac, DIGITOS_NFSE.ctribnac),
    nfseCnbs: cod(f.cnbs, DIGITOS_NFSE.cnbs),
    nfseDescricao: desc ? desc.slice(0, DESCRICAO_NFSE_MAX) : null,
    ibscbsCst: cod(f.cst, DIGITOS_NFSE.cst),
    ibscbsCclasstrib: cod(f.cclasstrib, DIGITOS_NFSE.cclasstrib),
    ibscbsCindop: cod(f.cindop, DIGITOS_NFSE.cindop),
  };
  if (comAliquota) out.nfseAliquotaIss = lerAliquotaIss(f.aliquotaIss);
  return out;
}

/** Algo digitado na seção (para o "descartar o cadastro?"). */
export function temAlgoNaNfse(f: CamposNfseDoForm): boolean {
  return !!(f.ctribnac || f.cnbs || f.descricao.trim() || f.cst || f.cclasstrib || f.cindop || f.aliquotaIss.trim());
}

// ── lista do Estoque ─────────────────────────────────────────
/**
 * Item que sai na NFS-e (serviço, ou produto com "Sai em: Nota de serviço")
 * sem o código de 6 números, numa loja que emite NFS-e.
 */
export function faltaCodigoNfse(
  p: { unit?: string | null; notaFiscal?: NotaFiscal | null; nfseCtribnac?: string | null },
  emiteNfse: boolean
): boolean {
  if (!emiteNfse || !vaiNaNfse(p)) return false;
  return statusDoCodigo(p.nfseCtribnac) !== "ok";
}

// ── busca na Lista de Serviços Nacional ──────────────────────
export function normalizar(s: string | null | undefined): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const STOP: Record<string, 1> = {
  de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, em: 1, para: 1, com: 1, a: 1, o: 1,
  no: 1, na: 1, nos: 1, nas: 1, um: 1, uma: 1, ou: 1, por: 1, as: 1, os: 1,
};

/** "computador" acha "computação": palavras longas perdem as 2 últimas letras. */
function raiz(w: string): string {
  return w.length > 5 ? w.slice(0, w.length - 2) : w;
}

function palavras(q: string): string[] {
  return normalizar(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP[w]);
}

export type ServicoDaLista = { codigo: string; descricao: string; subitem?: string; item?: string };

type Indexado = ServicoDaLista & { forte: string; fraco: string };

const cacheDoIndice = new WeakMap<ListaNfse, Indexado[]>();

function indexar(lista: ListaNfse): Indexado[] {
  const pronto = cacheDoIndice.get(lista);
  if (pronto) return pronto;
  const out = lista.linhas.map(([codigo, descricao, subitem]) => {
    const item = lista.itens[codigo.slice(0, 2)] || "";
    return {
      codigo, descricao, subitem, item,
      // descrição, subitem e sinônimos pesam 2; o título do item pesa 1.
      forte: normalizar(descricao + " " + (subitem || "") + " " + (SINONIMOS_NFSE[codigo] || "")),
      fraco: normalizar(item),
    };
  });
  cacheDoIndice.set(lista, out);
  return out;
}

/** O serviço pelo código de 6 números (null quando não está na lista). */
export function acharServico(lista: ListaNfse | null | undefined, codigo: string | null | undefined): ServicoDaLista | null {
  if (!lista) return null;
  const c = soDigitos(codigo);
  if (c.length !== 6) return null;
  const e = indexar(lista).find((x) => x.codigo === c);
  return e ? { codigo: e.codigo, descricao: e.descricao, subitem: e.subitem, item: e.item } : null;
}

/**
 * Busca por palavras ("corte de cabelo", "manutenção de computador") ou
 * pelo começo do código ("0601", "06.01"). Até `limite` resultados, os
 * mais parecidos primeiro.
 */
export function buscarServicos(lista: ListaNfse | null | undefined, q: string, limite = 6): ServicoDaLista[] {
  if (!lista || !q) return [];
  const idx = indexar(lista);
  const soNumero = /^[\d.\s]+$/.test(q.trim());
  if (soNumero) {
    const pref = soDigitos(q);
    if (pref.length < 2) return [];
    return idx.filter((e) => e.codigo.startsWith(pref)).slice(0, limite).map(limpo);
  }
  const ws = palavras(q).map(raiz);
  if (!ws.length) return [];
  const pont: Array<{ e: Indexado; p: number; todas: boolean }> = [];
  idx.forEach((e, ordem) => {
    let p = 0; let achadas = 0;
    ws.forEach((w) => {
      if (e.forte.indexOf(w) >= 0) { p += 2; achadas++; }
      else if (e.fraco.indexOf(w) >= 0) { p += 1; achadas++; }
    });
    // Só o título do item não basta ("Serviços de…" casa com quase tudo).
    if (p >= 2) pont.push({ e, p: p * 1000 - ordem / 1000, todas: achadas === ws.length });
  });
  pont.sort((a, b) => (Number(b.todas) - Number(a.todas)) || (b.p - a.p));
  return pont.slice(0, limite).map((x) => limpo(x.e));
}

function limpo(e: Indexado): ServicoDaLista {
  return { codigo: e.codigo, descricao: e.descricao, subitem: e.subitem, item: e.item };
}

/** A sugestão pelo nome do serviço: o primeiro da busca ("Corte feminino" → 06.01.01). */
export function sugestaoPeloNome(lista: ListaNfse | null | undefined, nome: string): ServicoDaLista | null {
  const r = buscarServicos(lista, nome, 1);
  return r.length ? r[0] : null;
}

/** "Barbearia, cabeleireiros, manicuros…" → "Barbearia" (o rótulo curto da dica). */
export function rotuloCurto(descricao: string): string {
  return (descricao || "").split(/[,;(]/)[0].replace(/\.$/, "").trim();
}
