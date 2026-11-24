// ============================================================
// AURA. — Cadastro de item · "Em quais lojas este produto entra?"
//
// 20/11/2026 (plano empresa-do-produto; mockup aprovado, telas a, b, e, f
// e "Depois do Salvar"). Duas peças:
//
//   SecaoLojas       — o campo. Só existe com 2 ou mais lojas no grupo em
//                      que a pessoa mexe no estoque (a lista vem do
//                      servidor ao abrir o modal, nunca do token). A loja
//                      ativa vem marcada e fixa (A1). Grupo com estoque
//                      único (D12): só o aviso, sem caixas de marcar.
//   ResultadoPorLoja — depois do Salvar com 2 ou mais lojas: uma linha por
//                      loja, com "Tentar de novo" na que falhou (D15).
//
// Toque: cada linha tem 44 px de altura e nada depende de passar o mouse.
// ============================================================
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Nota, Secao, s as ui } from "./ui";
import type { CampoDeLojas, LinhaDoResultado } from "./lojasDoCadastro";
import { TEXTO_AVISO_FISCAL, dicaDaEdicao, lojasDoProdutoTxt } from "./lojasDoCadastro";
import { useState } from "react";

export const TEXTO_ESTOQUE_UNICO = "As suas lojas usam um estoque só. Este produto aparece em todas.";

type PropsSecao = {
  campo: CampoDeLojas;
  marcadas: string[];
  onAlternar: (companyId: string) => void;
  narrow: boolean;
};

export function SecaoLojas({ campo, marcadas, onAlternar, narrow }: PropsSecao) {
  if (campo.modo === "nenhum") return null;

  if (campo.modo === "aviso") {
    return (
      <Secao icon="store" titulo="Lojas">
        <View testID="lojas-aviso-estoque-unico">
          <Nota><Text style={ui.notaTxt}>{TEXTO_ESTOQUE_UNICO}</Text></Nota>
        </View>
      </Secao>
    );
  }

  const set = new Set(marcadas.map(String));
  const n = campo.lojas.filter((l) => set.has(String(l.company_id))).length;

  return (
    <Secao icon="store" titulo={narrow ? "Em quais lojas entra?" : "Em quais lojas este produto entra?"}>
      <View testID="lojas-do-cadastro" style={st.lista}>
        {campo.lojas.map((l) => {
          const id = String(l.company_id);
          const marcada = set.has(id);
          // A1: a loja em que estou é a de origem do cadastro — fica fixa.
          // campoDeLojas a põe primeiro, achada pelo id (não pelo `ativa`).
          const fixa = id === String(campo.lojas[0].company_id);
          return (
            <CaixaDeLoja
              key={id}
              testID={"loja-opcao-" + id}
              nome={l.nome}
              marcada={marcada}
              fixa={fixa}
              onPress={() => onAlternar(id)}
            />
          );
        })}
      </View>
      {n >= 2 ? (
        <View style={{ marginTop: 8 }} testID="lojas-aviso-varias">
          <Nota>
            <Text style={ui.notaTxt}>
              {"O produto nasce nas "}
              <Text style={ui.notaForte}>{n + " lojas"}</Text>
              {", com o mesmo código de barras e o mesmo preço. Cada loja controla o seu estoque."}
            </Text>
          </Nota>
        </View>
      ) : (
        <Text style={ui.hint}>Cada loja tem o seu estoque. Marque outra loja para o produto nascer nela também.</Text>
      )}
    </Secao>
  );
}

