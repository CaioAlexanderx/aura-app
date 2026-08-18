// ============================================================
// AURA STUDIO · PDV — campo de data no formato brasileiro
//
// A lojista digita e lê DD/MM/AAAA; o resto do sistema continua falando
// ISO (AAAA-MM-DD), que é o que o backend valida.
//
// Por que este componente existe:
// O TextInput do React Native Web NÃO repassa props desconhecidas pro DOM,
// então o `type="date"` que estava espalhado nas telas era descartado em
// silêncio — o campo virava um text comum pedindo "AAAA-MM-DD" na mão,
// sem calendário e no formato errado. Verificado no DOM em produção:
// o input saía com type="text".
//
// A solução usa os dois caminhos, cada um no que é bom:
//   • um TextInput com máscara pra quem digita (funciona em web e mobile)
//   • um <input type="date"> REAL, invisível, atrás do botão de calendário
//     — no web isso dá o date picker nativo do navegador de graça
//
// Reusa maskDateBr/brDateToIso de utils/masks (já usados em outras 4 telas
// do app), em vez de reimplementar validação de data aqui.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { maskDateBr, brDateToIso } from "@/utils/masks";

/** AAAA-MM-DD → DD/MM/AAAA. Sem new Date(): data pura viraria UTC. */
export function isoParaBr(iso?: string | null): string {
  const s = String(iso || "").slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export function DataBR({
  value,
  onChange,
  t,
  min,
  placeholder = "DD/MM/AAAA",
  compact = false,
  accessibilityLabel = "Data",
}: {
  /** Sempre ISO (AAAA-MM-DD) ou "" — o contrato com o resto do app. */
  value: string;
  onChange: (iso: string) => void;
  t: any;
  min?: string;
  placeholder?: string;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  // Texto visível: espelha o value ISO, mas tem vida própria enquanto ela
  // digita (uma data pela metade não é um ISO válido).
  const [texto, setTexto] = useState(() => isoParaBr(value));
  const inputOculto = useRef<any>(null);

  // Mudança vinda de fora (limpar, sugestão de prazo) reflete no texto.
  useEffect(() => {
    const esperado = isoParaBr(value);
    if (brDateToIso(texto) !== (value || null) && esperado !== texto) setTexto(esperado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function digitou(bruto: string) {
    const mascarado = maskDateBr(bruto);
    setTexto(mascarado);
    const iso = brDateToIso(mascarado);
    // Só propaga quando a data está completa e é real (pega 31/02).
    if (iso) onChange(iso);
    else if (mascarado === "") onChange("");
  }

  function abrirCalendario() {
    const el = inputOculto.current;
    if (!el) return;
    // showPicker é o caminho moderno; o clique cobre navegadores antigos.
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  }

  const alturaCampo = compact ? 40 : 42;
  // Data incompleta não é erro enquanto ela digita — só quando parou de
  // digitar com algo escrito que não vira data.
  const invalido = texto.length === 10 && !brDateToIso(texto);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          flexDirection: "row", alignItems: "center", flex: compact ? 1 : 0,
          minWidth: compact ? undefined : 170,
          height: alturaCampo, borderWidth: 1,
          borderColor: invalido ? t.warning : t.ink5,
          borderRadius: compact ? 9 : 10, backgroundColor: t.bgSoft,
          paddingHorizontal: 12,
        }}
      >
        <TextInput
          value={texto}
          onChangeText={digitou}
          placeholder={placeholder}
          placeholderTextColor={t.ink4}
          keyboardType="number-pad"
          maxLength={10}
          accessibilityLabel={accessibilityLabel}
          style={[
            { flex: 1, fontSize: compact ? 13.5 : 14, fontWeight: "700", color: t.ink },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
          ]}
        />
        <Pressable
          onPress={abrirCalendario}
          accessibilityLabel="Abrir calendário"
          style={{ paddingLeft: 8, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
        >
          <Icon name="calendar-outline" size={17} color={t.ink3} />
        </Pressable>

        {/* O date picker de verdade. Fica sob o botão, invisível, porque o
            TextInput do RN Web não vira type="date" de jeito nenhum. */}
        {Platform.OS === "web" ? (
          <input
            ref={inputOculto}
            type="date"
            value={value || ""}
            min={min}
            onChange={(e: any) => {
              const iso = e.target.value || "";
              onChange(iso);
              setTexto(isoParaBr(iso));
            }}
            tabIndex={-1}
            aria-hidden="true"
            style={{
              position: "absolute", right: 10, bottom: 0,
              width: 1, height: 1, opacity: 0, border: 0, padding: 0,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </View>

      {invalido ? (
        <Text style={{ fontSize: 11.5, color: t.warning, fontWeight: "700" }}>Data inválida</Text>
      ) : null}
    </View>
  );
}
