// ============================================================
// AURA. — Nova condicional · "+ Novo cliente" (C6, 26/11/2026)
//
// Mockup "nova.p1novo": nome e telefone (WhatsApp) obrigatórios e CPF
// opcional. Mesma rota do cadastro rápido do Caixa (POST
// /companies/:id/customers, na loja de onde as peças saem); o cliente é do
// dono e vale em todas as lojas do grupo.
//
// Não é o NovoClienteNaTroca porque lá só o nome é obrigatório e não há CPF:
// a condicional recusa cliente sem telefone (COND_TELEFONE). A busca digitada
// vira nome ou telefone como lá (camposDaBusca).
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { maskCpf, isValidCpf, onlyDigits } from "@/utils/mask";
import { maskPhone } from "@/utils/masks";
import { normalizarTelefone, TELEFONE_MAX_CARACTERES } from "@/utils/telefone";
import { nomeValido } from "@/utils/cadastroRapidoCliente";
import { camposDaBusca } from "../../../pdv/troca/NovoClienteNaTroca";
import { TEXTOS_DA_NOVA as T } from "./textos";
import { e } from "./Casca";
import type { ClienteDaCondicional } from "./busca";

type Props = {
  companyId: string;
  busca: string;
  onCancelar: () => void;
  onPronto: (c: ClienteDaCondicional) => void;
};

/** Telefone com DDD (10 ou 11 dígitos) e sem dígito sobrando. */
export function telefoneDaCondicionalValido(v: string): boolean {
  const n = normalizarTelefone(v);
  return !n.erro && (n.digitos.length === 10 || n.digitos.length === 11);
}

export function NovoClienteCondicional({ companyId, busca, onCancelar, onPronto }: Props) {
  const qc = useQueryClient();
  const inicial = camposDaBusca(busca);
  const [nome, setNome] = useState(inicial.nome);
  const [tel, setTel] = useState(inicial.tel);
  const [cpf, setCpf] = useState("");
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const erroNome = !nomeValido(nome) ? T.erroNome : null;
  const erroTel = !telefoneDaCondicionalValido(tel) ? T.erroTelefone : null;
  const erroCpf = cpf && !isValidCpf(cpf) ? T.erroCpf : null;

  async function salvar() {
    setTentou(true);
    if (salvando || erroNome || erroTel || erroCpf) return;
    setSalvando(true);
    try {
      const corpo: Record<string, unknown> = { name: nome.trim(), phone: normalizarTelefone(tel).digitos, source: "pdv" };
      if (cpf) corpo.cpf_cnpj = onlyDigits(cpf);
      const res: any = await companiesApi.createCustomer(companyId, corpo);
      qc.invalidateQueries({ queryKey: ["customers"] });
      const id = res?.id || res?.customer?.id;
      if (!id) { toast.error(T.erroAoSalvar); return; }
      onPronto({
        id,
        name: res?.name || res?.customer?.name || nome.trim(),
        phone: res?.phone || res?.customer?.phone || normalizarTelefone(tel).digitos,
      });
    } catch (err: any) {
      toast.error(err?.message || T.erroAoSalvar);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled" testID="nova-novo-cliente">
        <Pressable onPress={onCancelar} style={e.voltar} testID="nova-novo-cliente-voltar" accessibilityRole="button">
          <Icon name="arrow_left" size={14} color={Colors.violet3} />
          <Text style={e.voltarTxt}>{T.voltarParaBusca}</Text>
        </Pressable>
        <Text style={s.titulo}>{T.novoClienteTitulo}</Text>

        <View style={e.campo}>
          <Text style={e.rotulo}>{T.campoNome}</Text>
          <TextInput testID="nova-novo-cliente-nome" value={nome} onChangeText={setNome} autoCapitalize="words"
            placeholderTextColor={Colors.ink3} style={e.input} autoFocus={!inicial.tel} accessibilityLabel={T.campoNome} />
          {tentou && !!erroNome && <Text style={e.erro} testID="nova-novo-cliente-erro-nome">{erroNome}</Text>}
        </View>

        <View style={e.campo}>
          <Text style={e.rotulo}>{T.campoTelefone}</Text>
          <TextInput testID="nova-novo-cliente-tel" value={tel} onChangeText={(v) => setTel(maskPhone(v))} keyboardType="phone-pad"
            maxLength={TELEFONE_MAX_CARACTERES} placeholder="(11) 98888-0142" placeholderTextColor={Colors.ink3}
            style={e.input} autoFocus={!!inicial.tel} accessibilityLabel={T.campoTelefone} />
          {tentou && !!erroTel && <Text style={e.erro} testID="nova-novo-cliente-erro-tel">{erroTel}</Text>}
        </View>

        <View style={[e.campo, { maxWidth: 300 }]}>
          <Text style={e.rotulo}>{T.campoCpf}</Text>
          <TextInput testID="nova-novo-cliente-cpf" value={cpf} onChangeText={(v) => setCpf(maskCpf(v))} keyboardType="numeric"
            placeholder={T.cpfPlaceholder} placeholderTextColor={Colors.ink3} style={e.input} accessibilityLabel={T.campoCpf} />
          {tentou && !!erroCpf ? <Text style={e.erro} testID="nova-novo-cliente-erro-cpf">{erroCpf}</Text> : <Text style={e.dica}>{T.cpfDica}</Text>}
        </View>

        <View style={e.nota}>
          <Icon name="store" size={14} color={Colors.violet3} />
          <Text style={e.notaTxt}>{T.notaGrupo}</Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Text style={e.footerInfo} numberOfLines={2}>{T.rodapeNovoCliente}</Text>
        <View style={e.footerActions}>
          <Pressable style={e.btnSec} onPress={onCancelar} testID="nova-novo-cliente-cancelar" accessibilityRole="button">
            <Text style={e.btnSecTxt}>{T.cancelar}</Text>
          </Pressable>
          <Pressable style={[e.btnPri, salvando && e.desligado]} onPress={salvar} disabled={salvando} testID="nova-novo-cliente-salvar" accessibilityRole="button">
            {salvando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={e.btnPriTxt}>{T.salvarCliente}</Text>}
          </Pressable>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  corpo: { padding: 20, paddingBottom: 8, maxWidth: 520 },
  titulo: { color: Colors.ink, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  footer: {
    paddingHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)", flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", alignItems: "center", gap: 12,
  },
});

export default NovoClienteCondicional;
