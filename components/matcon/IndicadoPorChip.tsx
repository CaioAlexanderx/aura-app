// ============================================================
// AURA. — Matcon M3: IndicadoPorChip — "Quem indicou?" do Caixa
//
// 22/09/2026 (docs/CONTRACT_MATCON.md, seção M3 · mockup
// docs/mockups/matcon-m3-clube-calculadora.html #caixa). Fica na barra de
// ações do Caixa, logo depois do chip "Vendedor" (app/(tabs)/pdv.tsx). Não
// é obrigatório: a venda fecha sem ele — é um convite, nunca um campo
// travando o "Finalizar venda".
//
// 22/09/2026 (revisão de texto): o convite era "+ indicar profissional" e
// ninguém do balcão entendia. Virou "+ quem indicou?", e o rodapé fala
// "Cadastrar profissional novo" / "Escolher um cliente já cadastrado".
//
// Dois estados:
//   - sem profissional: chip "+ quem indicou?" abre a busca (nome,
//     telefone ou profissão); o rodapé oferece "Cadastrar profissional novo"
//     (QuickCustomerModal, o mesmo cadastro rápido de sempre — e depois a
//     profissão, reaproveitando o chipset de MarcarProfissionalModal com
//     presetCustomer) e "Escolher um cliente já cadastrado"
//     (MarcarProfissionalModal sem preset, com busca própria).
//   - com profissional: chip "Indicado por: Nome · profissão ×" + o card
//     "Nome ganha N pontos com esta venda de R$ X" (N = pontosPrevistos do
//     useMatconReferral, sempre calculado sobre o total ATUAL do carrinho).
//
// Toda a lógica de busca/seleção mora em useMatconReferral (prop
// `referral`); este componente só renderiza e abre os modais.
//
// QA 23/09/2026: busca que falhou mostra frase simples (não "Nenhum
// parceiro com esse nome"); "pts" virou "pontos".
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { QuickCustomerModal } from "@/components/QuickCustomerModal";
import { MarcarProfissionalModal, type MarcarProfissionalCustomer } from "@/components/matcon/MarcarProfissionalModal";
import { TRADE_LABELS, type Professional } from "@/services/matconApi";
import { fmtCurrency } from "@/components/screens/pdv/types";
import type { useMatconReferral } from "@/hooks/useMatconReferral";

type ReferralState = ReturnType<typeof useMatconReferral>;

type Props = {
  referral: ReferralState;
  saleTotal: number;
  matconOn: boolean;
};

