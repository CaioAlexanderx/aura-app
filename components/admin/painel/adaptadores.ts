// ============================================================
// Gestão Aura › Hoje — adaptadores API → modelo da tela.
//
// O backend (Aura-backend #807) manda números crus, colunas com `tipo` e
// linhas como objetos; a tela quer texto pronto, células e Ponto[]. Toda a
// tradução mora aqui, em funções puras (testadas com as fixtures reais em
// __tests__/__fixtures__/painel). Divergências conhecidas: ver a descrição
// do PR e os comentários de cada função.
// ============================================================
import type {
  PainelApiAlerta, PainelApiBlocoResumo, PainelApiConversa, PainelApiDetalhe, PainelApiFicha,
  PainelApiHoje, PainelApiLayout, PainelApiLista, PainelApiPonto,
} from "@/services/adminApi";
import { CATALOGO, DEFINICOES } from "./blocos";
import type {
  Alerta, Bloco, BlocoDetalhe, BlocoId, Celula, ConversaContato, Destaque, FichaCliente, Indicador,
  ItemCatalogo, Lista, PainelHoje, Ponto, SerieDetalhe, Tom, TipoGrafico, Variacao,
} from "./tipos";

var FUSO = "America/Sao_Paulo";

// ── Formatação ──────────────────────────────────────────────

function numero(n: number, min?: number, max?: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: min == null ? 0 : min, maximumFractionDigits: max == null ? 2 : max });
}

// "R$ 553" quando redondo, "R$ 140,83" quando tem centavos; `centavos` força
// duas casas (tabelas, para alinhar).
export function brl(n: number, centavos?: boolean): string {
  if (centavos || n % 1 !== 0) return "R$ " + numero(n, 2, 2);
  return "R$ " + numero(n, 0, 0);
}

// "2026-10-14" → "14/10"
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? m[3] + "/" + m[2] : "—";
}

// ISO UTC → "11/10 14:20" no fuso de Brasília.
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  var partes: Record<string, string> = {};
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: FUSO })
    .formatToParts(d).forEach(function(p) { partes[p.type] = p.value; });
  return partes.day + "/" + partes.month + " " + (partes.hour === "24" ? "00" : partes.hour) + ":" + partes.minute;
}

// "11999900002" → "(11) 99990-0002"
export function formatarTelefone(tel: string): string {
  var d = tel.replace(/\D/g, "");
  if (d.length === 13 && d.indexOf("55") === 0) d = d.slice(2);
  if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return tel;
}

function plural(n: number, um: string, varios: string): string {
  return n + " " + (n === 1 ? um : varios);
}

// ── Cabeçalho, blocos e alertas ─────────────────────────────

// Em quais blocos "subir" é ruim: a cor da variação inverte.
var MENOR_E_MELHOR: string[] = ["pagantes_sem_venda", "crediario", "fiscal"];

// A API manda a variação como diferença absoluta em 7 e 30 dias (ou null
// nos primeiros dias de histórico). A pill mostra a de 7 dias, ou a de 30.
function adaptarVariacao(id: string, v: PainelApiBlocoResumo["variacao"]): Variacao | null {
  if (!v) return null;
  var n = v.d7 != null ? v.d7 : v.d30;
  if (n == null) return null;
  var janela = v.d7 != null ? "7d" : "30d";
  var abs = Math.abs(n);
  var corpo = id === "receita" ? brl(abs) : numero(abs);
  var sinal = n > 0 ? "+" : n < 0 ? "−" : "";
  var invertido = MENOR_E_MELHOR.indexOf(id) >= 0;
  var tom: Tom = n === 0 ? "neutro" : ((n > 0) !== invertido ? "sobe" : "desce");
  return { texto: sinal + corpo + " · " + janela, tom: tom };
}

// `unidade` é o texto que vai ao lado do número. "R$ por mês" vira valor
// "R$ 553" + legenda "por mês"; "h" vira "16h".
function valorELegenda(b: { valor: number | null; unidade: string | null }): { valor: string | number | null; legenda?: string } {
  var u = b.unidade || "";
  if (b.valor == null) return { valor: null, legenda: u || undefined };
  if (/^R\$/.test(u)) return { valor: brl(b.valor), legenda: u.replace(/^R\$\s*/, "") || undefined };
  if (u === "h") return { valor: b.valor + "h" };
  return { valor: b.valor, legenda: u || undefined };
}

// Fatias da rosca: a API não manda cor.
var CICLO_ROSCA: Tom[] = ["neutro", "teal", "claro", "alerta", "mudo"];

