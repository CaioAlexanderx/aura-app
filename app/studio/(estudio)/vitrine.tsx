// ============================================================
// AURA STUDIO · Modo Vitrine (K2 — Quadro Vivo, 18/08/2026)
//
// O mesmo board da produção, montado para ser VISTO de longe: TV na parede
// da loja, ou a câmera do celular gravando os bastidores. Prática que a
// Printavo recomenda explicitamente (tela grande na produção) e o cenário
// que a trend de bastidores nas redes pede — a lojista não posta um
// dashboard, posta o ambiente dela trabalhando.
//
// É camada de APRESENTAÇÃO: reusa studioApi.listOrders, sem endpoint novo,
// sem estado novo, sem escrita. Ninguém arrasta card aqui — vitrine se olha.
//
// Zero configuração (premissa do projeto):
//   • um botão no board abre; nada pra ajustar antes
//   • o nome do cliente sai ABREVIADO por padrão. Não é toggle que alguém
//     precise lembrar de ligar: é uma tela pública por definição, então a
//     escolha segura é o padrão. Quem quiser o nome completo, desliga.
//   • atualiza sozinha — numa TV não há quem aperte F5
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens, useStudioSemantic } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioSemanticPalette } from "@/constants/studio-semantic";
import { studioApi, type StudioOrder, type StudioProductionStatus } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { abreviarNome } from "@/components/studio/abreviarNome";

const REFRESH_MS = 60_000;

// A vitrine mostra o que está EM ANDAMENTO. "Entregue" não é fila — sairia
// crescendo pra sempre e empurraria o trabalho de verdade pra fora da tela.
const COLS: { key: StudioProductionStatus; label: string; tone: keyof StudioSemanticPalette }[] = [
  { key: "awaiting_customization", label: "Aguardando", tone: "waiting" },
  { key: "pending_art",           label: "Na arte",    tone: "art" },
  { key: "approved",              label: "Aprovado",   tone: "approved" },
  { key: "in_production",         label: "Produzindo", tone: "production" },
  { key: "ready",                 label: "Pronto",     tone: "ready" },
];

/** Dias até a promessa, normalizando os dois lados em UTC (ver K1). */
function diasAte(iso: string): number {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return NaN;
  const n = new Date();
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000,
  );
}

function prazoCurto(promised: string | null | undefined): { txt: string; urgente: boolean } | null {
  if (!promised) return null;
  const dias = diasAte(promised);
  if (isNaN(dias)) return null;
  if (dias < 0)   return { txt: `atrasou ${Math.abs(dias)}d`, urgente: true };
  if (dias === 0) return { txt: "hoje",                       urgente: true };
  if (dias === 1) return { txt: "amanhã",                     urgente: false };
  const [, mm, dd] = String(promised).slice(0, 10).split("-");
  return { txt: `${dd}/${mm}`, urgente: false };
}

