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
// Telefone repetido: mesmo telefone = mesma pessoa. Em vez de criar o segundo
// cadastro — ou de jogar fora o CPF e o nascimento que a vendedora acabou de
// digitar —, a tela mostra quem já está cadastrado e oferece COMPLETAR esse
// cadastro com o que foi digitado. Completar só preenche o que estava vazio:
// nada do cadastro antigo é trocado.
//
// Conteúdo puro, sem casca: a Nova OS abre num ResponsiveSheet; a janela da
// receita troca o próprio conteúdo por este (nada de Modal dentro de Modal).
//
// Multi-CNPJ: o cliente é do dono (owner-scope). A gravação usa a loja do
// próprio cadastro quando ele já existe, como o resto do app (useCustomers).
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useCustomers } from "@/hooks/useCustomers";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import type { Customer } from "@/components/screens/clientes/types";
import { situacaoDoNascimento } from "@/utils/clienteDadosCompletos";
import { enderecoComecado } from "@/components/endereco/endereco";

type Props = {
  /** Cadastro a completar. Ausente = cliente novo. */
  cliente?: Customer | null;
  onCancel: () => void;
  /** Cliente gravado (novo ou atualizado), ou o cadastro que já existia com o mesmo telefone. */
  onSaved: (c: Customer) => void;
};

const digitos = (v: string | null | undefined) => String(v || "").replace(/\D/g, "");

/**
 * O que o formulário digitado acrescenta a um cadastro que já existe. Só
 * preenche o que está vazio lá (ou o nascimento que não tinha ano): nunca
 * troca um valor que o cadastro já tem. `novidades` é a lista para a tela.
 */
export function completarCadastroExistente(existente: Customer, digitado: Customer): { cliente: Customer; novidades: string[] } {
  const novidades: string[] = [];
  const cliente: Customer = { ...existente, dadosCompletos: {} };
  const d = digitado.dadosCompletos || {};

  if (!digitos(existente.cpf) && digitos(d.cpf)) { cliente.dadosCompletos!.cpf = d.cpf; novidades.push("CPF"); }
  const nascAntes = situacaoDoNascimento(existente.birthday);
  const nascDigitado = situacaoDoNascimento(digitado.birthday);
  if (nascAntes !== "ok" && (nascDigitado === "ok" || (nascAntes === "vazio" && nascDigitado === "sem_ano"))) {
    cliente.birthday = digitado.birthday;
    novidades.push(nascDigitado === "ok" ? "data de nascimento" : "aniversário");
  }
  if (!existente.rg && d.rg) { cliente.dadosCompletos!.rg = d.rg; novidades.push("RG"); }
  if (!existente.gender && d.gender) { cliente.dadosCompletos!.gender = d.gender; novidades.push("sexo"); }
  if (!existente.occupation && d.occupation) { cliente.dadosCompletos!.occupation = d.occupation; novidades.push("profissão"); }
  if (!existente.email && digitado.email) { cliente.email = digitado.email; novidades.push("e-mail"); }
  if (!existente.instagram && digitado.instagram) { cliente.instagram = digitado.instagram; novidades.push("Instagram"); }
  if (!enderecoComecado(existente.endereco) && enderecoComecado(digitado.endereco)) { cliente.endereco = digitado.endereco; novidades.push("endereço"); }
  if (!existente.notes && digitado.notes) { cliente.notes = digitado.notes; novidades.push("observações"); }
  return { cliente, novidades };
}

export function CadastroDoClienteOtica({ cliente, onCancel, onSaved }: Props) {
  const { customers, addCustomerAsync, updateCustomerAsync, camposExtras } = useCustomers();
  const [salvando, setSalvando] = useState(false);
  // Cadastro que já existe com o telefone digitado, à espera da decisão.
  const [repetido, setRepetido] = useState<{ existente: Customer; completo: Customer; novidades: string[] } | null>(null);

  async function gravar(fn: () => Promise<Customer>) {
    if (salvando) return;
    setSalvando(true);
    try {
      onSaved(await fn());
    } catch {
      // O aviso do erro já sai do useCustomers; o formulário fica aberto com
      // o que foi digitado.
    } finally {
      setSalvando(false);
    }
  }

  function salvar(c: Customer) {
    if (cliente) {
      return gravar(async () => {
        await updateCustomerAsync(cliente.id, c, cliente.company_id);
        return { ...cliente, ...c, id: cliente.id, cpf: c.dadosCompletos?.cpf ?? cliente.cpf };
      });
    }
    const tel = digitos(c.phone);
    const existente = tel.length >= 10 ? customers.find((x) => digitos(x.phone) === tel) : null;
    if (existente) {
      const { cliente: completo, novidades } = completarCadastroExistente(existente, c);
      setRepetido({ existente, completo, novidades });
      return;
    }
    return gravar(() => addCustomerAsync(c));
  }

  function completarEUsar() {
    if (!repetido) return;
    const { existente, completo } = repetido;
    return gravar(async () => {
      await updateCustomerAsync(existente.id, completo, existente.company_id);
      return { ...completo, cpf: completo.dadosCompletos?.cpf ?? existente.cpf, dadosCompletos: undefined };
    });
  }

  return (
    <View style={salvando ? { opacity: 0.6, pointerEvents: "none" } : undefined} testID="otica-cadastro-cliente">
      {repetido && (
        <View style={st.aviso} testID="otica-cliente-repetido">
          <Text style={st.avisoTitulo}>Este telefone já é de {repetido.existente.name}</Text>
          <Text style={st.avisoTexto}>
            {repetido.novidades.length > 0
              ? `Para não criar dois cadastros da mesma pessoa, use o que já existe. O que você digitou e ainda não estava lá (${repetido.novidades.join(", ")}) pode ser guardado nele; nada do cadastro antigo é trocado.`
              : "Para não criar dois cadastros da mesma pessoa, use o que já existe. Ele já tem tudo o que você digitou."}
          </Text>
          <View style={st.botoes}>
            {repetido.novidades.length > 0 && (
              <Pressable onPress={completarEUsar} style={[st.btn, st.btnP]} testID="otica-cliente-repetido-completar">
                <Text style={[st.btnTxt, { color: "#fff" }]}>Completar e usar este cadastro</Text>
              </Pressable>
            )}
            <Pressable onPress={() => onSaved(repetido.existente)} style={repetido.novidades.length > 0 ? st.btn : [st.btn, st.btnP]} testID="otica-cliente-repetido-usar">
              <Text style={[st.btnTxt, repetido.novidades.length === 0 && { color: "#fff" }]}>{repetido.novidades.length > 0 ? "Usar sem mudar nada" : "Usar este cadastro"}</Text>
            </Pressable>
            <Pressable onPress={() => setRepetido(null)} style={st.btn} testID="otica-cliente-repetido-voltar">
              <Text style={st.btnTxt}>Corrigir o telefone</Text>
            </Pressable>
          </View>
        </View>
      )}
      {/* O formulário continua montado por baixo do aviso: nada do que foi
          digitado se perde enquanto a vendedora decide. */}
      <View style={repetido ? { display: "none" } : undefined}>
        <AddCustomerForm
          key={cliente?.id || "novo"}
          initialData={cliente || undefined}
          onSave={salvar}
          onCancel={onCancel}
          dadosCompletos
          camposExtras={camposExtras}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  aviso: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.amber + "66", borderRadius: 16, padding: 20, gap: 8 },
  avisoTitulo: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  avisoTexto: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  botoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  btn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  btnP: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnTxt: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
});
