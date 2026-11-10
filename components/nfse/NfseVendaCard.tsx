// ============================================================
// AURA. — Cartão "Nota de serviço (NFS-e) — serviços" da venda concluída
//
// Mockup aprovado docs/mockups/nfse-cadastro-servico.html, tela 4. A nota
// sai sozinha no backend logo depois da venda; o cartão acompanha por
// polling leve (GET /origem/venda/:id, 1,5 s → 12 s), que para ao chegar
// num estado final ou ao sair da tela.
//
//   emitindo  → "Emitindo…" (Imprimir/WhatsApp desabilitados)
//   emitida   → "Emitida · nº 312" + Imprimir NFS-e + WhatsApp
//   pendente  → motivo + "Completar o cliente" (CPF/CNPJ e nome)
//   erro      → motivo + "Tentar de novo"; sem código → "Ver o cadastro do
//               serviço"
//
// O CPF/CNPJ que o Caixa pediu vai junto com a venda (nfse_tomador no POST
// /pdv/sale). utils/entregarTomador fica como rede de segurança para um
// backend que ainda não lê esse campo (só age se a nota ficou pendente por
// falta de tomador).
//
// 10/11/2026 — botão "Emitir NFS-e" (automatica=false: a loja emite NFS-e,
// mas sem a emissão automática; Aura-backend#989). Sem nota ainda, o cartão
// mostra o botão no mesmo padrão do "Emitir NFC-e" (largo, violeta, no topo
// do cartão). Ao tocar (tomador opcional, 10/11/2026):
//   - com o CPF/CNPJ do Caixa (válido) → POST /emitir com ele;
//   - sem documento → POST /emitir direto: o backend usa o cadastro do
//     cliente, se houver, ou emite sem tomador (consumidor não identificado);
//   - o "Completar o cliente" só abre se o backend devolver pendente_dados
//     por SEM_NOME ou TOMADOR_INVALIDO (faltaTomador).
// Depois segue igual: emitindo → emitida (Imprimir/WhatsApp) ou problema.
// 'nenhuma' para o polling (nada vai sair sozinho) e a rede de segurança
// do entregarTomador não roda (o documento vai no próprio toque).
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useSituacaoNfse } from "@/hooks/useNfseAutomatica";
import type { TomadorNfse } from "@/services/nfseAutomaticaApi";
import {
  docValido, faltaSoONome, faltaTomador, mensagemWhatsAppDaNfse, motivoDaSituacao, notasEmitidas, numerosDasNotas, semCodigo,
} from "@/utils/nfseAutomatica";
import { onlyDigits } from "@/lib/validators";
import { entregarTomadorDaVenda } from "@/utils/entregarTomador";
import { abrirLink, abrirPdfDaNfse, linkWhatsApp } from "./nfseAcoes";
import { CompletarTomador } from "./CompletarTomador";
import { useEmitirNfse, ROTA_CADASTRO_DO_SERVICO } from "./NfseDaOrigem";

const fmt = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Props = {
  companyId: string;
  saleId: string;
  /** "Corte feminino, Hidratação" */
  servicos: string;
  totalServicos: number;
  /** O CPF/CNPJ (e o nome) que o Caixa pediu. */
  tomador?: TomadorNfse | null;
  customerPhone?: string | null;
  /** Multi-CNPJ: "emitida pelo CNPJ da Loja Centro". */
  nomeDaLoja?: string | null;
  /** true (padrão) = a nota sai sozinha; false = a loja emite pelo botão. */
  automatica?: boolean;
};

