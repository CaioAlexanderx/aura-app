// ============================================================
// InactivateChoiceDialog — Aura Karatê (federação) · Shoji
//
// Diálogo de escolha ao inativar um dojô com praticantes ativos: dois
// tiles grandes — "Inativar todos" (destrutivo, acento vermelhão) vs.
// "Redistribuir" (acento neutro/positivo) — cada um mostrando o N de
// praticantes afetados em destaque. Extraído de
// app/karate/(federation)/dojos/[dojoId].tsx no polish de motion
// (feat/karate-polish-federacao) pra manter a tela host enxuta; MESMO
// comportamento/contrato de API de antes (só apresentação/motion).
//
// Motion: card entra em scale+fade (ModalPop, mesmo primitivo do
// DestinationPickerModal). Tiles têm hover-lift só web (translateY -2 +
// sombra quente), com fallback touch (o toque já ativa on Press
// normalmente — hover é só reforço visual). Sem tile ativo → mantém o
// botão largo único de antes.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, ViewStyle, TextStyle,
  ActivityIndicator, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { Motion, webTransition } from "@/constants/motion";
import { ModalPop } from "@/components/karate/anim/ModalPop";

const IS_WEB = Platform.OS === "web";
const OK = P.ok ?? "#2d8a4e";
const OK_WASH = P.okWash ?? "rgba(74,122,72,0.12)";
const OK_LINE = P.okLine ?? "rgba(74,122,72,0.30)";

interface Props {
  visible: boolean;
  onClose: () => void;
  busy: boolean;
  dojoName: string;
  /** Contagem de praticantes ativos — null/0 = sem escolha, um único CTA. */
  activeCount: number;
  hasChoice: boolean;
  onInactivateAll: () => void;
  onRedistribute: () => void;
  reducedMotion: boolean;
}

export function InactivateChoiceDialog({
  visible, onClose, busy, dojoName, activeCount, hasChoice, onInactivateAll, onRedistribute, reducedMotion,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onClose()} />
        <ModalPop visible={visible} style={styles.card} duration={reducedMotion ? 0 : 260}>
          <Text style={styles.eyebrow}>空  FPKT · Inativar dojô</Text>
          <Text style={styles.title}>Inativar "{dojoName}"<Text style={{ color: P.red }}>.</Text></Text>
          <Text style={styles.body}>
            {hasChoice
              ? `Este dojô tem ${activeCount} praticante${activeCount === 1 ? "" : "s"} ativo${activeCount === 1 ? "" : "s"}. Escolha o que fazer com eles antes de inativar o dojô.`
              : "Este dojô será inativado."}
          </Text>

          {hasChoice ? (
            <View style={styles.tiles}>
              <ChoiceTile
                icon="power"
                tone="danger"
                count={activeCount}
                title="Inativar todos"
                subtitle="Ação definitiva — não pode ser desfeita"
                disabled={busy}
                onPress={onInactivateAll}
                busy={busy}
              />
              <ChoiceTile
                icon="swap-horizontal"
                tone="positive"
                count={activeCount}
                title="Redistribuir"
                subtitle="Escolha o destino de cada praticante"
                disabled={busy}
                onPress={onRedistribute}
              />
            </View>
          ) : (
            <View style={styles.singleAction}>
              <Pressable
                style={[styles.dangerBtnWide, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={onInactivateAll}
                accessibilityRole="button"
                accessibilityLabel="Inativar dojô"
              >
                {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={styles.dangerBtnTxt}>Inativar dojô</Text>}
              </Pressable>
            </View>
          )}

          <Pressable style={styles.ghostBtn} disabled={busy} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancelar">
            <Text style={styles.ghostBtnTxt}>Cancelar</Text>
          </Pressable>
        </ModalPop>
      </View>
    </Modal>
  );
}

export default InactivateChoiceDialog;

function ChoiceTile({
  icon, tone, count, title, subtitle, disabled, busy, onPress,
}: {
  icon: string;
  tone: "danger" | "positive";
  count: number;
  title: string;
  subtitle: string;
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const toneColor = tone === "danger" ? P.red : OK;
  const toneWash = tone === "danger" ? P.redWash : OK_WASH;
  const toneLine = tone === "danger" ? P.redLine : OK_LINE;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${count} praticante${count === 1 ? "" : "s"}. ${subtitle}`}
      style={[
        tileStyles.tile,
        { borderColor: toneLine, backgroundColor: toneWash },
        hovered && !disabled && ({
          transform: [{ translateY: -2 }],
          ...(IS_WEB ? ({ boxShadow: `0 12px 26px -14px ${toneColor}` } as any) : null),
        } as any),
        disabled && { opacity: 0.5 },
        IS_WEB ? (webTransition(["transform", "box-shadow"], Motion.fast) as any) : null,
      ]}
    >
      <View style={[tileStyles.iconWrap, { backgroundColor: toneColor }]}>
        {busy ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Icon name={icon} size={17} color="#fdf8f2" />}
      </View>
      <Text style={[tileStyles.count, { color: toneColor }]}>{count}</Text>
      <Text style={tileStyles.title}>{title}</Text>
      <Text style={tileStyles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, borderWidth: 1, borderColor: P.line2, padding: 22, width: "100%", maxWidth: 520 } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 4 } as TextStyle,
  body: { fontFamily: F.body, fontSize: 13, color: P.ink2, marginTop: 8, lineHeight: 19 } as TextStyle,

  tiles: { flexDirection: "row", gap: 12, marginTop: 20, flexWrap: "wrap" } as ViewStyle,
  singleAction: { marginTop: 20 } as ViewStyle,

  dangerBtnWide: { flexDirection: "row", gap: 8, paddingVertical: 12, borderRadius: R.md, backgroundColor: P.red, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dangerBtnTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
  btnDisabled: { opacity: 0.5 } as ViewStyle,

  ghostBtn: { paddingVertical: 11, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, alignItems: "center", marginTop: 10 } as ViewStyle,
  ghostBtnTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
});

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1, minWidth: 190, borderRadius: R.lg, borderWidth: 1,
    paddingVertical: 18, paddingHorizontal: 16, alignItems: "flex-start", gap: 4,
  } as ViewStyle,
  iconWrap: {
    width: 34, height: 34, borderRadius: R.md, alignItems: "center", justifyContent: "center", marginBottom: 6,
  } as ViewStyle,
  count: { fontFamily: F.mono, fontSize: 26, fontWeight: "700", lineHeight: 28 } as TextStyle,
  title: { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: P.ink, marginTop: 2 } as TextStyle,
  subtitle: { fontFamily: F.body, fontSize: 11.5, color: P.ink3, lineHeight: 15 } as TextStyle,
});
