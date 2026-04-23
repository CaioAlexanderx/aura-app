import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { variantsApi, type VariantAttribute, type QuickBatchResponse } from "@/services/variantsApi";

// ============================================================
// AURA. — Quick Variant Plus (Tarefa A)
//
// Botao "+" inline pra criar N variantes em batch herdando
// atributos do produto pai. Voltado pro fluxo:
//   1. Cliente cadastrou "Camiseta Polo" cor=Branco tamanho=M
//   2. Clica "+ Tamanho" e digita "P, G, GG"
//   3. Sistema mostra preview do diff:
//      - Vai criar 4 variantes (M-Branco do pai + P-Branco + G-Branco + GG-Branco)
//      - Pai vai virar container (estoque vai pra variante M)
//   4. Cliente confirma — atomic no backend
//
// Props:
//   productId: string
//   productName: string
//   parentColor?: string | null   // cor do produto pai (hex)
//   parentSize?: string | null    // tamanho do produto pai
//   parentStock?: number          // estoque do pai
//   hasVariants: boolean          // se ja tem variantes (muda o copy do diff)
//   attributeName: "Tamanho" | "Cor" | string  // pre-define o atributo
//   onSuccess?: () => void        // callback pos-success
//   compact?: boolean             // versao com so o botao (sem label)
// ============================================================

type Props = {
  productId: string;
  productName: string;
  parentColor?: string | null;
  parentSize?: string | null;
  parentStock?: number;
  hasVariants: boolean;
  attributeName?: string;
  onSuccess?: () => void;
  compact?: boolean;
};

// Parseia input batch separado por virgula. Aceita: "P, M, G", "P,M,G", "P M G".
function parseBatchInput(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,;\n]/)
    .map(v => v.trim())
    .filter(v => v.length > 0)
    .slice(0, 20); // max 20 (mesmo limite do backend)
}

// Decide qual valor "atual" o pai vai virar como variante.
// Se attribute = "Tamanho" e pai tem size: usa o size.
// Se attribute = "Cor" e pai tem color: usa "Cor base".
function getParentValueForAttribute(attrName: string, parentColor?: string | null, parentSize?: string | null): string | null {
  const lower = attrName.toLowerCase();
  if (lower === 'tamanho' && parentSize && parentSize.trim()) return parentSize.trim();
  if (lower === 'cor' && parentColor && parentColor.trim()) return 'Cor base';
  return null;
}

