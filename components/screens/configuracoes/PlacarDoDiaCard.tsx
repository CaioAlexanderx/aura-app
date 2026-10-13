// ============================================================
// AURA. — Configurações › Vendas › Placar do dia no WhatsApp (13/10/2026)
//
// Todo fim de dia o dono recebe, no WhatsApp, o placar da loja: vendas,
// ticket médio, o que mais saiu, comparação com o mês anterior e o que
// entrou do crediário. Backend: Aura-backend#816, GET/PUT
// /companies/:id/placar-do-dia.
//
// Regras da tela:
//   · o estado vem do GET, que já diz o que falta para o placar chegar:
//     WhatsApp conectado, telefone do dono e template `placar_dia` aprovado;
//   · cada item que falta tem a sua saída: conectar (aba Conexão do
//     WhatsApp), criar o template (POST /whatsapp/templates { preset }) e,
//     para o telefone — que é o do cadastro do dono, não o da loja —, falar
//     com a Aura;
//   · "ligar" nunca fica bloqueado por falta de requisito (o backend aceita
//     e o placar passa a sair quando o último item é resolvido); o cartão só
//     avisa que ainda não chega;
//   · sem "o ano todo" o placar roda só na temporada (janela do backend);
//   · só o dono liga/desliga; os demais veem o estado;
//   · 503 (migration pendente) vira "disponível em breve".
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { placarApi, type PlacarDoDia } from "@/services/placarApi";
import { waApi } from "@/services/waApi";
import { mapWaError } from "@/components/whatsapp/waGuards";
import { Card, AURA_WHATSAPP } from "@/components/screens/configuracoes/shared";

function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso);
}

export function mensagemDoPlacar(err: any, acao: string): string {
  var status = err && err.status;
  var code = err && err.data && err.data.code;
  if (status === 503 || code === "MIGRATION_PENDING") return "O placar do dia fica disponível em breve.";
  if (status === 403 || code === "PLACAR_FORBIDDEN") return "Só o dono da conta liga ou desliga o placar do dia.";
  if (err && err.isNetworkError) return "Sem conexão com o servidor. Tente de novo.";
  if (err && err.message && status && status < 500) return err.message;
  return "Não consegui " + acao + ". Tente de novo.";
}

function abrirSuporte() {
  var url = AURA_WHATSAPP + "?text=" + encodeURIComponent("Oi! Quero cadastrar o telefone do dono para receber o placar do dia no WhatsApp.");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
  } else {
    Linking.openURL(url).catch(function() {});
  }
}

