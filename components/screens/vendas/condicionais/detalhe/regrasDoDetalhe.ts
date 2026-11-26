// ============================================================
// AURA. — Detalhe da condicional: textos e contas (C10, 26/11/2026)
//
// Funções puras. Os textos saem do mockup aprovado em 25/11
// (condicional/mockup.html, tela 4 "Detalhe e decisão"). O que é montado
// com dados (nomes, valores) segue a frase do mockup; as diferenças estão na
// lista de divergências do PR.
// ============================================================
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import { dataCurtaComPonto, diaEmSaoPaulo } from "../regrasDasCondicionais";
import { diaEMes } from "@/components/screens/vendas/pedidos/regrasDosPedidos";
import type { DetalheDaCondicional, EventoDaCondicional, PecaDaCondicional } from "@/hooks/useCondicional";

/**
 * "Cobrar no Caixa" (C12). Enquanto o Caixa não abre com as peças que
 * ficaram, o botão NÃO aparece (sem botão morto). Ao entregar o C12: ligar
 * esta chave e passar `onCobrar` à GavetaDaCondicional (recebe o detalhe e
 * leva a `/pdv?condicional=<id>&itens=<ids das que ficaram>`).
 */
export const COBRAR_NO_CAIXA_PRONTO = false;

export const TEXTOS_DO_DETALHE = {
  titulo: "Condicional",
  fechar: "Fechar",
  ficou: "Ficou",
  voltou: "Voltou",
  aindaComEla: "Ainda com ela",
  bipe: "Bipe a peça que voltou",
  defeito: "Voltou com defeito ou sem etiqueta. Não volta ao estoque sozinha: vai para Peças para resolver.",
  defeitoAviso: "Ao salvar, ela sai da condicional e não conta como livre.",
  defeitoAvisoResto: " Em Peças para resolver você decide: voltar ao estoque ou dar baixa.",
  defeitoNota: "O que aconteceu (opcional)",
  novaData: "Nova data",
  acrescentar: "Acrescentar peça",
  reimprimir: "Reimprimir comprovante",
  folhaA4: "Folha A4",
  bobina: "Bobina 80 mm",
  whatsapp: "Enviar pelo WhatsApp",
  cancelarLink: "Cancelar condicional",
  cancelarConfirma: "Cancelar a condicional",
  manter: "Manter",
  lembrar: "Lembrar pelo WhatsApp",
  verLista: "Ver a lista",
  cobrarNoCaixa: "Cobrar no Caixa",
  salvarDevolucao: "Salvar devolução",
  tudoDevolvido: "Tudo devolvido",
  oQueAconteceu: "O que aconteceu",
  encerrada: "Encerrada",
  nadaACobrar: "Tudo voltou. Nada a cobrar.",
  ficamLivres: "As peças ficam livres para vender de novo.",
  marque: "Marque o que ficou e o que voltou",
  segueEmAberto: "A condicional segue em aberto.",
} as const;

/** Frases que o mockup não desenhou (entram na lista de divergências). */
export const TEXTOS_FORA_DO_MOCKUP = {
  carregando: "Buscando a condicional…",
  erroAoBuscar: "Não deu para abrir a condicional agora.",
  tentarDeNovo: "Tentar de novo",
  semBipe: "Essa peça não está com a cliente nesta condicional. Confira se é de outra.",
  bipeNaoAchou: "Não achei esse código. Marque a peça na lista.",
  salvou: "Devolução salva.",
  encerrou: "Tudo devolvido. A condicional foi encerrada.",
  canceladaOk: "Condicional cancelada.",
  novaDataOk: "Nova data salva.",
  salvarData: "Salvar data",
  dataInvalida: "Digite uma data válida (dd/mm/aaaa).",
  dataPassou: "Essa data já passou. Escolha de hoje em diante.",
  dataLonge: "O prazo vai até 30 dias a partir de hoje.",
  erroGenerico: "Não deu para salvar agora. Tente de novo.",
  cancelada: "Cancelada",
  canceladaInfo: "Cancelada, sem cobrança",
  jaCobrada: "Ficou · já foi cobrada",
  hoje: "hoje",
} as const;

const T = TEXTOS_DO_DETALHE;

export function pc(n: number): string {
  return n === 1 ? "1 peça" : n + " peças";
}

/** O que a lojista marcou na tela, ainda sem salvar. */
export type Marca = { st: "com" | "ficou" | "voltou"; defeito?: boolean; nota?: string };
export type Marcas = Record<string, Marca>;

/** Peça que ainda está com a cliente no servidor: é a única que se decide aqui. */
export function pecaViva(i: PecaDaCondicional): boolean {
  return i.situacao === "com_cliente";
}

export function marcaDe(m: Marcas, i: PecaDaCondicional): Marca {
  return m[i.id] || { st: "com" };
}

