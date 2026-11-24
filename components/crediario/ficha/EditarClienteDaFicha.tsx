// ============================================================
// EditarClienteDaFicha — Aura · Crediário (F2 do redesenho, 23/11/2026)
//
// "Editar cliente" sem sair do crediário (pedido do Caio de 21/11; mockup
// aprovado, seção f). O formulário é o mesmo da tela de Clientes
// (AddCustomerForm) e quem grava é o mesmo PATCH de useCustomers — aqui só
// muda a casca: uma janela por cima da ficha (ResponsiveSheet, que é um
// Modal e entra na pilha de Modais; nada de WebPortal dentro de Modal).
//
// A ficha só tem id, nome, telefone e CPF da cliente (creditApi); o
// formulário precisa do cadastro inteiro, senão salvar apagaria e-mail,
// Instagram, aniversário, observações e endereço. Por isso o cadastro vem da
// lista de useCustomers (a mesma da tela de Clientes, que traz o dono
// inteiro até o limite do plano). Se a cliente não estiver lá, a janela diz
// isso em vez de abrir um formulário pela metade — e só diz que não achou
// quando a lista carregou de fato; em erro (ou 403) diz que não conseguiu
// abrir, sem afirmar nada sobre a cliente.
//
// O formulário guarda o que recebeu ao montar. Se a lista estava em cache e
// a versão nova chega depois, ele recomeça com o cadastro novo — enquanto a
// lojista não tiver mexido em nada; depois que mexeu, o que ela digitou fica.
//
// Multi-CNPJ: o PATCH vai pela loja da FICHA. O backend edita a cliente de
// qualquer loja do mesmo dono (customers.js, owner-scoped), e a loja da ficha
// é uma que a pessoa logada certamente acessa — a loja onde a cliente foi
// cadastrada pode não ser (vendedora de uma loja só, no consolidado). Depois
// recarrega a ficha e a carteira da loja da ficha.
// ============================================================
import { useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import type { Customer } from "@/components/screens/clientes/types";
import { useCustomers } from "@/hooks/useCustomers";
import { usePdvSettings } from "@/hooks/usePdvSettings";

export type EditarClienteDaFichaProps = {
  visible: boolean;
  /** Loja da ficha. */
  companyId: string;
  customerId: string | null;
  /** Abre com o cursor no telefone ("Sem telefone · adicionar", Cobrar sem telefone). */
  focoNoTelefone?: boolean;
  onClose: () => void;
  /** Depois de gravar (a ficha já foi recarregada). */
  onSaved?: () => void;
};

export function EditarClienteDaFicha(props: EditarClienteDaFichaProps) {
  // Monta a lista de clientes só com a janela aberta.
  if (!props.visible || !props.customerId) return null;
  return <Janela {...props} customerId={props.customerId} />;
}

function Janela({ companyId, customerId, focoNoTelefone, onClose, onSaved }: EditarClienteDaFichaProps & { customerId: string }) {
  const qc = useQueryClient();
  const { customers, isLoading, isError, planBlocked, isDemo, refetch, updateCustomerAsync, camposExtras } = useCustomers();
  // 23/11/2026: loja com a ótica ligada edita também os "Dados completos".
  const oticaLigada = usePdvSettings(companyId).settings.otica_enabled === true;
  const [salvando, setSalvando] = useState(false);
  const [editou, setEditou] = useState(false);
  const cliente = customers.find(c => c.id === customerId) || null;
  // Só afirma "não achamos" com a lista carregada de verdade.
  const listaCarregada = !isLoading && !isError && !planBlocked && !isDemo;
  // Chave do formulário: acompanha o cadastro até a lojista mexer.
  const assinatura = cliente ? JSON.stringify([
    cliente.name, cliente.phone, cliente.email, cliente.instagram, cliente.birthday, cliente.notes, cliente.endereco ?? null,
    cliente.cpf ?? "", cliente.rg ?? "", cliente.gender ?? "", cliente.occupation ?? "",
  ]) : "";
  const chaveRef = useRef("");
  if (!editou) chaveRef.current = assinatura;

  async function salvar(c: Customer) {
    if (salvando) return;
    setSalvando(true);
    try {
      await updateCustomerAsync(customerId, c, companyId);
      // Nome e telefone no cabeçalho da ficha e na carteira ao lado.
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      onSaved?.();
      onClose();
    } catch {
      // O aviso do erro já sai do useCustomers; a janela fica aberta com o que
      // a lojista digitou.
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ResponsiveSheet visible onClose={onClose} onBackdropPress={salvando ? () => {} : onClose} maxWidth={560}>
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 4 }}
        testID="ficha-editar-cliente-janela"
      >
        {isLoading && !cliente ? (
          <View style={s.centro}>
            <ActivityIndicator color={Colors.violet3} />
            <Text style={s.txt}>Abrindo o cadastro…</Text>
          </View>
        ) : !cliente ? (
          <View style={s.centro} testID="ficha-editar-cliente-sem-cadastro">
            <Text style={[s.titulo, { fontFamily: Fonts.heading }]}>Editar cliente</Text>
            <Text style={s.txt}>
              {listaCarregada
                ? "Não achamos este cadastro. Ele pode ter sido excluído na tela Clientes."
                : "Não consegui abrir o cadastro agora. Tente de novo em instantes."}
            </Text>
            <View style={s.botoes}>
              {!listaCarregada && (
                <Pressable style={[s.btn, s.btnP]} onPress={() => refetch()} accessibilityRole="button" testID="ficha-editar-cliente-tentar">
                  <Text style={[s.btnTxt, { color: "#fff" }]}>Tentar de novo</Text>
                </Pressable>
              )}
              <Pressable style={s.btn} onPress={onClose} accessibilityRole="button">
                <Text style={s.btnTxt}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={salvando ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
            <AddCustomerForm
              key={`${cliente.id}:${chaveRef.current}`}
              initialData={cliente}
              focoNoTelefone={focoNoTelefone}
              onEditou={() => setEditou(true)}
              onSave={salvar}
              onCancel={onClose}
              dadosCompletos={oticaLigada}
              camposExtras={camposExtras}
            />
          </View>
        )}
      </ScrollView>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  centro: { alignItems: "center", gap: 10, paddingVertical: 28, paddingHorizontal: 20 },
  titulo: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.ink },
  txt: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink2, textAlign: "center", lineHeight: 19 },
  botoes: { flexDirection: "row", gap: 8, marginTop: 6 },
  btn: {
    minHeight: 40, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  btnP: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  btnTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink },
});

export default EditarClienteDaFicha;
