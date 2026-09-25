// ============================================================
// components/studio/storefront/ui/Formulario.tsx
//
// As peças do checkout em etapas (Fase 2), no desenho do kit
// (docs/mockups/studio-vitrine-00-kit.html: `.field`, `.input`, `.btn`,
// `.note`).
//
// O que muda em relação ao FInput de hoje: o RÓTULO fica em cima e
// sempre visível (placeholder some quando a cliente digita, e ela
// esquece o que o campo pedia — JORNADA §4.6), com a nota de ajuda
// embaixo e o erro dito em palavras. Alvos de 48 px.
// ============================================================
import { forwardRef, type ReactNode } from "react";
import { View, Pressable, TextInput, type TextInputProps } from "react-native";
import { usePaletaDaVitrine, useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, useTipografia, estiloNumero } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { wash, tintaSobre, SUPERFICIE } from "../theme";

/**
 * A borda de campo e botão secundário do kit (`--border2`). O tema só tem
 * a borda de cartão; o campo precisa de um degrau mais firme para ser
 * visto como "lugar de digitar". Neutro do papel, não cor de loja.
 */
export const BORDA_DE_CAMPO = "#D9CFBF";
/** Fundo de botão apagado do kit (`.btn[disabled]`, `--bg4` do papel). */
export const FUNDO_APAGADO = SUPERFICIE.papel.bg4;
/** O degrau suave do papel (`--bg3`): faixas de resumo, caixas de endereço. */
export const FUNDO_SUAVE = SUPERFICIE.papel.bg3;

type CampoProps = TextInputProps & {
  rotulo: string;
  opcional?: boolean;
  nota?: string | null;
  erro?: string | null;
  /** Ícone ou marca à direita, dentro do campo (o ✓ do CEP). */
  direita?: ReactNode;
  numerico?: boolean;
  largura?: number | string;
  testID?: string;
};

export const Campo = forwardRef<TextInput, CampoProps>(function Campo(
  { rotulo, opcional, nota, erro, direita, numerico, largura, style, testID, ...resto },
  ref,
) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  return (
    <View style={{ gap: 6, width: largura as any }}>
      <Texto style={{ fontSize: 13, fontWeight: "600", color: T.ink2 }}>
        {rotulo}
        {opcional ? <Texto style={{ fontWeight: "400", color: T.ink3 }}> (opcional)</Texto> : null}
      </Texto>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={rotulo}
          placeholderTextColor={T.ink4}
          {...resto}
          style={[
            {
              minHeight: 48, borderRadius: 12, borderWidth: 1,
              borderColor: erro ? T.red : BORDA_DE_CAMPO,
              backgroundColor: T.card, paddingHorizontal: 14, paddingRight: direita ? 40 : 14,
              fontSize: 15, color: T.ink, fontFamily: tipo.body,
            },
            numerico ? estiloNumero(tipo) : null,
            erro ? { boxShadow: `0 0 0 3px ${wash(T.red, 0.12)}` } as any : null,
            style as any,
          ]}
        />
        {direita ? (
          <View pointerEvents="none" style={{ position: "absolute", right: 14 }}>{direita}</View>
        ) : null}
      </View>
      {erro ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }} accessibilityLiveRegion="polite">
          <Icon name="alert_circle" size={14} color={T.red} />
          <Texto style={{ fontSize: 12.5, color: T.red, flex: 1 }}>{erro}</Texto>
        </View>
      ) : nota ? (
        <Texto style={{ fontSize: 12.5, lineHeight: 18, color: T.ink3 }}>{nota}</Texto>
      ) : null}
    </View>
  );
});

type Variante = "principal" | "secundario" | "pix" | "whatsapp" | "escuro";

/** Verde do WhatsApp do kit (`.btn-wa`): 5,4:1 com branco. */
export const VERDE_WHATSAPP = "#1F7A4D";

/**
 * Botão do kit. `apagado` é o botão que DIZ o que falta: continua
 * tocável (o toque leva ao campo), só muda de cara. `desativado` é o
 * que não pode ser tocado (enviando).
 */
