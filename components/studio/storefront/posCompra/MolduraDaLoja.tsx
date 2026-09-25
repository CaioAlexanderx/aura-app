// ============================================================
// components/studio/storefront/posCompra/MolduraDaLoja.tsx
//
// A roupa da loja nas páginas do pós-compra (Fase 4): a cor principal da
// lojista (TemaDaVitrine/montarTema no papel quente), a tipografia dela
// (TipografiaDaVitrine + o link do Google Fonts do par escolhido), o
// wordmark ou o logo no topo e a assinatura discreta no rodapé.
//
// Coluna central de até 640 px — celular primeiro; no desktop, a mesma
// coluna no meio da tela, como a página de acompanhar sempre foi (mockup
// da Fase 4, `.pc-desktop-wrap`).
//
// E os tijolos das telas (botão, painel, nota, rótulo), com as medidas do
// kit: alvo de 48 px, raio 12, a voz dos números nos rótulos.
// ============================================================
import { useEffect, type ReactNode } from "react";
import {
  ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { cssDaVitrineStudio } from "@/constants/fonts";
import type { MarcaDaLoja } from "@/services/studioApi";
import { TemaDaVitrine, useTemaDaVitrine } from "../TemaDaVitrine";
import { TipografiaDaVitrine, Texto, estiloNumero, useTipografia } from "../TipografiaVitrine";
import { NOTA, TINTA_SOBRE_VERDE, VERDE_WHATSAPP } from "./posCompra";

export const LARGURA_DA_COLUNA = 640;

/** Carrega o par tipográfico da loja (o mesmo link da vitrine). */
function useFontesDaLoja(chave: string | null | undefined) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const href = cssDaVitrineStudio(chave);
    const existente = document.getElementById("aura-storefront-fonts") as HTMLLinkElement | null;
    if (existente) {
      if (existente.getAttribute("href") !== href) existente.setAttribute("href", href);
      return;
    }
    const link = document.createElement("link");
    link.id = "aura-storefront-fonts";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [chave]);
}

/** O título da aba: "Acompanhar pedido · Sheid Mania". */
function useTituloDaAba(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo || Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = titulo;
  }, [titulo]);
}

/**
 * O tema e a tipografia da loja em volta de uma página. Sem marca (ainda
 * carregando, ou link de loja que não existe mais), o padrão da vitrine.
 */
export function TemaDaLoja({ marca, children }: { marca?: MarcaDaLoja | null; children: ReactNode }) {
  useFontesDaLoja(marca?.font_family);
  return (
    <TemaDaVitrine cor={marca?.primary_color}>
      <TipografiaDaVitrine chave={marca?.font_family}>{children}</TipografiaDaVitrine>
    </TemaDaVitrine>
  );
}

/** O topo: logo da loja, ou o nome dela na letra de título, na cor dela. */
export function CabecalhoDaLoja({ marca, nome }: { marca?: MarcaDaLoja | null; nome: string }) {
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  return (
    <View
      style={{
        alignItems: "center", justifyContent: "center",
        paddingTop: 20, paddingBottom: 16, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: tema.border,
      }}
    >
      {marca?.logo_url ? (
        <Image
          source={{ uri: marca.logo_url }}
          style={{ width: 132, height: 40 }}
          resizeMode="contain"
          accessibilityLabel={nome}
          accessibilityRole="header"
        />
      ) : (
        <Texto
          accessibilityRole="header"
          style={{ fontFamily: tipo.display, fontWeight: "500", fontSize: 19, color: tema.marcaTexto, letterSpacing: -0.2 }}
        >
          {nome}
        </Texto>
      )}
    </View>
  );
}

/**
 * A página inteira: fundo de papel, coluna central, topo da loja e
 * assinatura. `rodape` troca a assinatura padrão.
 */
export function MolduraDaLoja({
  marca, nome, titulo, rodape, children, testID,
}: {
  marca?: MarcaDaLoja | null;
  nome: string;
  titulo?: string | null;
  rodape?: string | null;
  children: ReactNode;
  testID?: string;
}) {
  useTituloDaAba(titulo);
  return (
    <TemaDaLoja marca={marca}>
      <Fundo testID={testID}>
        <CabecalhoDaLoja marca={marca} nome={nome} />
        {children}
        <Assinatura texto={rodape} />
      </Fundo>
    </TemaDaLoja>
  );
}

function Fundo({ children, testID }: { children: ReactNode; testID?: string }) {
  const tema = useTemaDaVitrine();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: tema.bg }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: LARGURA_DA_COLUNA, alignSelf: "center", flexGrow: 1 }}>
        {children}
      </View>
    </ScrollView>
  );
}

function Assinatura({ texto }: { texto?: string | null }) {
  const tema = useTemaDaVitrine();
  return (
    <Texto style={{ textAlign: "center", paddingTop: 10, paddingBottom: 30, paddingHorizontal: 20, color: tema.ink3, fontSize: 12 }}>
      {texto || "Loja desenvolvida com Aura."}
    </Texto>
  );
}

