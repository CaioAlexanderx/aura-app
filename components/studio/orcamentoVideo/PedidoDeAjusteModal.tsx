// ============================================================
// Folha "Cliente pediu ajuste" (28/09/2026)
//
// Mesma folha de baixo do "Adicionar item" do editor de orçamento: um
// campo só, obrigatório, até 500 caracteres. Registro interno da lojista.
// Nada de hover: tudo por toque.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Modal, StyleSheet, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { LIMITE_DO_AJUSTE, erroDoAjuste } from "./ajusteDoOrcamento";
import { focoAutomatico, respiroInferior, useModalNoCelular } from "@/components/studio/modalNoCelular";

type Props = {
  visible: boolean;
  t: StudioPalette;
  /** A versão que o cliente viu, para a lojista saber o que está anotando. */
  versao: number;
  onClose: () => void;
  /** Resolve true quando registrou (a folha fecha); false mantém aberta. */
  onConfirmar: (texto: string) => Promise<boolean>;
};

export function PedidoDeAjusteModal({ visible, t, versao, onClose, onConfirmar }: Props) {
  const s = useMemo(() => estilos(t), [t]);
  // Etapa 4 (05/10): no celular a ajuda é uma linha e nada abre o teclado ao entrar.
  const celular = useModalNoCelular();
  const [texto, setTexto] = useState("");
  const [tocou, setTocou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) { setTexto(""); setTocou(false); setSalvando(false); }
  }, [visible]);

  const erro = erroDoAjuste(texto);

  async function confirmar() {
    setTocou(true);
    if (erro || salvando) return;
    setSalvando(true);
    const ok = await onConfirmar(texto.trim());
    setSalvando(false);
    if (ok) onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.bg}>
        <View style={[s.card, celular && s.cardCelular, celular && respiroInferior(16)]} testID="folha-ajuste">
          <View style={s.topo}>
            <Text style={s.titulo} numberOfLines={1}>Cliente pediu ajuste</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10} style={celular ? s.fecharCelular : null} testID="folha-ajuste-fechar">
              <Icon name="x" size={20} color={t.ink3} />
            </Pressable>
          </View>
          {celular ? (
            <Text style={s.ajuda} numberOfLines={1} testID="folha-ajuste-ajuda">Versão {versao}. O orçamento volta a ser editável.</Text>
          ) : (
          <Text style={s.ajuda}>
            Anote o que o cliente pediu na versão {versao}. O orçamento volta a ser editável e o vídeo
            atual fica guardado até você gerar outro. Só você vê esta anotação.
          </Text>
          )}

          <Text style={s.rotulo}>O que o cliente pediu</Text>
          <TextInput
            style={[s.campo, tocou && erro ? s.campoErro : null]}
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={LIMITE_DO_AJUSTE}
            placeholder="Ex.: quer a caneca preta e o nome em letra maior"
            placeholderTextColor={t.ink4}
            autoFocus={focoAutomatico(celular)}
            testID="folha-ajuste-texto"
            accessibilityLabel="O que o cliente pediu"
          />
          <View style={s.linhaInfo}>
            <Text style={[s.erro, !(tocou && erro) && { opacity: 0 }]}>{erro || " "}</Text>
            <Text style={s.contador}>{texto.trim().length}/{LIMITE_DO_AJUSTE}</Text>
          </View>

          <View style={s.acoes}>
            <Pressable style={s.btnCancelar} onPress={onClose} disabled={salvando}>
              <Text style={s.btnCancelarTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[s.btnConfirmar, (salvando || (tocou && !!erro)) && { opacity: 0.5 }]}
              onPress={confirmar}
              disabled={salvando}
              accessibilityLabel="Registrar ajuste"
            >
              {salvando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.btnConfirmarTxt}>Registrar ajuste</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
    card: {
      backgroundColor: t.paperCardElev, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, gap: 8, width: "100%", maxWidth: 560, alignSelf: "center",
    },
    cardCelular: { maxWidth: undefined, paddingHorizontal: 14, paddingTop: 8 },
    fecharCelular: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
    topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    titulo: { fontSize: 17, fontWeight: "800", color: t.ink },
    ajuda: { fontSize: 13, color: t.ink3, lineHeight: 18, marginBottom: 6 },
    rotulo: { fontSize: 12, color: t.ink3, fontWeight: "600" },
    campo: {
      backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10,
      padding: 12, fontSize: 14, color: t.ink, minHeight: 110, textAlignVertical: "top",
    },
    campoErro: { borderColor: t.danger },
    linhaInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    erro: { fontSize: 12, color: t.dangerInk, fontWeight: "600" },
    contador: { fontSize: 11.5, color: t.ink4 },
    acoes: { flexDirection: "row", gap: 10, marginTop: 6 },
    btnCancelar: {
      flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12,
      backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5,
    },
    btnCancelarTxt: { color: t.ink2, fontWeight: "800", fontSize: 14 },
    btnConfirmar: {
      flex: 2, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12,
      backgroundColor: t.primary,
    },
    btnConfirmarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  });
}