// Pontos do gráfico. Os extras de cada bloco (pct, pagantes, anuais, trials,
// visitas, rejeitadas, mrr) viram `texto`, `valor2` ou `tom`; `valor` null
// ("nunca vendeu") vira 0, ou barra cheia e apagada em pagantes_sem_venda.
export function adaptarPontos(id: string, pontos: PainelApiPonto[], tipo?: TipoGrafico | string): Ponto[] {
  var n = pontos.length;
  return pontos.map(function(p, i) {
    var o: Ponto = { rotulo: String(p.rotulo), valor: p.valor == null ? 0 : Number(p.valor) };
    if (p.texto != null) o.texto = String(p.texto);
    if (id === "acesso" && tipo === "linha" && p.pagantes != null) o.valor2 = Number(p.pagantes);
    if (id === "trials_degrau") {
      if (p.pct != null && i > 0) o.texto = Math.round(Number(p.pct)) + "%";
      if (i === n - 1 && i > 0) o.tom = "teal";
    }
    if (tipo === "rosca") {
      o.tom = CICLO_ROSCA[i % CICLO_ROSCA.length];
      if (p.anuais != null && Number(p.anuais) > 0) o.texto = plural(Number(p.anuais), "anual", "anuais");
      if (p.mrr != null) o.texto = brl(Number(p.mrr));
    }
    if (id === "pagantes_sem_venda") {
      if (p.valor == null) { o.valor = 90; o.tom = "mudo"; }
      else o.tom = Number(p.valor) >= 14 ? "desce" : "alerta";
    }
    if (id === "fiscal" && p.rejeitadas != null && Number(p.rejeitadas) > 0) o.tom = "desce";
    if (id === "frentes" && p.pagantes != null) o.texto = p.pagantes + " pag · " + (p.trials || 0) + " trial";
    if (id === "telas_visitadas" && p.visitas != null) o.texto = p.valor + (p.valor === 1 ? " loja" : " lojas") + " · " + p.visitas + " vis.";
    return o;
  });
}

function adaptarBloco(b: PainelApiBlocoResumo): Bloco {
  var vl = valorELegenda(b);
  var def = DEFINICOES.filter(function(d) { return d.id === b.id; })[0];
  return {
    id: b.id as BlocoId,
    valor: vl.valor,
    legenda: vl.legenda,
    variacao: adaptarVariacao(b.id, b.variacao),
    serie: adaptarPontos(b.id, b.serie || [], def ? def.grafico : undefined),
    resumo: b.resumo || "",
    fonte: b.fonte || null,
  };
}

// A faixa do topo não vem da API: sai dos blocos que já vieram. (A API não
// manda série histórica de pagantes, então a faixa dele fica sem sparkline.)
var FAIXA: { bloco: BlocoId; rotulo: string; sparkline: boolean; tom?: Tom }[] = [
  { bloco: "receita", rotulo: "MRR real · Asaas", sparkline: true },
  { bloco: "pagantes", rotulo: "Pagantes", sparkline: false },
  { bloco: "acesso", rotulo: "Acesso", sparkline: true, tom: "teal" },
  { bloco: "plataforma", rotulo: "Plataforma", sparkline: true },
];

function derivarDestaques(blocos: Bloco[]): Destaque[] {
  var out: Destaque[] = [];
  FAIXA.forEach(function(f) {
    var b = blocos.filter(function(x) { return x.id === f.bloco; })[0];
    if (!b || b.valor == null) return;
    out.push({
      id: f.bloco,
      rotulo: f.rotulo,
      valor: String(b.valor),
      variacao: b.variacao,
      nota: b.legenda || "",
      serie: f.sparkline ? b.serie.map(function(p) { return p.valor; }) : [],
      tom: f.tom,
      bloco: f.bloco,
    });
  });
  return out;
}

// O alerta chega com `tipo` de domínio; a tela só pinta três estados.
// pagamento_sem_loja é verde no mockup aprovado (dinheiro entrou, falta vincular).
var TOM_DO_ALERTA: Record<string, Alerta["tipo"]> = {
  pagante_anual_vencendo: "risco",
  trial_com_venda_vencendo: "atencao",
  pagamento_sem_loja: "bom",
  nfce_rejeitada: "atencao",
};

