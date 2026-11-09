// ============================================================
// AURA. — Editar venda (09/11/2026, mockup aprovado pelo Caio)
//
// Muda a forma de pagamento, o vendedor(a) e o cliente de uma venda já feita.
// DNA do TrocaModal: cabeçalho com ícone, barra de passos (Alterar →
// Conferir), rodapé com o resumo à esquerda e Voltar/Continuar à direita, e
// um passo de sucesso no fim. Contêiner: ResponsiveSheet (bottom sheet abaixo
// de 500 px, Modal do RN = portal no web, fora do z-index 0 do shell).
//
// Cada campo mostra o que a mudança faz assim que é alterado: o texto vem do
// dry_run do backend (PATCH .../sales/:id com dry_run: true, que não grava
// nada). O "Conferir" mostra o plano do servidor; a confirmação só aparece
// quando a venda entra ou sai do crediário.
//
// Travas (vêm do GET .../edit-context): forma e cliente travam com devolução
// ou troca ativa, crediário com pagamento, venda com sinal ou falta de
// permissão — a tela sempre diz o motivo e o que fazer. NFC-e autorizada:
// aviso no topo, crediário desligado e, até 30 min da autorização, o atalho
// "Cancelar a nota e emitir outra" (cancelamento que já existe em nfce.js).
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { ResponsiveSheet, SHEET_NARROW_BP } from "@/components/ResponsiveSheet";
import { toast } from "@/components/Toast";
import { employeesApi } from "@/services/employeesApi";
import { salesApi, type SaleEditPlan, type SaleEditResult } from "@/services/salesApi";
import { useSaleEditContext, useEditSale } from "@/hooks/useSales";
import { useCustomers } from "@/hooks/useCustomers";
import {
  METODOS, type Metodo, type LinhaDeForma, brl, ddmm, ddmmaaaa, lerDia, somarMes, fmtDataHora, rotuloDaForma,
  linhasIniciais, conferirSoma, montarCorpo, rotuloDasMudancas, efeitosDoCampo, resumoDasFormas, avisoDaNota,
  filtrarPorBusca, valorParaCampo, normalizarMetodo, lerValor,
} from "./editarVendaUtils";

type Passo = "alterar" | "conferir" | "pronto";
type Erro = { code: string | null; message: string } | null;

function lerErro(err: any, padrao: string): Erro {
  const code = (err && (err.data?.code || err.code)) || null;
  const message = (err && (err.data?.error || err.message)) || padrao;
  return { code, message };
}

