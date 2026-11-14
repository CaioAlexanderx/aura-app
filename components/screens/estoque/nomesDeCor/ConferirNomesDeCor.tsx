// ============================================================
// Nomes de cor para conferir — aviso + modal no Estoque
// (CP5 da revisão de cores, 14/11/2026; tela 4 do mockup aprovado)
//
// Variantes antigas ficaram com o nome da cor cortado em 10 letras ("AZUL
// ESCUR") ou todo em maiúsculas ("OFF WHITE"). Até a lojista confirmar, o
// Caixa e a nota mostram o nome da paleta. Aqui ela vê a sugestão (da
// própria loja ou da paleta), troca se quiser e confirma — um por um, ou
// "Confirmar todas" só para as sugestões únicas da paleta. Nada é gravado
// sem o toque dela. Sem mod próprio (decisão 8): mora no Estoque.
// Regras em regrasDaConferencia.ts; nada depende de hover.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { toast } from "@/components/Toast";
import { coresParaConferirApi, type GrupoParaConferir } from "@/services/coresParaConferirApi";
import {
  nomeInicial, deOndeVem, gruposDoConfirmarTodas, itensParaGravar, etiquetaHojeEDepois,
} from "./regrasDaConferencia";

export function ConferirNomesDeCor({ companyId, ativo }: { companyId?: string | null; ativo: boolean }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const { data } = useQuery({
    queryKey: ["coresParaConferir", companyId],
    queryFn: () => coresParaConferirApi.listar(companyId!),
    enabled: !!companyId && ativo,
    staleTime: 60000,
  });
  const grupos = (data && data.grupos) || [];
  if (!ativo || !companyId || grupos.length === 0) return null;
  const variantes = grupos.reduce((n, g) => n + g.variantes, 0);

  return (
    <>
      <Pressable onPress={() => setAberto(true)} style={st.banner} testID="aviso-nomes-de-cor" accessibilityRole="button"
        accessibilityLabel="Conferir os nomes de cor">
        <View style={st.bannerIc}><Text style={st.bannerIcTxt}>!</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={st.bannerTit}>{grupos.length + (grupos.length === 1 ? " nome de cor para conferir" : " nomes de cor para conferir")}</Text>
          <Text style={st.bannerTxt}>{"Nomes cortados ou em maiúsculas em " + variantes + (variantes === 1 ? " variante" : " variantes") + ". Até você confirmar, o Caixa e a nota mostram o nome da paleta."}</Text>
        </View>
        <View style={st.bannerCta}><Text style={st.bannerCtaTxt}>Conferir</Text><Text style={st.bannerCtaTxt}>{"›"}</Text></View>
      </Pressable>
      {aberto ? (
        <ModalDeConferencia
          companyId={companyId}
          grupos={grupos}
          onFechar={() => {
            setAberto(false);
            qc.invalidateQueries({ queryKey: ["coresParaConferir", companyId] });
            qc.invalidateQueries({ queryKey: ["products", companyId] });
          }}
        />
      ) : null}
    </>
  );
}

