// ============================================================
// TagsConfigCard — bloco "Tags dos alunos" em Configurações (F11)
//
// CRUD completo (criar, renomear, desativar/reativar, excluir) com a
// contagem de alunos de cada tag — mesmo padrão visual dos outros
// cards desta tela (DadosDojoCard/FiliacaoCard em configuracoes.tsx).
//
// Regras do backend (src/routes/karateDojoTags.js +
// karateDojoTagService.js, migration 274) que esta UI precisa respeitar:
//   • Nome único por dojô, case-insensitive — 409 DUPLICATE_TAG_NAME
//     tratado com mensagem clara (mapTagError), nunca erro cru.
//   • DELETE só é aceito para tag SEM nenhum aluno. Em uso, o backend
//     devolve 409 TAG_EM_USO — a UI então oferece "Desativar" em vez de
//     insistir no excluir: desativar preserva os vínculos existentes
//     (histórico intacto) e só impede NOVAS atribuições.
//
// Lista TODAS as tags (ativas e desativadas, sem filtro ?active=) —
// mesmo racional do parseActiveFilter no backend: o sensei precisa ver
// as desativadas para poder reativar (dado faltante ≠ pendência).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import { karateDojoTagsApi, DojoTag } from "@/services/karateDojoTagsApi";
import { mapTagError } from "./helpers";

interface Props {
  federationId: string;
}

type RowAction = "rename" | "delete-confirm" | "delete-blocked" | null;

