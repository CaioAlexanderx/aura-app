// ============================================================
// AURA. — NF-e 55 · Passo 1 · Cliente (CP4). Puxado do cadastro pela
// prévia; o que falta fica em amarelo, sem bloquear o "Continuar".
// ============================================================
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import type { Previa } from "@/services/nfe55Api";
import { OPCOES_IE, resumoDosFaltantes, type CampoForm, type FormNfe55 } from "@/utils/nfe55";
import type { Faltante } from "@/services/nfe55Api";
import { Campo, Cartao, Faixa, Opcao, p } from "./partes";

type Props = {
  form: FormNfe55;
  set: <K extends keyof FormNfe55>(k: K, v: FormNfe55[K]) => void;
  falta: Partial<Record<CampoForm, Faltante>>;
  faltantes: Faltante[];
  previa: Previa | null;
  estreito: boolean;
};

export function PassoCliente({ form, set, falta, faltantes, previa, estreito }: Props) {
  const op = previa?.operacao;
  const cnpj = form.documento.replace(/\D/g, "").length === 14;
  const pend = faltantes.filter((f) => f.campo.startsWith("destinatario."));
  const outraUf = !!(op && form.uf && op.uf_emitente && form.uf.toUpperCase() !== op.uf_emitente);
  return (
    <View testID="nfe55-passo-cliente">
      {pend.length ? (
        <Faixa tom="ambar" titulo={pend.length === 1 ? "Falta 1 informação do cliente, e a gente ajuda a completar" : `Faltam ${pend.length} informações do cliente, e a gente ajuda a completar`}
          texto="A venda já está registrada; isto é só para a nota. Os campos em amarelo são os que faltam. Dá para seguir e completar depois." testID="nfe55-faixa-faltam" />
      ) : (
        <Faixa tom="violeta" titulo={previa?.destinatario?.origem?.cadastro ? "Dados puxados do cadastro do cliente" : "Venda sem cliente cadastrado"}
          texto={previa?.destinatario?.origem?.cadastro ? "Confira. O que você mudar aqui pode ser salvo no cadastro também." : "Preencha quem está comprando. A NF-e exige CPF ou CNPJ e o endereço completo."} />
      )}
      <View style={[p.grid, estreito && { flexDirection: "column" }]}>
        <Cartao titulo="Cliente" sub="Empresa (CNPJ) ou pessoa (CPF).">
          <Campo rotulo="CPF ou CNPJ" valor={form.documento} onChange={(v) => set("documento", v)} falta={falta.documento} teclado="number-pad" mono testID="nfe55-documento" />
          <Campo rotulo={cnpj ? "Razão social" : "Nome"} valor={form.nome} onChange={(v) => set("nome", v)} falta={falta.nome} testID="nfe55-nome" />
          <Campo rotulo="E-mail para receber a nota" valor={form.email} onChange={(v) => set("email", v)} teclado="email-address" dica="Opcional. Usado no envio da nota por e-mail." testID="nfe55-email" />
          <Text style={[p.lab, { marginTop: 4 }]}>Inscrição Estadual (IE)</Text>
          {OPCOES_IE.map((o) => (
            <Opcao key={o.valor} ligada={form.indIeDest === o.valor} titulo={o.titulo} texto={o.texto}
              onPress={() => set("indIeDest", o.valor)} testID={"nfe55-ie-" + o.valor}>
              {o.valor === 1 && form.indIeDest === 1 ? (
                <View style={{ marginTop: 8 }}>
                  <Campo rotulo="Número da IE" valor={form.ie} onChange={(v) => set("ie", v)} falta={falta.ie} teclado="number-pad" mono testID="nfe55-ie" />
                </View>
              ) : null}
            </Opcao>
          ))}
          <Text style={p.hint}>Na dúvida, pergunte ao cliente. Se ele não tiver IE, deixe "Não tem IE".</Text>
        </Cartao>
        <Cartao titulo="Endereço do cliente" sub="A NF-e exige o endereço completo. Com o CEP, a gente acha a cidade.">
          <View style={[p.grid, { gap: 12 }, estreito && { flexDirection: "column", gap: 0 }]}>
            <View style={{ flex: 2, minWidth: 0 }}><Campo rotulo="CEP" valor={form.cep} onChange={(v) => set("cep", v)} falta={falta.cep} teclado="number-pad" mono placeholder="00000-000" testID="nfe55-cep" /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Campo rotulo="Número" valor={form.numero} onChange={(v) => set("numero", v)} falta={falta.numero} placeholder="S/N" testID="nfe55-numero" /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Campo rotulo="Compl." valor={form.complemento} onChange={(v) => set("complemento", v)} placeholder="Opcional" /></View>
          </View>
          <Campo rotulo="Rua" valor={form.logradouro} onChange={(v) => set("logradouro", v)} falta={falta.logradouro} testID="nfe55-rua" />
          <View style={[p.grid, { gap: 12 }, estreito && { flexDirection: "column", gap: 0 }]}>
            <View style={{ flex: 2, minWidth: 0 }}><Campo rotulo="Bairro" valor={form.bairro} onChange={(v) => set("bairro", v)} falta={falta.bairro} testID="nfe55-bairro" /></View>
            <View style={{ flex: 2, minWidth: 0 }}><Campo rotulo="Cidade" valor={form.municipio} onChange={(v) => set("municipio", v)} falta={falta.municipio || falta.codigoMunicipioIbge} testID="nfe55-cidade" /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Campo rotulo="UF" valor={form.uf} onChange={(v) => set("uf", v.toUpperCase().slice(0, 2))} falta={falta.uf} testID="nfe55-uf" /></View>
          </View>
          {falta.codigoMunicipioIbge ? (
            <Campo rotulo="Código IBGE da cidade (7 números)" valor={form.codigoMunicipioIbge} onChange={(v) => set("codigoMunicipioIbge", v)}
              falta={falta.codigoMunicipioIbge} teclado="number-pad" mono testID="nfe55-ibge" />
          ) : null}
          {outraUf ? (
            <Faixa tom="ambar" titulo={`Cliente de outro estado (${form.uf.toUpperCase()})`}
              texto={`A loja é de ${op!.uf_emitente}, então esta é uma venda interestadual. A gente sugere o código certo no próximo passo.`} testID="nfe55-outra-uf" />
          ) : null}
          {previa?.destinatario?.customer_id ? (
            <Pressable onPress={() => set("salvarNoCadastro", !form.salvarNoCadastro)} style={[p.opt, { alignItems: "center" }]}
              accessibilityRole="checkbox" accessibilityState={{ checked: form.salvarNoCadastro }} testID="nfe55-salvar">
              <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: form.salvarNoCadastro ? Colors.violet : Colors.border2, backgroundColor: form.salvarNoCadastro ? Colors.violet : "transparent" }} />
              <Text style={{ fontSize: 13, color: Colors.ink, flex: 1 }}>Salvar estes dados no cadastro do cliente</Text>
            </Pressable>
          ) : null}
        </Cartao>
      </View>
      {resumoDosFaltantes(faltantes, 1) ? <Text style={[p.muted, { marginTop: 8 }]}>Sem bloqueio: dá para seguir e completar antes de emitir.</Text> : null}
    </View>
  );
}
