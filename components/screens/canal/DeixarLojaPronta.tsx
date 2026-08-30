// ============================================================
// Canal digital · Deixar a loja pronta
//
// O ChecklistDaLoja (aba Design) responde "o que falta na LOJA": logo,
// cor, banner. Este bloco responde o que falta nas PEÇAS — e é onde mora
// o trabalho de verdade: a Finesse tem 143 peças publicadas, 37 sem
// tamanho e 143 sem marca.
//
// A diferença que faz este bloco existir: o checklist AVISA, este RESOLVE.
// Mandar a lojista abrir 37 produtos, um a um, pra digitar "M" é o mesmo
// que não avisar. Aqui ela vê as 37 numa lista, digita, e salva uma vez.
//
// COMO ESCREVER AQUI: o texto fala com a lojista sobre o que ELA faz.
// Nada de "campo nulo", "batch", "endpoint".
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, Image, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { useAccent } from "@/contexts/AccentTheme";
import { useChannelStyles } from "./shared";
import {
  usePendencias, useProdutosPendentes, useSalvarEmLote,
  type PendenciaCampo,
} from "@/hooks/usePendenciasDaVitrine";
import {
  AJUDA, aplicarEmTodos, ehEditavel, montarLote, quantasVaoSubir,
  type CampoEditavel, type Rascunho,
} from "./loteDaVitrine";

/** O que dizer quando o campo não é de digitar. */
const COMO_RESOLVER: Record<string, string> = {
  foto: "Essas peças não aparecem na loja. Envie a foto pelo cadastro de cada produto — é o item que mais muda a sua vitrine.",
  foto2: "Uma segunda foto (de costas, ou do tecido de perto) é o que faz a cliente decidir. Envie pela galeria do produto.",
};

