// ============================================================
// Hub — coluna "Sobre o cliente" (terceira coluna do desktop, Main.dc.html):
// cliente ligado ("É ela") com última compra, crediário e aniversário,
// etiquetas da conversa e o lembrete de que, com a conversa aberta, produto,
// orçamento, Pix, link, foto e áudio não gastam avisos nem novidades.
//
// Só WhatsApp tem cadastro e etiquetas: no Instagram a coluna não existe.
// No celular o mesmo conteúdo abre dentro da conversa ("Cliente e etiquetas").
// ============================================================
import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hubApi } from "@/services/hubApi";
import { conversaAbertaAte, CATEGORIES, CATEGORY_META } from "./types";
import { ClientePainel } from "./ClienteConversa";
import { EtiquetasConversa } from "./EtiquetasConversa";
import { K, Tx, Meta, Ico, Pilula, Ponto, superficie } from "./conversasUi";

export function PainelCliente({ companyId, convId, embutido = false }: { companyId: string; convId: string; embutido?: boolean }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["hub-thread", companyId, convId],
    queryFn: () => hubApi.messages(companyId, convId),
  });
  const conv = data?.conversation;
  if (!conv || conv.channel !== "whatsapp") return null;

  const aberta = !!conversaAbertaAte(conv.last_inbound_at);
  const mudou = () => {
    qc.invalidateQueries({ queryKey: ["hub-thread", companyId, convId] });
    qc.invalidateQueries({ queryKey: ["hub-conversations", companyId] });
  };

  return (
    <View testID="hub-painel-cliente" accessibilityLabel="Sobre o cliente" {...({ dataSet: { waFoco: "1" } } as any)}
      style={embutido
        ? { gap: 18, paddingVertical: 10 }
        : [superficie.solida(30), { padding: 22, gap: 18, alignSelf: "flex-start", width: "100%" }]}>
      <ClientePainel companyId={companyId} convId={convId} onChanged={mudou} onError={setErro} />
      <EtiquetasConversa companyId={companyId} convId={convId} aplicadas={conv.labels || []} onChanged={mudou} onError={setErro} />
      {/* Triagem (produto, troca, entrega...): mesmas pílulas pequenas das etiquetas, na mesma seção. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -10 }}>
        {CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const on = conv.category === cat;
          return (
            <Pilula key={cat} testID={`hub-categoria-${cat}`} pequena on={on}
              onPress={() => { void hubApi.setCategory(companyId, convId, on ? null : cat).then(mudou).catch((e: any) => setErro(e?.message || "Não foi possível mudar a categoria.")); }}>
              <Ponto cor={meta.color} />
              <Tx style={{ fontSize: 13, fontWeight: "600", lineHeight: 18, color: on ? K.pillOnInk : K.ink }}>{meta.label}</Tx>
            </Pilula>
          );
        })}
      </View>
      {erro && <Tx testID="hub-painel-erro" style={{ fontSize: 13, color: K.warn, lineHeight: 18 }}>{erro}</Tx>}
      {aberta && (
        <View style={[superficie.seca(20), { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 14, paddingHorizontal: 16 }]}>
          <View style={{ marginTop: 2 }}><Ico nome="check" size={18} cor={K.ok} traco={2} /></View>
          <Tx style={{ flex: 1, fontSize: 13, color: K.ink2, lineHeight: 19 }}>
            {"Enquanto a conversa está aberta, produto, orçamento, Pix, link, foto e áudio saem "}
            <Tx style={{ fontSize: 13, lineHeight: 19, fontWeight: "700" }}>sem gastar</Tx>
            {" avisos nem novidades."}
          </Tx>
        </View>
      )}
    </View>
  );
}
