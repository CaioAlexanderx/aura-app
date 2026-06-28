// ============================================================
// Selector de dojô — dropdown compacto com busca.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
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

export function DojoSelectSection({ federationId, valueId, valueName, onSelect, lastDojoRef }: DojoSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Dojo[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState(
    valueName || (valueId && lastDojoRef.current?.id === valueId ? lastDojoRef.current.name : "")
  );

  useEffect(() => {
    if (valueName) { setLabel(valueName); return; }
    if (valueId && lastDojoRef.current?.id === valueId) setLabel(lastDojoRef.current.name);
  }, [valueName, valueId, lastDojoRef]);

  const fetchDojos = useCallback(async (term: string) => {
    setLoading(true);
    try { const res = await karateApi.listDojos(federationId, { q: term || undefined, pageSize: 50 }); return res.data; }
    catch { return [] as Dojo[]; } finally { setLoading(false); }
  }, [federationId]);

  // ao abrir, carrega a lista (e se só houver 1 dojô e nada selecionado, pré-seleciona)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchDojos("").then((data) => {
      if (!alive) return;
      setList(data);
      if (!valueId && data.length === 1) {
        const only = data[0];
        lastDojoRef.current = { id: only.id, name: only.name };
        setLabel(only.name);
        onSelect(only);
        setOpen(false);
      }
    });
    return () => { alive = false; };
  }, [open, fetchDojos]); // eslint-disable-line react-hooks/exhaustive-deps

  // pré-seleciona único dojô já na montagem (sem precisar abrir o dropdown)
  useEffect(() => {
    if (valueId) return;
    let alive = true;
    fetchDojos("").then((data) => {
      if (!alive) return;
      if (!valueId && data.length === 1) {
        const only = data[0];
        lastDojoRef.current = { id: only.id, name: only.name };
        setLabel(only.name);
        onSelect(only);
      }
    });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // F1.2: no modo edição o dojo_id já vem do detalhe mas o nome pode não ter
  // chegado no primeiro render. Se temos id mas ainda não temos rótulo, resolve.
  useEffect(() => {
    if (!valueId || label) return;
    let alive = true;
    fetchDojos("").then((data) => {
      if (!alive) return;
      const hit = data.find((d) => d.id === valueId);
      if (hit) { lastDojoRef.current = { id: hit.id, name: hit.name }; setLabel(hit.name); }
    });
    return () => { alive = false; };
  }, [valueId, label, fetchDojos]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = useCallback((t: string) => {
    setQ(t);
    fetchDojos(t).then(setList);
  }, [fetchDojos]);

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
          {loading ? (
            <ActivityIndicator style={{ margin: 12 }} color={P.red} />
          ) : list.length === 0 ? (
            <Text style={styles.dropdownEmpty}>Nenhum dojô encontrado</Text>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 200 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => { setLabel(item.name); setOpen(false); setQ(""); onSelect(item); }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  {item.fpkt_affiliation_id ? (
                    <Text style={styles.dropdownMeta}>{item.fpkt_affiliation_id}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}
