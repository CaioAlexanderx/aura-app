// ============================================================
// Studio · Clientes (05/09/2026)
//
// Decisão do Caio (rodada 2): a feature de clientes já existia no app
// comum — cadastro, ranking, retenção — e o Studio não tinha a porta. A
// tela reaproveita o MESMO hook e os MESMOS componentes de
// (tabs)/clientes; o que muda é a casca (StudioScreen + StudioPageHeader),
// para a lojista não sair do Studio para ver quem já comprou dela.
//
// Sem a aba "Avaliações" e sem os gates de plano da tela comum: quem está
// no Studio já é Negócio ou Expansão (requirePlan no backend).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Modal, ScrollView, Platform, StyleSheet } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { Icon } from "@/components/Icon";
import { useCustomers } from "@/hooks/useCustomers";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import { CustomerRow } from "@/components/screens/clientes/CustomerRow";
import { RankingTab } from "@/components/screens/clientes/RankingTab";
import { RetentionTab } from "@/components/screens/clientes/RetentionTab";
import type { Customer } from "@/components/screens/clientes/types";
import { filtrarClientes } from "@/components/screens/clientes/filtrarClientes";

const ABAS = ["Clientes", "Ranking", "Retenção"] as const;

export default function StudioClientes() {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const {
    customers, isLoading, isError, refetch,
    addCustomer, updateCustomer, deleteCustomer,
    consolidatedView, companyCount,
  } = useCustomers({ sort: "recent" });

  const [aba, setAba] = useState<number>(0);
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<Customer | null>(null);

  const filtrados = useMemo(() => filtrarClientes(customers, busca), [customers, busca]);
  const formAberto = novo || !!editando;
  function fecharForm() { setNovo(false); setEditando(null); }

  function salvarNovo(c: Customer) { addCustomer(c); fecharForm(); }
  function salvarEdicao(c: Customer) { updateCustomer(c.id, c); fecharForm(); }
  function apagar(id: string) {
    const c = customers.find((x) => x.id === id);
    const ok = Platform.OS === "web" && typeof window !== "undefined"
      ? window.confirm(`Apagar ${c?.name || "este cliente"}? O histórico de compras não é apagado.`)
      : true;
    if (ok) deleteCustomer(id);
  }

  return (
    <StudioScreen>
      <StudioPageHeader
        eyebrow="VENDAS · CLIENTES"
        title="Clientes"
        subtitle="Quem já comprou, o que pediu e quem está sumido."
        rightSlot={
          <Pressable onPress={() => { setEditando(null); setNovo(true); }} style={s.botao} accessibilityRole="button" testID="btn-novo-cliente">
            <Icon name="plus" size={14} color="#fff" />
            <Text style={s.botaoTxt}>Novo cliente</Text>
          </Pressable>
        }
      />

      <View style={s.abas}>
        {ABAS.map((nome, i) => (
          <Pressable key={nome} onPress={() => setAba(i)} style={[s.aba, aba === i && s.abaAtiva]} accessibilityRole="tab">
            <Text style={[s.abaTxt, aba === i && s.abaTxtAtiva]}>{nome}</Text>
          </Pressable>
        ))}
      </View>

      {aba === 0 ? (
        <>
          <View style={s.busca}>
            <Icon name="search" size={14} color={t.ink3} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Nome, telefone, e-mail ou @instagram"
              placeholderTextColor={t.ink3}
              style={s.buscaInput}
              testID="busca-clientes"
            />
          </View>

          {isLoading ? (
            <StudioLoading />
          ) : isError ? (
            <StudioEmpty
              icon="alert-circle"
              title="Não deu para carregar os clientes"
              desc="Confira a conexão e tente de novo."
              primaryCta={{ label: "Tentar de novo", onPress: () => refetch() }}
            />
          ) : filtrados.length === 0 ? (
            <StudioEmpty
              icon="users"
              title={busca ? "Ninguém com esse nome" : "Nenhum cliente ainda"}
              desc={busca ? "Tente outro nome ou parte do telefone." : "Cada pedido da vitrine já cadastra o cliente. Você também pode cadastrar à mão."}
              primaryCta={busca ? undefined : { label: "Cadastrar cliente", onPress: () => setNovo(true) }}
            />
          ) : (
            <View style={s.lista}>
              <Text style={s.contagem}>{filtrados.length} de {customers.length}</Text>
              {filtrados.map((c) => (
                <CustomerRow
                  key={c.id}
                  c={c}
                  expanded={abertoId === c.id}
                  onToggle={() => setAbertoId(abertoId === c.id ? null : c.id)}
                  onEdit={(cli) => { setNovo(false); setEditando(cli); }}
                  onDelete={apagar}
                  showCompanyBadge={!!consolidatedView && (companyCount || 0) > 1}
                />
              ))}
            </View>
          )}
        </>
      ) : aba === 1 ? (
        <RankingTab customers={customers} />
      ) : (
        <RetentionTab />
      )}

      <Modal visible={formAberto} transparent animationType="fade" onRequestClose={fecharForm}>
        <Pressable style={s.fundoModal} onPress={fecharForm}>
          <Pressable style={s.folhaModal} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <AddCustomerForm
                initialData={editando || undefined}
                onSave={editando ? salvarEdicao : salvarNovo}
                onCancel={fecharForm}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </StudioScreen>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    botao: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.primary, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10 },
    botaoTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
    abas: { flexDirection: "row", gap: 6, marginBottom: 14, flexWrap: "wrap" },
    aba: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.ink4 },
    abaAtiva: { backgroundColor: t.primary, borderColor: t.primary },
    abaTxt: { fontSize: 12.5, fontWeight: "700", color: t.ink2 },
    abaTxtAtiva: { color: "#fff" },
    busca: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: t.ink4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.paperCardElev, marginBottom: 12 },
    buscaInput: { flex: 1, fontSize: 13.5, color: t.ink, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
    lista: { gap: 8 },
    contagem: { fontSize: 11, color: t.ink3, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
    fundoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", alignItems: "center" },
    folhaModal: { width: "100%", maxWidth: 560, maxHeight: "90%", backgroundColor: t.paperCardElev, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  });
}
