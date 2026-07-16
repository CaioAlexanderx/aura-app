// ============================================================
// Selector de dojô — dropdown compacto com busca.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
//
// bugfix (16/07/2026, Caio): o seletor pré-selecionava um dojô sozinho
// (auto-select quando a busca sem filtro devolvia só 1 resultado — o que
// acontecia sempre que havia só 1 dojô ATIVO, mesmo com vários inativos no
// catálogo) e a busca sempre trazia TODOS os dojôs, inclusive inativos, sem
// nenhuma forma de restringir. Correção:
//   - Nenhum auto-select: o dropdown só lista candidatos, nunca escolhe por
//     conta própria (nem no mount, nem ao abrir com 1 resultado só).
//   - Busca via listDojos({status: "active"}) por padrão — só ativos.
//   - Toggle opt-in "Mostrar inativos" (desligado por padrão) troca pra
//     status=undefined (todos) — ver DojosListTab, mesmo contrato de API.
//   - Edição em dojô inativo: se o dojô já selecionado (valueId) não vier
//     na lista filtrada (porque está inativo e o toggle está off), ele é
//     buscado à parte (getDojo) e fixado no topo da lista, marcado
//     "(inativo)" — assim abrir a ficha e salvar sem mexer no campo NUNCA
//     troca o dojô do praticante em silêncio.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, FlatList,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateFonts as F, ShojiPalette as P } from "@/constants/karateTheme";
import { karateApi, Dojo } from "@/services/karateApi";
import { styles } from "./shared-styles";

// Referência module-level ao último dojô da sessão (mesma filosofia do shell).
// O shell passa uma ref para que possamos mutar o valor compartilhado.
interface DojoSelectProps {
  federationId: string;
  valueId: string;
  valueName: string;
  onSelect: (d: Dojo) => void;
  /** Ref mutável para o lastDojo da sessão — atualizado quando o usuário seleciona */
  lastDojoRef: React.MutableRefObject<{ id: string; name: string } | null>;
}

// Item "pinado": o dojô atualmente selecionado, quando ele não aparece na
// lista filtrada (por estar inativo e o toggle "mostrar inativos" desligado).
type PinnedDojo = { id: string; name: string; is_active: boolean };

