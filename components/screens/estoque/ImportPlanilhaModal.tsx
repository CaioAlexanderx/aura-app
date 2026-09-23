// ============================================================
// AURA. — Estoque · Importar planilha: conferência e relatório
//
// QA de 23/09/2026: escolher o arquivo já gravava ~2.000 produtos sem
// prévia, e o relatório era um toast de 3 s. Este modal é a conferência
// ANTES de gravar (nada entra sem o toque em "Importar N produtos") e,
// depois, o relatório do que entrou e do que ficou de fora — aberto até
// o lojista fechar.
//
// DNA de modal do repo (TrocaModal, CLAUDE.md regra 5): painel de vidro,
// cabeçalho com ícone + título + frase, barra de passos, corpo com
// rolagem, rodapé com a frase de situação à esquerda e as ações à direita
// (confirmar em verde). Dois passos: Conferir -> Resultado.
//
// Só apresentação: o estado vem de hooks/useImportProdutos. A tradução
// da resposta do backend (linha real do arquivo, repetida na planilha x
// já existe na loja, motivo em português) está em utils/importPrevia.
// Renderizado pelo Estoque dentro de WebPortal (overlay dentro do shell
// do RNW fica preso no z-index do pai).
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  numeroBR,
  plural,
  totalForaDaImportacao,
  type LinhaForaDaImportacao,
  type ResultadoImport,
  type ResumoImport,
} from "@/utils/importPrevia";
import type { FaseImport } from "@/hooks/useImportProdutos";

const IS_WEB = Platform.OS === "web";
const LOTE_LISTA = 50;

type Props = {
  fase: FaseImport;
  resumo: ResumoImport | null;
  resultado: ResultadoImport | null;
  erro?: string | null;
  nomeArquivo?: string | null;
  onImportar: () => void;
  onFechar: () => void;
  onBaixarProblemas: () => void;
};

