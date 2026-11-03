// ============================================================
// AURA. — Caixa: cadastrar vendedora sem sair da venda (03/11/2026)
//
// Aberto pelo seletor "Vendedora (F2)" (ActPerson, kind="vendedora"). Só o
// nome é obrigatório; WhatsApp é opcional. Salário, CPF e comissão se
// completam depois em Equipe. A vendedora criada já fica selecionada na
// venda (onCriada).
//
// Limite do plano (403 { limit, current }): a venda nunca trava. O modal
// vira o aviso "Sua equipe está completa" com "Usar só nesta venda".
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html, telas 10 e 11.
// Regras puras em utils/vendedoraNoCaixa.ts.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { employeesApi } from "@/services/employeesApi";
import { maskPhone } from "@/utils/masks";
import {
  nomeDaVendedora, vendedoraJaExiste, limiteDaEquipe, textoDoLimite, type LimiteDaEquipe,
} from "@/utils/vendedoraNoCaixa";

type Pessoa = { id: string; name: string };

type Props = {
  visible: boolean;
  nomeInicial: string;
  equipe: Pessoa[];
  onClose: () => void;
  onCriada: (p: Pessoa) => void;
  onUsarSoNestaVenda: (nome: string) => void;
};

export function NovaVendedoraModal({ visible, nomeInicial, equipe, onClose, onCriada, onUsarSoNestaVenda }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [nome, setNome] = useState(nomeInicial);
  const [whats, setWhats] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [limite, setLimite] = useState<LimiteDaEquipe | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNome(nomeInicial);
    setWhats("");
    setLimite(null);
    setSalvando(false);
  }, [visible, nomeInicial]);

  const limpo = nomeDaVendedora(nome);
  const repetida = vendedoraJaExiste(limpo, equipe);

  async function salvar() {
    if (!company?.id || !limpo || salvando) return;
    if (repetida) { onCriada(repetida); return; }
    setSalvando(true);
    try {
      const body: any = { name: limpo, role: "Vendedora", status: "active" };
      if (whats.trim()) body.phone = whats.trim();
      const criada = await employeesApi.create(company.id, body);
      qc.invalidateQueries({ queryKey: ["employees", company.id] });
      toast.success(`${limpo} cadastrada na equipe`);
      onCriada({ id: criada.id, name: criada.name || limpo });
    } catch (err: any) {
      const l = limiteDaEquipe(err?.status, err?.data);
      if (l) { setLimite(l); return; }
      toast.error(err?.message || "Não conseguimos cadastrar. A venda segue: use o nome só nesta venda.");
    } finally {
      setSalvando(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}} testID="nova-vendedora-modal">
          {limite ? (
            <>
              <View style={s.head}>
                <View style={[s.ico, { backgroundColor: Colors.amberD }]}><Text style={{ color: Colors.amber, fontWeight: "800" }}>!</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Sua equipe está completa</Text>
                  <Text style={s.sub}>{textoDoLimite(limite)}</Text>
                </View>
              </View>
              <Text style={s.hint}>
                Dá para seguir esta venda com "{limpo}" só nesta venda, suspender alguém que saiu (em Equipe) ou mudar de plano.
              </Text>
              <View style={s.foot}>
                <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Fechar</Text></Pressable>
                <Pressable onPress={() => onUsarSoNestaVenda(limpo)} style={s.btnPri} testID="nova-vendedora-so-nesta">
                  <Text style={s.btnPriTxt}>Usar só nesta venda</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={s.head}>
                <View style={s.ico}><Icon name="user" size={16} color={Colors.violet3} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Nova vendedora</Text>
                  <Text style={s.sub}>Já fica selecionada nesta venda</Text>
                </View>
                <Pressable onPress={onClose} accessibilityLabel="Fechar"><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
              </View>

              <Text style={s.label}>Nome</Text>
              <TextInput
                value={nome} onChangeText={setNome} autoFocus
                placeholder="Ex.: Bianca" placeholderTextColor={Colors.ink3}
                style={s.input as any} onSubmitEditing={salvar} testID="nova-vendedora-nome"
              />
              {repetida ? (
                <Text style={s.aviso}>Já existe "{repetida.name}" na equipe. Confirmar usa ela, sem cadastrar de novo.</Text>
              ) : null}

              <Text style={s.label}>WhatsApp <Text style={s.opc}>(opcional)</Text></Text>
              <TextInput
                value={whats} onChangeText={(v) => setWhats(maskPhone(v))}
                placeholder="(11) 9…" placeholderTextColor={Colors.ink3}
                keyboardType="phone-pad" style={s.input as any} onSubmitEditing={salvar}
              />
              <Text style={s.hint}>Salário, CPF e comissão se completam depois em Equipe.</Text>

              <View style={s.foot}>
                <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
                <Pressable onPress={salvar} disabled={!limpo || salvando}
                  style={[s.btnPri, (!limpo || salvando) && { opacity: 0.5 }]} testID="nova-vendedora-salvar">
                  {salvando ? <ActivityIndicator size="small" color="#fff" /> : (
                    <Text style={s.btnPriTxt}>{repetida ? "Usar " + repetida.name : "Cadastrar e usar"}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 400, backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  ico: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginTop: 12, marginBottom: 5 },
  opc: { fontWeight: "400", color: Colors.ink3 },
  input: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2 },
  aviso: { fontSize: 12, color: Colors.amber, marginTop: 6 },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 10 },
  foot: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  btnSec: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnSecTxt: { color: Colors.ink2, fontWeight: "600", fontSize: 13 },
  btnPri: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.violet, minWidth: 120, alignItems: "center" },
  btnPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