export function IndicadoPorChip({ referral, saleTotal, matconOn }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [query, setQuery] = useState("");
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showMarcar, setShowMarcar] = useState(false);
  const [marcarPreset, setMarcarPreset] = useState<MarcarProfissionalCustomer | null>(null);

  if (!matconOn) return null;

  function openSheet() {
    setQuery("");
    referral.search("");
    setShowSheet(true);
  }
  function closeSheet() { setShowSheet(false); }

  function handleQueryChange(q: string) {
    setQuery(q);
    referral.search(q);
  }

  function handlePick(p: Professional) {
    referral.select(p);
    closeSheet();
  }

  function handleCadastrar() {
    setShowSheet(false);
    setShowQuickCustomer(true);
  }

  function handleCustomerCreated(c: { id: string; name: string; phone: string }) {
    setShowQuickCustomer(false);
    setMarcarPreset({ id: c.id, name: c.name, phone: c.phone });
    setShowMarcar(true);
  }

  function handleMarcarExistente() {
    setShowSheet(false);
    setMarcarPreset(null);
    setShowMarcar(true);
  }

  function handleMarked(p: Professional) {
    referral.select(p);
    setShowMarcar(false);
  }

  const referred = referral.referred;
  const pontos = referred ? referral.pontosPrevistos(saleTotal) : 0;

  return (
    <View style={s.wrap}>
      {referred ? (
        <View style={s.wrap}>
          <View style={s.chipFilled} testID="indicadopor-chip">
            <Text style={s.chipLabel} numberOfLines={1}>
              Indicado por: <Text style={s.chipStrong}>{referred.customer_name}</Text>
              {" · " + (TRADE_LABELS[referred.trade] || referred.trade)}
            </Text>
            <Pressable onPress={referral.clear} hitSlop={8} accessibilityLabel="Remover indicação" testID="indicadopor-remover">
              <Text style={s.chipClose}>×</Text>
            </Pressable>
          </View>
          {pontos > 0 && (
            <View style={s.pointsCard} testID="indicadopor-pontos">
              <Icon name="tag" size={13} color={Colors.violet3} />
              <Text style={s.pointsText}>
                <Text style={s.pointsStrong}>{referred.customer_name} ganha {pontos} pontos</Text>
                {" com esta venda de " + fmtCurrency(saleTotal) + "."}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Pressable style={s.chipInvite} onPress={openSheet} testID="indicadopor-abrir">
          <Text style={s.chipInviteText}>+ quem indicou?</Text>
        </Pressable>
      )}

      <ResponsiveSheet visible={showSheet} onClose={closeSheet} maxWidth={420}>
        <View style={s.header}>
          <Text style={s.title}>Quem indicou este cliente?</Text>
          <Pressable onPress={closeSheet} hitSlop={10} accessibilityLabel="Fechar">
            <Icon name="x" size={18} color={Colors.ink3} />
          </Pressable>
        </View>

        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Nome, telefone ou profissão"
            placeholderTextColor={Colors.ink3}
            style={s.searchInput}
            testID="indicadopor-busca"
          />
        </View>

        <ScrollView style={s.results} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
          {referral.searching && <Text style={s.hint}>Buscando…</Text>}
          {!referral.searching && referral.searchError && (
            <Text style={[s.hint, s.hintErro]} testID="indicadopor-erro">
              Não consegui procurar os parceiros agora. Confira a internet e digite de novo daqui a pouco.
            </Text>
          )}
          {!referral.searching && !referral.searchError && query.trim().length > 0 && referral.results.length === 0 && (
            <Text style={s.hint}>Nenhum parceiro com esse nome. Se ele ainda não é parceiro, use um dos botões abaixo.</Text>
          )}
          {referral.results.map(p => (
            <Pressable key={p.id} style={s.row} onPress={() => handlePick(p)} testID={`indicadopor-resultado-${p.id}`}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowName} numberOfLines={1}>{p.customer_name}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {(TRADE_LABELS[p.trade] || p.trade)}
                  {p.customer_phone ? " · " + p.customer_phone : ""}
                  {" · " + p.referrals_count + (p.referrals_count === 1 ? " indicação" : " indicações")}
                </Text>
              </View>
              <Text style={s.rowPoints}>{p.points_balance} {p.points_balance === 1 ? "ponto" : "pontos"}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <Pressable style={s.footerBtn} onPress={handleCadastrar} testID="indicadopor-cadastrar">
            <Icon name="users" size={13} color={Colors.violet3} />
            <Text style={s.footerBtnText}>Cadastrar profissional novo</Text>
          </Pressable>
          <Pressable style={[s.footerBtn, s.footerBtnGhost]} onPress={handleMarcarExistente} testID="indicadopor-marcar-existente">
            <Text style={s.footerBtnGhostText}>Escolher um cliente já cadastrado</Text>
          </Pressable>
        </View>
        <Text style={s.note}>
          É o mesmo cadastro rápido de cliente de sempre, só perguntando também o que ele faz.
        </Text>
      </ResponsiveSheet>

      <QuickCustomerModal
        visible={showQuickCustomer}
        onClose={() => setShowQuickCustomer(false)}
        onCustomerCreated={handleCustomerCreated}
      />
      <MarcarProfissionalModal
        visible={showMarcar}
        onClose={() => setShowMarcar(false)}
        onMarked={handleMarked}
        presetCustomer={marcarPreset}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  chipInvite: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: "transparent",
  },
  chipInviteText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  chipFilled: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD,
    maxWidth: 320,
  },
  chipLabel: { fontSize: 12, color: Colors.ink2, fontWeight: "500", flexShrink: 1 },
  chipStrong: { fontWeight: "700", color: Colors.ink },
  chipClose: { fontSize: 14, color: Colors.ink3, fontWeight: "700", paddingHorizontal: 2 },
  pointsCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    maxWidth: 380,
  },
  pointsText: { fontSize: 11.5, color: Colors.ink2, flex: 1, lineHeight: 16 },
  pointsStrong: { fontWeight: "700", color: Colors.ink },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, paddingBottom: 10 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 18, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Colors.bg3,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink },
  results: { maxHeight: 260, marginHorizontal: 18 },
  hint: { fontSize: 12, color: Colors.ink3, paddingVertical: 10, textAlign: "center" },
  hintErro: { color: Colors.amber, fontWeight: "600" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  rowMeta: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  rowPoints: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  footer: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 18, paddingTop: 10 },
  footerBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  footerBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  footerBtnGhost: { backgroundColor: "transparent", borderColor: Colors.border },
  footerBtnGhostText: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  note: { fontSize: 11, color: Colors.ink3, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18, lineHeight: 15 },
});
