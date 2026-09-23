// ============================================================
// AURA. — Matcon M3: MarcarProfissionalModal ("Marcar como parceiro")
//
// 22/09/2026 (docs/CONTRACT_MATCON.md, seção M3 · mockup
// docs/mockups/matcon-m3-clube-calculadora.html #ficha, "Tocou — escolher
// o ofício e pronto"). Marca um cliente já cadastrado como profissional
// parceiro: `POST .../matcon/professionals {customer_id, trade}`.
//
// 22/09/2026 (revisão de texto): na tela o programa chama "Profissionais
// Parceiros"; o botão é "Marcar como parceiro" e o título do modal,
// "Marcar como profissional parceiro" — nada de "clube" nem "ofício" na
// cara do lojista. O nome do arquivo e da API não mudam.
//
// Dois chamadores:
//   - CustomerRow.tsx ("Marcar como parceiro" na ficha) já sabe
//     QUEM é o cliente — passa `presetCustomer` e o modal pula direto pro
//     chipset de profissão.
//   - IndicadoPorChip.tsx ("Escolher um cliente já cadastrado" no rodapé
//     da busca do Caixa) não tem cliente nenhum ainda — o modal abre com a
//     busca (mesmo filtro local de nome/telefone que useCustomers já
//     carrega, sem rota nova).
//
// Profissional é um cliente marcado, não um segundo cadastro — por isso
// não existe endpoint de busca de "clientes elegíveis": a lista é a mesma
// de sempre, filtrada aqui.
//
// QA 23/09/2026: com a rota ainda em 404 o modal mostrava o toast técnico
// "Rota nao encontrada". Agora a falha vira frase simples (textoDoErro),
// dita também DENTRO do modal — que continua aberto, com o cliente e a
// profissão escolhidos, pronto para "Tentar de novo". A frase lembra que o
// cliente continua salvo (no Caixa ele pode ter acabado de ser cadastrado).
// Multi-CNPJ: `companyId` (opcional) vence a empresa da sessão — a ficha
// passa a empresa onde o cliente foi cadastrado.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useAuthStore } from "@/stores/auth";
import { useCustomers } from "@/hooks/useCustomers";
import { toast } from "@/components/Toast";
import { textoDoErro } from "@/components/matcon/erroMatcon";
import { normalizeText } from "@/utils/productSearch";
import {
  matconApi, TRADE_LABELS, type Professional, type ProfessionalTrade,
} from "@/services/matconApi";

export type MarcarProfissionalCustomer = { id: string; name: string; phone?: string | null };

type Props = {
  visible: boolean;
  onClose: () => void;
  onMarked: (professional: Professional) => void;
  /** Cliente já escolhido (ficha do cliente) — pula a etapa de busca. */
  presetCustomer?: MarcarProfissionalCustomer | null;
  /** Empresa do cliente (multi-CNPJ). Sem ela, a empresa da sessão. */
  companyId?: string | null;
};

