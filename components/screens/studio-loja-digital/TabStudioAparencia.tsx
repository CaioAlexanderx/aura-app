// ============================================================
// components/screens/studio-loja-digital/TabStudioAparencia.tsx
//
// Como as escolhas da lojista aparecem NA VITRINE STUDIO.
//
// Por que uma aba separada da "Design", que já existe: a aba Design é
// compartilhada com a loja comum e grava logo, cor, fonte e estilo de
// cartão. O que ela não consegue mostrar é o resultado — e o resultado
// difere entre as duas lojas:
//
//   - a mesma chave tipográfica resolve em famílias diferentes
//     (decisão 1: "Elegante" é Cormorant na loja comum e Fraunces aqui)
//   - a mesma cor tem sorte diferente sobre papel quente
//   - o mockup 3D por produto só existe no Studio, tem endpoint desde
//     03/07/2026 e NUNCA teve tela: `setProductVisualTemplate` era
//     chamável e ninguém tinha por onde chamar
//
// Revisões e SLA continuam nas abas próprias (decisão 5) — aqui só um
// atalho, para a lojista não procurar duas vezes.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Texto } from "@/components/studio/storefront/TipografiaVitrine";
import { Fonts, TIPOGRAFIAS, tipografiaDoStudio } from "@/constants/fonts";
import { lerCorDaLoja } from "@/components/studio/storefront/leituraDaCor";
import { montarTema } from "@/components/studio/storefront/theme";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";

type Produto = { id: string; name: string; visual_template_key?: string | null };