function adaptarAlerta(a: PainelApiAlerta): Alerta {
  return {
    tipo: TOM_DO_ALERTA[a.tipo] || "atencao",
    company_id: a.company_id || null,
    titulo: a.titulo,
    detalhe: a.detalhe || "",
    verbo: a.verbo || "Ver",
    bloco: (a.bloco as BlocoId) || null,
  };
}

export function adaptarHoje(raw: PainelApiHoje): PainelHoje {
  var blocos = (raw.blocos || []).map(adaptarBloco);
  return {
    calculado_em: raw.calculado_em,
    proximo_calculo: raw.proximo_calculo,
    ao_vivo: !!raw.ao_vivo,
    destaques: derivarDestaques(blocos),
    blocos: blocos,
    alertas: (raw.alertas || []).map(adaptarAlerta),
  };
}

// ── Detalhe do card ─────────────────────────────────────────

// A API não tipa os indicadores: só os blocos abaixo têm valores em reais.
function indicadorEmReais(id: string, rotulo: string): boolean {
  if (id === "receita") return true;
  if (id === "crediario") return /^valor/i.test(rotulo);
  return false;
}

function adaptarIndicador(id: string, i: PainelApiDetalhe["indicadores"][0]): Indicador {
  var valor: string;
  if (i.valor == null) valor = "—";
  else if (typeof i.valor === "number") valor = indicadorEmReais(id, i.rotulo) ? brl(i.valor, true) : numero(i.valor);
  else valor = i.valor;
  return { rotulo: i.rotulo, valor: valor, nota: i.nota || undefined };
}

var ROTULO_SITUACAO: Record<string, string> = {
  new: "Novo", contacted: "Contatado", qualified: "Qualificado", converted: "Virou conta", lost: "Perdido",
  trial: "Trial", paying: "Pagante", active: "Ativo",
};
function capitalizar(t: string): string { return t.charAt(0).toUpperCase() + t.slice(1); }

// Situação do contato: do site (status do lead) e do WhatsApp (quem respondeu).
var TOM_DA_SITUACAO: Record<string, Tom> = {
  pagante: "sobe", trial: "alerta", novo: "alerta",
  "sem resposta": "desce", aurinha: "alerta", caio: "sobe",
};

function celulaDe(col: PainelApiLista["colunas"][0], row: Record<string, any>): Celula {
  var v = row[col.chave];
  switch (col.tipo) {
    case "loja": {
      var nome = v != null ? String(v) : (row.nome != null ? String(row.nome) : "—");
      if (!row.company_id) return row.sem_loja ? { texto: nome, tom: "alerta" } : nome;
      return { texto: nome, company_id: String(row.company_id), telefone: row.telefone || null };
    }
    case "numero": return v == null ? "—" : Number(v);
    case "moeda": return v == null ? "—" : brl(Number(v), true);
    case "data": return dataCurta(v);
    case "data_hora": return dataHora(v);
    case "booleano": return v ? { texto: "Sim", tom: "sobe", etiqueta: true } : { texto: "Não", tom: "mudo", etiqueta: true };
    default: {
      if (v == null || v === "") return "—";
      if (col.chave === "telefone") {
        // WhatsApp: a lista mostra o número mascarado ("+55 11 *****-0002"), sem link.
        if (String(v).indexOf("*") >= 0) return String(v);
        return { texto: formatarTelefone(String(v)), telefone: String(v) };
      }
      if (col.chave === "situacao" || col.chave === "status") {
        var cru = String(v);
        var texto = ROTULO_SITUACAO[cru.toLowerCase()] || capitalizar(cru);
        var t = texto.toLowerCase();
        return { texto: texto, etiqueta: true, tom: TOM_DA_SITUACAO[t] || "mudo" };
      }
      return String(v);
    }
  }
}

function adaptarLista(l: PainelApiLista): Lista {
  return {
    titulo: l.titulo,
    colunas: l.colunas.map(function(c) { return c.rotulo; }),
    linhas: l.linhas.map(function(row) {
      return l.colunas.map(function(c) {
        var cel = celulaDe(c, row);
        // Contato do WhatsApp (Aura-backend#815): o nome abre a conversa (sem
        // nome, vale o telefone mascarado) e a empresa abre a ficha da loja.
        if (row.conversa_id) {
          if (c.chave === "nome") {
            return { texto: typeof cel === "string" && cel !== "—" ? cel : String(row.telefone || "Contato"), conversa_id: String(row.conversa_id) };
          }
          if (c.chave === "empresa" && row.company_id && typeof cel === "string" && cel !== "—") {
            return { texto: cel, company_id: String(row.company_id) };
          }
        }
        return cel;
      });
    }),
  };
}

