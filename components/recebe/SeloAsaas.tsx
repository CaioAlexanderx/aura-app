// ============================================================
// SeloAsaas — selo da Asaas nas telas do Recebe na Aura (RA-02, 12/11/2026)
//
// Uso: criação da subconta (passo "Termos e selo"), termos do serviço,
// status da subconta, checkout da loja online e painel de recebimentos
// (RA-06 em diante). Só aparece dentro de telas que já estão atrás da flag
// RECEBE_NA_AURA_ENABLED; este componente não decide visibilidade.
//
// Regras do playbook da Asaas:
//  - três versões do selo, nos links que a Asaas fornece (SELO_ASAAS em
//    constants/recebeNaAura.ts — ainda sem os links oficiais);
//  - a imagem NÃO pode ir com Referrer-Policy no-referrer: a Asaas confere
//    de onde vem a navegação pelo Referer. Na web a imagem é um <img> de
//    verdade com referrerPolicy explícito (o <Image> do react-native-web
//    não repassa o atributo), e o link, se houver, abre com rel="noopener"
//    SEM "noreferrer".
//
// Sem o link oficial (src null) mostra um espaço reservado com o texto de
// responsabilidade. Não desenha logo nenhum: nada de marca inventada.
// ============================================================
import React from "react";
import { View, Text, Image, Pressable, Linking, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  SELO_ASAAS, SELO_ASAAS_TEXTO, SELO_ASAAS_REFERRER_POLICY, type SeloAsaasVersao,
} from "@/constants/recebeNaAura";

type Props = {
  /** Qual das três versões oficiais. Padrão: v1. */
  versao?: SeloAsaasVersao;
  /** Mostra o texto de responsabilidade ao lado do selo. Padrão: true. */
  comTexto?: boolean;
  testID?: string;
};

const isWeb = Platform.OS === "web";

/** Abre o link do selo sem tirar o Referer (nunca "noreferrer"). */
export function abrirLinkDoSelo(href: string) {
  if (isWeb && typeof window !== "undefined" && typeof window.open === "function") {
    window.open(href, "_blank", "noopener");
    return;
  }
  Linking.openURL(href).catch(() => {});
}

function ImagemDoSelo({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  if (isWeb) {
    return React.createElement("img", {
      src, alt, width, height,
      referrerPolicy: SELO_ASAAS_REFERRER_POLICY,
      style: { display: "block", width, height, objectFit: "contain" },
      "data-testid": "selo-asaas-img",
    });
  }
  // No app nativo não existe Referer; a conferência da Asaas é na web.
  return <Image source={{ uri: src }} style={{ width, height }} resizeMode="contain" accessibilityLabel={alt} />;
}

export function SeloAsaas({ versao = "v1", comTexto = true, testID }: Props) {
  const cfg = SELO_ASAAS[versao];
  const pendente = !cfg.src;
  const id = testID || `selo-asaas-${versao}`;

  const corpo = (
    <View style={s.linha}>
      {pendente ? (
        <View
          style={[s.reservado, { minWidth: Math.min(cfg.width, 96), height: cfg.height }]}
          testID={`${id}-pendente`}
          accessibilityLabel="Espaço do selo oficial da Asaas"
        >
          <Text style={s.reservadoTxt}>selo Asaas</Text>
        </View>
      ) : (
        <ImagemDoSelo src={cfg.src as string} alt={cfg.alt} width={cfg.width} height={cfg.height} />
      )}
      {comTexto && <Text style={s.texto}>{SELO_ASAAS_TEXTO}</Text>}
    </View>
  );

  if (cfg.href && !pendente) {
    const href = cfg.href;
    if (isWeb) {
      return (
        <View style={s.caixa} testID={id}>
          {React.createElement(
            "a",
            {
              href, target: "_blank", rel: "noopener",
              referrerPolicy: SELO_ASAAS_REFERRER_POLICY,
              style: { textDecoration: "none" },
              "aria-label": cfg.alt,
            },
            corpo
          )}
        </View>
      );
    }
    return (
      <Pressable style={s.caixa} testID={id} onPress={() => abrirLinkDoSelo(href)} accessibilityRole="link" accessibilityLabel={cfg.alt}>
        {corpo}
      </Pressable>
    );
  }

  return <View style={s.caixa} testID={id}>{corpo}</View>;
}

const s = StyleSheet.create({
  caixa: { alignSelf: "flex-start" },
  linha: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2,
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
  },
  reservado: {
    borderRadius: 6, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 8,
  },
  reservadoTxt: { fontSize: 10, fontWeight: "700", color: "#222222" },
  texto: { fontSize: 12.5, color: Colors.ink2, flexShrink: 1 },
} as any);

export default SeloAsaas;
