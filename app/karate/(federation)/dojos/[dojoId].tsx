// ============================================================
// Detalhe do Dojô — Aura Karatê (federação) · Shoji
// Dados reais via GET /federation/{id}/dojos/{dojoId}.
//
// Navegação: esta é a página de DETALHE full-page (destino do row-tap da lista).
// O botão "Editar" (header) abre o modal de ficha para edição rápida.
// IA/Nav P1: o botão "Ver praticantes" leva à lista já filtrada por este
//   dojô (/karate/praticantes?dojo_id=<id> — a lista lê o param dojo_id).
//
// Export (round-trip com o import): o botão "Exportar" abre um modal que baixa
//   os dados atuais do dojô no MESMO formato da Importação (abas Academias/
//   Alunos/Histórico) para o dojô editar e reimportar. Ver DojoExportModal.
//
// Endereço estruturado: o detalhe exibe os campos address_* (Logradouro,
//   Número, COMPLEMENTO, Bairro, Cidade/UF, CEP) — os mesmos da ficha (modal)
//   e da NF-e. O Complemento é vital para envio de certificados/carteirinhas.
//   Se o registro ainda não tem campos estruturados, cai no `address` legado.
//
// Nav P2 (7.3): ações de link público no header — "Página pública" (abre)
//   e "Copiar link". Não há rota pública POR-DOJÔ (o portal do dojô abre
//   por link/token fixo, e o microsite expõe ranking/portais a nível de
//   FEDERAÇÃO). Então o link relevante e que resolve é a página pública da
//   federação — o RANKING do microsite (/karate/[slug]/ranking servido em
//   {slug}.getaura.com.br/ranking), onde os atletas deste dojô aparecem.
//   O slug vem de getFederationIdentity (fallback: slug do host atual).
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, ViewStyle, TextStyle, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateType as T } from "@/constants/karateTheme";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SectionHead, Card, KV, ShojiBadge, BeltTag, ShojiButton, Mono, Body, Eyebrow, H1,
} from "@/components/karate/shoji";
import DojoFichaModal from "@/components/karate/DojoFichaModal";
import DojoExportModal from "@/components/karate/DojoExportModal";
import { karateApi, DojoDetail, AffiliationModel } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { buildMicrositeUrl, getMicrositeSlug } from "@/utils/microsite";
import { copyToClipboard } from "@/utils/clipboard";

const MODEL_LABEL: Record<AffiliationModel, string> = { annual: "Anual", biannual: "Semestral", quarterly: "Trimestral" };
const ROLE_LABEL: Record<string, string> = { instructor: "Instrutor", arbiter: "Árbitro", examiner: "Examinador", sensei: "Sensei", senpai: "Senpai", assistant: "Auxiliar" };
const fmtDate = (iso: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); };
const fmtMoney = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Máscara leve de CEP só para exibição (não altera o dado).
const fmtCep = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, "$1-$2");
  return String(v);
};

// "Logradouro, Número" numa linha só (componível com os demais KVs).
const fmtStreetLine = (street?: string | null, number?: string | null): string | null => {
  const s = (street || "").trim();
  const n = (number || "").trim();
  if (s && n) return `${s}, ${n}`;
  return s || n || null;
};

const fmtCityLine = (city?: string | null, state?: string | null): string | null => {
  const c = (city || "").trim();
  const u = (state || "").trim();
  if (c && u) return `${c} · ${u}`;
  return c || u || null;
};

