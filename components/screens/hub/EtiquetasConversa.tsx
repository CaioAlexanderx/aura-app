// ============================================================
// Hub — etiquetas da conversa: aplicar, tirar, criar e apagar.
// Chips sempre visíveis (toque, não hover): tocar liga/desliga na conversa.
// "+ Nova" abre o nome e a cor; "Editar" mostra o × para apagar a etiqueta
// da loja (some de todas as conversas).
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { hubApi, type HubLabel } from "@/services/hubApi";

export const CORES_ETIQUETA = ["#7c3aed", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#ef4444"];

export function EtiquetasConversa({ companyId, convId, aplicadas, onChanged, onError }: {
  companyId: string; convId: string;
  aplicadas: HubLabel[];
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_ETIQUETA[0]);

  const { data } = useQuery({
    queryKey: ["hub-etiquetas", companyId],
    queryFn: () => hubApi.etiquetas(companyId),
    staleTime: 30000,
  });
  const todas = data?.labels || [];
  const aplicadaIds = new Set(aplicadas.map((l) => l.id));

  const depois = () => {
    qc.invalidateQueries({ queryKey: ["hub-etiquetas", companyId] });
    onChanged();
  };
  const falha = (e: any) => onError(e?.message || "Não foi possível mexer na etiqueta.");

  const alternar = (l: HubLabel) => aplicadaIds.has(l.id)
    ? hubApi.tirarEtiqueta(companyId, convId, l.id)
    : hubApi.aplicarEtiqueta(companyId, convId, l.id);
  const mToggle = useMutation({ mutationFn: alternar, onSuccess: depois, onError: falha });

  const mCriar = useMutation({
    mutationFn: async () => {
      const { label } = await hubApi.criarEtiqueta(companyId, { name: nome.trim(), color: cor });
      await hubApi.aplicarEtiqueta(companyId, convId, label.id);
    },
    onSuccess: () => { setNome(""); setCriando(false); depois(); },
    onError: falha,
  });
  const mApagar = useMutation({
    mutationFn: (l: HubLabel) => hubApi.apagarEtiqueta(companyId, l.id),
    onSuccess: depois, onError: falha,
  });

  return (
    <View testID="hub-etiquetas" style={s.wrap}>
      <Text style={s.titulo}>Etiquetas desta conversa</Text>
      <View style={s.chips}>
        {todas.map((l) => {
          const on = aplicadaIds.has(l.id);
          return (
            <View key={l.id} style={s.chipLinha}>
              <Pressable testID={`hub-etiqueta-${l.id}`} disabled={mToggle.isPending} onPress={() => mToggle.mutate(l)}
                style={[s.chip, { borderColor: l.color }, on && { backgroundColor: l.color }]}>
                <Text style={[s.chipText, { color: on ? "#fff" : l.color }]}>{l.name}</Text>
              </Pressable>
              {editando && (
                <Pressable testID={`hub-etiqueta-apagar-${l.id}`} onPress={() => mApagar.mutate(l)} accessibilityLabel={`Apagar a etiqueta ${l.name}`}>
                  <Text style={s.apagar}>×</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <Pressable testID="hub-etiqueta-nova" onPress={() => setCriando((v) => !v)} style={[s.chip, s.nova]}>
          <Text style={s.novaText}>+ Nova</Text>
        </Pressable>
        {todas.length > 0 && (
          <Pressable testID="hub-etiqueta-editar" onPress={() => setEditando((v) => !v)}>
            <Text style={s.editar}>{editando ? "Pronto" : "Editar"}</Text>
          </Pressable>
        )}
      </View>
      {criando && (
        <View testID="hub-etiqueta-form" style={s.form}>
          <TextInput testID="hub-etiqueta-nome" style={s.input} value={nome} onChangeText={setNome}
            maxLength={30} placeholder="Nome da etiqueta (ex.: Esperando Pix)" placeholderTextColor={Colors.ink3} />
          <View style={s.cores}>
            {CORES_ETIQUETA.map((c) => (
              <Pressable key={c} testID={`hub-etiqueta-cor-${c}`} onPress={() => setCor(c)}
                style={[s.cor, { backgroundColor: c }, cor === c && s.corOn]} accessibilityLabel={`Cor ${c}`} />
            ))}
          </View>
          <Pressable testID="hub-etiqueta-salvar" disabled={!nome.trim() || mCriar.isPending}
            style={[s.botao, (!nome.trim() || mCriar.isPending) && { opacity: 0.5 }]} onPress={() => mCriar.mutate()}>
            <Text style={s.botaoText}>{mCriar.isPending ? "Criando…" : "Criar e usar nesta conversa"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 8, gap: 6 },
  titulo: { fontSize: 11, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.4, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chipLinha: { flexDirection: "row", alignItems: "center", gap: 3 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  chipText: { fontSize: 11.5, fontWeight: "700" },
  nova: { borderColor: Colors.border2, borderStyle: "dashed" },
  novaText: { fontSize: 11.5, fontWeight: "700", color: Colors.ink3 },
  editar: { fontSize: 11.5, fontWeight: "700", color: Colors.ink3, paddingHorizontal: 4 },
  apagar: { fontSize: 16, fontWeight: "800", color: Colors.red, paddingHorizontal: 3 },
  form: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, gap: 8, backgroundColor: Colors.bg3 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2 },
  cores: { flexDirection: "row", gap: 8 },
  cor: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "transparent" },
  corOn: { borderColor: Colors.ink },
  botao: { alignSelf: "flex-start", backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  botaoText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});
