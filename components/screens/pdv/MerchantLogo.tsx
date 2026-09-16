// ============================================================
// AURA. -- PDV/Caixa · Logo do lojista
//
// 16/09/2026 (Fase 0 · I0.3): substitui a MerchantBanner, que era um painel
// roxo de 200px acima da grade só pra segurar a logo. A logo continua em
// evidência, mas em dois lugares que não custam altura da grade:
//   - `size={48}` no cabeçalho da tela, à esquerda do título;
//   - `size={120}` no carrinho vazio, como cabeçalho de recibo.
//
// De onde vem a logo (confirmado em 16/09/2026):
//   1) `companies/:id/profile.logo_url` — fonte canônica, é o que a tela de
//      Configurações › Perfil grava (useConfigProfile → companiesApi
//      .updateProfile) depois de subir o arquivo pro storage da empresa.
//      Chega aqui pelo useCompanyProfile, o mesmo hook da BrandBanner.
//   2) `useAuthStore().companyLogo` — espelho do mesmo logo_url, hidratado do
//      /auth/me. Serve de fallback enquanto o profile não respondeu, igual ao
//      que a ProfileBanner já faz.
//   A chave `aura_company_logo` do localStorage é só um cache de escrita do
//   ProfileHero: ninguém lê ela de volta hoje, então não entra aqui.
//   O logo do Canal Digital é outro registro (config do site), não é o da
//   empresa — por isso não é lido nesta tela.
//
// Sem logo (ou plano sem direito a logo) cai no tile violeta com a inicial da
// loja, o mesmo do rodapé do menu lateral. Nunca a logo da Aura: quem está na
// tela é a loja, não a gente.
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useAuthStore } from "@/stores/auth";
import { IS_WEB } from "./types";

/** Planos que mostram a logo do lojista — mesma regra da BrandBanner. */
const PLANOS_COM_LOGO = ["negocio", "expansao", "personalizado"];

export function podeMostrarLogo(plan?: string | null): boolean {
  return PLANOS_COM_LOGO.indexOf(String(plan || "").toLowerCase()) >= 0;
}

/** Inicial da loja pro tile violeta. Sem nome, "L" de loja — nunca "A". */
export function initialDaLoja(name?: string | null): string {
  const t = String(name || "").trim();
  if (!t) return "L";
  return t.charAt(0).toUpperCase();
}

/** Nome + logo da loja, já com o gate de plano aplicado. */
export function useMerchantBrand() {
  const { logoUrl, plan, tradeName } = useCompanyProfile();
  const companyLogo = useAuthStore(s => s.companyLogo);
  const url = podeMostrarLogo(plan) ? (logoUrl || companyLogo || null) : null;
  return { logoUrl: url, name: tradeName || "", initial: initialDaLoja(tradeName) };
}

type Props = {
  /** Altura da logo (e lado do tile de inicial). */
  size?: number;
  /** Opacidade suave — usado no carrinho vazio, onde a logo é marca d'água. */
  dim?: boolean;
};

export function MerchantLogo({ size = 48, dim }: Props) {
  const { logoUrl, name, initial } = useMerchantBrand();
  const [erro, setErro] = useState(false);

  useEffect(() => { setErro(false); }, [logoUrl]);

  const radius = Math.max(8, Math.round(size * 0.24));
  const opacity = dim ? 0.75 : 1;

  if (!logoUrl || erro) {
    return (
      <View
        accessibilityLabel={"Loja " + (name || "sem nome")}
        style={[
          s.tile,
          { width: size, height: size, borderRadius: radius, opacity },
          IS_WEB
            ? ({ background: "linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%, #5b21b6 100%)",
                 boxShadow: "0 4px 12px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.25)" } as any)
            : { backgroundColor: Colors.violet },
        ]}
      >
        <Text style={[s.inicial, { fontSize: Math.round(size * 0.42) }]}>{initial}</Text>
      </View>
    );
  }

  // Imagem INTEIRA visível (contain) — logo horizontal e logo quadrada entram
  // do mesmo jeito, sem corte. Na web a largura segue o aspecto real.
  if (IS_WEB) {
    return (
      <View style={[s.plate, { height: size, borderRadius: radius, opacity }]}>
        <img
          src={logoUrl}
          alt={"Logo de " + (name || "sua loja")}
          onError={() => setErro(true)}
          style={{
            height: size,
            width: "auto",
            maxWidth: Math.round(size * 4),
            objectFit: "contain",
            display: "block",
          } as any}
        />
      </View>
    );
  }

  return (
    <View style={[s.plate, { height: size, borderRadius: radius, opacity }]}>
      <Image
        source={{ uri: logoUrl }}
        style={{ width: Math.round(size * 2.4), height: size }}
        resizeMode="contain"
        onError={() => setErro(true)}
        accessibilityLabel={"Logo de " + (name || "sua loja")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  inicial: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: -0.5,
    ...(Platform.OS === "web" ? ({ userSelect: "none" } as any) : {}),
  },
  plate: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
});

export default MerchantLogo;