// trials_degrau: uma lista por degrau do funil, que a tela mostra como
// coluna de cartões (loja, detalhe, verbos).
function adaptarCartoes(l: PainelApiLista): Lista {
  return {
    titulo: l.titulo,
    formato: "cartoes",
    colunas: [],
    total: l.linhas.length,
    linhas: l.linhas.map(function(row) {
      var vencido = row.vencido === true;
      var partes: string[] = [];
      if (row.degrau !== "assinou") {
        partes.push(plural(Number(row.produtos) || 0, "produto", "produtos"));
        partes.push(plural(Number(row.vendas) || 0, "venda", "vendas"));
      } else {
        partes.push([row.plano, row.ciclo ? String(row.ciclo).toLowerCase() : null].filter(Boolean).join(" "));
      }
      if (row.vence_em) partes.push((vencido ? "venceu " : "vence ") + dataCurta(row.vence_em));
      var celulas: Celula[] = [
        { texto: String(row.nome), company_id: String(row.company_id), telefone: row.telefone || null },
        { texto: partes.join(" · "), tom: vencido ? "desce" : undefined },
      ];
      if (row.telefone) celulas.push({ texto: "WhatsApp", verbo: true, primario: true, telefone: String(row.telefone) });
      if (row.degrau !== "assinou") celulas.push({ texto: "+7 dias", verbo: true });
      return celulas;
    }),
  };
}

// O insight vem como texto; o tom (cor da caixa) é da tela: blocos que
// apontam problema usam âmbar.
var INSIGHT_ALERTA: string[] = ["pagantes_sem_venda", "fiscal", "crediario", "acesso", "pagantes", "receita", "contatos"];

function adaptarSerie(id: string, s: PainelApiDetalhe["series"][0]): SerieDetalhe {
  var pontos = adaptarPontos(id, s.pontos || [], s.tipo);
  var temSegunda = pontos.some(function(p) { return p.valor2 != null; });
  return {
    titulo: s.titulo,
    tipo: s.tipo,
    pontos: pontos,
    legenda: s.tipo === "linha" && temSegunda ? ["Todas as lojas", "Pagantes"] : undefined,
  };
}

export function adaptarDetalhe(id: string, raw: PainelApiDetalhe): BlocoDetalhe {
  return {
    periodo: raw.periodo,
    ao_vivo: !!raw.ao_vivo,
    calculado_em: raw.calculado_em,
    indicadores: (raw.indicadores || []).map(function(i) { return adaptarIndicador(id, i); }),
    listas: (raw.listas || []).map(id === "trials_degrau" ? adaptarCartoes : adaptarLista),
    series: (raw.series || []).map(function(s) { return adaptarSerie(id, s); }),
    insight: raw.insight ? { texto: raw.insight, tom: INSIGHT_ALERTA.indexOf(id) >= 0 ? "alerta" : "neutro" } : null,
  };
}

// ── Conversa de um contato do WhatsApp ──────────────────────

// 510 → "8 h 30 min"; 45 → "45 min"; 120 → "2 h".
function duracao(min: number): string {
  var m = Math.max(0, Math.round(min));
  if (m < 60) return m + " min";
  var h = Math.floor(m / 60);
  var r = m % 60;
  return h + " h" + (r ? " " + r + " min" : "");
}

var QUEM_FALOU: Record<string, string> = { aurinha: "Aurinha", humano: "Caio" };