export function DojoSelectSection({ federationId, valueId, valueName, onSelect, lastDojoRef }: DojoSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Dojo[]>([]);
  const [loading, setLoading] = useState(false);
  // Só ativos por padrão — desligado. Ligar mostra o catálogo inteiro.
  const [showInactive, setShowInactive] = useState(false);
  const [pinned, setPinned] = useState<PinnedDojo | null>(null);
  const [label, setLabel] = useState(
    valueName || (valueId && lastDojoRef.current?.id === valueId ? lastDojoRef.current.name : "")
  );

  useEffect(() => {
    if (valueName) { setLabel(valueName); return; }
    if (valueId && lastDojoRef.current?.id === valueId) setLabel(lastDojoRef.current.name);
  }, [valueName, valueId, lastDojoRef]);

  // includeInactive explícito (em vez de depender do state showInactive) porque
  // a resolução de rótulo (F1.2, abaixo) precisa SEMPRE poder achar o dojô
  // atual mesmo que ele esteja inativo e o toggle da UI esteja desligado.
  const fetchDojos = useCallback(async (term: string, includeInactive: boolean) => {
    setLoading(true);
    try {
      const res = await karateApi.listDojos(federationId, {
        q: term || undefined,
        pageSize: 50,
        status: includeInactive ? undefined : "active",
      });
      return res.data;
    }
    catch { return [] as Dojo[]; } finally { setLoading(false); }
  }, [federationId]);

  // ao abrir (ou ao alternar "mostrar inativos"), carrega a lista — SEM
  // auto-selecionar nada, mesmo se vier só 1 resultado. Selecionar é sempre
  // ação explícita do usuário.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchDojos(q, showInactive).then((data) => {
      if (!alive) return;
      setList(data);
    });
    return () => { alive = false; };
  }, [open, showInactive, fetchDojos]); // eslint-disable-line react-hooks/exhaustive-deps

  // F1.2: no modo edição o dojo_id já vem do detalhe mas o nome pode não ter
  // chegado no primeiro render. Se temos id mas ainda não temos rótulo, resolve.
  // Sempre com includeInactive=true — o dojô atual pode estar inativo e
  // precisamos do nome dele independente do filtro da UI.
  useEffect(() => {
    if (!valueId || label) return;
    let alive = true;
    fetchDojos("", true).then((data) => {
      if (!alive) return;
      const hit = data.find((d) => d.id === valueId);
      if (hit) { lastDojoRef.current = { id: hit.id, name: hit.name }; setLabel(hit.name); }
    });
    return () => { alive = false; };
  }, [valueId, label, fetchDojos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garante que o dojô JÁ SELECIONADO apareça no dropdown mesmo se estiver
  // inativo e o filtro padrão (só ativos) escondê-lo da lista — sem isso,
  // abrir o seletor e salvar sem tocar em nada trocaria/perderia o dojô do
  // praticante em silêncio (risco central desta correção).
  useEffect(() => {
    if (!open || !valueId) { setPinned(null); return; }
    if (list.some((d) => d.id === valueId)) { setPinned(null); return; }
    let alive = true;
    karateApi.getDojo(federationId, valueId)
      .then((d) => { if (alive) setPinned({ id: d.id, name: d.name, is_active: d.is_active }); })
      .catch(() => { if (alive) setPinned(null); });
    return () => { alive = false; };
  }, [open, valueId, list, federationId]);

  const onSearch = useCallback((t: string) => {
    setQ(t);
    fetchDojos(t, showInactive).then(setList);
  }, [fetchDojos, showInactive]);

  const toggleShowInactive = useCallback(() => {
    setShowInactive((v) => !v);
  }, []);

  // pinned some da lista assim que o próprio dojô pinado é selecionado de novo
  // ou quando outro item é escolhido — reaproveita o mesmo onPress.
  const selectItem = useCallback((item: Dojo | PinnedDojo) => {
    setLabel(item.name);
    setOpen(false);
    setQ("");
    onSelect(item as Dojo);
  }, [onSelect]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Dojô <Text style={{ color: P.red }}>*</Text></Text>
      <TouchableOpacity style={styles.input} onPress={() => setOpen((o) => !o)} activeOpacity={0.7} accessibilityLabel="Dojô">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: label ? P.ink : P.ink4 }} numberOfLines={1}>
            {label || "Selecionar dojô…"}
          </Text>
          <Icon name={open ? "chevron_up" : "chevron_down"} size={14} color={P.ink3} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          <TextInput
            style={styles.dropdownSearch}
            placeholder="Buscar por nome ou FPKT-NNN"
            placeholderTextColor={P.ink4}
            value={q}
            onChangeText={onSearch}
            autoFocus
            accessibilityLabel="Buscar dojô"
          />
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.line }}
            onPress={toggleShowInactive}
            activeOpacity={0.6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showInactive }}
            accessibilityLabel="Mostrar dojôs inativos"
          >
            <Icon name={showInactive ? "eye" : "eye_off"} size={13} color={P.ink3} />
            <Text style={{ fontFamily: F.body, fontSize: 12, color: P.ink3, flex: 1 }}>
              Mostrar inativos
            </Text>
            <View style={{
              width: 30, height: 17, borderRadius: 999, padding: 2, justifyContent: "center",
              backgroundColor: showInactive ? P.red : P.paper3,
              borderWidth: 1, borderColor: showInactive ? P.red : P.line2,
            }}>
              <View style={{
                width: 12, height: 12, borderRadius: 999, backgroundColor: "#fff",
                alignSelf: showInactive ? "flex-end" : "flex-start",
              }} />
            </View>
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator style={{ margin: 12 }} color={P.red} />
          ) : list.length === 0 && !pinned ? (
            <Text style={styles.dropdownEmpty}>Nenhum dojô encontrado</Text>
          ) : (
            <FlatList
              data={pinned ? [pinned, ...list] : list}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 200 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isPinned = pinned?.id === item.id;
                const isInactive = isPinned ? !pinned!.is_active : (item as Dojo).is_active === false;
                const selected = item.id === valueId;
                return (
                  <TouchableOpacity
                    style={[styles.dropdownItem, selected && { backgroundColor: P.glass }]}
                    onPress={() => selectItem(item)}
                    activeOpacity={0.6}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.dropdownName}>{item.name}</Text>
                      {isInactive ? (
                        <Text style={{ fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: P.red }}>
                          (inativo)
                        </Text>
                      ) : null}
                      {selected ? <Icon name="check" size={12} color={P.ink2} /> : null}
                    </View>
                    {"fpkt_affiliation_id" in item && item.fpkt_affiliation_id ? (
                      <Text style={styles.dropdownMeta}>{item.fpkt_affiliation_id}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