// Uma loja para marcar: 44 px, sem hover. Também serve aos lotes (A2).
export function CaixaDeLoja({ nome, sub, marcada, fixa, onPress, testID }: {
  nome: string;
  sub?: string | null;
  marcada: boolean;
  /** A loja de origem: marcada e sem toque, com "Você está aqui". */
  fixa?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={fixa ? undefined : onPress}
      disabled={!!fixa}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada, disabled: !!fixa }}
      accessibilityLabel={nome + (fixa ? ", você está aqui" : "")}
      style={[st.loja, marcada && st.lojaOn]}
    >
      <View style={[st.ck, marcada && st.ckOn]}>
        {marcada ? <Icon name="check" size={13} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.nome} numberOfLines={2}>{nome}</Text>
        {sub ? <Text style={st.resTxt}>{sub}</Text> : null}
      </View>
      {fixa ? (
        <View style={st.tag}><Text style={st.tagTxt}>Você está aqui</Text></View>
      ) : null}
    </Pressable>
  );
}

// ── edição (A4, D13, mockup "Na edição") ─────────────────────
//
// Leitura de onde o produto está e "Levar para outra loja" (cria o par lá
// com estoque 0, pela mesma rota da cópia). Mover peças continua sendo
// "Transferir"; tirar de uma loja continua sendo excluir lá.

export const TEXTO_LEVAR_SEM_ESTOQUE = "Nasce lá com estoque 0.";
export const TEXTO_SALVE_ANTES = "Salve antes de levar: a outra loja recebe o cadastro como está gravado.";

type PropsEdicao = {
  em: Array<{ company_id: string; nome: string }>;
  podeLevarPara: Array<{ company_id: string; nome: string }>;
  ativaId: string;
  /** company_id em andamento. */
  levando: string | null;
  resultados: Record<string, LinhaDoResultado>;
  onLevar: (companyId: string) => void;
  sujo: boolean;
};

