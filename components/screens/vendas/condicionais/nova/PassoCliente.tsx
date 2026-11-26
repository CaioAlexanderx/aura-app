// ============================================================
// AURA. — Nova condicional · passo 1, Cliente (C6, 26/11/2026)
//
// Mockup "nova.p1": "Quem vai levar as peças?", busca por nome ou telefone,
// "+ Novo cliente" e a nota de que nome e telefone são obrigatórios. A busca
// e a lista são as da Troca (troca/CreditoPara, useCustomers). Sem "Seguir
// sem cliente": a condicional exige cliente.
//
// Cliente já cadastrado e sem telefone: o campo de telefone aparece aqui (o
// backend recusa com COND_TELEFONE) e o número vai em `customer_phone`, que
// completa o cadastro.
// ============================================================
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { maskPhone } from "@/utils/masks";
import { TELEFONE_MAX_CARACTERES } from "@/utils/telefone";
import { CreditoPara } from "../../../pdv/troca/CreditoPara";
import { TEXTOS_DA_NOVA as T } from "./textos";
import { e } from "./Casca";
import type { ClienteDaCondicional } from "./busca";

type Props = {
  cliente: ClienteDaCondicional | null;
  onEscolher: (c: ClienteDaCondicional) => void;
  onNovoCliente: (busca: string) => void;
  /** Telefone digitado aqui quando o cadastro da cliente não tem. */
  telefoneAvulso: string;
  onTelefoneAvulso: (v: string) => void;
  /** Mostra o erro do telefone avulso (depois de tentar continuar). */
  erroTelefone: boolean;
};

export function PassoCliente({ cliente, onEscolher, onNovoCliente, telefoneAvulso, onTelefoneAvulso, erroTelefone }: Props) {
  const semTelefone = !!cliente && !cliente.phone;
  return (
    <View testID="nova-passo-1">
      <Text style={e.qst}>{T.quemVaiLevar}</Text>
      <CreditoPara
        testID="nova-cliente"
        textos={{
          rotulo: "Cliente",
          buscaPlaceholder: T.buscaPlaceholder,
          buscaRotulo: T.buscaPlaceholder,
          novoCliente: T.novoCliente,
          novoClienteSub: "",
          // FORA DO MOCKUP: a busca fechada sem cliente escolhido.
          vendaSemCliente: "Nenhuma cliente escolhida",
          vendaSemClienteSub: "Busque pelo nome ou telefone, ou cadastre agora.",
          lojaDoCredito: "A condicional é desta loja:",
        }}
        cliente={cliente}
        daVendaOriginal={false}
        buscaInicial={!cliente}
        onEscolher={(c) => onEscolher({ id: c.id, name: c.name, phone: c.phone || null })}
        onNovoCliente={onNovoCliente}
      />
      {semTelefone && (
        <View style={s.semTel} testID="nova-sem-telefone">
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.semTelTit}>{T.semTelefoneTitulo}</Text>
              <Text style={e.notaTxt}>{T.semTelefoneTexto}</Text>
            </View>
          </View>
          <Text style={[e.rotulo, { marginTop: 10 }]}>{T.campoTelefone}</Text>
          <TextInput
            testID="nova-telefone-avulso"
            value={telefoneAvulso}
            onChangeText={(v) => onTelefoneAvulso(maskPhone(v))}
            keyboardType="phone-pad"
            maxLength={TELEFONE_MAX_CARACTERES}
            placeholder="(11) 98888-0142"
            placeholderTextColor={Colors.ink3}
            accessibilityLabel={T.campoTelefone}
            style={e.input}
          />
          {erroTelefone && <Text style={e.erro} testID="nova-telefone-avulso-erro">{T.erroTelefone}</Text>}
        </View>
      )}
      <View style={e.nota}>
        <Icon name="user" size={14} color={Colors.violet3} />
        <Text style={e.notaTxt}>{T.notaObrigatorios}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  semTel: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.amber, backgroundColor: Colors.amberD },
  semTelTit: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
});
