// ============================================================
// AURA. — Matcon M4: o lote no item do carrinho
//
// 22/09/2026 — docs/CONTRACT_MATCON.md (M4) e mockup
// docs/mockups/matcon-m4-profundidade.html (#carrinho, .hint/.aviso/.lrow).
//
// Duas coisas moram aqui, e as duas so existem com o gate ligado
// (utils/matconLots.usaLote — toggle do Matcon + frase da config + unidade
// em m²/m³):
//
//   · LoteDoItem  — a linha violeta "lote 27B · 95,12 m² disponíveis", o
//     botao "trocar lote" e o aviso ambar quando a quantidade nao cabe.
//     E o unico lugar que chama a API dos lotes, entao o carrinho de quem
//     nao controla lote nao dispara query nenhuma (o componente nem monta).
//   · LotePicker  — a folha do "trocar lote": os lotes com saldo, do mais
//     antigo pro mais novo, e o vendedor escolhe de qual pilha sai.
//
// Nunca bloqueia a venda (decisao de PO no mockup): informa, e quem decide
// e o balcao. Sem hover-reveal (regra 7 do CLAUDE.md) — "trocar lote" e
// cada lote da folha sao botoes sempre visiveis, tocaveis no celular.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { matconApi, type LotAllocation } from "@/services/matconApi";
import { useAuthStore } from "@/stores/auth";
import { fmtQty } from "@/utils/matconUnits";
import { alocarLotes, fraseDoAviso, fraseDoLote, type LoteSaldo } from "@/utils/matconLots";

const MONO = Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace";

/** Lotes com saldo do produto, do mais antigo pro mais novo (o GET ja
 *  devolve nessa ordem — FIFO e so nao reordenar). Lista vazia enquanto
 *  carrega, ou quando a loja ainda nao importou nota com lote. */
export function useLotesDoProduto(productId: string | null | undefined, enabled: boolean): LoteSaldo[] {
  const { company } = useAuthStore();
  const companyId = company?.id;

  const { data } = useQuery({
    queryKey: ["matcon-lots", companyId, productId],
    queryFn: () => matconApi.listLots(companyId as string, productId as string),
    enabled: !!companyId && !!productId && enabled,
    staleTime: 30000,
    retry: 1,
  });

  return useMemo(() => {
    const lots = (data as any)?.lots;
    return Array.isArray(lots) ? (lots as LoteSaldo[]) : [];
  }, [data]);
}

/** "41 cx · bitola 03 · entrou 12/09" — a segunda linha de cada lote na
 *  folha. Cada pedaco some sozinho quando a loja nao tem o dado. */
function detalheDoLote(lote: LoteSaldo, purchaseFactor?: number | null, purchaseUnit?: string | null): string {
  const partes: string[] = [];
  const fator = Number(purchaseFactor) || 0;
  if (fator > 0) {
    partes.push(fmtQty(Math.floor((Number(lote.qty) || 0) / fator), (purchaseUnit || "").trim() || "cx"));
  }
  if (lote.caliber) partes.push("bitola " + lote.caliber);
  if (lote.shade) partes.push("tom " + lote.shade);
  if (lote.received_at) {
    const d = new Date(lote.received_at);
    if (!isNaN(d.getTime())) {
      partes.push("entrou " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"));
    }
  }
  return partes.join(" · ");
}

export type LotePickerProps = {
  visible: boolean;
  onClose: () => void;
  /** Nome do produto, no subtitulo da folha. */
  productName: string;
  unit: string;
  lotes: LoteSaldo[];
  /** Lote escolhido a mao (null = a loja segue o FIFO). */
  selectedId?: string | null;
  onSelect: (lotId: string | null) => void;
  purchaseFactor?: number | null;
  purchaseUnit?: string | null;
};

export function LotePicker({
  visible, onClose, productName, unit, lotes,
  selectedId, onSelect, purchaseFactor, purchaseUnit,
}: LotePickerProps) {
  function escolher(lotId: string | null) {
    onSelect(lotId);
    onClose();
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={420} sheetStyle={{ backgroundColor: Colors.bg2 }}>
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} testID="matcon-lote-titulo">Escolher lote</Text>
          <Text style={s.lede} numberOfLines={2}>{productName}</Text>
        </View>
        <Pressable testID="matcon-lote-fechar" onPress={onClose} style={s.fechar} accessibilityLabel="Fechar">
          <Icon name="x" size={14} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 6 }}>
        {lotes.length === 0 ? (
          <Text style={s.vazio}>Este produto ainda não tem lote com saldo. A venda sai do estoque normal.</Text>
        ) : null}

        {lotes.map((l) => {
          const ativo = selectedId === l.id;
          const detalhe = detalheDoLote(l, purchaseFactor, purchaseUnit);
          return (
            <Pressable
              key={l.id}
              testID={"matcon-lote-opcao-" + l.id}
              onPress={() => escolher(l.id)}
              style={[s.opcao, ativo && s.opcaoAtiva]}
              accessibilityLabel={"Vender do lote " + l.lot_code}
            >
              <Icon name="layers" size={13} color={ativo ? Colors.violet : Colors.ink3} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.opcaoCod, ativo && { color: Colors.violet3 }]} numberOfLines={1}>lote {l.lot_code}</Text>
                {detalhe ? <Text style={s.opcaoDet} numberOfLines={1}>{detalhe}</Text> : null}
              </View>
              <Text style={s.opcaoQty}>{fmtQty(Number(l.qty) || 0, unit)}</Text>
            </Pressable>
          );
        })}

        {selectedId ? (
          <Pressable testID="matcon-lote-fifo" onPress={() => escolher(null)} style={s.fifo}>
            <Text style={s.fifoTxt}>Deixar a loja escolher (o lote mais antigo primeiro)</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ResponsiveSheet>
  );
}