export function QuickVariantPlus({
  productId, productName, parentColor, parentSize, parentStock = 0,
  hasVariants, attributeName = 'Tamanho',
  onSuccess, compact = false,
}: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const parsedValues = useMemo(() => parseBatchInput(batchText), [batchText]);

  const mutation = useMutation({
    mutationFn: (body: any) => variantsApi.quickBatch(company!.id, productId, body),
    onSuccess: (res: QuickBatchResponse) => {
      qc.invalidateQueries({ queryKey: ['products', company?.id] });
      qc.invalidateQueries({ queryKey: ['variants', company?.id, productId] });
      // Mensagem de sucesso resumindo o que aconteceu
      const parts: string[] = [];
      if (res.parent_promoted) parts.push('produto pai promovido a variante');
      parts.push(res.created + ' variante(s) criada(s)');
      if (res.skipped > 0) parts.push(res.skipped + ' duplicada(s) ignorada(s)');
      toast.success(parts.join(', '));
      // Reset state
      setBatchText('');
      setOpen(false);
      setShowConfirm(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || err?.message || 'Erro ao criar variantes');
    },
  });

  function handleOpenConfirm() {
    if (parsedValues.length === 0) {
      toast.error('Digite ao menos um valor (ex: "P, M, G")');
      return;
    }
    setShowConfirm(true);
  }

  function handleConfirm() {
    mutation.mutate({
      attribute_name: attributeName,
      values: parsedValues,
      stock_per_variant: 0,
      // shared_attributes nao vai — backend extrai do pai automaticamente
    });
  }

  // Determina o valor atual do pai pra mostrar no diff
  const parentValueForBatch = getParentValueForAttribute(attributeName, parentColor, parentSize);
  // Se pai vai virar variante: produto NAO tem variantes ainda E pai tem attrs
  // E o valor do pai NAO esta sendo recriado no batch.
  const willPromoteParent = !hasVariants
    && (parentColor || parentSize)
    && parentValueForBatch
    && !parsedValues.some(v => v.toLowerCase() === parentValueForBatch.toLowerCase());

  // Trigger compact: so o botao "+ {attribute}"
  if (compact && !open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={s.compactBtn} hitSlop={4}>
        <Icon name="plus" size={11} color={Colors.violet3} />
        <Text style={s.compactText}>{attributeName}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[s.container, compact && s.containerCompact]}>
      {!compact && (
        <View style={s.header}>
          <Icon name="plus" size={12} color={Colors.violet3} />
          <Text style={s.headerTitle}>Criar variantes de {attributeName}</Text>
          {open && (
            <Pressable onPress={() => { setOpen(false); setBatchText(''); }} style={s.closeBtn}>
              <Text style={s.closeText}>x</Text>
            </Pressable>
          )}
        </View>
      )}

      {compact && open && (
        <View style={s.headerCompact}>
          <Text style={s.headerCompactTitle}>+ {attributeName}</Text>
          <Pressable onPress={() => { setOpen(false); setBatchText(''); }} style={s.closeBtn}>
            <Text style={s.closeText}>x</Text>
          </Pressable>
        </View>
      )}

      {!open && !compact && (
        <Pressable onPress={() => setOpen(true)} style={s.openBtn}>
          <Icon name="plus" size={13} color={Colors.violet3} />
          <Text style={s.openBtnText}>Adicionar {attributeName.toLowerCase()}s em lote</Text>
        </Pressable>
      )}

      {open && (
        <>
          <Text style={s.label}>Digite os valores separados por virgula</Text>
          <TextInput
            style={s.input}
            value={batchText}
            onChangeText={setBatchText}
            placeholder={attributeName === 'Tamanho' ? 'Ex: P, M, G, GG' : (attributeName === 'Cor' ? 'Ex: Vermelho, Verde, Azul' : 'Valores separados por virgula')}
            placeholderTextColor={Colors.ink3}
            autoFocus
          />

          {/* Preview chips dos valores */}
          {parsedValues.length > 0 && (
            <View style={s.chipsRow}>
              {parsedValues.map((v, i) => (
                <View key={i} style={s.chip}>
                  <Text style={s.chipText}>{v}</Text>
                </View>
              ))}
              <Text style={s.chipsCount}>{parsedValues.length} variante(s)</Text>
            </View>
          )}

          <Pressable
            onPress={handleOpenConfirm}
            disabled={parsedValues.length === 0 || mutation.isPending}
            style={[s.previewBtn, (parsedValues.length === 0 || mutation.isPending) && { opacity: 0.5 }]}
          >
            <Icon name="arrow_right" size={11} color="#fff" />
            <Text style={s.previewBtnText}>Pre-visualizar</Text>
          </Pressable>
        </>
      )}

      {/* DIFF MODAL — confirma o que vai acontecer */}
      {showConfirm && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmBox}>
            <View style={s.confirmHeader}>
              <Icon name="alert" size={14} color={Colors.violet3} />
              <Text style={s.confirmTitle}>Confirmar criacao de variantes</Text>
            </View>

            <Text style={s.confirmIntro}>
              Vou criar variantes de <Text style={{ fontWeight: '700' }}>{productName}</Text>:
            </Text>

            <ScrollView style={{ maxHeight: 200 }}>
              {willPromoteParent && (
                <View style={s.diffRow}>
                  <View style={[s.diffDot, { backgroundColor: Colors.amber || '#f59e0b' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.diffName}>Variante "{parentValueForBatch}" (do produto atual)</Text>
                    <Text style={s.diffMeta}>
                      Estoque atual ({parentStock} un) vai pra essa variante.
                      {parentColor ? ' Cor: ' + parentColor + '.' : ''}
                    </Text>
                  </View>
                </View>
              )}

              {parsedValues.map((v, i) => (
                <View key={i} style={s.diffRow}>
                  <View style={[s.diffDot, { backgroundColor: Colors.green }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.diffName}>Variante "{v}"</Text>
                    <Text style={s.diffMeta}>
                      Estoque inicial: 0
                      {parentColor && attributeName.toLowerCase() !== 'cor' ? ' / herda Cor do pai' : ''}
                      {parentSize && attributeName.toLowerCase() !== 'tamanho' ? ' / herda Tamanho do pai' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {willPromoteParent && (
              <View style={s.warnBox}>
                <Icon name="info" size={11} color={Colors.amber || '#f59e0b'} />
                <Text style={s.warnText}>
                  Como esse produto ainda nao tem variantes, o estoque atual ({parentStock} un)
                  vai migrar pra variante "{parentValueForBatch}". O produto pai vira um container
                  e o estoque agora vive nas variantes.
                </Text>
              </View>
            )}

            <View style={s.confirmActions}>
              <Pressable
                onPress={() => setShowConfirm(false)}
                disabled={mutation.isPending}
                style={s.cancelBtn}
              >
                <Text style={s.cancelText}>Voltar</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={mutation.isPending}
                style={[s.confirmBtn, mutation.isPending && { opacity: 0.5 }]}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.confirmBtnText}>Criar {parsedValues.length} variante{parsedValues.length === 1 ? '' : 's'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginVertical: 6 },
  containerCompact: { padding: 10 },

  compactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violetD, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderStyle: 'dashed' as any, borderColor: Colors.violet3 + '55' },
  compactText: { fontSize: 10, color: Colors.violet3, fontWeight: '700' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  headerTitle: { fontSize: 12, color: Colors.violet3, fontWeight: '700', flex: 1, textTransform: 'uppercase' as any, letterSpacing: 0.4 },
  headerCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerCompactTitle: { fontSize: 11, color: Colors.violet3, fontWeight: '700' },
  closeBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 12, color: Colors.ink3, fontWeight: '700' },

  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.violetD, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed' as any, borderColor: Colors.violet3 + '55' },
  openBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: '700' },

  label: { fontSize: 9, color: Colors.ink3, fontWeight: '700', textTransform: 'uppercase' as any, letterSpacing: 0.4, marginBottom: 4 },
  input: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 12, color: Colors.ink, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 },
  chip: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border2 },
  chipText: { fontSize: 11, color: Colors.violet3, fontWeight: '700' },
  chipsCount: { fontSize: 10, color: Colors.ink3, fontStyle: 'italic' as any, marginLeft: 4 },

  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, backgroundColor: Colors.violet, borderRadius: 8 },
  previewBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // DIFF MODAL
  confirmOverlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  confirmBox: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 20, maxWidth: 460, width: '90%', borderWidth: 1, borderColor: Colors.border2 },
  confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  confirmTitle: { fontSize: 14, color: Colors.ink, fontWeight: '700', flex: 1 },
  confirmIntro: { fontSize: 12, color: Colors.ink, marginBottom: 10, lineHeight: 16 },

  diffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  diffDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  diffName: { fontSize: 12, color: Colors.ink, fontWeight: '600' },
  diffMeta: { fontSize: 10, color: Colors.ink3, marginTop: 2, lineHeight: 13 },

  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: (Colors.amber || '#f59e0b') + '15', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: (Colors.amber || '#f59e0b') + '40' },
  warnText: { flex: 1, fontSize: 10.5, color: Colors.ink, lineHeight: 14 },

  confirmActions: { flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: '600' },
  confirmBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.violet, minWidth: 140, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
});

export default QuickVariantPlus;
