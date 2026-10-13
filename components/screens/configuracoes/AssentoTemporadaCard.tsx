// ============================================================
// AURA. — Configurações › Plano › Assento de temporada (13/10/2026)
//
// Um acesso extra com validade fixa, para a equipe de fim de ano: vale de
// 01/11/2026 a 31/01/2027, custa o mesmo que um acesso extra (R$ 19 por
// mensalidade, somados à assinatura) e expira sozinho. Backend:
// Aura-backend #811, GET/POST/DELETE /companies/:id/billing/seat-pass.
//
// Regras da tela:
//   · só aparece de 01/10/2026 a 31/01/2027 (assentoTemporada.ts);
//   · o estado vem do GET; qualquer membro vê, só o dono contrata/cancela;
//   · contratar mostra a prévia da cobrança (GET ?qty=N) antes de confirmar
//     e depois o texto pronto que o backend devolve no POST;
//   · sem assinatura ativa a loja não compra (não há onde cobrar): o cartão
//     explica e leva ao checkout;
//   · 503 (migration pendente) vira "disponível em breve".
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { billingApi } from "@/services/billingApi";
import type { SeatPass, SeatPassEstado } from "@/services/billingApi";
import { Card, SectionTitle } from "@/components/screens/configuracoes/shared";
import {
  MAX_ASSENTOS_POR_PEDIDO, assentoTemporadaVisivel, assentos, dataBr, reais,
} from "@/components/screens/configuracoes/assentoTemporada";

export function mensagemDoAssento(err: any, acao: string): string {
  var status = err && err.status;
  var code = err && err.data && err.data.code;
  if (status === 503 || code === "MIGRATION_PENDING") return "O assento de temporada fica disponível em breve.";
  if (code === "SEM_ASSINATURA") return "Para contratar o assento, a empresa precisa de uma assinatura ativa.";
  if (code === "TEMPORADA_ENCERRADA") return "A temporada terminou: não dá mais para contratar.";
  if (code === "LIMITE_DE_ASSENTOS") return "A empresa já está no limite de assentos de temporada.";
  if (status === 403) return "Só o dono da empresa pode contratar ou cancelar o assento de temporada.";
  if (status === 502 || code === "FALHA_ASAAS") return "Não consegui ajustar a assinatura agora. Nada foi concedido nem cobrado: tente de novo em instantes.";
  if (err && err.isNetworkError) return "Sem conexão com o servidor. Tente de novo.";
  if (err && err.message && status && status < 500) return err.message;
  return "Não consegui " + acao + ". Tente de novo.";
}

var MOTIVO_SEM_COMPRA: Record<string, string> = {
  temporada_encerrada: "A temporada terminou: não dá mais para contratar.",
  limite_de_assentos: "A empresa já contratou o máximo de assentos de temporada.",
  plano_nao_suportado: "O plano atual não permite contratar assento de temporada pela tela. Fale com o suporte.",
};

function estiloDoPasse(p: SeatPass): string {
  if (p.agendado) return "começa em " + dataBr(p.starts_at);
  return "até " + dataBr(p.ends_at);
}

// `semMoldura` (13/10/2026): na página Black Friday o cartão vem dentro de uma
// seção que já tem título e moldura — só o conteúdo é renderizado. Em
// Configurações a moldura (SectionTitle + Card) continua a de sempre.
type AssentoProps = { companyId: string; isOwner: boolean; plano?: string; semMoldura?: boolean };

export function AssentoTemporadaCard(props: AssentoProps) {
  if (!assentoTemporadaVisivel()) return null;
  return <AssentoTemporada {...props} />;
}

