// ============================================================
// components/endereco/EnderecoNaFicha.tsx
//
// "Endereço para entrega" na ficha do cliente (Clientes, linha aberta).
// Recolhido: mostra o endereço (ou "Sem endereço") e um botão. Aberto: o
// EnderecoForm com Cancelar/Salvar, que grava só o endereço (PATCH).
//
// Multi-CNPJ: o endereço é do cliente, não da loja. O PATCH vai para a
// empresa onde ele foi cadastrado (a mesma do crediário e do histórico);
// o backend é owner-scoped e a linha é uma só, então vale em todas as
// lojas do mesmo dono.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { EnderecoForm, type EnderecoFormProps } from "./EnderecoForm";
import {
  ENDERECO_VAZIO, enderecoComecado, enderecoParaApi, erroDoEndereco, linhaDaCidade, resumoDoEndereco,
  type Endereco,
} from "./endereco";

type Props = {
  customerId: string;
  /** Empresa onde o cliente foi cadastrado (ou a atual). */
  companyId: string | null | undefined;
  endereco: Endereco | null | undefined;
  /** Injetável para teste. */
  buscarCep?: EnderecoFormProps["buscarCep"];
  salvar?: (companyId: string, customerId: string, body: any) => Promise<any>;
};

export function EnderecoNaFicha({ customerId, companyId, endereco, buscarCep, salvar }: Props) {
  const qc = useQueryClient();
  const atual = endereco || ENDERECO_VAZIO;
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Endereco>(atual);
  const [salvando, setSalvando] = useState(false);
  const tem = enderecoComecado(atual);
  const testID = `cliente-endereco-${customerId}`;

  async function aoSalvar() {
    const erro = erroDoEndereco(rascunho);
    if (erro) { toast.error(erro); return; }
    if (!companyId) { toast.error("Empresa não identificada"); return; }
    setSalvando(true);
    try {
      await (salvar || companiesApi.updateCustomer)(companyId, customerId, enderecoParaApi(rascunho));
      toast.success("Endereço salvo");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditando(false);
    } catch (e: any) {
      toast.error(e?.message || "Não deu para salvar o endereço");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={s.wrap} testID={testID}>
      <Text style={s.label}>Endereço para entrega</Text>
      {!editando ? (
        <View style={s.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {tem ? (
              <>
                <Text style={s.main}>{resumoDoEndereco(atual) || "Endereço incompleto"}</Text>
                {!!linhaDaCidade(atual) && <Text style={s.sub}>{linhaDaCidade(atual)}</Text>}
                {!!atual.reference && <Text style={s.sub}>Ref.: {atual.reference}</Text>}
              </>
            ) : (
              <Text style={s.vazio} testID={`${testID}-vazio`}>Sem endereço</Text>
            )}
          </View>
          <Pressable
            onPress={() => { setRascunho(atual); setEditando(true); }}
            style={s.btn}
            testID={`${testID}-editar`}
            accessibilityRole="button"
          >
            <Text style={s.btnTxt}>{tem ? "Editar endereço" : "Adicionar endereço"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ width: "100%" }}>
          <EnderecoForm value={rascunho} onChange={setRascunho} buscarCep={buscarCep} testID={`${testID}-form`} autoFocusCep={!tem} />
          <View style={s.acts}>
            <Pressable onPress={() => setEditando(false)} style={s.btn} disabled={salvando} accessibilityRole="button">
              <Text style={s.btnTxt}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={aoSalvar} style={[s.btnPri, salvando && { opacity: 0.6 }]} disabled={salvando}
              testID={`${testID}-salvar`} accessibilityRole="button">
              <Text style={s.btnPriTxt}>{salvando ? "Salvando…" : "Salvar"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  main: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  vazio: { fontSize: 13, color: Colors.amber, fontWeight: "600" },
  acts: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 12 },
  btn: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg3,
  },
  btnTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  btnPri: { minHeight: 40, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPriTxt: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default EnderecoNaFicha;
