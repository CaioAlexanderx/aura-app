// ============================================================
// Vitrine Studio · o rodapé inteiro
//
// Três colunas — quem é a loja, como ela atende, por onde navegar — e
// embaixo o jurídico com a assinatura da Aura UMA vez. É o mesmo rodapé
// que a loja comum ganhou em 09/2026; a vitrine terminava a página no
// último produto.
//
// NÃO DECIDE NADA. O que aparece sai de conteudoDoRodape.ts; o texto
// institucional chega pronto do backend (services/rodapeInstitucional.js,
// um módulo só para as duas lojas). Aqui só se desenha.
//
// No celular as colunas viram uma pilha: três colunas de 33% num
// telefone dariam três textos espremidos e ilegíveis.
// ============================================================
import { View, Image, Pressable, Linking, StyleSheet, useWindowDimensions } from "react-native";
import { Texto, Numero, useTipografia } from "./TipografiaVitrine";
import { numeroWhatsApp } from "./AncoraWhatsApp";
import { Icon } from "@/components/Icon";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { montarConteudoDoRodape } from "./conteudoDoRodape";
import { RodapeInstitucional } from "./RodapeInstitucional";
import type { PortaDoRodape } from "./conteudoDoRodape";

/** A assinatura leva ao site do produto — um endereço só, nas duas variantes. */
const SITE_DA_AURA = "https://getaura.com.br";

/** A partir daqui cabem as três colunas lado a lado. */
const LARGURA_DE_TRES_COLUNAS = 760;

// Rótulo em caixa alta: voz dos números (Bricolage), como no kit.
function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <Numero style={[s.etiqueta, { color: cor }]}>{texto}</Numero>;
}

export function RodapeDaVitrine({
  store,
  onAbrirCategoria,
  variante = "atual",
}: {
  store: any;
  onAbrirCategoria?: (porta: PortaDoRodape) => void;
  /**
   * Fase 5 (chave vitrine_v2): o rodapé da home nova, desenhado como o
   * mockup 05 (tela 6) — ícones no endereço e no horário, Instagram e
   * WhatsApp em pílula, formas de pagamento em lista, "Navegue" em duas
   * colunas de alvos de 44 px no celular e a assinatura "Loja
   * desenvolvida com Aura." uma vez só. O conteúdo é o mesmo.
   */
  variante?: "atual" | "nova";
}) {
  if (variante === "nova") return <RodapeNovo store={store} onAbrirCategoria={onAbrirCategoria} />;
  return <RodapeAtual store={store} onAbrirCategoria={onAbrirCategoria} />;
}