export function NfseVendaCard({ companyId, saleId, servicos, totalServicos, tomador, customerPhone, nomeDaLoja, automatica = true }: Props) {
  const { token } = useAuthStore();
  const { situacao, esgotou, atualizar, aplicar } = useSituacaoNfse({ companyId, tipo: "venda", id: saleId, nenhumaEhFinal: !automatica });
  const { emitir, emitindo } = useEmitirNfse(companyId, "venda", saleId, aplicar);
  const [completando, setCompletando] = useState(false);

  // Leva o documento do Caixa à nota quando o cadastro do cliente não tem.
  useEffect(() => {
    if (!automatica) return;
    if (!tomador || !tomador.doc) return;
    entregarTomadorDaVenda({ companyId, saleId, tomador }).then((s) => { if (s) aplicar(s); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, saleId]);

  const estado = situacao ? situacao.estado : "nenhuma";
  const emitidas = notasEmitidas(situacao);
  const numeros = numerosDasNotas(situacao);
  const motivo = motivoDaSituacao(situacao);

  const cab = (selo: JSX.Element) => (
    <View style={s.head}>
      <View style={s.ico}><Icon name="receipt" size={15} color={Colors.violet3} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.t}>Nota de serviço (NFS-e) — serviços</Text>
        <Text style={s.sub} numberOfLines={2}>{servicos} · {fmt(totalServicos)}</Text>
      </View>
      {selo}
    </View>
  );

  function imprimir(nfseId?: string | null) {
    if (!nfseId) return;
    abrirPdfDaNfse({ companyId, tipo: "venda", id: saleId, nfseId, token });
  }
  function whatsapp() {
    const n = emitidas[0];
    const wa = linkWhatsApp(customerPhone, mensagemWhatsAppDaNfse({ numero: numeros, total: totalServicos, chave: n ? n.chave_acesso : null }));
    if (wa) abrirLink(wa);
    else toast.error("Cliente sem telefone cadastrado. Selecione um cliente com telefone para enviar.");
  }

  // ── botão "Emitir NFS-e" (loja que emite sem a automática) ──
  async function emitirAgora() {
    const doc = tomador && tomador.doc ? onlyDigits(tomador.doc) : "";
    const comDoc = docValido(doc);
    const r = await emitir(situacao, comDoc ? { doc, nome: (tomador && tomador.nome) || null } : null);
    if (faltaTomador(r)) setCompletando(true);
  }

  if (!automatica && (!situacao || estado === "nenhuma")) {
    return (
      <View style={s.card} testID="nfse-venda-manual">
        {cab(<View style={[s.selo, s.seloVai]}><Text style={[s.seloTxt, { color: Colors.ink3 }]}>Ainda não emitida</Text></View>)}
        <Pressable
          onPress={emitirAgora}
          disabled={emitindo}
          style={[s.btnEmitir, emitindo && { opacity: 0.6 }]}
          accessibilityRole="button"
          testID="nfse-venda-emitir"
        >
          {emitindo ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="file_text" size={16} color="#fff" />}
          <Text style={s.btnEmitirTxt}>Emitir NFS-e</Text>
        </Pressable>
      </View>
    );
  }

  // ── emitida ──
  if (estado === "emitida" && emitidas.length > 0) {
    const chave = emitidas[0].chave_acesso;
    return (
      <View style={[s.card, s.cardOk]} testID="nfse-venda-emitida">
        {cab(<View style={[s.selo, s.seloOk]}><View style={[s.dot, { backgroundColor: Colors.green }]} /><Text style={[s.seloTxt, { color: Colors.green }]}>Emitida{numeros ? " · " + numeros : ""}</Text></View>)}
        {(!!chave || !!nomeDaLoja) && (
          <Text style={s.msg}>
            {chave ? <>Chave de acesso <Text style={s.mono} selectable>{chave}</Text></> : null}
            {nomeDaLoja ? <>{chave ? " · " : ""}emitida pelo CNPJ da <Text style={{ fontWeight: "800" }}>{nomeDaLoja}</Text></> : null}
            .
          </Text>
        )}
        <View style={s.acoes}>
          {emitidas.map((n) => (
            <Pressable key={n.id} onPress={() => imprimir(n.nfse_id)} style={s.btn} testID="nfse-venda-imprimir">
              <Icon name="file_text" size={14} color={Colors.violet3} />
              <Text style={s.btnTxt}>{emitidas.length > 1 && n.nfse_number ? "Imprimir NFS-e nº " + n.nfse_number : "Imprimir NFS-e"}</Text>
            </Pressable>
          ))}
          <Pressable onPress={whatsapp} disabled={!customerPhone} style={[s.btn, !customerPhone && { opacity: 0.45 }]} testID="nfse-venda-whatsapp">
            <Icon name="message" size={14} color={Colors.green} />
            <Text style={[s.btnTxt, { color: Colors.green }]}>{customerPhone ? "WhatsApp" : "Cliente s/ tel"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── pendente de dados / erro / cancelada ──
  if (estado === "pendente_dados" || estado === "erro" || estado === "cancelada" || (esgotou && estado === "nenhuma")) {
    const pendente = faltaTomador(situacao);
    const codigo = semCodigo(situacao);
    const texto = estado === "nenhuma"
      ? "A nota de serviço não saiu sozinha. Pode emitir aqui — ela não sai duas vezes."
      : estado === "cancelada"
        ? "A nota de serviço desta venda foi cancelada."
        : (motivo || "A prefeitura não aceitou a nota agora.") + (pendente ? "" : " Quando estiver certo, é só tentar de novo — a nota não sai duas vezes.");
    return (
      <View style={[s.card, s.cardErr]} testID={pendente ? "nfse-venda-pendente" : "nfse-venda-problema"}>
        {cab(<View style={[s.selo, s.seloErr]}><Icon name="alert" size={11} color={Colors.red} /><Text style={[s.seloTxt, { color: Colors.red }]}>Com problema</Text></View>)}
        <Text style={s.msg}><Text style={{ fontWeight: "800" }}>A venda está registrada; só a nota de serviço ficou para trás.</Text> {texto}</Text>
        {pendente && completando ? (
          <CompletarTomador
            companyId={companyId}
            tipo="venda"
            id={saleId}
            docInicial={tomador ? tomador.doc : null}
            nomeInicial={tomador ? tomador.nome : null}
            onFeito={(r) => { setCompletando(false); aplicar(r); }}
            onCancelar={() => setCompletando(false)}
          />
        ) : (
          <View style={s.acoes}>
            {pendente ? (
              <Pressable onPress={() => setCompletando(true)} style={[s.btn, s.btnPri]} testID="nfse-venda-completar">
                <Icon name="users" size={14} color="#fff" />
                <Text style={[s.btnTxt, { color: "#fff" }]}>{faltaSoONome(situacao) ? "Completar o nome" : "Completar o cliente"}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => emitir(situacao)} disabled={emitindo} style={[s.btn, s.btnPri, emitindo && { opacity: 0.6 }]} testID="nfse-venda-tentar">
                {emitindo ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="refresh" size={14} color="#fff" />}
                <Text style={[s.btnTxt, { color: "#fff" }]}>{estado === "nenhuma" || estado === "cancelada" ? "Emitir NFS-e" : "Tentar de novo"}</Text>
              </Pressable>
            )}
            {codigo && (
              <Pressable onPress={() => router.push(ROTA_CADASTRO_DO_SERVICO as any)} style={s.btn} testID="nfse-venda-cadastro">
                <Text style={s.btnTxt}>Ver o cadastro do serviço</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  // ── emitindo (ou o gatilho ainda não rodou) ──
  return (
    <View style={s.card} testID="nfse-venda-emitindo">
      {cab(<View style={[s.selo, s.seloVai]}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={[s.seloTxt, { color: Colors.violet3 }]}>Emitindo…</Text></View>)}
      <Text style={s.msg}>Enviando para a prefeitura. Em geral leva menos de um minuto — pode seguir com a próxima venda: a nota fica guardada nesta venda, em Vendas.</Text>
      <View style={s.acoes}>
        <View style={[s.btn, { opacity: 0.45 }]}><Icon name="file_text" size={14} color={Colors.violet3} /><Text style={s.btnTxt}>Imprimir NFS-e</Text></View>
        <View style={[s.btn, { opacity: 0.45 }]}><Icon name="message" size={14} color={Colors.green} /><Text style={[s.btnTxt, { color: Colors.green }]}>WhatsApp</Text></View>
        {esgotou && (
          <Pressable onPress={atualizar} style={s.btn} testID="nfse-venda-atualizar">
            <Icon name="refresh" size={14} color={Colors.violet3} />
            <Text style={s.btnTxt}>Atualizar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { width: "100%", gap: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  cardOk: { borderColor: Colors.green + "55", backgroundColor: Colors.greenD },
  cardErr: { borderColor: Colors.red + "55", backgroundColor: Colors.redD },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ico: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  t: { fontSize: 13, color: Colors.ink, fontWeight: "800" },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  selo: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  seloOk: { borderColor: Colors.green + "55" },
  seloErr: { borderColor: Colors.red + "55" },
  seloVai: { borderColor: Colors.border2 },
  seloTxt: { fontSize: 11, fontWeight: "800" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  msg: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  mono: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 11, color: Colors.ink },
  acoes: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnPri: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  // o mesmo botão do "Emitir NFC-e" (NfceActions.nfcePrimaryBtn)
  btnEmitir: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.violet },
  btnEmitirTxt: { fontSize: 14, color: "#fff", fontWeight: "700" },
});

export default NfseVendaCard;
