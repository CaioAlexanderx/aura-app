// ============================================================
// AURA. — Novo lançamento: passo 1, "Para quem?" (12/10/2026)
//
// Redesenho aprovado (docs/mockups/crediario-lancamento-manual.html). Antes
// de digitar, a lojista já vê os clientes recentes da carteira (saldo e
// atraso) — na maior parte das vezes o cliente está ali e não precisa buscar.
// A busca (debounce de 350 ms) continua igual. "Cadastrar novo cliente" é a
// última linha da lista; o cadastro abre no lugar da lista, com "Voltar
// para a busca", e o que foi digitado nele conta para a pergunta de descarte.
// ============================================================
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { e } from "./estilos";
import {
  fmtCur, fmtPhone, chipDoRecente, iniciais,
  type CustomerOption, type RecenteDoLancamento, type ChipDoRecente,
} from "./calculos";
import type { LancamentoForm } from "./useLancamentoForm";

type Props = {
  form: LancamentoForm;
  recentes?: RecenteDoLancamento[];
};

const TOM_DO_CHIP: Record<ChipDoRecente["tom"], { cor: string; fundo: string }> = {
  ok:       { cor: Colors.green, fundo: Colors.greenD },
  atraso:   { cor: Colors.red,   fundo: Colors.redD },
  conferir: { cor: Colors.amber, fundo: Colors.amberD },
  zero:     { cor: Colors.ink3,  fundo: "transparent" },
};

function Linha({ c, sub, chip, onPress, testID }: {
  c: CustomerOption; sub: string; chip?: ChipDoRecente; onPress: () => void; testID: string;
}) {
  const tom = chip ? TOM_DO_CHIP[chip.tom] : null;
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && e.pressed]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Lançar para ${c.name}`}
    >
      <View style={s.av}><Text style={s.avTxt}>{iniciais(c.name)}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>{c.name}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {chip && tom ? (
        <View style={[s.chip, { borderColor: tom.cor, backgroundColor: tom.fundo }]}>
          <Text style={[s.chipTxt, { color: tom.cor }]}>{chip.rotulo}</Text>
        </View>
      ) : (
        <Icon name="chevron-right" size={14} color={Colors.ink3} />
      )}
    </Pressable>
  );
}

export function PassoCliente({ form, recentes }: Props) {
  const { st, set, buscar, escolherCliente, confirmarNovoCliente } = form;

  if (st.mode === "create") {
    return (
      <ScrollView style={[e.body, { flexGrow: 0, flexShrink: 1 }]} contentContainerStyle={e.gap} keyboardShouldPersistTaps="handled">
        <Pressable style={s.backLink} onPress={() => set({ mode: "search" })} accessibilityRole="button">
          <Icon name="arrow-left" size={14} color={Colors.violet3} />
          <Text style={s.backLinkText}>Voltar para a busca</Text>
        </Pressable>

        <View>
          <Text style={e.label}>Nome *</Text>
          <TextInput
            style={e.input}
            placeholder="Nome completo"
            placeholderTextColor={Colors.ink3}
            value={st.newName}
            onChangeText={(v) => set({ newName: v })}
            testID="lancamento-novo-nome"
            autoFocus
          />
        </View>

        <View>
          <Text style={e.label}>Telefone *</Text>
          <TextInput
            style={e.input}
            placeholder="(11) 99999-9999"
            placeholderTextColor={Colors.ink3}
            value={st.newPhone}
            onChangeText={(v) => set({ newPhone: fmtPhone(v) })}
            testID="lancamento-novo-telefone"
            keyboardType="phone-pad"
          />
        </View>

        <Pressable
          style={({ pressed }) => [e.cta, pressed && e.pressed]}
          onPress={confirmarNovoCliente}
          testID="lancamento-novo-continuar"
          accessibilityRole="button"
        >
          <Text style={e.ctaTxt}>Continuar</Text>
          <Icon name="arrow-right" size={15} color="#fff" />
        </Pressable>
      </ScrollView>
    );
  }

  const buscando = st.searchQ.length >= 2;
  const lista = recentes || [];

  return (
    <ScrollView style={[e.body, { flexGrow: 0, flexShrink: 1 }]} contentContainerStyle={e.gap} keyboardShouldPersistTaps="handled">
      <View style={e.inputRow}>
        <Icon name="search" size={15} color={Colors.ink3} />
        <TextInput
          style={e.inputRowText}
          placeholder="Nome ou telefone"
          placeholderTextColor={Colors.ink3}
          value={st.searchQ}
          onChangeText={buscar}
          testID="lancamento-busca"
          accessibilityLabel="Buscar cliente"
          autoFocus
        />
        {st.searching && <ActivityIndicator size="small" color={Colors.violet3} />}
      </View>

      <View>
        {!buscando && lista.length > 0 && <Text style={e.sec}>Recentes</Text>}
        {buscando && !st.searching && st.searchResults.length === 0 && (
          <Text style={s.empty}>Nenhum cliente encontrado</Text>
        )}
        <View style={s.list}>
          {buscando
            ? st.searchResults.map((c) => (
                <Linha
                  key={c.id}
                  c={c}
                  sub={c.phone || ""}
                  onPress={() => escolherCliente(c)}
                  testID={`lancamento-cliente-${c.id}`}
                />
              ))
            : lista.map((r) => {
                const saldo = Number(r.balance) || 0;
                const sub = [r.phone, saldo > 0.009 ? `${fmtCur(saldo)} em aberto` : "sem saldo"].filter(Boolean).join(" · ");
                return (
                  <Linha
                    key={r.id}
                    c={{ id: r.id, name: r.name, phone: r.phone ?? null }}
                    sub={sub}
                    chip={chipDoRecente(r)}
                    onPress={() => escolherCliente({ id: r.id, name: r.name, phone: r.phone ?? null })}
                    testID={`lancamento-recente-${r.id}`}
                  />
                );
              })}
          <Pressable
            style={({ pressed }) => [s.row, s.rowLast, pressed && e.pressed]}
            onPress={() => set({ mode: "create" })}
            testID="lancamento-novo-cliente"
            accessibilityRole="button"
          >
            <View style={[s.av, s.avNovo]}><Icon name="user-plus" size={15} color={Colors.violet3} /></View>
            <Text style={s.novoTxt}>Cadastrar novo cliente</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  list: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 11, minHeight: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  rowLast: { borderBottomWidth: 0 },
  av: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  avNovo: { backgroundColor: "transparent" },
  avTxt: { fontSize: 13, fontWeight: "800", color: Colors.violet3 },
  rowName: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  rowSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  chipTxt: { fontSize: 11, fontWeight: "700" },
  novoTxt: { fontSize: 13.5, fontWeight: "600", color: Colors.violet3 },
  empty: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 12 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  backLinkText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