function RodapeAtual({
  store,
  onAbrirCategoria,
}: {
  store: any;
  onAbrirCategoria?: (porta: PortaDoRodape) => void;
}) {
  const T = usePaletaDaVitrine();
  const { width } = useWindowDimensions();
  const emColunas = width >= LARGURA_DE_TRES_COLUNAS;

  const r = montarConteudoDoRodape(store);
  if (!r.temAlgo) return null;

  const { identidade } = r;
  const enderecoEHorario = [identidade.endereco, identidade.horario]
    .filter(Boolean)
    .join("\n");

  return (
    <View testID="rodape-da-vitrine" style={[s.caixa, { borderTopColor: T.border }]}>
      <View style={[s.colunas, emColunas ? s.colunasLado : s.colunasPilha]}>
        {/* 1 · Quem é a loja */}
        <View style={[s.coluna, emColunas && s.colunaIdentidade]}>
          {identidade.logoUrl ? (
            <Image
              source={{ uri: identidade.logoUrl }}
              style={s.logo}
              resizeMode="contain"
              accessibilityLabel={identidade.nome}
            />
          ) : (
            <Texto testID="rodape-nome" style={[s.nome, { color: T.ink }]}>
              {identidade.nome}
            </Texto>
          )}

          {enderecoEHorario ? (
            <Texto testID="rodape-endereco" style={[s.corpo, { color: T.ink3 }]}>
              {enderecoEHorario}
            </Texto>
          ) : null}

          {identidade.redes.length > 0 ? (
            <View testID="rodape-redes" style={s.redes}>
              {identidade.redes.map((rede) => (
                <Pressable
                  key={rede.rede + rede.url}
                  onPress={() => Linking.openURL(rede.url)}
                  accessibilityRole="link"
                  accessibilityLabel={`${rede.nome}${rede.handle ? " " + rede.handle : ""}`}
                  style={({ hovered }: any) => [
                    s.rede,
                    { borderColor: T.border, backgroundColor: T.card },
                    hovered && { borderColor: T.primaryTexto },
                  ]}
                >
                  <Texto style={[s.redeTexto, { color: T.ink2 }]}>{rede.nome}</Texto>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* 2 · Como ela atende — texto do backend, desenho daqui */}
        <View style={[s.coluna, emColunas && s.colunaMeio]}>
          <RodapeInstitucional
            rodape={store?.rodape_institucional}
            corDoTexto={T.ink}
            corFraca={T.ink3}
            corDaLinha="transparent"
            compacto
          />
        </View>

        {/* 3 · Por onde navegar */}
        {r.navegacao.length > 0 ? (
          <View testID="rodape-navegacao" style={[s.coluna, emColunas && s.colunaNav]}>
            <Etiqueta texto="Navegue" cor={T.ink3} />
            {r.navegacao.map((porta) => (
              <Pressable
                key={porta.id}
                onPress={() => onAbrirCategoria?.(porta)}
                accessibilityRole="link"
                accessibilityLabel={porta.nome}
                style={({ hovered }: any) => [s.porta, hovered && { opacity: 0.6 }]}
              >
                <Texto style={[s.portaTexto, { color: T.ink2 }]}>{porta.nome}</Texto>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Jurídico e assinatura. A Aura aparece UMA vez, na mesma
          frase-link, com o selo ao lado — igual à loja comum. */}
      <View style={[s.baixo, { borderTopColor: T.border }, emColunas ? s.baixoLado : s.baixoPilha]}>
        <Texto testID="rodape-legal" style={[s.legal, { color: T.ink3 }]}>
          {r.linhaLegal}
        </Texto>
        <View style={s.assinatura}>
          <Pressable
            onPress={() => Linking.openURL(SITE_DA_AURA)}
            accessibilityRole="link"
            accessibilityLabel="Loja desenvolvida com Aura — quero a minha"
          >
            <Texto style={[s.legal, { color: T.ink3 }]}>
              Loja desenvolvida com{" "}
              <Texto style={{ fontWeight: "700", color: T.ink2 }}>Aura.</Texto>
              <Texto style={{ color: T.ink3 }}> — quero a minha</Texto>
            </Texto>
          </Pressable>
          <View style={[s.selo, { borderColor: T.border }]}>
            <Icon name="check" size={11} color={T.ink3} />
            <Texto style={[s.seloTexto, { color: T.ink3 }]}>Loja verificada Aura</Texto>
          </View>
        </View>
      </View>
    </View>
  );
}

/** O glifo do Instagram (o conjunto de ícones do app não tem). */
function Instagram({ cor }: { cor: string }) {
  return (
    <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: cor, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: cor }} />
    </View>
  );
}

function iconeDaForma(forma: string): string {
  const f = forma.toLowerCase();
  if (f.includes("pix")) return "pix";
  if (f.includes("cart")) return "credit_card";
  return "cash";
}

/** A variante da home nova (Fase 5). Mesmo conteúdo, desenho do mockup 05. */
function RodapeNovo({
  store,
  onAbrirCategoria,
}: {
  store: any;
  onAbrirCategoria?: (porta: PortaDoRodape) => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const emColunas = width >= LARGURA_DE_TRES_COLUNAS;
  const r = montarConteudoDoRodape(store);
  if (!r.temAlgo) return null;
  const { identidade } = r;
  const site = store?.site || {};
  const inst = store?.rodape_institucional || {};
  const formas: string[] = Array.isArray(inst.formas) ? inst.formas : [];
  const politica = typeof inst.politica === "string" ? inst.politica.trim() : "";
  const pix = store?.payment?.has_pix ? Number(store?.payment?.pix_discount_pct) || 0 : 0;
  const zap = numeroWhatsApp(site.whatsapp);
  const insta = identidade.redes.find((x: any) => x.rede === "instagram");
  const outras = identidade.redes.filter((x: any) => x !== insta);
  const tagline = typeof site.tagline === "string" ? site.tagline.trim() : "";
  const pilula = (conteudo: React.ReactNode, rotulo: string, url: string) => (
    <Pressable
      key={url}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={rotulo}
      style={({ hovered }: any) => ({ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: hovered ? t.ink3 : t.border, backgroundColor: t.bg2 })}
    >
      {conteudo}
    </Pressable>
  );
  const etiqueta = (texto: string) => (
    <Numero style={{ fontSize: 11, lineHeight: 13, fontWeight: "500", letterSpacing: 1.3, textTransform: "uppercase", color: t.ink3, marginBottom: 12 }}>{texto}</Numero>
  );

  return (
    <View testID="rodape-da-vitrine" style={{ borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg3, paddingHorizontal: emColunas ? 24 : 16, paddingTop: emColunas ? 56 : 40, paddingBottom: 28 }}>
      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: emColunas ? "row" : "column", gap: emColunas ? 48 : 32 }}>
        <View style={{ flex: emColunas ? 1.2 : undefined, gap: 12 }}>
          <Texto testID="rodape-nome" style={{ fontFamily: tipo.display, fontSize: 24, lineHeight: 28, color: t.marcaTexto }}>{identidade.nome}</Texto>
          {tagline ? <Texto style={{ fontSize: 13.5, lineHeight: 20, color: t.ink2 }}>{tagline}</Texto> : null}
          {identidade.endereco ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Icon name="location" size={16} color={t.ink3} />
              <Texto testID="rodape-endereco" style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: t.ink2 }}>{identidade.endereco}</Texto>
            </View>
          ) : null}
          {identidade.horario ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Icon name="clock" size={16} color={t.ink3} />
              <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: t.ink2 }}>{identidade.horario}</Texto>
            </View>
          ) : null}
          {insta || zap || outras.length ? (
            <View testID="rodape-redes" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {insta ? pilula(<><Instagram cor={t.ink} /><Texto style={{ fontSize: 13, color: t.ink }}>@{insta.handle}</Texto></>, `Instagram @${insta.handle}`, insta.url) : null}
              {zap ? pilula(<><Icon name="whatsapp" size={15} color={t.ink} /><Numero style={{ fontSize: 13, color: t.ink }}>{String(site.whatsapp)}</Numero></>, `WhatsApp ${site.whatsapp}`, `https://wa.me/${zap}`) : null}
              {outras.map((x: any) => pilula(<Texto style={{ fontSize: 13, color: t.ink }}>{x.nome}</Texto>, `${x.nome} ${x.handle || ""}`.trim(), x.url))}
            </View>
          ) : null}
        </View>

        {formas.length || politica ? (
          <View testID="rodape-institucional" style={{ flex: emColunas ? 1.2 : undefined }}>
            {formas.length ? (
              <View style={{ marginBottom: politica ? 22 : 0 }}>
                {etiqueta("Formas de pagamento")}
                <View style={{ gap: 8 }}>
                  {formas.map((f) => (
                    <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Icon name={iconeDaForma(f) as any} size={16} color={t.ink2} />
                      <Texto style={{ fontSize: 13.5, color: t.ink }}>{f}</Texto>
                      {pix > 0 && f.toLowerCase().includes("pix") ? (
                        <Texto style={{ fontSize: 12, fontWeight: "600", color: t.green }}>{String(pix).replace(".", ",")}% de desconto</Texto>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {politica ? (
              <View>
                {etiqueta(inst.politica_titulo || "Trocas e devoluções")}
                <Texto testID="rodape-politica" style={{ fontSize: 13.5, lineHeight: 21, color: t.ink2 }}>{politica}</Texto>
              </View>
            ) : null}
          </View>
        ) : null}

        {r.navegacao.length ? (
          <View testID="rodape-navegacao" style={{ flex: emColunas ? 0.8 : undefined }}>
            {etiqueta("Navegue")}
            <View style={{ flexDirection: emColunas ? "column" : "row", flexWrap: "wrap", columnGap: 12 }}>
              {r.navegacao.map((porta) => (
                <Pressable
                  key={porta.id}
                  onPress={() => onAbrirCategoria?.(porta)}
                  accessibilityRole="link"
                  accessibilityLabel={porta.nome}
                  style={({ hovered }: any) => ({ minHeight: 44, justifyContent: "center", width: emColunas ? undefined : "47%", opacity: hovered ? 0.7 : 1 })}
                >
                  <Texto style={{ fontSize: 14.5, color: t.ink2 }}>{porta.nome}</Texto>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", borderTopWidth: 1, borderTopColor: t.border, marginTop: 36, paddingTop: 18, flexDirection: emColunas ? "row" : "column", justifyContent: "space-between", alignItems: emColunas ? "center" : "flex-start", gap: 6 }}>
        <Texto testID="rodape-legal" style={{ fontSize: 12.5, color: t.ink3 }}>{r.linhaLegal}</Texto>
        <Pressable onPress={() => Linking.openURL(SITE_DA_AURA)} accessibilityRole="link" accessibilityLabel="Loja desenvolvida com Aura" style={{ minHeight: 44, justifyContent: "center" }}>
          <Texto style={{ fontSize: 12.5, color: t.ink3 }}>
            Loja desenvolvida com <Texto style={{ fontWeight: "600", color: t.ink2 }}>Aura.</Texto>
          </Texto>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { borderTopWidth: 1, marginTop: 40, paddingTop: 32, paddingHorizontal: 20, paddingBottom: 28 },
  colunas: { width: "100%", maxWidth: 960, alignSelf: "center" },
  colunasLado: { flexDirection: "row", gap: 48, alignItems: "flex-start" },
  colunasPilha: { flexDirection: "column", gap: 28 },
  coluna: { minWidth: 0 },
  colunaIdentidade: { flex: 1.4 },
  colunaMeio: { flex: 1.4 },
  colunaNav: { flex: 1 },

  logo: { width: 132, height: 44, marginBottom: 10, alignSelf: "flex-start" },
  nome: { fontSize: 21, fontWeight: "600", marginBottom: 8 },
  corpo: { fontSize: 13, lineHeight: 20 },

  redes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  rede: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  redeTexto: { fontSize: 12.5, fontWeight: "600" },

  etiqueta: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, fontWeight: "600" },
  // 44px de alvo: no celular estas são as únicas portas do rodapé.
  porta: { paddingVertical: 11, justifyContent: "center" },
  portaTexto: { fontSize: 14 },

  baixo: {
    width: "100%", maxWidth: 960, alignSelf: "center",
    borderTopWidth: 1, marginTop: 28, paddingTop: 18, gap: 12,
  },
  baixoLado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  baixoPilha: { flexDirection: "column", alignItems: "flex-start" },
  legal: { fontSize: 12 },
  assinatura: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  selo: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4 },
  seloTexto: { fontSize: 10.5, letterSpacing: 0.2 },
});
