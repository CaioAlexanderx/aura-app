// ============================================================
// Gestão Aura › Hoje › Receita › Extrato bancário (13/10/2026)
//
// Concilia o extrato OFX da conta da Aura com o que a Asaas repassou
// (Aura-backend #810, /admin/painel/ofx). Três partes:
//   1. anexar o OFX do mês (web) — o arquivo vai em JSON;
//   2. tabela por mês: Asaas × banco × diferença × situação;
//   3. detalhe do extrato (modal): lançamentos com conciliar (escolhendo o
//      pagamento da Asaas), ignorar e reabrir, e apagar o extrato.
//
// Só aparece no bloco Receita expandido (BlocoCard). O backend manda a
// mesma lista "Conferência com o extrato" no bloco; aqui ela vira esta
// tabela, que abre o detalhe.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { adminApi } from "@/services/adminApi";
import type { OfxExtratoDetalhe, OfxLancamento, OfxMes, OfxPagamentoDisponivel } from "@/services/adminApi";
import { brl, dataCurta } from "./adaptadores";
import { CaixaInsight, Indicadores, Pill } from "./BlocoCard";
import { PainelModal } from "./PainelModais";
import { Paleta } from "./paleta";
import { escolherArquivoOfx, lerOfxDisponivel } from "./arquivoOfx";
import type { Indicador } from "./tipos";

var CHAVE = "admin-painel-ofx";
// Depois de mexer no extrato, o bloco Receita (lista de conferência) muda.
var CHAVE_BLOCO = "admin-painel-bloco";

var MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// "2026-10" → "Out/2026"
export function rotuloDoMes(mes: string): string {
  var m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  return MESES[Number(m[2]) - 1] + "/" + m[1];
}

// Soma n meses a "YYYY-MM" (n pode ser negativo).
export function somarMeses(mes: string, n: number): string {
  var m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  var total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  var ano = Math.floor(total / 12);
  var mm = (total % 12) + 1;
  return ano + "-" + (mm < 10 ? "0" + mm : String(mm));
}

// O extrato que se anexa é o do mês que fechou.
export function mesAnteriorBrt(agora?: Date): string {
  var d = agora || new Date(Date.now());
  var partes: Record<string, string> = {};
  new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" })
    .formatToParts(d).forEach(function(p) { partes[p.type] = p.value; });
  return somarMeses(partes.year + "-" + partes.month, -1);
}

export function mensagemDoErro(err: any, acao: string): string {
  var status = err && err.status;
  var code = err && err.data && err.data.code;
  if (status === 503 || code === "MIGRATION_PENDING") {
    return "A conciliação de extrato ainda não está disponível no servidor (migration pendente). Tente de novo em instantes.";
  }
  if (status === 409) return "Esse pagamento já foi casado com outro crédito. A lista foi atualizada: escolha outro.";
  if (status === 422) return "O arquivo não tem nenhuma transação. Confira se é o OFX do extrato.";
  if (status === 404) return "Extrato ou lançamento não encontrado. Atualize a tela.";
  if (err && err.isNetworkError) return "Sem conexão com o servidor. Tente de novo.";
  if (status === 400 && err.message) return err.message;
  return "Não consegui " + acao + ". Tente de novo.";
}

function tomDoStatus(status: string): "sobe" | "alerta" | "mudo" {
  if (status === "conciliado") return "sobe";
  if (status === "pendências") return "alerta";
  return "mudo";
}

// ── Seção do bloco ──────────────────────────────────────────

