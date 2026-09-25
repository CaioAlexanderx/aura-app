// ============================================================
// components/studio/storefront/posCompra/FolhaDeAjuste.tsx
//
// "Pedir ajuste" (mockup da Fase 4, Tela 2): folha que sobe no celular,
// janela no meio da tela no desktop. O que mudar, uma referência
// opcional e — novo — o aviso de quando este ajuste passa a ser cobrado,
// ANTES de a cliente enviar (hoje ela descobria pelo WhatsApp).
//
// Porta o TextInput multiline do modal de app/aprovacao/[token].tsx.
// A referência sobe pelo upload público da vitrine (o mesmo da foto do
// produto) e vai junto da nota que a lojista já lê.
// ============================================================
import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { Icon } from "@/components/Icon";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, useTipografia } from "../TipografiaVitrine";
import { useReduzirMovimento } from "../movimento";
import { apiDoPosCompra } from "./apiDoPosCompra";
import { Botao, Nota, Titulo } from "./MolduraDaLoja";
import { VEU_DA_FOLHA, type AvisoDeAjuste } from "./posCompra";

const LIMITE_DA_REFERENCIA = 15 * 1024 * 1024; // o mesmo do upload público

type Referencia =
  | { estado: "enviando"; nome: string }
  | { estado: "pronta"; nome: string; url: string }
  | { estado: "erro"; nome: string; mensagem: string };

