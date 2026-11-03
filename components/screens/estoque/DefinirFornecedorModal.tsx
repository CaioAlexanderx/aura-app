// ============================================================
// AURA. — Estoque: "Definir fornecedor" em lote (03/11/2026)
//
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html, tela 9.
// Quem tem 600 capas não abre uma por uma: marca na seleção (ou filtra e
// "Selecionar todos") e liga todas ao fornecedor de uma vez.
// POST /suppliers/:sid/products (já existia; Aura-backend#950 passou a
// gravar também a lista de fornecedores do produto, com custo opcional).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { suppliersApi, fornecedoresDoProdutoApi, type Supplier } from "@/services/suppliersApi";
import { maskCurrency } from "@/utils/masks";
import { numeroPositivo } from "@/utils/entradaDeMercadoria";

type Props = {
  visible: boolean;
  productIds: string[];
  semCusto: boolean;
  onClose: () => void;
  onFeito?: () => void;
};

const LOTE = 1000; // limite do backend por chamada
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function DefinirFornecedorModal({ visible, productIds, semCusto, onClose, onFeito }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<Supplier | null>(null);
  const [principal, setPrincipal] = useState(true);
  const [mesmoCusto, setMesmoCusto] = useState(false);
  const [custo, setCusto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBusca(""); setEscolhido(null); setPrincipal(true); setMesmoCusto(false); setCusto(""); setSalvando(false);
  }, [visible]);

  const { data } = useQuery({
    queryKey: ["suppliers", cid],
    queryFn: () => suppliersApi.list(cid!),
    enabled: visible && !!cid,
    staleTime: 60_000,
  });
  const opcoes = useMemo(() => {
    const q = semAcento(busca.trim());
    return (data?.suppliers || []).filter((f) => !q || semAcento(f.name).includes(q)).slice(0, 6);
  }, [data, busca]);

  if (!visible) return null;
  const n = productIds.length;

  async function criarEUsar() {
    if (!cid || !busca.trim()) return;
    try {
      const f = await suppliersApi.create(cid, { name: busca.trim() });
      qc.invalidateQueries({ queryKey: ["suppliers", cid] });
      setEscolhido(f);
    } catch (err: any) {
      toast.error(err?.message || "Não conseguimos cadastrar o fornecedor.");
    }
  }

  async function vincular() {
    if (!cid || !escolhido || !n || salvando) return;
    setSalvando(true);
    const cost = !semCusto && mesmoCusto ? numeroPositivo(custo) : null;
    try {
      let total = 0;
      for (let i = 0; i < productIds.length; i += LOTE) {
        const r = await fornecedoresDoProdutoApi.vincularEmLote(cid, escolhido.id, productIds.slice(i, i + LOTE), { is_main: principal, cost });
        total += r.updated || 0;
      }
      toast.success(`${escolhido.name} ligado a ${total} produto${total === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-suppliers"] });
      qc.invalidateQueries({ queryKey: ["suppliers", cid] });
      onFeito?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Não conseguimos ligar o fornecedor. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const check = (on: boolean) => (
    <View style={[s.box, !on && s.boxOff]}>{on ? <Text style={s.boxTxt}>✓</Text> : null}</View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}} testID="definir-fornecedor-modal">
          <View style={s.head}>
            <View style={s.ico}><Text style={s.icoTxt}>⇄</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Definir fornecedor</Text>
              <Text style={s.sub}>{n} produto{n === 1 ? "" : "s"}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar"><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
          </View>

          <Text style={s.label}>Fornecedor</Text>
          {escolhido ? (
            <Pressable style={[s.input, s.escolhido]} onPress={() => setEscolhido(null)}>
              <Text style={{ flex: 1, color: Colors.ink }} numberOfLines={1}>{escolhido.name}</Text>
              <Text style={s.trocar}>trocar</Text>
            </Pressable>
          ) : (
            <>
              <TextInput value={busca} onChangeText={setBusca} autoFocus placeholder="Buscar fornecedor…"
                placeholderTextColor={Colors.ink3} style={s.input as any} testID="definir-fornecedor-busca" />
              <View style={s.drop}>
                {opcoes.map((f, i) => (
                  <Pressable key={f.id} onPress={() => setEscolhido(f)} style={[s.item, i > 0 && s.sep]}>
                    <Text style={s.nome} numberOfLines={1}>{f.name}</Text>
                  </Pressable>
                ))}
                {busca.trim() ? (
                  <Pressable onPress={criarEUsar} style={[s.item, opcoes.length > 0 && s.sep]}>
                    <Text style={s.add}>＋ Cadastrar "{busca.trim()}" como fornecedor</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}

          <Pressable style={s.check} onPress={() => setPrincipal(!principal)} accessibilityRole="checkbox" accessibilityState={{ checked: principal }}>
            {check(principal)}
            <View style={{ flex: 1 }}>
              <Text style={s.checkTxt}>Tornar o fornecedor principal destes produtos</Text>
              <Text style={s.hint}>Desmarcado, entra como mais um fornecedor, sem trocar o principal.</Text>
            </View>
          </Pressable>
          {!semCusto ? (
            <Pressable style={s.check} onPress={() => setMesmoCusto(!mesmoCusto)} accessibilityRole="checkbox" accessibilityState={{ checked: mesmoCusto }}>
              {check(mesmoCusto)}
              <View style={{ flex: 1 }}>
                <Text style={s.checkTxt}>Aplicar o mesmo custo em todos</Text>
                <Text style={s.hint}>Deixe desmarcado se os custos variam. Cada um se ajusta na próxima entrada.</Text>
              </View>
            </Pressable>
          ) : null}
          {!semCusto && mesmoCusto ? (
            <View style={{ position: "relative", justifyContent: "center", marginTop: 8 }}>
              <Text style={s.prefixo}>R$</Text>
              <TextInput value={custo} onChangeText={(v) => setCusto(maskCurrency(v))} placeholder="0,00"
                placeholderTextColor={Colors.ink3} keyboardType="number-pad" style={[s.input, { paddingLeft: 34 }] as any} />
            </View>
          ) : null}

          <View style={s.foot}>
            <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
            <Pressable onPress={vincular} disabled={!escolhido || salvando}
              style={[s.btnPri, (!escolhido || salvando) && { opacity: 0.5 }]} testID="definir-fornecedor-confirmar">
              {salvando ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={s.btnPriTxt}>Vincular a {n} produto{n === 1 ? "" : "s"}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 440, backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  ico: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  icoTxt: { color: Colors.violet3, fontSize: 18, fontWeight: "800" },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12.5, color: Colors.ink3, marginTop: 2 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginTop: 12, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2, minHeight: 42 },
  escolhido: { flexDirection: "row", alignItems: "center", gap: 8 },
  trocar: { color: Colors.violet3, fontSize: 12, fontWeight: "600" },
  drop: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, marginTop: 6, overflow: "hidden" },
  item: { paddingHorizontal: 12, paddingVertical: 10 },
  sep: { borderTopWidth: 1, borderTopColor: Colors.border },
  nome: { color: Colors.ink, fontSize: 13 },
  add: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 12 },
  box: { width: 18, height: 18, borderRadius: 5, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOff: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border2 },
  boxTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  checkTxt: { color: Colors.ink2, fontSize: 13 },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  prefixo: { position: "absolute", left: 12, zIndex: 1, color: Colors.ink3, fontSize: 14 },
  foot: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  btnSec: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnSecTxt: { color: Colors.ink2, fontWeight: "600", fontSize: 13 },
  btnPri: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.violet, minWidth: 150, alignItems: "center" },
  btnPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