export function TabStudioAparencia({
  config, onIrPara,
}: {
  /** A configuração do canal digital — cor e tipografia vêm dela. */
  config: any;
  onIrPara?: (aba: "design" | "revisions") => void;
}) {
  const T = useStudioTokens();
  const companyId = useAuthStore((s: any) => s.company?.id) as string;
  const corDaLoja = config?.primary_color;
  const chaveTipografia = config?.font_family;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  useEffect(() => {
    if (!companyId) return;
    let vivo = true;
    // A MESMA rota que o Configurador usa: a genérica filtra por
    // vertical=varejo e devolve vazio em conta Studio.
    request<{ products: any[] }>(
      "/companies/" + companyId + "/studio/products?limit=200",
      { method: "GET", retry: 1, timeout: 8000 },
    )
      .then((r) => {
        if (!vivo) return;
        setProdutos((r.products || [])
          .filter((p: any) => p.is_personalizable)
          .map((p: any) => ({ id: p.id, name: p.name, visual_template_key: p.visual_template_key })));
      })
      .catch(() => { if (vivo) setProdutos([]); });
    return () => { vivo = false; };
  }, [companyId]);

  const leitura = useMemo(() => lerCorDaLoja(String(corDaLoja || ""), "papel"), [corDaLoja]);
  const tema = useMemo(() => montarTema(corDaLoja, "papel"), [corDaLoja]);
  const par = tipografiaDoStudio(chaveTipografia);
  const rotulo = (TIPOGRAFIAS as any)[String(chaveTipografia || "classic")]?.nome
    || TIPOGRAFIAS.classic.nome;

  const [templates, setTemplates] = useState<VisualTemplate[] | null>(null);
  const [vinculos, setVinculos] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let vivo = true;
    studioVisualApi.listVisualTemplates(companyId)
      .then((r) => { if (vivo) setTemplates(r.templates || []); })
      .catch(() => { if (vivo) setTemplates([]); });
    return () => { vivo = false; };
  }, [companyId]);

  useEffect(() => {
    const inicial: Record<string, string | null> = {};
    produtos.forEach((p) => { inicial[p.id] = p.visual_template_key || null; });
    setVinculos(inicial);
  }, [produtos]);


  async function vincular(pid: string, key: string | null) {
    const antes = vinculos[pid] ?? null;
    setVinculos((v) => ({ ...v, [pid]: key }));
    setSalvando(pid);
    try {
      await studioVisualApi.setProductVisualTemplate(companyId, pid, key);
    } catch {
      // Volta ao que era: mostrar vinculado o que não salvou faria a
      // lojista contar com uma prévia 3D que a vitrine não tem.
      setVinculos((v) => ({ ...v, [pid]: antes }));
    } finally {
      setSalvando(null);
    }
  }

  const corDoTom =
    leitura.tom === "ok" ? "#34D399" : leitura.tom === "ajustada" ? "#FBBF24" : "#F87171";

  const cartao = {
    backgroundColor: (T as any)?.card,
    borderRadius: 16, borderWidth: 1, borderColor: (T as any)?.border,
    padding: 18, gap: 12,
  } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}>
      <Texto style={{ fontSize: 13, color: (T as any)?.ink2, lineHeight: 19, maxWidth: 620 }}>
        A Aura entrega a estrutura da vitrine; você entra com logo, cor e fotos.
        Esta aba mostra como as suas escolhas chegam na loja de personalizados —
        que resolve algumas delas de um jeito próprio.
      </Texto>

      {/* ── A cor, e o que a vitrine faz com ela ──────────── */}
      <View style={cartao}>
        <Texto style={{ fontSize: 14, fontWeight: "700", color: (T as any)?.ink }}>Sua cor na loja</Texto>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Amostra rotulo="Escolhida" cor={leitura.original} T={T} />
          <Amostra rotulo="Escrita" cor={leitura.comoTexto} T={T} sobre={tema.bg} />
          <Amostra rotulo="Botão" cor={leitura.botao.fundo} T={T} tinta={leitura.botao.tinta} />
        </View>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: corDoTom, marginTop: 5 }} />
          <Texto style={{ flex: 1, fontSize: 12.5, color: (T as any)?.ink2, lineHeight: 18 }}>
            {leitura.recado}
          </Texto>
        </View>

        {onIrPara ? (
          <Pressable onPress={() => onIrPara("design")} accessibilityRole="button">
            <Texto style={{ fontSize: 12, color: (T as any)?.primary || "#7C3AED", fontWeight: "700" }}>
              Trocar a cor na aba Design →
            </Texto>
          </Pressable>
        ) : null}
      </View>

      {/* ── A tipografia, na família que a vitrine usa ────── */}
      <View style={cartao}>
        <Texto style={{ fontSize: 14, fontWeight: "700", color: (T as any)?.ink }}>Sua tipografia aqui</Texto>
        <Texto style={{ fontSize: 12, color: (T as any)?.ink3, lineHeight: 17 }}>
          Você escolheu "{rotulo}". Na loja de personalizados ela vira este par —
          diferente do da loja comum, porque as duas vitrines têm vozes diferentes.
        </Texto>
        <View style={{ backgroundColor: tema.bg, borderRadius: 12, padding: 16, gap: 4 }}>
          <Texto style={{ fontFamily: par.display, fontSize: 26, color: tema.ink }}>
            Presentes que ninguém mais tem
          </Texto>
          <Texto style={{ fontFamily: par.body, fontSize: 13, color: tema.ink2 }}>
            Canecas, camisetas e garrafas com a sua arte, o seu nome, o seu jeito.
          </Texto>
          <Texto style={{ fontFamily: Fonts.mono, fontSize: 11, color: tema.marcaTexto, marginTop: 4 }}>
            R$ 49,90
          </Texto>
        </View>
      </View>

      {/* ── Mockup 3D por produto ─────────────────────────── */}
      <View style={cartao}>
        <Texto style={{ fontSize: 14, fontWeight: "700", color: (T as any)?.ink }}>Mockup 3D por produto</Texto>
        <Texto style={{ fontSize: 12, color: (T as any)?.ink3, lineHeight: 17 }}>
          Produto com mockup deixa o cliente girar a peça e ver a arte dele antes de
          pagar. Sem vínculo, a prévia cai na foto do produto.
        </Texto>

        {templates === null ? (
          <ActivityIndicator color={(T as any)?.primary} />
        ) : templates.length === 0 ? (
          <Texto style={{ fontSize: 12, color: (T as any)?.ink3 }}>
            Nenhum modelo publicado ainda. A Aura mantém esta lista.
          </Texto>
        ) : (
          <View style={{ gap: 10 }}>
            {produtos.map((p) => (
              <View key={p.id} style={{
                gap: 7, paddingVertical: 10,
                borderTopWidth: 1, borderTopColor: (T as any)?.border,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Texto style={{ flex: 1, fontSize: 13, color: (T as any)?.ink }} numberOfLines={1}>
                    {p.name}
                  </Texto>
                  {salvando === p.id ? <ActivityIndicator size="small" color={(T as any)?.primary} /> : null}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Chip
                    rotulo="Sem mockup"
                    ativo={!vinculos[p.id]}
                    onPress={() => vincular(p.id, null)}
                    T={T}
                  />
                  {templates.map((t) => (
                    <Chip
                      key={t.key}
                      rotulo={t.name}
                      nota={t.kind === "model3d" ? "3D" : "2D"}
                      ativo={vinculos[p.id] === t.key}
                      onPress={() => vincular(p.id, t.key)}
                      T={T}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Onde mora o resto ─────────────────────────────── */}
      {onIrPara ? (
        <Pressable onPress={() => onIrPara("revisions")} accessibilityRole="button" style={cartao}>
          <Texto style={{ fontSize: 13, color: (T as any)?.ink2, lineHeight: 19 }}>
            A política de revisão e o prazo de produção aparecem na vitrine, mas são
            configurados na aba Revisões. →
          </Texto>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Amostra({
  rotulo, cor, T, sobre, tinta,
}: { rotulo: string; cor: string; T: any; sobre?: string; tinta?: string }) {
  return (
    <View style={{ gap: 5 }}>
      <View style={{
        width: 92, height: 52, borderRadius: 10, backgroundColor: sobre || cor,
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: (T as any)?.border,
      }}>
        <Texto style={{ fontSize: 13, fontWeight: "700", color: sobre ? cor : (tinta || "#fff") }}>
          Aa
        </Texto>
      </View>
      <Texto style={{ fontFamily: Fonts.mono, fontSize: 9.5, color: (T as any)?.ink3, letterSpacing: 0.6 }}>
        {rotulo.toUpperCase()}
      </Texto>
    </View>
  );
}

function Chip({
  rotulo, nota, ativo, onPress, T,
}: { rotulo: string; nota?: string; ativo: boolean; onPress: () => void; T: any }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      style={{
        paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999,
        borderWidth: 1,
        borderColor: ativo ? ((T as any)?.primary || "#7C3AED") : (T as any)?.border,
        backgroundColor: ativo ? "rgba(124,58,237,0.14)" : "transparent",
        flexDirection: "row", alignItems: "center", gap: 5,
      }}
    >
      <Texto style={{ fontSize: 11.5, color: ativo ? (T as any)?.ink : (T as any)?.ink2 }}>{rotulo}</Texto>
      {nota ? (
        <Texto style={{ fontFamily: Fonts.mono, fontSize: 9, color: (T as any)?.ink3 }}>{nota}</Texto>
      ) : null}
    </Pressable>
  );
}
