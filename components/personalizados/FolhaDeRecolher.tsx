// ============================================================
// AURA. — Personalizados: folha "Recolher a arte e o texto" (p-176)
//
// Abre do cartão "Aguardando personalização" da Fila de produção e do
// detalhe do pedido no Negócio. Desenho: mockup p-131 ("o botão Recolher a
// arte e o texto abre a folha em que a lojista anexa a arte do cliente").
//
//   - UM PASSO SÓ. As peças do pedido ficam uma embaixo da outra, cada uma
//     com os seus campos. Sem wizard, então sem o molde do TrocaModal.
//   - OS CAMPOS SÃO OS DO STUDIO, SEM CÓPIA. Cada campo é desenhado pelo
//     CollectFieldEditor (components/studio/CollectCustomizationModal.tsx),
//     o editor com que a lojista já recolhe a personalização do marketplace
//     no /studio. Os campos vêm do customization_config de cada peça.
//   - ARTE PELO upload-mockup. A imagem sobe pelo POST /studio/upload-mockup
//     (uploadStudioMockup, kind "customization") e o campo guarda a URL.
//   - SALVAR AVANÇA. "Salvar e enviar para a arte" manda avancar:true: o
//     backend grava as peças e leva o pedido para "Aguardando arte" numa
//     transação só. "Guardar sem enviar" (avancar:false) é para quando a
//     arte do cliente ainda não chegou.
//   - O 422 MOSTRA O QUE FALTA. FALTA_PERSONALIZACAO não grava nada e devolve
//     os ids; a folha marca cada peça que falta e diz o nome delas no alto.
//   - OVERLAY. ResponsiveSheet (Modal do react-native-web, que monta em
//     document.body), então o z-index do shell não prende a folha. No
//     celular ela vira folha de baixo.
//
// Multi-CNPJ: companyId vem de quem abre (a loja escolhida); no consolidado
// a tela de fora já pediu "escolha uma loja".
//
// Regras sem tela: regrasDaFolha.ts.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { toast } from "@/components/Toast";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type PersonalizacaoDoPedido, type PersonalizacaoSalva } from "@/services/studioApi";
import { pickImageBase64, uploadStudioMockup } from "@/services/studioUploadApi";
import { CollectFieldEditor, estilosDoCampoDeColeta } from "@/components/studio/CollectCustomizationModal";
import {
  camposDaPeca, corpoDoSalvar, faltamDoErro, fraseDoQueFalta, mensagemDoErro, nomeDaPeca,
  pecaPreenchida, pecasDaFolha, valoresIniciais, type Valores,
} from "@/components/personalizados/regrasDaFolha";

type Props = {
  companyId: string;
  /** id do pedido (o da lista da Fila, view studio_orders). null fecha a folha. */
  pedidoId: string | null;
  onFechar: () => void;
  /** Depois de gravar. `r.avancou` diz se o pedido foi para "Aguardando arte". */
  onSalvo?: (r: PersonalizacaoSalva) => void;
};

export function FolhaDeRecolher({ companyId, pedidoId, onFechar, onSalvo }: Props) {
  return (
    <ResponsiveSheet visible={!!pedidoId} onClose={onFechar} onBackdropPress={() => {}} maxWidth={620}>
      {pedidoId ? (
        <Conteudo key={pedidoId} companyId={companyId} pedidoId={pedidoId} onFechar={onFechar} onSalvo={onSalvo} />
      ) : null}
    </ResponsiveSheet>
  );
}