export function ExtratoBancario() {
  var qc = useQueryClient();
  var q = useQuery({
    queryKey: [CHAVE, "extratos"],
    queryFn: function() { return adminApi.painel.ofx.extratos(6); },
    staleTime: 30_000,
    retry: false,
  });
  var [mes, setMes] = useState<string>(function() { return mesAnteriorBrt(); });
  var [enviando, setEnviando] = useState(false);
  var [aviso, setAviso] = useState<{ tom: "neutro" | "alerta" | "risco"; texto: string } | null>(null);
  var [aberto, setAberto] = useState<{ mes: OfxMes; extratoId: string } | null>(null);

  function recarregar() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVE] }),
      qc.invalidateQueries({ queryKey: [CHAVE_BLOCO] }),
    ]);
  }

  async function anexar() {
    var arquivo;
    try { arquivo = await escolherArquivoOfx(); }
    catch (e: any) { setAviso({ tom: "risco", texto: e && e.message ? e.message : "Não consegui ler o arquivo." }); return; }
    if (!arquivo) return;
    setEnviando(true);
    setAviso(null);
    try {
      var r = await adminApi.painel.ofx.importar({ ofx_content: arquivo.texto, mes: mes, nome_arquivo: arquivo.nome });
      if (r.duplicado) {
        setAviso({ tom: "alerta", texto: "Esse arquivo já tinha sido importado em " + rotuloDoMes(mes) + " (" + (r.duplicados || 0) + " lançamentos repetidos). Nada mudou." });
      } else {
        var partes = [
          (r.importados || 0) + " lançamentos importados",
          (r.conciliados || 0) + " conciliados" + (r.com_taxa ? " (" + r.com_taxa + " com taxa)" : ""),
          (r.pendentes || 0) + (r.pendentes === 1 ? " pendente" : " pendentes"),
        ];
        if (r.duplicados) partes.push(r.duplicados + " já existiam");
        setAviso({ tom: r.pendentes ? "alerta" : "neutro", texto: "**" + arquivo.nome + "**: " + partes.join(" · ") + "." });
        toast.success("Extrato importado.");
      }
      await recarregar();
    } catch (e: any) {
      setAviso({ tom: "risco", texto: mensagemDoErro(e, "importar o extrato") });
    } finally { setEnviando(false); }
  }

  var meses = q.data ? q.data.meses : [];
  var podeAnexar = lerOfxDisponivel();

  return (
    <View testID="ofx-secao" style={s.secao}>
      <View style={s.cab}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rotulo}>Extrato bancário</Text>
          <Text style={s.nota}>Confere o que a Asaas repassou com o que entrou na conta. Anexe o OFX do mês.</Text>
        </View>
      </View>

      <View style={s.anexar}>
        <View style={s.seletor}>
          <Pressable testID="ofx-mes-anterior" onPress={function() { setMes(somarMeses(mes, -1)); }} accessibilityRole="button" accessibilityLabel="Mês anterior" style={s.seta}>
            <Icon name="chevron_left" size={14} color={Colors.ink2} />
          </Pressable>
          <Text testID="ofx-mes-escolhido" style={s.seletorMes}>{rotuloDoMes(mes)}</Text>
          <Pressable testID="ofx-mes-seguinte" onPress={function() { setMes(somarMeses(mes, 1)); }} accessibilityRole="button" accessibilityLabel="Próximo mês" style={s.seta}>
            <Icon name="chevron_right" size={14} color={Colors.ink2} />
          </Pressable>
        </View>
        <Pressable
          testID="ofx-anexar"
          onPress={anexar}
          disabled={enviando || !podeAnexar}
          accessibilityRole="button"
          style={[s.btnPrimario, (enviando || !podeAnexar) && { opacity: 0.6 }]}
        >
          {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="upload" size={13} color="#fff" />}
          <Text style={s.btnPrimarioText}>{enviando ? "Importando…" : "Anexar extrato OFX"}</Text>
        </Pressable>
        {!podeAnexar ? <Text style={s.nota}>Disponível na versão web.</Text> : null}
      </View>

      {aviso ? <View testID="ofx-aviso"><CaixaInsight insight={aviso} /></View> : null}

      {q.isLoading ? <ActivityIndicator testID="ofx-carregando" color={Colors.violet3} /> : null}
      {q.isError ? (
        <View testID="ofx-erro" style={{ gap: 8, alignItems: "flex-start" }}>
          <CaixaInsight insight={{ tom: "risco", texto: mensagemDoErro(q.error, "carregar os extratos") }} />
          <Pressable testID="ofx-tentar-de-novo" onPress={function() { q.refetch(); }} accessibilityRole="button" style={s.btn}>
            <Text style={s.btnText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : null}

      {q.data && meses.length === 0 ? <Text style={s.nota}>Nenhum mês para conferir ainda.</Text> : null}
      {meses.length > 0 ? <TabelaDeMeses meses={meses} onAbrir={function(m) {
        if (!m.extratos.length) return;
        setAberto({ mes: m, extratoId: m.extratos[0].id });
      }} /> : null}

      <ExtratoDetalheModal
        aberto={aberto}
        onTrocar={function(extratoId) { setAberto(aberto ? { mes: aberto.mes, extratoId: extratoId } : null); }}
        onClose={function() { setAberto(null); }}
        onMudou={recarregar}
      />
    </View>
  );
}

