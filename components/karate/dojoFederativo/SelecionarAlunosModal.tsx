// ============================================================
// SelecionarAlunosModal — seletor multi-seleção reutilizável (F5b) entre
// "Inscrever alunos" (eventos/cursos da FEDERAÇÃO) e "Enviar candidatos"
// (exame de faixa da federação). Busca + seleção múltipla; SÓ aluno
// FEDERADO pode ser selecionado nesses dois fluxos (regra de ouro da
// fase) — não federado aparece desabilitado com a dica "Não federado
// ainda"; a partir de 3 não-federados, um aviso único no topo aponta o
// envio em LOTE da tela Federação (/karate/(dojo)/conexao).
//
// F9 (curso/seminário PRÓPRIO do dojô): o mesmo seletor é reusado pela
// tela "Meus eventos" (app/karate/(dojo)/eventos.tsx via
// components/karate/dojoEventos/MeusEventosTab), mas ali a regra de ouro
// NÃO se aplica — o backend ancorou a inscrição no aluno do dojô
// (karate_dojo_students) justamente pra que quem ainda não é federado
// também possa participar de um curso/seminário organizado pelo próprio
// dojô. `requireFederated={false}` desliga o filtro: todo aluno ATIVO
// fica selecionável, sem o aviso/atalho de federar. Default `true`
// preserva 100% do comportamento existente dos dois fluxos da federação
// (nenhum call site precisa mudar).
//
// Sem <Modal>-dentro-de-<Modal>: esta é a ÚNICA modal do fluxo (o
// resultado do lote é renderizado depois, inline na tela, via
// ResultadoLoteCard — mesmo racional documentado em conexao.tsx/
// AlunoFederacaoSection.tsx).
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
//
// QA prod 30/07 (item 1): busca os alunos ATIVOS pra oferecer na
// inscrição em lote — sem `limit`, o backend paginado (Aura-backend#429)
// só devolvia os 100 primeiros, e um dojô grande não conseguia
// selecionar quem ficasse de fora. Pede o teto (DOJO_STUDENTS_MAX_LIMIT).
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoStudentsApi, DojoStudent, DOJO_STUDENTS_MAX_LIMIT } from "@/services/karateDojoStudentsApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  busy: boolean;
  onSubmit: (studentIds: string[]) => void;
  /**
   * F9: false para eventos PRÓPRIOS do dojô (curso/seminário), onde aluno
   * não federado também participa. Default true — preserva os dois
   * fluxos da federação (inscrever em evento / enviar candidato a exame)
   * sem qualquer mudança de comportamento.
   */
  requireFederated?: boolean;
}