export function DeixarLojaPronta() {
  const t = useAccent();
  const cs = useChannelStyles();
  const { data: resumo, isLoading } = usePendencias();
  const [campoAberto, setCampoAberto] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [valorParaTodos, setValorParaTodos] = useState("");

  const { data: lista, isLoading: carregandoLista } = useProdutosPendentes(campoAberto);
  const salvar = useSalvarEmLote();

  const produtos = lista?.produtos || [];
  const aSubir = quantasVaoSubir(rascunho);

  const pendentes = useMemo(
    () => (resumo?.campos || []).filter((c) => c.faltando > 0),
    [resumo]
  );

  function abrir(chave: string) {
    // Trocar de campo joga fora o rascunho de propósito: manter o texto
    // de "tamanho" enquanto ela edita "marca" salvaria M na marca.
    setCampoAberto((atual) => (atual === chave ? null : chave));
    setRascunho({});
    setValorParaTodos("");
  }

  async function salvarLote(campo: CampoEditavel) {
    const itens = montarLote(rascunho, campo);
    if (!itens.length) return;
    await salvar.mutateAsync(itens);
    setRascunho({});
    setValorParaTodos("");
  }

  if (isLoading) {
    return (
      <View style={[cs.card, s.centro]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (!resumo) return null;

  // Loja sem nenhum buraco não precisa de bloco nenhum na tela.
  if (!pendentes.length) {
    return (
      <View style={[cs.card, s.tudoCerto]}>
        <View style={[s.selo, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
          <Icon name="check" size={18} color={Colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Sua loja está pronta</Text>
          <Text style={s.desc}>
            As {resumo.publicadas} peças publicadas têm foto, descrição, tamanho e marca.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={cs.card}>
      <View style={s.cabecalho}>
        <Text style={s.titulo}>Deixar a loja pronta</Text>
        <Text style={s.contagem}>
          {resumo.publicadas} de {resumo.total} peças na loja
        </Text>
      </View>
      <Text style={s.desc}>
        O que falta preencher, na ordem que mais muda a sua loja.
      </Text>

      <View style={{ marginTop: 12, gap: 8 }}>
        {pendentes.map((campo) => {
          // Estreitado FORA do JSX: dentro do onSalvar={() => ...} o
          // TypeScript perde o narrowing do ehEditavel e campo.chave
          // volta a ser string.
          const editavel = ehEditavel(campo.chave) ? campo.chave : null;
          return (
          <CartaoDePendencia
            key={campo.chave}
            campo={campo}
            aberto={campoAberto === campo.chave}
            onAbrir={() => abrir(campo.chave)}
          >
            {campoAberto === campo.chave && (
              editavel ? (
                <Editor
                  campo={editavel}
                  produtos={produtos}
                  carregando={carregandoLista}
                  total={campo.faltando}
                  rascunho={rascunho}
                  setRascunho={setRascunho}
                  valorParaTodos={valorParaTodos}
                  setValorParaTodos={setValorParaTodos}
                  aSubir={aSubir}
                  salvando={salvar.isPending}
                  onSalvar={() => salvarLote(editavel)}
                />
              ) : (
                <Text style={s.comoResolver}>
                  {COMO_RESOLVER[campo.chave] || "Preencha pelo cadastro do produto."}
                </Text>
              )
            )}
          </CartaoDePendencia>
          );
        })}
      </View>
    </View>
  );
}

function CartaoDePendencia({
  campo, aberto, onAbrir, children,
}: {
  campo: PendenciaCampo; aberto: boolean; onAbrir: () => void; children?: React.ReactNode;
}) {
  const t = useAccent();
  return (
    <View style={[s.item, aberto && { borderColor: t.primary }]}>
      <Pressable
        onPress={onAbrir}
        testID={`pendencia-${campo.chave}`}
        style={s.itemCabecalho}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitulo}>{campo.titulo}</Text>
          <Text style={s.itemMedida}>
            {campo.faltando} {campo.faltando === 1 ? "peça" : "peças"}
          </Text>
        </View>
        <Icon name={aberto ? "chevron-up" : "chevron-down"} size={16} color={Colors.ink3} />
      </Pressable>
      {children}
    </View>
  );
}

function Editor({
  campo, produtos, carregando, total, rascunho, setRascunho,
  valorParaTodos, setValorParaTodos, aSubir, salvando, onSalvar,
}: {
  campo: CampoEditavel;
  produtos: Array<{ id: string; name: string; image_url: string | null }>;
  carregando: boolean;
  total: number;
  rascunho: Rascunho;
  setRascunho: (r: Rascunho) => void;
  valorParaTodos: string;
  setValorParaTodos: (v: string) => void;
  aSubir: number;
  salvando: boolean;
  onSalvar: () => void;
}) {
  const t = useAccent();
  const ajuda = AJUDA[campo];

  if (carregando) {
    return <View style={s.centro}><ActivityIndicator color={t.primary} /></View>;
  }

  return (
    <View style={s.editor}>
      <Text style={s.dica}>{ajuda.dica}</Text>

      {/* Aplicar em todas: só faz sentido em campo curto. Uma descrição
          igual pra 143 peças seria pior que descrição nenhuma. */}
      {!ajuda.multilinha && (
        <View style={s.emMassa}>
          <TextInput
            testID="valor-para-todos"
            style={[s.entrada, { flex: 1 }]}
            value={valorParaTodos}
            onChangeText={setValorParaTodos}
            placeholder={`Mesmo ${ajuda.rotulo.toLowerCase()} para todas`}
            placeholderTextColor={Colors.ink3}
            maxLength={ajuda.max}
          />
          <Pressable
            testID="aplicar-em-todas"
            onPress={() =>
              setRascunho(aplicarEmTodos(produtos.map((p) => p.id), valorParaTodos, rascunho))
            }
            style={[s.botaoSecundario, !valorParaTodos.trim() && s.desabilitado]}
            disabled={!valorParaTodos.trim()}
          >
            <Text style={s.botaoSecundarioTexto}>Aplicar</Text>
          </Pressable>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 10 }}>
        {produtos.map((p) => (
          <View key={p.id} style={s.linha}>
            {p.image_url ? (
              <Image source={{ uri: p.image_url }} style={s.miniatura} resizeMode="contain" />
            ) : (
              <View style={[s.miniatura, s.miniaturaVazia]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.nomeDaPeca} numberOfLines={1}>{p.name}</Text>
              <TextInput
                testID={`entrada-${p.id}`}
                style={[s.entrada, ajuda.multilinha && s.entradaAlta]}
                value={rascunho[p.id] ?? ""}
                onChangeText={(v) => setRascunho({ ...rascunho, [p.id]: v })}
                placeholder={ajuda.rotulo}
                placeholderTextColor={Colors.ink3}
                multiline={ajuda.multilinha}
                maxLength={ajuda.max}
              />
            </View>
          </View>
        ))}
      </View>

      {total > produtos.length && (
        <Text style={s.resto}>
          Mostrando {produtos.length} de {total}. Salve estas e as próximas aparecem.
        </Text>
      )}

      <Pressable
        testID="salvar-lote"
        onPress={onSalvar}
        disabled={aSubir === 0 || salvando}
        style={[s.botao, { backgroundColor: t.primary }, (aSubir === 0 || salvando) && s.desabilitado]}
      >
        {salvando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.botaoTexto}>
            {aSubir === 0
              ? "Preencha ao menos uma"
              : aSubir === 1 ? "Salvar 1 peça" : `Salvar ${aSubir} peças`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const s = {
  centro: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titulo: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  contagem: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  desc: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 4 },
  tudoCerto: { flexDirection: "row", alignItems: "center", gap: 12 },
  selo: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  item: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  itemCabecalho: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemTitulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  itemMedida: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  comoResolver: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 10 },
  editor: { marginTop: 10 },
  dica: { fontSize: 11, color: Colors.ink3, lineHeight: 15 },
  emMassa: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  miniatura: { width: 42, height: 42, borderRadius: 8, backgroundColor: Colors.bg3 },
  miniaturaVazia: { borderWidth: 1, borderColor: Colors.border },
  nomeDaPeca: { fontSize: 12, fontWeight: "600", color: Colors.ink, marginBottom: 4 },
  entrada: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2,
  },
  entradaAlta: { minHeight: 64, textAlignVertical: "top" },
  resto: { fontSize: 11, color: Colors.ink3, marginTop: 10, textAlign: "center" },
  botao: { marginTop: 12, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  botaoTexto: { color: "#fff", fontWeight: "800", fontSize: 13 },
  botaoSecundario: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  botaoSecundarioTexto: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  desabilitado: { opacity: 0.45 },
} as any;