export function TagsConfigCard({ federationId }: Props) {
  const [tags, setTags] = useState<DojoTag[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [rowAction, setRowAction] = useState<Record<string, RowAction>>({});
  const [renameValue, setRenameValue] = useState<Record<string, string>>({});
  const [rowErr, setRowErr] = useState<Record<string, string | null>>({});

  const load = useCallback(() => {
    setLoadErr(null);
    karateDojoTagsApi
      .listTags(federationId)
      .then((r) => setTags(r.data ?? []))
      .catch((e) => setLoadErr(mapTagError(e).message));
  }, [federationId]);

  useEffect(() => {
    load();
  }, [load]);

  function setActionFor(id: string, action: RowAction) {
    setRowAction((prev) => ({ ...prev, [id]: action }));
  }
  function setRowErrFor(id: string, msg: string | null) {
    setRowErr((prev) => ({ ...prev, [id]: msg }));
  }
  function cancelRowAction(id: string) {
    setActionFor(id, null);
    setRowErrFor(id, null);
  }

  function startCreate() {
    setCreating(true);
    setNewName("");
    setCreateErr(null);
  }

  async function submitCreate() {
    const name = newName.trim();
    if (!name) {
      setCreateErr("Informe um nome para a tag.");
      return;
    }
    setCreateBusy(true);
    setCreateErr(null);
    try {
      await karateDojoTagsApi.createTag(federationId, { name });
      setCreating(false);
      setNewName("");
      load();
    } catch (e: any) {
      setCreateErr(mapTagError(e).message);
    } finally {
      setCreateBusy(false);
    }
  }

  function startRename(t: DojoTag) {
    setActionFor(t.id, "rename");
    setRenameValue((prev) => ({ ...prev, [t.id]: t.name }));
    setRowErrFor(t.id, null);
  }

  async function submitRename(t: DojoTag) {
    const name = (renameValue[t.id] ?? "").trim();
    if (!name) {
      setRowErrFor(t.id, "Informe um nome para a tag.");
      return;
    }
    setRowBusyId(t.id);
    try {
      await karateDojoTagsApi.updateTag(federationId, t.id, { name });
      cancelRowAction(t.id);
      load();
    } catch (e: any) {
      setRowErrFor(t.id, mapTagError(e).message);
    } finally {
      setRowBusyId(null);
    }
  }

  async function toggleActive(t: DojoTag) {
    setRowBusyId(t.id);
    setRowErrFor(t.id, null);
    try {
      await karateDojoTagsApi.updateTag(federationId, t.id, { active: !t.active });
      load();
    } catch (e: any) {
      setRowErrFor(t.id, mapTagError(e).message);
    } finally {
      setRowBusyId(null);
    }
  }

  function askDelete(t: DojoTag) {
    setActionFor(t.id, "delete-confirm");
    setRowErrFor(t.id, null);
  }

  async function confirmDelete(t: DojoTag) {
    setRowBusyId(t.id);
    try {
      await karateDojoTagsApi.deleteTag(federationId, t.id);
      cancelRowAction(t.id);
      load();
    } catch (e: any) {
      const code = e?.data?.code ?? e?.code ?? null;
      if (code === "TAG_EM_USO") {
        // O backend recusa apagar tag em uso — a saída é desativar, que
        // preserva os vínculos existentes (histórico de quem já foi
        // marcado com ela) e só bloqueia NOVAS atribuições.
        setActionFor(t.id, "delete-blocked");
      } else {
        setRowErrFor(t.id, mapTagError(e).message);
        setActionFor(t.id, null);
      }
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeadRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Tags dos alunos</Text>
          <Text style={styles.cardSub}>
            Rótulos livres para organizar seus alunos — local de treino, turma da manhã, bolsista, o que fizer sentido pro seu dojô. Um aluno pode ter várias. Diferente de Turma (dia, horário e presença).
          </Text>
        </View>
        {!creating && (
          <TouchableOpacity onPress={startCreate} accessibilityRole="button" style={styles.editBtn}>
            <Icon name="add" size={13} color={KarateColors.primary} />
            <Text style={styles.editBtnTxt}>Nova tag</Text>
          </TouchableOpacity>
        )}
      </View>

      {creating && (
        <View style={styles.createBox}>
          <FormField
            label="Nome da tag"
            required
            value={newName}
            onChangeText={(t) => { setNewName(t); setCreateErr(null); }}
            placeholder='Ex.: "SESC Areikan"'
            error={createErr ?? undefined}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <KarateButton label="Criar tag" variant="sumi" size="sm" onPress={submitCreate} loading={createBusy} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {tags === null && !loadErr && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
        </View>
      )}

      {!!loadErr && <Text style={styles.generalErr}>{loadErr}</Text>}

      {tags !== null && tags.length === 0 && !creating && (
        <Text style={styles.hint}>Nenhuma tag cadastrada ainda. Comece pelos locais de treino do seu dojô.</Text>
      )}

      {tags !== null && tags.length > 0 && (
        <View style={styles.list}>
          {tags.map((t) => {
            const action = rowAction[t.id] ?? null;
            const busy = rowBusyId === t.id;
            return (
              <View key={t.id} style={[styles.row, !t.active && styles.rowInactive]}>
                {action === "rename" ? (
                  <View style={styles.rowFull}>
                    <FormField
                      label="Nome da tag"
                      value={renameValue[t.id] ?? ""}
                      onChangeText={(v) => setRenameValue((prev) => ({ ...prev, [t.id]: v }))}
                      error={rowErr[t.id] ?? undefined}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => cancelRowAction(t.id)} style={{ flex: 1 }} />
                      <KarateButton label="Salvar" variant="sumi" size="sm" onPress={() => submitRename(t)} loading={busy} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : action === "delete-confirm" ? (
                  <View style={styles.rowFull}>
                    <Text style={styles.confirmTxt}>
                      Excluir a tag "{t.name}"? Isso só é possível porque nenhum aluno está marcado com ela hoje.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => cancelRowAction(t.id)} style={{ flex: 1 }} />
                      <KarateButton label="Excluir" variant="primary" size="sm" onPress={() => confirmDelete(t)} loading={busy} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : action === "delete-blocked" ? (
                  <View style={styles.rowFull}>
                    <Text style={styles.confirmTxt}>
                      Esta tag está atribuída a {t.student_count ?? 0} aluno{(t.student_count ?? 0) === 1 ? "" : "s"} e não pode ser excluída. Desative-a para deixar de usá-la em novas atribuições — os alunos que já têm essa tag continuam com ela no histórico.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => cancelRowAction(t.id)} style={{ flex: 1 }} />
                      <KarateButton
                        label="Desativar tag"
                        variant="sumi"
                        size="sm"
                        onPress={() => { cancelRowAction(t.id); toggleActive(t); }}
                        loading={busy}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.rowInfo}>
                      <View style={styles.rowNameLine}>
                        <Text style={styles.tagName} numberOfLines={1}>{t.name}</Text>
                        {!t.active && (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeTxt}>Desativada</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.tagMeta}>
                        {t.student_count ?? 0} aluno{(t.student_count ?? 0) === 1 ? "" : "s"}
                      </Text>
                      {!!rowErr[t.id] && <Text style={styles.generalErr}>{rowErr[t.id]}</Text>}
                    </View>
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        onPress={() => startRename(t)}
                        accessibilityRole="button"
                        accessibilityLabel={`Renomear ${t.name}`}
                        style={styles.iconBtn}
                      >
                        <Icon name="edit" size={14} color={KarateColors.ink3} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toggleActive(t)}
                        accessibilityRole="button"
                        accessibilityLabel={t.active ? `Desativar ${t.name}` : `Reativar ${t.name}`}
                        style={styles.iconBtn}
                        disabled={busy}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={KarateColors.ink3} />
                        ) : (
                          <Icon name={t.active ? "eye_off" : "eye"} size={14} color={KarateColors.ink3} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => askDelete(t)}
                        accessibilityRole="button"
                        accessibilityLabel={`Excluir ${t.name}`}
                        style={styles.iconBtn}
                      >
                        <Icon name="trash" size={14} color={KarateColors.danger} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2, lineHeight: 17 } as TextStyle,
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  editBtnTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  createBox: { gap: 10, marginTop: 10, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.bg2 } as ViewStyle,
  loadingBox: { alignItems: "center", justifyContent: "center", paddingVertical: 16 } as ViewStyle,
  hint: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17, marginTop: 10 } as TextStyle,
  generalErr: { fontSize: 12, color: KarateColors.danger, fontWeight: "600", marginTop: 6, lineHeight: 17 } as TextStyle,
  list: { marginTop: 10, gap: 8 } as ViewStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 10, backgroundColor: "#fff" } as ViewStyle,
  rowInactive: { backgroundColor: KarateColors.bg2, borderStyle: "dashed" } as ViewStyle,
  rowFull: { flex: 1, gap: 8 } as ViewStyle,
  rowInfo: { flex: 1, minWidth: 0, gap: 2 } as ViewStyle,
  rowNameLine: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  tagName: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  tagMeta: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  inactiveBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: KarateColors.neutralSoft } as ViewStyle,
  inactiveBadgeTxt: { fontSize: 10, fontWeight: "700", color: KarateColors.neutral } as TextStyle,
  confirmTxt: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  rowActions: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  iconBtn: { width: 28, height: 28, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2 } as ViewStyle,
});