export function ImportPlanilhaModal({ fase, resumo, resultado, erro, nomeArquivo, onImportar, onFechar, onBaixarProblemas }: Props) {
  if (fase === "fechado") return null;

  const pronto = fase === "pronto" && !!resultado;
  const gravando = fase === "gravando";
  const lendo = fase === "lendo" || !resumo;

  const panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  let sub = "Lendo a planilha…";
  if (pronto) sub = "Pronto. Veja o que entrou e o que ficou de fora";
  else if (gravando) sub = "Gravando os produtos na sua loja…";
  else if (!lendo) sub = "Confira antes de gravar. Nada entra sem o seu toque em Importar";

  const listas = pronto ? resultado! : resumo;
  const fora = listas ? totalForaDaImportacao(listas) : 0;

  let rodape = "";
  if (lendo) rodape = "Conferindo com os produtos da sua loja…";
  else if (pronto) rodape = `${plural(resultado!.gravados, "produto entrou", "produtos entraram")} no estoque`;
  else if (gravando) rodape = `Importando ${plural(resumo!.aImportar, "produto", "produtos")}…`;
  else rodape = "Nada foi gravado ainda";

  return (
    <View style={s.overlay} testID="import-previa">
      <Pressable style={s.backdrop} onPress={gravando ? undefined : onFechar} />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]}>

        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Icon name="upload" size={16} color="#a78bfa" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{pronto ? "Importação concluída" : "Importar planilha"}</Text>
              <Text style={s.headerSub}>{sub}</Text>
            </View>
          </View>
          {!gravando && (
            <Pressable onPress={onFechar} style={s.closeBtn} testID="import-fechar-x" accessibilityLabel="Fechar">
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          )}
        </View>

        <View style={s.stepBar}>
          {(["Conferir", "Resultado"] as const).map((label, idx) => {
            const n = idx + 1;
            const ativo = pronto ? n === 2 : n === 1;
            const feito = pronto && n === 1;
            return (
              <View key={label} style={s.stepItem}>
                <View style={[s.stepDot, feito && s.stepDotDone, ativo && s.stepDotActive]}>
                  {feito ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                </View>
                <Text style={[s.stepLabel, (ativo || feito) && { color: ativo ? "#a78bfa" : Colors.ink2, fontWeight: ativo ? "700" : "500" }]}>{label}</Text>
                {idx === 0 && <View style={[s.stepSep, feito && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
              </View>
            );
          })}
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {lendo ? (
            <View style={s.loading} testID="import-lendo">
              <ActivityIndicator size="large" color={Colors.violet3} />
              <Text style={s.loadingTitle}>Lendo {nomeArquivo ? `“${nomeArquivo}”` : "a planilha"}</Text>
              <Text style={s.loadingSub}>Estamos conferindo cada linha com os produtos que você já tem. Planilhas grandes levam alguns segundos.</Text>
            </View>
          ) : (
            <>
              {erro && !pronto && (
                <View style={s.errorBox} testID="import-erro">
                  <Icon name="alert" size={14} color={Colors.red} />
                  <Text style={s.errorTxt}>{erro}</Text>
                </View>
              )}

              {pronto ? <Resultado resultado={resultado!} /> : <Conferencia resumo={resumo!} />}

              <SecaoLista
                id="import-repetidas-planilha"
                titulo={`${plural(listas!.repetidasNaPlanilha.length, "linha repetida", "linhas repetidas")} na planilha`}
                explica="A mesma linha aparece mais de uma vez. Só a primeira entra."
                cor="amber"
                itens={listas!.repetidasNaPlanilha}
              />
              <SecaoLista
                id="import-ja-existem"
                titulo={`${plural(listas!.jaExistem.length, "produto já existe", "produtos já existem")} na sua loja`}
                explica="Não entram de novo, para não duplicar o cadastro. Se o preço mudou, ajuste no produto."
                cor="amber"
                itens={listas!.jaExistem}
              />
              <SecaoLista
                id="import-problemas"
                titulo={plural(listas!.problemas.length, "linha com problema", "linhas com problema")}
                explica="Estas linhas não entram. Corrija na planilha e importe de novo (as que já entraram não duplicam)."
                cor="red"
                itens={listas!.problemas}
              />

              {listas!.unidadesDesconhecidas.valores.length > 0 && (
                <View style={[s.card, s.cardAmber]} testID="import-unidades">
                  <Text style={s.cardTitle}>Unidades que não reconhecemos</Text>
                  <Text style={s.cardText}>
                    {listas!.unidadesDesconhecidas.valores.map(v => `“${v}”`).join(", ")}
                    {listas!.unidadesDesconhecidas.total > 0 ? ` (${plural(listas!.unidadesDesconhecidas.total, "linha", "linhas")})` : ""}
                    . Os produtos entram com a unidade escrita assim; dá para trocar depois no cadastro de cada um.
                  </Text>
                </View>
              )}

              {pronto && resultado!.precoCartaoIgnorado && (
                <View style={[s.card, s.cardAmber]}>
                  <Text style={s.cardText}>O preço no cartão não foi gravado desta vez. Os produtos seguem o acréscimo do cartão da loja.</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerInfo} numberOfLines={2} testID="import-rodape">{rodape}</Text>
          <View style={s.footerActions}>
            {pronto ? (
              <>
                {fora > 0 && (
                  <Pressable style={s.btnSec} onPress={onBaixarProblemas} testID="import-baixar-problemas">
                    <Icon name="download" size={14} color={Colors.ink} />
                    <Text style={s.btnSecTxt}>Baixar lista de problemas</Text>
                  </Pressable>
                )}
                <Pressable style={s.btnPri} onPress={onFechar} testID="import-fechar">
                  <Text style={s.btnPriTxt}>Fechar</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={[s.btnSec, gravando && { opacity: 0.45 }]} onPress={gravando ? undefined : onFechar} disabled={gravando} testID="import-cancelar">
                  <Text style={s.btnSecTxt}>Cancelar</Text>
                </Pressable>
                {!lendo && (
                  <BotaoImportar resumo={resumo!} gravando={gravando} onImportar={onImportar} />
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function BotaoImportar({ resumo, gravando, onImportar }: { resumo: ResumoImport; gravando: boolean; onImportar: () => void }) {
  const n = resumo.aImportar;
  const pode = n > 0 && !gravando;
  return (
    <Pressable
      style={[s.btnConfirm, !pode && { opacity: 0.45 }]}
      onPress={pode ? onImportar : undefined}
      disabled={!pode}
      testID="import-confirmar"
    >
      {gravando
        ? <ActivityIndicator size="small" color="#fff" />
        : (
          <>
            <Icon name="check" size={14} color="#fff" />
            <Text style={s.btnPriTxt}>{n > 0 ? `Importar ${plural(n, "produto", "produtos")}` : "Nenhum produto para importar"}</Text>
          </>
        )}
    </Pressable>
  );
}

function Conferencia({ resumo }: { resumo: ResumoImport }) {
  const origem = resumo.aba
    ? `Lemos a aba “${resumo.aba}”`
    : `Lemos o arquivo${resumo.nomeArquivo ? ` “${resumo.nomeArquivo}”` : ""}`;
  const fora = resumo.repetidasNaPlanilha.length + resumo.jaExistem.length;
  return (
    <>
      <View style={s.card} testID="import-origem">
        <Text style={s.cardTitle}>{origem}</Text>
        <Text style={s.cardText}>
          {plural(resumo.totalLinhas, "linha de produto", "linhas de produto")}
          {resumo.linhaCabecalho > 0 ? ` · nomes das colunas na linha ${resumo.linhaCabecalho}` : ""}
        </Text>
      </View>

      <View style={s.card} testID="import-colunas">
        <Text style={s.cardTitle}>Colunas que vamos usar</Text>
        {resumo.colunas.map(c => (
          <Text key={c.coluna} style={s.colunaLinha}>
            <Text style={s.colunaNome}>{c.coluna}</Text>
            <Text style={s.colunaSeta}>{"  →  "}</Text>
            {c.rotulo}
          </Text>
        ))}
        {resumo.naoUsadas.length > 0 && (
          <Text style={[s.cardText, { marginTop: 8 }]} testID="import-nao-usadas">
            Não usadas: {resumo.naoUsadas.join(", ")}
          </Text>
        )}
        {resumo.faltando.length > 0 && (
          <Text style={[s.cardText, { marginTop: 8, color: Colors.red, fontWeight: "600" }]} testID="import-faltando">
            Não achamos a coluna com {resumo.faltando.join(" nem com ")}. Sem ela, as linhas não entram. Confira o nome da coluna na planilha.
          </Text>
        )}
      </View>

      <View style={s.tiles}>
        <Tile testID="import-n-entram" cor="green" numero={resumo.aImportar} texto={resumo.aImportar === 1 ? "produto vai entrar" : "produtos vão entrar"} />
        <Tile testID="import-n-repetidas" cor="amber" numero={fora} texto={fora === 1 ? "repetida não vai entrar" : "repetidas não vão entrar"} />
        <Tile testID="import-n-problemas" cor="red" numero={resumo.problemas.length} texto={resumo.problemas.length === 1 ? "linha com problema" : "linhas com problema"} />
      </View>

      {resumo.amostra.length > 0 && (
        <View style={s.card} testID="import-amostra">
          <Text style={s.cardTitle}>Como os primeiros vão ficar</Text>
          {resumo.amostra.map((p, i) => (
            <View key={`${p.linha}-${i}`} style={s.amostraLinha}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.amostraNome} numberOfLines={1}>{p.nome}</Text>
                <Text style={s.amostraSub} numberOfLines={1}>
                  {[p.marca, `vende por ${p.unidade}`, p.linha ? `linha ${p.linha}` : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.amostraPreco}>{p.preco}</Text>
                {p.precoCartao && <Text style={s.amostraSub}>cartão {p.precoCartao}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function Resultado({ resultado }: { resultado: ResultadoImport }) {
  const fora = resultado.repetidasNaPlanilha.length + resultado.jaExistem.length;
  return (
    <View style={s.tiles}>
      <Tile testID="import-n-entraram" cor="green" numero={resultado.gravados} texto={resultado.gravados === 1 ? "produto entrou" : "produtos entraram"} />
      <Tile testID="import-n-repetidas" cor="amber" numero={fora} texto={fora === 1 ? "repetida ficou de fora" : "repetidas ficaram de fora"} />
      <Tile testID="import-n-problemas" cor="red" numero={resultado.problemas.length} texto={resultado.problemas.length === 1 ? "linha com problema" : "linhas com problema"} />
    </View>
  );
}

const COR = {
  green: () => ({ fg: Colors.green, bg: Colors.greenD }),
  amber: () => ({ fg: Colors.amber, bg: Colors.amberD }),
  red: () => ({ fg: Colors.red, bg: Colors.redD }),
};

function Tile({ numero, texto, cor, testID }: { numero: number; texto: string; cor: keyof typeof COR; testID: string }) {
  const c = COR[cor]();
  return (
    <View style={[s.tile, { backgroundColor: c.bg, borderColor: c.fg + "40" }]} testID={testID}>
      <Text style={[s.tileNum, { color: c.fg }]}>{numeroBR(numero)}</Text>
      <Text style={s.tileTxt}>{texto}</Text>
    </View>
  );
}

// Lista longa (planilha de 2.000 linhas pode ter centenas de repetidas):
// rolagem própria, 50 de cada vez, com a contagem.
function SecaoLista({ id, titulo, explica, itens, cor }: {
  id: string; titulo: string; explica: string; itens: LinhaForaDaImportacao[]; cor: keyof typeof COR;
}) {
  const [limite, setLimite] = useState(LOTE_LISTA);
  if (itens.length === 0) return null;
  const c = COR[cor]();
  const visiveis = itens.slice(0, limite);
  return (
    <View style={s.card} testID={id}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={[s.dot, { backgroundColor: c.fg }]} />
        <Text style={[s.cardTitle, { marginBottom: 0 }]}>{titulo}</Text>
      </View>
      <Text style={[s.cardText, { marginTop: 4, marginBottom: 8 }]}>{explica}</Text>
      <ScrollView style={s.lista} nestedScrollEnabled>
        {visiveis.map((l, i) => (
          <View key={`${l.linha}-${i}`} style={[s.listaLinha, i % 2 === 1 && s.listaLinhaAlt]}>
            <Text style={s.listaNum}>Linha {l.linha}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.listaNome} numberOfLines={1}>{l.nome}</Text>
              <Text style={[s.listaMotivo, { color: c.fg }]}>{l.motivo}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {itens.length > LOTE_LISTA && (
        <View style={s.listaRodape}>
          <Text style={s.listaConta} testID={`${id}-conta`}>
            Mostrando {numeroBR(visiveis.length)} de {numeroBR(itens.length)}
          </Text>
          {visiveis.length < itens.length && (
            <Pressable onPress={() => setLimite(l => l + LOTE_LISTA)} style={s.maisBtn} testID={`${id}-mais`}>
              <Text style={s.maisTxt}>Mostrar mais {Math.min(LOTE_LISTA, itens.length - visiveis.length)}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 760, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.18)", borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: { width: 28, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 4 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 20, paddingBottom: 8, gap: 12 },
  loading: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 12, gap: 10 },
  loadingTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  loadingSub: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 19, maxWidth: 420 },
  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10,
    backgroundColor: Colors.redD, borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
  },
  errorTxt: { flex: 1, fontSize: 13, color: Colors.red, lineHeight: 18 },
  card: { borderRadius: 12, padding: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  cardAmber: { backgroundColor: Colors.amberD, borderColor: "rgba(245,158,11,0.3)" },
  cardTitle: { fontSize: 13.5, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  cardText: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  colunaLinha: { fontSize: 13, color: Colors.ink2, lineHeight: 21 },
  colunaNome: { fontWeight: "700", color: Colors.ink },
  colunaSeta: { color: Colors.violet3 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: 150, borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  tileNum: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  tileTxt: { fontSize: 12.5, color: Colors.ink2, marginTop: 2 },
  amostraLinha: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.12)",
  },
  amostraNome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  amostraSub: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  amostraPreco: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lista: { maxHeight: 240, borderRadius: 8, borderWidth: 1, borderColor: "rgba(124,58,237,0.14)" },
  listaLinha: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 7, paddingHorizontal: 10 },
  listaLinhaAlt: { backgroundColor: "rgba(124,58,237,0.05)" },
  listaNum: { width: 78, fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  listaNome: { fontSize: 12.5, fontWeight: "600", color: Colors.ink },
  listaMotivo: { fontSize: 12, marginTop: 1 },
  listaRodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" },
  listaConta: { fontSize: 12, color: Colors.ink3 },
  maisBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  maisTxt: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  footer: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)", backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
  },
  footerInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 160, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  btnPri: {
    backgroundColor: Colors.violet, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnConfirm: {
    backgroundColor: "#10b981", paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 200,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
});

export default ImportPlanilhaModal;