export function Botao({
  titulo, onPress, variante = "principal", apagado, desativado, icone, iconeDepois,
  acessivel, testID, compacto,
}: {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  apagado?: boolean;
  desativado?: boolean;
  icone?: string;
  iconeDepois?: string;
  acessivel?: string;
  testID?: string;
  compacto?: boolean;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const fundo = apagado ? FUNDO_APAGADO
    : variante === "principal" ? tema.marcaFill
    : variante === "pix" ? T.green
    : variante === "whatsapp" ? VERDE_WHATSAPP
    : variante === "escuro" ? T.ink
    : T.card;
  const tinta = apagado ? T.ink2
    : variante === "principal" ? tema.sobreMarca
    : variante === "secundario" ? T.ink
    : tintaSobre(fundo);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={acessivel || titulo}
      // Apagado continua ativo para o leitor de tela: o toque leva ao campo
      // que falta, e o rótulo já diz o que é ("Falta seu nome").
      accessibilityState={{ disabled: !!desativado, busy: !!desativado }}
      style={({ pressed }) => ({
        minHeight: compacto ? 44 : 48, borderRadius: 12, paddingHorizontal: 18,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: fundo,
        borderWidth: variante === "secundario" && !apagado ? 1 : 0,
        borderColor: BORDA_DE_CAMPO,
        opacity: desativado ? 0.7 : 1,
        transform: [{ scale: pressed && !desativado ? 0.98 : 1 }],
        width: "100%",
      })}
    >
      {icone ? <Icon name={icone} size={17} color={tinta} /> : null}
      <Texto style={{ color: tinta, fontSize: 15, fontWeight: "700", textAlign: "center", flexShrink: 1 }}>
        {titulo}
      </Texto>
      {iconeDepois ? <Icon name={iconeDepois} size={16} color={tinta} /> : null}
    </Pressable>
  );
}

/** A caixinha de marcar ("Quero CPF/CNPJ na nota"), 44 px de alvo. */
export function Caixinha({
  marcada, onTrocar, texto, testID,
}: {
  marcada: boolean;
  onTrocar: (v: boolean) => void;
  texto: string;
  testID?: string;
}) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  return (
    <Pressable
      testID={testID}
      onPress={() => onTrocar(!marcada)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={texto}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
    >
      <View
        style={{
          width: 24, height: 24, borderRadius: 6, borderWidth: marcada ? 0 : 1.5,
          borderColor: BORDA_DE_CAMPO, backgroundColor: marcada ? tema.marcaFill : T.card,
          alignItems: "center", justifyContent: "center",
        }}
      >
        {marcada ? <Icon name="check" size={15} color={tema.sobreMarca} /> : null}
      </View>
      <Texto style={{ fontSize: 15, color: T.ink, flex: 1 }}>{texto}</Texto>
    </Pressable>
  );
}

/** A nota do kit (`.note-*`): âmbar, informativa, verde do Pix, vermelha. */
export function Nota({
  tom, icone, children, testID,
}: {
  tom: "ambar" | "info" | "pix" | "vermelho";
  icone?: string;
  children: ReactNode;
  testID?: string;
}) {
  const T = usePaletaDaVitrine();
  const cor = tom === "ambar" ? T.amber : tom === "pix" ? T.green : tom === "vermelho" ? T.red : "#1D4E89";
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row", gap: 10, alignItems: "flex-start",
        paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
        backgroundColor: wash(cor, tom === "vermelho" ? 0.1 : 0.1),
      }}
    >
      {icone ? <View style={{ paddingTop: 2 }}><Icon name={icone} size={16} color={cor} /></View> : null}
      <Texto style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: cor }}>{children}</Texto>
    </View>
  );
}

/** "Seus dados são protegidos e usados só para este pedido." */
export function LinhaDeProtecao() {
  const T = usePaletaDaVitrine();
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 8 }}>
      <Icon name="lock" size={13} color={T.ink3} />
      <Texto style={{ fontSize: 12.5, color: T.ink3 }}>Seus dados são protegidos e usados só para este pedido.</Texto>
    </View>
  );
}