export type AcaoDoRodape = "cobrar" | "salvar" | "tudo" | null;

export type ResumoAoVivo = {
  titulo: string;
  sub: string;
  acao: AcaoDoRodape;
  /** Botão desenhado, mas sem nada marcado ainda. */
  desligado: boolean;
  ficou: PecaDaCondicional[];
  voltou: PecaDaCondicional[];
  com: PecaDaCondicional[];
  /** Peças com defeito entre as que voltam agora. */
  defeitos: PecaDaCondicional[];
};

const soma = (l: PecaDaCondicional[]) => l.reduce((n, i) => n + (Number(i.unit_price) || 0), 0);

/** O rodapé ao vivo (mockup: função `detalhe()`): resumo e o botão único que muda. */
export function resumoAoVivo(c: Pick<DetalheDaCondicional, "status" | "items">, marcas: Marcas): ResumoAoVivo {
  const vivas = c.items.filter(pecaViva);
  const ficou = vivas.filter((i) => marcaDe(marcas, i).st === "ficou");
  const voltou = vivas.filter((i) => marcaDe(marcas, i).st === "voltou");
  const com = vivas.filter((i) => marcaDe(marcas, i).st === "com");
  const defeitos = voltou.filter((i) => !!marcaDe(marcas, i).defeito);
  const base = { ficou, voltou, com, defeitos, desligado: false };

  if (c.status === "cancelada") return { ...base, titulo: TEXTOS_FORA_DO_MOCKUP.canceladaInfo, sub: "", acao: null };
  if (c.status !== "aberta") {
    const f = c.items.filter((i) => i.situacao === "ficou");
    const v = c.items.filter((i) => i.situacao === "voltou" || i.situacao === "voltou_defeito");
    return {
      ...base, titulo: T.encerrada, acao: null,
      sub: [f.length ? `Ficou ${pc(f.length)} (${brl(soma(f))})` : "", v.length ? `${v.length} ${v.length === 1 ? "voltou" : "voltaram"}` : ""].filter(Boolean).join(" · "),
    };
  }

  const pendentes = c.items.filter((i) => i.situacao === "ficou" && !i.sale_id);
  const voltaram = c.items.filter((i) => i.situacao === "voltou" || i.situacao === "voltou_defeito");

  if (!vivas.length && pendentes.length) {
    return {
      ...base, acao: COBRAR_NO_CAIXA_PRONTO ? "cobrar" : null,
      titulo: "Falta cobrar: " + brl(soma(pendentes)),
      sub: `${pc(pendentes.length)} ${pendentes.length === 1 ? "ficou" : "ficaram"} · ${voltaram.length} ${voltaram.length === 1 ? "voltou" : "voltaram"} para o estoque`,
    };
  }
  if (ficou.length) {
    return {
      ...base, acao: COBRAR_NO_CAIXA_PRONTO ? "cobrar" : null,
      titulo: `Ela leva ${pc(ficou.length)}: ${brl(soma(ficou))}`,
      sub: [
        voltou.length ? `${voltou.length} ${voltou.length === 1 ? "voltou" : "voltaram"} para o estoque` : "",
        com.length ? `${com.length} ainda com ela (segue em aberto)` : "",
      ].filter(Boolean).join(" · ") || "Vira uma venda só, no Caixa",
    };
  }
  if (voltou.length && (com.length || pendentes.length)) {
    return {
      ...base, acao: "salvar",
      titulo: `${voltou.length} ${voltou.length === 1 ? "peça voltou" : "peças voltaram"}`,
      sub: com.length ? `${com.length} ainda com ela. ${T.segueEmAberto}` : "Falta cobrar o que ficou.",
    };
  }
  if (voltou.length) {
    return { ...base, acao: "tudo", titulo: T.nadaACobrar, sub: T.ficamLivres };
  }
  return { ...base, acao: COBRAR_NO_CAIXA_PRONTO ? "cobrar" : null, desligado: true, titulo: `${pc(com.length)} com ela: ${brl(soma(com))}`, sub: T.marque };
}

/** As marcas que "Salvar devolução" / "Tudo devolvido" mandam: só as que voltam. */
export function marcasParaSalvar(c: Pick<DetalheDaCondicional, "items">, marcas: Marcas) {
  return c.items.filter(pecaViva)
    .filter((i) => marcaDe(marcas, i).st === "voltou")
    .map((i) => {
      const m = marcaDe(marcas, i);
      const nota = (m.nota || "").trim();
      return m.defeito
        ? { item_id: i.id, situacao: "voltou_defeito" as const, ...(nota ? { defect_note: nota.slice(0, 500) } : {}) }
        : { item_id: i.id, situacao: "voltou" as const };
    });
}

