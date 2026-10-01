// ============================================================
// AURA. — components/screens/pdv/WarrantySaleActions.tsx
//
// Tela de sucesso da venda: emite a garantia escolhida no PDV (rascunho em
// stores/warrantyDraft) e oferece imprimir o certificado. Silencioso sem
// rascunho — a tela de sucesso não ganha ruído para quem não usa garantia.
//
// A emissão acontece UMA vez por venda (ref); se falhar, o botão "Tentar de
// novo" reemite sem refazer a venda. O rascunho só é limpo quando a garantia
// foi emitida.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { warrantiesApi, printWarranty, decomporChave, prazoLabel, type Warranty } from "@/services/warrantiesApi";
import { useWarrantyDraft, diasValidos } from "@/stores/warrantyDraft";

type Props = {
  companyId: string;
  saleId: string;
  /** Chaves do carrinho dessa venda (SaleResult.items[].productId). */
  saleKeys: string[];
};

export function WarrantySaleActions({ companyId, saleId, saleKeys }: Props) {
  const qc = useQueryClient();
  const draft = useWarrantyDraft;
  const [state, setState] = useState<"idle" | "issuing" | "done" | "error">("idle");
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [errMsg, setErrMsg] = useState("");
  // Congela o rascunho da venda no primeiro render: depois da emissão o store
  // é limpo, e o resumo da tela precisa continuar de pé.
  const planRef = useRef<Record<string, number> | null>(null);
  if (planRef.current === null) {
    const s = draft.getState();
    planRef.current = s.on ? diasValidos(s.days, saleKeys) : {};
  }
  const plan = planRef.current;
  const firedRef = useRef(false);

  async function emitir() {
    const keys = Object.keys(plan);
    if (!keys.length) return;
    setState("issuing");
    setErrMsg("");
    try {
      const items = keys.map((k) => {
        const { pid, vid } = decomporChave(k);
        return { product_id: pid, variant_id: vid, days: plan[k] };
      });
      const res = await warrantiesApi.issue(companyId, { sale_id: saleId, items });
      setWarranty(res.warranty);
      setState("done");
      draft.getState().reset();
      qc.invalidateQueries({ queryKey: ["warranties"] });
      toast.success("Garantia nº " + res.warranty.warranty_number + " emitida");
    } catch (e: any) {
      setState("error");
      const code = e?.data?.code;
      setErrMsg(
        code === "CUSTOMER_INCOMPLETE"
          ? "Cadastro do cliente sem CPF ou telefone. Complete-o e tente de novo."
          : code === "CUSTOMER_REQUIRED"
            ? "A venda não tem cliente — garantia exige cliente cadastrado."
            : code === "WARRANTY_ALREADY_ISSUED"
              ? "Esses produtos já têm garantia emitida nesta venda."
              : e?.data?.error || e?.message || "Não deu para emitir a garantia.",
      );
    }
  }

  useEffect(() => {
    if (firedRef.current || !Object.keys(plan).length) return;
    firedRef.current = true;
    emitir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!Object.keys(plan).length) return null;

  return (
    <View style={st.box} testID="warranty-sale-actions">
      <View style={st.head}>
        <Icon name="shield" size={13} color={Colors.violet3} />
        <Text style={st.title}>Garantia</Text>
      </View>

      {state === "issuing" && <ActivityIndicator color={Colors.violet3} size="small" />}

      {state === "done" && warranty && (
        <>
          {warranty.items.map((it) => (
            <Text key={it.id} style={st.line} numberOfLines={1}>
              {it.product_name} · {prazoLabel(it.days)}
            </Text>
          ))}
          <Pressable onPress={() => printWarranty(companyId, warranty.id)} style={st.btn} testID="warranty-print">
            <Icon name="file_text" size={14} color="#fff" />
            <Text style={st.btnText}>Imprimir garantia nº {warranty.warranty_number}</Text>
          </Pressable>
        </>
      )}

      {state === "error" && (
        <>
          <Text style={st.err}>{errMsg}</Text>
          <Pressable onPress={emitir} style={st.btn} testID="warranty-retry">
            <Text style={st.btnText}>Tentar de novo</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  box: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.violet3 },
  line: { fontSize: 12, color: Colors.ink2 },
  err: { fontSize: 12, color: "#ef4444" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
