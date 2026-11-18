// ============================================================
// AURA. — Meu Site › Design · Banner de personalizados (p-193, 17/11/2026)
//
// A lojista liga o banner A do mockup p-132 (decisão D9), escolhe a peça
// personalizável, edita o kicker, o título, o texto e os botões, e vê uma
// prévia simples. Grava pela rota própria do backend#1055:
// GET/PUT /companies/:id/digital-channel/banner-personalizados (fora do PUT
// grande do Meu Site: salvar o resto da loja não toca no banner).
//
// Quem vê e por quê: components/personalizados/regrasDoBanner.ts. Com a
// trava PERSONALIZADOS_LIBERADO em false o componente devolve null antes de
// qualquer hook: nenhuma ida ao servidor, e a aba Design fica idêntica.
//
// A capa é a foto da peça. Nunca o mockup nem o render de um pedido de
// cliente (consentimento). A foto própria do banner (`imagem_url`) só faz a
// ida e volta até o backend ganhar o tipo de upload dele.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, Switch, ActivityIndicator, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { useAccent } from "@/contexts/AccentTheme";
import { PERSONALIZADOS_LIBERADO, personalizadosAtivo, testeDaFrenteNaSessao } from "@/utils/personalizados";
import {
  situacaoDoBanner, bannerDaResposta, corpoDoPut, textoFinal, pecaDaCapa, capaDoBanner, textoSobre,
  PADRAO_DO_BANNER, LIMITES_DO_BANNER, BANNER_VAZIO, TEXTOS_DO_BANNER,
  type BannerPersonalizados, type CampoDeTexto, type PecaDoBanner,
} from "@/components/personalizados/regrasDoBanner";
import { Field, SectionTitle, useChannelStyles } from "./shared";
import { usePaletaDoCanal } from "./paletaDoCanal";

type RespostaDoGet = {
  banner?: unknown;
  padrao?: Partial<Record<CampoDeTexto, string>>;
  limites?: Partial<Record<CampoDeTexto, number>>;
  pecas?: PecaDoBanner[];
};

const CAMPOS: Array<{ campo: CampoDeTexto; rotulo: string; multiline?: boolean }> = [
  { campo: "kicker", rotulo: "Linha de cima" },
  { campo: "titulo", rotulo: "Título" },
  { campo: "texto", rotulo: "Texto", multiline: true },
  { campo: "botao", rotulo: "Botão principal" },
];

const rota = (cid: string) => `/companies/${cid}/digital-channel/banner-personalizados`;

export function SecaoBannerPersonalizados(props: { corDaLoja?: string | null }) {
  // A trava antes de qualquer outro hook: desligada, nada roda e nada
  // aparece. p-188: a empresa de teste (personalizados_teste do /auth/me)
  // também liga; o seletor é um booleano, sem ler mais nada do store.
  const teste = useAuthStore((st: any) => testeDaFrenteNaSessao(st));
  if (!(PERSONALIZADOS_LIBERADO || teste === true)) return null;
  return <Secao {...props} />;
}