export function MarcarProfissionalModal({ visible, onClose, onMarked, presetCustomer, companyId }: Props) {
  const { company } = useAuthStore();
  const empresaId = companyId || company?.id || null;
  const { customers } = useCustomers();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MarcarProfissionalCustomer | null>(presetCustomer || null);
  const [trade, setTrade] = useState<ProfessionalTrade | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelected(presetCustomer || null);
    setTrade(null);
    setQuery("");
    setErro(null);
  }, [visible, presetCustomer]);

  const results = useMemo(() => {
    const q = normalizeText(query.trim());
    const qDigits = query.replace(/\D/g, "");
    if (!q && !qDigits) return [];
    return customers
      .filter(c =>
        (q.length > 0 && normalizeText(c.name).includes(q)) ||
        (qDigits.length >= 4 && (c.phone || "").replace(/\D/g, "").includes(qDigits))
      )
      .slice(0, 20);
  }, [customers, query]);

  // 22/09/2026 (QA Matcon): o `return null` ficava ANTES do useMemo acima e
  // quebrava a ordem dos hooks ao abrir ("Rendered more hooks than during
  // the previous render") — o modal caía no ErrorBoundary no primeiro
  // toque em "Marcar como profissional". Hooks sempre rodam; o early
  // return vem depois de todos.
  if (!visible) return null;

  async function handleConfirm() {
    if (!selected || !trade || !empresaId || saving) return;
    setSaving(true);
    setErro(null);
    try {
      const { professional } = await matconApi.createProfessional(empresaId, {
        customer_id: selected.id, trade,
      });
      toast.success(selected.name + " agora é profissional parceiro. As vendas que ele indicar dão pontos para ele.");
      onMarked(professional);
      onClose();
    } catch (e: any) {
      const msg = textoDoErro(
        e,
        "Não consegui marcar " + selected.name + " como parceiro agora. O cadastro de cliente continua salvo — toque em Tentar de novo daqui a pouco.",
      );
      setErro(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={440}>
      <View style={s.header}>
        <Text style={s.title}>Marcar como profissional parceiro</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar">
          <Icon name="x" size={18} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {!selected && (
          <>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Nome ou telefone do cliente"
              placeholderTextColor={Colors.ink3}
              style={s.input}
              testID="marcarprof-busca"
            />
            {query.trim().length > 0 && results.length === 0 && (
              <Text style={s.empty}>Nenhum cliente encontrado</Text>
            )}
            {results.map(c => (
              <Pressable
                key={c.id}
                style={s.row}
                onPress={() => setSelected({ id: c.id, name: c.name, phone: c.phone })}
                testID={`marcarprof-cliente-${c.id}`}
              >
                <Text style={s.rowName}>{c.name}</Text>
                {!!c.phone && <Text style={s.rowMeta}>{c.phone}</Text>}
              </Pressable>
            ))}
          </>
        )}

        {selected && (
          <>
            <View style={s.selectedBox}>
              <Text style={s.selectedName}>{selected.name}</Text>
              {!presetCustomer && (
                <Pressable onPress={() => { setSelected(null); setErro(null); }} testID="marcarprof-trocar-cliente">
                  <Text style={s.trocar}>Trocar cliente</Text>
                </Pressable>
              )}
            </View>

            <Text style={s.label}>O que ele faz?</Text>
            <View style={s.chipset}>
              {(Object.keys(TRADE_LABELS) as ProfessionalTrade[]).map(key => {
                const on = trade === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => { setTrade(key); setErro(null); }}
                    style={[s.chip, on && s.chipOn]}
                    testID={`marcarprof-oficio-${key}`}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>{TRADE_LABELS[key]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {!!erro && (
          <Text style={s.erro} testID="marcarprof-erro" accessibilityRole="alert">{erro}</Text>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Pressable onPress={onClose} style={s.cancelBtn} disabled={saving}>
          <Text style={s.cancelText}>Cancelar</Text>
        </Pressable>
        <Button
          title={erro ? "Tentar de novo" : "Marcar como parceiro"}
          variant="primary"
          onPress={handleConfirm}
          disabled={!selected || !trade}
          loading={saving}
          full
          accessibilityLabel="Confirmar profissional parceiro"
        />
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, paddingBottom: 10 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  body: { paddingHorizontal: 18, paddingBottom: 8, gap: 8 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink,
    backgroundColor: Colors.bg3,
  },
  empty: { fontSize: 12, color: Colors.ink3, paddingVertical: 10, textAlign: "center" },
  erro: {
    fontSize: 12, color: Colors.ink, lineHeight: 17, padding: 10, borderRadius: 10,
    backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "73",
  },
  row: {
    paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  rowMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  selectedBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4,
  },
  selectedName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  trocar: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: Colors.ink, marginTop: 6, marginBottom: 4 },
  chipset: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  chipOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  footer: {
    flexDirection: "row", gap: 10, padding: 18, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, justifyContent: "center" },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
});