export default function DojoDetailScreen() {
  const { dojoId } = useLocalSearchParams<{ dojoId: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [data, setData] = useState<DojoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Modal de edição (reusa a ficha de cadastro com o id atual)
  const [editOpen, setEditOpen] = useState(false);
  // Modal de exportação (round-trip com o import)
  const [exportOpen, setExportOpen] = useState(false);
  // Nav P2: slug público da federação (para montar o link do microsite).
  // null = ainda não resolvido / federação sem slug → ações ficam ocultas.
  const [pubSlug, setPubSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!dojoId) return;
    setLoading(true); setError(false);
    karateApi.getDojo(federationId, dojoId).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [federationId, dojoId]);
  useEffect(() => { load(); }, [load]);

  // Resolve o slug público da federação UMA vez (não bloqueia a tela).
  // Preferimos o slug do host (quando já estamos sob o microsite) e, se não,
  // buscamos na identidade da federação. Best-effort: erro = sem ações.
  useEffect(() => {
    let alive = true;
    const fromHost = getMicrositeSlug();
    if (fromHost) { setPubSlug(fromHost); return; }
    if (!federationId) return;
    karateApi.getFederationIdentity(federationId)
      .then((id) => { if (alive && id?.slug) setPubSlug(id.slug); })
      .catch(() => { /* sem slug → ações simplesmente não aparecem */ });
    return () => { alive = false; };
  }, [federationId]);

  // URL pública relevante do dojô = página pública (ranking) da federação.
  const publicUrl = pubSlug ? buildMicrositeUrl(pubSlug, "/ranking") : null;

  const openPublic = () => {
    if (!publicUrl) return;
    Linking.openURL(publicUrl).catch(() =>
      Alert.alert("Não foi possível abrir", "Tente copiar o link e abrir no navegador.")
    );
  };
  const copyPublic = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    Alert.alert(ok ? "Link copiado" : "Não foi possível copiar", ok ? publicUrl : "Copie manualmente: " + publicUrl);
  };

  if (loading) return <ShojiBackground><View style={styles.content}>{[1, 2, 3, 4].map((k) => <Skeleton key={k} height={24} style={{ marginBottom: 12 }} />)}</View></ShojiBackground>;
  if (error || !data) return <ShojiBackground><KarateErrorState onRetry={load} /></ShojiBackground>;

  // Endereço estruturado (address_*). Se nenhum campo estruturado vier do
  // backend, caímos no `address` legado (texto livre) numa linha só.
  const streetLine = fmtStreetLine(data.address_street, data.address_number);
  const cityLine = fmtCityLine(data.address_city, data.address_state);
  const cepLine = fmtCep(data.address_zip);
  const hasStructuredAddress = !!(streetLine || data.address_complement || data.address_neighborhood || cityLine || cepLine);

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Eyebrow>Detalhe · {data.fpkt_affiliation_id}</Eyebrow>
            <H1 dot style={{ marginTop: 12 }}>{data.name}</H1>
            <Body muted style={{ marginTop: 12 }}>{data.region || "—"} · {MODEL_LABEL[data.affiliation_model] ?? "—"}</Body>
          </View>
          <View style={styles.headActions}>
            <ShojiBadge dojoStatus={data.status} />
            <View style={styles.headBtns}>
              {publicUrl && (
                <>
                  <ShojiButton
                    label="Página pública"
                    icon="open-outline"
                    variant="ghost"
                    onPress={openPublic}
                  />
                  <ShojiButton
                    label="Copiar link"
                    icon="link-outline"
                    variant="ghost"
                    onPress={copyPublic}
                  />
                </>
              )}
              <ShojiButton
                label="Ver praticantes"
                icon="people-outline"
                variant="ghost"
                onPress={() => router.push(("/karate/praticantes?dojo_id=" + encodeURIComponent(dojoId!)) as any)}
              />
              <ShojiButton label="Exportar" icon="download-outline" variant="sumi" onPress={() => setExportOpen(true)} />
              <ShojiButton label="Editar" icon="create-outline" variant="ghost" onPress={() => setEditOpen(true)} />
            </View>
          </View>
        </View>

        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Cadastro" />
          <KV k="Nome do dojô" v={data.name} />
          <KV k="Código FPKT" v={data.fpkt_affiliation_id} />
          <KV k="CNPJ" v={data.cnpj} />
          <KV k="Telefone" v={data.phone} />
          <KV k="E-mail" v={data.email} />
          <KV k="Região" v={data.region} />
          <KV k="Fundação" v={data.dojo_founded_year ? String(data.dojo_founded_year) : null} />
          <KV k="Filiação desde" v={fmtDate(data.affiliation_since)} />
          <KV k="Modelo" v={MODEL_LABEL[data.affiliation_model] ?? null} />
          <KV k="Praticantes" v={String(data.practitioner_count)} />
        </Card>

        {/* Endereço — estruturado (com Complemento) ou texto legado.
            Complemento é vital para envio de certificados/carteirinhas. */}
        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Endereço" sub="Usado no envio de certificados e carteirinhas" />
          {hasStructuredAddress ? (
            <>
              <KV k="Logradouro" v={streetLine} />
              <KV k="Complemento" v={data.address_complement} />
              <KV k="Bairro" v={data.address_neighborhood} />
              <KV k="Cidade / UF" v={cityLine} />
              <KV k="CEP" v={cepLine} />
            </>
          ) : data.address ? (
            <KV k="Endereço" v={data.address} />
          ) : (
            <Body muted>Endereço não informado.</Body>
          )}
        </Card>

        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Equipe técnica" sub="Sensei responsável + corpo de auxiliares" />
          {data.technical_team.length === 0 ? <Body muted>Nenhum membro técnico cadastrado.</Body>
            : data.technical_team.map((m, i) => (
              <View key={m.practitioner_id} style={[styles.teamRow, i === data.technical_team.length - 1 && styles.noBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{m.name}</Text>
                  <Body muted style={{ fontSize: 11.5, marginTop: 2 }}>{m.roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ") || "Membro"}</Body>
                </View>
                <BeltTag level={m.belt_level} />
              </View>
            ))}
        </Card>

        <Card style={{ marginTop: SP[6] }}>
          <SectionHead title="Anuidades" />
          {data.annuity_history.length === 0 ? <Body muted>Nenhuma anuidade registrada.</Body>
            : data.annuity_history.map((a, i) => (
              <View key={i} style={[styles.annRow, i === data.annuity_history.length - 1 && styles.noBorder]}>
                <Mono style={{ fontSize: 14, color: C.ink, width: 56 }}>{a.reference_period}</Mono>
                <View style={{ flex: 1 }}>
                  {a.paid_at ? <Text style={styles.paid}>Pago em {fmtDate(a.paid_at)}</Text> : <Text style={styles.due}>Em aberto</Text>}
                </View>
                <Mono style={{ fontSize: 13.5, color: C.ink2 }}>{fmtMoney(a.amount)}</Mono>
                <ShojiBadge dojoStatus={a.status} />
              </View>
            ))}
        </Card>
      </ScrollView>

      {/* Modal de edição da ficha (reusa o cadastro com o id atual) */}
      <DojoFichaModal
        federationId={federationId}
        visible={editOpen}
        dojoId={dojoId!}
        onClose={() => setEditOpen(false)}
        onSaved={() => load()}
      />

      {/* Modal de exportação (round-trip com o import) */}
      <DojoExportModal
        federationId={federationId}
        visible={exportOpen}
        dojoId={dojoId!}
        dojoName={data.name}
        fpktId={data.fpkt_affiliation_id}
        onClose={() => setExportOpen(false)}
      />
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: 920, width: "100%", alignSelf: "center" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 16, flexWrap: "wrap" } as ViewStyle,
  headActions: { alignItems: "flex-end", gap: 10 } as ViewStyle,
  headBtns: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" } as ViewStyle,
  teamRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  noBorder: { borderBottomWidth: 0 } as ViewStyle,
  teamName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  annRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  paid: { fontFamily: F.body, fontSize: 11.5, color: C.ok } as TextStyle,
  due: { fontFamily: F.body, fontSize: 11.5, color: C.alert } as TextStyle,
});