export function SelecionarAlunosModal({
  visible, onClose, federationId, title, subtitle, ctaLabel, busy, onSubmit,
  requireFederated = true,
}: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<DojoStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !federationId) return;
    setSelected(new Set());
    setQuery("");
    setLoading(true);
    karateDojoStudentsApi
      .listStudents(federationId, { status: "active", limit: DOJO_STUDENTS_MAX_LIMIT })
      .then((res) => setStudents(res.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [visible, federationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // QA véspera (dojô com centenas de alunos importados e nenhum federado):
  // a dica por linha mandava abrir ficha por ficha. O caminho certo é o
  // LOTE que já existe em Federação ("Enviar alunos para a federação
  // validar", com Selecionar todos) — a linha passa a só informar o
  // estado, e um aviso ÚNICO no topo leva pra lá. Conta sobre `students`
  // (não sobre `filtered`) pra busca não alterar o aviso.
  const naoFederados = useMemo(
    () => (requireFederated ? students.filter((s) => !s.federated).length : 0),
    [students, requireFederated]
  );

  const goToFederacao = () => {
    onClose();
    router.push("/karate/(dojo)/conexao" as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={st.overlay}>
        <View style={st.sheet}>
          <View style={st.head}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{title}</Text>
              {!!subtitle && <Text style={st.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={busy ? undefined : onClose} accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={KarateColors.ink} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={st.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar aluno pelo nome"
            placeholderTextColor={KarateColors.ink4}
            accessibilityLabel="Buscar aluno"
          />

          {naoFederados >= 3 && (
            <TouchableOpacity
              style={st.loteBar}
              onPress={goToFederacao}
              accessibilityRole="link"
              accessibilityLabel="Ir para Federação e enviar alunos para validar"
            >
              <Icon name="alert_circle" size={13} color={KarateColors.warn} />
              <Text style={st.loteTxt} numberOfLines={2}>
                {naoFederados} alunos ainda não são federados. Envie todos de uma vez em Federação → Enviar alunos para validar.
              </Text>
              <Icon name="arrow-forward" size={13} color={KarateColors.warn} />
            </TouchableOpacity>
          )}

          <ScrollView style={st.list}>
            {loading ? (
              <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 20 }} />
            ) : filtered.length === 0 ? (
              <Text style={st.emptyTxt}>Nenhum aluno encontrado.</Text>
            ) : (
              filtered.map((s) => {
                const on = selected.has(s.id);
                const disabled = requireFederated && !s.federated;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[st.row, disabled && st.rowDisabled]}
                    onPress={disabled ? undefined : () => toggle(s.id)}
                    disabled={disabled}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled }}
                  >
                    <View style={[st.checkbox, on && st.checkboxOn, disabled && st.checkboxDisabled]}>
                      {on && <Icon name="check" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowName, disabled && st.rowNameDisabled]}>{s.full_name}</Text>
                      {disabled ? (
                        <Text style={st.rowHint}>Não federado ainda</Text>
                      ) : (
                        !!s.belt_label && <Text style={st.rowSub}>{s.belt_label}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View style={st.footer}>
            <Text style={st.selCount}>{selected.size} selecionado{selected.size === 1 ? "" : "s"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={st.cancelBtn} onPress={busy ? undefined : onClose} accessibilityRole="button">
                <Text style={st.cancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.ctaBtn, (busy || selected.size === 0) && st.ctaBtnDisabled]}
                onPress={busy || selected.size === 0 ? undefined : () => onSubmit(Array.from(selected))}
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={st.ctaTxt}>{ctaLabel} ({selected.size})</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 460, maxHeight: "84%", backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 18, gap: 12 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } as ViewStyle,
  title: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  subtitle: { fontSize: 12, color: KarateColors.ink3, marginTop: 3, lineHeight: 17 } as TextStyle,
  search: { fontSize: 13, color: KarateColors.ink, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 9 } as any,
  list: { maxHeight: 320 } as ViewStyle,
  emptyTxt: { fontSize: 12.5, color: KarateColors.ink3, textAlign: "center", paddingVertical: 20 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  rowDisabled: { opacity: 0.55 } as ViewStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  checkboxOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  checkboxDisabled: { borderColor: KarateColors.border } as ViewStyle,
  rowName: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  rowNameDisabled: { color: KarateColors.ink3 } as TextStyle,
  rowSub: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  // Deixou de ser link (o atalho em lote vive no aviso do topo): informa
  // o estado sem chamar a atenção como ação.
  rowHint: { fontSize: 11.5, color: KarateColors.ink3, fontWeight: "600", marginTop: 2 } as TextStyle,
  loteBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 10 } as ViewStyle,
  loteTxt: { flex: 1, fontSize: 11.5, color: KarateColors.warn, fontWeight: "600", lineHeight: 16 } as TextStyle,
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  selCount: { fontSize: 12, color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 12 } as ViewStyle,
  cancelTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  ctaBtn: { backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 16, minWidth: 120, alignItems: "center", justifyContent: "center" } as ViewStyle,
  ctaBtnDisabled: { opacity: 0.5 } as ViewStyle,
  ctaTxt: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
});
