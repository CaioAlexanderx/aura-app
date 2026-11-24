// ============================================================
// AURA. — Ótica: cadastrar ou completar o cliente sem sair da tela
//
// 23/11/2026. Antes, cliente que não estava cadastrado mandava o vendedor
// para a aba Clientes ("Cadastre na aba Clientes antes de abrir a OS") e ele
// perdia a receita que já tinha digitado. Agora o MESMO formulário de
// clientes (AddCustomerForm, com o bloco "Dados completos") abre aqui.
//
// Dois usos:
//   - sem `cliente`: cadastra e devolve o novo cliente já com id;
//   - com `cliente`: completa o cadastro (CPF, ano de nascimento…).
//
// Conteúdo puro, sem casca: a Nova OS abre num ResponsiveSheet; a janela da
// receita troca o próprio conteúdo por este (nada de Modal dentro de Modal).
//
// Multi-CNPJ: o cliente é do dono (owner-scope). A gravação usa a loja do
// próprio cadastro quando ele já existe, como o resto do app (useCustomers).
// ============================================================
import { useState } from "react";
import { View } from "react-native";
import { toast } from "@/components/Toast";
import { useCustomers } from "@/hooks/useCustomers";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import type { Customer } from "@/components/screens/clientes/types";

type Props = {
  /** Cadastro a completar. Ausente = cliente novo. */
  cliente?: Customer | null;
  onCancel: () => void;
  /** Cliente gravado (novo ou atualizado), ou o cadastro que já existia com o mesmo telefone. */
  onSaved: (c: Customer) => void;
};

const digitos = (v: string) => String(v || "").replace(/\D/g, "");

export function CadastroDoClienteOtica({ cliente, onCancel, onSaved }: Props) {
  const { customers, addCustomerAsync, updateCustomerAsync, camposExtras } = useCustomers();
  const [salvando, setSalvando] = useState(false);

  async function salvar(c: Customer) {
    if (salvando) return;
    if (!cliente) {
      // Mesmo telefone = mesma pessoa: escolhe o cadastro que já existe em vez
      // de criar o segundo.
      const tel = digitos(c.phone);
      const repetido = tel.length >= 10 ? customers.find((x) => digitos(x.phone) === tel) : null;
      if (repetido) {
        toast.info(`Já existe cadastro com este telefone: ${repetido.name}. Usei o cadastro que já estava aqui.`);
        onSaved(repetido);
        return;
      }
    }
    setSalvando(true);
    try {
      if (cliente) {
        await updateCustomerAsync(cliente.id, c, cliente.company_id);
        onSaved({ ...cliente, ...c, id: cliente.id, cpf: c.dadosCompletos?.cpf ?? cliente.cpf });
      } else {
        onSaved(await addCustomerAsync(c));
      }
    } catch {
      // O aviso do erro já sai do useCustomers; o formulário fica aberto com
      // o que foi digitado.
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={salvando ? { opacity: 0.6, pointerEvents: "none" } : undefined} testID="otica-cadastro-cliente">
      <AddCustomerForm
        key={cliente?.id || "novo"}
        initialData={cliente || undefined}
        onSave={salvar}
        onCancel={onCancel}
        dadosCompletos
        camposExtras={camposExtras}
      />
    </View>
  );
}
