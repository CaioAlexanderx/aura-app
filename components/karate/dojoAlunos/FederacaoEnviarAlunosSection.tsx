// ============================================================
// FederacaoEnviarAlunosSection — envio em LOTE de alunos do dojô para a
// federação validar (F9 — Federação absorve Solicitações, 04/08/2026)
//
// DECISÃO DO CAIO (QA da tela Solicitações): "não faz sentido preencher
// uma nova ficha de um praticante que provavelmente já está registrado"
// — a tela antiga (app/karate/(dojo)/solicitacoes.tsx, formulário
// NewRequestForm de components/karate/PractitionerRequestForm.tsx)
// pedia pro sensei REDIGITAR do zero o mesmo aluno que já está em "Meus
// alunos". Vira lista de SELEÇÃO MÚLTIPLA: o sensei marca vários alunos
// já cadastrados no dojô e envia de uma vez — sem formulário nenhum.
//
// BACKEND: não existe (nem foi criado aqui) endpoint de lote. Reusa
// karateDojoStudentsApi.requestFederation — a MESMA rota POST
// .../students/:sid/federate (com { request: true, ...ficha }) que a
// ficha do aluno já usa em "Solicitar filiação" (F5a, Aura-backend#425 +
// migration 253 — ver AlunoFederacaoSection.tsx), chamada uma vez por
// aluno selecionado, SEQUENCIAL. O que muda aqui é só a ORIGEM do
// payload: em vez de um formulário, ele é montado com os campos que o
// PRÓPRIO cadastro do aluno já tem (DojoStudent — full_name/birth_date/
// sex/cpf/rg/phone/email/belt_label/endereço/responsável). Aluno sem
// algum campo obrigatório da ficha H1 falha ANTES da chamada de rede,
// listando o que falta — nunca silenciosamente.
//
// Quem já é federado (`federation_link_status === "linked"`) ou já tem
// pedido em análise (`"pending"`) NÃO pode ser selecionado — aparece com
// o selo de status no lugar do checkbox (o pedido em 'pending' é
// idempotente no backend, mas não incentivamos reenvio manual daqui).
//
// Vive como seção separada (não inline em conexao.tsx) pelo mesmo motivo
// de karateDojoStudentsApi ser um service próprio: edição cirúrgica,
// arquivo pequeno e focado.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { toast } from "@/components/Toast";
import {
  karateDojoStudentsApi, DojoStudent, DojoStudentFederationLinkStatus,
  DOJO_STUDENTS_MAX_LIMIT, FederationRequestPayload,
} from "@/services/karateDojoStudentsApi";
import { ageFromISO, onlyDigits, mapFederationError } from "./helpers";

interface Props {
  federationId: string;
}

interface RowResult {
  id: string;
  name: string;
  ok: boolean;
  reason?: string;
}

const STATUS_VIEW: Record<DojoStudentFederationLinkStatus, { label: string; color: string; bg: string; icon: string }> = {
  linked:  { label: "Federado",      color: KarateColors.ok,   bg: KarateColors.okSoft, icon: "shield" },
  pending: { label: "Aguardando",    color: KarateColors.warn, bg: KarateColors.bg2,    icon: "time-outline" },
  none:    { label: "Não federado",  color: KarateColors.ink3, bg: KarateColors.bg2,    icon: "info" },
};

// Mesma checagem de obrigatoriedade da ficha H1 que AlunoFederacaoSection
// já valida no formulário manual (submitRequest) — aqui roda ANTES da
// chamada de rede, contra o dado que o aluno já tem salvo (sem digitar
// nada de novo).
function missingFieldsFor(s: DojoStudent): string[] {
  const missing: string[] = [];
  if (!s.full_name?.trim()) missing.push("nome");
  if (!s.birth_date) missing.push("data de nascimento");
  if (!s.sex) missing.push("sexo");
  if (onlyDigits(s.cpf).length !== 11) missing.push("CPF");
  if (!s.rg?.trim()) missing.push("RG");
  if (onlyDigits(s.phone).length < 10) missing.push("telefone");
  if (!s.email?.trim()) missing.push("e-mail");
  if (!s.belt_label?.trim()) missing.push("faixa");
  if (onlyDigits(s.zip_code).length !== 8) missing.push("CEP");
  if (!s.street?.trim()) missing.push("rua");
  if (!s.number?.trim()) missing.push("número");
  if (!s.neighborhood?.trim()) missing.push("bairro");
  if (!s.city?.trim() ) missing.push("cidade");
  if (!s.state || s.state.trim().length !== 2) missing.push("UF");
  const age = ageFromISO(s.birth_date);
  if (age != null && age < 18) {
    if (!s.guardian?.full_name?.trim()) missing.push("responsável");
    if (onlyDigits(s.guardian?.phone).length < 10) missing.push("telefone do responsável");
    if (!s.guardian?.relationship?.trim()) missing.push("parentesco do responsável");
  }
  return missing;
}