export default function StudioVitrine() {
  const router = useRouter();
  const t = useStudioTokens();
  const sem = useStudioSemantic();
  const { company } = useAuthStore();
  const { width } = useWindowDimensions();
  const s = useMemo(() => makeStyles(t), [t]);

  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [nomeCompleto, setNomeCompleto] = useState(false);
  const [erro, setErro] = useState(false);

  // Escala com a tela: numa TV de 55" o texto do desktop some. Cresce até um
  // teto — passar disso vira pôster, não quadro de trabalho.
  const escala = Math.min(Math.max(width / 1280, 1), 1.9);

  const load = useCallback(async () => {
    if (!company?.id) return;
    try {
      const r = await studioApi.listOrders(company.id, { days: 60, limit: 300 });
      setOrders(r.orders || []);
      setErro(false);
    } catch {
      // Numa TV ninguém vê toast. Falha vira um aviso discreto no rodapé e a
      // tela continua mostrando o último estado bom.
      setErro(true);
    }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const porStatus: Record<string, StudioOrder[]> = {};
  for (const c of COLS) porStatus[c.key] = [];
  for (const o of orders) {
    const k = (o.studio_production_status || "pending_art") as StudioProductionStatus;
    if (porStatus[k]) porStatus[k].push(o);
  }
  const ativos = COLS.reduce((n, c) => n + porStatus[c.key].length, 0);

  return (
    <View style={s.tela}>
      <View style={s.topo}>
        <View style={{ flex: 1 }}>
          <Text style={[s.titulo, { fontSize: 24 * escala }]}>Produção de hoje</Text>
          <Text style={[s.sub, { fontSize: 13 * escala }]}>
            {ativos === 0 ? "Nada em andamento" : `${ativos} ${ativos === 1 ? "encomenda" : "encomendas"} em andamento`}
            {erro ? " · sem conexão, mostrando o último estado" : ""}
          </Text>
        </View>
        <Pressable onPress={() => setNomeCompleto((v) => !v)} style={s.acao} accessibilityLabel="Alternar exibição do nome do cliente">
          <Icon name={nomeCompleto ? "eye-off" : "eye-outline"} size={15} color={t.ink3} />
          <Text style={s.acaoTxt}>{nomeCompleto ? "Abreviar nomes" : "Nome completo"}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={s.acao} accessibilityLabel="Sair do modo vitrine">
          <Icon name="close" size={15} color={t.ink3} />
          <Text style={s.acaoTxt}>Sair</Text>
        </Pressable>
      </View>

      {ativos === 0 ? (
        <View style={s.vazio}>
          <Text style={{ fontSize: 52 * escala }}>✨</Text>
          <Text style={[s.vazioTxt, { fontSize: 22 * escala }]}>Tudo em dia</Text>
          <Text style={[s.sub, { fontSize: 14 * escala, textAlign: "center" }]}>
            Nenhuma encomenda esperando. Bom trabalho.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal contentContainerStyle={s.board} showsHorizontalScrollIndicator={false}>
          {COLS.map((col) => {
            const tone = sem[col.tone];
            const lista = porStatus[col.key];
            return (
              <View key={col.key} style={[s.col, { width: 250 * escala }]}>
                <View style={[s.colTopo, { backgroundColor: tone.soft }]}>
                  <Text style={[s.colTitulo, { color: tone.base, fontSize: 13 * escala }]}>{col.label}</Text>
                  <Text style={[s.colN, { color: tone.base, fontSize: 15 * escala }]}>{lista.length}</Text>
                </View>
                <ScrollView contentContainerStyle={{ gap: 10 * escala, padding: 10 * escala }} showsVerticalScrollIndicator={false}>
                  {lista.length === 0 ? (
                    <Text style={[s.colVazia, { fontSize: 12 * escala }]}>—</Text>
                  ) : lista.map((o) => {
                    const prazo = prazoCurto(o.promised_date);
                    return (
                      <View key={o.id} style={s.card}>
                        {o.card_image_url ? (
                          <Image source={{ uri: o.card_image_url }} style={[s.capa, { height: 110 * escala }]} resizeMode="cover" />
                        ) : (
                          <View style={[s.capa, s.capaVazia, { height: 110 * escala }]}>
                            <Text style={[s.inicial, { fontSize: 26 * escala }]}>
                              {abreviarNome(o.customer_name).charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={[s.nome, { fontSize: 14 * escala }]} numberOfLines={1}>
                          {nomeCompleto ? (o.customer_name || "Encomenda") : abreviarNome(o.customer_name)}
                        </Text>
                        {prazo && (
                          <Text style={[s.prazo, { fontSize: 12 * escala }, prazo.urgente && { color: sem.danger.base }]}>
                            {prazo.urgente ? "entrega " : "entrega "}{prazo.txt}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(t: StudioPalette) {
  return StyleSheet.create({
    tela:      { flex: 1, backgroundColor: t.bg },
    topo:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 14 },
    titulo:    { fontWeight: "800", color: t.ink },
    sub:       { color: t.ink3, marginTop: 2 },
    acao:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: t.ink5 },
    acaoTxt:   { fontSize: 12.5, color: t.ink3, fontWeight: "700" },
    board:     { paddingHorizontal: 18, paddingBottom: 20, gap: 14 },
    col:       { backgroundColor: t.bgSoft, borderRadius: 16, borderWidth: 1, borderColor: t.ink5, overflow: "hidden" },
    colTopo:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
    colTitulo: { fontWeight: "800" },
    colN:      { fontWeight: "800" },
    colVazia:  { color: t.ink4, textAlign: "center", paddingVertical: 14 },
    card:      { backgroundColor: t.paperCard, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, padding: 10, gap: 6 },
    capa:      { width: "100%", borderRadius: 8, backgroundColor: t.bgSoft },
    capaVazia: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.ink5 },
    inicial:   { fontWeight: "800", color: t.ink4 },
    nome:      { fontWeight: "700", color: t.ink },
    prazo:     { color: t.ink3, fontWeight: "600" },
    vazio:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    vazioTxt:  { fontWeight: "800", color: t.ink },
  });
}