export type LoteDoItemProps = {
  /** Id do PRODUTO (sem o sufixo da variante). */
  productId: string;
  productName: string;
  unit: string;
  qty: number;
  purchaseFactor?: number | null;
  purchaseUnit?: string | null;
  /** Devolve as alocacoes pro carrinho (items[].lot_allocations da venda).
   *  Opcional: sem ele a linha e so informacao de balcao. */
  onAllocations?: (allocations: LotAllocation[]) => void;
};

/** A linha do lote no item do carrinho + o aviso dos 3 estados. Monta so
 *  quando `usaLote` e verdade — e por isso que a query dos lotes nunca
 *  roda em loja que nao controla lote. */
export function LoteDoItem({
  productId, productName, unit, qty, purchaseFactor, purchaseUnit, onAllocations,
}: LoteDoItemProps) {
  const lotes = useLotesDoProduto(productId, true);
  const [preferido, setPreferido] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  // Recalcula a cada mudanca de quantidade, de lote preferido ou de saldo.
  const res = useMemo(() => alocarLotes(qty, lotes, preferido), [qty, lotes, preferido]);

  // O callback do carrinho muda de identidade a cada render do pai; guardar
  // em ref deixa o efeito depender so do resultado do rateio.
  const cb = useRef(onAllocations);
  cb.current = onAllocations;
  useEffect(() => {
    if (cb.current) cb.current(res.allocations);
  }, [res]);

  if (lotes.length === 0) return null;

  const primeiro = res.allocations.length > 0
    ? lotes.find((l) => l.id === res.allocations[0].lot_id) || null
    : lotes[0];
  const linha = fraseDoLote(primeiro, unit);
  const aviso = fraseDoAviso(res.estado, res.allocations, lotes, unit);

  return (
    <>
      <View style={s.hint}>
        <View style={s.indent} />
        <Icon name="layers" size={11} color={Colors.violet3} />
        <Text testID={"carrinho-lote-" + productId} style={s.hintTxt} numberOfLines={2}>{linha}</Text>
        <Pressable
          testID={"carrinho-trocar-lote-" + productId}
          onPress={() => setAberto(true)}
          style={s.trocar}
          accessibilityLabel={"Trocar o lote de " + productName}
        >
          <Text style={s.trocarTxt} numberOfLines={1}>trocar lote</Text>
        </Pressable>
      </View>

      {aviso ? (
        <View style={s.aviso} testID={"carrinho-lote-aviso-" + productId}>
          <Text style={s.avisoSimbolo}>⚠</Text>
          <Text style={s.avisoTxt}>{aviso}</Text>
        </View>
      ) : null}

      <LotePicker
        visible={aberto}
        onClose={() => setAberto(false)}
        productName={productName}
        unit={unit}
        lotes={lotes}
        selectedId={preferido}
        onSelect={setPreferido}
        purchaseFactor={purchaseFactor}
        purchaseUnit={purchaseUnit}
      />
    </>
  );
}

// Indentacao igual a das linhas 2 e 3 do item (avatar 32 + gap 8).
const ITEM_INDENT = 40;

const s = StyleSheet.create({
  // ── linha do lote no item do carrinho ──────────────────────
  indent: { width: ITEM_INDENT, flexShrink: 0 },
  hint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  hintTxt: { flex: 1, minWidth: 0, fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  trocar: {
    flexShrink: 0, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  trocarTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },

  // ── aviso ambar: simbolo E frase, nunca so a cor ───────────
  aviso: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    marginTop: 6, marginLeft: ITEM_INDENT,
    padding: 8, borderRadius: 10,
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "55",
  },
  avisoSimbolo: { fontSize: 12, color: Colors.amber, lineHeight: 16 },
  avisoTxt: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16, color: Colors.ink2 },

  // ── folha do "trocar lote" ─────────────────────────────────
  head: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  titulo: { fontSize: 20, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  lede: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  fechar: {
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  body: { flexGrow: 0, flexShrink: 1, paddingHorizontal: 16 },
  vazio: { fontSize: 12, color: Colors.ink3, paddingVertical: 10, lineHeight: 18 },
  opcao: {
    flexDirection: "row", alignItems: "center", gap: 9,
    paddingVertical: 11, paddingHorizontal: 11, marginBottom: 8,
    borderRadius: 12, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border,
  },
  opcaoAtiva: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  opcaoCod: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  opcaoDet: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  opcaoQty: { fontFamily: MONO, fontSize: 13, fontWeight: "700", color: Colors.ink2, flexShrink: 0 },
  fifo: { paddingVertical: 10, paddingHorizontal: 2 },
  fifoTxt: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
});

export default LotePicker;
