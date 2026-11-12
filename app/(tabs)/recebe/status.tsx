// ============================================================
// Recebe na Aura — Situação da sua conta (RA-06, 12/11/2026)
//
// A subconta da Asaas em quatro blocos (dados da empresa, documentos,
// dados bancários e situação geral), em linguagem de loja: o que está
// aprovado, o que está em análise e o que falta, e quem resolve. Segue a
// aba "Status da subconta" do mockup aprovado (09/11). Nenhuma frase promete
// prazo: quem aprova é a Asaas. Selo (RA-02) e canais da Asaas (RA-03)
// sempre visíveis.
//
// ESCONDIDA DE LOJISTA (regra do Caio): sem item de menu. A rota só abre
// com a flag RECEBE_NA_AURA_ENABLED ligada no backend e para dono/admin;
// fora disso a tela não desenha nada e manda para Configurações. Conta da
// equipe (is_staff gravado no usuário, nunca o domínio do e-mail) vê uma
// prévia com dados de exemplo marcados. Ver hooks/useRecebeNaAura.ts.
// ============================================================
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { RECEBE_NA_AURA_NAME } from "@/constants/recebeNaAura";
import { SeloAsaas } from "@/components/recebe/SeloAsaas";
import { CanaisAsaas } from "@/components/recebe/CanaisAsaas";
import { useRecebeNaAura, RECEBE_STATUS_QUERY_KEY } from "@/hooks/useRecebeNaAura";
import { recebeApi, type RecebeStatus } from "@/services/recebeApi";
import {
  NOME_DO_BLOCO, blocosEmOrdem, oQueFazer, pillDoBloco, pedeAcaoDaLoja, resumoDaConta,
  statusDeExemplo, type CenarioDeExemplo, type Tom,
} from "@/utils/recebeSituacao";

const COR_DO_TOM: Record<Tom, string> = {
  ok: Colors.green,
  warn: Colors.amber,
  bad: Colors.red,
  neutro: Colors.ink3,
};

function Pill({ tom, texto, testID }: { tom: Tom; texto: string; testID?: string }) {
  const cor = COR_DO_TOM[tom];
  return (
    <View style={[st.pill, { borderColor: cor + "80" }]} testID={testID}>
      <Text style={[st.pillTxt, { color: cor }]}>{texto}</Text>
    </View>
  );
}