export function ModalDeConferencia({ companyId, grupos, onFechar }: {
  companyId: string;
  grupos: GrupoParaConferir[];
  onFechar: () => void;
}) {
  const { width } = useWindowDimensions();
  const estreita = width < 600;
  const [nomes, setNomes] = useState<Record<string, string>>(() => Object.fromEntries(grupos.map((g) => [g.chave, nomeInicial(g)])));
  const [feitos, setFeitos] = useState<Record<string, string>>({});
  const [ordem, setOrdem] = useState<string[]>(() => grupos.map((g) => g.chave));
  const [enviando, setEnviando] = useState(false);
  const porChave = Object.fromEntries(grupos.map((g) => [g.chave, g]));
  const feitosSet = new Set(Object.keys(feitos));
  const todas = gruposDoConfirmarTodas(grupos, feitosSet);

  async function gravar(lista: GrupoParaConferir[], nomeDe: (g: GrupoParaConferir) => string) {
    const itens = lista.flatMap((g) => itensParaGravar(g, nomeDe(g)));
    if (!itens.length || enviando) return;
    setEnviando(true);
    try {
      const r = await coresParaConferirApi.confirmar(companyId, itens);
      setFeitos((f) => {
        const novo = { ...f };
        for (const g of lista) novo[g.chave] = nomeDe(g).trim();
        return novo;
      });
      toast.success(lista.length === 1 ? "Nome confirmado." : lista.length + " nomes confirmados.");
      if (r && r.recusados > 0) toast.info(r.recusados + " produto(s) não estão mais nesta loja e ficaram como estavam.");
    } catch (e: any) {
      toast.error(e?.message || "Não consegui gravar agora. Nada foi mudado.");
    } finally {
      setEnviando(false);
    }
  }

  const feitosN = Object.keys(feitos).length;
  return (
    <ResponsiveSheet visible onClose={onFechar} maxWidth={760}>
      <View style={st.cabeca}>
        <View style={{ flex: 1 }}>
          <Text style={st.titulo}>Nomes de cor para conferir</Text>
          <Text style={st.sub}>{feitosN + " de " + grupos.length + " confirmados · nada muda sem o seu toque"}</Text>
        </View>
        <Pressable onPress={onFechar} style={st.fechar} accessibilityLabel="Fechar a conferência de nomes de cor">
          <Text style={st.fecharTxt}>Fechar</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
        <Pressable
          onPress={() => gravar(todas, (g) => (g.sugestao ? g.sugestao.nome : ""))}
          disabled={todas.length === 0 || enviando}
          style={[st.todas, (todas.length === 0 || enviando) && st.btnOff]}
          accessibilityLabel="Confirmar as sugestões únicas da paleta"
          testID="confirmar-todas"
        >
          <Text style={[st.todasTxt, todas.length === 0 && { color: Colors.ink3 }]}>
            {todas.length > 0 ? "Confirmar as " + todas.length + (todas.length === 1 ? " sugestão única da paleta" : " sugestões únicas da paleta") : "Sugestões únicas da paleta confirmadas"}
          </Text>
        </Pressable>
        <Text style={st.dica}>O "Confirmar" de baixo vale para os outros: nome que veio da loja, mais de uma opção ou nome em maiúsculas.</Text>

        {ordem.map((chave) => {
          const g = porChave[chave];
          if (!g) return null;
          const nome = nomes[chave] || "";
          const feito = feitos[chave];
          const etq = etiquetaHojeEDepois(g, feito || nome);
          return (
            <View key={chave} style={[st.linha, estreita && st.linhaEstreita, feito ? st.linhaFeita : null]} testID={"conferir-" + g.pedaco}>
              <View style={[st.colPedaco, estreita && { width: "100%" as any }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[st.amostra, { backgroundColor: g.hex }]} />
                  <Text style={st.pedaco}>{g.pedaco}</Text>
                </View>
                <Text style={st.contagem}>{g.variantes + (g.variantes === 1 ? " variante" : " variantes") + " em " + g.produtos + (g.produtos === 1 ? " produto" : " produtos")}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                {feito ? (
                  <Text style={st.feito}>{feito + "  ✓ confirmado"}</Text>
                ) : (
                  <TextInput
                    value={nome}
                    onChangeText={(v) => setNomes((n) => ({ ...n, [chave]: v }))}
                    placeholder="Escreva o nome inteiro"
                    placeholderTextColor={Colors.ink3}
                    maxLength={60}
                    style={st.input}
                    accessibilityLabel={"Nome inteiro de " + g.pedaco}
                  />
                )}
                {!feito ? <Text style={st.fonte}>{"Sugestão: " + deOndeVem(g)}</Text> : null}
                {!feito && g.opcoes.length > 0 ? (
                  <View style={st.opcoes}>
                    {g.opcoes.map((o) => (
                      <Pressable key={o} onPress={() => setNomes((n) => ({ ...n, [chave]: o }))} style={st.opcao} accessibilityLabel={"Usar " + o}>
                        <Text style={st.opcaoTxt}>{o}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={st.impacto}>
                  {feito
                    ? "Caixa, nota, vitrine e etiqueta: \"" + etq.depois + "\""
                    : "Hoje — Caixa e nota: \"" + g.hoje + "\" · etiqueta: \"" + etq.hoje + "\"" + (nome.trim() ? " → \"" + etq.depois + "\"" : "")}
                </Text>
              </View>
              {!feito ? (
                <View style={[st.acoes, estreita && { width: "100%" as any, justifyContent: "flex-end" }]}>
                  <Pressable
                    onPress={() => gravar([g], () => nome)}
                    disabled={!nome.trim() || enviando}
                    style={[st.confirmar, (!nome.trim() || enviando) && st.btnOff]}
                    accessibilityLabel={"Confirmar o nome de " + g.pedaco}
                  >
                    <Text style={[st.confirmarTxt, !nome.trim() && { color: Colors.ink3 }]}>Confirmar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setOrdem((o) => [...o.filter((x) => x !== chave), chave])}
                    style={st.depois}
                    accessibilityLabel={"Deixar " + g.pedaco + " para depois"}
                  >
                    <Text style={st.depoisTxt}>Depois</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={st.notaEtiqueta}>
          <Text style={st.notaEtiquetaTxt}>Etiqueta: a de uma cor confirmada passa a sair com o nome confirmado. Quem não confirmar nada continua imprimindo igual.</Text>
        </View>
      </ScrollView>
    </ResponsiveSheet>
  );
}

const st = {
  banner: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.amber, backgroundColor: Colors.amberD,
  },
  bannerIc: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.amber, alignItems: "center" as const, justifyContent: "center" as const },
  bannerIcTxt: { color: "#fff", fontWeight: "800" as const },
  bannerTit: { fontSize: 13, fontWeight: "700" as const, color: Colors.ink },
  bannerTxt: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 17 },
  bannerCta: { flexDirection: "row" as const, gap: 4, alignItems: "center" as const, minHeight: 32 },
  bannerCtaTxt: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.violet3 },
  cabeca: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10, padding: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  titulo: { fontSize: 15, fontWeight: "700" as const, color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  fechar: { minHeight: 34, paddingHorizontal: 12, justifyContent: "center" as const, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2 },
  fecharTxt: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.violet3 },
  todas: { minHeight: 40, paddingHorizontal: 14, justifyContent: "center" as const, alignItems: "center" as const, borderRadius: 10, backgroundColor: Colors.violet },
  todasTxt: { fontSize: 13, fontWeight: "700" as const, color: "#fff" },
  btnOff: { backgroundColor: Colors.bg4 },
  dica: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  linha: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  linhaEstreita: { flexDirection: "column" as const, alignItems: "stretch" as const },
  linhaFeita: { borderColor: Colors.green, backgroundColor: Colors.greenD },
  colPedaco: { width: 150, gap: 3 },
  amostra: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.18)" },
  pedaco: { fontSize: 13, fontWeight: "700" as const, color: Colors.ink, letterSpacing: 0.3 },
  contagem: { fontSize: 11.5, color: Colors.ink3 },
  input: {
    minHeight: 38, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg2, color: Colors.ink, fontSize: 13,
  },
  fonte: { fontSize: 11, color: Colors.ink3 },
  opcoes: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  opcao: { minHeight: 32, paddingHorizontal: 10, justifyContent: "center" as const, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD },
  opcaoTxt: { fontSize: 12, fontWeight: "600" as const, color: Colors.violet3 },
  impacto: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  feito: { fontSize: 13.5, fontWeight: "700" as const, color: Colors.ink },
  acoes: { flexDirection: "row" as const, gap: 6, alignItems: "center" as const },
  confirmar: { minHeight: 34, paddingHorizontal: 12, justifyContent: "center" as const, borderRadius: 8, backgroundColor: Colors.green },
  confirmarTxt: { fontSize: 12.5, fontWeight: "700" as const, color: "#fff" },
  depois: { minHeight: 34, paddingHorizontal: 12, justifyContent: "center" as const, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2 },
  depoisTxt: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.violet3 },
  notaEtiqueta: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2 },
  notaEtiquetaTxt: { fontSize: 11.5, color: Colors.ink2, lineHeight: 16 },
};

export default ConferirNomesDeCor;