function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result || "").replace(/^data:[^;]+;base64,/, ""));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export function FolhaDeAjuste({
  aberta, nomeDoItem, aviso, slug, enviando, erro, onCancelar, onEnviar,
}: {
  aberta: boolean;
  /** "Caneca Alça Coração"; null quando o pedido tem mais de uma peça. */
  nomeDoItem: string | null;
  aviso: AvisoDeAjuste | null;
  /** Slug da loja: sem ele não há upload de referência. */
  slug: string | null;
  enviando: boolean;
  erro: string | null;
  onCancelar: () => void;
  onEnviar: (nota: string, referenciaUrl: string | null) => void;
}) {
  const tema = useTemaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const reduzir = useReduzirMovimento();
  const larga = width >= 700;
  const [nota, setNota] = useState("");
  const [referencia, setReferencia] = useState<Referencia | null>(null);
  const entrada = useRef<HTMLInputElement | null>(null);

  async function escolheu(arquivo: File | undefined) {
    if (!arquivo || !slug) return;
    if (!/^image\//.test(arquivo.type)) {
      setReferencia({ estado: "erro", nome: arquivo.name, mensagem: "Envie uma imagem (JPG, PNG ou WEBP)." });
      return;
    }
    if (arquivo.size > LIMITE_DA_REFERENCIA) {
      setReferencia({ estado: "erro", nome: arquivo.name, mensagem: "Imagem maior que 15 MB. Tente uma menor." });
      return;
    }
    setReferencia({ estado: "enviando", nome: arquivo.name });
    try {
      const base64 = await lerComoBase64(arquivo);
      const r = await apiDoPosCompra.enviarReferencia(slug, { base64, tipo: arquivo.type, nome: arquivo.name });
      setReferencia({ estado: "pronta", nome: arquivo.name, url: r.url });
    } catch {
      setReferencia({ estado: "erro", nome: arquivo.name, mensagem: "Não conseguimos enviar a imagem. Tente de novo." });
    }
  }

  const titulo = nomeDoItem ? `O que a gente ajusta em ${nomeDoItem}?` : "O que a gente ajusta na sua arte?";
  const podeEnviar = !enviando && referencia?.estado !== "enviando";

  const corpo = (
    <View style={{ gap: 12 }}>
      <View>
        <Titulo tamanho={20}>{titulo}</Titulo>
        <Texto style={{ fontSize: 13, color: tema.ink2, marginTop: 4, lineHeight: 19 }}>
          Quanto mais detalhe, mais rápido voltamos com a versão certa.
        </Texto>
      </View>
      <TextInput
        testID="ajuste-texto"
        value={nota}
        onChangeText={setNota}
        multiline
        accessibilityLabel="O que ajustar"
        placeholder="Ex.: deixar o nome maior · trocar a cor da letra pra dourado · usar uma fonte mais simples"
        placeholderTextColor={tema.ink4}
        style={{
          minHeight: 104, borderRadius: 12, borderWidth: 1, borderColor: tema.border, backgroundColor: tema.bg2,
          paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, lineHeight: 21, color: tema.ink,
          fontFamily: tipo.body, textAlignVertical: "top",
        }}
      />

      {Platform.OS === "web" && slug ? (
        <View>
          {referencia && referencia.estado !== "erro" ? (
            <View
              style={{
                flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
                minHeight: 40, paddingLeft: 12, paddingRight: 4, borderRadius: 10, backgroundColor: tema.bg3,
              }}
            >
              {referencia.estado === "enviando"
                ? <ActivityIndicator size="small" color={tema.ink2} />
                : <Icon name="image" size={16} color={tema.ink2} />}
              <Texto numberOfLines={1} style={{ fontSize: 13, color: tema.ink2, maxWidth: 220 }}>
                {referencia.estado === "enviando" ? "Enviando " + referencia.nome : referencia.nome}
              </Texto>
              <Pressable
                onPress={() => { setReferencia(null); if (entrada.current) entrada.current.value = ""; }}
                accessibilityRole="button"
                accessibilityLabel="Remover anexo"
                hitSlop={6}
                style={{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="x" size={16} color={tema.ink3} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => entrada.current?.click()}
              accessibilityRole="button"
              style={{
                flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
                minHeight: 44, paddingHorizontal: 14, borderRadius: 10,
                borderWidth: 1, borderStyle: "dashed", borderColor: tema.ink4,
                ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
              }}
            >
              <Icon name="upload" size={16} color={tema.ink2} />
              <Texto style={{ fontSize: 13.5, color: tema.ink2, fontWeight: "500" }}>Anexar uma referência (opcional)</Texto>
            </Pressable>
          )}
          {referencia?.estado === "erro" ? (
            <Texto style={{ fontSize: 12.5, color: tema.red, marginTop: 6 }}>{referencia.mensagem}</Texto>
          ) : null}
          {/* @ts-ignore — <input type=file> do DOM, só no web */}
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e: any) => escolheu(e?.target?.files?.[0])}
          />
        </View>
      ) : null}

      {aviso ? (
        <Nota tipo={aviso.tipo === "paga" ? "ambar" : "pix"} icone={aviso.tipo === "paga" ? "alert_circle" : "check"} testID="ajuste-aviso">
          {aviso.texto}
        </Nota>
      ) : null}
      {erro ? <Nota tipo="erro" icone="alert_circle">{erro}</Nota> : null}

      <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
        <Botao tipo="secundario" pequeno rotulo="Cancelar" onPress={onCancelar} desabilitado={enviando} />
        <Botao
          pequeno
          rotulo="Enviar pra loja"
          testID="ajuste-enviar"
          carregando={enviando}
          desabilitado={!podeEnviar}
          onPress={() => onEnviar(nota.trim(), referencia?.estado === "pronta" ? referencia.url : null)}
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible={aberta}
      transparent
      animationType={reduzir ? "none" : larga ? "fade" : "slide"}
      onRequestClose={onCancelar}
    >
      <View
        style={{
          flex: 1, backgroundColor: VEU_DA_FOLHA,
          justifyContent: larga ? "center" : "flex-end", alignItems: larga ? "center" : "stretch",
          padding: larga ? 40 : 0,
        }}
      >
        {/* Tocar fora fecha, como toda folha. */}
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={enviando ? undefined : onCancelar}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
        />
        <View
          testID="folha-de-ajuste"
          accessibilityViewIsModal
          style={
            larga
              ? { width: "100%", maxWidth: 460, backgroundColor: tema.bg2, borderRadius: 20, padding: 26 }
              : { backgroundColor: tema.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 22, paddingBottom: 22, maxHeight: "88%" }
          }
        >
          {!larga ? (
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tema.border, alignSelf: "center", marginTop: 10, marginBottom: 14 }} />
          ) : null}
          {corpo}
        </View>
      </View>
    </Modal>
  );
}