function AssentoTemporada(props: AssentoProps) {
  var cid = props.companyId;
  var qc = useQueryClient();
  var refreshMe = useAuthStore(function(st) { return st.refreshMe; });
  var q = useQuery<SeatPassEstado>({
    queryKey: ["seat-pass", cid],
    queryFn: function() { return billingApi.seatPass.estado(cid); },
    staleTime: 30_000,
    retry: false,
  });
  var [contratando, setContratando] = useState(false);
  var [qty, setQty] = useState(1);
  var [enviando, setEnviando] = useState(false);
  var [cancelandoId, setCancelandoId] = useState<string | null>(null);
  var [erro, setErro] = useState<string | null>(null);
  var [sucesso, setSucesso] = useState<string | null>(null);

  var d = q.data;
  var teto = d ? Math.max(1, Math.min(MAX_ASSENTOS_POR_PEDIDO, d.limite_restante)) : MAX_ASSENTOS_POR_PEDIDO;
  var qtyEfetiva = Math.min(qty, teto);

  // Prévia do que seria cobrado para a quantidade escolhida.
  var previaQ = useQuery<SeatPassEstado>({
    queryKey: ["seat-pass-previa", cid, qtyEfetiva],
    queryFn: function() { return billingApi.seatPass.estado(cid, qtyEfetiva); },
    enabled: contratando,
    staleTime: 0,
    retry: false,
  });

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["seat-pass", cid] });
    qc.invalidateQueries({ queryKey: ["members-billing", cid] });
    // Os assentos entram em extra_seats_granted: o gate da Equipe lê do /me.
    try { refreshMe(); } catch { /* o /me se atualiza no próximo mount */ }
  }

  async function contratar() {
    setEnviando(true); setErro(null); setSucesso(null);
    try {
      var r = await billingApi.seatPass.contratar(cid, qtyEfetiva);
      setSucesso(r.mensagem || (r.cobranca && r.cobranca.texto) || "Assento contratado.");
      setContratando(false);
      setQty(1);
      toast.success(r.aplicado_agora ? "Assento de temporada ativo." : "Assento de temporada agendado.");
      recarregar();
    } catch (e: any) {
      setErro(mensagemDoAssento(e, "contratar o assento"));
      // O estado pode ter mudado (limite, assinatura): confere.
      recarregar();
    } finally { setEnviando(false); }
  }

  async function cancelar(passId: string) {
    setEnviando(true); setErro(null); setSucesso(null);
    try {
      await billingApi.seatPass.cancelar(cid, passId);
      setCancelandoId(null);
      toast.success("Assento de temporada cancelado.");
      recarregar();
    } catch (e: any) {
      setErro(mensagemDoAssento(e, "cancelar o assento"));
      recarregar();
    } finally { setEnviando(false); }
  }

  function irAoCheckout() {
    router.push(("/(tabs)/checkout?plan=" + (props.plano && props.plano !== "personalizado" ? props.plano : "negocio")) as any);
  }

  // ── Estados sem dados ─────────────────────────────────────
  var emBreve = !!q.error && ((q.error as any).status === 503 || ((q.error as any).data && (q.error as any).data.code === "MIGRATION_PENDING"));

  var corpo: React.ReactNode;
  if (q.isLoading) {
    corpo = <ActivityIndicator testID="assento-carregando" color={Colors.violet3} style={{ marginVertical: 12 }} />;
  } else if (emBreve) {
    corpo = <Text testID="assento-em-breve" style={s.nota}>Assento de temporada: disponível em breve.</Text>;
  } else if (q.isError || !d) {
    corpo = (
      <View testID="assento-erro" style={{ gap: 8, alignItems: "flex-start" }}>
        <Text style={s.nota}>Não consegui carregar o assento de temporada.</Text>
        <Pressable testID="assento-tentar-de-novo" onPress={function() { q.refetch(); }} accessibilityRole="button" style={s.btn}>
          <Text style={s.btnText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else {
    var vivos = d.passes.filter(function(p) { return p.status === "ativo"; });
    var bloqueio = d.motivo_bloqueio;
    var previa = previaQ.data ? previaQ.data.previa : undefined;
    corpo = (
      <>
        <Text style={s.nota}>
          Um acesso extra para a equipe de fim de ano, válido de {dataBr(d.temporada.starts_at)} a {dataBr(d.temporada.ends_at)}.
          Ele expira sozinho no fim da validade.
        </Text>

        <View style={s.linhas}>
          <View style={s.linha}>
            <Text style={s.rotulo}>Validade</Text>
            <Text testID="assento-validade" style={s.valor}>{dataBr(d.temporada.starts_at)} a {dataBr(d.temporada.ends_at)}</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.rotulo}>Valor por assento</Text>
            <Text testID="assento-preco" style={s.valor}>{reais(d.preco_assento_mensal)} por mensalidade</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.rotulo}>Situação</Text>
            <Text testID="assento-situacao" style={s.valor}>
              {d.assentos_ativos > 0
                ? assentos(d.assentos_ativos) + " ativo" + (d.assentos_ativos === 1 ? "" : "s") + " · " + reais(d.valor_mensal_atual) + " por mês" + (d.valido_ate ? " · até " + dataBr(d.valido_ate) : "")
                : d.assentos_agendados > 0
                  ? assentos(d.assentos_agendados) + " agendado" + (d.assentos_agendados === 1 ? "" : "s")
                  : "Nenhum assento contratado"}
            </Text>
          </View>
        </View>

        {vivos.map(function(p) {
          var confirmando = cancelandoId === p.id;
          return (
            <View key={p.id} testID={"assento-passe-" + p.id} style={s.passe}>
              <View style={s.passeTopo}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.passeTitulo}>{assentos(p.qty)} · {estiloDoPasse(p)}</Text>
                  <Text style={s.nota}>
                    {p.cortesia ? "Cortesia da Aura, sem cobrança." : reais(p.cobranca.valor_mensal) + " por mensalidade, somados à assinatura."}
                    {p.sync_pendente ? " Ajuste da cobrança em andamento." : ""}
                  </Text>
                </View>
                {props.isOwner && !confirmando ? (
                  <Pressable testID={"assento-cancelar-" + p.id} onPress={function() { setCancelandoId(p.id); setErro(null); }} accessibilityRole="button" style={s.btn}>
                    <Text style={s.btnText}>Cancelar</Text>
                  </Pressable>
                ) : null}
              </View>
              {confirmando ? (
                <View testID={"assento-cancelar-confirmacao-" + p.id} style={s.confirma}>
                  <Text style={s.confirmaTitulo}>Cancelar este assento?</Text>
                  <Text style={s.nota}>
                    O assento sai agora e o valor da assinatura volta ao normal nas próximas mensalidades.
                    O que já foi cobrado não é devolvido.
                  </Text>
                  <View style={s.acoes}>
                    <Pressable testID="assento-cancelar-voltar" onPress={function() { setCancelandoId(null); }} disabled={enviando} accessibilityRole="button" style={s.btn}>
                      <Text style={s.btnText}>Manter</Text>
                    </Pressable>
                    <Pressable testID="assento-cancelar-confirmar" onPress={function() { cancelar(p.id); }} disabled={enviando} accessibilityRole="button" style={[s.btnVermelho, enviando && { opacity: 0.6 }]}>
                      <Text style={s.btnPrimarioText}>{enviando ? "Cancelando…" : "Cancelar assento"}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        {sucesso ? (
          <View testID="assento-sucesso" style={s.sucesso}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={[s.nota, { flex: 1, color: Colors.ink2 }]}>{sucesso}</Text>
          </View>
        ) : null}
        {erro ? (
          <View testID="assento-aviso" style={s.erro}>
            <Icon name="alert" size={14} color={Colors.red} />
            <Text style={[s.nota, { flex: 1, color: Colors.red }]}>{erro}</Text>
          </View>
        ) : null}

        {/* Contratar */}
        {d.pode_contratar && props.isOwner && !contratando ? (
          <Pressable testID="assento-contratar" onPress={function() { setContratando(true); setErro(null); setSucesso(null); }} accessibilityRole="button" style={s.btnPrimario}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={s.btnPrimarioText}>Contratar assento</Text>
          </Pressable>
        ) : null}

        {d.pode_contratar && !props.isOwner ? (
          <Text testID="assento-so-dono" style={s.nota}>Só o dono da empresa contrata ou cancela o assento de temporada.</Text>
        ) : null}

        {contratando ? (
          <View testID="assento-contratar-painel" style={s.painel}>
            <Text style={s.confirmaTitulo}>Quantos assentos?</Text>
            <View style={s.stepper}>
              <Pressable testID="assento-qty-menos" disabled={qtyEfetiva <= 1} onPress={function() { setQty(Math.max(1, qtyEfetiva - 1)); }} accessibilityRole="button" accessibilityLabel="Menos um assento" style={[s.passo, qtyEfetiva <= 1 && { opacity: 0.4 }]}>
                <Icon name="minus" size={14} color={Colors.ink} />
              </Pressable>
              <Text testID="assento-qty" style={s.qty}>{qtyEfetiva}</Text>
              <Pressable testID="assento-qty-mais" disabled={qtyEfetiva >= teto} onPress={function() { setQty(Math.min(teto, qtyEfetiva + 1)); }} accessibilityRole="button" accessibilityLabel="Mais um assento" style={[s.passo, qtyEfetiva >= teto && { opacity: 0.4 }]}>
                <Icon name="plus" size={14} color={Colors.ink} />
              </Pressable>
              <Text style={s.nota}>de 1 a {teto}</Text>
            </View>

            <View testID="assento-previa" style={s.previa}>
              {previaQ.isLoading || previaQ.isFetching ? (
                <ActivityIndicator size="small" color={Colors.violet3} />
              ) : previa ? (
                <>
                  <Text style={s.previaTexto}>{previa.texto}</Text>
                  {previa.forma === "assinatura_asaas" ? (
                    <Text style={s.nota}>
                      {reais(previa.valor_mensal)} por mensalidade · no máximo {previa.mensalidades_ate_o_fim} {previa.mensalidades_ate_o_fim === 1 ? "mensalidade" : "mensalidades"} · {reais(previa.valor_maximo_total)} no total
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={s.nota}>Não consegui calcular a prévia agora.</Text>
              )}
            </View>

            <View style={s.acoes}>
              <Pressable testID="assento-contratar-cancelar" onPress={function() { setContratando(false); }} disabled={enviando} accessibilityRole="button" style={s.btn}>
                <Text style={s.btnText}>Voltar</Text>
              </Pressable>
              <Pressable
                testID="assento-contratar-confirmar"
                onPress={contratar}
                disabled={enviando || previaQ.isFetching || !previa}
                accessibilityRole="button"
                style={[s.btnPrimario, (enviando || previaQ.isFetching || !previa) && { opacity: 0.6 }]}
              >
                <Text style={s.btnPrimarioText}>{enviando ? "Contratando…" : "Confirmar e contratar"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Sem como contratar */}
        {!d.pode_contratar && bloqueio === "sem_assinatura" ? (
          <View testID="assento-sem-assinatura" style={s.painel}>
            <Text style={s.nota}>
              Para contratar o assento de temporada a empresa precisa de uma assinatura ativa: o valor entra na mensalidade.
            </Text>
            <Pressable testID="assento-ir-checkout" onPress={irAoCheckout} accessibilityRole="button" style={s.btnPrimario}>
              <Text style={s.btnPrimarioText}>Assinar um plano</Text>
              <Icon name="chevron_right" size={14} color="#fff" />
            </Pressable>
          </View>
        ) : null}
        {!d.pode_contratar && bloqueio && bloqueio !== "sem_assinatura" ? (
          <Text testID="assento-bloqueio" style={s.nota}>{MOTIVO_SEM_COMPRA[bloqueio] || "Não dá para contratar o assento de temporada agora."}</Text>
        ) : null}
      </>
    );
  }

  if (props.semMoldura) {
    return <View testID="assento-temporada" style={{ gap: 12 }}>{corpo}</View>;
  }
  return (
    <View testID="assento-temporada">
      <SectionTitle title="Assento de temporada" />
      <Card style={{ gap: 12, paddingBottom: 16 }}>{corpo}</Card>
    </View>
  );
}

var s = StyleSheet.create({
  nota: { fontSize: 12, lineHeight: 17, color: Colors.ink3 },
  linhas: { gap: 6 },
  linha: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  rotulo: { fontSize: 13, color: Colors.ink3 },
  valor: { fontSize: 13, color: Colors.ink, fontWeight: "500", textAlign: "right", flex: 1 },
  passe: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, gap: 10 },
  passeTopo: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  passeTitulo: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  confirma: { gap: 8, borderWidth: 1, borderColor: Colors.red, borderRadius: 10, padding: 12, backgroundColor: Colors.redD },
  confirmaTitulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  painel: { gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  passo: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 28, textAlign: "center", fontSize: 18, fontWeight: "800", color: Colors.ink },
  previa: { gap: 4, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, minHeight: 44, justifyContent: "center" },
  previaTexto: { fontSize: 13, lineHeight: 19, color: Colors.ink2 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  btn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontSize: 13, fontWeight: "500", color: Colors.ink },
  btnPrimario: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "flex-start", backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnPrimarioText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnVermelho: { backgroundColor: Colors.red, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  sucesso: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.greenD, borderRadius: 10, padding: 10 },
  erro: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 10 },
});