export function adaptarConversa(raw: PainelApiConversa): ConversaContato {
  var telefone = raw.telefone_formatado || raw.telefone_mascarado || (raw.telefone ? formatarTelefone(raw.telefone) : "");
  var atual = raw.contato_atual;
  var rotulo = atual && (atual.situacao_rotulo || atual.situacao) ? String(atual.situacao_rotulo || atual.situacao) : null;
  var situacao: Variacao | null = rotulo ? { texto: rotulo, tom: TOM_DA_SITUACAO[rotulo.toLowerCase()] || "mudo" } : null;

  var indicadores: Indicador[] = [];
  if (raw.primeiro_contato_em) indicadores.push({ rotulo: "Primeiro contato", valor: dataHora(raw.primeiro_contato_em) });
  if (atual && atual.primeira_resposta_humana_em) {
    indicadores.push({
      rotulo: "Primeira resposta do Caio",
      valor: dataHora(atual.primeira_resposta_humana_em),
      nota: atual.espera_min != null ? "depois de " + duracao(atual.espera_min) : undefined,
    });
  } else if (atual && atual.primeira_resposta_aurinha_em) {
    indicadores.push({ rotulo: "Primeira resposta da Aurinha", valor: dataHora(atual.primeira_resposta_aurinha_em), nota: "o Caio ainda não respondeu" });
  }
  if (raw.aguardando_resposta_desde) {
    indicadores.push({ rotulo: "Sem resposta desde", valor: dataHora(raw.aguardando_resposta_desde), tom: "desce" });
  }
  if (raw.contatos_na_conversa > 1) {
    indicadores.push({ rotulo: "Contatos nesta conversa", valor: String(raw.contatos_na_conversa) });
  }

  var nome = raw.nome ? String(raw.nome) : null;
  return {
    conversa_id: raw.conversa_id,
    titulo: nome || telefone || "Contato",
    telefone: telefone,
    link: raw.link_whatsapp || null,
    empresa: raw.empresa ? { company_id: String(raw.empresa.company_id), nome: String(raw.empresa.nome) } : null,
    situacao: situacao,
    indicadores: indicadores,
    // O backend já manda em ordem; ordenar por `quando` garante a cronologia.
    mensagens: (raw.mensagens || [])
      .slice()
      .sort(function(a, b) { return Date.parse(a.quando) - Date.parse(b.quando); })
      .map(function(m) {
        return {
          id: m.id,
          autor: m.autor,
          quem: m.autor === "cliente" ? (nome ? nome.split(/\s+/)[0] : "Cliente") : QUEM_FALOU[m.autor] || m.autor,
          quando: dataHora(m.quando),
          texto: m.texto,
        };
      }),
    truncada: !!raw.truncada,
  };
}

// ── Ficha da loja ───────────────────────────────────────────

var PLANOS: Record<string, string> = { essencial: "Essencial", negocio: "Negócio", expansao: "Expansão", personalizado: "Personalizado" };
var RISCO: Record<string, { texto: string; tom: Tom }> = {
  healthy: { texto: "saudável", tom: "sobe" },
  attention: { texto: "atenção", tom: "alerta" },
  at_risk: { texto: "em risco", tom: "desce" },
};
var EVENTO_ASAAS: Record<string, string> = {
  PAYMENT_RECEIVED: "pago", PAYMENT_CONFIRMED: "confirmado", PAYMENT_OVERDUE: "atrasado", PAYMENT_DELETED: "cobrança apagada",
};

function situacaoDaFicha(c: Record<string, any>): Variacao | null {
  switch (c.stage) {
    case "cliente": return { texto: "Pagante", tom: "sobe" };
    case "trial": return { texto: c.trial_days_left != null ? "Trial · " + c.trial_days_left + " d" : "Trial", tom: "alerta" };
    case "vencido": return { texto: "Vencido", tom: "desce" };
    case "interno": return { texto: "Interno", tom: "mudo" };
    case "arquivo": return { texto: "Arquivo", tom: "mudo" };
    default: return null;
  }
}