function Conteudo({ companyId, pedidoId, onFechar, onSalvo }: Props & { pedidoId: string }) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const sc = useMemo(() => estilosDoCampoDeColeta(t), [t]);

  const [dados, setDados] = useState<PersonalizacaoDoPedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroAoAbrir, setErroAoAbrir] = useState<string | null>(null);
  const [valores, setValores] = useState<Valores>({});
  const [faltam, setFaltam] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<"enviar" | "guardar" | null>(null);
  const [subindo, setSubindo] = useState<string | null>(null);

  const abrir = useCallback(async () => {
    setCarregando(true);
    setErroAoAbrir(null);
    try {
      const r = await studioApi.getPersonalizacaoDoPedido(companyId, pedidoId);
      setDados(r);
      setValores(valoresIniciais(r.itens || []));
      setFaltam(null);
    } catch (e: any) {
      setErroAoAbrir(mensagemDoErro(e, "Não deu para abrir as peças deste pedido."));
    } finally {
      setCarregando(false);
    }
  }, [companyId, pedidoId]);

  useEffect(() => { abrir(); }, [abrir]);

  const pecas = useMemo(() => pecasDaFolha(dados?.itens), [dados]);
  const aguardando = dados?.order?.studio_production_status === "awaiting_customization";
  const marcadas = useMemo(() => new Set(faltam || []), [faltam]);

  const mudar = (itemId: string, campoId: string, v: any) => {
    setValores((antes) => ({ ...antes, [itemId]: { ...(antes[itemId] || {}), [campoId]: v } }));
    setErro(null);
  };

  const subirArte = async (itemId: string, campoId: string) => {
    const escolhida = await pickImageBase64().catch((e: any) => {
      toast.error(e?.message || "Não deu para abrir as fotos.");
      return null;
    });
    if (!escolhida) return;
    const chave = `${itemId}:${campoId}`;
    setSubindo(chave);
    try {
      const r = await uploadStudioMockup(companyId, {
        content_base64: escolhida.base64,
        content_type: escolhida.content_type,
        kind: "customization",
      });
      mudar(itemId, campoId, r.url);
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não deu para enviar a imagem. Tente de novo.");
    } finally {
      setSubindo(null);
    }
  };

  const salvar = async (avancar: boolean) => {
    if (!dados || salvando) return;
    setSalvando(avancar ? "enviar" : "guardar");
    setErro(null);
    try {
      const r = await studioApi.salvarPersonalizacaoDoPedido(companyId, pedidoId, corpoDoSalvar(dados.itens, valores, avancar));
      toast.success(r.avancou ? "Arte e texto salvos. O pedido foi para Aguardando arte." : "Arte e texto guardados.");
      onSalvo?.(r);
      onFechar();
    } catch (e: any) {
      const lista = faltamDoErro(e);
      if (lista) {
        setFaltam(lista);
        setErro(fraseDoQueFalta(dados.itens, lista));
      } else {
        setErro(mensagemDoErro(e, "Não deu para salvar. Tente de novo."));
      }
    } finally {
      setSalvando(null);
    }
  };

  const nomeDoCliente = dados?.order?.customer_name || dados?.order?.display_name || "";

  let corpo: React.ReactNode;
  if (carregando) {
    corpo = (
      <View style={s.aviso} testID="folha-carregando">
        <ActivityIndicator color={t.primary} />
        <Text style={s.avisoTxt}>Abrindo as peças do pedido…</Text>
      </View>
    );
  } else if (erroAoAbrir) {
    corpo = (
      <View style={s.aviso} testID="folha-erro-ao-abrir">
        <Text style={s.avisoTxt}>{erroAoAbrir}</Text>
        <Pressable style={s.botaoNeutro} onPress={abrir} accessibilityRole="button" testID="folha-tentar-de-novo">
          <Text style={s.botaoNeutroTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (pecas.length === 0) {
    corpo = (
      <View style={s.aviso} testID="folha-sem-pecas">
        <Text style={s.avisoTxt}>Nenhuma peça deste pedido pede arte ou texto.</Text>
      </View>
    );
  } else {
    corpo = pecas.map((item) => {
      const falta = marcadas.has(String(item.id));
      const pronta = pecaPreenchida(item, valores[item.id]);
      return (
        <View key={item.id} style={[s.peca, falta && s.pecaQueFalta]} testID={`folha-peca-${item.id}`}>
          <View style={s.pecaTopo}>
            <Text style={s.pecaNome} numberOfLines={2}>{nomeDaPeca(item)}</Text>
            {falta ? (
              <View style={[s.selo, { backgroundColor: t.dangerSoft }]} testID={`folha-falta-${item.id}`}>
                <Text style={[s.seloTxt, { color: t.dangerInk }]}>Falta</Text>
              </View>
            ) : pronta ? (
              <View style={[s.selo, { backgroundColor: t.successSoft }]}>
                <Text style={[s.seloTxt, { color: t.successInk }]}>Preenchida</Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 12 }}>
            {camposDaPeca(item).map((campo) => (
              <CollectFieldEditor
                key={campo.id}
                field={campo}
                value={(valores[item.id] || {})[campo.id]}
                onChange={(v) => mudar(item.id, campo.id, v)}
                s={sc}
                t={t}
                uploading={subindo === `${item.id}:${campo.id}`}
                onUpload={() => subirArte(item.id, campo.id)}
              />
            ))}
          </View>
        </View>
      );
    });
  }

  const podeSalvar = !carregando && !erroAoAbrir && pecas.length > 0;

  return (
    <View style={s.folha} testID="folha-recolher">
      <View style={s.topo}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Recolher a arte e o texto</Text>
          <Text style={s.sub} numberOfLines={1}>
            {nomeDoCliente ? `Pedido de ${nomeDoCliente}` : "Arte e texto de cada peça do pedido"}
          </Text>
        </View>
        <Pressable onPress={onFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar" testID="folha-fechar">
          <Text style={s.fecharTxt}>Fechar</Text>
        </Pressable>
      </View>

      <ScrollView style={s.rolagem} contentContainerStyle={s.rolagemDentro}>
        {erro ? (
          <View style={s.erro} testID="folha-aviso-falta" accessibilityLiveRegion="polite">
            <Text style={s.erroTxt}>{erro}</Text>
          </View>
        ) : null}
        {corpo}
      </ScrollView>

      <View style={s.rodape}>
        {aguardando ? (
          <Pressable
            style={[s.botaoNeutro, s.cresce]}
            onPress={() => salvar(false)}
            disabled={!podeSalvar || !!salvando}
            accessibilityRole="button"
            testID="folha-guardar"
          >
            <Text style={s.botaoNeutroTxt}>{salvando === "guardar" ? "Guardando…" : "Guardar sem enviar"}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[s.botaoPrincipal, s.cresce, (!podeSalvar || !!salvando) && { opacity: 0.5 }]}
          onPress={() => salvar(true)}
          disabled={!podeSalvar || !!salvando}
          accessibilityRole="button"
          testID="folha-salvar"
        >
          <Text style={s.botaoPrincipalTxt}>
            {salvando === "enviar" ? "Salvando…" : aguardando ? "Salvar e enviar para a arte" : "Salvar a arte e o texto"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * O botão "Recolher a arte e o texto" com a folha junto, para quem não quer
 * guardar o estado (o detalhe do pedido).
 */
export function BotaoRecolher({
  companyId, pedidoId, onSalvo, testID = "btn-recolher-arte",
}: { companyId: string; pedidoId: string; onSalvo?: (r: PersonalizacaoSalva) => void; testID?: string }) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Pressable
        style={s.botaoDoDetalhe}
        onPress={() => setAberta(true)}
        accessibilityRole="button"
        testID={testID}
      >
        <Text style={s.botaoPrincipalTxt}>Recolher a arte e o texto</Text>
      </Pressable>
      <FolhaDeRecolher
        companyId={companyId}
        pedidoId={aberta ? pedidoId : null}
        onFechar={() => setAberta(false)}
        onSalvo={onSalvo}
      />
    </>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    folha: { backgroundColor: t.paperCard, flexShrink: 1 },
    topo: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.ink5 },
    titulo: { fontSize: 17, fontWeight: "800", color: t.ink },
    sub: { fontSize: 12.5, color: t.ink3, marginTop: 2 },
    fechar: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.ink5 },
    fecharTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },

    rolagem: { flexShrink: 1 },
    rolagemDentro: { padding: 16, gap: 12 },
    aviso: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 36 },
    avisoTxt: { fontSize: 13, color: t.ink3, textAlign: "center", lineHeight: 20 },
    erro: { padding: 12, borderRadius: 10, backgroundColor: t.dangerSoft },
    erroTxt: { fontSize: 12.5, fontWeight: "600", color: t.dangerInk, lineHeight: 18 },

    peca: { padding: 14, gap: 12, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, backgroundColor: t.bg },
    pecaQueFalta: { borderColor: t.dangerInk },
    pecaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    pecaNome: { flex: 1, fontSize: 14, fontWeight: "700", color: t.ink },
    selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    seloTxt: { fontSize: 10.5, fontWeight: "700" },

    rodape: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: t.ink5 },
    cresce: { flexGrow: 1, flexBasis: 180 },
    // 44 px: alvo de toque no celular.
    botaoPrincipal: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.primary },
    botaoPrincipalTxt: { fontSize: 13, fontWeight: "700", color: "#fff", textAlign: "center" },
    botaoNeutro: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCard },
    botaoNeutroTxt: { fontSize: 13, fontWeight: "600", color: t.ink2, textAlign: "center" },
    botaoDoDetalhe: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: t.primary },
  });
}

export default FolhaDeRecolher;