export function PlacarDoDiaCard(props: { companyId: string; isOwner: boolean }) {
  var cid = props.companyId;
  var qc = useQueryClient();
  var q = useQuery<PlacarDoDia>({
    queryKey: ["placar-do-dia", cid],
    queryFn: function() { return placarApi.get(cid); },
    staleTime: 30_000,
    retry: false,
  });
  var [salvando, setSalvando] = useState(false);
  var [criando, setCriando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);
  var [aviso, setAviso] = useState<string | null>(null);

  var d = q.data;

  async function salvar(body: { enabled: boolean; always?: boolean }) {
    setSalvando(true); setErro(null);
    try {
      var novo = await placarApi.save(cid, body);
      qc.setQueryData(["placar-do-dia", cid], novo);
    } catch (e: any) {
      setErro(mensagemDoPlacar(e, "salvar o placar do dia"));
      qc.invalidateQueries({ queryKey: ["placar-do-dia", cid] });
    } finally { setSalvando(false); }
  }

  async function criarTemplate() {
    setCriando(true); setErro(null); setAviso(null);
    try {
      await waApi.createTemplate(cid, { preset: "placar_dia" });
      setAviso("Modelo enviado para aprovação da Meta. Costuma levar até 24 horas; o placar passa a sair quando ele for aprovado.");
      toast.success("Modelo do placar criado.");
      qc.invalidateQueries({ queryKey: ["placar-do-dia", cid] });
    } catch (e: any) {
      setErro(mapWaError(e).message);
    } finally { setCriando(false); }
  }

  var emBreve = !!q.error && ((q.error as any).status === 503 || ((q.error as any).data && (q.error as any).data.code === "MIGRATION_PENDING"));

  var corpo: React.ReactNode;
  if (q.isLoading) {
    corpo = <ActivityIndicator testID="placar-carregando" color={Colors.violet3} style={{ marginVertical: 12 }} />;
  } else if (emBreve) {
    corpo = <Text testID="placar-em-breve" style={s.nota}>Placar do dia no WhatsApp: disponível em breve.</Text>;
  } else if (q.isError || !d) {
    corpo = (
      <View testID="placar-erro" style={{ gap: 8, alignItems: "flex-start" }}>
        <Text style={s.nota}>Não consegui carregar o placar do dia.</Text>
        <Pressable testID="placar-tentar-de-novo" onPress={function() { q.refetch(); }} accessibilityRole="button" style={s.btn}>
          <Text style={s.btnText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else {
    var temporada = dataBr(d.season.starts_at) + " a " + dataBr(d.season.ends_at);
    var faltaWhatsapp = !d.whatsapp_connected;
    var faltaTelefone = !d.owner_phone_present;
    var faltaTemplate = !d.template_approved;
    var algoFalta = faltaWhatsapp || faltaTelefone || faltaTemplate;

    var situacao = !d.enabled
      ? "Desligado"
      : d.always
        ? "Ligado o ano todo"
        : d.in_season_today
          ? "Ligado — dentro da temporada"
          : "Ligado — fora da temporada, volta em " + dataBr(d.season.starts_at);

    corpo = (
      <>
        <Text style={s.nota}>
          Todo fim de dia, o dono recebe no WhatsApp o placar da loja: vendas, ticket médio, o que mais saiu,
          comparação com o mês anterior e o que entrou do crediário.
        </Text>

        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rotulo}>Enviar o placar do dia</Text>
            <Text testID="placar-situacao" style={s.nota}>{situacao}</Text>
          </View>
          <Switch
            testID="placar-toggle"
            value={d.enabled}
            onValueChange={function(v) { salvar({ enabled: v }); }}
            disabled={!props.isOwner || salvando}
            trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
            thumbColor={d.enabled ? Colors.violet : Colors.ink3}
          />
        </View>

        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rotulo}>Receber o ano todo</Text>
            <Text style={s.nota}>
              Sem isto, o placar chega só na temporada ({temporada}).
            </Text>
          </View>
          <Switch
            testID="placar-ano-todo"
            value={d.always}
            onValueChange={function(v) { salvar({ enabled: d!.enabled, always: v }); }}
            disabled={!props.isOwner || salvando}
            trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
            thumbColor={d.always ? Colors.violet : Colors.ink3}
          />
        </View>

        {!props.isOwner ? (
          <Text testID="placar-so-dono" style={s.nota}>Só o dono da conta liga ou desliga o placar do dia.</Text>
        ) : null}

        {/* O que falta para chegar */}
        {!algoFalta ? (
          <View testID="placar-pronto" style={s.ok}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={[s.nota, { flex: 1, color: Colors.ink2 }]}>
              WhatsApp conectado, telefone do dono cadastrado e modelo aprovado: o placar está pronto para chegar.
            </Text>
          </View>
        ) : (
          <View testID="placar-faltas" style={s.faltas}>
            <Text style={s.faltasTitulo}>
              {d.enabled ? "O placar ainda não chega. Falta:" : "Para o placar chegar, falta:"}
            </Text>

            {faltaWhatsapp ? (
              <View testID="placar-falta-whatsapp" style={s.falta}>
                <Text style={[s.nota, { flex: 1, color: Colors.ink2 }]}>Conectar o WhatsApp da loja — o placar sai por ele.</Text>
                {props.isOwner ? (
                  <Pressable testID="placar-conectar-whatsapp" onPress={function() { router.push("/whatsapp" as any); }} accessibilityRole="button" style={s.btn}>
                    <Text style={s.btnText}>Conectar WhatsApp</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {faltaTelefone ? (
              <View testID="placar-falta-telefone" style={s.falta}>
                <Text style={[s.nota, { flex: 1, color: Colors.ink2 }]}>
                  Cadastrar o telefone do dono — é o celular do cadastro da conta (não o telefone da loja) que recebe o placar.
                </Text>
                {props.isOwner ? (
                  <Pressable testID="placar-cadastrar-telefone" onPress={abrirSuporte} accessibilityRole="button" style={s.btn}>
                    <Text style={s.btnText}>Falar com a Aura</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {faltaTemplate ? (
              <View testID="placar-falta-template" style={s.falta}>
                <Text style={[s.nota, { flex: 1, color: Colors.ink2 }]}>
                  Criar o modelo de mensagem do placar. Depois de criado, a Meta aprova em até 24 horas.
                </Text>
                {props.isOwner ? (
                  <Pressable
                    testID="placar-criar-template"
                    onPress={criarTemplate}
                    disabled={criando || faltaWhatsapp}
                    accessibilityRole="button"
                    style={[s.btn, (criando || faltaWhatsapp) && { opacity: 0.5 }]}
                  >
                    <Text style={s.btnText}>{criando ? "Criando…" : "Criar modelo"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {faltaTemplate && faltaWhatsapp ? (
              <Text style={s.nota}>Conecte o WhatsApp primeiro: o modelo é criado na conta da loja.</Text>
            ) : null}
          </View>
        )}

        {aviso ? (
          <View testID="placar-aviso" style={s.ok}>
            <Icon name="check" size={14} color={Colors.green} />
            <Text style={[s.nota, { flex: 1, color: Colors.ink2 }]}>{aviso}</Text>
          </View>
        ) : null}
        {erro ? (
          <View testID="placar-aviso-erro" style={s.erro}>
            <Icon name="alert" size={14} color={Colors.red} />
            <Text style={[s.nota, { flex: 1, color: Colors.red }]}>{erro}</Text>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View testID="placar-do-dia">
      <Card style={{ gap: 12, paddingBottom: 16 }}>
        <View style={s.cabeca}>
          <View style={s.icone}><Icon name="whatsapp" size={16} color={Colors.green} /></View>
          <Text style={s.titulo}>Placar do dia no WhatsApp</Text>
        </View>
        {corpo}
      </Card>
    </View>
  );
}

var s = StyleSheet.create({
  cabeca: { flexDirection: "row", alignItems: "center", gap: 10 },
  icone: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 15, fontWeight: "700", color: Colors.ink, flex: 1 },
  nota: { fontSize: 12, lineHeight: 17, color: Colors.ink3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rotulo: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  faltas: { gap: 10, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12 },
  faltasTitulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  falta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  btn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontSize: 13, fontWeight: "500", color: Colors.ink },
  ok: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.greenD, borderRadius: 10, padding: 10 },
  erro: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 10 },
});