export function adaptarFicha(raw: PainelApiFicha): FichaCliente {
  var c = raw.cliente || {};
  var h = raw.health;
  var plano = c.plan ? (PLANOS[c.plan] || capitalizar(String(c.plan))) : null;
  var ciclo = c.billing_cycle === "annual" ? "anual" : c.billing_cycle === "monthly" ? "mensal" : null;
  var desde = c.created_at ? "cliente desde " + dataCurta(String(c.created_at).slice(0, 10)) : null;
  var risco = h ? (RISCO[h.risk_level] || { texto: String(h.risk_level), tom: "neutro" as Tom }) : null;
  var ultimoAsaas = raw.asaas && raw.asaas[0];
  var logins = raw.logins || { ultimos_30d: 0, dias_ativos_30d: 0, ultimo_acesso: null };

  var indicadores: Indicador[] = [
    { rotulo: "Saúde", valor: h ? h.score + "/100" : "—", nota: risco ? risco.texto : "sem cálculo", tom: risco ? risco.tom : undefined },
    { rotulo: "Logins · 30d", valor: numero(logins.ultimos_30d), nota: plural(logins.dias_ativos_30d, "dia ativo", "dias ativos") },
    { rotulo: "Último acesso", valor: logins.ultimo_acesso ? dataCurta(String(logins.ultimo_acesso).slice(0, 10)) : "nunca" },
    { rotulo: "Vendas", valor: numero(Number(c.sale_count) || 0), nota: c.total_revenue != null ? brl(Number(c.total_revenue)) + " no total" : undefined },
    {
      rotulo: "Asaas",
      valor: ultimoAsaas ? (EVENTO_ASAAS[ultimoAsaas.evento] || ultimoAsaas.evento) : (c.has_subscription ? "sem evento" : "sem cobrança"),
      nota: ultimoAsaas ? dataCurta(String(ultimoAsaas.quando).slice(0, 10)) + (ultimoAsaas.valor != null ? " · " + brl(ultimoAsaas.valor) : "") : undefined,
    },
  ];

  var modulos = raw.modulos_detalhe && raw.modulos_detalhe.length
    ? raw.modulos_detalhe.map(function(m) { return { nome: m.nome, usa: !!m.usou_30d }; })
    : (raw.modulos || []).map(function(nome) { return { nome: nome, usa: true }; });

  return {
    company_id: raw.company_id,
    nome: raw.nome,
    telefone: raw.telefone || c.owner_phone || null,
    alertas: (raw.alertas || []).map(function(a) {
      return { tom: a.tipo === "pagante_anual_vencendo" ? "risco" as const : "alerta" as const, texto: a.titulo + (a.detalhe ? " — " + a.detalhe : "") };
    }),
    situacao: situacaoDaFicha(c),
    resumo: [plano ? plano + (ciclo ? " " + ciclo : "") : null, desde, c.owner_name || null].filter(Boolean).join(" · "),
    indicadores: indicadores,
    serie: raw.vendas_por_semana && raw.vendas_por_semana.length
      ? { titulo: "Vendas por semana", pontos: raw.vendas_por_semana.map(function(p) { return { rotulo: p.rotulo, valor: p.valor }; }) }
      : null,
    modulos: modulos,
    linha_do_tempo: (raw.linha_do_tempo || []).map(function(e) {
      return { data: dataCurta(String(e.quando).slice(0, 10)), texto: e.titulo + (e.valor != null ? " · " + brl(e.valor, true) : "") };
    }),
    fontes: "banco Aura · Asaas · audit_log",
  };
}

// ── Layout e catálogo ───────────────────────────────────────

export type LayoutPainel = {
  ativos: BlocoId[];                                   // visíveis, na ordem
  conhecidos: { id: BlocoId; titulo: string; grupo: string }[];   // tudo que o backend aceita no PUT
  padrao: boolean;                                     // nunca salvo
};

export function adaptarLayout(raw: PainelApiLayout): LayoutPainel {
  var blocos = raw.blocos || [];
  return {
    ativos: blocos.filter(function(b) { return b.visivel; }).map(function(b) { return b.id as BlocoId; }),
    conhecidos: blocos.map(function(b) { return { id: b.id as BlocoId, titulo: b.titulo, grupo: b.grupo }; }),
    padrao: !!raw.padrao,
  };
}

// Corpo do PUT: visíveis na ordem escolhida e, depois, os desligados. O
// backend completa o que faltar como visível, então os ocultos vão explícitos.
// Ids que o backend não conhece (blocos só do mockup) não vão: dariam 400.
export function corpoDoLayout(conhecidos: BlocoId[], ativos: BlocoId[]): { id: BlocoId; visivel: boolean }[] {
  var ordem = ativos.filter(function(id) { return conhecidos.indexOf(id) >= 0; });
  var resto = conhecidos.filter(function(id) { return ordem.indexOf(id) < 0; });
  return ordem.map(function(id) { return { id: id, visivel: true }; })
    .concat(resto.map(function(id) { return { id: id, visivel: false }; }));
}

// Catálogo em produção: o que o backend calcula (GET /layout) liga e
// desliga; o resto do mockup aparece travado, "em construção".
export function montarCatalogo(conhecidos: { id: BlocoId; titulo: string }[]): ItemCatalogo[] {
  var ids = conhecidos.map(function(c) { return c.id; });
  var base = function(id: BlocoId) { return CATALOGO.filter(function(i) { return i.id === id; })[0]; };
  var itens: ItemCatalogo[] = conhecidos.map(function(c) {
    var b = base(c.id);
    return { id: c.id, titulo: c.titulo, fonte: b ? b.fonte : "" };
  });
  CATALOGO.forEach(function(i) {
    if (ids.indexOf(i.id) < 0) itens.push({ id: i.id, titulo: i.titulo, fonte: i.fonte, aviso: i.aviso, em_construcao: true });
  });
  return itens;
}