function payloadFor(s: DojoStudent): FederationRequestPayload {
  const age = ageFromISO(s.birth_date);
  const minor = age != null && age < 18;
  const payload: FederationRequestPayload = {
    full_name: s.full_name.trim(),
    birth_date: s.birth_date as string,
    sex: s.sex as FederationRequestPayload["sex"],
    cpf: onlyDigits(s.cpf),
    rg: (s.rg || "").trim(),
    phone: onlyDigits(s.phone),
    email: (s.email || "").trim(),
    claimed_belt: (s.belt_label || "").trim(),
    zip_code: onlyDigits(s.zip_code),
    street: (s.street || "").trim(),
    number: (s.number || "").trim(),
    neighborhood: (s.neighborhood || "").trim(),
    city: (s.city || "").trim(),
    state: (s.state || "").trim().toUpperCase(),
  };
  if (minor) {
    payload.guardian_name = (s.guardian?.full_name || "").trim();
    payload.guardian_phone = onlyDigits(s.guardian?.phone);
    payload.guardian_relationship = (s.guardian?.relationship || "").trim();
  }
  return payload;
}

function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <View
      style={[styles.checkbox, checked && styles.checkboxOn, disabled && styles.checkboxDisabled]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {checked && <Icon name="check" size={12} color="#fff" />}
    </View>
  );
}