function Secao({ corDaLoja }: { corDaLoja?: string | null }) {
  const { company, consolidatedView, refreshMe } = useAuthStore() as any;
  const visiveis = useVisibleModules();
  const prontos = useVisibleModulesProntos();
  const { settings } = usePdvSettings();
  const cs = useChannelStyles();
  const accent = useAccent();
  const p = usePaletaDoCanal();
  const cid: string | undefined = company?.id ? String(company.id) : undefined;
  const frente = personalizadosAtivo(settings, company?.vertical_active);
  const situacao = prontos
    ? situacaoDoBanner({ settings, verticalActive: company?.vertical_active, visiveis, consolidado: !!consolidatedView })
    : "fora";

  // Armadilha 1 do CLAUDE.md: plano e module_overrides do JWT ficam velhos.
  // Só quem tem a frente ligada faz a ida extra.
  useEffect(() => {
    if (frente && typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [frente, refreshMe, cid]);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [pecas, setPecas] = useState<PecaDoBanner[]>([]);
  const [padrao, setPadrao] = useState<Record<CampoDeTexto, string>>(PADRAO_DO_BANNER);
  const [limites, setLimites] = useState<Record<CampoDeTexto, number>>(LIMITES_DO_BANNER);
  const [banner, setBanner] = useState<BannerPersonalizados>(BANNER_VAZIO);
  const [salvo, setSalvo] = useState<BannerPersonalizados>(BANNER_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (situacao !== "ligada" || !cid) return;
    let vivo = true;
    setCarregando(true);
    setErro(false);
    request<RespostaDoGet>(rota(cid))
      .then((r) => {
        if (!vivo) return;
        const b = bannerDaResposta(r?.banner);
        setBanner(b);
        setSalvo(b);
        setPecas(Array.isArray(r?.pecas) ? r!.pecas!.filter((x) => x && typeof x.id === "string") : []);
        setPadrao({ ...PADRAO_DO_BANNER, ...(r?.padrao || {}) });
        setLimites({ ...LIMITES_DO_BANNER, ...(r?.limites || {}) });
      })
      .catch(() => { if (vivo) setErro(true); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [situacao, cid, tentativa]);

  const alterado = useMemo(
    () => JSON.stringify(corpoDoPut(banner)) !== JSON.stringify(corpoDoPut(salvo)),
    [banner, salvo],
  );

  if (situacao === "fora") return null;

  if (situacao === "escolha-a-loja") {
    return (
      <>
        <SectionTitle title={TEXTOS_DO_BANNER.titulo} />
        <View style={cs.card} testID="banner-pz-escolha-a-loja">
          <Text style={[cs.hint, { marginBottom: 0 }]}>{TEXTOS_DO_BANNER.escolhaALoja}</Text>
        </View>
      </>
    );
  }

  function mudar(patch: Partial<BannerPersonalizados>) {
    setBanner((b) => ({ ...b, ...patch }));
  }

  async function salvar() {
    if (!cid || salvando || !alterado) return;
    setSalvando(true);
    try {
      const r = await request<{ banner?: unknown }>(rota(cid), { method: "PUT", body: corpoDoPut(banner) });
      const b = bannerDaResposta(r?.banner ?? corpoDoPut(banner));
      setBanner(b);
      setSalvo(b);
      toast.success(TEXTOS_DO_BANNER.salvo);
    } catch (err: any) {
      toast.error(err?.message || "Não deu para salvar o banner.");
    } finally {
      setSalvando(false);
    }
  }

  const algumaComFoto = pecas.some((x) => !!x.image_url) || !!banner.imagem_url;
  const capa = capaDoBanner(banner, pecas);
  const pecaDaLoja = pecaDaCapa(banner, pecas);

  return (
    <>
      <SectionTitle title={TEXTOS_DO_BANNER.titulo} />
      <View style={cs.card} testID="banner-personalizados">
        <Text style={cs.hint}>{TEXTOS_DO_BANNER.explicacao}</Text>

        {carregando ? (
          <View style={{ paddingVertical: 16 }} testID="banner-pz-carregando"><ActivityIndicator color={accent.primary} /></View>
        ) : erro ? (
          <View style={{ gap: 8 }} testID="banner-pz-erro">
            <Text style={[cs.hint, { marginBottom: 0 }]}>{TEXTOS_DO_BANNER.erroAoCarregar}</Text>
            <Pressable onPress={() => setTentativa((n) => n + 1)} accessibilityRole="button" style={[st.secundario, { borderColor: p.border }]}>
              <Text style={{ color: p.ink, fontWeight: "600", fontSize: 13 }}>Tentar de novo</Text>
            </Pressable>
          </View>
        ) : pecas.length === 0 ? (
          <View style={[st.aviso, { backgroundColor: p.amberD }]} testID="banner-pz-sem-peca">
            <Icon name="info" size={14} color={p.ink} />
            <Text style={[st.avisoTxt, { color: p.ink }]}>{TEXTOS_DO_BANNER.semPeca}</Text>
          </View>
        ) : (
          <>
            <View style={cs.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={cs.switchLabel}>{TEXTOS_DO_BANNER.ligar}</Text>
                <Text style={cs.switchHint}>{TEXTOS_DO_BANNER.ligarDica}</Text>
              </View>
              <Switch
                testID="banner-pz-ativo"
                accessibilityLabel={TEXTOS_DO_BANNER.ligar}
                value={banner.ativo}
                onValueChange={(v) => mudar({ ativo: v })}
                trackColor={{ false: p.border, true: accent.primary }}
                thumbColor="#fff"
              />
            </View>

            {banner.ativo ? (
              <View style={{ gap: 12 }} testID="banner-pz-editor">
                {!algumaComFoto ? (
                  <View style={[st.aviso, { backgroundColor: p.amberD }]} testID="banner-pz-sem-foto">
                    <Icon name="info" size={14} color={p.ink} />
                    <Text style={[st.avisoTxt, { color: p.ink }]}>{TEXTOS_DO_BANNER.semFoto}</Text>
                  </View>
                ) : null}

                <View>
                  <Text style={cs.fieldLabel}>Peça do banner</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {[null, ...pecas].map((peca) => {
                      const id = peca ? peca.id : null;
                      const sel = banner.produto_id === id;
                      const semFoto = !!peca && !peca.image_url && !banner.imagem_url;
                      const nome = peca ? peca.name : TEXTOS_DO_BANNER.automatico;
                      return (
                        <Pressable
                          key={id || "auto"}
                          testID={`banner-pz-peca-${id || "auto"}`}
                          disabled={semFoto}
                          onPress={() => mudar({ produto_id: id })}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sel, disabled: semFoto }}
                          accessibilityLabel={peca ? (semFoto ? `${nome}, sem foto` : nome) : `${nome}: ${TEXTOS_DO_BANNER.automaticoDica}`}
                          style={[st.peca, {
                            borderWidth: sel ? 2 : 1,
                            borderColor: sel ? accent.primaryStrong : accent.border,
                            backgroundColor: sel ? accent.primarySoft : p.bg2,
                            opacity: semFoto ? 0.55 : 1,
                          }]}
                        >
                          <View style={[st.pecaFoto, { backgroundColor: p.bg4 }]}>
                            {peca && peca.image_url
                              ? <Image source={{ uri: peca.image_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                              : <Icon name={peca ? "image" : "refresh"} size={18} color={p.ink3} />}
                          </View>
                          <Text numberOfLines={2} style={{ fontSize: 11.5, fontWeight: sel ? "700" : "500", color: p.ink }}>{nome}</Text>
                          <Text numberOfLines={1} style={{ fontSize: 10, color: p.ink3 }}>
                            {peca ? (semFoto ? "Sem foto" : " ") : TEXTOS_DO_BANNER.automaticoDica}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <Text style={[cs.hint, { marginBottom: 0 }]}>{TEXTOS_DO_BANNER.vazioUsaModelo}</Text>
                {CAMPOS.map(({ campo, rotulo, multiline }) => (
                  <Field
                    key={campo}
                    label={rotulo}
                    value={banner[campo]}
                    onChange={(v) => mudar({ [campo]: v } as Partial<BannerPersonalizados>)}
                    placeholder={padrao[campo]}
                    multiline={multiline}
                    maxLength={limites[campo]}
                    testID={`banner-pz-${campo}`}
                  />
                ))}

                <View style={cs.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.switchLabel}>{TEXTOS_DO_BANNER.mostrar3d}</Text>
                  </View>
                  <Switch
                    testID="banner-pz-mostrar-3d"
                    accessibilityLabel={TEXTOS_DO_BANNER.mostrar3d}
                    value={banner.mostrar_3d}
                    onValueChange={(v) => mudar({ mostrar_3d: v })}
                    trackColor={{ false: p.border, true: accent.primary }}
                    thumbColor="#fff"
                  />
                </View>
                {banner.mostrar_3d ? (
                  <Field
                    label="Botão do 3D"
                    value={banner.botao_3d}
                    onChange={(v) => mudar({ botao_3d: v })}
                    placeholder={padrao.botao_3d}
                    maxLength={limites.botao_3d}
                    testID="banner-pz-botao_3d"
                  />
                ) : null}

                <PreviaDoBanner banner={banner} padrao={padrao} capa={capa} nomeDaPeca={pecaDaLoja?.name || null} cor={corDaLoja} />
              </View>
            ) : null}

            <Pressable
              testID="banner-pz-salvar"
              onPress={salvar}
              disabled={!alterado || salvando}
              accessibilityRole="button"
              accessibilityState={{ disabled: !alterado || salvando }}
              style={[cs.saveBtn, (!alterado || salvando) && { opacity: 0.5 }]}
            >
              {salvando
                ? <ActivityIndicator color="#fff" />
                : <Text style={cs.saveBtnText}>{TEXTOS_DO_BANNER.salvar}</Text>}
            </Pressable>
          </>
        )}
      </View>
    </>
  );
}

// A prévia no padrão do celular do mockup p-132 (versão A): a peça no alto,
// o texto e os botões na cor da loja, a faixa de confiança em 2 × 2. A
// coluna do editor é estreita, então a prévia é sempre a do celular.
function PreviaDoBanner({ banner, padrao, capa, nomeDaPeca, cor }: {
  banner: BannerPersonalizados;
  padrao: Record<CampoDeTexto, string>;
  capa: string | null;
  nomeDaPeca: string | null;
  cor?: string | null;
}) {
  const cs = useChannelStyles();
  const p = usePaletaDoCanal();
  const fundo = /^#[0-9a-f]{6}$/i.test(String(cor || "")) ? String(cor) : "#2a221b";
  const tinta = textoSobre(fundo);
  const faixa = [
    { icone: "✓", titulo: "Você aprova a arte", texto: "antes de produzir" },
    { icone: "↺", titulo: "Troca em até 7 dias", texto: "nas peças de prateleira" },
  ];
  return (
    <View testID="banner-pz-previa">
      <Text style={cs.fieldLabel}>Prévia</Text>
      <View style={[st.previa, { borderColor: p.border }]}>
        <View style={[st.previaFoto, { backgroundColor: "#efe6d6" }]}>
          {capa
            ? <Image testID="banner-pz-capa" source={{ uri: capa }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityLabel={nomeDaPeca || "Foto da peça"} />
            : <Text style={{ fontSize: 12, color: "#51473d" }}>Sem foto, o banner não aparece</Text>}
        </View>
        <View style={[st.previaTexto, { backgroundColor: fundo }]}>
          <Text style={[st.previaKicker, { color: tinta }]}>{textoFinal(banner, "kicker", padrao).toUpperCase()}</Text>
          <Text style={[st.previaTitulo, { color: tinta }]}>{textoFinal(banner, "titulo", padrao)}</Text>
          <Text style={[st.previaCorpo, { color: tinta }]}>{textoFinal(banner, "texto", padrao)}</Text>
          <View style={[st.previaBotao, { backgroundColor: tinta }]}>
            <Text style={{ color: fundo, fontWeight: "700", fontSize: 13 }}>{textoFinal(banner, "botao", padrao)}</Text>
          </View>
          {banner.mostrar_3d ? (
            <View style={[st.previaBotao, { borderWidth: 1, borderColor: tinta, backgroundColor: "transparent" }]}>
              <Text style={{ color: tinta, fontWeight: "700", fontSize: 13 }}>{textoFinal(banner, "botao_3d", padrao)}</Text>
            </View>
          ) : null}
        </View>
        <View style={st.faixa}>
          {faixa.map((f) => (
            <View key={f.titulo} style={st.faixaItem}>
              <Text style={st.faixaIcone}>{f.icone}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.faixaTitulo}>{f.titulo}</Text>
                <Text style={st.faixaTexto}>{f.texto}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <Text style={[cs.hint, { marginTop: 6, marginBottom: 0 }]}>{TEXTOS_DO_BANNER.faixaDica}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  aviso: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12 },
  avisoTxt: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  secundario: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  peca: { width: 104, padding: 6, gap: 4, borderRadius: 12 },
  pecaFoto: { width: "100%", aspectRatio: 1, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previa: { borderWidth: 1, borderRadius: 14, overflow: "hidden", backgroundColor: "#fbf9f6", maxWidth: 375 },
  previaFoto: { height: 170, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previaTexto: { padding: 16, gap: 8 },
  previaKicker: { fontSize: 10.5, letterSpacing: 1.4, fontWeight: "600", opacity: 0.85 },
  previaTitulo: { fontSize: 24, lineHeight: 26, fontWeight: "700" },
  previaCorpo: { fontSize: 12.5, lineHeight: 18 },
  previaBotao: { borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  faixa: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#ffffff" },
  faixaItem: { width: "50%", flexDirection: "row", gap: 8, alignItems: "center", padding: 10, borderTopWidth: 1, borderColor: "rgba(32,26,20,0.12)" },
  faixaIcone: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#efe3cf", color: "#5c4616", textAlign: "center", lineHeight: 24, fontWeight: "700", fontSize: 12, overflow: "hidden" },
  faixaTitulo: { fontSize: 11.5, fontWeight: "700", color: "#201a14" },
  faixaTexto: { fontSize: 10.5, color: "#51473d" },
});
