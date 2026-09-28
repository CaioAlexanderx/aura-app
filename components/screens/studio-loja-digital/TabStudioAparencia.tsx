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
// 28/09/2026 — o mockup por produto deixou de ser uma fileira de ~13
// chips por linha e virou um seletor único com pré-visualizador
// (components/studio/mockupPorProduto; mockup aprovado em
// docs/mockups/studio-aparencia-seletor-de-mockup.html).
//
// Revisões e SLA continuam nas abas próprias (decisão 5) — aqui só um
// atalho, para a lojista não procurar duas vezes.
// ============================================================
import { useMemo } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Texto } from "@/components/studio/storefront/TipografiaVitrine";
import { Fonts, TIPOGRAFIAS, tipografiaDoStudio } from "@/constants/fonts";
import { lerCorDaLoja } from "@/components/studio/storefront/leituraDaCor";
import { montarTema } from "@/components/studio/storefront/theme";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { router } from "expo-router";
import { SecaoMockupPorProduto } from "@/components/studio/mockupPorProduto/SecaoMockupPorProduto";

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

  const leitura = useMemo(() => lerCorDaLoja(String(corDaLoja || ""), "papel"), [corDaLoja]);
  const tema = useMemo(() => montarTema(corDaLoja, "papel"), [corDaLoja]);
  const par = tipografiaDoStudio(chaveTipografia);
  const rotulo = (TIPOGRAFIAS as any)[String(chaveTipografia || "classic")]?.nome
    || TIPOGRAFIAS.classic.nome;

  const corDoTom =
    leitura.tom === "ok" ? "#34D399" : leitura.tom === "ajustada" ? "#FBBF24" : "#F87171";

  const cartao = {
    backgroundColor: T.paperCard,
    borderRadius: 16, borderWidth: 1, borderColor: T.ink5,
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

      {/* ── Mockup por produto: seletor único e prévia ────── */}
      <SecaoMockupPorProduto companyId={companyId} />

      {/* ── Onde mora o resto ─────────────────────────────── */}
      {/* Os dois moram em lugares diferentes: a política de revisão na
          aba Revisões, o prazo de produção nas Configurações do Studio
          (studio_settings.default_sla_days). O texto antigo mandava a
          lojista procurar o prazo na aba Revisões, onde ele não está. */}
      <View style={[cartao, { gap: 4 }]}>
        <Texto style={{ fontSize: 13, color: T.ink2, lineHeight: 19 }}>
          A política de revisão e o prazo de produção aparecem na vitrine, mas são configurados em outro lugar:
        </Texto>
        {onIrPara ? (
          <Pressable onPress={() => onIrPara("revisions")} accessibilityRole="button" style={{ minHeight: 40, justifyContent: "center" }}>
            <Texto style={{ fontSize: 13, fontWeight: "600", color: T.primary }}>Revisões inclusas e preço da revisão extra: aba Revisões →</Texto>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/studio/configuracoes" as any)} accessibilityRole="link" style={{ minHeight: 40, justifyContent: "center" }}>
          <Texto style={{ fontSize: 13, fontWeight: "600", color: T.primary }}>Prazo de produção: Configurações do Studio →</Texto>
        </Pressable>
      </View>
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
        borderWidth: 1, borderColor: T.ink5,
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