/** Enquanto o pedido carrega: a coluna no papel, sem cor de ninguém. */
export function CarregandoNaLoja({ marca }: { marca?: MarcaDaLoja | null }) {
  return (
    <TemaDaLoja marca={marca}>
      <CarregandoCorpo />
    </TemaDaLoja>
  );
}

function CarregandoCorpo() {
  const tema = useTemaDaVitrine();
  return (
    <View
      style={{ flex: 1, backgroundColor: tema.bg, alignItems: "center", justifyContent: "center", padding: 32 }}
      accessibilityLabel="Carregando seu pedido"
    >
      <ActivityIndicator color={tema.marcaTexto} />
    </View>
  );
}

// ── Tijolos ────────────────────────────────────────────────────

type TipoDeBotao = "primario" | "secundario" | "whatsapp" | "pix";

export function Botao({
  tipo = "primario", icone, rotulo, onPress, desabilitado, carregando, pequeno, style, testID, accessibilityLabel,
}: {
  tipo?: TipoDeBotao;
  icone?: string;
  rotulo: string;
  onPress?: () => void;
  desabilitado?: boolean;
  carregando?: boolean;
  pequeno?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const tema = useTemaDaVitrine();
  const cores =
    tipo === "primario" ? { fundo: tema.marcaFill, tinta: tema.sobreMarca, borda: tema.marcaFill }
    : tipo === "whatsapp" ? { fundo: VERDE_WHATSAPP.fundo, tinta: VERDE_WHATSAPP.tinta, borda: VERDE_WHATSAPP.fundo }
    : tipo === "pix" ? { fundo: NOTA.pix.tinta, tinta: TINTA_SOBRE_VERDE, borda: NOTA.pix.tinta }
    : { fundo: tema.bg2, tinta: tema.ink, borda: tema.border };
  const off = !!desabilitado || !!carregando;
  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || rotulo}
      accessibilityState={{ disabled: off, busy: !!carregando }}
      style={({ pressed }) => [
        {
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          // Alvo: 48 px no cheio; 44 px no pequeno (mínimo de toque).
          minHeight: pequeno ? 44 : 48, paddingHorizontal: pequeno ? 14 : 20,
          borderRadius: pequeno ? 10 : 12, borderWidth: 1,
          backgroundColor: cores.fundo, borderColor: cores.borda,
          opacity: off && !carregando ? 0.55 : 1,
          transform: pressed ? [{ scale: 0.98 }] : undefined,
        },
        Platform.OS === "web" ? ({ cursor: off ? "default" : "pointer" } as any) : null,
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={cores.tinta} />
      ) : icone ? (
        <Icon name={icone as any} size={18} color={cores.tinta} />
      ) : null}
      <Texto style={{ color: cores.tinta, fontSize: pequeno ? 13.5 : 15, fontWeight: "600", flexShrink: 1, textAlign: "center" }}>{rotulo}</Texto>
    </Pressable>
  );
}

/** O cartão branco do kit (`.panel`). */
export function Painel({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const tema = useTemaDaVitrine();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tema.bg2, borderWidth: 1, borderColor: tema.border, borderRadius: 20,
          padding: 20, marginHorizontal: 20, marginTop: 16,
          shadowColor: tema.ink, shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Nota de informação, Pix, âmbar ou erro (`.note`). */
export function Nota({
  tipo, icone, children, style, testID,
}: {
  tipo: keyof typeof NOTA;
  icone: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = NOTA[tipo];
  return (
    <View
      testID={testID}
      style={[{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.fundo }, style]}
    >
      <View style={{ paddingTop: 2 }}><Icon name={icone as any} size={16} color={c.tinta} /></View>
      <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: c.tinta }}>{children}</Texto>
    </View>
  );
}

/** Rótulo em caixa alta na voz dos números (`.label`). */
export function Rotulo({ children, style }: { children: ReactNode; style?: any }) {
  const tema = useTemaDaVitrine();
  const par = useTipografia();
  return (
    <Texto style={[estiloNumero(par), { fontSize: 11, fontWeight: "500", letterSpacing: 1.3, textTransform: "uppercase", color: tema.ink3 }, style]}>
      {children}
    </Texto>
  );
}

/** Título de página na letra de título da loja. */
export function Titulo({ children, tamanho = 26, style, centro }: { children: ReactNode; tamanho?: number; style?: any; centro?: boolean }) {
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  return (
    <Texto
      accessibilityRole="header"
      style={[{ fontFamily: tipo.display, fontWeight: "500", fontSize: tamanho, lineHeight: Math.round(tamanho * 1.15), color: tema.ink, letterSpacing: -0.2, textAlign: centro ? "center" : undefined }, style]}
    >
      {children}
    </Texto>
  );
}

/** Ícone num círculo (confirmações e erro). */
export function Selo({ icone, tipo }: { icone: string; tipo: keyof typeof NOTA }) {
  const c = NOTA[tipo];
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.fundo, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icone as any} size={24} color={c.tinta} />
    </View>
  );
}

/** Abre um link externo (WhatsApp) numa aba nova no web. */
export function abrirFora(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener");
    return;
  }
  Linking.openURL(url);
}