function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function Situacao({ status, previa }: { status: RecebeStatus; previa: boolean }) {
  if (!status.blocks) {
    return (
      <View style={st.card} testID="recebe-sem-conta">
        <Text style={st.cardTitulo}>{RECEBE_NA_AURA_NAME}</Text>
        <Text style={st.sub}>Esta empresa ainda não ativou o {RECEBE_NA_AURA_NAME}.</Text>
      </View>
    );
  }
  const blocos = blocosEmOrdem(status.blocks);
  const resumo = resumoDaConta(blocos);
  const atualizado = dataCurta(status.blocks_updated_at);
  return (
    <View style={[st.card, st.cardHi]} testID="recebe-situacao">
      <View style={st.linha}>
        <Text style={[st.cardTitulo, { flex: 1 }]}>{RECEBE_NA_AURA_NAME}</Text>
        <Pill tom={resumo.tom} texto={resumo.texto} testID="recebe-resumo" />
      </View>

      <View style={st.tabela}>
        <View style={[st.tr, st.thRow]}>
          <Text style={[st.th, st.cEtapa]}>Etapa</Text>
          <Text style={[st.th, st.cSit]}>Situação</Text>
          <Text style={[st.th, st.cFazer]}>O que fazer</Text>
        </View>
        {blocos.map((b) => {
          const p = pillDoBloco(b.key, b.status);
          const acao = pedeAcaoDaLoja(b.key, b.status);
          return (
            <View key={b.key} style={st.tr} testID={`recebe-bloco-${b.key}`}>
              <Text style={[st.td, st.cEtapa, st.tdForte]}>{NOME_DO_BLOCO[b.key]}</Text>
              <View style={st.cSit}><Pill tom={p.tom} texto={p.texto} testID={`recebe-bloco-${b.key}-pill`} /></View>
              <View style={st.cFazer}>
                <Text style={st.td}>{oQueFazer(b.key, b.status)}</Text>
                {acao && b.key === "documentos" && !!status.onboarding_url && !previa && (
                  <Pressable
                    style={st.btnSm}
                    testID="recebe-enviar-documentos"
                    accessibilityRole="link"
                    onPress={() => { Linking.openURL(status.onboarding_url as string).catch(() => {}); }}
                  >
                    <Text style={st.btnSmTxt}>Enviar documentos</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={st.sub}>
        Enquanto a conta não for aprovada, a loja online continua recebendo pelo Pix da chave, como hoje.
      </Text>
      {!!atualizado && <Text style={st.nota} testID="recebe-atualizado-em">Lido na Asaas em {atualizado}.</Text>}
      <CanaisAsaas testID="recebe-canais-asaas" />
      <SeloAsaas versao="v1" testID="recebe-selo-asaas" />
    </View>
  );
}

export default function RecebeStatusScreen() {
  const { acesso, query, companyId } = useRecebeNaAura();
  const qc = useQueryClient();
  const [cenario, setCenario] = useState<CenarioDeExemplo>("analise");

  useEffect(() => {
    if (acesso.estado === "fora") router.replace("/(tabs)/configuracoes" as any);
  }, [acesso.estado]);

  const atualizar = useMutation({
    mutationFn: () => recebeApi.atualizarStatus(companyId as string),
    onSuccess: (dados) => {
      qc.setQueryData([RECEBE_STATUS_QUERY_KEY, companyId], dados);
      toast.success("Situação atualizada.");
    },
    onError: (e: any) => toast.error(e?.data?.error || e?.message || "Não deu para atualizar agora."),
  });

  // Fora: nada desenhado (nem título). Carregando: só o indicador, sem
  // nome de produto, para não anunciar nada a quem não vai ver.
  if (acesso.estado === "fora") return null;
  if (acesso.estado === "carregando") {
    return <View style={st.carregando} testID="recebe-carregando"><ActivityIndicator color={Colors.violet3} /></View>;
  }

  const previa = acesso.estado === "previa_da_equipe";
  const status = previa ? statusDeExemplo(cenario) : (acesso as any).status as RecebeStatus;

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content} testID="recebe-status-tela">
      {previa && (
        <View style={st.faixaPrevia} testID="recebe-previa-equipe">
          <Text style={st.faixaTxt}>
            Prévia da equipe: {(acesso as any).motivo}. Dados de exemplo, nada é da loja. Lojista não vê esta tela.
          </Text>
          <View style={st.seg}>
            {([["analise", "Em análise"], ["pendente", "Falta documento"], ["ok", "Aprovada"]] as const).map(([k, l]) => (
              <Pressable
                key={k}
                onPress={() => setCenario(k)}
                style={[st.segBtn, cenario === k && st.segBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: cenario === k }}
                testID={`recebe-previa-${k}`}
              >
                <Text style={[st.segTxt, cenario === k && st.segTxtOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text style={st.eyebrow}>Configurações · Recebimentos</Text>
      <Text style={st.titulo}>Situação da sua conta</Text>
      <Text style={st.sub}>A Asaas confere os dados da sua empresa. Aqui você vê cada etapa e o que falta.</Text>

      <Situacao status={status} previa={previa} />

      {!previa && !!status.blocks && (
        <Pressable
          onPress={() => atualizar.mutate()}
          disabled={atualizar.isPending || query.isFetching}
          style={[st.btn, (atualizar.isPending || query.isFetching) && { opacity: 0.5 }]}
          accessibilityRole="button"
          testID="recebe-atualizar"
        >
          {atualizar.isPending ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>Atualizar situação</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 860, alignSelf: "center", width: "100%", gap: 12 },
  carregando: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", color: Colors.violet3 },
  titulo: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: Colors.ink3, lineHeight: 19 },
  nota: { fontSize: 11.5, color: Colors.ink3 },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardHi: { borderColor: Colors.border2 },
  cardTitulo: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  linha: { flexDirection: "row", alignItems: "center", gap: 10 },
  tabela: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  thRow: { borderTopWidth: 0, backgroundColor: Colors.bg2 },
  th: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Colors.ink3 },
  td: { fontSize: 13, color: Colors.ink2, lineHeight: 18 },
  tdForte: { color: Colors.ink, fontWeight: "700" },
  cEtapa: { flexBasis: 130, flexGrow: 1 },
  cSit: { flexBasis: 120, flexGrow: 0 },
  cFazer: { flexBasis: 200, flexGrow: 2, gap: 6 },
  pill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillTxt: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  btn: { backgroundColor: Colors.violet, borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, alignSelf: "flex-start" },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSm: { alignSelf: "flex-start", backgroundColor: Colors.violet, borderRadius: 10, minHeight: 36, justifyContent: "center", paddingHorizontal: 12 },
  btnSmTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  faixaPrevia: { borderWidth: 1, borderStyle: "dashed", borderColor: Colors.amber + "80", backgroundColor: Colors.amber + "14", borderRadius: 12, padding: 12, gap: 10 },
  faixaTxt: { fontSize: 12.5, color: Colors.amber, fontWeight: "700", lineHeight: 18 },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segBtn: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: "center", backgroundColor: Colors.bg2 },
  segBtnOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  segTxt: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  segTxtOn: { color: "#fff", fontWeight: "700" },
} as any);