export function FederacaoEnviarAlunosSection({ federationId }: Props) {
  const [students, setStudents] = useState<DojoStudent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await karateDojoStudentsApi.listStudents(federationId, {
        status: "active",
        limit: DOJO_STUDENTS_MAX_LIMIT,
      });
      setStudents(res.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  const selectable = useMemo(
    () => (students ?? []).filter((s) => (s.federation_link_status ?? "none") === "none"),
    [students]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectable.length === 0) return;
    setSelected((prev) => (prev.size === selectable.length ? new Set() : new Set(selectable.map((s) => s.id))));
  };

  const send = async () => {
    if (!students || selected.size === 0 || sending) return;
    setSending(true);
    setResults(null);
    const rows: RowResult[] = [];
    // Sequencial de propósito: sem endpoint de lote no backend, uma
    // chamada por aluno — e o feedback (abaixo) mostra quem passou e
    // quem falhou, e por quê, nunca sucesso silencioso.
    for (const id of Array.from(selected)) {
      const s = students.find((x) => x.id === id);
      if (!s) continue;
      const missing = missingFieldsFor(s);
      if (missing.length > 0) {
        rows.push({ id, name: s.full_name, ok: false, reason: `Faltam dados na ficha: ${missing.join(", ")}.` });
        continue;
      }
      try {
        await karateDojoStudentsApi.requestFederation(federationId, id, payloadFor(s));
        rows.push({ id, name: s.full_name, ok: true });
      } catch (e: any) {
        rows.push({ id, name: s.full_name, ok: false, reason: mapFederationError(e).message });
      }
    }
    setSending(false);
    setResults(rows);
    setSelected(new Set());

    const ok = rows.filter((r) => r.ok).length;
    const fail = rows.length - ok;
    if (ok > 0 && fail === 0) {
      toast.success(`${ok} aluno${ok === 1 ? "" : "s"} enviado${ok === 1 ? "" : "s"} para a federação validar.`);
    } else if (ok > 0 && fail > 0) {
      toast.info(`${ok} enviado${ok === 1 ? "" : "s"}, ${fail} não foi${fail === 1 ? "" : "ram"} — veja os motivos abaixo.`);
    } else {
      toast.error(`Nenhum aluno enviado — veja os motivos abaixo.`);
    }
    await load();
  };

  if (loading) {
    return (
      <View style={styles.box}>
        <View style={styles.centerRow}>
          <ActivityIndicator color={KarateColors.primary} />
        </View>
      </View>
    );
  }

  if (error || !students) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Enviar alunos para a federação validar</Text>
        <Text style={styles.hint}>Não foi possível carregar os alunos do dojô.</Text>
        <TouchableOpacity onPress={load} accessibilityRole="button">
          <Text style={styles.retry}>Tentar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allSelected = selectable.length > 0 && selected.size === selectable.length;
  const okCount = results ? results.filter((r) => r.ok).length : 0;
  const failCount = results ? results.length - okCount : 0;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Enviar alunos para a federação validar</Text>
      <Text style={styles.hint}>
        Marque os alunos que já estão cadastrados no seu dojô e ainda não são federados — sem preencher ficha
        de novo, os dados são os que você já cadastrou. Quem já é federado ou já tem pedido em análise não pode
        ser reenviado.
      </Text>

      {students.length === 0 ? (
        <Text style={styles.hint}>Nenhum aluno ativo cadastrado ainda em "Meus alunos".</Text>
      ) : (
        <>
          <TouchableOpacity
            onPress={toggleAll}
            style={styles.selectAllRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected, disabled: selectable.length === 0 }}
            disabled={selectable.length === 0}
          >
            <Checkbox checked={allSelected} disabled={selectable.length === 0} />
            <Text style={styles.selectAllTxt}>
              {selectable.length === 0
                ? "Nenhum aluno disponível para envio"
                : `Selecionar todos (${selectable.length} disponíve${selectable.length === 1 ? "l" : "is"})`}
            </Text>
          </TouchableOpacity>

          <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator>
            {students.map((s) => {
              const status = s.federation_link_status ?? "none";
              const canSelect = status === "none";
              const view = STATUS_VIEW[status] ?? STATUS_VIEW.none;
              const checked = selected.has(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.row, !canSelect && styles.rowDisabled]}
                  onPress={() => canSelect && toggle(s.id)}
                  disabled={!canSelect}
                  accessibilityRole="checkbox"
                  accessibilityLabel={s.full_name}
                  accessibilityState={{ checked, disabled: !canSelect }}
                >
                  <Checkbox checked={checked} disabled={!canSelect} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{s.full_name}</Text>
                    <Text style={styles.rowBelt} numberOfLines={1}>{s.belt_label || "Sem faixa"}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: view.bg }]}>
                    <Icon name={view.icon as any} size={11} color={view.color} />
                    <Text style={[styles.statusPillTxt, { color: view.color }]}>{view.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <KarateButton
            label={sending ? "Enviando…" : `Enviar selecionados (${selected.size})`}
            variant="sumi"
            size="sm"
            onPress={send}
            loading={sending}
            disabled={selected.size === 0}
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          />

          {!!results && (
            <View style={styles.resultsBox}>
              <Text style={styles.resultsTitle}>
                {okCount} enviado{okCount === 1 ? "" : "s"} · {failCount} falhou{failCount === 1 ? "" : "aram"}
              </Text>
              {results.map((r) => (
                <View key={r.id} style={styles.resultRow}>
                  <Icon
                    name={r.ok ? "checkmark-circle" : "alert_circle"}
                    size={13}
                    color={r.ok ? KarateColors.ok : KarateColors.danger}
                  />
                  <Text style={styles.resultTxt}>
                    {r.name}{!r.ok && r.reason ? ` — ${r.reason}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: KarateColors.surface,
    borderRadius: KarateRadius.lg,
    borderWidth: 1,
    borderColor: KarateColors.border,
    padding: 16,
    gap: 10,
  } as ViewStyle,
  centerRow: { alignItems: "center", justifyContent: "center", paddingVertical: 12 } as ViewStyle,
  title: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  hint: { fontSize: 12.5, color: KarateColors.ink3, lineHeight: 18 } as TextStyle,
  retry: { fontSize: 13, fontWeight: "700", color: KarateColors.primary, marginTop: 2 } as TextStyle,

  selectAllRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 } as ViewStyle,
  selectAllTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,

  list: { maxHeight: 420 } as ViewStyle,

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
  } as ViewStyle,
  rowDisabled: { opacity: 0.6 } as ViewStyle,
  rowName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  rowBelt: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: KarateColors.border2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  } as ViewStyle,
  checkboxOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  checkboxDisabled: { opacity: 0.4 } as ViewStyle,

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  } as ViewStyle,
  statusPillTxt: { fontSize: 10.5, fontWeight: "700" } as TextStyle,

  resultsBox: {
    marginTop: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: KarateColors.border2,
    borderRadius: KarateRadius.md,
    backgroundColor: KarateColors.glass2,
    padding: 10,
  } as ViewStyle,
  resultsTitle: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 } as ViewStyle,
  resultTxt: { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 16 } as TextStyle,
});