/** "Cor · tamanho" da peça. */
export function detalheDaPeca(i: PecaDaCondicional): string {
  const p = [i.color_name, i.size_label].filter(Boolean) as string[];
  if (p.length) return p.join(" · ");
  return i.variant_label || "";
}

export function iniciais(nome: string): string {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
}

function dia(iso: string | null | undefined): string {
  const d = diaEmSaoPaulo(iso);
  return d ? diaEMes(d) : "";
}

/** A frase da peça travada (já decidida), no tom do mockup. */
export function textoDaPecaTravada(i: PecaDaCondicional, hoje: string): { texto: string; tom: "ficou" | "voltou" } {
  const d = dia(i.decided_at);
  const em = d ? " em " + d : "";
  if (i.situacao === "ficou") {
    const venda = i.venda_numero !== undefined && i.venda_numero !== null && String(i.venda_numero) !== ""
      ? " na venda #" + String(i.venda_numero).replace(/^#/, "") : "";
    return i.sale_id
      ? { texto: TEXTOS_FORA_DO_MOCKUP.jaCobrada + venda + (d ? " em " + d : ""), tom: "ficou" }
      : { texto: `Ficou${em} · falta cobrar no Caixa`, tom: "ficou" };
  }
  if (i.situacao === "voltou_defeito") {
    if (i.resolved_at) return { texto: `Voltou${em} com defeito · já resolvida em Peças para resolver`, tom: "voltou" };
    const quando = diaEmSaoPaulo(i.decided_at) === hoje ? "hoje" : d ? "em " + d : "";
    return { texto: `Voltou ${quando} com defeito · está em Peças para resolver`.replace("  ", " "), tom: "voltou" };
  }
  return { texto: `Voltou${em} · já está livre no estoque`, tom: "voltou" };
}

/** Peças com defeito que ainda esperam decisão em Peças para resolver. */
export function pecasParaResolver(c: Pick<DetalheDaCondicional, "items">): number {
  return c.items.filter((i) => i.situacao === "voltou_defeito" && !i.resolved_at).length;
}

export function notaDePecasParaResolver(n: number): string {
  return n === 1 ? "1 peça foi para Peças para resolver." : n + " peças foram para Peças para resolver.";
}

/** "Hoje está R$ 209,90 na loja. Vale o preço do comprovante: R$ 189,90." */
export function notaDePreco(i: PecaDaCondicional): string | null {
  if (!i.preco_mudou || i.preco_hoje === null || i.preco_hoje === undefined) return null;
  return `Hoje está ${brl(i.preco_hoje)} na loja. Vale o preço do comprovante: ${brl(i.unit_price)}.`;
}

const SEMANA = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "qua., 25/11, 10:42" (São Paulo). */
export function saiuEm(iso: string | null | undefined): string {
  const d = diaEmSaoPaulo(iso);
  if (!d || !iso) return "";
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return dataCurtaComPonto(d) + ", " + hora;
}
export { SEMANA };

/** "Nada mais com ela desde 24/11": a data da última decisão. */
export function nadaMaisDesde(c: Pick<DetalheDaCondicional, "items">): string {
  const ds = c.items.map((i) => i.decided_at).filter(Boolean).sort() as string[];
  return ds.length ? dia(ds[ds.length - 1]) : "";
}

/** O texto de cada marco de "O que aconteceu". Eventos que não conheço ficam de fora. */
export function textoDoEvento(e: EventoDaCondicional, c: Pick<DetalheDaCondicional, "items" | "numero_exibicao">): string | null {
  const peca = c.items.find((i) => i.id === e.item_id)?.product_name || "A peça";
  const d = dia(e.created_at);
  const hora = e.created_at ? saiuEm(e.created_at).split(", ").pop() : "";
  const quando = d ? ` em ${d}` + (hora ? `, ${hora}` : "") : "";
  switch (e.tipo) {
    case "criada": return `Condicional guardada${quando}.`;
    case "voltou": return `${peca} voltou${d ? " em " + d : ""}.`;
    case "voltou_defeito": return `${peca} voltou com defeito${d ? " em " + d : ""}.`;
    case "ficou": return `${peca} ficou com ela${d ? " em " + d : ""}.`;
    case "ainda_com_ela": return `${peca} voltou a ficar com ela${d ? " em " + d : ""}.`;
    case "nova_data": return `Nova data${e.dados?.para ? " para " + diaEMes(e.dados.para) : ""}${d ? ", marcada em " + d : ""}.`;
    case "peca_acrescentada": return `${e.dados?.product_name || "Uma peça"} acrescentada${quando}. Comprovante atualizado.`;
    case "encerrada": return `Condicional encerrada${d ? " em " + d : ""}.`;
    case "cancelada": return `Condicional cancelada${d ? " em " + d : ""}.`;
    default: return null;
  }
}