// ── pedaços sem estado (fora do componente: identidade estável, o TextInput
// da busca não perde o foco a cada tecla) ─────────────────────────────────
function Efeitos({ lista }: { lista: { code: string; text: string }[] }) {
  if (!lista.length) return null;
  return (
    <View style={s.efeitos}>
      {lista.map(function(e, i) {
        const aviso = e.code === "CAIXA_CLOSED";
        return (
          <View key={e.code + i} style={[s.efeito, aviso && s.efeitoAviso]}>
            <Icon name={aviso ? "alert_circle" : "info"} size={13} color={aviso ? Colors.amber : Colors.violet3} />
            <Text style={[s.efeitoTxt, aviso && { color: Colors.ink }]}>{e.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Trava({ texto, testID }: { texto: string; testID?: string }) {
  return (
    <View style={s.trava} testID={testID}>
      <Icon name="lock" size={13} color={Colors.amber} />
      <Text style={s.travaTxt}>{texto}</Text>
    </View>
  );
}

function Era({ texto }: { texto: string }) {
  return (
    <View style={s.eraRow}>
      <Text style={s.eraLbl}>Era:</Text>
      <View style={s.eraPill}><Text style={s.eraTxt} numberOfLines={1}>{texto}</Text></View>
    </View>
  );
}

function Chip({ m, ativo, onPress, desligado, testID }: { m: { key: Metodo; label: string; icon: string }; ativo: boolean; onPress: () => void; desligado?: boolean; testID?: string }) {
  return (
    <Pressable
      onPress={desligado ? undefined : onPress}
      disabled={desligado}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo, disabled: !!desligado }}
      testID={testID}
      style={[s.chip, ativo && s.chipAtivo, desligado && { opacity: 0.4 }]}
    >
      <Icon name={m.icon} size={13} color={ativo ? "#fff" : Colors.ink2} />
      <Text style={[s.chipTxt, ativo && { color: "#fff" }]}>{m.label}</Text>
    </Pressable>
  );
}

function Lista({ opcoes, busca, setBusca, vazio, semNome, atualId, onEscolher, testID }: {
  opcoes: { id: string; name: string; subtitle?: string | null }[];
  busca: string; setBusca: (v: string) => void; vazio: string; semNome: string;
  atualId: string | null; onEscolher: (o: { id: string; name: string } | null) => void; testID: string;
}) {
  const filtradas = filtrarPorBusca(opcoes, busca);
  return (
    <View style={s.lista} testID={testID}>
      <View style={s.busca}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          value={busca} onChangeText={setBusca} placeholder="Buscar por nome ou telefone"
          placeholderTextColor={Colors.ink3} style={s.buscaInput as any} testID={testID + "-busca"}
        />
      </View>
      <Pressable onPress={function() { onEscolher(null); }} style={[s.opcao, !atualId && s.opcaoAtiva]} testID={testID + "-nenhum"}>
        <Text style={[s.opcaoNome, { color: Colors.ink3 }]}>{semNome}</Text>
      </Pressable>
      {filtradas.length === 0 && <Text style={s.vazio}>{vazio}</Text>}
      {filtradas.map(function(o) {
        const ativo = atualId === o.id;
        return (
          <Pressable key={o.id} onPress={function() { onEscolher({ id: o.id, name: o.name }); }} style={[s.opcao, ativo && s.opcaoAtiva]} testID={testID + "-" + o.id}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{o.name.split(" ").map(function(n) { return n[0]; }).slice(0, 2).join("").toUpperCase()}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.opcaoNome, ativo && { color: Colors.violet3 }]} numberOfLines={1}>{o.name}</Text>
              {o.subtitle ? <Text style={s.opcaoSub} numberOfLines={1}>{o.subtitle}</Text> : null}
            </View>
            {ativo && <Icon name="check" size={14} color={Colors.violet3} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function EditarVendaModal({
  visible, saleId, companyId, onClose, onPrintReceipt,
}: {
  visible: boolean;
  saleId: string | null;
  /** Empresa DONA da venda (no consolidado multi-CNPJ, a da linha clicada). */
  companyId?: string;
  onClose: () => void;
  onPrintReceipt?: () => void;
}) {
  const { width } = useWindowDimensions();
  const estreito = width < SHEET_NARROW_BP;
  const { context: ctx, isLoading, error, refetch } = useSaleEditContext(visible ? saleId : null, companyId, visible);
  const { previewEdit, applyEdit, isPreviewing, isSaving } = useEditSale(companyId || ctx?.sale.company_id);
  const empresa = companyId || ctx?.sale.company_id || null;

  const { data: empData } = useQuery({
    queryKey: ["employees", empresa],
    queryFn: function() { return employeesApi.list(empresa as string); },
    enabled: visible && !!empresa,
    staleTime: 60_000,
    retry: 1,
  });
  const funcionarios = useMemo(function() {
    const lista: any[] = (empData as any)?.employees || [];
    return lista.filter(function(e) { return e && e.is_active !== false; })
      .map(function(e) { return { id: String(e.id), name: String(e.name || "Sem nome"), subtitle: e.role_title || null }; });
  }, [empData]);
  const { customers } = useCustomers({ sort: "recent" });
  const clientes = useMemo(function() {
    return (customers || []).map(function(c) { return { id: c.id, name: c.name, subtitle: c.phone || c.email || null }; });
  }, [customers]);

  const [passo, setPasso] = useState<Passo>("alterar");
  const [linhas, setLinhas] = useState<LinhaDeForma[]>([]);
  const [dividido, setDividido] = useState(false);
  const [parcelas, setParcelas] = useState(1);
  const [primeira, setPrimeira] = useState<string | null>(null);
  const [primeiraTxt, setPrimeiraTxt] = useState("");
  const [sellerId, setSellerId] = useState<string | null | undefined>(undefined);
  const [cliente, setCliente] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [abertoVend, setAbertoVend] = useState(false);
  const [abertoCli, setAbertoCli] = useState(false);
  const [buscaVend, setBuscaVend] = useState("");
  const [buscaCli, setBuscaCli] = useState("");
  const [plano, setPlano] = useState<SaleEditPlan | null>(null);
  const [erroPlano, setErroPlano] = useState<Erro>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<SaleEditResult | null>(null);
  const [cancelandoNota, setCancelandoNota] = useState(false);
  const [motivoNota, setMotivoNota] = useState("Correção da forma de pagamento ou do cliente da venda");
  const [enviandoNota, setEnviandoNota] = useState(false);
  const iniciado = useRef<string | null>(null);

  // Estado inicial a partir do que a venda tem hoje.
  useEffect(function() {
    if (!visible) { iniciado.current = null; return; }
    if (!ctx || iniciado.current === ctx.sale.id) return;
    iniciado.current = ctx.sale.id;
    const ls = linhasIniciais(ctx.current.payments, ctx.sale.total_amount);
    setLinhas(ls);
    setDividido(ls.length > 1);
    const cred = ctx.current.credit;
    setParcelas(cred ? cred.installments || 1 : 1);
    const p1 = cred && cred.first_due_date ? cred.first_due_date : (ctx.sale.dia ? somarMes(ctx.sale.dia, 1) : null);
    setPrimeira(p1);
    setPrimeiraTxt(ddmmaaaa(p1));
    setSellerId(undefined); setCliente(undefined);
    setPasso("alterar"); setPlano(null); setErroPlano(null); setMotivo(""); setResultado(null);
    setAbertoVend(false); setAbertoCli(false); setBuscaVend(""); setBuscaCli("");
  }, [visible, ctx]);

  const total = ctx ? ctx.sale.total_amount : 0;
  const travaDinheiro = ctx ? ctx.locks.money : null;
  const travaVendedor = ctx ? ctx.locks.seller : null;
  const nota = avisoDaNota(ctx ? ctx.nfce : null);
  const credAtual = ctx ? ctx.current.credit : null;
  const temCrediario = linhas.some(function(l) { return l.method === "crediario"; });
  const crediarioDesligado = !!(ctx && ctx.nfce && !credAtual);
  const soma = conferirSoma(total, linhas);
  const clienteFinal = cliente !== undefined ? cliente : (ctx ? ctx.current.customer : null);
  const faltaCliente = temCrediario && !clienteFinal;

  const { body, mudancas } = useMemo(function() {
    if (!ctx) return { body: {}, mudancas: [] as any[] };
    return montarCorpo(ctx, { sellerId, customer: cliente, linhas, parcelas, primeiraParcela: temCrediario ? primeira : null });
  }, [ctx, sellerId, cliente, linhas, parcelas, primeira, temCrediario]);
  const chave = JSON.stringify(body);
  const valido = mudancas.length > 0 && soma.ok && !faltaCliente;

  // Prévia do servidor a cada mudança (o texto de cada campo vem daqui).
  useEffect(function() {
    if (!visible || !ctx || !saleId || passo !== "alterar") return;
    if (!valido) { setPlano(null); setErroPlano(null); return; }
    let vivo = true;
    const t = setTimeout(function() {
      previewEdit({ saleId: saleId, body: body })
        .then(function(r: any) { if (vivo) { setPlano(r.plan || null); setErroPlano(null); } })
        .catch(function(e: any) { if (vivo) { setPlano(null); setErroPlano(lerErro(e, "Não deu para conferir a mudança agora.")); } });
    }, 400);
    return function() { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, valido, visible, passo, ctx?.sale.id]);

  if (!visible) return null;

  // ── ações ──────────────────────────────────────────────────
  function escolherForma(m: Metodo) {
    setLinhas([{ method: m, valor: valorParaCampo(total) }]);
  }
  function alternarDividido() {
    if (dividido) {
      setLinhas([{ method: (linhas[0] && linhas[0].method) || "dinheiro", valor: valorParaCampo(total) }]);
      setDividido(false);
    } else {
      setDividido(true);
    }
  }
  function mudarLinha(i: number, patch: Partial<LinhaDeForma>) {
    setLinhas(function(prev) { return prev.map(function(l, j) { return j === i ? Object.assign({}, l, patch) : l; }); });
  }
  function adicionarLinha() {
    const usados = new Set(linhas.map(function(l) { return l.method; }));
    const livre = (METODOS.find(function(m) { return !usados.has(m.key) && !(m.key === "crediario" && crediarioDesligado); }) || METODOS[1]).key;
    const resta = soma.ok || !(soma.soma >= 0) ? 0 : Math.max(0, total - soma.soma);
    setLinhas(linhas.concat([{ method: livre, valor: resta > 0 ? valorParaCampo(resta) : "" }]));
  }
  function removerLinha(i: number) {
    const prox = linhas.filter(function(_, j) { return j !== i; });
    // Sobrou uma forma só: ela fica com o total (fora do modo dividido não há
    // campo de valor para corrigir).
    if (prox.length <= 1) {
      setLinhas([{ method: (prox[0] && prox[0].method) || "dinheiro", valor: valorParaCampo(total) }]);
      setDividido(false);
      return;
    }
    setLinhas(prox);
  }
  function mudarPrimeira(txt: string) {
    setPrimeiraTxt(txt);
    const d = lerDia(txt);
    if (d) setPrimeira(d);
  }

  async function continuar() {
    if (!saleId || !valido) return;
    try {
      const r: any = await previewEdit({ saleId: saleId, body: body });
      setPlano(r.plan || null);
      setErroPlano(null);
      setPasso("conferir");
    } catch (e: any) {
      setErroPlano(lerErro(e, "Não deu para conferir a mudança agora."));
    }
  }

  async function salvar() {
    if (!saleId) return;
    try {
      const r = await applyEdit({ saleId: saleId, body: Object.assign({}, body, { reason: motivo.trim() || null }) });
      setConfirmando(false);
      setResultado(r as SaleEditResult);
      setPasso("pronto");
    } catch (e: any) {
      setConfirmando(false);
      const er = lerErro(e, "Não deu para salvar agora. Tente de novo.");
      toast.error((er && er.message) || "Não deu para salvar agora.");
      // A venda pode ter mudado (pagamento de parcela, nota): relê as travas.
      refetch();
      setPasso("alterar");
    }
  }

  function pedirSalvar() {
    if (plano && plano.requires_confirmation) setConfirmando(true);
    else salvar();
  }

  async function cancelarNota() {
    if (!ctx || !ctx.nfce || !empresa) return;
    if (motivoNota.trim().length < 15) { toast.error("A SEFAZ pede um motivo com pelo menos 15 letras."); return; }
    setEnviandoNota(true);
    try {
      await salesApi.cancelNfce(empresa, ctx.nfce.id, motivoNota.trim());
      toast.success("Nota cancelada. Salve a edição e emita a NFC-e de novo no detalhe da venda.");
      setCancelandoNota(false);
      refetch();
    } catch (e: any) {
      toast.error((e && (e.data?.error || e.message)) || "Não deu para cancelar a nota agora.");
    } finally {
      setEnviandoNota(false);
    }
  }

  // ── pedaços ────────────────────────────────────────────────
  const numero = ctx && ctx.sale.sale_number ? " #" + ctx.sale.sale_number : "";
  const subtitulo = ctx ? brl(total) + " · " + fmtDataHora(ctx.sale.created_at) : "";

  // ── campos ─────────────────────────────────────────────────
  function CampoForma() {
    const atual = ctx ? ctx.current.payments : [];
    const mudou = mudancas.indexOf("payments") >= 0;
    return (
      <View style={s.campo} testID="campo-forma">
        <Text style={s.campoTitulo}>Forma de pagamento</Text>
        {travaDinheiro ? (
          <>
            <View style={s.pillsRow}>
              {atual.map(function(p, i) {
                return <View key={i} style={s.eraPill}><Text style={s.eraTxt}>{resumoDasFormas([p])}</Text></View>;
              })}
            </View>
            <Trava texto={travaDinheiro.message} testID="trava-forma" />
          </>
        ) : (
          <>
            {mudou && <Era texto={resumoDasFormas(atual)} />}
            {!dividido && (
              <View style={s.chipsRow}>
                {METODOS.map(function(m) {
                  return (
                    <Chip key={m.key} m={m} testID={"forma-" + m.key} ativo={linhas.length === 1 && linhas[0].method === m.key}
                      desligado={m.key === "crediario" && crediarioDesligado}
                      onPress={function() { escolherForma(m.key); }} />
                  );
                })}
              </View>
            )}
            {crediarioDesligado && (
              <Text style={s.dica}>Crediário fica desligado: a nota já saiu como pagamento à vista.</Text>
            )}
            <Pressable onPress={alternarDividido} style={s.toggle} accessibilityRole="checkbox" accessibilityState={{ checked: dividido }} testID="forma-dividida">
              <View style={[s.check, dividido && s.checkOn]}>{dividido && <Icon name="check" size={11} color="#fff" />}</View>
              <Text style={s.toggleTxt}>Pagou com mais de uma forma</Text>
            </Pressable>
            {dividido && (
              <View style={{ width: "100%", gap: 8 }}>
                {linhas.map(function(l, i) {
                  return (
                    <View key={i} style={s.linha}>
                      <View style={s.chipsRow}>
                        {METODOS.map(function(m) {
                          return (
                            <Chip key={m.key} m={m} testID={"forma-" + i + "-" + m.key} ativo={l.method === m.key}
                              desligado={m.key === "crediario" && crediarioDesligado}
                              onPress={function() { mudarLinha(i, { method: m.key }); }} />
                          );
                        })}
                      </View>
                      <View style={s.valorRow}>
                        <Text style={s.valorPrefix}>R$</Text>
                        <TextInput
                          value={l.valor} onChangeText={function(v) { mudarLinha(i, { valor: v }); }}
                          keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={Colors.ink3}
                          style={s.valorInput as any} testID={"forma-valor-" + i}
                        />
                        {linhas.length > 1 && (
                          <Pressable onPress={function() { removerLinha(i); }} style={s.iconBtn} accessibilityLabel="Tirar esta forma">
                            <Icon name="x" size={14} color={Colors.ink3} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
                <Button title="Outra forma" icon="plus" variant="ghost" size="sm" onPress={adicionarLinha} style={{ alignSelf: "flex-start" }} />
              </View>
            )}
            <View style={s.somaRow}>
              <Text style={s.somaLbl}>Total da venda {brl(total)}</Text>
              <Text style={[s.somaStatus, { color: soma.ok ? Colors.green : Colors.amber }]} testID="forma-soma">{soma.texto}</Text>
            </View>
            {temCrediario && (
              <View style={s.parcelas}>
                <View style={s.parcRow}>
                  <Text style={s.parcLbl}>Parcelas</Text>
                  <View style={s.stepper}>
                    <Pressable onPress={function() { setParcelas(Math.max(1, parcelas - 1)); }} style={s.stepBtn} accessibilityLabel="Menos uma parcela">
                      <Icon name="minus" size={14} color={Colors.ink2} />
                    </Pressable>
                    <Text style={s.stepVal} testID="parcelas">{parcelas}x</Text>
                    <Pressable onPress={function() { setParcelas(Math.min(60, parcelas + 1)); }} style={s.stepBtn} accessibilityLabel="Mais uma parcela">
                      <Icon name="plus" size={14} color={Colors.ink2} />
                    </Pressable>
                  </View>
                </View>
                <View style={s.parcRow}>
                  <Text style={s.parcLbl}>1ª parcela</Text>
                  <TextInput
                    value={primeiraTxt} onChangeText={mudarPrimeira} placeholder="DD/MM/AAAA"
                    placeholderTextColor={Colors.ink3} style={[s.dataInput as any, !lerDia(primeiraTxt) && { borderColor: Colors.amber }]}
                    keyboardType="numbers-and-punctuation" maxLength={10}
                  />
                </View>
                {plano && plano.credit && plano.credit.to && plano.credit.to.schedule.length > 0 && (
                  <View style={s.cronograma}>
                    {plano.credit.to.schedule.map(function(p) {
                      return (
                        <View key={p.installment_number} style={s.cronoRow}>
                          <Text style={s.cronoDia}>{ddmm(p.due_date)}</Text>
                          <Text style={s.cronoVal}>{brl(p.amount_due)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
            {nota && mudou && (
              <Text style={s.dica}>
                A nota fica com {resumoDasFormas(atual)} e a venda passa para {resumoDasFormas(formasAtuais())}.
                {nota.podeCancelar ? " Se a nota precisa sair certa, cancele a nota e emita outra (até " + nota.ate + ")." : " Fale com o seu contador se a nota precisar de ajuste."}
              </Text>
            )}
            <Efeitos lista={efeitosDoCampo(plano, "payments")} />
          </>
        )}
      </View>
    );
  }

  function formasAtuais() {
    return linhas.map(function(l) { return { method: l.method, amount: lerValor(l.valor), installments: l.method === "crediario" ? parcelas : undefined }; })
      .filter(function(p) { return p.amount > 0; });
  }

  function CampoVendedor() {
    const atual = ctx ? ctx.current.seller : null;
    const escolhidoId = sellerId !== undefined ? sellerId : (atual && atual.id) || null;
    const escolhidoNome = sellerId !== undefined
      ? (sellerId ? ((funcionarios.find(function(f) { return f.id === sellerId; }) || { name: "Vendedor(a)" }).name) : null)
      : (atual && atual.name) || null;
    const mudou = mudancas.indexOf("seller") >= 0;
    return (
      <View style={s.campo} testID="campo-vendedor">
        <View style={s.campoHead}>
          <Text style={s.campoTitulo}>Vendedor(a)</Text>
          {ctx && ctx.nfce ? <Text style={s.campoNota}>Não está na nota</Text> : null}
        </View>
        {mudou && <Era texto={(atual && atual.name) || "Sem vendedor(a)"} />}
        <View style={s.valorAtualRow}>
          <Text style={s.valorAtual} numberOfLines={1}>{escolhidoNome || "Sem vendedor(a)"}</Text>
          {!travaVendedor && (
            <Button title={abertoVend ? "Fechar" : "Trocar"} size="sm" variant="secondary" onPress={function() { setAbertoVend(!abertoVend); }} />
          )}
        </View>
        {travaVendedor && <Trava texto={travaVendedor.message} />}
        {abertoVend && !travaVendedor && (
          <Lista
            opcoes={funcionarios} busca={buscaVend} setBusca={setBuscaVend} testID="lista-vendedores"
            vazio="Nenhum funcionário encontrado." semNome="Sem vendedor(a)" atualId={escolhidoId}
            onEscolher={function(o) { setSellerId(o ? o.id : null); setAbertoVend(false); setBuscaVend(""); }}
          />
        )}
        <Efeitos lista={efeitosDoCampo(plano, "seller")} />
      </View>
    );
  }

  function CampoCliente() {
    const atual = ctx ? ctx.current.customer : null;
    const mudou = mudancas.indexOf("customer") >= 0;
    const destaque = faltaCliente && !travaDinheiro;
    return (
      <View style={[s.campo, destaque && s.campoDestaque]} testID="campo-cliente">
        <Text style={s.campoTitulo}>Cliente</Text>
        {travaDinheiro ? (
          <>
            <Text style={s.valorAtual}>{(atual && atual.name) || "Sem cliente"}</Text>
            {credAtual && credAtual.paid
              ? <Trava texto="A dívida e os pagamentos estão no nome desta cliente, por isso ela não pode ser trocada." />
              : null}
          </>
        ) : (
          <>
            {mudou && <Era texto={(atual && atual.name) || "Sem cliente"} />}
            <View style={s.valorAtualRow}>
              <Text style={s.valorAtual} numberOfLines={1}>{(clienteFinal && clienteFinal.name) || "Sem cliente"}</Text>
              <Button title={abertoCli ? "Fechar" : "Trocar"} size="sm" variant="secondary" onPress={function() { setAbertoCli(!abertoCli); }} />
            </View>
            {destaque && <Text style={[s.dica, { color: Colors.amber }]} testID="falta-cliente">Escolha a cliente para lançar no crediário.</Text>}
            {abertoCli && (
              <Lista
                opcoes={clientes} busca={buscaCli} setBusca={setBuscaCli} testID="lista-clientes"
                vazio="Nenhum cliente encontrado." semNome="Sem cliente" atualId={(clienteFinal && clienteFinal.id) || null}
                onEscolher={function(o) { setCliente(o); setAbertoCli(false); setBuscaCli(""); }}
              />
            )}
            <Efeitos lista={efeitosDoCampo(plano, "customer")} />
          </>
        )}
      </View>
    );
  }

  function AvisoNota() {
    if (!nota) return null;
    return (
      <View style={s.notaBox} testID="aviso-nfce">
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Icon name="file_text" size={14} color={Colors.amber} />
          <Text style={s.notaTxt}>{nota.texto}</Text>
        </View>
        {nota.podeCancelar ? (
          cancelandoNota ? (
            <View style={{ gap: 8, width: "100%" }}>
              <Text style={s.dica}>Motivo para a SEFAZ (pelo menos 15 letras):</Text>
              <TextInput value={motivoNota} onChangeText={setMotivoNota} style={s.motivoInput as any} multiline maxLength={255} />
              <View style={s.botoesRow}>
                <Button title="Voltar" variant="ghost" size="sm" onPress={function() { setCancelandoNota(false); }} />
                <Button title="Cancelar a nota" variant="danger" size="sm" loading={enviandoNota} onPress={cancelarNota} />
              </View>
            </View>
          ) : (
            <Button title={"Cancelar a nota e emitir outra (até " + nota.ate + ")"} icon="file_text" variant="secondary" size="sm"
              onPress={function() { setCancelandoNota(true); }} style={{ alignSelf: "flex-start" }} />
          )
        ) : (
          <Text style={s.dica}>Passou o prazo de 30 min para cancelar a nota. Fale com o seu contador se a nota precisar de ajuste.</Text>
        )}
      </View>
    );
  }

  function PassoConferir() {
    if (!plano) return null;
    const linhasTabela: { rot: string; antes: string; depois: string }[] = [];
    if (plano.changes.indexOf("payments") >= 0) linhasTabela.push({ rot: "Forma", antes: resumoDasFormas(plano.before.payments), depois: resumoDasFormas(plano.after.payments) });
    if (plano.changes.indexOf("seller") >= 0) linhasTabela.push({ rot: "Vendedor(a)", antes: (plano.before.seller && plano.before.seller.name) || "Sem vendedor(a)", depois: (plano.after.seller && plano.after.seller.name) || "Sem vendedor(a)" });
    if (plano.changes.indexOf("customer") >= 0) linhasTabela.push({ rot: "Cliente", antes: (plano.before.customer && plano.before.customer.name) || "Sem cliente", depois: (plano.after.customer && plano.after.customer.name) || "Sem cliente" });
    return (
      <View style={{ gap: 14, width: "100%" }} testID="passo-conferir">
        <View style={s.tabela}>
          <View style={[s.tabRow, s.tabHead]}>
            <Text style={[s.tabRot, s.tabHeadTxt]}> </Text>
            <Text style={[s.tabCel, s.tabHeadTxt]}>Antes</Text>
            <Text style={[s.tabCel, s.tabHeadTxt]}>Depois</Text>
          </View>
          {linhasTabela.map(function(l) {
            return (
              <View key={l.rot} style={s.tabRow}>
                <Text style={s.tabRot}>{l.rot}</Text>
                <Text style={[s.tabCel, { color: Colors.ink3 }]}>{l.antes}</Text>
                <Text style={[s.tabCel, { color: Colors.ink, fontWeight: "700" }]}>{l.depois}</Text>
              </View>
            );
          })}
        </View>
        <Text style={s.secao}>O que vai acontecer</Text>
        <View style={{ gap: 6 }}>
          {plano.effects.map(function(e, i) {
            return (
              <View key={e.code + i} style={s.efeito}>
                <Icon name="check" size={13} color={Colors.green} />
                <Text style={s.efeitoTxt}>{e.text}</Text>
              </View>
            );
          })}
        </View>
        {plano.warnings.length > 0 && (
          <View style={{ gap: 6 }}>
            {plano.warnings.map(function(w, i) {
              return (
                <View key={w.code + i} style={[s.efeito, s.efeitoAviso]}>
                  <Icon name="alert_circle" size={13} color={Colors.amber} />
                  <Text style={[s.efeitoTxt, { color: Colors.ink }]}>{w.text}</Text>
                </View>
              );
            })}
          </View>
        )}
        <Text style={s.secao}>Motivo (opcional)</Text>
        <TextInput
          value={motivo} onChangeText={setMotivo} multiline maxLength={500}
          placeholder="Ex.: a cliente pediu para pagar no carnê" placeholderTextColor={Colors.ink3}
          style={s.motivoInput as any} testID="motivo"
        />
        <Text style={s.dica}>Fica registrado quem alterou e quando.</Text>
      </View>
    );
  }

  function PassoPronto() {
    const r = resultado;
    const cred = r && r.result && r.result.credit;
    const parc = cred && cred.installments && cred.installments.length ? cred.installments : [];
    const cli = r && r.plan && r.plan.after.customer;
    return (
      <View style={s.pronto} testID="passo-pronto">
        <View style={s.prontoIco}><Icon name="check" size={26} color={Colors.green} /></View>
        <Text style={s.prontoTitulo}>Venda{numero} atualizada</Text>
        <Text style={s.prontoTxt}>Financeiro, caixa, crediário e comissão já mostram os dados novos.</Text>
        {cred && (
          <Text style={s.prontoTxt}>
            {"Carnê “" + (cred.account_name || "Compra") + "” criado para " + ((cli && cli.name) || "a cliente")}
            {parc.length ? ": " + parc.length + " × " + brl(parc[parc.length - 1].amount_due) + ", a primeira em " + ddmm(parc[0].due_date) + "." : "."}
          </Text>
        )}
      </View>
    );
  }

  // ── corpo ──────────────────────────────────────────────────
  const travadaInteira = ctx && !ctx.editable;

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} onBackdropPress={passo === "alterar" && mudancas.length === 0 ? onClose : function() {}} maxWidth={560}>
      <View style={s.header}>
        <View style={s.headerIco}><Icon name="edit" size={16} color={Colors.violet3} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={s.headerTitulo} numberOfLines={1}>{passo === "pronto" ? "Pronto" : "Editar venda" + numero}</Text>
            {ctx && ctx.nfce && passo !== "pronto" ? (
              <View style={s.selo}><Text style={s.seloTxt}>NFC-e {ctx.nfce.numero || ""}</Text></View>
            ) : null}
          </View>
          <Text style={s.headerSub} numberOfLines={1}>{passo === "conferir" ? "Confira antes de salvar" : subtitulo}</Text>
        </View>
        <Pressable onPress={onClose} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Fechar" testID="editar-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      {passo !== "pronto" && !travadaInteira && ctx && (
        <View style={s.stepBar}>
          {(["alterar", "conferir"] as Passo[]).map(function(p, idx) {
            const ativo = passo === p;
            const feito = passo === "conferir" && p === "alterar";
            return (
              <View key={p} style={s.stepItem}>
                <View style={[s.stepDot, feito && s.stepDotFeito, ativo && s.stepDotAtivo]}>
                  {feito ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{idx + 1}</Text>}
                </View>
                <Text style={[s.stepLbl, ativo && { color: Colors.violet3, fontWeight: "700" }]}>{p === "alterar" ? "Alterar" : "Conferir"}</Text>
                {idx === 0 && <View style={s.stepSep} />}
              </View>
            );
          })}
        </View>
      )}

      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {isLoading && (
          <View style={s.carregando}><ActivityIndicator color={Colors.violet3} /><Text style={s.dica}>Carregando a venda...</Text></View>
        )}
        {error && !isLoading && (
          <Trava texto={(error && (error.data?.error || error.message)) || "Não deu para abrir a edição agora."} />
        )}
        {ctx && travadaInteira && ctx.locked && <Trava texto={ctx.locked.message} testID="trava-venda" />}
        {ctx && !travadaInteira && passo === "alterar" && (
          <View style={{ gap: 12, width: "100%" }}>
            {AvisoNota()}
            {CampoForma()}
            {CampoVendedor()}
            {CampoCliente()}
            {erroPlano && (
              <View style={s.trava} testID="erro-plano">
                <Icon name="alert_circle" size={13} color={Colors.red} />
                <Text style={[s.travaTxt, { color: Colors.red }]}>{erroPlano.message}</Text>
              </View>
            )}
          </View>
        )}
        {ctx && passo === "conferir" && PassoConferir()}
        {passo === "pronto" && PassoPronto()}
      </ScrollView>

      <View style={[s.footer, estreito && s.footerEstreito]}>
        {passo === "alterar" && (
          <>
            <Text style={[s.footerInfo, estreito && { textAlign: "center" }]} numberOfLines={1} testID="resumo-mudancas">
              {travaDinheiro && !travaVendedor && mudancas.length === 0 ? "Só o vendedor(a) pode mudar" : rotuloDasMudancas(mudancas)}
              {isPreviewing ? " · conferindo..." : ""}
            </Text>
            <View style={[s.footerBotoes, estreito && { width: "100%" }]}>
              <Button title="Cancelar" variant="ghost" onPress={onClose} full={estreito} />
              {!travadaInteira && (
                <Button title="Continuar →" variant="primary" onPress={continuar} full={estreito}
                  disabled={!valido || !!erroPlano} loading={isPreviewing && !plano} />
              )}
            </View>
          </>
        )}
        {passo === "conferir" && (
          <View style={[s.footerBotoes, { marginLeft: "auto" } as any, estreito && { width: "100%" }]}>
            <Button title="← Voltar" variant="ghost" onPress={function() { setPasso("alterar"); }} full={estreito} />
            <Button title="Salvar alterações" variant="primary" icon="check" onPress={pedirSalvar} loading={isSaving} full={estreito} />
          </View>
        )}
        {passo === "pronto" && (
          <View style={[s.footerBotoes, { marginLeft: "auto" } as any, estreito && { width: "100%" }]}>
            {onPrintReceipt && <Button title="Imprimir recibo" icon="print" variant="secondary" onPress={onPrintReceipt} full={estreito} />}
            <Button title="Voltar à venda" variant="primary" onPress={onClose} full={estreito} />
          </View>
        )}
      </View>

      {/* 3d · confirmação só ao entrar ou sair do crediário */}
      <ResponsiveSheet visible={confirmando} onClose={function() { setConfirmando(false); }} maxWidth={420}>
        <View style={s.confirma} testID="confirmar-crediario">
          <View style={s.confirmaIco}><Icon name="calendar" size={20} color={Colors.violet3} /></View>
          <Text style={s.confirmaTitulo}>{(plano && plano.confirmation && plano.confirmation.title) || "Confirmar?"}</Text>
          <Text style={s.confirmaTxt}>{plano && plano.confirmation ? plano.confirmation.text : ""}</Text>
          <View style={[s.botoesRow, { width: "100%" }]}>
            <Button title="Voltar" variant="ghost" onPress={function() { setConfirmando(false); }} full />
            <Button title={(plano && plano.confirmation && plano.confirmation.confirm_label) || "Confirmar"} variant="primary" onPress={salvar} loading={isSaving} full />
          </View>
        </View>
      </ResponsiveSheet>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  headerTitulo: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  selo: { backgroundColor: Colors.amberD, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.amber },
  seloTxt: { fontSize: 10, color: Colors.amber, fontWeight: "700" },

  stepBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg4, gap: 6 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  stepDotAtivo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotFeito: { backgroundColor: Colors.green, borderColor: Colors.green },
  stepDotTxt: { fontSize: 11, fontWeight: "700", color: Colors.ink3 },
  stepLbl: { fontSize: 12.5, color: Colors.ink3, fontWeight: "500" },
  stepSep: { width: 28, height: 1.5, backgroundColor: Colors.border2, marginHorizontal: 4 },

  body: { padding: 16, gap: 12 },
  carregando: { paddingVertical: 40, alignItems: "center", gap: 10 },

  campo: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10 },
  campoDestaque: { borderColor: Colors.amber },
  campoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  campoTitulo: { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  campoNota: { fontSize: 11, color: Colors.ink3 },
  eraRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eraLbl: { fontSize: 12, color: Colors.ink3 },
  eraPill: { backgroundColor: Colors.bg3, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 4, maxWidth: "100%" },
  eraTxt: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, width: "100%" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  chipAtivo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 13, color: Colors.ink2, fontWeight: "600" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3 },
  checkOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  toggleTxt: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  linha: { width: "100%", gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  valorRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  valorPrefix: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  valorInput: { flex: 1, minWidth: 0, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, color: Colors.ink, paddingHorizontal: 12, fontSize: 14, fontWeight: "700" },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  somaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6, width: "100%" },
  somaLbl: { fontSize: 12.5, color: Colors.ink2 },
  somaStatus: { fontSize: 12.5, fontWeight: "700" },
  parcelas: { width: "100%", gap: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  parcRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  parcLbl: { fontSize: 13, color: Colors.ink2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  stepVal: { minWidth: 36, textAlign: "center", fontSize: 14, color: Colors.ink, fontWeight: "700" },
  dataInput: { width: 130, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, color: Colors.ink, paddingHorizontal: 10, fontSize: 13 },
  cronograma: { gap: 4, width: "100%" },
  cronoRow: { flexDirection: "row", justifyContent: "space-between" },
  cronoDia: { fontSize: 12, color: Colors.ink3 },
  cronoVal: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  valorAtualRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" },
  valorAtual: { flex: 1, minWidth: 0, fontSize: 14, color: Colors.ink, fontWeight: "600" },

  lista: { width: "100%", gap: 4 },
  busca: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, paddingHorizontal: 10, marginBottom: 4 },
  buscaInput: { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink, height: 38 },
  opcao: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  opcaoAtiva: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  opcaoNome: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  opcaoSub: { fontSize: 11, color: Colors.ink3 },
  avatar: { width: 28, height: 28, borderRadius: 999, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },
  vazio: { fontSize: 12, color: Colors.ink3, padding: 10 },

  efeitos: { gap: 6, width: "100%" },
  efeito: { flexDirection: "row", gap: 8, alignItems: "flex-start", width: "100%" },
  efeitoAviso: { padding: 8, borderRadius: 8, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber },
  efeitoTxt: { flex: 1, fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  trava: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber, width: "100%" },
  travaTxt: { flex: 1, fontSize: 12.5, color: Colors.ink, lineHeight: 18 },
  dica: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  notaBox: { width: "100%", gap: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber },
  notaTxt: { flex: 1, fontSize: 12.5, color: Colors.ink, lineHeight: 18 },

  tabela: { width: "100%", borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  tabRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 9, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  tabHead: { borderTopWidth: 0, backgroundColor: Colors.bg4 },
  tabHeadTxt: { fontSize: 10.5, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  tabRot: { width: 84, fontSize: 12, color: Colors.ink3 },
  tabCel: { flex: 1, minWidth: 0, fontSize: 12.5 },
  secao: { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  motivoInput: { width: "100%", minHeight: 64, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, color: Colors.ink, padding: 10, fontSize: 13, textAlignVertical: "top" },

  pronto: { alignItems: "center", gap: 10, paddingVertical: 20, width: "100%" },
  prontoIco: { width: 56, height: 56, borderRadius: 999, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  prontoTitulo: { fontSize: 18, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  prontoTxt: { fontSize: 13, color: Colors.ink2, textAlign: "center", lineHeight: 19 },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
  footerEstreito: { flexDirection: "column", alignItems: "stretch" },
  footerInfo: { flex: 1, minWidth: 0, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerBotoes: { flexDirection: "row", gap: 8, alignItems: "center" },
  botoesRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },

  confirma: { padding: 20, gap: 10, alignItems: "center" },
  confirmaIco: { width: 44, height: 44, borderRadius: 999, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  confirmaTitulo: { fontSize: 17, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  confirmaTxt: { fontSize: 13, color: Colors.ink2, lineHeight: 19, textAlign: "center", marginBottom: 6 },
});

export default EditarVendaModal;