function TabelaDeMeses(props: { meses: OfxMes[]; onAbrir: (m: OfxMes) => void }) {
  return (
    <View style={s.tabela}>
      <View style={[s.tr, s.trHead]}>
        <Text style={[s.th, { flex: 1.1 }]}>Mês</Text>
        <Text style={[s.th, s.dir]}>Asaas</Text>
        <Text style={[s.th, s.dir]}>Banco</Text>
        <Text style={[s.th, s.dir]}>Diferença</Text>
        <Text style={[s.th, { flex: 1.2 }]}>Situação</Text>
      </View>
      {props.meses.map(function(m, i) {
        var temExtrato = m.extratos.length > 0;
        var dif = m.diferenca;
        var difTexto = dif == null ? "—" : Math.abs(dif) < 0.005 ? brl(0, true) : (dif > 0 ? "+" : "-") + brl(Math.abs(dif), true);
        return (
          <Pressable
            key={m.mes}
            testID={"ofx-mes-" + m.mes}
            disabled={!temExtrato}
            onPress={function() { props.onAbrir(m); }}
            accessibilityRole={temExtrato ? "button" : undefined}
            accessibilityLabel={temExtrato ? "Abrir extrato de " + m.rotulo : undefined}
            style={[s.tr, i === props.meses.length - 1 && { borderBottomWidth: 0 }]}
          >
            <Text style={[s.td, s.tdMes, { flex: 1.1 }]} numberOfLines={1}>{m.rotulo}</Text>
            <Text style={[s.td, s.dir]} numberOfLines={1}>{brl(m.asaas, true)}</Text>
            <Text style={[s.td, s.dir]} numberOfLines={1}>{m.banco == null ? "—" : brl(m.banco, true)}</Text>
            <Text style={[s.td, s.dir, dif != null && Math.abs(dif) >= 0.005 ? { color: Colors.amber, fontWeight: "600" } : null]} numberOfLines={1}>{difTexto}</Text>
            <View style={{ flex: 1.2, alignItems: "flex-start" }}>
              <Pill variacao={{ texto: m.status, tom: tomDoStatus(m.status) }} />
              {m.detalhe ? <Text style={s.detalhe} numberOfLines={2}>{m.detalhe}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Detalhe do extrato ──────────────────────────────────────

function ordenarPagamentos(lista: OfxPagamentoDisponivel[], l: OfxLancamento): OfxPagamentoDisponivel[] {
  var alvo = new Date(l.data + "T12:00:00").getTime();
  function distancia(p: OfxPagamentoDisponivel): number {
    var t = new Date(String(p.data).slice(0, 10) + "T12:00:00").getTime();
    return isNaN(t) || isNaN(alvo) ? 9e15 : Math.abs(t - alvo);
  }
  return lista.slice().sort(function(a, b) {
    var ea = Math.abs(a.valor - l.valor) < 0.005 || (a.liquido != null && Math.abs(a.liquido - l.valor) < 0.005) ? 0 : 1;
    var eb = Math.abs(b.valor - l.valor) < 0.005 || (b.liquido != null && Math.abs(b.liquido - l.valor) < 0.005) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return distancia(a) - distancia(b);
  });
}

function ExtratoDetalheModal(props: {
  aberto: { mes: OfxMes; extratoId: string } | null;
  onTrocar: (extratoId: string) => void;
  onClose: () => void;
  onMudou: () => Promise<unknown>;
}) {
  var qc = useQueryClient();
  var id = props.aberto ? props.aberto.extratoId : null;
  var q = useQuery<OfxExtratoDetalhe>({
    queryKey: [CHAVE, "detalhe", id],
    queryFn: function() { return adminApi.painel.ofx.detalhe(id as string); },
    enabled: !!id,
    staleTime: 0,
    retry: false,
  });
  var [conciliando, setConciliando] = useState<string | null>(null);
  var [ocupado, setOcupado] = useState<string | null>(null);
  var [erro, setErro] = useState<string | null>(null);
  var [confirmandoApagar, setConfirmandoApagar] = useState(false);
  var [apagando, setApagando] = useState(false);

  function fechar() {
    setConciliando(null); setErro(null); setConfirmandoApagar(false);
    props.onClose();
  }

  async function agir(lid: string, chamada: () => Promise<unknown>, ok: string, acao: string) {
    setOcupado(lid); setErro(null);
    try {
      await chamada();
      setConciliando(null);
      toast.success(ok);
    } catch (e: any) {
      setErro(mensagemDoErro(e, acao));
    } finally {
      // Mesmo com erro (409), a lista pode ter mudado: recarrega.
      await Promise.all([qc.invalidateQueries({ queryKey: [CHAVE, "detalhe", id] }), props.onMudou()]);
      setOcupado(null);
    }
  }

  async function apagar() {
    if (!id) return;
    setApagando(true); setErro(null);
    try {
      var r = await adminApi.painel.ofx.apagar(id);
      toast.success("Extrato apagado (" + (r.lancamentos_removidos || 0) + " lançamentos).");
      setConfirmandoApagar(false);
      props.onClose();
      await props.onMudou();
    } catch (e: any) {
      setErro(mensagemDoErro(e, "apagar o extrato"));
    } finally { setApagando(false); }
  }

  var d = q.data;
  var mesInfo = props.aberto ? props.aberto.mes : null;
  var titulo = mesInfo ? "Extrato de " + mesInfo.rotulo : "Extrato";
  var resumo: Indicador[] = d ? [
    { rotulo: "Créditos", valor: String(d.resumo.creditos), nota: brl(d.resumo.total_creditos, true) },
    { rotulo: "Conciliados", valor: String(d.resumo.conciliados.n), nota: brl(d.resumo.conciliados.valor, true) + (d.resumo.conciliados.com_taxa ? " · " + d.resumo.conciliados.com_taxa + " com taxa" : "") },
    { rotulo: "Pendentes", valor: String(d.resumo.pendentes.n), nota: brl(d.resumo.pendentes.valor, true), tom: d.resumo.pendentes.n > 0 ? "alerta" : undefined },
    { rotulo: "Ignorados", valor: String(d.resumo.ignorados.n), nota: brl(d.resumo.ignorados.valor, true) },
  ] : [];

  return (
    <PainelModal
      visible={!!props.aberto}
      id="ofx-detalhe-modal"
      titulo={titulo}
      subtitulo={d && d.extrato.nome_arquivo ? d.extrato.nome_arquivo : undefined}
      onClose={fechar}
      rodape={d ? (
        <>
          <Text style={s.nota}>{d.lancamentos.length} lançamentos</Text>
          <View style={s.acoes}>
            <Pressable testID="ofx-apagar" onPress={function() { setConfirmandoApagar(true); }} accessibilityRole="button" style={s.btnPerigo}>
              <Icon name="trash" size={12} color={Colors.red} />
              <Text style={[s.btnText, { color: Colors.red }]}>Apagar extrato</Text>
            </Pressable>
            <Pressable testID="ofx-fechar" onPress={fechar} accessibilityRole="button" style={s.btn}>
              <Text style={s.btnText}>Fechar</Text>
            </Pressable>
          </View>
        </>
      ) : undefined}
    >
      {mesInfo && mesInfo.extratos.length > 1 ? (
        <View style={s.chips} testID="ofx-extratos-do-mes">
          {mesInfo.extratos.map(function(e) {
            var on = e.id === id;
            return (
              <Pressable key={e.id} testID={"ofx-extrato-" + e.id} onPress={function() { props.onTrocar(e.id); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, on && { color: "#fff" }]} numberOfLines={1}>{e.nome_arquivo || "Extrato " + e.id}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {q.isLoading ? <ActivityIndicator testID="ofx-detalhe-carregando" color={Colors.violet3} /> : null}
      {q.isError && !d ? (
        <View testID="ofx-detalhe-erro" style={{ gap: 8, alignItems: "flex-start" }}>
          <CaixaInsight insight={{ tom: "risco", texto: mensagemDoErro(q.error, "carregar o extrato") }} />
          <Pressable testID="ofx-detalhe-tentar-de-novo" onPress={function() { q.refetch(); }} accessibilityRole="button" style={s.btn}>
            <Text style={s.btnText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : null}

      {erro ? <View testID="ofx-detalhe-aviso"><CaixaInsight insight={{ tom: "risco", texto: erro }} /></View> : null}

      {confirmandoApagar && d ? (
        <View testID="ofx-apagar-confirmacao" style={s.confirma}>
          <Text style={s.confirmaTitulo}>Apagar este extrato?</Text>
          <Text style={s.nota}>
            Os {d.lancamentos.length} lançamentos saem junto e os pagamentos já conciliados voltam a ficar livres. Dá para anexar o arquivo de novo depois.
          </Text>
          <View style={s.acoes}>
            <Pressable testID="ofx-apagar-cancelar" onPress={function() { setConfirmandoApagar(false); }} disabled={apagando} accessibilityRole="button" style={s.btn}>
              <Text style={s.btnText}>Cancelar</Text>
            </Pressable>
            <Pressable testID="ofx-apagar-confirmar" onPress={apagar} disabled={apagando} accessibilityRole="button" style={[s.btnVermelho, apagando && { opacity: 0.6 }]}>
              <Text style={s.btnPrimarioText}>{apagando ? "Apagando…" : "Apagar extrato"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {d ? (
        <>
          <Indicadores itens={resumo} />
          <View style={s.lista}>
            {d.lancamentos.length === 0 ? <Text style={s.nota}>Este extrato não tem lançamentos.</Text> : null}
            {d.lancamentos.map(function(l, i) {
              var credito = l.valor > 0 && l.tipo !== "debito";
              var emConciliacao = conciliando === l.id;
              var trabalhando = ocupado === l.id;
              var tom: "sobe" | "alerta" | "mudo" = l.status === "conciliado" ? "sobe" : l.status === "pendente" ? "alerta" : "mudo";
              var rotuloStatus = l.status === "conciliado" ? (l.com_taxa ? "conciliado · com taxa" : "conciliado") : l.status;
              var opcoes = emConciliacao ? ordenarPagamentos(d!.pagamentos_disponiveis, l) : [];
              return (
                <View key={l.id} testID={"ofx-lancamento-" + l.id} style={[s.linha, i === d!.lancamentos.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={s.linhaTopo}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.desc} numberOfLines={2}>{l.descricao || "Sem descrição"}</Text>
                      <Text style={s.nota}>{dataCurta(l.data)}{l.fitid ? " · " + l.fitid : ""}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={[s.valor, !credito && { color: Colors.ink3 }]}>{brl(l.valor, true)}</Text>
                      <Pill variacao={{ texto: credito ? rotuloStatus : "débito", tom: credito ? tom : "mudo" }} />
                    </View>
                  </View>
                  {credito ? (
                    <View style={s.acoes}>
                      {l.status === "pendente" ? (
                        <>
                          <Pressable testID={"ofx-conciliar-" + l.id} disabled={trabalhando} onPress={function() { setConciliando(emConciliacao ? null : l.id); }} accessibilityRole="button" style={[s.btn, s.btnDestaque]}>
                            <Text style={[s.btnText, { color: Paleta.accentTexto }]}>{emConciliacao ? "Fechar lista" : "Conciliar"}</Text>
                          </Pressable>
                          <Pressable
                            testID={"ofx-ignorar-" + l.id}
                            disabled={trabalhando}
                            onPress={function() { agir(l.id, function() { return adminApi.painel.ofx.ignorar(d!.extrato.id, l.id); }, "Lançamento ignorado.", "ignorar o lançamento"); }}
                            accessibilityRole="button"
                            style={[s.btn, trabalhando && { opacity: 0.6 }]}
                          >
                            <Text style={s.btnText}>Ignorar</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          testID={"ofx-reabrir-" + l.id}
                          disabled={trabalhando}
                          onPress={function() { agir(l.id, function() { return adminApi.painel.ofx.reabrir(d!.extrato.id, l.id); }, "Lançamento reaberto.", "reabrir o lançamento"); }}
                          accessibilityRole="button"
                          style={[s.btn, trabalhando && { opacity: 0.6 }]}
                        >
                          <Text style={s.btnText}>Reabrir</Text>
                        </Pressable>
                      )}
                      {trabalhando ? <ActivityIndicator size="small" color={Colors.violet3} /> : null}
                    </View>
                  ) : null}
                  {emConciliacao ? (
                    <View testID={"ofx-opcoes-" + l.id} style={s.opcoes}>
                      <Text style={s.rotulo}>Pagamentos da Asaas sem crédito</Text>
                      {opcoes.length === 0 ? <Text style={s.nota}>Nenhum pagamento da Asaas disponível neste mês.</Text> : null}
                      {opcoes.map(function(p) {
                        return (
                          <Pressable
                            key={p.pagamento_id}
                            testID={"ofx-pagamento-" + p.pagamento_id}
                            disabled={trabalhando}
                            onPress={function() { agir(l.id, function() { return adminApi.painel.ofx.conciliar(d!.extrato.id, l.id, p.pagamento_id); }, "Lançamento conciliado.", "conciliar o lançamento"); }}
                            accessibilityRole="button"
                            style={s.opcao}
                          >
                            <Text style={s.opcaoValor}>{brl(p.valor, true)}</Text>
                            <Text style={s.nota} numberOfLines={1}>
                              {dataCurta(String(p.data).slice(0, 10))}
                              {p.liquido != null && Math.abs(p.liquido - p.valor) >= 0.005 ? " · líquido " + brl(p.liquido, true) : ""}
                              {" · " + p.pagamento_id}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </PainelModal>
  );
}

var s = StyleSheet.create({
  secao: { gap: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  cab: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rotulo: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  nota: { fontSize: 12, color: Colors.ink3 },
  anexar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  seletor: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, backgroundColor: Colors.bg3, paddingHorizontal: 4, paddingVertical: 3 },
  seta: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  seletorMes: { minWidth: 78, textAlign: "center", fontSize: 13, fontWeight: "600", color: Colors.ink },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { fontSize: 12, fontWeight: "500", color: Colors.ink },
  btnDestaque: { backgroundColor: Paleta.accentSuave, borderColor: Paleta.accentSuave },
  btnPrimario: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 },
  btnPrimarioText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  btnPerigo: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.red, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnVermelho: { backgroundColor: Colors.red, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  tabela: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trHead: { backgroundColor: Colors.bg4, paddingVertical: 7 },
  th: { flex: 1, fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3 },
  td: { flex: 1, fontSize: 13, color: Colors.ink2 },
  tdMes: { fontWeight: "600", color: Colors.ink },
  dir: { textAlign: "right" },
  detalhe: { fontSize: 11, color: Colors.ink3, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, backgroundColor: Colors.bg3, maxWidth: "100%" },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipText: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  confirma: { gap: 8, borderWidth: 1, borderColor: Colors.red, borderRadius: 10, padding: 12, backgroundColor: Colors.redD },
  confirmaTitulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  lista: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: "hidden" },
  linha: { padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  linhaTopo: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  desc: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  valor: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  acoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  opcoes: { gap: 6, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10 },
  opcao: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  opcaoValor: { fontSize: 13, fontWeight: "700", color: Colors.ink },
});