export function LojasDaEdicao({ em, podeLevarPara, ativaId, levando, resultados, onLevar, sujo }: PropsEdicao) {
  const [aberto, setAberto] = useState(false);
  const ativa = em.find((l) => String(l.company_id) === ativaId);
  return (
    <Secao icon="store" titulo="Lojas">
      <View style={st.res} testID="lojas-da-edicao">
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.nome}>Este produto está em</Text>
          <Text style={st.resTxt}>{lojasDoProdutoTxt(em, ativaId)}</Text>
        </View>
        {podeLevarPara.length > 0 ? (
          <Pressable
            testID="levar-para-outra-loja"
            onPress={() => setAberto(!aberto)}
            style={st.btnTentar}
            accessibilityRole="button"
            accessibilityState={{ expanded: aberto }}
          >
            <Text style={st.btnTentarTxt}>Levar para outra loja</Text>
          </Pressable>
        ) : null}
      </View>
      {aberto ? (
        <View style={[st.lista, { marginTop: 8 }]}>
          {sujo ? <Text style={[ui.hint, { color: Colors.amber, marginTop: 0 }]}>{TEXTO_SALVE_ANTES}</Text> : null}
          {podeLevarPara.map((l) => {
            const id = String(l.company_id);
            const r = resultados[id];
            const indo = levando === id;
            const feito = r && (r.estado === "criado" || r.estado === "ja_existia");
            // Erro que repetir não resolve (código em uso, limite): sem toque.
            const travado = indo || !!feito || sujo || !!levando || (!!r && r.estado === "erro" && !r.podeTentar);
            return (
              <Pressable
                key={id}
                testID={"levar-para-" + id}
                onPress={travado ? undefined : () => onLevar(id)}
                disabled={travado}
                accessibilityRole="button"
                style={[st.loja, feito && st.lojaOn]}
              >
                {indo ? (
                  <View style={st.icone}><ActivityIndicator size="small" color={Colors.violet3} /></View>
                ) : feito ? (
                  <View style={[st.icone, st.iconeOk]}><Icon name="check" size={13} color={Colors.green} /></View>
                ) : r && r.estado === "erro" ? (
                  <View style={[st.icone, st.iconeErro]}><Text style={st.iconeErroTxt}>!</Text></View>
                ) : (
                  <View style={st.icone}><Icon name="plus" size={13} color={Colors.violet3} /></View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.nome} numberOfLines={2}>{l.nome}</Text>
                  <Text style={st.resTxt}>{r ? r.texto : TEXTO_LEVAR_SEM_ESTOQUE}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Text style={ui.hint}>{dicaDaEdicao(ativa ? ativa.nome : "")}</Text>
    </Secao>
  );
}

// ── depois do Salvar ─────────────────────────────────────────

type PropsResultado = {
  linhas: LinhaDoResultado[];
  /** "Subindo fotos 2 de 5": a cópia só sai depois da última foto. */
  progressoTxt: string;
  onTentar: (companyId: string) => void;
  onConcluir: () => void;
  onCadastrarOutro: () => void;
  narrow: boolean;
};

export function ResultadoPorLoja({ linhas, progressoTxt, onTentar, onConcluir, onCadastrarOutro, narrow }: PropsResultado) {
  const pendente = linhas.some((l) => l.estado === "criando");
  return (
    <View style={{ flex: 1, minHeight: 0 }} testID="resultado-por-loja">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.corpo}>
        <View style={st.lista}>
          {linhas.map((l) => (
            <View key={l.company_id} style={st.res} testID={"resultado-loja-" + l.company_id}>
              {l.estado === "criando" ? (
                <View style={st.icone}><ActivityIndicator size="small" color={Colors.violet3} /></View>
              ) : l.estado === "erro" ? (
                <View style={[st.icone, st.iconeErro]}><Text style={st.iconeErroTxt}>!</Text></View>
              ) : (
                <View style={[st.icone, st.iconeOk]}><Icon name="check" size={13} color={Colors.green} /></View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.nome} numberOfLines={2}>{l.nome}</Text>
                <Text style={st.resTxt}>{l.texto}</Text>
                {l.avisoFiscal ? <Text style={[st.resTxt, { color: Colors.amber }]}>{TEXTO_AVISO_FISCAL}</Text> : null}
              </View>
              {l.estado === "erro" && l.podeTentar ? (
                <Pressable
                  testID={"tentar-de-novo-" + l.company_id}
                  onPress={() => onTentar(l.company_id)}
                  style={st.btnTentar}
                  accessibilityRole="button"
                >
                  <Text style={st.btnTentarTxt}>Tentar de novo</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        {progressoTxt ? <Text style={[ui.hint, { marginTop: 10 }]}>{progressoTxt}</Text> : null}
      </ScrollView>
      <View style={[st.rodape, narrow && { flexDirection: "column", alignItems: "stretch" }]}>
        <Pressable
          testID="resultado-cadastrar-outro"
          style={[st.btnSec, pendente && { opacity: 0.45 }, narrow && { alignItems: "center" }]}
          onPress={pendente ? undefined : onCadastrarOutro}
          disabled={pendente}
        >
          <Text style={st.btnSecTxt}>Cadastrar outro</Text>
        </Pressable>
        <Pressable
          testID="resultado-concluir"
          style={[st.btnPri, pendente && { opacity: 0.45 }, narrow && { justifyContent: "center" }]}
          onPress={pendente ? undefined : onConcluir}
          disabled={pendente}
        >
          <Text style={st.btnPriTxt}>Concluir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  lista: { gap: 8 },
  loja: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  lojaOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  ck: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3, flexShrink: 0,
  },
  ckOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  nome: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: "600", color: Colors.ink },
  tag: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  tagTxt: { fontSize: 10.5, fontWeight: "700", color: Colors.violet3 },
  corpo: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12 },
  res: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  icone: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconeOk: { backgroundColor: Colors.greenD },
  iconeErro: { backgroundColor: Colors.redD },
  iconeErroTxt: { color: Colors.red, fontWeight: "700", fontSize: 13 },
  resTxt: { fontSize: 11.5, color: Colors.ink3, marginTop: 1, lineHeight: 16 },
  btnTentar: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 9, flexShrink: 0,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnTentarTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  rodape: {
    flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8,
    paddingHorizontal: 22, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
  },
  btnSec: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
  btnPri: {
    minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: Colors.violet,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
});
