// ============================================================
// AURA. — C2: wizard de migração de categorias (F0)
//
// Converte o texto livre de `products.category` na árvore de 3 níveis,
// com o LOJISTA decidindo cada de-para. Rota: /catalogo/migracao
//
// ── POR QUE ROTA PRÓPRIA, E NÃO DENTRO DE estoque.tsx ───────
// D1 e D2 vão mexer em estoque.tsx — é o maior risco de regressão da
// fase. Mantendo a C2 em arquivo próprio, os PRs ficam disjuntos e o
// ponto de entrada entra depois sem conflito. Mesma disciplina que fez a
// Onda B funcionar em paralelo.
//
// ── SEM IA, POR DECISÃO DE PRODUTO ──────────────────────────
// Nada aqui sugere `kind` nem propõe `target_path`. A tela transporta a
// decisão do lojista e só. O motor de sugestão saiu do escopo na v2.
//
// ── O FLUXO ─────────────────────────────────────────────────
//   1. Analisar  — POST /analyze varre products.category e monta a fila.
//   2. Classificar — por valor: é categoria (e vai para onde), ou é
//      marca / atributo / coleção / descarte.
//   3. Aplicar   — POST /apply, transacional por lote de 100, retomável.
//
// ── O QUE O APPLY FAZ COM CADA `kind` ───────────────────────
//   category   → vincula os produtos ao target_path (o caminho é
//                RESOLVIDO, nunca criado — criar nó é ato deliberado).
//   brand | attribute | collection | discard
//              → limpa products.category de quem não ganhou vínculo.
//                Nenhuma categoria é criada.
//
// ⚠️ `kind` foi corrigido nesta entrega: o B3 tipava
// "existing"|"new"|"ignore", que o backend rejeita com 400. Ver o
// comentário em services/categoriesApi.ts.
// ============================================================
import { useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { useCategoryMigration } from "@/hooks/useCategoryMigration";
import type { MigrationKind, MigrationProposalItem } from "@/services/categoriesApi";

const KINDS: Array<{ key: MigrationKind; label: string; hint: string }> = [
  { key: "category",   label: "É categoria",  hint: "Vira nó da árvore e os produtos são vinculados" },
  { key: "brand",      label: "É marca",      hint: "Ex.: Ramarim, Nike" },
  { key: "attribute",  label: "É atributo",   hint: "Ex.: Preto, 38, Couro" },
  { key: "collection", label: "É coleção",    hint: "Ex.: Verão 26, Liquidação" },
  { key: "discard",    label: "Descartar",    hint: "Lixo de cadastro" },
];

export default function MigracaoCategoriasScreen() {
  const C = useColors();
  const router = useRouter();
  const {
    proposal, orphan, isLoadingProposal, status,
    analyze, isAnalyzing, patchItem, apply, isApplying,
  } = useCategoryMigration();

  // Decisão local por item, para o lojista revisar antes de mandar. O
  // PATCH só sai quando ele confirma a linha — assim ele pode trocar de
  // ideia sem gerar escrita a cada toque.
  const [escolha, setEscolha] = useState<Record<string, MigrationKind>>({});
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [salvos, setSalvos] = useState<Record<string, true>>({});

  const pendentes = useMemo(
    () => proposal.filter((i) => i.status !== "applied"),
    [proposal]
  );
  const prontosParaAplicar = useMemo(
    () => proposal.filter((i) => i.status === "approved").length,
    [proposal]
  );

  function confirmar(item: MigrationProposalItem) {
    const kind = escolha[item.id];
    if (!kind) return;
    const alvo = (destino[item.id] || "").trim();
    // target_path é obrigatório para 'category': o apply resolve o
    // caminho e devolve erro acionável se ele não existir na árvore.
    if (kind === "category" && !alvo) return;

    patchItem(item.id, {
      kind,
      ...(kind === "category" ? { target_path: alvo } : {}),
      status: "approved",
    });
    setSalvos((s) => ({ ...s, [item.id]: true }));
  }

  const s = estilos(C);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.wrap}>
      <Pressable onPress={() => router.back()} style={s.voltar} accessibilityRole="button">
        <Text style={{ color: C.ink3, fontSize: 13 }}>← Voltar</Text>
      </Pressable>

      <Text style={s.titulo}>Organizar categorias do catálogo</Text>
      <Text style={s.sub}>
        Hoje a categoria do produto é um texto solto. Aqui você diz o que cada texto realmente
        é — e o que for categoria vira nó da árvore, com os produtos vinculados.
      </Text>

      {/* ── Passo 1 ─────────────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.passo}>1 · Analisar o catálogo</Text>
        <Text style={s.corpo}>
          Varre os produtos e agrupa os textos de categoria que existem hoje. Pode rodar
          quantas vezes quiser — não duplica nada.
        </Text>
        {status ? (
          <Text style={s.status}>
            {status.total} valor(es) encontrado(s) · {status.approved} classificado(s) ·{" "}
            {status.applied} aplicado(s) · {status.orphans} produto(s) sem categoria nenhuma
          </Text>
        ) : null}
        <Pressable
          onPress={() => analyze()}
          disabled={isAnalyzing}
          style={[s.btn, { backgroundColor: C.ink, opacity: isAnalyzing ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          {isAnalyzing
            ? <ActivityIndicator color={C.bg} />
            : <Text style={[s.btnTxt, { color: C.bg }]}>Analisar catálogo</Text>}
        </Pressable>
      </View>

      {/* ── Passo 2 ─────────────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.passo}>2 · Classificar cada texto</Text>

        {isLoadingProposal ? <ActivityIndicator color={C.ink3} /> : null}

        {!isLoadingProposal && pendentes.length === 0 ? (
          <Text style={s.corpo}>
            Nada na fila. Rode a análise acima para começar.
          </Text>
        ) : null}

        {pendentes.map((item) => {
          const kind = escolha[item.id];
          const precisaDestino = kind === "category";
          const alvo = destino[item.id] || "";
          const podeConfirmar = !!kind && (!precisaDestino || !!alvo.trim());
          const jaSalvo = salvos[item.id] || item.status === "approved";

          return (
            <View key={item.id} style={s.item}>
              <View style={s.itemTopo}>
                <Text style={s.raw}>{item.raw_value}</Text>
                <Text style={s.contagem}>
                  {item.product_count} produto{item.product_count === 1 ? "" : "s"}
                </Text>
              </View>

              {item.sample_product_names?.length ? (
                <Text style={s.exemplos} numberOfLines={2}>
                  ex.: {item.sample_product_names.join(" · ")}
                </Text>
              ) : null}

              <View style={s.kinds}>
                {KINDS.map((k) => {
                  const ativo = kind === k.key;
                  return (
                    <Pressable
                      key={k.key}
                      onPress={() => setEscolha((e) => ({ ...e, [item.id]: k.key }))}
                      style={[s.kind, ativo && { backgroundColor: C.ink, borderColor: C.ink }]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: ativo }}
                    >
                      <Text style={[s.kindTxt, ativo && { color: C.bg }]}>{k.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {kind ? (
                <Text style={s.hint}>{KINDS.find((k) => k.key === kind)?.hint}</Text>
              ) : null}

              {precisaDestino ? (
                <>
                  <TextInput
                    value={alvo}
                    onChangeText={(t) => setDestino((d) => ({ ...d, [item.id]: t }))}
                    placeholder="Caminho na árvore. Ex.: Feminino > Calçados > Sandálias"
                    placeholderTextColor={C.ink3}
                    style={[s.input, { color: C.ink, borderColor: C.border }]}
                  />
                  {/* O apply RESOLVE o caminho, nunca cria. Dizer isso aqui
                      evita o lojista descobrir só no erro do passo 3. */}
                  <Text style={s.aviso}>
                    O caminho precisa existir na árvore. Crie a categoria antes, em
                    Organizar catálogo.
                  </Text>
                </>
              ) : null}

              <Pressable
                onPress={() => confirmar(item)}
                disabled={!podeConfirmar}
                style={[s.confirmar, { borderColor: C.border, opacity: podeConfirmar ? 1 : 0.45 }]}
                accessibilityRole="button"
              >
                <Text style={{ color: jaSalvo ? C.ink3 : C.ink, fontSize: 13, fontWeight: "600" }}>
                  {jaSalvo ? "Classificado ✓" : "Confirmar este"}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {/* Linha órfã: produtos sem categoria nenhuma. NUNCA misturada com
            os itens classificáveis — não há texto para classificar, e
            escondê-la faria o lojista achar que o catálogo está coberto. */}
        {orphan ? (
          <View style={[s.item, { borderStyle: "dashed" }]}>
            <Text style={s.raw}>Produtos sem categoria nenhuma</Text>
            <Text style={s.contagem}>
              {orphan.product_count} produto{orphan.product_count === 1 ? "" : "s"}
            </Text>
            <Text style={s.corpo}>
              Não há texto para classificar aqui. Esses produtos precisam receber categoria
              no cadastro, um a um ou em lote.
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Passo 3 ─────────────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.passo}>3 · Aplicar</Text>
        <Text style={s.corpo}>
          Vincula os produtos às categorias escolhidas. Roda em lotes e pode ser repetido
          com segurança — o que já foi aplicado não é reprocessado.
        </Text>
        <Text style={s.status}>{prontosParaAplicar} item(ns) classificado(s) e pronto(s).</Text>
        <Pressable
          onPress={() => apply()}
          disabled={isApplying || prontosParaAplicar === 0}
          style={[s.btn, {
            backgroundColor: C.ink,
            opacity: isApplying || prontosParaAplicar === 0 ? 0.5 : 1,
          }]}
          accessibilityRole="button"
        >
          {isApplying
            ? <ActivityIndicator color={C.bg} />
            : <Text style={[s.btnTxt, { color: C.bg }]}>Aplicar migração</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function estilos(C: any) {
  return StyleSheet.create({
    wrap:     { padding: 20, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
    voltar:   { paddingVertical: 8, alignSelf: "flex-start" },
    titulo:   { fontSize: 22, fontWeight: "800", color: C.ink, marginTop: 4 },
    sub:      { fontSize: 14, color: C.ink3, marginTop: 6, marginBottom: 18, lineHeight: 20 },
    card:     { backgroundColor: C.bg3, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
    passo:    { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 6 },
    corpo:    { fontSize: 13, color: C.ink3, lineHeight: 19 },
    status:   { fontSize: 13, color: C.ink, marginTop: 10, fontWeight: "600" },
    btn:      { marginTop: 14, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
    btnTxt:   { fontSize: 14, fontWeight: "700" },
    item:     { borderTopWidth: 1, borderColor: C.border, paddingTop: 14, marginTop: 14 },
    itemTopo: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    raw:      { fontSize: 15, fontWeight: "700", color: C.ink, flexShrink: 1 },
    contagem: { fontSize: 12, color: C.ink3 },
    exemplos: { fontSize: 12, color: C.ink3, marginTop: 3, fontStyle: "italic" },
    kinds:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    kind:     { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    kindTxt:  { fontSize: 12, fontWeight: "600" },
    hint:     { fontSize: 12, color: C.ink3, marginTop: 6 },
    input:    { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, marginTop: 10, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
    aviso:    { fontSize: 11, color: C.ink3, marginTop: 5 },
    confirmar:{ marginTop: 11, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  });
}
