// ============================================================
// Hub — etiquetas da conversa: aplicar, tirar, criar e apagar.
// Pílulas sempre visíveis (toque, não hover): tocar liga/desliga na conversa.
// "+ Nova" abre o nome e a cor; "Editar" mostra o × para apagar a etiqueta
// da loja (some de todas as conversas).
//
// Duas variantes do mockup (Main.dc.html):
//   painel — seção "Etiquetas" da coluna "Sobre o cliente" (pílulas pequenas);
//   folha  — "Etiquetas desta conversa", aberta pelo botão Etiqueta da barra
//            (pílulas grandes). Na folha os testIDs levam o prefixo
//            "hub-folha-" para não repetir os do painel.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hubApi, type HubLabel } from "@/services/hubApi";
import { K, Tx, Meta, Pilula, Ponto, superficie, SANS } from "./conversasUi";
import { aoTeclarNoPainel, focarPrimeiro } from "./teclado";

export const CORES_ETIQUETA = ["#7c3aed", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#ef4444"];

export function EtiquetasConversa({ companyId, convId, aplicadas, onChanged, onError, variante = "painel", onFechar }: {
  /** Folha: Esc fecha e o foco volta ao botão Etiqueta. */
  onFechar?: () => void;
  companyId: string; convId: string;
  aplicadas: HubLabel[];
  onChanged: () => void;
  onError: (m: string) => void;
  variante?: "painel" | "folha";
}) {
  const qc = useQueryClient();
  const folha = variante === "folha";
  const ref = useRef<any>(null);
  // As etiquetas chegam do servidor: tenta a cada render até achar a primeira opção.
  const focou = useRef(false);
  useEffect(() => { if (folha && !focou.current && ref.current?.querySelector?.('[data-opcao="1"]')) { focarPrimeiro(ref.current); focou.current = true; } });
  const id = (x: string) => (folha ? x.replace("hub-", "hub-folha-") : x);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [apagando, setApagando] = useState<HubLabel | null>(null);
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
    onSuccess: () => { setApagando(null); depois(); }, onError: falha,
  });

  const content = (
    <>
      <Meta>{folha ? "Etiquetas desta conversa" : "Etiquetas"}</Meta>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: folha ? 8 : 6, alignItems: "center" }}>
        {todas.map((l) => {
          const on = aplicadaIds.has(l.id);
          return (
            <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Pilula testID={id(`hub-etiqueta-${l.id}`)} pequena={!folha} on={on} disabled={mToggle.isPending} onPress={() => mToggle.mutate(l)} dados={folha ? { opcao: "1" } : undefined}>
                <Ponto cor={l.color} />
                <Tx style={{ fontSize: folha ? 14 : 13, fontWeight: "600", lineHeight: 18, color: on ? K.pillOnInk : K.ink }}>{l.name}</Tx>
              </Pilula>
              {editando && (
                <Pressable testID={id(`hub-etiqueta-apagar-${l.id}`)} onPress={() => setApagando(l)} accessibilityLabel={`Apagar a etiqueta ${l.name}`}>
                  <Tx style={{ fontSize: 18, fontWeight: "800", color: K.red, paddingHorizontal: 4 }}>×</Tx>
                </Pressable>
              )}
            </View>
          );
        })}
        <Pilula testID={id("hub-etiqueta-nova")} pequena={!folha} onPress={() => setCriando((v) => !v)}>+ Nova</Pilula>
        {todas.length > 0 && (
          <Pressable testID={id("hub-etiqueta-editar")} onPress={() => setEditando((v) => !v)} style={{ minHeight: 32, justifyContent: "center", paddingHorizontal: 4 }}>
            <Tx style={{ fontSize: 13, fontWeight: "600", color: K.ink3, lineHeight: 18 }}>{editando ? "Pronto" : "Editar"}</Tx>
          </Pressable>
        )}
      </View>
      {apagando && (
        <View testID={id("hub-etiqueta-confirmar")} style={[superficie.seca(16), { padding: 12, gap: 8, borderColor: "rgba(248,113,113,.45)" }]}>
          <Tx style={{ fontSize: 13, lineHeight: 18 }}>
            {`Apagar a etiqueta "${apagando.name}"? Ela sai de todas as conversas da loja.`}
          </Tx>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Pressable testID={id("hub-etiqueta-confirmar-sim")} disabled={mApagar.isPending} onPress={() => mApagar.mutate(apagando)}>
              <Tx style={{ fontSize: 13, fontWeight: "700", color: K.red, lineHeight: 18 }}>{mApagar.isPending ? "Apagando…" : "Apagar"}</Tx>
            </Pressable>
            <Pressable testID={id("hub-etiqueta-confirmar-nao")} onPress={() => setApagando(null)}>
              <Tx style={{ fontSize: 13, fontWeight: "600", color: K.ink3, lineHeight: 18 }}>Manter</Tx>
            </Pressable>
          </View>
        </View>
      )}
      {criando && (
        <View testID={id("hub-etiqueta-form")} style={[superficie.seca(20), { padding: 12, gap: 10 }]}>
          <TextInput testID={id("hub-etiqueta-nome")} value={nome} onChangeText={setNome} maxLength={30}
            placeholder="Nome da etiqueta (ex.: Esperando Pix)" placeholderTextColor={K.ink3}
            style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: K.dryBorda, fontSize: 14, color: K.ink, fontFamily: SANS }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CORES_ETIQUETA.map((c) => (
              <Pressable key={c} testID={id(`hub-etiqueta-cor-${c}`)} onPress={() => setCor(c)} accessibilityLabel={`Cor ${c}`}
                style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: 2, borderColor: cor === c ? K.ink : "transparent" }} />
            ))}
          </View>
          <Pilula testID={id("hub-etiqueta-salvar")} pequena on style={{ alignSelf: "flex-start" }}
            disabled={!nome.trim() || mCriar.isPending} onPress={() => mCriar.mutate()}>
            {mCriar.isPending ? "Criando…" : "Criar e usar nesta conversa"}
          </Pilula>
        </View>
      )}
    </>
  );

  if (folha) {
    return (
      <View ref={ref} testID="hub-folha-etiquetas" accessibilityLabel="Etiquetas" {...({ role: "dialog", dataSet: { waFoco: "1" }, onKeyDown: (e: any) => aoTeclarNoPainel(e, onFechar, "hub-envio-etiqueta") } as any)}
        style={[superficie.solida(24), { padding: 16, gap: 10, position: "absolute", left: 18, bottom: "100%" as any, marginBottom: 10, width: "100%", maxWidth: 420, zIndex: 3 }]}>
        {content}
      </View>
    );
  }
  return <View testID="hub-etiquetas" style={{ gap: 8 }}>{content}</View>;
}
